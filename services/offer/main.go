package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"services/offer/internal/auth"
	"services/offer/internal/config"
	"services/offer/internal/events"
	"services/offer/internal/handlers"
	"services/offer/internal/projectors"

	_ "github.com/lib/pq"
)

func main() {
	ctx := context.Background()
	cfg, err := config.Load(ctx)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	authClient := auth.NewClient(ctx)

	// Offer service PUBLISHES its own events
	publisher, err := events.NewPubSubPublisher(ctx, cfg.ProjectID, cfg.PubSubTopicID)
	if err != nil {
		log.Fatalf("Failed to create pubsub publisher: %v", err)
	}
	defer publisher.Close()
	
	// Offer service also SUBSCRIBES to its own events to update its read model (projection)
	// In a production setup, this would be a separate Cloud Function.
	// Here, we simulate it in-process for simplicity.
	offerProjector := projectors.NewOfferProjector(db)
	subscriber, err := events.NewPubSubSubscriber(ctx, cfg.ProjectID, cfg.PubSubTopicID, cfg.PubSubSubscriptionID)
		if err != nil {
			log.Fatalf("Failed to create PubSub subscriber: %v", err)
		}
	subscriber.On((domain.OfferCreatedEvent{}).EventType(), func(ctx context.Context, event events.DomainEvent) error {
			if specificEvent, ok := event.(domain.OfferCreatedEvent); ok {
				return offerProjector.HandleOfferCreated(ctx, specificEvent)
			}
			return nil
		})
	subscriber.Start(ctx)


	log.Println("Starting Offer service...")

	mux := http.NewServeMux()
	apiHandler := handlers.NewHandler(db, &events.LoggingMiddleware{Next: publisher})
	apiHandler.RegisterRoutes(mux, authClient.Middleware)

	log.Printf("Offer service listening on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
