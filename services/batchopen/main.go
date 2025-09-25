package main

import (
    "context"
    "encoding/json"
    "log"
    "net/http"
    "os"
    "time"

    "github.com/google/uuid"
    "cloud.google.com/go/firestore"
    ev "github.com/xxrenzhe/autoads/pkg/events"
    "github.com/xxrenzhe/autoads/services/batchopen/internal/auth"
    "github.com/xxrenzhe/autoads/pkg/errors"
    "strings"
)

type createTaskRequest struct {
    OfferID          string                 `json:"offerId"`
    SimulationConfig map[string]interface{} `json:"simulationConfig"`
}

type createTaskResponse struct {
    TaskID    string    `json:"taskId"`
    Status    string    `json:"status"`
    CreatedAt time.Time `json:"createdAt"`
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    _ = json.NewEncoder(w).Encode(v)
}

func health(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK); _, _ = w.Write([]byte("OK")) }
func ready(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK); _, _ = w.Write([]byte("ready")) }

func createTaskHandler(pub *ev.Publisher) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
        return
    }
    uid, _ := r.Context().Value(auth.UserIDContextKey).(string)
    var req createTaskRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Invalid request body", nil)
        return
    }
    if req.OfferID == "" {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "offerId is required", nil)
        return
    }
    resp := createTaskResponse{
        TaskID:    uuid.New().String(),
        Status:    "queued",
        CreatedAt: time.Now(),
    }
    // Publish event (best-effort)
    if pub != nil {
        _ = pub.Publish(r.Context(), ev.EventBatchOpsTaskQueued, map[string]any{
            "taskId":   resp.TaskID,
            "offerId":  req.OfferID,
            "userId":   uid,
            "queuedAt": resp.CreatedAt.UTC().Format(time.RFC3339),
        }, ev.WithSource("batchopen"), ev.WithSubject(resp.TaskID))
    }
    // Firestore UI cache (best-effort)
    _ = writeTaskUI(r.Context(), uid, resp.TaskID, req.OfferID, resp.Status, resp.CreatedAt)
    writeJSON(w, http.StatusAccepted, resp)
  }
}

func main() {
    log.Println("Starting Batchopen service...")
    ctx := context.Background()
    authClient := auth.NewClient(ctx)
    mux := http.NewServeMux()
    mux.HandleFunc("/health", health)
    mux.HandleFunc("/readyz", ready)
    var pub *ev.Publisher
    if p, err := ev.NewPublisher(ctx); err == nil { pub = p; defer p.Close() }
    mux.Handle("/api/v1/batchopen/tasks", authClient.Middleware(createTaskHandler(pub)))

    port := os.Getenv("PORT")
    if port == "" { port = "8080" }
    log.Printf("Listening on port %s", port)
    if err := http.ListenAndServe(":"+port, mux); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}

func writeTaskUI(ctx context.Context, userID, taskID, offerID, status string, createdAt time.Time) error {
    if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" { return nil }
    projectID := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
    if projectID == "" { projectID = strings.TrimSpace(os.Getenv("PROJECT_ID")) }
    if projectID == "" || userID == "" || taskID == "" { return nil }
    cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond); defer cancel()
    cli, err := firestore.NewClient(cctx, projectID)
    if err != nil { return err }
    defer cli.Close()
    doc := map[string]any{"taskId": taskID, "offerId": offerID, "status": status, "createdAt": createdAt.UTC()}
    _, err = cli.Collection("users/"+userID+"/batchopen/tasks").Doc(taskID).Set(cctx, doc)
    return err
}
