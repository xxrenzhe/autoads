package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

    "github.com/xxrenzhe/autoads/pkg/middleware"
	"github.com/xxrenzhe/autoads/services/billing/internal/config"


    "github.com/jackc/pgx/v5"
    "github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/lib/pq"
    "cloud.google.com/go/firestore"
    ev "github.com/xxrenzhe/autoads/pkg/events"
    "github.com/go-chi/chi/v5"
    api "github.com/xxrenzhe/autoads/services/billing/internal/oapi"
    "github.com/xxrenzhe/autoads/pkg/telemetry"
    "github.com/xxrenzhe/autoads/pkg/errors"
    "fmt"
)

func main() {
	ctx := context.Background()
	cfg, err := config.Load(ctx)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	log.Println("Running database migrations...")
	if err := runMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to run database migrations: %v", err)
	}

	dbpool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to create connection pool: %v", err)
	}
	defer dbpool.Close()

    // Omit Pub/Sub subscriber in minimal deployment; projections run via CFs in prod.
    log.Println("Billing: skipping in-process Pub/Sub subscriber (use CFs in prod)")

    // unified auth via pkg/middleware.AuthMiddleware
    apiHandler := NewHandler(dbpool)
    r := chi.NewRouter()
    telemetry.RegisterDefaultMetrics("billing")
    r.Use(telemetry.ChiMiddleware("billing"))
    r.Handle("/metrics", telemetry.MetricsHandler())
    // JSON request logging
    r.Use(middleware.LoggingMiddleware("billing"))
    r.Get("/health", apiHandler.healthz)
    r.Get("/healthz", apiHandler.healthz)
    // Atomic billing endpoints will be bound via OpenAPI chi server
    var pub *ev.Publisher
    if p, err := ev.NewPublisher(ctx); err == nil { pub = p; defer p.Close() }
    // Custom non-OAS endpoints first (so they aren't shadowed), all behind auth
    r.Group(func(rch chi.Router) {
        rch.Use(middleware.AuthMiddleware)
        rch.Get("/api/v1/billing/config", apiHandler.getBillingConfig)
        rch.Get("/api/v1/billing/tokens/transactions/{id}", apiHandler.getTokenTransactionByID)
    })

    // Bind OpenAPI chi server under /api/v1/billing
    oas := &oasImpl{h: apiHandler, pub: pub}
    oapiHandler := api.HandlerWithOptions(oas, api.ChiServerOptions{
        BaseURL: "/api/v1/billing",
        Middlewares: []api.MiddlewareFunc{
            func(next http.Handler) http.Handler { return middleware.IdempotencyMiddleware(next) },
            func(next http.Handler) http.Handler { return middleware.AuthMiddleware(next) },
        },
    })
    r.Mount("/", oapiHandler)

    log.Printf("Billing service HTTP server listening on port %s", cfg.Port)
    if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
        log.Fatalf("failed to start server: %v", err)
    }
}

// runMigrations remains the same...
// HTTP Handler and DTOs remain the same...

