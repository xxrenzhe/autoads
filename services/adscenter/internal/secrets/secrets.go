package secrets

import (
    "context"
    "fmt"

    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
)

// Get retrieves a secret value from Secret Manager by resource name
// e.g. projects/<PROJECT_ID>/secrets/NAME/versions/latest
func Get(ctx context.Context, name string) (string, error) {
    client, err := secretmanager.NewClient(ctx)
    if err != nil { return "", fmt.Errorf("secretmanager client: %w", err) }
    defer client.Close()
    res, err := client.AccessSecretVersion(ctx, &secretmanagerpb.AccessSecretVersionRequest{Name: name})
    if err != nil { return "", fmt.Errorf("access secret %s: %w", name, err) }
    return string(res.Payload.Data), nil
}

