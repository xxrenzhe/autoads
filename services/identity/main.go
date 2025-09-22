package main

import (
	"context"
	"identity-service/internal/auth"
	"identity-service/internal/config"
	"identity-service/internal/domain"
	"identity-service/internal/events"
	"identity-service/internal/handlers"
	"identity-service/internal/projectors"
	"log"
	"net/http"

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

	// Ensure the super admin user exists and has the ADMIN role.
	ensureAdminExists(ctx, dbpool, cfg.SuperAdminEmail)

	// Initialize Firebase Auth client
	authClient := auth.NewClient(ctx)

	// --- Eventing Setup ---
	var publisher events.Publisher
	userProjector := projectors.NewUserProjector(dbpool)

	// Use Pub/Sub in production/staging, InMemoryBus for local dev
	if cfg.PubSubTopicID != "" {
		pubSubPublisher, err := events.NewPubSubPublisher(ctx, cfg.ProjectID, cfg.PubSubTopicID)
		if err != nil {
			log.Fatalf("Failed to create PubSub publisher: %v", err)
		}
		defer pubSubPublisher.Close()
		publisher = pubSubPublisher

		subscriber, err := events.NewPubSubSubscriber(ctx, cfg.ProjectID, cfg.PubSubTopicID, cfg.PubSubSubscriptionID)
		if err != nil {
			log.Fatalf("Failed to create PubSub subscriber: %v", err)
		}
		subscriber.On((domain.UserRegisteredEvent{}).EventType(), func(ctx context.Context, event events.DomainEvent) error {
			if specificEvent, ok := event.(domain.UserRegisteredEvent); ok {
				return userProjector.HandleUserRegistered(ctx, specificEvent)
			}
			return nil
		})
		subscriber.Start(ctx) // Starts listening in a goroutine

	} else {
		log.Println("Pub/Sub not configured, using InMemoryBus.")
		bus := events.NewInMemoryBus()
		bus.Subscribe((domain.UserRegisteredEvent{}).EventType(), func(ctx context.Context, event events.DomainEvent) error {
			if specificEvent, ok := event.(domain.UserRegisteredEvent); ok {
				return userProjector.HandleUserRegistered(ctx, specificEvent)
			}
			return nil
		})
		publisher = bus
	}

	log.Println("Starting identity service...")

	// Create a new ServeMux
	mux := http.NewServeMux()

	// Initialize handlers with all dependencies and register routes
	apiHandler := handlers.NewHandler(dbpool, authClient.Client, &events.LoggingMiddleware{Next: publisher})
	apiHandler.RegisterRoutes(mux, authClient.Middleware)

	log.Printf("Identity service listening on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// ensureAdminExists checks if the user with the specified email exists
// and promotes them to ADMIN if they don't have the role already.
func ensureAdminExists(ctx context.Context, db *pgxpool.Pool, adminEmail string) {
	if adminEmail == "" {
		log.Println("WARN: SUPER_ADMIN_EMAIL is not set. No admin user will be configured.")
		return
	}

	var role string
	err := db.QueryRow(ctx, `SELECT role FROM "User" WHERE email = $1`, adminEmail).Scan(&role)
	if err != nil {
		// This is not necessarily an error. The user might not exist yet,
		// which is fine. They will be created with the "USER" role on first login.
		log.Printf("INFO: Super admin user with email %s not found in the database. They will be promoted on next login if they register.", adminEmail)
		return
	}

	if role == "ADMIN" {
		log.Printf("INFO: Super admin user %s already has ADMIN role.", adminEmail)
		return
	}

	log.Printf("INFO: Promoting user %s to ADMIN role.", adminEmail)
	_, err = db.Exec(ctx, `UPDATE "User" SET role = 'ADMIN' WHERE email = $1`, adminEmail)
	if err != nil {
		log.Printf("ERROR: Failed to promote user %s to ADMIN: %v", adminEmail, err)
	}
}
