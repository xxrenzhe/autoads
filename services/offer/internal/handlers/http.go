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
    estore "github.com/xxrenzhe/autoads/pkg/eventstore"
    "strings"
    "syscall"
    "fmt"
    "hash/fnv"
    "math"
    "io"
    "os"
    "net/url"
    "strconv"
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
    // Internal maintenance endpoint (secured via X-Service-Token), not wrapped with user auth
    mux.Handle("/api/v1/offers/internal/kpi/aggregate-daily", http.HandlerFunc(h.aggregateDailyInternal))
    mux.Handle("/api/v1/offers/internal/kpi/deadletters", http.HandlerFunc(h.listKpiDLQInternal))
    mux.Handle("/api/v1/offers/internal/kpi/retry", http.HandlerFunc(h.retryKpiDLQInternal))
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
    // Support both "/api/v1/offers/..." and "/offers/..." paths (depending on router mount)
    path := r.URL.Path
    if i := strings.Index(path, "/offers/"); i >= 0 {
        path = path[i+len("/offers/"):]
    } else {
        path = strings.TrimPrefix(path, "/api/v1/offers/")
    }
    parts := strings.Split(path, "/")
    if len(parts) == 0 || parts[0] == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id required", nil); return }
    id := parts[0]
    sub := ""
    if len(parts) >= 2 { sub = parts[1] }
    switch r.Method {
    case http.MethodGet:
        // GET /api/v1/offers/{id}
        if sub == "kpi" {
            // GET /api/v1/offers/{id}/kpi
            h.getOfferKPI(w, r, id, userID); return
        }
        if sub == "accounts" {
            // GET /api/v1/offers/{id}/accounts
            rows, err := h.DB.QueryContext(r.Context(), `SELECT account_id FROM "OfferAccountMap" WHERE offer_id=$1 AND user_id=$2 ORDER BY account_id`, id, userID)
            if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
            defer rows.Close()
            type item struct{ AccountId string `json:"accountId"` }
            var items []item
            for rows.Next() { var a string; if err := rows.Scan(&a); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "scan failed", nil); return }; items = append(items, item{AccountId: a}) }
            if err := rows.Err(); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "rows failed", nil); return }
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(struct{ Items []item `json:"items"` }{Items: items})
            return
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
        if sub == "status" {
            // PUT /api/v1/offers/{id}/status
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
            if _, err := tx.ExecContext(r.Context(), `UPDATE "Offer" SET status=$1, updated_at=NOW() WHERE id=$2 AND userid=$3`, newStatus, id, userID); err != nil {
                errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update failed", map[string]string{"error": err.Error()}); return
            }
            _, _ = tx.ExecContext(r.Context(), `INSERT INTO "OfferStatusHistory"(offer_id,user_id,from_status,to_status) VALUES ($1,$2,$3,$4)`, id, userID, current, newStatus)
            if err := tx.Commit(); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "commit failed", map[string]string{"error": err.Error()}); return }
            _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "offerId": id, "from": current, "to": newStatus})
            return
        }
        if sub == "" {
            // PUT /api/v1/offers/{id}
            var body struct{ Name *string `json:"name"`; OriginalUrl *string `json:"originalUrl"` }
            if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
            if body.Name == nil && body.OriginalUrl == nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "no fields to update", nil); return }
            // Build dynamic update
            set := make([]string, 0, 3)
            args := make([]any, 0, 4)
            if body.Name != nil { set = append(set, "name=$1"); args = append(args, strings.TrimSpace(*body.Name)) }
            if body.OriginalUrl != nil {
                // very basic sanity
                v := strings.TrimSpace(*body.OriginalUrl)
                if v == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "originalUrl cannot be empty", nil); return }
                args = append(args, v)
                if len(set) == 0 { set = append(set, "originalurl=$1") } else { set = append(set, fmt.Sprintf("originalurl=$%d", len(args))) }
            }
            // ensure updated_at update and id/user filters
            // adjust param indexes
            // Rebuild query with correct placeholders
            // Simpler: rebuild sequentially
            set = []string{}
            args = []any{}
            idx := 1
            if body.Name != nil { set = append(set, fmt.Sprintf("name=$%d", idx)); args = append(args, strings.TrimSpace(*body.Name)); idx++ }
            if body.OriginalUrl != nil { set = append(set, fmt.Sprintf("originalurl=$%d", idx)); args = append(args, strings.TrimSpace(*body.OriginalUrl)); idx++ }
            // append id,user
            args = append(args, id, userID)
            q := fmt.Sprintf(`UPDATE "Offer" SET %s, updated_at=NOW() WHERE id=$%d AND userid=$%d`, strings.Join(set, ", "), idx, idx+1)
            res, err := h.DB.ExecContext(r.Context(), q, args...)
            if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update failed", map[string]string{"error": err.Error()}); return }
            n, _ := res.RowsAffected()
            if n == 0 { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil); return }
            // return updated
            var o Offer
            var createdAt time.Time
            err = h.DB.QueryRowContext(r.Context(), `
                SELECT id, userid AS "userId", name, originalurl AS "originalUrl", status, siterankScore, created_at AS "createdAt"
                FROM "Offer" WHERE id=$1 AND userid=$2
            `, id, userID).Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.SiterankScore, &createdAt)
            if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "reload failed", map[string]string{"error": err.Error()}); return }
            o.CreatedAt = createdAt
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(o)
            return
        }
        errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported subresource", nil); return
    case http.MethodPost:
        // POST /api/v1/offers/{id}/kpi/aggregate
        if sub == "kpi" {
            // check third segment
            // Reparse parts to be safe
            path2 := r.URL.Path
            if i := strings.Index(path2, "/offers/"); i >= 0 {
                path2 = path2[i+len("/offers/"):]
            } else {
                path2 = strings.TrimPrefix(path2, "/api/v1/offers/")
            }
            parts2 := strings.Split(path2, "/")
            if len(parts2) >= 3 && parts2[2] == "aggregate" {
                h.aggregateOfferKPI(w, r, id, userID); return
            }
        }
        if sub == "accounts" {
            // POST /api/v1/offers/{id}/accounts { accountId }
            var body struct{ AccountId string `json:"accountId"` }
            if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
            acct := strings.TrimSpace(body.AccountId)
            if acct == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "accountId required", nil); return }
            // basic sanity: digits only (Google Ads CID without dashes), but keep generic
            if _, err := h.DB.ExecContext(r.Context(), `
                INSERT INTO "OfferAccountMap"(user_id, offer_id, account_id, linked_at) VALUES ($1,$2,$3,NOW())
                ON CONFLICT (offer_id, account_id) DO UPDATE SET user_id=EXCLUDED.user_id, linked_at=GREATEST("OfferAccountMap".linked_at, EXCLUDED.linked_at)
            `, userID, id, acct); err != nil {
                errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "insert failed", map[string]string{"error": err.Error()}); return
            }
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "offerId": id, "accountId": acct})
            return
        }
        errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported subresource", nil); return
    default:
        if r.Method == http.MethodDelete && sub == "" {
            // DELETE /api/v1/offers/{id}
            res, err := h.DB.ExecContext(r.Context(), `DELETE FROM "Offer" WHERE id=$1 AND userid=$2`, id, userID)
            if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "delete failed", map[string]string{"error": err.Error()}); return }
            if n, _ := res.RowsAffected(); n == 0 { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil); return }
            w.WriteHeader(http.StatusNoContent)
            return
        }
        if r.Method == http.MethodDelete && sub == "accounts" {
            // DELETE /api/v1/offers/{id}/accounts/{accountId}
            if len(parts) < 3 { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "accountId required", nil); return }
            acct := strings.TrimSpace(parts[2])
            if acct == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "accountId required", nil); return }
            res, err := h.DB.ExecContext(r.Context(), `DELETE FROM "OfferAccountMap" WHERE offer_id=$1 AND user_id=$2 AND account_id=$3`, id, userID, acct)
            if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "delete failed", map[string]string{"error": err.Error()}); return }
            if n, _ := res.RowsAffected(); n == 0 { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "mapping not found", nil); return }
            w.WriteHeader(http.StatusNoContent)
            return
        }
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
    // Try real KPI from read model first (OfferDailyKPI)
    type point struct{ Date string `json:"date"`; Impressions int64 `json:"impressions"`; Clicks int64 `json:"clicks"`; Spend float64 `json:"spend"`; Revenue float64 `json:"revenue"` }
    realPts := make([]point, 0, 7)
    var sumImpReal, sumClkReal int64
    var sumSpendReal, sumRevReal float64
    rows, err := h.DB.QueryContext(r.Context(), `
        SELECT date, impressions, clicks, spend, revenue
        FROM "OfferDailyKPI"
        WHERE offer_id=$1 AND user_id=$2 AND date >= (CURRENT_DATE - INTERVAL '6 days')
        ORDER BY date ASC
    `, id, userID)
    if err == nil {
        defer rows.Close()
        for rows.Next() {
            var d time.Time
            var imp, clk int64
            var spend, rev float64
            if err := rows.Scan(&d, &imp, &clk, &spend, &rev); err != nil { break }
            sumImpReal += imp
            sumClkReal += clk
            sumSpendReal += spend
            sumRevReal += rev
            realPts = append(realPts, point{Date: d.Format("2006-01-02"), Impressions: imp, Clicks: clk, Spend: round2(spend), Revenue: round2(rev)})
        }
        if err := rows.Err(); err == nil && len(realPts) > 0 {
            rosc := 0.0
            if sumSpendReal > 0 { rosc = sumRevReal / sumSpendReal }
            out := map[string]any{
                "summary": map[string]any{
                    "impressions": sumImpReal,
                    "clicks": sumClkReal,
                    "spend": round2(sumSpendReal),
                    "revenue": round2(sumRevReal),
                    "rosc": round2(rosc),
                },
                "days": realPts,
                "updatedAt": time.Now().UTC().Format(time.RFC3339),
                "source": "real",
            }
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(out)
            return
        }
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
        "source": "synthetic",
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(out)
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }

