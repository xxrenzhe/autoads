package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"services/billing/internal/auth"
	"services/billing/internal/config"
	"services/billing/internal/domain"
	"services/billing/internal/events"
	"services/billing/internal/projectors"

	_ "github.com/lib/pq"
)

var db *sql.DB

func main() {
	ctx := context.Background()
	cfg, err := config.Load(ctx)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	db, err = sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("cannot connect to db: %v", err)
	}
	defer db.Close()

	// --- Eventing Setup ---
	if cfg.PubSubTopicID != "" {
		subscriber, err := events.NewPubSubSubscriber(ctx, cfg.ProjectID, cfg.PubSubTopicID, cfg.PubSubSubscriptionID)
		if err != nil {
			log.Fatalf("Failed to create PubSub subscriber: %v", err)
		}

		subscriptionProjector := projectors.NewSubscriptionProjector(db)
		subscriber.On((domain.UserRegisteredEvent{}).EventType(), func(ctx context.Context, event events.DomainEvent) error {
			if specificEvent, ok := event.(domain.UserRegisteredEvent); ok {
				return subscriptionProjector.HandleUserRegistered(ctx, specificEvent)
			}
			return nil
		})
		subscriber.Start(ctx) // Starts listening in a goroutine
	} else {
		log.Println("Pub/Sub not configured, subscriber not started.")
	}

	// --- Auth Setup ---
	authClient := auth.NewClient(ctx)

	// --- HTTP Server Setup ---
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthzHandler)

	// Protected routes
	mux.Handle("/api/v1/billing/subscriptions/me", authClient.Middleware(http.HandlerFunc(subscriptionHandler)))

	log.Printf("Billing service HTTP server listening on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func healthzHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

type Subscription struct {
	ID               string `json:"id"`
	PlanName         string `json:"planName"`
	Status           string `json:"status"`
	CurrentPeriodEnd string `json:"currentPeriodEnd"`
}

func subscriptionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Could not extract user ID from token", http.StatusInternalServerError)
		return
	}

	var sub Subscription
	err := db.QueryRowContext(r.Context(), `SELECT id, "planName", status, "currentPeriodEnd" FROM "Subscription" WHERE "userId" = $1`, userID).Scan(&sub.ID, &sub.PlanName, &sub.Status, &sub.CurrentPeriodEnd)

	if err == sql.ErrNoRows {
		http.Error(w, "Subscription not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Error querying subscription: %v", err)
		http.Error(w, "Failed to retrieve subscription", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(sub)
}
