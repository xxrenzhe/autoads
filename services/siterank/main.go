package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/xxrenzhe/autoads/services/siterank/internal/pkg/database"
	"github.com/xxrenzhe/autoads/services/siterank/internal/pkg/secrets"
)

// --- Data Structures ---

type SiterankAnalysis struct {
	ID        string         `json:"id"`
	UserID    string         `json:"userId"`
	OfferID   string         `json:"offerId"`
	Status    string         `json:"status"`
	Result    *string        `json:"result,omitempty"` // JSON stored as a string
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

type AnalysisRequest struct {
	OfferID string `json:"offerId"`
}

type Server struct {
	db *sql.DB
}

// --- HTTP Handlers ---

func (s *Server) analysesHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		s.createAnalysisHandler(w, r)
	case http.MethodGet:
		s.getAnalysisHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) createAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	var req AnalysisRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.OfferID == "" {
		http.Error(w, "OfferID is required", http.StatusBadRequest)
		return
	}

	analysis := SiterankAnalysis{
		ID:        uuid.New().String(),
		UserID:    userID,
		OfferID:   req.OfferID,
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	query := `INSERT INTO "SiterankAnalysis" (id, user_id, offer_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := s.db.Exec(query, analysis.ID, analysis.UserID, analysis.OfferID, analysis.Status, analysis.CreatedAt, analysis.UpdatedAt)
	if err != nil {
		// Check for unique constraint violation on offer_id
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code.Name() == "unique_violation" {
			http.Error(w, "An analysis for this offer already exists.", http.StatusConflict)
			return
		}
		log.Printf("Error inserting new siterank analysis: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Launch the analysis in the background
	go s.performAnalysis(analysis.ID)

	log.Printf("Accepted siterank analysis request %s for offer %s", analysis.ID, analysis.OfferID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted) // 202 Accepted
	json.NewEncoder(w).Encode(analysis)
}

func (s *Server) getAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	// Expecting URL like /analyses/{analysisId}
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 3 || parts[2] == "" {
		http.Error(w, "Analysis ID is missing in URL path", http.StatusBadRequest)
		return
	}
	analysisID := parts[2]

	var analysis SiterankAnalysis
	var result sql.NullString // Handle nullable result column
	query := `SELECT id, user_id, offer_id, status, result, created_at, updated_at FROM "SiterankAnalysis" WHERE id = $1 AND user_id = $2`
	err := s.db.QueryRow(query, analysisID, userID).Scan(
		&analysis.ID, &analysis.UserID, &analysis.OfferID, &analysis.Status, &result, &analysis.CreatedAt, &analysis.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			http.NotFound(w, r)
			return
		}
		log.Printf("Error getting siterank analysis: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	
	if result.Valid {
		analysis.Result = &result.String
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analysis)
}

// performAnalysis simulates a long-running AI analysis task.
func (s *Server) performAnalysis(analysisID string) {
	log.Printf("Starting analysis for %s...", analysisID)

	// 1. Set status to "running"
	_, err := s.db.Exec(`UPDATE "SiterankAnalysis" SET status = 'running', updated_at = $1 WHERE id = $2`, time.Now(), analysisID)
	if err != nil {
		log.Printf("Failed to update analysis %s to running: %v", analysisID, err)
		return
	}

	// 2. Simulate long-running task
	time.Sleep(time.Duration(5+rand.Intn(10)) * time.Second)

	// 3. Generate mock result and update DB
	score := float64(rand.Intn(100)) / 10.0 // Random score between 0.0 and 9.9
	resultJSON := fmt.Sprintf(`{"siterankScore": %.1f, "assessment": "This is a mock AI assessment."}`, score)
	
	_, err = s.db.Exec(`UPDATE "SiterankAnalysis" SET status = 'completed', result = $1, updated_at = $2 WHERE id = $3`, resultJSON, time.Now(), analysisID)
	if err != nil {
		log.Printf("Failed to update analysis %s to completed: %v", analysisID, err)
		// Optionally, update status to "failed"
		s.db.Exec(`UPDATE "SiterankAnalysis" SET status = 'failed', updated_at = $1 WHERE id = $2`, time.Now(), analysisID)
		return
	}

	log.Printf("Successfully completed analysis for %s", analysisID)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Siterank service is healthy!")
}

// --- Main Function ---

func main() {
	rand.Seed(time.Now().UnixNano()) // Seed the random number generator
	log.Println("Starting Siterank service...")

	dbSecretName := os.Getenv("DB_SECRET_NAME")
	if dbSecretName == "" {
		log.Fatalf("DB_SECRET_NAME environment variable not set")
	}
	dsn, err := secrets.GetSecret(dbSecretName)
	if err != nil {
		log.Fatalf("Failed to get database secret: %v", err)
	}

	db, err := database.NewConnection(dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("Database connection successful.")

	server := &Server{db: db}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	// This single registration handles both POST /analyses and GET /analyses/{id}
	mux.HandleFunc("/analyses/", server.analysesHandler) 
	
	port := os.Getenv("PORT")
	if port == "" {
		port = "8084"
	}

	log.Printf("Listening on port %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
