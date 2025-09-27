package handlers

import (
    "encoding/json"
    "log"
    "net/http"
    "time"
    "strconv"
    "strings"
    "os"
    "io"
    "context"
    "sort"
    "fmt"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/xxrenzhe/autoads/pkg/errors"
    "github.com/xxrenzhe/autoads/pkg/middleware"
    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
    httpx "github.com/xxrenzhe/autoads/pkg/http"
)

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type Handler struct {
	DB *pgxpool.Pool
	// publisher events.Publisher
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{DB: db}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
    // Health endpoints (unauthenticated)
    mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
        // simple ping against DB
        if err := h.DB.Ping(r.Context()); err != nil {
            errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": err.Error()})
            return
        }
        w.WriteHeader(http.StatusOK)
    })

    // Health aggregate for Gateway (/api/health) - unauthenticated, read-only
    mux.HandleFunc("/api/health", h.healthAggregate)

    // API routes (admin-only)
    mux.Handle("/api/v1/console/users", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getUsers))))
    // Users tree: /api/v1/console/users/{id}[/(tokens|subscription|role)]
    mux.Handle("/api/v1/console/users/", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.usersTree))))
    // Token stats (aggregate)
    mux.Handle("/api/v1/console/tokens/stats", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getTokenStats))))
    // Admin dashboard stats
    mux.Handle("/api/v1/console/stats", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getAdminStats))))
    // SLO aggregator
    mux.Handle("/api/v1/console/slo", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getSLO))))
    // Limits policy (Adscenter)
    mux.Handle("/api/v1/console/limits/policy", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.limitsPolicy))))
    mux.Handle("/api/v1/console/events/export", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.exportEventsCSV))))
    // Event store query (admin-only)
    mux.Handle("/api/v1/console/events", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getEvents))))
    mux.Handle("/api/v1/console/events/", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getEventByID))))
    // Adscenter bulk actions (admin proxies)
    mux.Handle("/api/v1/console/adscenter/bulk-actions/snapshots", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.acSnapshots))))
    mux.Handle("/api/v1/console/adscenter/bulk-actions/snapshot-aggregate", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.acSnapshotAggregate))))
    mux.Handle("/api/v1/console/adscenter/bulk-actions/deadletters", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.acDeadLetters))))
    mux.Handle("/api/v1/console/adscenter/bulk-actions/deadletters/retry", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.acDeadLetterRetry))))
    mux.Handle("/api/v1/console/adscenter/bulk-actions/deadletters/retry-batch", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.acDeadLetterRetryBatch))))
    // Alerts & incidents (admin-only)
    mux.Handle("/api/v1/console/alerts", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getAlerts))))
    mux.Handle("/api/v1/console/incidents", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getIncidents))))
    // Config (admin-only)
    mux.Handle("/api/v1/console/config/", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.configTree))))

	// Static file serving for the admin UI
	// The path to the static files will be configured via an environment variable
	// for flexibility, defaulting to a path inside the container.
	staticDir := "/app/static" // This will be the path inside the Docker container
	fileServer := http.FileServer(http.Dir(staticDir))
	
	// Serve static files for requests starting with /console
	// and redirect the root /console to /console/index.html
	mux.HandleFunc("/console/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/console/" {
			http.ServeFile(w, r, staticDir+"/index.html")
			return
		}
		// Use StripPrefix to remove the /console/ prefix before handing it to the file server
		http.StripPrefix("/console/", fileServer).ServeHTTP(w,r)
	})
}

func (h *Handler) getUsers(w http.ResponseWriter, r *http.Request) {
	// In a real app, this handler would be protected by an admin-only middleware.
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }

    q := r.URL.Query().Get("q")
    role := strings.TrimSpace(r.URL.Query().Get("role"))
    limit := 50
    offset := 0
    if v := r.URL.Query().Get("limit"); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 { limit = n } }
    if v := r.URL.Query().Get("offset"); v != "" { if n, err := strconv.Atoi(v); err == nil && n >= 0 { offset = n } }

    var rowsData any
    var err error
    if q != "" && role != "" {
        pattern := "%" + q + "%"
        rowsData, err = h.DB.Query(r.Context(), `SELECT id, email, name, role, "createdAt" FROM "User" WHERE (email ILIKE $1 OR name ILIKE $1) AND role=$2 ORDER BY "createdAt" DESC LIMIT $3 OFFSET $4`, pattern, role, limit, offset)
    } else if q != "" {
        pattern := "%" + q + "%"
        rowsData, err = h.DB.Query(r.Context(), `SELECT id, email, name, role, "createdAt" FROM "User" WHERE email ILIKE $1 OR name ILIKE $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`, pattern, limit, offset)
    } else if role != "" {
        rowsData, err = h.DB.Query(r.Context(), `SELECT id, email, name, role, "createdAt" FROM "User" WHERE role=$1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`, role, limit, offset)
    } else {
        rowsData, err = h.DB.Query(r.Context(), `SELECT id, email, name, role, "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2`, limit, offset)
    }
    if err != nil { log.Printf("Error querying users: %v", err); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil); return }
    rows := rowsData.(interface{ Next() bool; Scan(...any) error; Close() })
    defer rows.Close()

    var users []User
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.CreatedAt); err != nil { log.Printf("Error scanning user row: %v", err); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil); return }
        users = append(users, u)
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"items": users, "limit": limit, "offset": offset, "query": q, "role": role})
}

