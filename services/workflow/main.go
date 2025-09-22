package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"services/workflow/internal/auth"
	"services/workflow/internal/config"
	"services/workflow/internal/domain"
	"services/workflow/internal/events"
	"services/workflow/internal/handlers"
	"services/workflow/internal/projectors"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx := context.Background()
	cfg, err := config.Load(ctx)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	dbpool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to create connection pool: %v", err)
	}
	defer dbpool.Close()

	publisher, err := events.NewPubSubPublisher(ctx, cfg.ProjectID, cfg.PubSubTopicID)
	if err != nil {
		log.Fatalf("Failed to create PubSub publisher: %v", err)
	}

	subscriber, err := events.NewPubSubSubscriber(ctx, cfg.ProjectID, cfg.PubSubSubscriptionID)
	if err != nil {
		log.Fatalf("Failed to create PubSub subscriber: %v", err)
	}

	// Setup Projectors and subscribe to events
	workflowProjector := projectors.NewWorkflowProjector(dbpool)
	subscriber.On((domain.WorkflowStartedEvent{}).EventType(), func(ctx context.Context, event events.DomainEvent) error {
		if specificEvent, ok := event.(domain.WorkflowStartedEvent); ok {
			return workflowProjector.HandleWorkflowStarted(ctx, specificEvent)
		}
		return nil
	})

	// Start listening for events in a background goroutine
	go subscriber.Start(ctx)

	// Setup HTTP server
	authClient := auth.NewClient(ctx)
	apiHandler := handlers.NewHandler(dbpool, publisher)
	
	mux := http.NewServeMux()
	apiHandler.RegisterRoutes(mux, authClient.Middleware)

	log.Printf("Workflow service HTTP server listening on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, os.Getenv("PORT")); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
