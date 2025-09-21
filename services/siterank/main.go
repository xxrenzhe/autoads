package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/xxrenzhe/autoads/pkg/httpclient"
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

// SimilarWeb API response structure (simplified)
type SimilarWebResponse struct {
	GlobalRank int `json:"global_rank"`
	CountryRank int `json:"country_rank"`
	CategoryRank int `json:"category_rank"`
	TotalVisits float64 `json:"total_visits"`
}

type Server struct {
	db          *sql.DB
	httpClient  *httpclient.Client
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
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code.Name() == "unique_violation" {
			http.Error(w, "An analysis for this offer already exists.", http.StatusConflict)
			return
		}
		log.Printf("Error inserting new siterank analysis: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Launch the analysis in the background
	go s.performAnalysis(context.Background(), analysis.ID)

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

	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 3 || parts[2] == "" {
		http.Error(w, "Analysis ID is missing in URL path", http.StatusBadRequest)
		return
	}
	analysisID := parts[2]

	var analysis SiterankAnalysis
	var result sql.NullString
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

func (s *Server) performAnalysis(ctx context.Context, analysisID string) {
	log.Printf("Starting analysis for %s...", analysisID)

	// 1. Set status to "running"
	_, err := s.db.ExecContext(ctx, `UPDATE "SiterankAnalysis" SET status = 'running', updated_at = $1 WHERE id = $2`, time.Now(), analysisID)
	if err != nil {
		log.Printf("Failed to update analysis %s to running: %v", analysisID, err)
		return
	}

	// 2. Get the offer URL from the database
	var originalUrl string
	err = s.db.QueryRowContext(ctx, `SELECT o.originalUrl FROM "Offer" o JOIN "SiterankAnalysis" sa ON o.id = sa.offerId WHERE sa.id = $1`, analysisID).Scan(&originalUrl)
	if err != nil {
		log.Printf("Failed to get offer URL for analysis %s: %v", analysisID, err)
		s.updateAnalysisStatus(ctx, analysisID, "failed", fmt.Sprintf(`{"error": "offer URL not found: %v"}`, err))
		return
	}

	domain, err := url.Parse(originalUrl)
	if err != nil {
		log.Printf("Failed to parse offer URL for analysis %s: %v", analysisID, err)
		s.updateAnalysisStatus(ctx, analysisID, "failed", fmt.Sprintf(`{"error": "invalid offer URL: %v"}`, err))
		return
	}

	// 3. Call SimilarWeb API
	apiURL := fmt.Sprintf("https://data.similarweb.com/api/v1/data?domain=%s", domain.Hostname())
	var apiResponse SimilarWebResponse
	
	err = s.httpClient.GetJSON(ctx, apiURL, &apiResponse)
	if err != nil {
		log.Printf("Failed to get data from SimilarWeb for analysis %s: %v", analysisID, err)
		s.updateAnalysisStatus(ctx, analysisID, "failed", fmt.Sprintf(`{"error": "SimilarWeb API failed: %v"}`, err))
		return
	}
	
	// 4. Marshal result and update DB
	resultBytes, err := json.Marshal(apiResponse)
	if err != nil {
		log.Printf("Failed to marshal SimilarWeb response for analysis %s: %v", analysisID, err)
		s.updateAnalysisStatus(ctx, analysisID, "failed", fmt.Sprintf(`{"error": "failed to process API response: %v"}`, err))
		return
	}
	
	s.updateAnalysisStatus(ctx, analysisID, "completed", string(resultBytes))
	log.Printf("Successfully completed analysis for %s", analysisID)
}

func (s *Server) updateAnalysisStatus(ctx context.Context, analysisID, status, result string) {
	_, err := s.db.ExecContext(ctx, `UPDATE "SiterankAnalysis" SET status = $1, result = $2, updated_at = $3 WHERE id = $4`, status, result, time.Now(), analysisID)
	if err != nil {
		log.Printf("Failed to update analysis %s to %s: %v", analysisID, status, err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Siterank service is healthy!")
}

// --- Main Function ---

func main() {
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

	httpClient := httpclient.New(15 * time.Second)
	server := &Server{db: db, httpClient: httpClient}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
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
