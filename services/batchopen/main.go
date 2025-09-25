package main

import (
    "context"
    "encoding/json"
    "log"
    "net/http"
    "os"
    "time"

    "github.com/google/uuid"
    "github.com/xxrenzhe/autoads/services/batchopen/internal/auth"
    "github.com/xxrenzhe/autoads/pkg/errors"
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

func createTask(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
        return
    }
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
    writeJSON(w, http.StatusAccepted, resp)
}

func main() {
    log.Println("Starting Batchopen service...")
    ctx := context.Background()
    authClient := auth.NewClient(ctx)
    mux := http.NewServeMux()
    mux.HandleFunc("/health", health)
    mux.HandleFunc("/readyz", ready)
    mux.Handle("/api/v1/batchopen/tasks", authClient.Middleware(http.HandlerFunc(createTask)))

    port := os.Getenv("PORT")
    if port == "" { port = "8080" }
    log.Printf("Listening on port %s", port)
    if err := http.ListenAndServe(":"+port, mux); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}