// The rest of the file (runMigrations, Handlers, DTOs, etc.) is unchanged.
// For brevity, it's omitted here but should be considered part of the file.
func runMigrations(databaseURL string) error {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil { return err }
	defer db.Close()
	if err = db.Ping(); err != nil { return err }
	tx, err := db.Begin()
	if err != nil { return err }
	defer tx.Rollback()
	migrationsDir := "internal/migrations"
    files, err := os.ReadDir(migrationsDir)
    if err != nil {
        if os.IsNotExist(err) {
            log.Printf("No migrations directory found (%s); skipping DB migrations.", migrationsDir)
            return tx.Commit()
        }
        return err
    }
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			log.Printf("Applying migration: %s", file.Name())
			content, err := os.ReadFile(filepath.Join(migrationsDir, file.Name()))
			if err != nil { return err }
			statements := strings.Split(string(content), ";")
			for _, stmt := range statements {
				if strings.TrimSpace(stmt) != "" {
					if _, err := tx.Exec(stmt); err != nil { return err }
				}
			}
		}
	}
	return tx.Commit()
}
type Handler struct { DB *pgxpool.Pool }
func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{DB: db} }
func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
	mux.HandleFunc("/healthz", h.healthz)
	mux.HandleFunc("/health", h.healthz)
	mux.Handle("/api/v1/billing/subscriptions/me", authMiddleware(http.HandlerFunc(h.getSubscription)))
	mux.Handle("/api/v1/billing/tokens/me", authMiddleware(http.HandlerFunc(h.getTokenBalance)))
	mux.Handle("/api/v1/billing/tokens/transactions", authMiddleware(http.HandlerFunc(h.getTokenTransactions)))
}
func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }
type Subscription struct {
	ID string `json:"id"`; PlanName string `json:"planName"`; Status string `json:"status"`; CurrentPeriodEnd time.Time `json:"currentPeriodEnd"`
}
type TokenBalance struct {
	Balance int64 `json:"balance"`; UpdatedAt time.Time `json:"updatedAt"`
}
type TokenTransaction struct {
	ID string `json:"id"`; Type string `json:"type"`; Amount int `json:"amount"`; Description string `json:"description"`; CreatedAt time.Time `json:"createdAt"`
}
func (h *Handler) getSubscription(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(string)
    if !ok { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
	var sub Subscription
	err := h.DB.QueryRow(r.Context(), `SELECT id, "planName", status, "currentPeriodEnd" FROM "Subscription" WHERE "userId" = $1`, userID).Scan(&sub.ID, &sub.PlanName, &sub.Status, &sub.CurrentPeriodEnd)
    if err != nil { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "Not found", nil); return }
	respondWithJSON(w, http.StatusOK, sub)
    _ = writeBillingUI(r.Context(), userID, map[string]any{"subscription": sub})
}
func (h *Handler) getTokenBalance(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(string)
    if !ok { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
	var balance TokenBalance
	err := h.DB.QueryRow(r.Context(), `SELECT balance, "updatedAt" FROM "UserToken" WHERE "userId" = $1`, userID).Scan(&balance.Balance, &balance.UpdatedAt)
    if err != nil { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "Not found", nil); return }
	respondWithJSON(w, http.StatusOK, balance)
    _ = writeBillingUI(r.Context(), userID, map[string]any{"tokens": balance})
}
func (h *Handler) getTokenTransactions(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    rows, err := h.DB.Query(r.Context(), `
        SELECT id, type, amount, description, "createdAt" FROM "TokenTransaction"
        WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 50`, uid)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    list := make([]TokenTransaction, 0, 50)
    for rows.Next() {
        var t TokenTransaction
        if err := rows.Scan(&t.ID, &t.Type, &t.Amount, &t.Description, &t.CreatedAt); err == nil {
            list = append(list, t)
        }
    }
    respondWithJSON(w, http.StatusOK, list)
}
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(payload)
}

func writeBillingUI(ctx context.Context, userID string, patch map[string]any) error {
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" { return nil }
    pid := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
    if pid == "" { pid = strings.TrimSpace(os.Getenv("PROJECT_ID")) }
    if pid == "" || userID == "" { return nil }
    cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond); defer cancel()
    cli, err := firestore.NewClient(cctx, pid)
    if err != nil { return err }
    defer cli.Close()
    patch["updatedAt"] = time.Now().UTC()
    _, err = cli.Collection("users/"+userID+"/billing").Doc("summary").Set(cctx, patch, firestore.MergeAll)
    return err
}

