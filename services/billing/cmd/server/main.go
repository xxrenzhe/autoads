
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
	"github.com/xxrenzhe/autoads/pkg/config"
	"github.com/xxrenzhe/autoads/pkg/errors"
	"github.com/xxrenzhe/autoads/pkg/logger"
	"github.com/xxrenzhe/autoads/pkg/middleware"
)

var (
	db  *sql.DB
	ctx = context.Background()
	log = logger.Get()
)

// TokenTransaction represents the structure for a single transaction record.
type TokenTransaction struct {
	ID            string    `json:"id"`
	Type          string    `json:"type"`
	Amount        int       `json:"amount"`
	Source        string    `json:"source"`
	Description   string    `json:"description"`
	CreatedAt     time.Time `json:"createdAt"`
}

// Subscription represents the structure for the user's current plan.
type Subscription struct {
	ID               string     `json:"id"`
	PlanName         string     `json:"planName"`
	Status           string     `json:"status"`
	TrialEndsAt      *time.Time `json:"trialEndsAt,omitempty"`
	CurrentPeriodEnd time.Time  `json:"currentPeriodEnd"`
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

	// Event subscriber is optional and not compiled in this build (build tags).

	// --- HTTP Server Setup ---
    mux := http.NewServeMux()
    mux.HandleFunc("/healthz", healthCheckHandler)
    mux.HandleFunc("/readyz", healthCheckHandler)

	// Define protected routes that require authentication.
	protectedRoutes := http.NewServeMux()
	protectedRoutes.HandleFunc("/tokens/balance", getTokenBalanceHandler)
	protectedRoutes.HandleFunc("/tokens/transactions", getTokenTransactionsHandler)
	protectedRoutes.HandleFunc("/subscription", getSubscriptionHandler) // New route

	// Apply auth middleware to protected routes.
	mux.Handle("/api/", http.StripPrefix("/api", middleware.AuthMiddleware(protectedRoutes)))

	log.Info().Str("port", cfg.Server.Port).Msg("Billing service starting...")
	if err := http.ListenAndServe(":"+cfg.Server.Port, mux); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	if err := db.Ping(); err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": err.Error()})
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}

func getTokenBalanceHandler(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(string)
    if !ok || userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "User ID not found in context", nil); return }

	var balance int64
	err := db.QueryRowContext(r.Context(), `SELECT balance FROM "UserToken" WHERE "userId" = $1`, userID).Scan(&balance)
	if err != nil {
		if err == sql.ErrNoRows {
			balance = 0
		} else {
			log.Error().Err(err).Str("userID", userID).Msg("Failed to query token balance")
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int64{"balance": balance})
}


func getTokenTransactionsHandler(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(string)
    if !ok || userID == "" { errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "User ID not found in context", nil); return }

	limit := r.URL.Query().Get("limit")
	if limit == "" {
		limit = "20"
	}
	offset := r.URL.Query().Get("offset")
	if offset == "" {
		offset = "0"
	}

	query := `
		SELECT id, type, amount, source, description, "createdAt"
		FROM "TokenTransaction"
		WHERE "userId" = $1
		ORDER BY "createdAt" DESC
		LIMIT $2 OFFSET $3
	`
    rows, err := db.QueryContext(r.Context(), query, userID, limit, offset)
    if err != nil { log.Error().Err(err).Str("userID", userID).Msg("Failed to query token transactions"); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil); return }
	defer rows.Close()

	var transactions []TokenTransaction
	for rows.Next() {
		var t TokenTransaction
        if err := rows.Scan(&t.ID, &t.Type, &t.Amount, &t.Source, &t.Description, &t.CreatedAt); err != nil { log.Error().Err(err).Str("userID", userID).Msg("Failed to scan transaction row"); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil); return }
		transactions = append(transactions, t)
	}

    if err := rows.Err(); err != nil { log.Error().Err(err).Str("userID", userID).Msg("Error during transaction rows iteration"); errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil); return }

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transactions)
}

func getSubscriptionHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized: User ID not found in context", http.StatusUnauthorized)
		return
	}

	var sub Subscription
	query := `
		SELECT id, "planName", status, "trialEndsAt", "currentPeriodEnd"
		FROM "Subscription"
		WHERE "userId" = $1
	`
    err := db.QueryRowContext(r.Context(), query, userID).Scan(
		&sub.ID, &sub.PlanName, &sub.Status, &sub.TrialEndsAt, &sub.CurrentPeriodEnd,
	)

	if err != nil {
        if err == sql.ErrNoRows { errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "Subscription not found", nil); return }
        log.Error().Err(err).Str("userID", userID).Msg("Failed to query subscription")
        errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
        return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sub)
}
