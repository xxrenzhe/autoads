package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"github.com/xxrenzhe/autoads/services/workflow/internal/auth"
	"github.com/xxrenzhe/autoads/services/workflow/internal/domain"
	"github.com/xxrenzhe/autoads/services/workflow/internal/events"
	"time"

	"github.com/google/uuid"
)

// Handler holds dependencies for the HTTP handlers.
type Handler struct {
	DB        *sql.DB
	Publisher events.Publisher
	Templates []domain.WorkflowTemplate
}

// NewHandler creates a new Handler.
func NewHandler(db *sql.DB, publisher events.Publisher) *Handler {
	templates := loadWorkflowTemplates()
	return &Handler{DB: db, Publisher: publisher, Templates: templates}
}

// loadWorkflowTemplates loads workflow templates. In a real app, this would come from a DB or config file.
func loadWorkflowTemplates() []domain.WorkflowTemplate {
	return []domain.WorkflowTemplate{
		{
			ID:          "new-offer-launch",
			Name:        "New Offer Launch",
			Description: "A guided workflow to evaluate, optimize, and scale a new offer.",
		},
		{
			ID:          "campaign-optimization",
			Name:        "Campaign Optimization",
			Description: "Automatically analyze and optimize an existing Google Ads campaign.",
		},
	}
}


// RegisterRoutes registers the HTTP routes for the service.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
	mux.HandleFunc("/healthz", h.healthz)
	mux.HandleFunc("/api/v1/workflows/templates", h.getTemplatesHandler)
	mux.Handle("/api/v1/workflows", authMiddleware(http.HandlerFunc(h.workflowsHandler)))
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) getTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.Templates)
}

func (h *Handler) workflowsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.getUserWorkflows(w, r)
	case http.MethodPost:
		h.startWorkflow(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// startWorkflow validates the request and publishes a WorkflowStarted event.
func (h *Handler) startWorkflow(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	var req struct {
		TemplateID string `json:"templateId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	templateValid := false
	for _, t := range h.Templates {
		if t.ID == req.TemplateID {
			templateValid = true
			break
		}
	}
	if !templateValid {
		http.Error(w, "Invalid template ID", http.StatusBadRequest)
		return
	}

	event := domain.WorkflowStartedEvent{
		WorkflowID:  uuid.New().String(),
		UserID:      userID,
		TemplateID:  req.TemplateID,
		Status:      "in_progress",
		CurrentStep: 1,
		StartedAt:   time.Now(),
	}

	if err := h.Publisher.Publish(r.Context(), event); err != nil {
		log.Printf("Error publishing WorkflowStartedEvent: %v", err)
		http.Error(w, "Failed to process the request", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(event)
}

// getUserWorkflows retrieves the list of workflows for the authenticated user from the read model.
func (h *Handler) getUserWorkflows(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	// This logic remains the same as it's a read operation.
	// You would have a proper struct for this in a real app.
	rows, err := h.DB.QueryContext(r.Context(), `SELECT id, "templateId", status, "currentStep", "createdAt" FROM "UserWorkflowProgress" WHERE "userId" = $1`, userID)
	if err != nil {
		log.Printf("Error querying workflows: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var workflows []map[string]interface{}
	for rows.Next() {
		var id, templateId, status string
		var currentStep int
		var createdAt time.Time
		if err := rows.Scan(&id, &templateId, &status, &currentStep, &createdAt); err != nil {
			log.Printf("Error scanning workflow row: %v", err)
			continue
		}
		workflows = append(workflows, map[string]interface{}{
			"id": id,
			"templateId": templateId,
			"status": status,
			"currentStep": currentStep,
			"createdAt": createdAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(workflows)
}
