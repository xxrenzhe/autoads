package main

import (
    "context"
    "database/sql"
    "encoding/json"
    "net/http"
    "os"
    "strconv"
    "time"

    "github.com/xxrenzhe/autoads/pkg/errors"
    "github.com/xxrenzhe/autoads/pkg/logger"
    "github.com/xxrenzhe/autoads/pkg/middleware"
    _ "github.com/lib/pq"
    "github.com/xxrenzhe/autoads/services/notifications/internal/events"
)

var log = logger.Get()
var db *sql.DB

type Notification struct {
    ID        string `json:"id"`
    Type      string `json:"type"`
    Title     string `json:"title"`
    Message   string `json:"message"`
    CreatedAt string `json:"createdAt"`
}

func main() {
    // Setup DB (read from env)
    dsn := os.Getenv("DATABASE_URL")
    if dsn == "" { log.Fatal().Msg("DATABASE_URL not set") }
    var err error
    db, err = sql.Open("postgres", dsn)
    if err != nil { log.Fatal().Err(err).Msg("db open") }
    if err := db.Ping(); err != nil { log.Fatal().Err(err).Msg("db ping") }

    mux := http.NewServeMux()
    mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
        if err := db.Ping(); err != nil { errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": err.Error()}); return }
        w.WriteHeader(http.StatusOK)
    })

    api := http.NewServeMux()
    api.HandleFunc("/api/v1/notifications/recent", recentHandler)
    // future: /api/v1/notifications/rules
    if os.Getenv("DEBUG") == "1" {
        api.HandleFunc("/api/v1/debug/offers", debugOffersHandler)
    }

    mux.Handle("/", middleware.AuthMiddleware(api))

    // Start subscriber (best-effort)
    if os.Getenv("GOOGLE_CLOUD_PROJECT") != "" && os.Getenv("PUBSUB_SUBSCRIPTION_ID") != "" {
        sub, err := events.NewSubscriber(context.Background(), db)
        if err != nil {
            log.Warn().Err(err).Msg("notifications: subscriber init failed")
        } else {
            sub.Start(context.Background())
        }
    }

    port := os.Getenv("PORT")
    if port == "" { port = "8080" }
    log.Info().Str("port", port).Msg("Notifications service starting...")
    if err := http.ListenAndServe(":"+port, mux); err != nil {
        log.Fatal().Err(err).Msg("failed to start server")
    }
}

func recentHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
        return
    }
    // User context
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    // Simple pagination params: limit and cursor (RFC 3986 safe)
    q := r.URL.Query()
    limit := 20
    if v := q.Get("limit"); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
            limit = n
        }
    }
    cursor := q.Get("cursor")
    var rows *sql.Rows
    var err error
    if cursor != "" {
        // cursor is last seen id; return items with id < cursor
        rows, err = db.Query(`SELECT id, type, title, message, created_at FROM user_notifications WHERE user_id=$1 AND id < $2 ORDER BY id DESC LIMIT $3`, uid, cursor, limit)
    } else {
        rows, err = db.Query(`SELECT id, type, title, message, created_at FROM user_notifications WHERE user_id=$1 ORDER BY id DESC LIMIT $2`, uid, limit)
    }
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    items := make([]Notification, 0, limit)
    var lastID string
    for rows.Next() {
        var n Notification
        var id int64
        var createdAt sql.NullTime
        if err := rows.Scan(&id, &n.Type, &n.Title, &n.Message, &createdAt); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Scan failed", map[string]string{"error": err.Error()}); return }
        n.ID = strconv.FormatInt(id, 10)
        if createdAt.Valid { n.CreatedAt = createdAt.Time.UTC().Format(time.RFC3339) }
        items = append(items, n)
        lastID = n.ID
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(struct{
        Items []Notification `json:"items"`
        Next  string         `json:"next,omitempty"`
    }{ Items: items, Next: func() string { if len(items) == limit { return lastID }; return "" }() })
}

// debugOffersHandler returns recent offers for a user (preprod debugging only)
func debugOffersHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    uid := r.URL.Query().Get("userId")
    if uid == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "userId required", nil); return }
    rows, err := db.Query(`SELECT id, "userId", name, "originalUrl", status, "createdAt" FROM "Offer" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 10`, uid)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type Offer struct{ ID, UserID, Name, OriginalUrl, Status, CreatedAt string }
    var out []Offer
    for rows.Next() {
        var o Offer
        var createdAt sql.NullTime
        if err := rows.Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &createdAt); err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "scan failed", map[string]string{"error": err.Error()}); return }
        if createdAt.Valid { o.CreatedAt = createdAt.Time.UTC().Format(time.RFC3339) }
        out = append(out, o)
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(out)
}
