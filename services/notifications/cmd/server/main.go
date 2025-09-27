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
    "github.com/go-chi/chi/v5"
    api "github.com/xxrenzhe/autoads/services/notifications/internal/oapi"
    tshim "github.com/xxrenzhe/autoads/services/notifications/internal/telemetryshim"
    "strings"
    "fmt"
    ev "github.com/xxrenzhe/autoads/pkg/events"
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
    if err := ensureDDL(db); err != nil { log.Warn().Err(err).Msg("ensure DDL failed") }

    r := chi.NewRouter()
    tshim.RegisterDefaultMetrics("notifications")
    r.Use(tshim.ChiMiddleware("notifications"))
    r.Use(middleware.LoggingMiddleware("notifications"))
    r.Handle("/metrics", tshim.MetricsHandler())
    r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    r.Get("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
        if err := db.Ping(); err != nil { errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": err.Error()}); return }
        w.WriteHeader(http.StatusOK)
    })

    // Plain route (fallback) + streaming + OpenAPI chi server
    r.With(middleware.AuthMiddleware).Get("/api/v1/notifications/recent", recentHandler)
    r.With(middleware.AuthMiddleware).Get("/api/v1/notifications/stream", sseNotifications)
    // Minimal event_store query for current user (3.1 部分落地)
    r.With(middleware.AuthMiddleware).Get("/api/v1/console/events", listEventsHandler)
    r.With(middleware.AuthMiddleware).Get("/api/v1/console/events/export", exportEventsHandler)
    r.With(middleware.AuthMiddleware).Get("/api/v1/console/events/types", listEventTypesHandler)
    
    // OpenAPI chi server
    oas := &oasImpl{}
    oapiHandler := api.HandlerWithOptions(oas, api.ChiServerOptions{
        BaseURL: "/",
        Middlewares: []api.MiddlewareFunc{
            func(next http.Handler) http.Handler { return middleware.IdempotencyMiddleware(next) },
            func(next http.Handler) http.Handler { return middleware.AuthMiddleware(next) },
        },
    })
    r.Mount("/", oapiHandler)

    // debug endpoints (opt-in)
    if os.Getenv("DEBUG") == "1" {
        r.HandleFunc("/api/v1/debug/offers", debugOffersHandler)
    }

    // Start subscriber (best-effort)
    if os.Getenv("GOOGLE_CLOUD_PROJECT") != "" && os.Getenv("PUBSUB_SUBSCRIPTION_ID") != "" {
        var pub *ev.Publisher
        if p, err := ev.NewPublisher(context.Background()); err == nil { pub = p } else { log.Warn().Err(err).Msg("notifications: publisher init failed; NotificationSent disabled") }
        sub, err := events.NewSubscriber(context.Background(), db, pub)
        if err != nil {
            log.Warn().Err(err).Msg("notifications: subscriber init failed")
        } else {
            sub.Start(context.Background())
        }
    }

    port := os.Getenv("PORT")
    if port == "" { port = "8080" }
    log.Info().Str("port", port).Msg("Notifications service starting...")
    if err := http.ListenAndServe(":"+port, r); err != nil {
        log.Fatal().Err(err).Msg("failed to start server")
    }
}

// oasImpl adapts generated server to reuse existing recentHandler.
type oasImpl struct{}
func (oas *oasImpl) ListRecentNotifications(w http.ResponseWriter, r *http.Request, params api.ListRecentNotificationsParams) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    // Delegate to existing recentHandler; params handled inside
    recentHandler(w, r)
}

// Implement OAS methods for read/unread-count
func (oas *oasImpl) MarkNotificationsRead(w http.ResponseWriter, r *http.Request) {
    markReadHandler(w, r)
}
func (oas *oasImpl) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
    unreadCountHandler(w, r)
}

// Rules endpoints (minimal): GET list, POST upsert
func (oas *oasImpl) ListNotificationRules(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    rows, err := db.Query(`SELECT id, event_type, channel, enabled, created_at, updated_at FROM notification_rules WHERE user_id=$1 ORDER BY id DESC`, uid)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type Rule struct{ ID int64 `json:"id"`; EventType, Channel string `json:"eventType","json:"channel"`; Enabled bool `json:"enabled"`; CreatedAt, UpdatedAt sql.NullTime }
    out := []map[string]any{}
    for rows.Next() {
        var id int64; var eventType, channel string; var enabled bool; var cAt, uAt sql.NullTime
        if err := rows.Scan(&id, &eventType, &channel, &enabled, &cAt, &uAt); err == nil {
            m := map[string]any{"id": fmt.Sprintf("%d", id), "eventType": eventType, "channel": channel, "enabled": enabled}
            if cAt.Valid { m["createdAt"] = cAt.Time.UTC().Format(time.RFC3339) }
            if uAt.Valid { m["updatedAt"] = uAt.Time.UTC().Format(time.RFC3339) }
            out = append(out, m)
        }
    }
    _ = json.NewEncoder(w).Encode(map[string]any{"items": out})
}

