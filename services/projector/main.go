package main

import (
    "context"
    "database/sql"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "strings"
    "time"

    _ "github.com/lib/pq"
    "github.com/go-chi/chi/v5"
    apperr "github.com/xxrenzhe/autoads/pkg/errors"
    ev "github.com/xxrenzhe/autoads/pkg/events"
    "cloud.google.com/go/firestore"
)

type Projector struct {
    db *sql.DB
}

func ensureDDL(db *sql.DB) error {
    ddl := `
CREATE TABLE IF NOT EXISTS event_projection (
  event_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`
    _, err := db.Exec(ddl)
    return err
}

func (p *Projector) pushHandler(w http.ResponseWriter, r *http.Request) {
    // Pub/Sub push => { message: { data: base64 }, subscription: "..." }
    var body struct{
        Message struct{ Data string `json:"data"`; Attributes map[string]string `json:"attributes"` } `json:"message"`
        Subscription string `json:"subscription"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid push body", nil); return
    }
    raw, err := base64.StdEncoding.DecodeString(body.Message.Data)
    if err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid base64", nil); return }
    var env ev.Envelope
    if err := json.Unmarshal(raw, &env); err != nil { apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid event envelope", nil); return }
    // idempotency: insert into event_projection if not exists
    if p.db != nil {
        if err := ensureDDL(p.db); err == nil {
            _, _ = p.db.ExecContext(r.Context(), `INSERT INTO event_projection(event_id, event_name, aggregate_type, aggregate_id, processed_at) VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (event_id) DO NOTHING`, env.ID, env.Type, strings.TrimSpace(env.Source), env.Subject)
        }
    }
    // Firestore UI cache (optional): write recent events per user (if userId present in data)
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) == "1" {
        var userID string
        // attempt to extract userId from data (best-effort)
        var m map[string]any
        if b, err := json.Marshal(env.Data); err == nil {
            _ = json.Unmarshal(b, &m)
            if v, ok := m["userId"].(string); ok { userID = v }
        }
        pid := os.Getenv("GOOGLE_CLOUD_PROJECT")
        if pid == "" { pid = os.Getenv("PROJECT_ID") }
        if pid != "" && userID != "" {
            ctx, cancel := context.WithTimeout(r.Context(), 1500*time.Millisecond); defer cancel()
            if cli, err := firestore.NewClient(ctx, pid); err == nil {
                _, _ = cli.Collection(fmt.Sprintf("users/%s/events", userID)).NewDoc().Set(ctx, map[string]any{"id": env.ID, "type": env.Type, "source": env.Source, "subject": env.Subject, "time": env.Time, "data": env.Data})
                _ = cli.Close()
            }
        }
    }
    w.WriteHeader(http.StatusNoContent)
}

func health(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }

func main() {
    log.Println("Starting projector service...")
    dsn := os.Getenv("DATABASE_URL")
    var db *sql.DB
    var err error
    if dsn != "" {
        db, err = sql.Open("postgres", dsn)
        if err != nil { log.Fatalf("db open: %v", err) }
        if err := db.Ping(); err != nil { log.Fatalf("db ping: %v", err) }
        if err := ensureDDL(db); err != nil { log.Printf("ensure ddl: %v", err) }
    }
    p := &Projector{db: db}
    r := chi.NewRouter()
    r.Get("/health", health)
    r.Post("/push", p.pushHandler)
    port := os.Getenv("PORT"); if port == "" { port = "8080" }
    log.Printf("Listening on :%s", port)
    log.Fatal(http.ListenAndServe(":"+port, r))
}