// --- Atomic Billing minimal endpoints ---
// reserveTokens publishes TokenReserved and writes a TokenTransaction row (type=reserved). No balance mutation here.
func (h *Handler) reserveTokens(pub *ev.Publisher) func(http.ResponseWriter, *http.Request) {
    type reqT struct{ Amount int `json:"amount"`; TaskID string `json:"taskId"` }
    return func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
        uid, _ := r.Context().Value(middleware.UserIDKey).(string)
        var req reqT; _ = json.NewDecoder(r.Body).Decode(&req)
        if uid == "" || req.Amount <= 0 { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid", nil); return }
        // Idempotency
        idem := strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))
        id := ""
        if idem != "" {
            if ex, ok := h.lookupIdem(r.Context(), idem, uid, "billing.reserve"); ok { id = ex }
        }
        if id == "" { id = newID() }
        // snapshot current balance for audit fields (no mutation)
        var before int64
        _ = h.DB.QueryRow(r.Context(), `SELECT balance FROM "UserToken" WHERE "userId"=$1`, uid).Scan(&before)
        meta := map[string]any{"taskId": req.TaskID, "action": "reserve"}
        _, _ = h.DB.Exec(r.Context(), `INSERT INTO "TokenTransaction"(id, "userId", type, amount, "balanceBefore", "balanceAfter", source, description, metadata) VALUES ($1,$2,'reserved',$3,$4,$4,'billing','reserve',to_jsonb($5::json))`, id, uid, req.Amount, before, mustJSON(meta))
        if idem != "" { _ = h.upsertIdem(r.Context(), idem, uid, "billing.reserve", id, 24*time.Hour) }
        if pub != nil { _ = pub.Publish(r.Context(), ev.EventTokenReserved, map[string]any{"txId": id, "userId": uid, "amount": req.Amount, "taskId": req.TaskID, "time": time.Now().UTC().Format(time.RFC3339)}, ev.WithSource("billing"), ev.WithSubject(id)) }
        respondWithJSON(w, http.StatusAccepted, map[string]any{"txId": id, "status": "reserved"})
    }
}

func (h *Handler) commitTokens(pub *ev.Publisher) func(http.ResponseWriter, *http.Request) {
    type reqT struct{ TxID string `json:"txId"`; Amount int `json:"amount"`; TaskID string `json:"taskId"` }
    return func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
        uid, _ := r.Context().Value(middleware.UserIDKey).(string)
        var req reqT; _ = json.NewDecoder(r.Body).Decode(&req)
        if uid == "" || req.Amount <= 0 { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid", nil); return }
        // Idempotency
        idem := strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))
        if idem != "" {
            if ex, ok := h.lookupIdem(r.Context(), idem, uid, "billing.commit"); ok {
                respondWithJSON(w, http.StatusOK, map[string]any{"txId": ex, "status": "committed"})
                return
            }
        }
        id := req.TxID
        if id == "" { id = newID() }
        // atomic debit
        tx, err := h.DB.Begin(r.Context())
        if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "begin tx failed", map[string]string{"error": err.Error()}); return }
        defer tx.Rollback(r.Context())
        var before int64
        // lock row if exists
        _ = tx.QueryRow(r.Context(), `SELECT balance FROM "UserToken" WHERE "userId"=$1 FOR UPDATE`, uid).Scan(&before)
        if before < int64(req.Amount) {
            errors.Write(w, r, http.StatusConflict, "INSUFFICIENT_TOKENS", "insufficient token balance", map[string]any{"balance": before, "attempt": req.Amount})
            return
        }
        after := before - int64(req.Amount)
        // upsert balance
        if before == 0 {
            // ensure row exists to allow update
            _, _ = tx.Exec(r.Context(), `INSERT INTO "UserToken"("userId", balance, "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT ("userId") DO NOTHING`, uid, before)
        }
        if _, err := tx.Exec(r.Context(), `UPDATE "UserToken" SET balance=$1, "updatedAt"=NOW() WHERE "userId"=$2`, after, uid); err != nil {
            errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update balance failed", map[string]string{"error": err.Error()}); return
        }
        meta := map[string]any{"taskId": req.TaskID, "action": "commit"}
        if _, err := tx.Exec(r.Context(), `INSERT INTO "TokenTransaction"(id, "userId", type, amount, "balanceBefore", "balanceAfter", source, description, metadata) VALUES ($1,$2,'debited',$3,$4,$5,'billing','commit',to_jsonb($6::json))`, id, uid, req.Amount, before, after, mustJSON(meta)); err != nil {
            errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "insert tx failed", map[string]string{"error": err.Error()}); return
        }
        if err := tx.Commit(r.Context()); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "commit failed", map[string]string{"error": err.Error()}); return }
        if idem != "" { _ = h.upsertIdem(r.Context(), idem, uid, "billing.commit", id, 24*time.Hour) }
        if pub != nil { _ = pub.Publish(r.Context(), ev.EventTokenDebited, map[string]any{"txId": id, "userId": uid, "amount": req.Amount, "taskId": req.TaskID, "time": time.Now().UTC().Format(time.RFC3339)}, ev.WithSource("billing"), ev.WithSubject(id)) }
        respondWithJSON(w, http.StatusOK, map[string]any{"txId": id, "status": "committed", "balance": after})
    }
}

