package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/xxrenzhe/autoads/services/billing/internal/pkg/database"
	"github.com/xxrenzhe/autoads/services/billing/internal/pkg/secrets"
)

// --- Data Structures ---

// OnboardingStep defines the structure of a single step in the onboarding checklist.
type OnboardingStep struct {
	ID           string `json:"id"`
	Step         int    `json:"step"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	TargetURL    string `json:"targetUrl"`
	RewardTokens int    `json:"rewardTokens"`
}

// UserChecklistProgress represents a user's completion of a step.
type UserChecklistProgress struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	StepID      string    `json:"stepId"`
	IsCompleted bool      `json:"isCompleted"`
	CompletedAt time.Time `json:"completedAt"`
}

// OnboardingStatusResponse is the combined data sent to the frontend.
type OnboardingStatusResponse struct {
	Steps         []OnboardingStep `json:"steps"`
	CompletedStepIDs []string         `json:"completedStepIds"`
}

// TokenBalance represents the user's token balance.
type TokenBalance struct {
	Balance int64 `json:"balance"`
}

// Server holds dependencies for the service.
type Server struct {
	db             *sql.DB
	onboardingSteps map[string]OnboardingStep // Use a map for quick lookups by ID
}

// newServer initializes the server and hardcodes the onboarding steps.
func newServer(db *sql.DB) *Server {
	steps := []OnboardingStep{
		{ID: "step_1_create_offer", Step: 1, Title: "Create Your First Offer", Description: "Offers are the core of your campaigns. Create one to get started.", TargetURL: "/offers", RewardTokens: 50},
		{ID: "step_2_start_workflow", Step: 2, Title: "Start a Workflow", Description: "Automate your tasks by starting your first workflow.", TargetURL: "/workflows", RewardTokens: 100},
		{ID: "step_3_explore_billing", Step: 3, Title: "Explore Billing", Description: "Check your token balance and subscription status.", TargetURL: "/billing", RewardTokens: 50},
	}
	
	stepMap := make(map[string]OnboardingStep)
	for _, step := range steps {
		stepMap[step.ID] = step
	}

	return &Server{db: db, onboardingSteps: stepMap}
}

// --- HTTP Handlers ---

func (s *Server) getOnboardingStatusHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	rows, err := s.db.Query(`SELECT step_id FROM "UserChecklistProgress" WHERE user_id = $1 AND is_completed = TRUE`, userID)
	if err != nil {
		log.Printf("Error querying user checklist progress: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	completedIDs := make(map[string]bool)
	for rows.Next() {
		var stepID string
		if err := rows.Scan(&stepID); err != nil {
			log.Printf("Error scanning completed step ID: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		completedIDs[stepID] = true
	}

	allSteps := make([]OnboardingStep, 0, len(s.onboardingSteps))
	completedStepIDs := make([]string, 0, len(completedIDs))
	for id, step := range s.onboardingSteps {
		allSteps = append(allSteps, step)
		if completedIDs[id] {
			completedStepIDs = append(completedStepIDs, id)
		}
	}


	response := OnboardingStatusResponse{
		Steps:         allSteps,
		CompletedStepIDs: completedStepIDs,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) completeStepHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	// Extract stepId from URL path, e.g., /onboarding/steps/{stepId}/complete
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid URL path, stepId is missing", http.StatusBadRequest)
		return
	}
	stepID := parts[3]

	step, ok := s.onboardingSteps[stepID]
	if !ok {
		http.Error(w, "Invalid step ID", http.StatusBadRequest)
		return
	}
	
	// --- Database Transaction ---
	ctx := context.Background()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	// Defer a rollback in case of panic or error
	defer tx.Rollback()

	// 1. Check if step is already completed
	var existingID string
	err = tx.QueryRowContext(ctx, `SELECT id FROM "UserChecklistProgress" WHERE user_id = $1 AND step_id = $2`, userID, stepID).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Error checking for existing progress: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if existingID != "" {
		http.Error(w, "Step already completed", http.StatusConflict) // 409 Conflict
		return
	}
	
	// 2. Add reward to user's token balance
	res, err := tx.ExecContext(ctx, `UPDATE "UserToken" SET balance = balance + $1 WHERE user_id = $2`, step.RewardTokens, userID)
    if err != nil {
        log.Printf("Error updating token balance: %v", err)
        http.Error(w, "Internal server error", http.StatusInternalServerError)
        return
    }
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		// If no user token record exists, create one
		_, err = tx.ExecContext(ctx, `INSERT INTO "UserToken" (user_id, balance, updated_at) VALUES ($1, $2, $3)`, userID, step.RewardTokens, time.Now())
		if err != nil {
			log.Printf("Error creating token balance record: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}


	// 3. Insert progress record
	progressID := uuid.New().String()
	_, err = tx.ExecContext(ctx, `INSERT INTO "UserChecklistProgress" (id, user_id, step_id, is_completed, completed_at) VALUES ($1, $2, $3, TRUE, $4)`,
		progressID, userID, stepID, time.Now())
	if err != nil {
		log.Printf("Error inserting progress record: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Error committing transaction: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	log.Printf("User %s completed step %s and earned %d tokens", userID, stepID, step.RewardTokens)
	w.WriteHeader(http.StatusNoContent) // 204 No Content is appropriate for a successful action with no body
}


func (s *Server) getTokenBalanceHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized: User ID is missing", http.StatusUnauthorized)
		return
	}

	var balance int64
	err := s.db.QueryRow(`SELECT balance FROM "UserToken" WHERE user_id = $1`, userID).Scan(&balance)
	if err != nil {
		if err == sql.ErrNoRows {
			balance = 0 // If no record, balance is 0
		} else {
			log.Printf("Error getting token balance: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(TokenBalance{Balance: balance})
}


func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Billing service is healthy!")
}

// --- Main Function ---

func main() {
	log.Println("Starting Billing service...")

	dbSecretName := os.Getenv("DB_SECRET_NAME")
	if dbSecretName == "" {
		log.Fatalf("DB_SECRET_NAME environment variable not set")
	}
	dsn, err := secrets.GetSecret(dbSecretName)
	if err != nil {
		log.Fatalf("Failed to get database secret: %v", err)
	}

	db, err := database.NewConnection(dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("Database connection successful.")

	server := newServer(db)

	// --- Routing ---
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/onboarding", server.getOnboardingStatusHandler)
	mux.HandleFunc("/onboarding/steps/", server.completeStepHandler) // Catches /onboarding/steps/{id}/complete
	mux.HandleFunc("/tokens/balance", server.getTokenBalanceHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Listening on port %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
