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
    "hash/fnv"
    "math"
    "io"
    "os"
    "net/url"
)

// Offer represents the read model for an offer.
type Offer struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Name        string    `json:"name"`
	OriginalUrl string    `json:"originalUrl"`
	Status      string    `json:"status"`
	SiterankScore *float64 `json:"siterankScore,omitempty"`
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
    _, _ = db.Exec(`ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS siterankScore DOUBLE PRECISION`)
    return &Handler{DB: db, Publisher: publisher}
}

// RegisterRoutes registers the HTTP routes for the service.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
    mux.HandleFunc("/healthz", h.healthz)
    mux.HandleFunc("/health", h.healthz)
    mux.HandleFunc("/readyz", h.readyz)
    mux.Handle("/api/v1/offers", authMiddleware(http.HandlerFunc(h.offersHandler)))
    mux.Handle("/api/v1/offers/", authMiddleware(http.HandlerFunc(h.offerTreeHandler)))
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
// offerTreeHandler handles /api/v1/offers/{id}[/(status)]
func (h *Handler) offerTreeHandler(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(string)
    if !ok || userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil); return }
    parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/offers/"), "/")
    if len(parts) == 0 || parts[0] == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id required", nil); return }
    id := parts[0]
    sub := ""
    if len(parts) >= 2 { sub = parts[1] }
    switch r.Method {
    case http.MethodGet:
        // GET /api/v1/offers/{id}
        if sub == "kpi" {
            h.getOfferKPI(w, r, id, userID); return
        }
        if sub != "" { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "not found", nil); return }
        var o Offer
        var createdAt time.Time
        err := h.DB.QueryRowContext(r.Context(), `
            SELECT id, userid AS "userId", name, originalurl AS "originalUrl", status, siterankScore, created_at AS "createdAt"
            FROM "Offer" WHERE id=$1 AND userid=$2
        `, id, userID).Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.SiterankScore, &createdAt)
        if err != nil {
            if err == sql.ErrNoRows { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil); return }
            log.Printf("offerByID query error: %v", err)
            errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
            return
        }
        o.CreatedAt = createdAt
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(o)
        return
    case http.MethodPut:
        // PUT /api/v1/offers/{id}/status
        if sub != "status" { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported subresource", nil); return }
        var current string
        if err := h.DB.QueryRowContext(r.Context(), `SELECT status FROM "Offer" WHERE id=$1 AND userid=$2`, id, userID).Scan(&current); err != nil {
            if err == sql.ErrNoRows { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil); return }
            errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", nil); return
        }
        var body struct{ Status string `json:"status"` }
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
        newStatus := strings.ToLower(strings.TrimSpace(body.Status))
        if newStatus == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "status required", nil); return }
        allowed := map[string]bool{"opportunity":true, "evaluating":true, "simulating":true, "scaling":true, "declining":true, "archived":true, "optimizing":true}
        if !allowed[newStatus] { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "unsupported status", map[string]string{"status": newStatus}); return }
        // ensure history table
        _, _ = h.DB.ExecContext(r.Context(), `CREATE TABLE IF NOT EXISTS "OfferStatusHistory"(
            id BIGSERIAL PRIMARY KEY,
            offer_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            from_status TEXT NOT NULL,
            to_status TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`)
        // update
        tx, err := h.DB.BeginTx(r.Context(), &sql.TxOptions{})
        if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "begin tx failed", nil); return }
        defer tx.Rollback()
        if _, err := tx.ExecContext(r.Context(), `UPDATE "Offer" SET status=$1 WHERE id=$2 AND userid=$3`, newStatus, id, userID); err != nil {
            errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update failed", map[string]string{"error": err.Error()}); return
        }
        _, _ = tx.ExecContext(r.Context(), `INSERT INTO "OfferStatusHistory"(offer_id,user_id,from_status,to_status) VALUES ($1,$2,$3,$4)`, id, userID, current, newStatus)
        if err := tx.Commit(); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "commit failed", map[string]string{"error": err.Error()}); return }
        _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "offerId": id, "from": current, "to": newStatus})
        return
    default:
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return
    }
}

