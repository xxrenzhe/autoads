package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"github.com/xxrenzhe/autoads/services/offer/internal/auth"
	"github.com/xxrenzhe/autoads/services/offer/internal/domain"
	"github.com/xxrenzhe/autoads/services/offer/internal/events"
	"time"

	"github.com/google/uuid"
)

// Offer represents the read model for an offer.
type Offer struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Name        string    `json:"name"`
	OriginalUrl string    `json:"originalUrl"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

// Handler holds dependencies for the HTTP handlers.
type Handler struct {
    DB        *sql.DB
    Publisher events.Publisher
}

// NewHandler creates a new Handler.
func NewHandler(db *sql.DB, publisher events.Publisher) *Handler {
    return &Handler{DB: db, Publisher: publisher}
}

// RegisterRoutes registers the HTTP routes for the service.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
	mux.HandleFunc("/healthz", h.healthz)
	mux.Handle("/api/v1/offers", authMiddleware(http.HandlerFunc(h.offersHandler)))
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) offersHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.getOffers(w, r)
	case http.MethodPost:
		h.createOffer(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// createOffer validates the request and publishes an OfferCreated event.
func (h *Handler) createOffer(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	var req struct {
		Name        string `json:"name"`
		OriginalUrl string `json:"originalUrl"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.OriginalUrl == "" {
		http.Error(w, "Name and OriginalUrl are required", http.StatusBadRequest)
		return
	}

	event := domain.OfferCreatedEvent{
		OfferID:     uuid.New().String(),
		UserID:      userID,
		Name:        req.Name,
		OriginalUrl: req.OriginalUrl,
		Status:      "evaluating", // Default status for new offers
		CreatedAt:   time.Now(),
	}

    if err := h.Publisher.Publish(r.Context(), event); err != nil {
        log.Printf("Error publishing OfferCreatedEvent: %v", err)
        http.Error(w, "Failed to process the request", http.StatusInternalServerError)
        return
    }

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(event) // Return the event data as confirmation
}

// getOffers retrieves the list of offers for the authenticated user from the read model.
func (h *Handler) getOffers(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.QueryContext(r.Context(), `SELECT id, "userId", name, "originalUrl", status, "createdAt" FROM "Offer" WHERE "userId" = $1`, userID)
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
	json.NewEncoder(w).Encode(offers)
}