func (oas *oasImpl) UpsertNotificationRule(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    var body struct{ EventType, Channel string; Enabled bool }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    if strings.TrimSpace(body.EventType) == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "eventType required", nil); return }
    ch := strings.ToLower(strings.TrimSpace(body.Channel)); if ch == "" { ch = "inapp" }
    // ensure table
    _, _ = db.Exec(`CREATE TABLE IF NOT EXISTS notification_rules (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'inapp',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    // upsert (by user+event_type+channel)
    _, err := db.Exec(`INSERT INTO notification_rules(user_id,event_type,channel,enabled,created_at,updated_at)
        VALUES ($1,$2,$3,$4,NOW(),NOW())
        ON CONFLICT (user_id,event_type,channel) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=NOW()`, uid, body.EventType, ch, body.Enabled)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "upsert failed", map[string]string{"error": err.Error()}); return }
    _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
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

// listEventsHandler: GET /api/v1/console/events?limit=50
// 返回与当前用户相关的最近事件（基于 payload/metadata.userId 过滤，最小实现）
func listEventsHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
        return
    }
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    q := r.URL.Query()
    limit := 50
    if v := q.Get("limit"); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 { limit = n }
    }
    cursor := strings.TrimSpace(q.Get("cursor")) // id cursor: return id < cursor
    // support multiple types separated by comma
    evType := strings.TrimSpace(q.Get("type"))
    var evTypes []string
    if evType != "" {
        for _, t := range strings.Split(evType, ",") {
            t = strings.TrimSpace(t)
            if t != "" { evTypes = append(evTypes, t) }
        }
    }
    aggType := strings.TrimSpace(q.Get("aggregateType"))
    aggID := strings.TrimSpace(q.Get("aggregateId"))
    sinceStr := strings.TrimSpace(q.Get("since"))
    untilStr := strings.TrimSpace(q.Get("until"))

    // dynamic query builder
    where := []string{"(payload->>'userId' = $1 OR metadata->>'userId' = $1)"}
    args := []any{uid}
    idx := 2
    if len(evTypes) > 0 {
        placeholders := make([]string, 0, len(evTypes))
        for range evTypes { placeholders = append(placeholders, "$"+strconv.Itoa(idx)); idx++ }
        where = append(where, "event_name IN ("+strings.Join(placeholders, ",")+")")
        for _, t := range evTypes { args = append(args, t) }
    }
    if aggType != "" { where = append(where, "aggregate_type = $"+strconv.Itoa(idx)); args = append(args, aggType); idx++ }
    if aggID != "" { where = append(where, "aggregate_id = $"+strconv.Itoa(idx)); args = append(args, aggID); idx++ }
    if sinceStr != "" {
        if t, err := time.Parse(time.RFC3339, sinceStr); err == nil {
            where = append(where, "occurred_at >= $"+strconv.Itoa(idx)); args = append(args, t); idx++
        }
    }
    if untilStr != "" {
        if t, err := time.Parse(time.RFC3339, untilStr); err == nil {
            where = append(where, "occurred_at <= $"+strconv.Itoa(idx)); args = append(args, t); idx++
        }
    }
    if cursor != "" {
        if _, err := strconv.ParseInt(cursor, 10, 64); err == nil {
            where = append(where, "id < $"+strconv.Itoa(idx)); args = append(args, cursor); idx++
        }
    }
    query := "SELECT id, event_id, event_name, aggregate_type, aggregate_id, occurred_at FROM event_store WHERE " + strings.Join(where, " AND ") + " ORDER BY id DESC LIMIT $" + strconv.Itoa(idx)
    args = append(args, limit)
    rows, err := db.Query(query, args...)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type item struct {
        Id           int64  `json:"id"`
        EventId       string `json:"eventId"`
        EventName     string `json:"eventName"`
        AggregateType string `json:"aggregateType"`
        AggregateId   string `json:"aggregateId"`
        OccurredAt    string `json:"occurredAt"`
    }
    out := make([]item, 0, limit)
    var lastID int64
    for rows.Next() {
        var it item
        var t time.Time
        if err := rows.Scan(&it.Id, &it.EventId, &it.EventName, &it.AggregateType, &it.AggregateId, &t); err != nil {
            errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Scan failed", map[string]string{"error": err.Error()}); return
        }
        it.OccurredAt = t.UTC().Format(time.RFC3339)
        out = append(out, it)
        lastID = it.Id
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(struct{
        Items []item `json:"items"`
        Next  string `json:"next,omitempty"`
    }{Items: out, Next: func() string { if len(out) == limit { return strconv.FormatInt(lastID, 10) } ; return "" }()})
}

// exportEventsHandler: GET /api/v1/console/events/export?format=ndjson&limit=1000
// 简单导出：按当前用户过滤，支持同 list 的过滤参数，输出 NDJSON（默认）
func exportEventsHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
        return
    }
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }

    q := r.URL.Query()
    limit := 1000
    if v := q.Get("limit"); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 5000 { limit = n }
    }
    cursor := strings.TrimSpace(q.Get("cursor"))
    // type list support
    evType := strings.TrimSpace(q.Get("type"))
    var evTypes []string
    if evType != "" {
        for _, t := range strings.Split(evType, ",") {
            t = strings.TrimSpace(t)
            if t != "" { evTypes = append(evTypes, t) }
        }
    }
    aggType := strings.TrimSpace(q.Get("aggregateType"))
    aggID := strings.TrimSpace(q.Get("aggregateId"))
    sinceStr := strings.TrimSpace(q.Get("since"))
    untilStr := strings.TrimSpace(q.Get("until"))

    where := []string{"(payload->>'userId' = $1 OR metadata->>'userId' = $1)"}
    args := []any{uid}
    idx := 2
    if len(evTypes) > 0 {
        placeholders := make([]string, 0, len(evTypes))
        for range evTypes { placeholders = append(placeholders, "$"+strconv.Itoa(idx)); idx++ }
        where = append(where, "event_name IN ("+strings.Join(placeholders, ",")+")")
        for _, t := range evTypes { args = append(args, t) }
    }
    if aggType != "" { where = append(where, "aggregate_type = $"+strconv.Itoa(idx)); args = append(args, aggType); idx++ }
    if aggID != "" { where = append(where, "aggregate_id = $"+strconv.Itoa(idx)); args = append(args, aggID); idx++ }
    if sinceStr != "" {
        if t, err := time.Parse(time.RFC3339, sinceStr); err == nil { where = append(where, "occurred_at >= $"+strconv.Itoa(idx)); args = append(args, t); idx++ }
    }
    if untilStr != "" {
        if t, err := time.Parse(time.RFC3339, untilStr); err == nil { where = append(where, "occurred_at <= $"+strconv.Itoa(idx)); args = append(args, t); idx++ }
    }
    if cursor != "" {
        if _, err := strconv.ParseInt(cursor, 10, 64); err == nil { where = append(where, "id < $"+strconv.Itoa(idx)); args = append(args, cursor); idx++ }
    }
    query := "SELECT id, event_id, event_name, aggregate_type, aggregate_id, occurred_at, payload FROM event_store WHERE " + strings.Join(where, " AND ") + " ORDER BY id DESC LIMIT $" + strconv.Itoa(idx)
    args = append(args, limit)
    rows, err := db.Query(query, args...)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()

    format := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("format")))
    if format == "csv" {
        w.Header().Set("Content-Type", "text/csv; charset=utf-8")
        w.Header().Set("Content-Disposition", "attachment; filename=events.csv")
        // header
        _, _ = w.Write([]byte("id,eventId,eventName,aggregateType,aggregateId,occurredAt\n"))
        for rows.Next() {
            var id int64
            var eid, name, atype, aid string
            var t time.Time
            var payload json.RawMessage
            if err := rows.Scan(&id, &eid, &name, &atype, &aid, &t, &payload); err != nil { continue }
            line := strings.NewReplacer(
                ",", " ", "\n", " ", "\r", " ", "\t", " ",
            ).Replace(name)
            at := strings.NewReplacer(",", " ").Replace(atype)
            ai := strings.NewReplacer(",", " ").Replace(aid)
            _, _ = w.Write([]byte(
                strconv.FormatInt(id, 10) + "," + eid + "," + line + "," + at + "," + ai + "," + t.UTC().Format(time.RFC3339) + "\n",
            ))
        }
        return
    }

    // NDJSON default
    w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
    w.Header().Set("Content-Disposition", "attachment; filename=events.ndjson")
    enc := json.NewEncoder(w)
    type outItem struct {
        Id           int64       `json:"id"`
        EventId      string      `json:"eventId"`
        EventName    string      `json:"eventName"`
        AggregateType string     `json:"aggregateType"`
        AggregateId  string      `json:"aggregateId"`
        OccurredAt   string      `json:"occurredAt"`
        Payload      interface{} `json:"payload"`
    }
    for rows.Next() {
        var id int64
        var eid, name, atype, aid string
        var t time.Time
        var payload json.RawMessage
        if err := rows.Scan(&id, &eid, &name, &atype, &aid, &t, &payload); err != nil { continue }
        var p any
        _ = json.Unmarshal(payload, &p)
        _ = enc.Encode(outItem{Id: id, EventId: eid, EventName: name, AggregateType: atype, AggregateId: aid, OccurredAt: t.UTC().Format(time.RFC3339), Payload: p})
    }
}

// listEventTypesHandler: GET /api/v1/console/events/types
// 返回当前用户可见事件的类型及计数（最多 100 类）
func listEventTypesHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
        return
    }
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    rows, err := db.Query(`
        SELECT event_name, COUNT(1) AS cnt
        FROM event_store
        WHERE (payload->>'userId' = $1 OR metadata->>'userId' = $1)
        GROUP BY event_name
        ORDER BY cnt DESC
        LIMIT 100
    `, uid)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Query failed", map[string]string{"error": err.Error()}); return }
    defer rows.Close()
    type it struct{ Name string `json:"name"`; Count int64 `json:"count"` }
    out := make([]it, 0, 20)
    for rows.Next() {
        var name string
        var cnt int64
        if err := rows.Scan(&name, &cnt); err != nil { continue }
        out = append(out, it{Name: name, Count: cnt})
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(struct{ Items []it `json:"items"` }{Items: out})
}

// sseNotifications streams unread count and new notification tips for current user.
// Events:
//  - event: unread, data: { count }
//  - event: heartbeat, data: { t }
//  - event: new, data: { id, type, title, createdAt }
func sseNotifications(w http.ResponseWriter, r *http.Request) {
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    // SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache, no-transform")
    w.Header().Set("Connection", "keep-alive")
    fl, ok := w.(http.Flusher)
    if !ok { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "stream not supported", nil); return }

    // Compute initial last id and unread count
    var lastID int64
    _ = db.QueryRow(`SELECT COALESCE(MAX(id),0) FROM user_notifications WHERE user_id=$1`, uid).Scan(&lastID)
    var lastRead int64
    _ = db.QueryRow(`SELECT last_read_id FROM user_notification_state WHERE user_id=$1`, uid).Scan(&lastRead)
    unread := int64(0)
    _ = db.QueryRow(`SELECT COUNT(1) FROM user_notifications WHERE user_id=$1 AND id>$2`, uid, lastRead).Scan(&unread)
    // send initial unread
    fmt.Fprintf(w, "event: unread\n")
    fmt.Fprintf(w, "data: {\"count\": %d}\n\n", unread)
    fl.Flush()

    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()
    hb := time.NewTicker(25 * time.Second)
    defer hb.Stop()

    cn := r.Context().Done()
    for {
        select {
        case <-cn:
            return
        case <-ticker.C:
            var maxID int64
            _ = db.QueryRow(`SELECT COALESCE(MAX(id),0) FROM user_notifications WHERE user_id=$1`, uid).Scan(&maxID)
            if maxID > lastID {
                // Send summary of new notifications; include minimal payload keys for client-side correlation
                rows, err := db.Query(`SELECT id, type, title, message, created_at FROM user_notifications WHERE user_id=$1 AND id>$2 ORDER BY id ASC LIMIT 10`, uid, lastID)
                if err == nil {
                    defer rows.Close()
                    for rows.Next() {
                        var id int64; var typ, title, message string; var createdAt time.Time
                        if err := rows.Scan(&id, &typ, &title, &message, &createdAt); err == nil {
                            // minimal extraction: offerId, analysisId, step (if present in message JSON)
                            offerId := ""; analysisId := ""; step := ""
                            if message != "" {
                                var m map[string]any
                                if json.Unmarshal([]byte(message), &m) == nil {
                                    if data, ok := m["data"].(map[string]any); ok {
                                        if v, ok := data["offerId"].(string); ok { offerId = v }
                                        if v, ok := data["analysisId"].(string); ok { analysisId = v }
                                        if v, ok := data["step"].(string); ok { step = v }
                                        // sometimes nested under workflow fields
                                        if step == "" {
                                            if v, ok := data["name"].(string); ok { step = v }
                                        }
                                    }
                                }
                            }
                            fmt.Fprintf(w, "event: new\n")
                            // print minimal JSON; ensure proper escaping for title
                            fmt.Fprintf(w, "data: {\"id\":%d,\"type\":\"%s\",\"title\":%q,\"createdAt\":%q,\"offerId\":%q,\"analysisId\":%q,\"step\":%q}\n\n", id, typ, title, createdAt.UTC().Format(time.RFC3339), offerId, analysisId, step)
                            lastID = id
                        }
                    }
                    fl.Flush()
                }
            }
            // unread update
            _ = db.QueryRow(`SELECT last_read_id FROM user_notification_state WHERE user_id=$1`, uid).Scan(&lastRead)
            _ = db.QueryRow(`SELECT COUNT(1) FROM user_notifications WHERE user_id=$1 AND id>$2`, uid, lastRead).Scan(&unread)
            fmt.Fprintf(w, "event: unread\n")
            fmt.Fprintf(w, "data: {\"count\": %d}\n\n", unread)
            fl.Flush()
        case <-hb.C:
            fmt.Fprintf(w, ": keepalive\n\n")
            fl.Flush()
        }
    }
}

// ensureDDL creates minimal tables used by notifications service if missing.
func ensureDDL(db *sql.DB) error {
    stmts := []string{
        `CREATE TABLE IF NOT EXISTS user_notifications (
            id BIGSERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS ix_user_notifications_user_time ON user_notifications(user_id, id DESC)`,
        `CREATE TABLE IF NOT EXISTS user_notification_state (
            user_id TEXT PRIMARY KEY,
            last_read_id BIGINT NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
    }
    for _, s := range stmts {
        if _, err := db.Exec(s); err != nil { return err }
    }
    return nil
}

// markReadHandler: POST /api/v1/notifications/read { lastId: string }
func markReadHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    var body struct{ LastID string `json:"lastId"` }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil); return }
    if strings.TrimSpace(body.LastID) == "" { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "lastId required", nil); return }
    // convert to bigint
    var lastID int64
    if v, err := strconv.ParseInt(strings.TrimSpace(body.LastID), 10, 64); err == nil { lastID = v } else { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "lastId must be integer string", nil); return }
    // upsert state
    _, err := db.Exec(`INSERT INTO user_notification_state(user_id, last_read_id, updated_at) VALUES ($1,$2,NOW())
        ON CONFLICT (user_id) DO UPDATE SET last_read_id=EXCLUDED.last_read_id, updated_at=NOW()`, uid, lastID)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update state failed", map[string]string{"error": err.Error()}); return }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "lastId": lastID})
}