func (h *Handler) releaseTokens(pub *ev.Publisher) func(http.ResponseWriter, *http.Request) {
    type reqT struct{ TxID string `json:"txId"`; Amount int `json:"amount"`; TaskID string `json:"taskId"` }
    return func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
        uid, _ := r.Context().Value(middleware.UserIDKey).(string)
        var req reqT; _ = json.NewDecoder(r.Body).Decode(&req)
        if uid == "" || req.Amount <= 0 { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid", nil); return }
        // Idempotency
        idem := strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))
        if idem != "" {
            if ex, ok := h.lookupIdem(r.Context(), idem, uid, "billing.release"); ok {
                respondWithJSON(w, http.StatusOK, map[string]any{"txId": ex, "status": "released"})
                return
            }
        }
        id := req.TxID
        if id == "" { id = newID() }
        // record reversal (no balance mutation since reserve didn't deduct)
        var before int64
        _ = h.DB.QueryRow(r.Context(), `SELECT balance FROM "UserToken" WHERE "userId"=$1`, uid).Scan(&before)
        meta := map[string]any{"taskId": req.TaskID, "action": "release"}
        _, _ = h.DB.Exec(r.Context(), `INSERT INTO "TokenTransaction"(id, "userId", type, amount, "balanceBefore", "balanceAfter", source, description, metadata) VALUES ($1,$2,'reverted',$3,$4,$4,'billing','release',to_jsonb($5::json))`, id, uid, req.Amount, before, mustJSON(meta))
        if idem != "" { _ = h.upsertIdem(r.Context(), idem, uid, "billing.release", id, 24*time.Hour) }
        if pub != nil { _ = pub.Publish(r.Context(), ev.EventTokenReverted, map[string]any{"txId": id, "userId": uid, "amount": req.Amount, "taskId": req.TaskID, "time": time.Now().UTC().Format(time.RFC3339)}, ev.WithSource("billing"), ev.WithSubject(id)) }
        respondWithJSON(w, http.StatusOK, map[string]any{"txId": id, "status": "released"})
    }
}

func newID() string { return strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "") }

// Idempotency helpers
func (h *Handler) lookupIdem(ctx context.Context, key, userID, scope string) (string, bool) {
    var id string
    err := h.DB.QueryRow(ctx, `SELECT target_id FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()`, key, userID, scope).Scan(&id)
    if err != nil { return "", false }
    return id, id != ""
}
func (h *Handler) upsertIdem(ctx context.Context, key, userID, scope, targetID string, ttl time.Duration) error {
    _, err := h.DB.Exec(ctx, `
        INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at)
        VALUES ($1,$2,$3,$4,NOW(), NOW()+$5::interval)
        ON CONFLICT (key) DO UPDATE SET user_id=EXCLUDED.user_id, scope=EXCLUDED.scope, target_id=EXCLUDED.target_id, expires_at=EXCLUDED.expires_at
    `, key, userID, scope, targetID, fmt.Sprintf("%d hours", int(ttl.Hours())))
    return err
}

// --- OpenAPI adapter ---
type oasImpl struct{ h *Handler; pub *ev.Publisher }

func (o *oasImpl) GetSubscription(w http.ResponseWriter, r *http.Request)        { o.h.getSubscription(w, r) }
func (o *oasImpl) GetTokenBalance(w http.ResponseWriter, r *http.Request)        { o.h.getTokenBalance(w, r) }
func (o *oasImpl) ListTokenTransactions(w http.ResponseWriter, r *http.Request)  { o.h.getTokenTransactions(w, r) }
func (o *oasImpl) ReserveTokens(w http.ResponseWriter, r *http.Request)          { o.h.reserveTokens(o.pub)(w, r) }
func (o *oasImpl) CommitTokens(w http.ResponseWriter, r *http.Request)           { o.h.commitTokens(o.pub)(w, r) }
func (o *oasImpl) ReleaseTokens(w http.ResponseWriter, r *http.Request)          { o.h.releaseTokens(o.pub)(w, r) }