// getUserDetail returns detail for a specific user by id.
// GET /api/v1/console/users/{id}
func (h *Handler) usersTree(w http.ResponseWriter, r *http.Request) {
    const prefix = "/api/v1/console/users/"
    if len(r.URL.Path) <= len(prefix) { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "user id required", nil); return }
    rest := r.URL.Path[len(prefix):] // {id} or {id}/tokens or {id}/subscription
    // split
    uid := rest
    sub := ""
    for i := 0; i < len(rest); i++ {
        if rest[i] == '/' { uid = rest[:i]; if i+1 < len(rest) { sub = rest[i+1:] } else { sub = "" }; break }
    }
    if uid == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "user id required", nil); return }
    switch r.Method {
    case http.MethodGet:
        switch sub {
        case "", "/":
            var user struct{ ID, Email, Name, Role string; CreatedAt time.Time }
            err := h.DB.QueryRow(r.Context(), `SELECT id, email, name, role, "createdAt" FROM "User" WHERE id=$1`, uid).
                Scan(&user.ID, &user.Email, &user.Name, &user.Role, &user.CreatedAt)
            if err != nil { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "user not found", nil); return }
            _ = json.NewEncoder(w).Encode(user)
            return
        case "tokens":
            // return balance + last N transactions (default 10)
            limit := 10
            if v := r.URL.Query().Get("limit"); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 { limit = n } }
            var balance int64
            _ = h.DB.QueryRow(r.Context(), `SELECT balance FROM "UserToken" WHERE "userId"=$1`, uid).Scan(&balance)
            rows, err := h.DB.Query(r.Context(), `
                SELECT id, type, amount, "balanceBefore", "balanceAfter", source, description, "createdAt"
                FROM "TokenTransaction"
                WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2`, uid, limit)
            if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", nil); return }
            defer rows.Close()
            type tx struct{ ID, Type string; Amount int; BalanceBefore, BalanceAfter int64; Source, Description string; CreatedAt time.Time }
            list := make([]tx, 0, limit)
            for rows.Next() {
                var t tx
                if err := rows.Scan(&t.ID, &t.Type, &t.Amount, &t.BalanceBefore, &t.BalanceAfter, &t.Source, &t.Description, &t.CreatedAt); err == nil {
                    list = append(list, t)
                }
            }
            _ = json.NewEncoder(w).Encode(map[string]any{"balance": balance, "items": list})
            return
        case "subscription":
            var subRow struct { ID, PlanName, Status string; TrialEndsAt *time.Time; CurrentPeriodEnd time.Time }
            err := h.DB.QueryRow(r.Context(), `SELECT id, "planName", status, "trialEndsAt", "currentPeriodEnd" FROM "Subscription" WHERE "userId"=$1`, uid).
                Scan(&subRow.ID, &subRow.PlanName, &subRow.Status, &subRow.TrialEndsAt, &subRow.CurrentPeriodEnd)
            if err != nil { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "subscription not found", nil); return }
            _ = json.NewEncoder(w).Encode(subRow)
            return
        case "role":
            if r.Method != http.MethodPut { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
            var body struct{ Role string `json:"role"` }
            if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
            role := strings.ToUpper(strings.TrimSpace(body.Role))
            if role != "ADMIN" && role != "USER" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "role must be ADMIN or USER", nil); return }
            if _, err := h.DB.Exec(r.Context(), `UPDATE "User" SET role=$1 WHERE id=$2`, role, uid); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update failed", nil); return }
            _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "userId": uid, "role": role})
            return
        default:
            errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported subresource", nil); return
        }
    case http.MethodPut:
        switch sub {
        case "subscription":
            // 最小版：允许管理员更新 Subscription 的 planName 与 status；当状态为 active 时顺延 30 天
            var body struct{ PlanName string `json:"planName"`; Status string `json:"status"` }
            if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
            plan := strings.ToLower(strings.TrimSpace(body.PlanName))
            if plan == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "planName required", nil); return }
            switch plan { case "free", "pro", "max": default: errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "planName must be one of free|pro|max", nil); return }
            status := strings.ToLower(strings.TrimSpace(body.Status))
            if status == "" { status = "active" }
            _, err := h.DB.Exec(r.Context(), `
                INSERT INTO "Subscription"(id, "userId", "planName", status, "currentPeriodEnd")
                VALUES (concat('sub_', $1), $1, $2, $3, NOW() + interval '30 days')
                ON CONFLICT ("userId") DO UPDATE SET "planName"=EXCLUDED."planName", status=EXCLUDED.status,
                    "currentPeriodEnd" = CASE WHEN EXCLUDED.status='active' THEN NOW() + interval '30 days' ELSE "Subscription"."currentPeriodEnd" END`, uid, plan, status)
            if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "upsert failed", map[string]string{"error": err.Error()}); return }
            _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "userId": uid, "planName": plan, "subStatus": status})
            return
        default:
            errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported subresource", nil); return
        }
    case http.MethodPost:
        if sub == "tokens" {
            var body struct{ Amount int `json:"amount"` }
            if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
            if body.Amount <= 0 { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "amount must be >0", nil); return }
            tx, err := h.DB.Begin(r.Context())
            if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "begin tx failed", nil); return }
            defer tx.Rollback(r.Context())
            _, _ = tx.Exec(r.Context(), `INSERT INTO "UserToken"("userId", balance, "updatedAt") VALUES ($1, 0, NOW()) ON CONFLICT ("userId") DO NOTHING`, uid)
            if _, err := tx.Exec(r.Context(), `UPDATE "UserToken" SET balance = balance + $1, "updatedAt"=NOW() WHERE "userId"=$2`, body.Amount, uid); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update failed", map[string]string{"error": err.Error()}); return }
            if err := tx.Commit(r.Context()); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "commit failed", map[string]string{"error": err.Error()}); return }
            _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "userId": uid, "amount": body.Amount})
            return
        }
        errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported action", nil)
        return
    default:
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return
    }
}

