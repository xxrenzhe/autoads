package main

import (
    "context"
    "database/sql"
    "log"
    "net/http"
    "github.com/xxrenzhe/autoads/services/offer/internal/domain"
    "github.com/xxrenzhe/autoads/services/offer/internal/auth"
    "github.com/xxrenzhe/autoads/services/offer/internal/config"
    "github.com/xxrenzhe/autoads/services/offer/internal/events"
    "github.com/xxrenzhe/autoads/services/offer/internal/handlers"
    "github.com/xxrenzhe/autoads/services/offer/internal/projectors"

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

    // Offer service PUBLISHES its own events (fallback to Noop if Pub/Sub not available)
    var (
        publisherPub events.Publisher = &events.NoopPublisher{}
        publisherCloser interface{ Close() } = nil
    )
    if pub, err := events.NewPubSubPublisher(ctx, cfg.ProjectID, cfg.PubSubTopicID); err != nil {
        log.Printf("WARN: Pub/Sub publisher unavailable: %v; falling back to NoopPublisher", err)
    } else {
        publisherPub = pub
        publisherCloser = pub
    }
    if publisherCloser != nil { defer publisherCloser.Close() }
	
	// Offer service also SUBSCRIBES to its own events to update its read model (projection)
	// In a production setup, this would be a separate Cloud Function.
	// Here, we simulate it in-process for simplicity.
	offerProjector := projectors.NewOfferProjector(db)
    if sub, err := events.NewPubSubSubscriber(ctx, cfg.ProjectID, cfg.PubSubTopicID, cfg.PubSubSubscriptionID); err != nil {
        log.Printf("WARN: Pub/Sub subscriber unavailable: %v; projections will not update in-process", err)
    } else {
        sub.On((domain.OfferCreatedEvent{}).EventType(), func(ctx context.Context, event events.DomainEvent) error {
            if specificEvent, ok := event.(domain.OfferCreatedEvent); ok {
                return offerProjector.HandleOfferCreated(ctx, specificEvent)
            }
            return nil
        })
        sub.Start(ctx)
    }


	log.Println("Starting Offer service...")

	mux := http.NewServeMux()
    apiHandler := handlers.NewHandler(db, &events.LoggingMiddleware{Next: publisherPub})
	apiHandler.RegisterRoutes(mux, authClient.Middleware)

	log.Printf("Offer service listening on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
