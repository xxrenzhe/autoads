package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/xxrenzhe/autoads/pkg/config"
	"github.com/xxrenzhe/autoads/pkg/eventbus"
	"github.com/xxrenzhe/autoads/pkg/logger"
	"github.com/xxrenzhe/autoads/pkg/middleware"
)

type Subscription struct {
	PlanID string `json:"planId"`
}

var (
	db        *sql.DB
	rdb       *redis.Client
	ctx       = context.Background()
	log       = logger.Get()
	publisher *eventbus.Publisher
)

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

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		log.Fatal().Msg("REDIS_URL is not set")
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Error parsing Redis URL")
	}
	rdb = redis.NewClient(opt)
	_, err = rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatal().Err(err).Msg("Error pinging Redis at startup")
	}
	log.Info().Msg("Successfully connected to Redis!")

	publisher = eventbus.NewPublisher(rdb)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthCheckHandler)

	createSubscriptionHandler := http.HandlerFunc(createSubscription)

	protectedRoutes := http.NewServeMux()
	protectedRoutes.Handle("/subscriptions", middleware.IdempotencyMiddleware(rdb, createSubscriptionHandler))
	protectedRoutes.HandleFunc("/tokens/balance", getTokenBalanceHandler)

	mux.Handle("/", middleware.AuthMiddleware(protectedRoutes))

	log.Info().Str("port", cfg.Server.Port).Msg("Billing service starting...")
	if err := http.ListenAndServe(":"+cfg.Server.Port, mux); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}

func createSubscription(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)

	var subReq Subscription
	if err := json.NewDecoder(r.Body).Decode(&subReq); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	subscriptionID := uuid.New().String()
	payload := map[string]interface{}{
		"subscriptionID": subscriptionID,
		"userID":         userID,
		"planID":         subReq.PlanID,
	}
	payloadJSON, _ := json.Marshal(payload)

	tx, err := db.Begin()
	if err != nil {
		log.Error().Err(err).Msg("Failed to begin transaction")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(
		`INSERT INTO "Event" (id, "aggregateId", "aggregateType", "eventType", payload, version) VALUES ($1, $2, $3, $4, $5, 1)`,
		uuid.New().String(), subscriptionID, "Subscription", "SubscriptionStarted", payloadJSON,
	)

	if err != nil {
		tx.Rollback()
		log.Error().Err(err).Msg("Failed to insert event")
		http.Error(w, "Failed to create subscription", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		log.Error().Err(err).Msg("Failed to commit transaction")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	publisher.Publish(ctx, "SubscriptionStarted", payload)

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"subscriptionID": subscriptionID})
}
func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	dbErr := db.Ping()
	redisErr := rdb.Ping(ctx).Err()
	if dbErr != nil || redisErr != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Health check failed:\n")
		if dbErr != nil {
			fmt.Fprintf(w, "  - Database error: %v\n", dbErr)
		}
		if redisErr != nil {
			fmt.Fprintf(w, "  - Redis error: %v\n", redisErr)
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}

func getTokenBalanceHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	log.Info().Str("userID", userID).Msg("User is checking token balance")

	balance := 1000
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"balance": balance})
}