// userActions handles sub-paths under /api/v1/console/users/{id}/...
// Supported:
//  - POST /api/v1/console/users/{id}/tokens  body: { amount: number }
func (h *Handler) userActions(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    // crude path parse
    path := r.URL.Path // /api/v1/console/users/{id}/tokens
    const prefix = "/api/v1/console/users/"
    if len(path) <= len(prefix) { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "user id required", nil); return }
    rest := path[len(prefix):]
    // rest should be "{id}/tokens"
    var userID string
    if i := len(rest); i > 0 {
        // find next slash
        for j := 0; j < len(rest); j++ {
            if rest[j] == '/' { userID = rest[:j]; rest = rest[j+1:]; break }
        }
        if userID == "" { userID, rest = rest, "" }
    }
    if userID == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "user id required", nil); return }
    if rest != "tokens" { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported action", nil); return }
    // parse body
    var body struct{ Amount int `json:"amount"` }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    if body.Amount <= 0 { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "amount must be >0", nil); return }
    // upsert tokens
    tx, err := h.DB.Begin(r.Context())
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "begin tx failed", nil); return }
    defer tx.Rollback(r.Context())
    // ensure row
    _, _ = tx.Exec(r.Context(), `INSERT INTO "UserToken"("userId", balance, "updatedAt") VALUES ($1, 0, NOW()) ON CONFLICT ("userId") DO NOTHING`, userID)
    // increment
    if _, err := tx.Exec(r.Context(), `UPDATE "UserToken" SET balance = balance + $1, "updatedAt"=NOW() WHERE "userId"=$2`, body.Amount, userID); err != nil {
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update failed", map[string]string{"error": err.Error()}); return
    }
    if err := tx.Commit(r.Context()); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "commit failed", map[string]string{"error": err.Error()}); return }
    _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "userId": userID, "amount": body.Amount})
}

// getTokenStats returns aggregate stats for tokens across users.
func (h *Handler) getTokenStats(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    var count int64
    var sum int64
    if err := h.DB.QueryRow(r.Context(), `SELECT COUNT(*), COALESCE(SUM(balance),0) FROM "UserToken"`).Scan(&count, &sum); err != nil {
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return
    }
    _ = json.NewEncoder(w).Encode(map[string]any{"users": count, "totalTokens": sum})
}

// getAdminStats returns aggregated counters for admin dashboard.
// GET /api/v1/console/stats
func (h *Handler) getAdminStats(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    ctx := r.Context()
    q := func(sql string, args ...any) (int64, error) {
        var n int64
        err := h.DB.QueryRow(ctx, sql, args...).Scan(&n)
        return n, err
    }
    // Collect metrics; tolerate missing tables by returning -1 on error
    counters := map[string]int64{}
    try := func(key, sql string) {
        if n, err := q(sql); err == nil { counters[key] = n } else { counters[key] = -1 }
    }
    try("users", `SELECT COUNT(1) FROM "User"`)
    try("offers", `SELECT COUNT(1) FROM "Offer"`)
    try("subscriptionsActive", `SELECT COUNT(1) FROM "Subscription" WHERE status='active'`)
    try("tokensTotal", `SELECT COALESCE(SUM(balance),0) FROM "UserToken"`)
    try("notifications24h", `SELECT COUNT(1) FROM user_notifications WHERE created_at > NOW() - interval '24 hours'`)
    // Optional tables (if exist)
    try("siterankAnalyses", `SELECT COUNT(1) FROM "SiterankHistory"`)
    try("batchopenTasks", `SELECT COUNT(1) FROM "BatchopenTask"`)
    try("events", `SELECT COUNT(1) FROM event_store`)

    out := map[string]any{
        "counters":  counters,
        "updatedAt": time.Now().UTC().Format(time.RFC3339),
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(out)
}

// getSLO fetches /metrics from configured services and computes rough P95 and error rate.
// Env vars: *_URL (base) for siterank/billing/batchopen/adscenter/offer/notifications
func (h *Handler) getSLO(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    type serviceCfg struct{ name, url string }
    cfgs := []serviceCfg{
        {"siterank", strings.TrimRight(os.Getenv("SITERANK_URL"), "/")},
        {"billing", strings.TrimRight(os.Getenv("BILLING_URL"), "/")},
        {"batchopen", strings.TrimRight(os.Getenv("BATCHOPEN_URL"), "/")},
        {"adscenter", strings.TrimRight(os.Getenv("ADSCENTER_URL"), "/")},
        {"offer", strings.TrimRight(os.Getenv("OFFER_URL"), "/")},
        {"notifications", strings.TrimRight(os.Getenv("NOTIFICATIONS_URL"), "/")},
    }
    type slo struct{ P95 float64 `json:"p95"`; Total int64 `json:"total"`; ErrorRate float64 `json:"errorRate"`; Notes map[string]float64 `json:"notes,omitempty"` }
    out := map[string]slo{}
    for _, c := range cfgs {
        if c.url == "" { continue }
        ctx, cancel := context.WithTimeout(r.Context(), 1500*time.Millisecond)
        req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.url+"/metrics", nil)
        resp, err := httpx.New(1500*time.Millisecond).DoRaw(req)
        cancel()
        if err != nil || resp == nil || resp.StatusCode != 200 { continue }
        b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
        _ = resp.Body.Close()
        p95, total, errRate, notes := computeFromMetrics(string(b), c.name)
        out[c.name] = slo{P95: p95, Total: total, ErrorRate: errRate, Notes: notes}
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"services": out, "updatedAt": time.Now().UTC().Format(time.RFC3339)})
}

