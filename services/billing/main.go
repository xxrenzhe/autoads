package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"services/billing/internal/auth"
	"services/billing/internal/config"
	"services/billing/internal/domain"
	"services/billing/internal/events"
	"services/billing/internal/projectors"

	"github.com/jackc/pgx/v5/pgxpool"
	// Import pq for the migration function
	_ "github.com/lib/pq"
)

func main() {
	ctx := context.Background()
	cfg, err := config.Load(ctx)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// --- Run Database Migrations ---
	log.Println("Running database migrations...")
	if err := runMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to run database migrations: %v", err)
	}

	dbpool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to create connection pool: %v", err)
	}
	defer dbpool.Close()

	// --- Eventing Setup ---
	// ... (rest of the main function is the same)
	if cfg.PubSubTopicID != "" {
		subscriber, err := events.NewPubSubSubscriber(ctx, cfg.ProjectID, cfg.PubSubTopicID, cfg.PubSubSubscriptionID)
		if err != nil {
			log.Fatalf("Failed to create PubSub subscriber: %v", err)
		}

		subscriptionProjector := projectors.NewSubscriptionProjector(dbpool)
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

	authClient := auth.NewClient(ctx)
	apiHandler := NewHandler(dbpool)
	mux := http.NewServeMux()
	apiHandler.RegisterRoutes(mux, authClient.Middleware)

	log.Printf("Billing service HTTP server listening on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

// runMigrations connects to the DB and applies all .sql files from a directory.
func runMigrations(databaseURL string) error {
	// The pq driver is needed for database/sql to connect to Postgres.
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		return err
	}

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	// Defer a rollback in case of panic or error
	defer tx.Rollback()

	// Read all .sql files from the migrations directory
	migrationsDir := "internal/migrations"
	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			log.Printf("Applying migration: %s", file.Name())
			content, err := os.ReadFile(filepath.Join(migrationsDir, file.Name()))
			if err != nil {
				return err
			}

			// Split the content into individual statements
			statements := strings.Split(string(content), ";")
			for _, stmt := range statements {
				if strings.TrimSpace(stmt) != "" {
					if _, err := tx.Exec(stmt); err != nil {
						return err
					}
				}
			}
		}
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return err
	}

	log.Println("Database migrations applied successfully.")
	return nil
}


// --- HTTP Handler and Routes ---

type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{DB: db}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
	mux.HandleFunc("/healthz", h.healthz)
	mux.Handle("/api/v1/billing/subscriptions/me", authMiddleware(http.HandlerFunc(h.getSubscription)))
	mux.Handle("/api/v1/billing/tokens/me", authMiddleware(http.HandlerFunc(h.getTokenBalance)))
	mux.Handle("/api/v1/billing/tokens/transactions", authMiddleware(http.HandlerFunc(h.getTokenTransactions)))
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// --- DTOs ---

type Subscription struct {
	ID               string    `json:"id"`
	PlanName         string    `json:"planName"`
	Status           string    `json:"status"`
	CurrentPeriodEnd time.Time `json:"currentPeriodEnd"`
}

type TokenBalance struct {
	Balance   int64     `json:"balance"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type TokenTransaction struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Amount      int       `json:"amount"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

// --- Route Handlers ---

func (h *Handler) getSubscription(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Could not extract user ID from token", http.StatusInternalServerError)
		return
	}

	var sub Subscription
	err := h.DB.QueryRow(r.Context(), `SELECT id, "planName", status, "currentPeriodEnd" FROM "Subscription" WHERE "userId" = $1`, userID).Scan(&sub.ID, &sub.PlanName, &sub.Status, &sub.CurrentPeriodEnd)

	if err == sql.ErrNoRows {
		http.Error(w, "Subscription not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Error querying subscription: %v", err)
		http.Error(w, "Failed to retrieve subscription", http.StatusInternalServerError)
		return
	}

	respondWithJSON(w, http.StatusOK, sub)
}

func (h *Handler) getTokenBalance(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Could not extract user ID from token", http.StatusInternalServerError)
		return
	}

	var balance TokenBalance
	err := h.DB.QueryRow(r.Context(), `SELECT balance, "updatedAt" FROM "UserToken" WHERE "userId" = $1`, userID).Scan(&balance.Balance, &balance.UpdatedAt)
	if err != nil {
		log.Printf("Error querying token balance: %v", err)
		http.Error(w, "Failed to retrieve token balance", http.StatusNotFound)
		return
	}

	respondWithJSON(w, http.StatusOK, balance)
}

func (h *Handler) getTokenTransactions(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement pagination
	userID, ok := r.Context().Value(auth.UserIDContextKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Could not extract user ID from token", http.StatusInternalServerError)
		return
	}

	// Implementation for transaction history retrieval goes here.
	// For now, we'll return a placeholder.
	respondWithJSON(w, http.StatusOK, []TokenTransaction{})
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}