// unreadCountHandler: GET /api/v1/notifications/unread-count
func unreadCountHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    // get last_read_id
    var last int64
    _ = db.QueryRow(`SELECT last_read_id FROM user_notification_state WHERE user_id=$1`, uid).Scan(&last)
    // count newer
    var cnt int64
    _ = db.QueryRow(`SELECT COUNT(1) FROM user_notifications WHERE user_id=$1 AND id>$2`, uid, last).Scan(&cnt)
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"count": cnt, "lastReadId": last})
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
// DELETE /api/v1/notifications/{id}
func (oas *oasImpl) DeleteNotification(w http.ResponseWriter, r *http.Request, id string) {
    if r.Method != http.MethodDelete { errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil); return }
    uid, _ := r.Context().Value(middleware.UserIDKey).(string)
    if uid == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil); return }
    // id is SQL bigserial; accept string numeric
    if _, err := strconv.ParseInt(strings.TrimSpace(id), 10, 64); err != nil { errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id must be integer string", nil); return }
    res, err := db.Exec(`DELETE FROM user_notifications WHERE id=$1 AND user_id=$2`, id, uid)
    if err != nil { errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "delete failed", map[string]string{"error": err.Error()}); return }
    if n, _ := res.RowsAffected(); n == 0 { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "not found", nil); return }
    w.WriteHeader(http.StatusNoContent)
}