// limitsPolicy supports GET (read current policy JSON) and PUT (update policy by creating a new secret version).
// Env: ADSCENTER_LIMITS_SECRET = projects/<pid>/secrets/<name>/versions/latest
func (h *Handler) limitsPolicy(w http.ResponseWriter, r *http.Request) {
    name := strings.TrimSpace(os.Getenv("ADSCENTER_LIMITS_SECRET"))
    if name == "" { errors.Write(w, r, http.StatusBadRequest, "SERVER_NOT_CONFIGURED", "ADSCENTER_LIMITS_SECRET not set", nil); return }
    ctx := r.Context()
    switch r.Method {
    case http.MethodGet:
        // read latest
        cli, err := secretmanager.NewClient(ctx)
        if err != nil { errors.Write(w, r, http.StatusInternalServerError, "SECRET_CLIENT", err.Error(), nil); return }
        defer cli.Close()
        res, err := cli.AccessSecretVersion(ctx, &secretmanagerpb.AccessSecretVersionRequest{Name: name})
        if err != nil { errors.Write(w, r, http.StatusInternalServerError, "SECRET_ACCESS", err.Error(), nil); return }
        // try JSON parse; if失败则以 text 形式返回
        var js map[string]any
        b := res.Payload.GetData()
        if json.Unmarshal(b, &js) == nil {
            _ = json.NewEncoder(w).Encode(map[string]any{"policy": js, "name": name})
            return
        }
        _ = json.NewEncoder(w).Encode(map[string]any{"policyText": string(b), "name": name})
    case http.MethodPut:
        // body: { policy: <object> } 或 { policyText: <string> }
        var body struct{ Policy any `json:"policy"`; PolicyText string `json:"policyText"` }
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid json", nil); return }
        var payload []byte
        if body.Policy != nil { if b, err := json.Marshal(body.Policy); err == nil { payload = b } }
        if len(payload) == 0 && strings.TrimSpace(body.PolicyText) != "" { payload = []byte(body.PolicyText) }
        if len(payload) == 0 { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "missing policy", nil); return }
        // parent from versioned name: drop '/versions/...'
        parent := name
        if i := strings.LastIndex(parent, "/versions/"); i > 0 { parent = parent[:i] }
        cli, err := secretmanager.NewClient(ctx)
        if err != nil { errors.Write(w, r, http.StatusInternalServerError, "SECRET_CLIENT", err.Error(), nil); return }
        defer cli.Close()
        res, err := cli.AddSecretVersion(ctx, &secretmanagerpb.AddSecretVersionRequest{ Parent: parent, Payload: &secretmanagerpb.SecretPayload{ Data: payload } })
        if err != nil { errors.Write(w, r, http.StatusInternalServerError, "SECRET_ADD_VERSION", err.Error(), nil); return }
        _ = json.NewEncoder(w).Encode(map[string]any{"version": res.GetName()})
    default:
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
    }
}

// getEvents returns recent events from event_store with optional filters.
// GET /api/v1/console/events?eventName=&aggregateType=&aggregateId=&sinceHours=168&limit=100&offset=0
func (h *Handler) getEvents(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    q := r.URL.Query()
    eventName := strings.TrimSpace(q.Get("eventName"))
    aggType := strings.TrimSpace(q.Get("aggregateType"))
    aggId := strings.TrimSpace(q.Get("aggregateId"))
    sinceHours := 168
    if v := strings.TrimSpace(q.Get("sinceHours")); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= (90*24) { sinceHours = n } }
    limit := 100
    if v := strings.TrimSpace(q.Get("limit")); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 500 { limit = n } }
    offset := 0
    if v := strings.TrimSpace(q.Get("offset")); v != "" { if n, err := strconv.Atoi(v); err == nil && n >= 0 { offset = n } }

    where := []string{"occurred_at > NOW() - ($1 || ' hours')::interval"}
    args := []any{ sinceHours }
    argi := 2
    if eventName != "" { where = append(where, "event_name = $"+strconv.Itoa(argi)); args = append(args, eventName); argi++ }
    if aggType != "" { where = append(where, "aggregate_type = $"+strconv.Itoa(argi)); args = append(args, aggType); argi++ }
    if aggId != "" { where = append(where, "aggregate_id = $"+strconv.Itoa(argi)); args = append(args, aggId); argi++ }
    sqlStr := "SELECT id, event_id, event_name, aggregate_type, aggregate_id, occurred_at, payload::text FROM event_store WHERE " + strings.Join(where, " AND ") + " ORDER BY occurred_at DESC LIMIT $"+strconv.Itoa(argi)+" OFFSET $"+strconv.Itoa(argi+1)
    args = append(args, limit, offset)
    rows, err := h.DB.Query(r.Context(), sqlStr, args...)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct { ID int64 `json:"id"`; EventID string `json:"eventId"`; EventName string `json:"eventName"`; AggregateType string `json:"aggregateType"`; AggregateID string `json:"aggregateId"`; OccurredAt string `json:"occurredAt"`; Payload string `json:"payload"` }
    out := []item{}
    for rows.Next() {
        var it item
        var t time.Time
        if err := rows.Scan(&it.ID, &it.EventID, &it.EventName, &it.AggregateType, &it.AggregateID, &t, &it.Payload); err == nil {
            it.OccurredAt = t.UTC().Format(time.RFC3339)
            out = append(out, it)
        }
    }
    _ = json.NewEncoder(w).Encode(map[string]any{"items": out})
}