// getOfferKPI returns stubbed 7-day KPI for an offer (dev/preview) with deterministic values.
// GET /api/v1/offers/{id}/kpi
func (h *Handler) getOfferKPI(w http.ResponseWriter, r *http.Request, id, userID string) {
    // Verify ownership quick
    var one int
    if err := h.DB.QueryRowContext(r.Context(), `SELECT 1 FROM "Offer" WHERE id=$1 AND userid=$2`, id, userID).Scan(&one); err != nil {
        if err == sql.ErrNoRows { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil); return }
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", nil); return
    }
    // Try Adscenter diagnose metrics (stub/live) for base values
    type dm struct{ Impressions int64 `json:"impressions"`; CTR float64 `json:"ctr"`; QS int `json:"qualityScore"`; DailyBudget float64 `json:"dailyBudget"`; BudgetPacing float64 `json:"budgetPacing"` }
    var base *dm
    if baseURL := strings.TrimRight(os.Getenv("ADSCENTER_URL"), "/"); baseURL != "" {
        ctx, cancel := context.WithTimeout(r.Context(), 1500*time.Millisecond)
        defer cancel()
        req, _ := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/v1/adscenter/diagnose/metrics?accountId="+url.QueryEscape(userID), nil)
        req.Header.Set("Accept", "application/json"); req.Header.Set("X-User-Id", userID)
        if resp, err := http.DefaultClient.Do(req); err == nil && resp != nil {
            b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20)); _ = resp.Body.Close()
            if resp.StatusCode >= 200 && resp.StatusCode < 300 {
                var tmp dm; if json.Unmarshal(b, &tmp) == nil { base = &tmp }
            }
        }
    }
    // Deterministic pseudo metrics by offer id (fallback or augment trend)
    hsh := fnv.New32a(); _, _ = hsh.Write([]byte(id)); seed := int64(hsh.Sum32())
    // helper to derive numbers
    f := func(mod, base int64) int64 { v := (seed%mod + base); if v < 0 { v = -v }; return v }
    // last 7 days arrays
    days := 7
    type point struct{ Date string `json:"date"`; Impressions int64 `json:"impressions"`; Clicks int64 `json:"clicks"`; Spend float64 `json:"spend"`; Revenue float64 `json:"revenue"` }
    pts := make([]point, 0, days)
    var sumImp, sumClk int64
    var sumSpend, sumRev float64
    now := time.Now().UTC()
    for i := days - 1; i >= 0; i-- {
        d := now.AddDate(0, 0, -i)
        var imp int64
        var clk int64
        var spend float64
        var rev float64
        if base != nil {
            // Use base impressions and ctr with small oscillation
            bimp := base.Impressions
            if bimp <= 0 { bimp = f(500, 200) }
            imp = bimp + int64(i*10) - int64((seed%7))
            if imp < 10 { imp = 10 }
            ctr := base.CTR; if ctr <= 0 { ctr = 1.0 }
            clk = int64(float64(imp) * (ctr / 100.0))
            if clk < 1 { clk = 1 }
            if base.DailyBudget > 0 {
                spend = base.DailyBudget * (0.8 + float64((seed%20))/100.0)
            } else {
                spend = float64(imp) * (0.01 + float64((seed%3))/100.0)
            }
            // revenue scale by QS and pacing
            q := base.QS; if q <= 0 { q = 6 }
            scale := 0.6 + float64(q)/10.0 + base.BudgetPacing/2.0
            if scale < 0.5 { scale = 0.5 }
            if scale > 2.0 { scale = 2.0 }
            rev = spend * scale
        } else {
            imp = f(500, 200) + int64(i*10)
            clk = imp * (2 + int64(seed%5)) / 100 // 2-6% CTR
            spend = float64(imp) * (0.01 + float64((seed%3))/100.0)
            rev = spend * (0.8 + float64((seed%60))/100.0) // 0.8x-1.39x
        }
        sumImp += imp; sumClk += clk; sumSpend += spend; sumRev += rev
        pts = append(pts, point{Date: d.Format("2006-01-02"), Impressions: imp, Clicks: clk, Spend: round2(spend), Revenue: round2(rev)})
    }
    rosc := 0.0
    if sumSpend > 0 { rosc = sumRev / sumSpend }
    out := map[string]any{
        "summary": map[string]any{
            "impressions": sumImp,
            "clicks": sumClk,
            "spend": round2(sumSpend),
            "revenue": round2(sumRev),
            "rosc": round2(rosc),
        },
        "days": pts,
        "updatedAt": time.Now().UTC().Format(time.RFC3339),
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(out)
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }

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
        SELECT id, userid AS "userId", name, originalurl AS "originalUrl", status, siterankScore, created_at AS "createdAt"
        FROM "Offer" WHERE userid = $1
    `, userID)
	if err != nil { log.Printf("Error querying offers: %v", err); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil); return }
	defer rows.Close()

	var offers []Offer
	for rows.Next() {
		var o Offer
        if err := rows.Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.SiterankScore, &o.CreatedAt); err != nil { log.Printf("Error scanning offer row: %v", err); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil); return }
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
        SELECT id, userid AS "userId", name, originalurl AS "originalUrl", status, siterankScore, created_at AS "createdAt"
        FROM "Offer" WHERE userid = $1 ORDER BY created_at DESC LIMIT 5
    `, userID)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    var items []Offer
    for rows.Next() {
        var o Offer
        if err := rows.Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.SiterankScore, &o.CreatedAt); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "scan failed", map[string]string{"error": err.Error()}); return }
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