func (h *Handler) ensureKpiDLQDDL(ctx context.Context) {
    _, _ = h.DB.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS "OfferKpiDeadLetter" (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL,
  offer_id     TEXT NOT NULL,
  date         DATE NOT NULL,
  reason       TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count  INT  NOT NULL DEFAULT 0,
  last_error   TEXT,
  status       TEXT NOT NULL DEFAULT 'queued',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)`)
}
func (h *Handler) writeKpiDLQ(ctx context.Context, userID, offerID string, day time.Time, reason string, payload map[string]any, lastErr string) {
    if h.DB == nil { return }
    h.ensureKpiDLQDDL(ctx)
    _, _ = h.DB.ExecContext(ctx, `
        INSERT INTO "OfferKpiDeadLetter"(user_id, offer_id, date, reason, payload, retry_count, last_error, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,0,$6,'queued',NOW(),NOW())
    `, userID, offerID, day.Format("2006-01-02"), reason, toJSON(payload), lastErr)
}
func toJSON(m map[string]any) string { b, _ := json.Marshal(m); return string(b) }

// aggregateOfferKPIExec performs aggregation and upserts a daily KPI row.
func (h *Handler) aggregateOfferKPIExec(ctx context.Context, offerID, userID string, day time.Time) (source string, totalImp, totalClk int64, totalSpend, totalRev float64, err error) {
    // Load mapped accounts
    acctRows, qerr := h.DB.QueryContext(ctx, `SELECT account_id FROM "OfferAccountMap" WHERE offer_id=$1 AND user_id=$2`, offerID, userID)
    var accountIDs []string
    if qerr == nil {
        defer acctRows.Close()
        for acctRows.Next() {
            var a string
            if err := acctRows.Scan(&a); err == nil && strings.TrimSpace(a) != "" { accountIDs = append(accountIDs, strings.TrimSpace(a)) }
        }
        _ = acctRows.Err()
    }
    type dm struct{ Impressions int64 `json:"impressions"`; CTR float64 `json:"ctr"`; QS int `json:"qualityScore"`; DailyBudget float64 `json:"dailyBudget"`; BudgetPacing float64 `json:"budgetPacing"` }
    baseURL := strings.TrimRight(os.Getenv("ADSCENTER_URL"), "/")
    fetchOne := func(ctx context.Context, accountID string) *dm {
        if baseURL == "" { return nil }
        ctx2, cancel := context.WithTimeout(ctx, 2*time.Second)
        defer cancel()
        req, _ := http.NewRequestWithContext(ctx2, http.MethodGet, baseURL+"/api/v1/adscenter/diagnose/metrics?accountId="+url.QueryEscape(accountID), nil)
        req.Header.Set("Accept", "application/json")
        req.Header.Set("X-User-Id", userID)
        if resp, err := http.DefaultClient.Do(req); err == nil && resp != nil {
            b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20)); _ = resp.Body.Close()
            if resp.StatusCode >= 200 && resp.StatusCode < 300 {
                var out dm
                if json.Unmarshal(b, &out) == nil { return &out }
            }
        }
        return nil
    }
    source = "synthetic"
    if len(accountIDs) > 0 {
        for _, acct := range accountIDs {
            if m := fetchOne(ctx, acct); m != nil {
                imp := m.Impressions
                if imp <= 0 { imp = 200 }
                ctr := m.CTR; if ctr <= 0 { ctr = 1.0 }
                clk := int64(float64(imp) * (ctr / 100.0))
                if clk < 1 { clk = 1 }
                spend := m.DailyBudget
                if spend <= 0 { spend = float64(imp) * 0.02 }
                q := m.QS; if q <= 0 { q = 6 }
                scale := 0.6 + float64(q)/10.0 + m.BudgetPacing/2.0
                if scale < 0.5 { scale = 0.5 }
                if scale > 2.0 { scale = 2.0 }
                rev := spend * scale
                totalImp += imp; totalClk += clk; totalSpend += spend; totalRev += rev
                source = "adscenter"
            }
        }
    }
    if totalImp == 0 && totalSpend == 0 && totalRev == 0 {
        // Fallback synthetic based on offerID seed
        hsh := fnv.New32a(); _, _ = hsh.Write([]byte(offerID)); seed := int64(hsh.Sum32())
        imp := (seed%500 + 200)
        clk := imp * (2 + int64(seed%5)) / 100
        spend := float64(imp) * 0.02
        rev := spend * (0.9 + float64((seed%40))/100.0)
        totalImp = imp; totalClk = clk; totalSpend = spend; totalRev = rev
        if source == "synthetic" { source = "synthetic" }
    }
    // Upsert
    _, err = h.DB.ExecContext(ctx, `
        INSERT INTO "OfferDailyKPI"(user_id, offer_id, date, impressions, clicks, spend, revenue, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        ON CONFLICT (user_id, offer_id, date)
        DO UPDATE SET impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, spend=EXCLUDED.spend, revenue=EXCLUDED.revenue
    `, userID, offerID, day.Format("2006-01-02"), totalImp, totalClk, round2(totalSpend), round2(totalRev))
    return
}

// aggregateOfferKPI computes today's KPI for an offer and upserts into OfferDailyKPI.
// POST /api/v1/offers/{id}/kpi/aggregate?date=YYYY-MM-DD
func (h *Handler) aggregateOfferKPI(w http.ResponseWriter, r *http.Request, offerID, userID string) {
    // Parse date (UTC) or default today
    qdate := strings.TrimSpace(r.URL.Query().Get("date"))
    var day time.Time
    var err error
    if qdate != "" {
        if day, err = time.Parse("2006-01-02", qdate); err != nil {
            errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid date format, expect YYYY-MM-DD", nil); return
        }
    } else {
        now := time.Now().UTC()
        day = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
    }
    source, totalImp, totalClk, totalSpend, totalRev, err := h.aggregateOfferKPIExec(r.Context(), offerID, userID, day)
    if err != nil { h.writeKpiDLQ(r.Context(), userID, offerID, day, "upsert_failed", map[string]any{"source": source}, err.Error()); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "upsert kpi failed", map[string]string{"error": err.Error()}); return }
    rosc := 0.0; if totalSpend > 0 { rosc = totalRev / totalSpend }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{
        "status": "ok",
        "date": day.Format("2006-01-02"),
        "source": source,
        "summary": map[string]any{
            "impressions": totalImp,
            "clicks": totalClk,
            "spend": round2(totalSpend),
            "revenue": round2(totalRev),
            "rosc": round2(rosc),
        },
    })
}

// aggregateDailyInternal aggregates KPI for many offers by shard.
// Secured via X-Service-Token header == INTERNAL_SERVICE_TOKEN env.
// POST /api/v1/offers/internal/kpi/aggregate-daily?date=YYYY-MM-DD&shard=0&totalShards=1&limit=200
func (h *Handler) aggregateDailyInternal(w http.ResponseWriter, r *http.Request) {
    token := strings.TrimSpace(r.Header.Get("X-Service-Token"))
    if token == "" { token = strings.TrimSpace(r.URL.Query().Get("key")) }
    if token == "" || token != strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_TOKEN")) {
        errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "invalid service token", nil); return
    }
    // Parse date (UTC)
    qdate := strings.TrimSpace(r.URL.Query().Get("date"))
    var day time.Time
    var err error
    if qdate != "" {
        if day, err = time.Parse("2006-01-02", qdate); err != nil {
            errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid date format", nil); return
        }
    } else {
        now := time.Now().UTC(); day = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
    }
    shard := 0; total := 1; limit := 500
    if v := strings.TrimSpace(r.URL.Query().Get("shard")); v != "" { if n, e := strconv.Atoi(v); e == nil { shard = n } }
    if v := strings.TrimSpace(r.URL.Query().Get("totalShards")); v != "" { if n, e := strconv.Atoi(v); e == nil && n > 0 { total = n } }
    if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" { if n, e := strconv.Atoi(v); e == nil && n > 0 { limit = n } }
    // Fetch offers in batches; simple iteration with hash-based shard filtering in Go
    type row struct{ id, uid string }
    processed, updated, failed := 0, 0, 0
    lastID := ""
    for {
        // keyset by created_at + id would be better; for simplicity, page by id lexical
        var rows *sql.Rows
        if lastID == "" {
            rows, err = h.DB.QueryContext(r.Context(), `SELECT id, userid FROM "Offer" ORDER BY id ASC LIMIT $1`, limit)
        } else {
            rows, err = h.DB.QueryContext(r.Context(), `SELECT id, userid FROM "Offer" WHERE id > $1 ORDER BY id ASC LIMIT $2`, lastID, limit)
        }
        if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query offers failed", map[string]string{"error": err.Error()}); return }
        batch := []row{}
        for rows.Next() {
            var id, uid string
            if err := rows.Scan(&id, &uid); err != nil { _ = rows.Close(); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "scan failed", nil); return }
            batch = append(batch, row{id: id, uid: uid})
        }
        _ = rows.Close()
        if len(batch) == 0 { break }
        // process
        for _, it := range batch {
            processed++
            // hash by id for sharding
            hsh := fnv.New32a(); _, _ = hsh.Write([]byte(it.id)); mod := int(hsh.Sum32() % uint32(total))
            if mod != shard { continue }
            if src, imp, clk, spend, rev, err := h.aggregateOfferKPIExec(r.Context(), it.id, it.uid, day); err != nil { failed++; h.writeKpiDLQ(r.Context(), it.uid, it.id, day, "upsert_failed", map[string]any{"source": src, "impressions": imp, "clicks": clk, "spend": spend, "revenue": rev}, err.Error()) } else { updated++ }
            lastID = it.id
        }
        if len(batch) < limit { break }
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "date": day.Format("2006-01-02"), "processed": processed, "updated": updated, "failed": failed, "shard": shard, "totalShards": total})
}

// list DLQ items (internal)
// GET /api/v1/offers/internal/kpi/deadletters?limit=50
func (h *Handler) listKpiDLQInternal(w http.ResponseWriter, r *http.Request) {
    token := strings.TrimSpace(r.Header.Get("X-Service-Token"))
    if token == "" { token = strings.TrimSpace(r.URL.Query().Get("key")) }
    if token == "" || token != strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_TOKEN")) { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "invalid service token", nil); return }
    lim := 50
    if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" { if n, e := strconv.Atoi(v); e == nil && n > 0 && n <= 500 { lim = n } }
    rows, err := h.DB.QueryContext(r.Context(), `SELECT id,user_id,offer_id,date,reason,payload::text,retry_count,last_error,status,created_at,updated_at FROM "OfferKpiDeadLetter" WHERE status<>'resolved' ORDER BY created_at DESC LIMIT $1`, lim)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct{ ID int64 `json:"id"`; UserID string `json:"userId"`; OfferID string `json:"offerId"`; Date string `json:"date"`; Reason string `json:"reason"`; Payload string `json:"payload"`; RetryCount int `json:"retryCount"`; LastError string `json:"lastError"`; Status string `json:"status"`; CreatedAt string `json:"createdAt"`; UpdatedAt string `json:"updatedAt"` }
    var items []item
    for rows.Next() {
        var it item; var d time.Time; var ca, ua time.Time
        if err := rows.Scan(&it.ID, &it.UserID, &it.OfferID, &d, &it.Reason, &it.Payload, &it.RetryCount, &it.LastError, &it.Status, &ca, &ua); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "scan failed", nil); return }
        it.Date = d.Format("2006-01-02"); it.CreatedAt = ca.Format(time.RFC3339); it.UpdatedAt = ua.Format(time.RFC3339)
        items = append(items, it)
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"items": items})
}

// retry DLQ (internal)
// POST /api/v1/offers/internal/kpi/retry?id=123 or ?max=10
func (h *Handler) retryKpiDLQInternal(w http.ResponseWriter, r *http.Request) {
    token := strings.TrimSpace(r.Header.Get("X-Service-Token"))
    if token == "" { token = strings.TrimSpace(r.URL.Query().Get("key")) }
    if token == "" || token != strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_TOKEN")) { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "invalid service token", nil); return }
    idStr := strings.TrimSpace(r.URL.Query().Get("id"))
    max := 0
    if idStr == "" {
        if v := strings.TrimSpace(r.URL.Query().Get("max")); v != "" { if n, e := strconv.Atoi(v); e == nil && n > 0 { max = n } }
    }
    retried, resolved, errs := 0, 0, 0
    if idStr != "" {
        // retry single
        var uid, oid string; var d time.Time
        err := h.DB.QueryRowContext(r.Context(), `SELECT user_id, offer_id, date FROM "OfferKpiDeadLetter" WHERE id=$1`, idStr).Scan(&uid, &oid, &d)
        if err != nil { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "dlq item not found", nil); return }
        retried++
        if _, _, _, _, _, err := h.aggregateOfferKPIExec(r.Context(), oid, uid, d); err != nil {
            _, _ = h.DB.ExecContext(r.Context(), `UPDATE "OfferKpiDeadLetter" SET retry_count=retry_count+1, last_error=$1, updated_at=NOW() WHERE id=$2`, err.Error(), idStr)
            errs++
        } else {
            _, _ = h.DB.ExecContext(r.Context(), `UPDATE "OfferKpiDeadLetter" SET status='resolved', updated_at=NOW() WHERE id=$1`, idStr)
            resolved++
        }
    } else if max > 0 {
        rows, err := h.DB.QueryContext(r.Context(), `SELECT id,user_id,offer_id,date FROM "OfferKpiDeadLetter" WHERE status='queued' ORDER BY created_at ASC LIMIT $1`, max)
        if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query dlq failed", map[string]string{"error": err.Error()}); return }
        type rec struct{ id int64; uid, oid string; d time.Time }
        var recs []rec
        for rows.Next() { var rrec rec; if err := rows.Scan(&rrec.id, &rrec.uid, &rrec.oid, &rrec.d); err != nil { _ = rows.Close(); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "scan failed", nil); return }; recs = append(recs, rrec) }
        _ = rows.Close()
        for _, rrec := range recs {
            retried++
            if _, _, _, _, _, err := h.aggregateOfferKPIExec(r.Context(), rrec.oid, rrec.uid, rrec.d); err != nil {
                _, _ = h.DB.ExecContext(r.Context(), `UPDATE "OfferKpiDeadLetter" SET retry_count=retry_count+1, last_error=$1, updated_at=NOW() WHERE id=$2`, err.Error(), rrec.id)
                errs++
            } else {
                _, _ = h.DB.ExecContext(r.Context(), `UPDATE "OfferKpiDeadLetter" SET status='resolved', updated_at=NOW() WHERE id=$1`, rrec.id)
                resolved++
            }
        }
    } else {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id or max required", nil); return
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "retried": retried, "resolved": resolved, "errors": errs})
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
    // best-effort event_store write (idempotent by offerId)
    _ = estore.EnsureDDL(h.DB)
    _ = estore.WriteWithDB(r.Context(), h.DB, event.OfferID, "OfferCreated", "offer", event.OfferID, 1, event, map[string]any{"userId": userID})

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

// --- Auto status update (internal) ---
// POST /api/v1/offers/internal/auto-status
// Protected by X-Service-Token matching SERVICE_INTERNAL_TOKEN (if set)
func (h *Handler) AutoStatusHandler(w http.ResponseWriter, r *http.Request) {
    tok := strings.TrimSpace(r.Header.Get("X-Service-Token"))
    if want := strings.TrimSpace(os.Getenv("SERVICE_INTERNAL_TOKEN")); want != "" && tok != want {
        errors.Write(w, r, http.StatusForbidden, "FORBIDDEN", "invalid service token", nil); return
    }
    rows, err := h.DB.QueryContext(r.Context(), `SELECT id, userid, status FROM "Offer" ORDER BY updated_at DESC LIMIT 500`)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type upd struct{ ID, UserID, From, To string }
    changed := make([]upd, 0, 64)
    for rows.Next() {
        var id, uid, cur string
        if err := rows.Scan(&id, &uid, &cur); err != nil { continue }
        k := computeDeterministicKPI(id)
        // rule: 5 天零曝光零点击 -> declining
        zero5 := true
        for i := 0; i < 5 && i < len(k); i++ { if k[i].Impressions > 0 || k[i].Clicks > 0 { zero5 = false; break } }
        newStatus := cur
        if zero5 {
            newStatus = "declining"
        } else {
            // rosc 连续下降 5 天 -> declining
            dec := true
            for i := 1; i < len(k) && i < 5; i++ { if k[i].ROSC >= k[i-1].ROSC { dec = false; break } }
            if dec { newStatus = "declining" }
            // 平均 rosc > 1.2 且曝光总量大 -> optimizing
            var sumSpend, sumRev float64; var sumImp int64
            for _, d := range k { sumSpend += d.Spend; sumRev += d.Revenue; sumImp += d.Impressions }
            rosc := 0.0; if sumSpend > 0 { rosc = sumRev / sumSpend }
            if rosc > 1.2 && sumImp > 500 { newStatus = "optimizing" }
        }
        if newStatus != cur {
            tx, _ := h.DB.BeginTx(r.Context(), &sql.TxOptions{})
            if _, err := tx.ExecContext(r.Context(), `UPDATE "Offer" SET status=$1, updated_at=NOW() WHERE id=$2`, newStatus, id); err == nil {
                _, _ = tx.ExecContext(r.Context(), `CREATE TABLE IF NOT EXISTS "OfferStatusHistory"(
                    id BIGSERIAL PRIMARY KEY,
                    offer_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    from_status TEXT NOT NULL,
                    to_status TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )`)
                _, _ = tx.ExecContext(r.Context(), `INSERT INTO "OfferStatusHistory"(offer_id,user_id,from_status,to_status) VALUES ($1,$2,$3,$4)`, id, uid, cur, newStatus)
                _ = tx.Commit()
                changed = append(changed, upd{ID: id, UserID: uid, From: cur, To: newStatus})
            } else if tx != nil { _ = tx.Rollback() }
        }
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"updated": len(changed), "items": changed})
}

type kpiPoint2 struct{ Impressions int64; Clicks int64; Spend float64; Revenue float64; ROSC float64 }
func computeDeterministicKPI(offerID string) []kpiPoint2 {
    h := fnv.New32a(); _, _ = h.Write([]byte(offerID)); seed := int64(h.Sum32())
    out := make([]kpiPoint2, 0, 7)
    for i := 6; i >= 0; i-- {
        imp := (seed%500 + 200) + int64(i*10); if imp < 0 { imp = -imp }
        clk := imp * (2 + int64(seed%5)) / 100
        spend := float64(imp) * (0.01 + float64((seed%3))/100.0)
        rev := spend * (0.8 + float64((seed%60))/100.0)
        rosc := 0.0; if spend > 0 { rosc = rev / spend }
        out = append(out, kpiPoint2{Impressions: imp, Clicks: clk, Spend: spend, Revenue: rev, ROSC: rosc})
    }
    return out
}