// getEventByID returns a single event by numeric id.
// GET /api/v1/console/events/{id}
func (h *Handler) getEventByID(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    path := strings.TrimPrefix(r.URL.Path, "/api/v1/console/events/")
    id := strings.TrimSpace(path)
    if id == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id required", nil); return }
    row := h.DB.QueryRow(r.Context(), `SELECT id, event_id, event_name, aggregate_type, aggregate_id, occurred_at, payload::text, metadata::text FROM event_store WHERE id=$1`, id)
    var it struct { ID int64 `json:"id"`; EventID string `json:"eventId"`; EventName string `json:"eventName"`; AggregateType string `json:"aggregateType"`; AggregateID string `json:"aggregateId"`; OccurredAt string `json:"occurredAt"`; Payload string `json:"payload"`; Metadata string `json:"metadata"` }
    var t time.Time
    if err := row.Scan(&it.ID, &it.EventID, &it.EventName, &it.AggregateType, &it.AggregateID, &t, &it.Payload, &it.Metadata); err != nil {
        errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "event not found", nil); return
    }
    it.OccurredAt = t.UTC().Format(time.RFC3339)
    _ = json.NewEncoder(w).Encode(it)
}

// --- Adscenter admin proxies ---

func (h *Handler) acSnapshots(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    id := strings.TrimSpace(r.URL.Query().Get("id"))
    if id == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id required", nil); return }
    owner := h.lookupBulkOwner(r.Context(), id)
    base := strings.TrimRight(os.Getenv("ADSCENTER_URL"), "/")
    if base == "" { errors.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "ADSCENTER_URL not set", nil); return }
    cli := httpx.New(3 * time.Second)
    hdr := map[string]string{"X-User-Id": owner}
    var out map[string]any
    if err := cli.DoJSON(r.Context(), http.MethodGet, base+"/api/v1/adscenter/bulk-actions/"+id+"/snapshots", nil, hdr, 1, &out); err != nil { errors.Write(w, r, http.StatusBadGateway, "UPSTREAM", err.Error(), nil); return }
    _ = json.NewEncoder(w).Encode(out)
}

func (h *Handler) acSnapshotAggregate(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    id := strings.TrimSpace(r.URL.Query().Get("id"))
    if id == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id required", nil); return }
    owner := h.lookupBulkOwner(r.Context(), id)
    base := strings.TrimRight(os.Getenv("ADSCENTER_URL"), "/")
    if base == "" { errors.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "ADSCENTER_URL not set", nil); return }
    cli := httpx.New(3 * time.Second)
    hdr := map[string]string{"X-User-Id": owner}
    var out map[string]any
    if err := cli.DoJSON(r.Context(), http.MethodGet, base+"/api/v1/adscenter/bulk-actions/"+id+"/snapshot-aggregate", nil, hdr, 1, &out); err != nil { errors.Write(w, r, http.StatusBadGateway, "UPSTREAM", err.Error(), nil); return }
    _ = json.NewEncoder(w).Encode(out)
}

func (h *Handler) acDeadLetters(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    id := strings.TrimSpace(r.URL.Query().Get("id"))
    if id == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id required", nil); return }
    owner := h.lookupBulkOwner(r.Context(), id)
    base := strings.TrimRight(os.Getenv("ADSCENTER_URL"), "/")
    if base == "" { errors.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "ADSCENTER_URL not set", nil); return }
    q := r.URL.RawQuery
    cli := httpx.New(4 * time.Second)
    hdr := map[string]string{"X-User-Id": owner}
    var out map[string]any
    url := base+"/api/v1/adscenter/bulk-actions/"+id+"/deadletters"
    if q != "" { url += "?"+q }
    if err := cli.DoJSON(r.Context(), http.MethodGet, url, nil, hdr, 1, &out); err != nil { errors.Write(w, r, http.StatusBadGateway, "UPSTREAM", err.Error(), nil); return }
    _ = json.NewEncoder(w).Encode(out)
}

func (h *Handler) acDeadLetterRetry(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    var body struct{ ID string `json:"id"`; DLID string `json:"dlid"` }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.ID)=="" || strings.TrimSpace(body.DLID)=="" {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id/dlid required", nil); return
    }
    owner := h.lookupBulkOwner(r.Context(), body.ID)
    base := strings.TrimRight(os.Getenv("ADSCENTER_URL"), "/")
    if base == "" { errors.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "ADSCENTER_URL not set", nil); return }
    cli := httpx.New(6 * time.Second)
    hdr := map[string]string{"X-User-Id": owner}
    var out map[string]any
    url := base+"/api/v1/adscenter/bulk-actions/"+body.ID+"/deadletters/"+body.DLID+"/retry"
    if err := cli.DoJSON(r.Context(), http.MethodPost, url, nil, hdr, 1, &out); err != nil { errors.Write(w, r, http.StatusBadGateway, "UPSTREAM", err.Error(), nil); return }
    _ = json.NewEncoder(w).Encode(out)
}

