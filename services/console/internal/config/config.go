package config

import (
    "context"
    "fmt"
    "log"
    "os"

    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
)

// Config holds the application configuration for console service.
type Config struct {
    DatabaseURL string
    Port        string
    ProjectID   string
}

// Load reads configuration from environment variables and Secret Manager.
// Prefer Secret Manager when DATABASE_URL_SECRET_NAME is provided.
func Load(ctx context.Context) (*Config, error) {
    projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    var databaseURL string
    if secName := os.Getenv("DATABASE_URL_SECRET_NAME"); secName != "" {
        secret, err := accessSecretVersion(ctx, secName)
        if err != nil {
            return nil, fmt.Errorf("failed to read DATABASE_URL from Secret Manager: %w", err)
        }
        databaseURL = secret
    } else {
        // Fallback to environment for local dev.
        databaseURL = os.Getenv("DATABASE_URL")
    }
    if databaseURL == "" {
        return nil, fmt.Errorf("DATABASE_URL is not set (or DATABASE_URL_SECRET_NAME missing)")
    }

    return &Config{
        DatabaseURL: databaseURL,
        Port:        port,
        ProjectID:   projectID,
    }, nil
}

func accessSecretVersion(ctx context.Context, name string) (string, error) {
    client, err := secretmanager.NewClient(ctx)
    if err != nil {
        return "", fmt.Errorf("create secretmanager client: %w", err)
    }
    defer client.Close()

    req := &secretmanagerpb.AccessSecretVersionRequest{Name: name}
    result, err := client.AccessSecretVersion(ctx, req)
    if err != nil {
        return "", fmt.Errorf("access secret version: %w", err)
    }
    if len(result.Payload.Data) == 0 {
        log.Printf("WARN: secret %s payload is empty", name)
    }
    return string(result.Payload.Data), nil
}

