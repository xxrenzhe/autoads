// services/projector/cmd/server/main.go
package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/jackc/pgx/v4/pgxpool"
)

var ctx = context.Background()

type SiterankAnalysisCompletedEvent struct {
	OfferID       string    `json:"offer_id"`
	SiterankScore float64   `json:"siterank_score"`
	Timestamp     time.Time `json:"timestamp"`
}

func main() {
	// --- Database Connection ---
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://user:password@localhost:5432/autoads_db?sslmode=disable"
	}
	dbpool, err := pgxpool.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer dbpool.Close()
	log.Println("Successfully connected to PostgreSQL.")

	// --- Redis Connection ---
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Could not parse redis url: %v", err)
	}
	rdb := redis.NewClient(opt)
	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Fatalf("Could not connect to Redis: %v", err)
	}
	log.Println("Successfully connected to Redis.")

	// --- Subscribe to Events ---
	pubsub := rdb.Subscribe(ctx, "siterank-events")
	defer pubsub.Close()

	ch := pubsub.Channel()
	log.Println("Subscribed to 'siterank-events' channel. Waiting for messages...")

	// --- Event Processing Loop ---
	for msg := range ch {
		var event SiterankAnalysisCompletedEvent
		if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
			log.Printf("Error unmarshaling event: %v", err)

			continue
		}

		log.Printf("Received event: OfferID=%s, Score=%.2f", event.OfferID, event.SiterankScore)

		// Update the database (the read model)
		_, err := dbpool.Exec(ctx,
			"UPDATE \"Offer\" SET \"siterankScore\" = $1, status = 'optimizing' WHERE id = $2",
			event.SiterankScore, event.OfferID,
		)
		if err != nil {
			log.Printf("Error updating offer %s in database: %v", event.OfferID, err)
			continue
		}

		log.Printf("Successfully projected event for OfferID %s. Siterank score updated.", event.OfferID)
	}
}
