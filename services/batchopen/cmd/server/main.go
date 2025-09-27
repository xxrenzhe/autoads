package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/xxrenzhe/autoads/pkg/eventbus"
	"github.com/xxrenzhe/autoads/pkg/logger"
)

var (
	db  *sql.DB
	rdb *redis.Client
	ctx = context.Background()
	log = logger.Get()
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Warn().Msg("Error loading .env file")
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

	subscriber := eventbus.NewSubscriber(rdb)
	log.Info().Msg("Batchopen service starting...")
	subscriber.Subscribe(ctx, func(event eventbus.Event) {
		handleEvent(event)
	})
}

func handleEvent(event eventbus.Event) {
	switch event.Type {
	case "StartBatchopenTask":
		startBatchopenTask(event)
	default:
		log.Warn().Str("eventType", event.Type).Msg("No handler found for event type")
	}
}

func startBatchopenTask(event eventbus.Event) {
	payloadBytes, err := json.Marshal(event.Payload)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal payload for StartBatchopenTask event")
		return
	}

	var payload struct {
		OfferID string `json:"offerId"`
		UserID  string `json:"userId"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		log.Error().Err(err).Msg("Failed to unmarshal payload for StartBatchopenTask event")
		return
	}
	
	taskID := uuid.New().String()
	simulationConfig := map[string]interface{}{"clicks": 100, "duration": 60}
	simulationConfigJSON, _ := json.Marshal(simulationConfig)

	_, err = db.Exec(
		`INSERT INTO "BatchopenTask" (id, "userId", "offerId", "simulationConfig", status, "createdAt") VALUES ($1, $2, $3, $4, 'queued', NOW())`,
		taskID, payload.UserID, payload.OfferID, simulationConfigJSON,
	)

	if err != nil {
		log.Error().Err(err).Msg("Failed to create BatchopenTask")
	} else {
		log.Info().Str("taskID", taskID).Msg("BatchopenTask created")
		// In a real app, you would start the simulation here
	}
}
//go:build ignore
// +build ignore
