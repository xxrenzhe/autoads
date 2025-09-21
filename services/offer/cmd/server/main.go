
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/xxrenzhe/autoads/services/offer/internal/domain"
	"github.com/xxrenzhe/autoads/services/offer/internal/events"
	"github.com/xxrenzhe/autoads/pkg/config"
	"github.com/xxrenzhe/autoads/pkg/logger"
	"github.com/xxrenzhe/autoads/pkg/middleware"
)

// OfferCreateRequest defines the expected JSON body for creating an offer.
type OfferCreateRequest struct {
	Name        string `json:"name"`
	OriginalUrl string `json:"originalUrl"`
}

var (
	db        *sql.DB
	ctx       = context.Background()
	log       = logger.Get()
	publisher *events.Publisher
)

func main() {
	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		log.Fatal().Err(err).Msg("Error loading config")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal().Msg("DATABASE_URL is not set")
	}
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Error connecting to the database")
	}
	defer db.Close()
	err = db.Ping()
	if err != nil {
		log.Fatal().Err(err).Msg("Error pinging the database at startup")
	}
	log.Info().Msg("Successfully connected to the database!")

	// Initialize the Pub/Sub publisher.
	publisher, err = events.NewPublisher(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create event publisher")
	}
	defer publisher.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthCheckHandler)

	protectedRoutes := http.NewServeMux()
	protectedRoutes.HandleFunc("/offers", offersHandler)

	mux.Handle("/api/", http.StripPrefix("/api", middleware.AuthMiddleware(protectedRoutes)))

	log.Info().Str("port", cfg.Server.Port).Msg("Offer service starting...")
	if err := http.ListenAndServe(":"+cfg.Server.Port, mux); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	err := db.Ping()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Health check failed: Database error: %v\n", err)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}

func offersHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		getOffers(w, r)
	case http.MethodPost:
		createOffer(w, r)
	default:
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
	}
}

func getOffers(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	
	query := `
		SELECT id, name, "originalUrl", status, "siterankScore", "createdAt"
		FROM "Offer"
		WHERE "userId" = $1
		ORDER BY "createdAt" DESC
	`
	rows, err := db.QueryContext(r.Context(), query, userID)
	if err != nil {
		log.Error().Err(err).Str("userID", userID).Msg("Failed to query offers")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var offers []*domain.Offer
	for rows.Next() {
		var o domain.Offer
		var score sql.NullFloat64
		if err := rows.Scan(&o.ID, &o.Name, &o.OriginalURL, &o.Status, &score, &o.CreatedAt); err != nil {
			log.Error().Err(err).Str("userID", userID).Msg("Failed to scan offer row")
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		if score.Valid {
			o.SiterankScore = &score.Float64
		}
		offers = append(offers, &o)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(offers)
}

func createOffer(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)

	var req OfferCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	offerID := uuid.New().String()
	// Use the domain model to create a new offer.
	offer := domain.NewOffer(offerID, userID, req.Name, req.OriginalUrl)

	// Publish the OfferCreated event.
	err := publisher.Publish(r.Context(), "OfferCreated", offer)
	if err != nil {
		log.Error().Err(err).Msg("Failed to publish OfferCreated event")
		http.Error(w, "Failed to create offer", http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(offer)
}
