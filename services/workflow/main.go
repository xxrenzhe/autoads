package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/xxrenzhe/autoads/services/workflow/internal/pkg/database"
	"github.com/xxrenzhe/autoads/services/workflow/internal/pkg/secrets"
)

// --- Data Structures ---

// WorkflowTemplate defines the structure of an available workflow.
type WorkflowTemplate struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	// Steps would be a more complex struct in a real scenario
}

// UserWorkflowProgress represents a user's progress in a specific workflow.
type UserWorkflowProgress struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	TemplateID  string    `json:"templateId"`
	CurrentStep int       `json:"currentStep"`
	Status      string    `json:"status"`
	Context     *string   `json:"context,omitempty"` // Using a pointer to handle nullable JSON
	CreatedAt   time.Time `json:"createdAt"`
}

// StartWorkflowRequest is the expected body for starting a new workflow.
type StartWorkflowRequest struct {
	TemplateID string `json:"templateId"`
}

// Server holds dependencies like the database connection.
type Server struct {
	db                *sql.DB
	workflowTemplates []WorkflowTemplate
}

// --- Hardcoded Data ---

// newServer initializes the server and hardcodes the workflow templates.
func newServer(db *sql.DB) *Server {
	templates := []WorkflowTemplate{
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
	return &Server{db: db, workflowTemplates: templates}
}

// --- HTTP Handlers ---

// templatesHandler returns the list of available workflow templates.
func (s *Server) templatesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.workflowTemplates)
}

// workflowsHandler routes and handles requests for user-specific workflows.
func (s *Server) workflowsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.getUserWorkflowsHandler(w, r)
	case http.MethodPost:
		s.startWorkflowHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// getUserWorkflowsHandler retrieves progress for a specific user.
func (s *Server) getUserWorkflowsHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	rows, err := s.db.Query(`SELECT id, user_id, template_id, current_step, status, context, created_at FROM "UserWorkflowProgress" WHERE user_id = $1`, userID)
	if err != nil {
		log.Printf("Error querying user workflows: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var progresses []UserWorkflowProgress
	for rows.Next() {
		var p UserWorkflowProgress
		if err := rows.Scan(&p.ID, &p.UserID, &p.TemplateID, &p.CurrentStep, &p.Status, &p.Context, &p.CreatedAt); err != nil {
			log.Printf("Error scanning workflow progress row: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		progresses = append(progresses, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(progresses)
}

// startWorkflowHandler creates a new workflow instance for a user.
func (s *Server) startWorkflowHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	var req StartWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate that the template exists
	templateValid := false
	for _, t := range s.workflowTemplates {
		if t.ID == req.TemplateID {
			templateValid = true
			break
		}
	}
	if !templateValid {
		http.Error(w, "Invalid template ID", http.StatusBadRequest)
		return
	}

	progress := UserWorkflowProgress{
		ID:          uuid.New().String(),
		UserID:      userID,
		TemplateID:  req.TemplateID,
		CurrentStep: 1, // Workflows start at step 1
		Status:      "in_progress",
		CreatedAt:   time.Now(),
	}

	query := `INSERT INTO "UserWorkflowProgress" (id, user_id, template_id, current_step, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := s.db.Exec(query, progress.ID, progress.UserID, progress.TemplateID, progress.CurrentStep, progress.Status, progress.CreatedAt)
	if err != nil {
		log.Printf("Error inserting new workflow progress: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	log.Printf("Started workflow %s for user %s", progress.TemplateID, progress.UserID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(progress)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Workflow service is healthy!")
}

// --- Main Function ---

func main() {
	log.Println("Starting Workflow service...")

	// 1. Get DSN from Secret Manager
	dbSecretName := os.Getenv("DB_SECRET_NAME")
	if dbSecretName == "" {
		log.Fatalf("DB_SECRET_NAME environment variable not set")
	}
	dsn, err := secrets.GetSecret(dbSecretName)
	if err != nil {
		log.Fatalf("Failed to get database secret: %v", err)
	}

	// 2. Initialize Database Connection
	db, err := database.NewConnection(dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("Database connection successful.")

	// 3. Create Server instance with dependencies
	server := newServer(db)

	// --- Routing ---
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/templates", server.templatesHandler)
	mux.HandleFunc("/workflows", server.workflowsHandler) // Handles GET /workflows and POST /workflows

	// --- Start Server ---
	port := os.Getenv("PORT")
	if port == "" {
		port = "8083" // Default port for workflow service
	}

	log.Printf("Listening on port %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
