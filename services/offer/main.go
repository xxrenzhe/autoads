package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/xxrenzhe/autoads/services/offer/internal/pkg/database"
	"github.com/xxrenzhe/autoads/services/offer/internal/pkg/secrets"
)

// Offer represents the data structure for an offer.
type Offer struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Name        string    `json:"name"`
	OriginalUrl string    `json:"originalUrl"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

// Server holds the dependencies for the HTTP server, like the database connection.
type Server struct {
	db *sql.DB
}

// offersHandler routes requests to the appropriate handler based on the HTTP method.
func (s *Server) offersHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.getOffersHandler(w, r)
	case http.MethodPost:
		s.createOfferHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// getOffersHandler retrieves a list of offers from the database.
func (s *Server) getOffersHandler(w http.ResponseWriter, r *http.Request) {
	// 从请求头中获取用户ID
	userID := r.Header.Get("X-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	// 使用获取到的userID来查询数据库
	rows, err := s.db.Query("SELECT id, user_id, name, original_url, status, created_at FROM \"Offer\" WHERE user_id = $1", userID)
	if err != nil {
		log.Printf("Error querying offers: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var offers []Offer
	for rows.Next() {
		var o Offer
		if err := rows.Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.CreatedAt); err != nil {
			log.Printf("Error scanning offer row: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		offers = append(offers, o)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error iterating offer rows: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(offers); err != nil {
		log.Printf("Error encoding offers: %v", err)
	}
}

// createOfferHandler creates a new offer and saves it to the database.
func (s *Server) createOfferHandler(w http.ResponseWriter, r *http.Request) {
	var newOffer Offer
	if err := json.NewDecoder(r.Body).Decode(&newOffer); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Basic validation
	if newOffer.Name == "" || newOffer.OriginalUrl == "" {
		http.Error(w, "Name and OriginalUrl are required", http.StatusBadRequest)
		return
	}

	// 从请求头中获取用户ID
	userID := r.Header.Get("X-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	newOffer.ID = uuid.New().String()
	newOffer.UserID = userID
	newOffer.Status = "evaluating" // 为新Offer设置默认状态
	newOffer.CreatedAt = time.Now()

	query := `INSERT INTO "Offer" (id, user_id, name, original_url, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := s.db.Exec(query, newOffer.ID, newOffer.UserID, newOffer.Name, newOffer.OriginalUrl, newOffer.Status, newOffer.CreatedAt)
	if err != nil {
		log.Printf("Error inserting new offer: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	log.Printf("Created new offer: %s for user: %s", newOffer.ID, newOffer.UserID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(newOffer); err != nil {
		log.Printf("Error encoding new offer response: %v", err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Offer service is healthy!")
}

func main() {
	log.Println("Starting Offer service...")

	// --- Dependency Injection ---

	// 1. Get Database DSN from Secret Manager
	dbSecretName := os.Getenv("DB_SECRET_NAME")
	if dbSecretName == "" {
		log.Fatalf("DB_SECRET_NAME environment variable not set")
	}

	dsn, err := secrets.GetSecret(dbSecretName)
	if err != nil {
		log.Fatalf("Failed to get database secret: %v", err)
	}

	// 2. Initialize Database Connection
	db, err := database.NewConnection(dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("Database connection successful.")

	// 3. Create Server instance with dependencies
	server := &Server{
		db: db,
	}

	// --- Routing ---
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/offers", server.offersHandler)

	// --- Start Server ---
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	log.Printf("Listening on port %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
