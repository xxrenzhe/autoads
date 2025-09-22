package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/xxrenzhe/autoads/services/console/internal/config"
	"github.com/xxrenzhe/autoads/services/console/internal/handlers"
	
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

	// In a real CQRS system, the console would use a command bus to send commands.
	// For simplicity here, we might pass the publisher directly or use service clients.
	// publisher, err := events.NewPubSubPublisher(ctx, cfg.ProjectID, cfg.PubSubTopicID)
	// if err != nil {
	// 	log.Fatalf("Failed to create PubSub publisher: %v", err)
	// }
	
	// The console service needs to be authenticated as an admin user.
	// This would typically involve a service account or a specific admin auth mechanism.
	// authClient := auth.NewAdminClient(ctx) 
	
	apiHandler := handlers.NewHandler(dbpool) // Publisher would be passed here
	
	mux := http.NewServeMux()
	// The middleware here should verify ADMIN role.
	apiHandler.RegisterRoutes(mux) // Admin middleware would be passed here

	log.Printf("Console service HTTP server listening on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, os.Getenv("PORT")); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
