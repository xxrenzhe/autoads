package config

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config holds the application configuration.
type Config struct {
	DatabaseURL          string
	Port                 string
	ProjectID            string
	PubSubTopicID        string
	PubSubSubscriptionID string
}

// Load reads configuration from environment variables.
func Load(ctx context.Context) (*Config, error) {
	if os.Getenv("ENV") == "development" {
		_ = godotenv.Load()
	}

	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		log.Println("WARN: GOOGLE_CLOUD_PROJECT environment variable not set.")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set")
	}

	pubSubTopicID := os.Getenv("PUBSUB_TOPIC_ID")
	pubSubSubscriptionID := os.Getenv("PUBSUB_SUBSCRIPTION_ID")

	return &Config{
		DatabaseURL:          databaseURL,
		Port:                 port,
		ProjectID:            projectID,
		PubSubTopicID:        pubSubTopicID,
		PubSubSubscriptionID: pubSubSubscriptionID,
	}, nil
}