func (h *Handler) acDeadLetterRetryBatch(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    var body struct{ ID string `json:"id"`; ActionType string `json:"actionType"`; Limit int `json:"limit"` }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.ID)=="" {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id required", nil); return
    }
    owner := h.lookupBulkOwner(r.Context(), body.ID)
    base := strings.TrimRight(os.Getenv("ADSCENTER_URL"), "/")
    if base == "" { errors.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "ADSCENTER_URL not set", nil); return }
    cli := httpx.New(15 * time.Second)
    hdr := map[string]string{"X-User-Id": owner}
    // construct query
    url := base+"/api/v1/adscenter/bulk-actions/"+body.ID+"/deadletters/retry-batch"
    vals := []string{}
    if strings.TrimSpace(body.ActionType) != "" { vals = append(vals, "actionType="+body.ActionType) }
    if body.Limit > 0 { vals = append(vals, "limit="+strconv.Itoa(body.Limit)) }
    if len(vals) > 0 { url += "?"+strings.Join(vals, "&") }
    var out map[string]any
    if err := cli.DoJSON(r.Context(), http.MethodPost, url, nil, hdr, 1, &out); err != nil { errors.Write(w, r, http.StatusBadGateway, "UPSTREAM", err.Error(), nil); return }
    _ = json.NewEncoder(w).Encode(out)
}

func (h *Handler) lookupBulkOwner(ctx context.Context, opId string) string {
    var uid string
    _ = h.DB.QueryRow(ctx, `SELECT user_id FROM "BulkActionOperation" WHERE id=$1`, opId).Scan(&uid)
    return strings.TrimSpace(uid)
}

// healthAggregate queries configured services' readiness endpoints and returns a unified health result.
// Env: *_URL (base) for siterank/billing/batchopen/adscenter/offer/notifications/console; uses /readyz then /health fallback.
// Response: { overall: ok|degraded|down, services: { name: { status, code, latency_ms, error? } }, updatedAt }
func (h *Handler) healthAggregate(w http.ResponseWriter, r *http.Request) {
    type svc struct{ name, url string }
    cfgs := []svc{
        {"siterank", strings.TrimRight(os.Getenv("SITERANK_URL"), "/")},
        {"billing", strings.TrimRight(os.Getenv("BILLING_URL"), "/")},
        {"batchopen", strings.TrimRight(os.Getenv("BATCHOPEN_URL"), "/")},
        {"adscenter", strings.TrimRight(os.Getenv("ADSCENTER_URL"), "/")},
        {"offer", strings.TrimRight(os.Getenv("OFFER_URL"), "/")},
        {"notifications", strings.TrimRight(os.Getenv("NOTIFICATIONS_URL"), "/")},
        {"console", strings.TrimRight(os.Getenv("CONSOLE_URL"), "/")},
    }
    type item struct { Status string `json:"status"`; Code int `json:"code"`; Latency int64 `json:"latency_ms"`; Error string `json:"error,omitempty"` }
    out := map[string]item{}
    overall := "ok"
    for _, c := range cfgs {
        if c.url == "" { continue }
        start := time.Now()
        ctx, cancel := context.WithTimeout(r.Context(), 1200*time.Millisecond)
        // prefer /readyz then fallback /health
        endpoints := []string{"/readyz", "/health"}
        var resp *http.Response
        var err error
        for _, ep := range endpoints {
            req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.url+ep, nil)
            resp, err = httpx.New(1200*time.Millisecond).DoRaw(req)
            if err == nil && resp != nil { break }
        }
        cancel()
        lat := time.Since(start).Milliseconds()
        it := item{Latency: lat}
        if err != nil || resp == nil {
            it.Status = "down"
            it.Code = 0
            if err != nil { it.Error = err.Error() }
            overall = "down"
        } else {
            it.Code = resp.StatusCode
            _ = resp.Body.Close()
            if resp.StatusCode >= 200 && resp.StatusCode < 300 {
                it.Status = "up"
            } else if resp.StatusCode >= 500 {
                it.Status = "down"
                overall = "down"
            } else {
                it.Status = "degraded"
                if overall == "ok" { overall = "degraded" }
            }
        }
        out[c.name] = it
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"overall": overall, "services": out, "updatedAt": time.Now().UTC().Format(time.RFC3339)})
}

// exportEventsCSV streams CSV for events with same filters as getEvents.
func (h *Handler) exportEventsCSV(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    q := r.URL.Query()
    eventName := strings.TrimSpace(q.Get("eventName"))
    aggType := strings.TrimSpace(q.Get("aggregateType"))
    aggId := strings.TrimSpace(q.Get("aggregateId"))
    sinceHours := 168
    if v := strings.TrimSpace(q.Get("sinceHours")); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= (90*24) { sinceHours = n } }
    limit := 1000
    if v := strings.TrimSpace(q.Get("limit")); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 5000 { limit = n } }
    offset := 0
    if v := strings.TrimSpace(q.Get("offset")); v != "" { if n, err := strconv.Atoi(v); err == nil && n >= 0 { offset = n } }

    where := []string{"occurred_at > NOW() - ($1 || ' hours')::interval"}
    args := []any{ sinceHours }
    argi := 2
    if eventName != "" { where = append(where, "event_name = $"+strconv.Itoa(argi)); args = append(args, eventName); argi++ }
    if aggType != "" { where = append(where, "aggregate_type = $"+strconv.Itoa(argi)); args = append(args, aggType); argi++ }
    if aggId != "" { where = append(where, "aggregate_id = $"+strconv.Itoa(argi)); args = append(args, aggId); argi++ }
    sqlStr := "SELECT id, event_id, event_name, aggregate_type, aggregate_id, occurred_at FROM event_store WHERE " + strings.Join(where, " AND ") + " ORDER BY occurred_at DESC LIMIT $"+strconv.Itoa(argi)+" OFFSET $"+strconv.Itoa(argi+1)
    args = append(args, limit, offset)
    rows, err := h.DB.Query(r.Context(), sqlStr, args...)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    w.Header().Set("Content-Type", "text/csv; charset=utf-8")
    w.Header().Set("Content-Disposition", "attachment; filename=events.csv")
    // write header
    _, _ = w.Write([]byte("id,eventId,eventName,aggregateType,aggregateId,occurredAt\n"))
    for rows.Next() {
        var id int64; var eid, en, at, aid string; var t time.Time
        if err := rows.Scan(&id, &eid, &en, &at, &aid, &t); err == nil {
            line := fmt.Sprintf("%d,%s,%s,%s,%s,%s\n", id, safeCSV(eid), safeCSV(en), safeCSV(at), safeCSV(aid), t.UTC().Format(time.RFC3339))
            _, _ = w.Write([]byte(line))
        }
    }
}

