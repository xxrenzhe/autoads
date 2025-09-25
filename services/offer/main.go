package main

import (
    "context"
    "database/sql"
    "log"
    "net/http"
    "github.com/xxrenzhe/autoads/services/offer/internal/auth"
    "github.com/xxrenzhe/autoads/services/offer/internal/config"
    "github.com/xxrenzhe/autoads/services/offer/internal/events"
    "github.com/xxrenzhe/autoads/services/offer/internal/handlers"
    ev "github.com/xxrenzhe/autoads/pkg/events"

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

    // Offer service: publish via unified pkg/events. Projections由 notifications 服务负责。
    var publisherPub events.Publisher = &events.NoopPublisher{}
    if p, err := ev.NewPublisher(ctx); err != nil {
        log.Printf("WARN: pkg/events publisher unavailable: %v; falling back to NoopPublisher", err)
    } else {
        publisherPub = events.NewEVAdapter(p)
        defer p.Close()
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
