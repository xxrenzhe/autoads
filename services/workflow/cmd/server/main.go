
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"github.com/xxrenzhe/autoads/services/workflow/internal/events"
	"github.com/xxrenzhe/autoads/pkg/config"
	"github.com/xxrenzhe/autoads/pkg/logger"
	"github.com/xxrenzhe/autoads/pkg/middleware"
)

var (
	db  *sql.DB
	ctx = context.Background()
	log = logger.Get()
)

// WorkflowProgress represents the structure for a user's workflow.
type WorkflowProgress struct {
	ID          string          `json:"id"`
	TemplateID  string          `json:"templateId"`
	CurrentStep int             `json:"currentStep"`
	Status      string          `json:"status"`
	Context     json.RawMessage `json:"context"`
}


func main() {
	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		log.Fatal().Err(err).Msg("Error loading config")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal().Msg("DATABASE_URL is not set")
	}
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Error connecting to the database")
	}
	defer db.Close()
	err = db.Ping()
	if err != nil {
		log.Fatal().Err(err).Msg("Error pinging the database at startup")
	}
	log.Info().Msg("Successfully connected to the database!")

	// Initialize the Pub/Sub publisher.
	publisher, err := events.NewPublisher(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create event publisher")
	}
	defer publisher.Close()

	// Initialize the Pub/Sub subscriber, passing the publisher to it.
	subscriber, err := events.NewSubscriber(ctx, db, publisher)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create event subscriber")
	}

	// Start listening for events in a background goroutine.
	go subscriber.StartListening(ctx)

	// --- HTTP Server Setup ---
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthCheckHandler)

	protectedRoutes := http.NewServeMux()
	protectedRoutes.HandleFunc("/workflows", getWorkflowsHandler)

	mux.Handle("/api/", http.StripPrefix("/api", middleware.AuthMiddleware(protectedRoutes)))

	log.Info().Str("port", cfg.Server.Port).Msg("Workflow service starting...")
	if err := http.ListenAndServe(":"+cfg.Server.Port, mux); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	err := db.Ping()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Health check failed: Database error: %v\n", err)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}

func getWorkflowsHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)

	query := `
		SELECT id, "templateId", "currentStep", status, context
		FROM "UserWorkflowProgress"
		WHERE "userId" = $1
		ORDER BY "id" DESC
	`
	rows, err := db.QueryContext(r.Context(), query, userID)
	if err != nil {
		log.Error().Err(err).Str("userID", userID).Msg("Failed to query workflows")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var workflows []WorkflowProgress
	for rows.Next() {
		var wf WorkflowProgress
		if err := rows.Scan(&wf.ID, &wf.TemplateID, &wf.CurrentStep, &wf.Status, &wf.Context); err != nil {
			log.Error().Err(err).Str("userID", userID).Msg("Failed to scan workflow row")
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		workflows = append(workflows, wf)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(workflows)
}