func safeCSV(s string) string {
    if strings.ContainsAny(s, ",\n\r\"") {
        s = strings.ReplaceAll(s, "\"", "\"\"")
        return "\"" + s + "\""
    }
    return s
}

// getAlerts returns recent warn/error notifications across users (admin-only).
// GET /api/v1/console/alerts?level=warn|error&sinceHours=168&limit=200
func (h *Handler) getAlerts(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    q := r.URL.Query()
    level := strings.ToLower(strings.TrimSpace(q.Get("level")))
    sinceHours := 168
    if v := strings.TrimSpace(q.Get("sinceHours")); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= (90*24) { sinceHours = n } }
    limit := 200
    if v := strings.TrimSpace(q.Get("limit")); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 1000 { limit = n } }
    // Build SQL with LIKE to avoid cast errors on text column
    base := `SELECT id, user_id, type, title, message, created_at FROM user_notifications WHERE created_at > NOW() - ($1 || ' hours')::interval`
    args := []any{ sinceHours }
    if level == "error" { base += ` AND message ILIKE '%"severity":"error"%'` }
    if level == "warn" || level == "warning" { base += ` AND message ILIKE '%"severity":"warn"%'` }
    base += ` ORDER BY id DESC LIMIT $2`
    args = append(args, limit)
    rows, err := h.DB.Query(r.Context(), base, args...)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct{
        ID string `json:"id"`
        UserID string `json:"userId"`
        Type string `json:"type"`
        Title string `json:"title"`
        Severity string `json:"severity"`
        Category string `json:"category"`
        Summary string `json:"summary"`
        CreatedAt time.Time `json:"createdAt"`
    }
    out := make([]item, 0, limit)
    for rows.Next() {
        var id int64; var userID, typ, title, message string; var createdAt time.Time
        if err := rows.Scan(&id, &userID, &typ, &title, &message, &createdAt); err != nil { continue }
        sev, cat, sum := parseNotifMessage(message)
        out = append(out, item{ID: strconv.FormatInt(id,10), UserID: userID, Type: typ, Title: title, Severity: sev, Category: cat, Summary: sum, CreatedAt: createdAt})
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"items": out})
}

// getIncidents aggregates warn/error counts by day and type over last N days.
// GET /api/v1/console/incidents?days=7
func (h *Handler) getIncidents(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    days := 7
    if v := strings.TrimSpace(r.URL.Query().Get("days")); v != "" { if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 90 { days = n } }
    rows, err := h.DB.Query(r.Context(), `SELECT id, type, title, message, created_at FROM user_notifications WHERE created_at > NOW() - ($1 || ' days')::interval ORDER BY created_at ASC`, days)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type bucket struct{ Date string `json:"date"`; Error int `json:"error"`; Warn int `json:"warn"` }
    agg := map[string]*bucket{}
    for rows.Next() {
        var id int64; var typ, title, message string; var createdAt time.Time
        if err := rows.Scan(&id, &typ, &title, &message, &createdAt); err != nil { continue }
        date := createdAt.UTC().Format("2006-01-02")
        if _, ok := agg[date]; !ok { agg[date] = &bucket{Date: date} }
        sev, _, _ := parseNotifMessage(message)
        if sev == "error" { agg[date].Error++ } else if sev == "warn" { agg[date].Warn++ }
    }
    out := make([]bucket, 0, len(agg))
    for _, b := range agg { out = append(out, *b) }
    sort.Slice(out, func(i,j int) bool { return out[i].Date < out[j].Date })
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"days": out})
}

func parseNotifMessage(msg string) (severity, category, summary string) {
    severity = "info"; category = "general"; summary = ""
    if strings.TrimSpace(msg) == "" { return }
    var m map[string]any
    if err := json.Unmarshal([]byte(msg), &m); err == nil {
        if v, ok := m["severity"].(string); ok { severity = strings.ToLower(v) }
        if v, ok := m["category"].(string); ok { category = strings.ToLower(v) }
        if v, ok := m["summary"].(string); ok { summary = v }
        if summary == "" { if data, ok := m["data"].(map[string]any); ok { if v, ok := data["finalUrl"].(string); ok { summary = v } } }
    } else {
        if strings.Contains(msg, "\"severity\":\"error\"") { severity = "error" } else if strings.Contains(msg, "\"severity\":\"warn\"") { severity = "warn" }
    }
    return
}

