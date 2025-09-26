package handlers

import (
    "context"
    "database/sql"
    "encoding/json"
    "log"
    "net/http"
    "time"

    "github.com/google/uuid"
    "github.com/xxrenzhe/autoads/pkg/errors"
    "github.com/xxrenzhe/autoads/pkg/middleware"
    "github.com/xxrenzhe/autoads/services/offer/internal/domain"
    "github.com/xxrenzhe/autoads/services/offer/internal/events"
    "strings"
    "syscall"
    "fmt"
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
    // Ensure read model has expected columns (preview safeguard)
    _, _ = db.Exec(`ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''`)
    return &Handler{DB: db, Publisher: publisher}
}

// RegisterRoutes registers the HTTP routes for the service.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
    mux.HandleFunc("/healthz", h.healthz)
    mux.HandleFunc("/health", h.healthz)
    mux.HandleFunc("/readyz", h.readyz)
    mux.Handle("/api/v1/offers", authMiddleware(http.HandlerFunc(h.offersHandler)))
    mux.Handle("/api/v1/offers/", authMiddleware(http.HandlerFunc(h.offerByIDHandler)))
    if v := getenv("DEBUG"); v == "1" {
        mux.Handle("/api/v1/debug/offers", authMiddleware(http.HandlerFunc(h.debugOffers)))
    }
}

// OffersHandler is an exported adapter that delegates to the internal offersHandler.
// It allows wiring via generated OpenAPI chi server.
func (h *Handler) OffersHandler(w http.ResponseWriter, r *http.Request) { h.offersHandler(w, r) }


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
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
	}
}

// offerByIDHandler returns a single offer by id for the current user
func (h *Handler) offerByIDHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    userID, ok := r.Context().Value(middleware.UserIDKey).(string)
    if !ok || userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil); return }
    // path: /api/v1/offers/{id}
    parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/offers/"), "/")
    if len(parts) == 0 || parts[0] == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id required", nil); return }
    id := parts[0]
    var o Offer
    var createdAt time.Time
    err := h.DB.QueryRowContext(r.Context(), `
        SELECT id, userid AS "userId", name, originalurl AS "originalUrl", status, created_at AS "createdAt"
        FROM "Offer" WHERE id=$1 AND userid=$2
    `, id, userID).Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &createdAt)
    if err != nil {
        if err == sql.ErrNoRows { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil); return }
        log.Printf("offerByID query error: %v", err)
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
        return
    }
    o.CreatedAt = createdAt
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(o)
}

// createOffer validates the request and publishes an OfferCreated event.
func (h *Handler) createOffer(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(string)
    if !ok || userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil); return }

    var req struct {
        Name        string `json:"name"`
        OriginalUrl string `json:"originalUrl"`
    }

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Invalid request body", nil); return }

	if req.Name == "" || req.OriginalUrl == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Name and OriginalUrl are required", nil); return }

    idem := strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))
    scope := "offer.create"
    if idem != "" {
        if existing, ok := h.lookupIdem(r.Context(), idem, userID, scope); ok {
            // attempt to fetch from read model; fallback to echo request body
            oc := domain.OfferCreatedEvent{OfferID: existing, UserID: userID, Name: req.Name, OriginalUrl: req.OriginalUrl, Status: "evaluating", CreatedAt: time.Now()}
            // read model may not yet exist; best-effort read
            var name, original, status string
            var createdAt time.Time
            err := h.DB.QueryRowContext(r.Context(), `SELECT name, originalurl, status, created_at FROM "Offer" WHERE id=$1 AND userid=$2`, existing, userID).Scan(&name, &original, &status, &createdAt)
            if err == nil {
                oc.Name = name; oc.OriginalUrl = original; if status != "" { oc.Status = status }; if !createdAt.IsZero() { oc.CreatedAt = createdAt }
            }
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusAccepted)
            _ = json.NewEncoder(w).Encode(oc)
            return
        }
    }

    event := domain.OfferCreatedEvent{
        OfferID:     uuid.New().String(),
        UserID:      userID,
        Name:        req.Name,
        OriginalUrl: req.OriginalUrl,
        Status:      "evaluating", // Default status for new offers
        CreatedAt:   time.Now(),
    }

	    if err := h.Publisher.Publish(r.Context(), event); err != nil { log.Printf("Error publishing OfferCreatedEvent: %v", err); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to process the request", nil); return }

    // persist idempotency mapping
    if idem != "" { _ = h.upsertIdem(r.Context(), idem, userID, scope, event.OfferID, 24*time.Hour) }
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusAccepted)
    json.NewEncoder(w).Encode(event) // Return the event data as confirmation
}

// getOffers retrieves the list of offers for the authenticated user from the read model.
func (h *Handler) getOffers(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil); return }

    rows, err := h.DB.QueryContext(r.Context(), `
        SELECT id, userid AS "userId", name, originalurl AS "originalUrl", status, created_at AS "createdAt"
        FROM "Offer" WHERE userid = $1
    `, userID)
	if err != nil { log.Printf("Error querying offers: %v", err); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil); return }
	defer rows.Close()

	var offers []Offer
	for rows.Next() {
		var o Offer
		if err := rows.Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.CreatedAt); err != nil { log.Printf("Error scanning offer row: %v", err); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil); return }
		offers = append(offers, o)
	}

	if err = rows.Err(); err != nil { log.Printf("Error iterating offer rows: %v", err); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil); return }

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(offers)
}

func (h *Handler) debugOffers(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(string)
    if !ok || userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    rows, err := h.DB.QueryContext(r.Context(), `
        SELECT id, userid AS "userId", name, originalurl AS "originalUrl", status, created_at AS "createdAt"
        FROM "Offer" WHERE userid = $1 ORDER BY created_at DESC LIMIT 5
    `, userID)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    var items []Offer
    for rows.Next() {
        var o Offer
        if err := rows.Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.CreatedAt); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "scan failed", map[string]string{"error": err.Error()}); return }
        items = append(items, o)
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(struct{ Items []Offer `json:"items"` }{Items: items})
}

func getenv(k string) string { v := ""; if vv, ok := syscall.Getenv(k); ok { v = vv }; if v == "" { v = strings.TrimSpace(strings.ToLower(strings.TrimSpace(v))) }; return v }

func (h *Handler) readyz(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
	defer cancel()
	if err := h.DB.PingContext(ctx); err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
}

// --- Idempotency helpers ---
func (h *Handler) lookupIdem(ctx context.Context, key, userID, scope string) (string, bool) {
    var id string
    err := h.DB.QueryRowContext(ctx, `SELECT target_id FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()`, key, userID, scope).Scan(&id)
    if err != nil { return "", false }
    return id, id != ""
}
func (h *Handler) upsertIdem(ctx context.Context, key, userID, scope, targetID string, ttl time.Duration) error {
    _, err := h.DB.ExecContext(ctx, `
        INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at)
        VALUES ($1,$2,$3,$4,NOW(), NOW()+$5::interval)
        ON CONFLICT (key) DO UPDATE SET user_id=EXCLUDED.user_id, scope=EXCLUDED.scope, target_id=EXCLUDED.target_id, expires_at=EXCLUDED.expires_at
    `, key, userID, scope, targetID, fmt.Sprintf("%d hours", int(ttl.Hours())))
    return err
}
