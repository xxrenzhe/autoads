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

    return &Config{
        DatabaseURL:          databaseURL,
        Port:                 port,
        ProjectID:            projectID,
        PubSubTopicID:        os.Getenv("PUBSUB_TOPIC_ID"),
        PubSubSubscriptionID: os.Getenv("PUBSUB_SUBSCRIPTION_ID"),
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