// --- Config APIs ---
// Table: console_config(key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())
func (h *Handler) ensureConfigDDL(ctx context.Context) { _, _ = h.DB.Exec(ctx, `CREATE TABLE IF NOT EXISTS console_config (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`) }

// configTree handles /api/v1/console/config/{key}
//  GET -> { value, updatedAt } 404 if not exist
//  PUT body: { value: any } -> upsert
func (h *Handler) configTree(w http.ResponseWriter, r *http.Request) {
    const prefix = "/api/v1/console/config/"
    if len(r.URL.Path) <= len(prefix) { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "config key required", nil); return }
    key := strings.Trim(r.URL.Path[len(prefix):], "/")
    if key == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "config key required", nil); return }
    h.ensureConfigDDL(r.Context())
    switch r.Method {
    case http.MethodGet:
        var val string; var updated time.Time
        err := h.DB.QueryRow(r.Context(), `SELECT value::text, updated_at FROM console_config WHERE key=$1`, key).Scan(&val, &updated)
        if err != nil {
            errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "config not found", nil); return
        }
        var anyv any
        _ = json.Unmarshal([]byte(val), &anyv)
        _ = json.NewEncoder(w).Encode(map[string]any{"value": anyv, "updatedAt": updated})
        return
    case http.MethodPut:
        var body struct{ Value any `json:"value"` }
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
        b, _ := json.Marshal(body.Value)
        _, err := h.DB.Exec(r.Context(), `INSERT INTO console_config(key,value,updated_at) VALUES ($1,$2::jsonb,NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, key, string(b))
        if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "upsert failed", map[string]string{"error": err.Error()}); return }
        _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "key": key})
        return
    default:
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return
    }
}

// computeFromMetrics parses Prometheus exposition to extract http_request_duration_seconds buckets and errors.
func computeFromMetrics(text, service string) (p95 float64, total int64, errorRate float64, notes map[string]float64) {
    // http_request_duration_seconds_bucket{service="X",le="Y",...} value
    // http_requests_total{service="X",status="OK"|...} count
    type bucket struct{ le float64; count int64 }
    buckets := []bucket{}
    var totalReq, errorReq int64
    lines := strings.Split(text, "\n")
    for _, ln := range lines {
        if strings.HasPrefix(ln, "http_request_duration_seconds_bucket") {
            if !strings.Contains(ln, "service=\""+service+"\"") { continue }
            // extract le
            le := extractLabelFloat(ln, "le")
            val := extractValueInt(ln)
            if le > 0 && val >= 0 { buckets = append(buckets, bucket{le: le, count: val}) }
        } else if strings.HasPrefix(ln, "http_requests_total") {
            if !strings.Contains(ln, "service=\""+service+"\"") { continue }
            val := extractValueInt(ln)
            totalReq += val
            // consider non-OK as error
            if !strings.Contains(ln, "status=\"OK\"") { errorReq += val }
        } else if service == "siterank" && strings.HasPrefix(ln, "siterank_sw_fetch_ms_bucket") {
            // include Some domain-specific P95 approximations in notes
        }
    }
    // compute p95 by cumulative buckets
    p95 = 0
    total = totalReq
    errorRate = 0
    if totalReq > 0 { errorRate = float64(errorReq) / float64(totalReq) }
    if len(buckets) > 0 {
        sort.Slice(buckets, func(i, j int) bool { return buckets[i].le < buckets[j].le })
        // convert seconds to ms for UI readability
        target := int64(float64(totalReq) * 0.95)
        var cur int64
        for _, b := range buckets {
            cur = b.count
            if cur >= target { p95 = b.le * 1000; break }
        }
    }
    // optional domain notes: siterank histograms
    notes = map[string]float64{}
    if service == "siterank" {
        // compute p95 for custom ms histograms (bucket values in plain count format)
        notes["resolve_nav_p95_ms"] = parseHistP95(text, "siterank_resolve_nav_ms_bucket")
        notes["sw_fetch_p95_ms"] = parseHistP95(text, "siterank_sw_fetch_ms_bucket")
        notes["ai_score_p95_ms"] = parseHistP95(text, "siterank_ai_score_ms_bucket")
    }
    return
}

func extractLabelFloat(ln, key string) float64 {
    // key="val"
    i := strings.Index(ln, key+"=\"")
    if i < 0 { return 0 }
    j := strings.Index(ln[i+len(key)+2:], "\"")
    if j < 0 { return 0 }
    v := ln[i+len(key)+2 : i+len(key)+2+j]
    f, _ := strconv.ParseFloat(v, 64)
    return f
}
func extractValueInt(ln string) int64 {
    // value is last token
    parts := strings.Fields(ln)
    if len(parts) == 0 { return 0 }
    v := parts[len(parts)-1]
    f, _ := strconv.ParseFloat(v, 64)
    if f < 0 { return 0 }
    return int64(f)
}
func parseHistP95(text, metric string) float64 {
    type bucket struct{ le float64; count int64 }
    buckets := []bucket{}
    var total int64
    for _, ln := range strings.Split(text, "\n") {
        if !strings.HasPrefix(ln, metric) { continue }
        le := extractLabelFloat(ln, "le")
        val := extractValueInt(ln)
        if le > 0 { buckets = append(buckets, bucket{le: le, count: val}); total = val }
    }
    if len(buckets) == 0 || total == 0 { return 0 }
    sort.Slice(buckets, func(i, j int) bool { return buckets[i].le < buckets[j].le })
    target := int64(float64(total) * 0.95)
    for _, b := range buckets {
        if b.count >= target { return b.le }
    }
    return buckets[len(buckets)-1].le
}
