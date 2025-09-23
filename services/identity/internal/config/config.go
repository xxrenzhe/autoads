package config

import (
	"context"
	"fmt"
	"log"
	"os"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	"cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
	"github.com/joho/godotenv"
)

// Config holds the application configuration.
type Config struct {
	DatabaseURL          string
	Port                 string
	ProjectID            string
	PubSubTopicID        string
	PubSubSubscriptionID string
	SuperAdminEmail      string
}

// Load reads configuration from environment variables or Google Secret Manager.
func Load(ctx context.Context) (*Config, error) {
    // For local development, load .env file.
    // In production, these will be set in the Cloud Run environment.
    if os.Getenv("ENV") == "development" {
        _ = godotenv.Load()
    }
    env := os.Getenv("ENV")
    if env == "" { env = "production" }

	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		// This fallback is useful for local dev without GOOGLE_CLOUD_PROJECT set.
		// In production, this should always be available.
		log.Println("WARN: GOOGLE_CLOUD_PROJECT environment variable not set.")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// In a non-development environment, fetch the database URL from Secret Manager.
	var databaseURL string
	if os.Getenv("ENV") != "development" {
		dbSecretName := os.Getenv("DATABASE_URL_SECRET_NAME") // e.g., "projects/my-project/secrets/DATABASE_URL/versions/latest"
		if dbSecretName == "" {
			return nil, fmt.Errorf("DATABASE_URL_SECRET_NAME must be set in non-dev environments")
		}
		secret, err := accessSecretVersion(ctx, dbSecretName)
		if err != nil {
			return nil, fmt.Errorf("failed to access secret manager: %w", err)
		}
		databaseURL = secret
	} else {
		databaseURL = os.Getenv("DATABASE_URL")
	}

	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set")
	}

    pubSubTopicID := os.Getenv("PUBSUB_TOPIC_ID") // recommend: domain-events-<stack>
    pubSubSubscriptionID := os.Getenv("PUBSUB_SUBSCRIPTION_ID")
    stack := os.Getenv("STACK") // logical environment namespace within single GCP project
    if env == "development" {
        if pubSubTopicID == "" { pubSubTopicID = "domain-events-dev" }
        if pubSubSubscriptionID == "" { pubSubSubscriptionID = "identity-sub-dev" }
    } else {
        if pubSubTopicID == "" && stack != "" { pubSubTopicID = "domain-events-" + stack }
        if pubSubSubscriptionID == "" && stack != "" { pubSubSubscriptionID = "identity-sub-" + stack }
        if pubSubTopicID == "" { return nil, fmt.Errorf("PUBSUB_TOPIC_ID must be set (or provide STACK) in %s", env) }
        if pubSubSubscriptionID == "" { return nil, fmt.Errorf("PUBSUB_SUBSCRIPTION_ID must be set (or provide STACK) in %s", env) }
    }

	superAdminEmail := os.Getenv("SUPER_ADMIN_EMAIL")

    return &Config{
        DatabaseURL:          databaseURL,
        Port:                 port,
        ProjectID:            projectID,
        PubSubTopicID:        pubSubTopicID,
        PubSubSubscriptionID: pubSubSubscriptionID,
        SuperAdminEmail:      superAdminEmail,
    }, nil
}

// accessSecretVersion accesses a secret version from Google Cloud Secret Manager.
func accessSecretVersion(ctx context.Context, name string) (string, error) {
	client, err := secretmanager.NewClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create secretmanager client: %w", err)
	}
	defer client.Close()

	req := &secretmanagerpb.AccessSecretVersionRequest{
		Name: name,
	}

	result, err := client.AccessSecretVersion(ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to access secret version: %w", err)
	}

	return string(result.Payload.Data), nil
}