// --- Non-OAS handlers ---
// getBillingConfig returns central pricing/limits config. Source: Secret Manager (projects/<id>/secrets/billing-pricing),
// or env BILLING_PRICING_JSON as fallback. Response is JSON passthrough with sensible defaults.
func (h *Handler) getBillingConfig(w http.ResponseWriter, r *http.Request) {
    type cfgOut struct{
        Pricing map[string]int `json:"pricing"`
        Limits  map[string]int `json:"limits,omitempty"`
        UpdatedAt string      `json:"updatedAt"`
        Source   string      `json:"source"`
    }
    // Default pricing
    out := cfgOut{
        Pricing: map[string]int{ "siterank.analyze": 1, "batchopen.task": 1, "adscenter.preflight": 1 },
        Limits:  map[string]int{ "daily.maxTasks": 1000 },
        UpdatedAt: time.Now().UTC().Format(time.RFC3339),
        Source: "default",
    }
    // Try Secret Manager JSON
    if js := strings.TrimSpace(os.Getenv("BILLING_PRICING_SECRET")); js != "" {
        // Expect shorthand name, e.g., billing-pricing:latest
        val, err := getSecret(r.Context(), js)
        if err == nil && strings.TrimSpace(val) != "" {
            if m := parsePricingJSON(val); m != nil { out.Pricing = m; out.Source = "secret" }
        }
    }
    // Fallback to env JSON
    if out.Source == "default" {
        if val := strings.TrimSpace(os.Getenv("BILLING_PRICING_JSON")); val != "" {
            if m := parsePricingJSON(val); m != nil { out.Pricing = m; out.Source = "env" }
        }
    }
    writeJSON(w, http.StatusOK, out)
}

// getTokenTransactionByID returns a transaction that belongs to the current user.
func (h *Handler) getTokenTransactionByID(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    id := chi.URLParam(r, "id")
    if strings.TrimSpace(id) == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id required", nil); return }
    var (
        tType string; amount int; before, after int64; source, desc string; created time.Time; metadataJSON *string
    )
    err := h.DB.QueryRow(r.Context(), `SELECT type, amount, "balanceBefore", "balanceAfter", source, description, "createdAt", metadata::text FROM "TokenTransaction" WHERE id=$1 AND "userId"=$2`, id, uid).
        Scan(&tType, &amount, &before, &after, &source, &desc, &created, &metadataJSON)
    if err != nil {
        if err == pgx.ErrNoRows { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "transaction not found", nil); return }
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return
    }
    var metadata map[string]any
    if metadataJSON != nil && *metadataJSON != "" { _ = json.Unmarshal([]byte(*metadataJSON), &metadata) }
    writeJSON(w, http.StatusOK, map[string]any{
        "id": id, "type": tType, "amount": amount, "balanceBefore": before, "balanceAfter": after, "source": source, "description": desc, "createdAt": created, "metadata": metadata,
    })
}

// helpers
func mustJSON(v any) string { b, _ := json.Marshal(v); return string(b) }
func getSecret(ctx context.Context, name string) (string, error) {
    // Delegate to env-first fallback to avoid adding heavy deps here; services use pkg/config normally.
    // Here we support shorthand to keep Server self-contained.
    proj := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
    if proj == "" { proj = strings.TrimSpace(os.Getenv("PROJECT_ID")) }
    if proj == "" { return "", fmt.Errorf("missing project id") }
    // If full resource, just call Secret Manager via HTTP metadata proxy is not feasible here; keep simple by env fallback only.
    // In most deployments, BILLING_PRICING_JSON is preferred.
    return "", fmt.Errorf("secret manager not wired in minimal build; use BILLING_PRICING_JSON")
}
func parsePricingJSON(val string) map[string]int {
    var m map[string]int
    if err := json.Unmarshal([]byte(val), &m); err != nil { return nil }
    return m
}
