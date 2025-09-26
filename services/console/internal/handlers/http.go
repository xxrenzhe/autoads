package handlers

import (
    "encoding/json"
    "log"
    "net/http"
    "time"
    "strconv"
    "strings"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/xxrenzhe/autoads/pkg/errors"
    "github.com/xxrenzhe/autoads/pkg/middleware"
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

    // API routes (admin-only)
    mux.Handle("/api/v1/console/users", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getUsers))))
    // Users tree: /api/v1/console/users/{id}[/(tokens|subscription)]
    mux.Handle("/api/v1/console/users/", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.usersTree))))
    // Token stats (aggregate)
    mux.Handle("/api/v1/console/tokens/stats", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getTokenStats))))

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
