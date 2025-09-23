package config

import (
    "context"
    "fmt"
    "log"
    "os"

    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
)

// Config holds the application configuration.
type Config struct {
    DatabaseURL          string
    Port                 string
    ProjectID            string
    PubSubTopicID        string
    PubSubSubscriptionID string
}

// Load reads configuration from environment variables or Secret Manager.
func Load(ctx context.Context) (*Config, error) {
    projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
    if projectID == "" {
        log.Println("WARN: GOOGLE_CLOUD_PROJECT environment variable not set.")
    }

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    env := os.Getenv("ENV")
    if env == "" { env = "production" }

    var databaseURL string
    if sec := os.Getenv("DATABASE_URL_SECRET_NAME"); sec != "" {
        s, err := accessSecretVersion(ctx, sec)
        if err != nil {
            return nil, fmt.Errorf("failed to access DATABASE_URL secret: %w", err)
        }
        databaseURL = s
    } else {
        databaseURL = os.Getenv("DATABASE_URL")
    }
    if databaseURL == "" {
        return nil, fmt.Errorf("DATABASE_URL is not set (or DATABASE_URL_SECRET_NAME missing)")
    }

    pubTopic := os.Getenv("PUBSUB_TOPIC_ID")
    subID := os.Getenv("PUBSUB_SUBSCRIPTION_ID")
    stack := os.Getenv("STACK")
    if env == "development" {
        if pubTopic == "" { pubTopic = "domain-events-dev" }
        if subID == "" { subID = "offer-sub-dev" }
    } else {
        if pubTopic == "" && stack != "" { pubTopic = "domain-events-" + stack }
        if subID == "" && stack != "" { subID = "offer-sub-" + stack }
        if pubTopic == "" { return nil, fmt.Errorf("PUBSUB_TOPIC_ID must be set (or provide STACK) in %s", env) }
        if subID == "" { return nil, fmt.Errorf("PUBSUB_SUBSCRIPTION_ID must be set (or provide STACK) in %s", env) }
    }
    return &Config{
        DatabaseURL:          databaseURL,
        Port:                 port,
        ProjectID:            projectID,
        PubSubTopicID:        pubTopic,
        PubSubSubscriptionID: subID,
    }, nil
}

func accessSecretVersion(ctx context.Context, name string) (string, error) {
    client, err := secretmanager.NewClient(ctx)
    if err != nil { return "", err }
    defer client.Close()
    res, err := client.AccessSecretVersion(ctx, &secretmanagerpb.AccessSecretVersionRequest{Name: name})
    if err != nil { return "", err }
    return string(res.Payload.Data), nil
}
