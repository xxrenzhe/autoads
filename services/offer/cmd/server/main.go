
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
    "github.com/xxrenzhe/autoads/pkg/logger"
    "github.com/xxrenzhe/autoads/pkg/middleware"
    apperr "github.com/xxrenzhe/autoads/pkg/errors"
    "strings"
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
    publisher events.Publisher
)

func main() {
    // Minimal config: use PORT from env (fallback 8080). Avoid external file dependencies in Cloud Run.
    port := os.Getenv("PORT")
    if strings.TrimSpace(port) == "" { port = "8080" }
    var err error

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
    if closer, ok := publisher.(interface{ Close() }); ok {
        defer closer.Close()
    }
	
	// Initialize the Pub/Sub subscriber.
    // (Optional) Event subscriber can be initialized here if available.

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthCheckHandler)

	protectedRoutes := http.NewServeMux()
	protectedRoutes.HandleFunc("/offers", offersHandler)

	mux.Handle("/api/", http.StripPrefix("/api", middleware.AuthMiddleware(protectedRoutes)))

    log.Info().Str("port", port).Msg("Offer service starting...")
	if err := http.ListenAndServe(":"+port, mux); err != nil {
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
        apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
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
        apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
        return
    }
	defer rows.Close()

	var offers []*domain.Offer
	for rows.Next() {
		var o domain.Offer
		var score sql.NullFloat64
        if err := rows.Scan(&o.ID, &o.Name, &o.OriginalURL, &o.Status, &score, &o.CreatedAt); err != nil {
            log.Error().Err(err).Str("userID", userID).Msg("Failed to scan offer row")
            apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
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
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
	
	offerID := uuid.New().String()
    // Publish the OfferCreated domain event (CQRS write path)
    evt := domain.OfferCreatedEvent{
        OfferID:     offerID,
        UserID:      userID,
        Name:        req.Name,
        OriginalUrl: req.OriginalUrl,
        Status:      "evaluating",
        CreatedAt:   time.Now(),
    }
    err := publisher.Publish(r.Context(), evt)
    if err != nil {
        log.Error().Err(err).Msg("Failed to publish OfferCreated event")
        apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to create offer", nil)
        return
    }
	
    w.WriteHeader(http.StatusAccepted)
    json.NewEncoder(w).Encode(evt)
}
