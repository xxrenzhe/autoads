package handlers

import (
    "encoding/json"
    "net/http"
    "time"

    "github.com/google/uuid"
    "github.com/xxrenzhe/autoads/services/workflow/internal/auth"
)

type MinimalHandler struct{}

func NewMinimalHandler() *MinimalHandler { return &MinimalHandler{} }

func (h *MinimalHandler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
    mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    mux.HandleFunc("/api/v1/workflows/templates", h.getTemplates)
    // Minimal list endpoint (auth required) for smoke tests
    mux.Handle("/api/v1/workflows", authMiddleware(http.HandlerFunc(h.list)))
    mux.Handle("/api/v1/workflows/start", authMiddleware(http.HandlerFunc(h.start)))
}

func (h *MinimalHandler) getTemplates(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    templates := []map[string]string{
        {"id": "new-offer-launch", "name": "New Offer Launch", "description": "Evaluate→Simulate→Scale"},
        {"id": "campaign-optimization", "name": "Campaign Optimization", "description": "Pre-flight and tune"},
    }
    _ = json.NewEncoder(w).Encode(templates)
}

func (h *MinimalHandler) start(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost { http.Error(w, "Method not allowed", http.StatusMethodNotAllowed); return }
    if _, ok := r.Context().Value(auth.UserIDContextKey).(string); !ok { http.Error(w, "Unauthorized", http.StatusUnauthorized); return }
    var req struct{ TemplateID string `json:"templateId"` }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TemplateID == "" { http.Error(w, "Invalid request body", http.StatusBadRequest); return }
    resp := map[string]interface{}{
        "workflow_instance_id": uuid.New().String(),
        "acceptedAt": time.Now(),
    }
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusAccepted)
    _ = json.NewEncoder(w).Encode(resp)
}

func (h *MinimalHandler) list(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { http.Error(w, "Method not allowed", http.StatusMethodNotAllowed); return }
    // Return empty list for now
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode([]map[string]any{})
}
