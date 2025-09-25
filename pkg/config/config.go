package config

import (
    "context"
    "fmt"
    "os"
    "strings"
    "sync"

    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
)

// Simple environment-backed config with Secret Manager helper.

type Config struct {
    Stack     string // dev|preview|prod
    ProjectID string
}

var (
    once sync.Once
    cfg  Config
)

func Load() Config {
    once.Do(func() {
        stack := os.Getenv("STACK")
        if stack == "" {
            stack = "dev"
        }
        proj := os.Getenv("PROJECT_ID")
        if proj == "" {
            proj = os.Getenv("GOOGLE_CLOUD_PROJECT")
        }
        cfg = Config{Stack: stack, ProjectID: proj}
    })
    return cfg
}

// Get returns the environment variable or a default.
func Get(key, def string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return def
}

// MustGet returns the environment variable or panics.
func MustGet(key string) string {
    v := os.Getenv(key)
    if v == "" {
        panic(fmt.Sprintf("missing required env %s", key))
    }
    return v
}

// Secret fetches a secret value from Secret Manager.
// Accepts either a full resource name:
//   projects/<project>/secrets/<name>/versions/<ver>
// or a shorthand "<name>" (uses latest) or "<name>:<version>".
func Secret(ctx context.Context, name string) (string, error) {
    if name == "" {
        return "", fmt.Errorf("secret name is empty")
    }
    res := name
    if !strings.HasPrefix(name, "projects/") {
        // Build resource name from shorthand
        version := "latest"
        base := name
        if parts := strings.SplitN(name, ":", 2); len(parts) == 2 {
            base, version = parts[0], parts[1]
        }
        proj := Load().ProjectID
        if proj == "" {
            return "", fmt.Errorf("PROJECT_ID/GOOGLE_CLOUD_PROJECT not set for secret %s", name)
        }
        res = fmt.Sprintf("projects/%s/secrets/%s/versions/%s", proj, base, version)
    }
    client, err := secretmanager.NewClient(ctx)
    if err != nil {
        return "", fmt.Errorf("secretmanager client: %w", err)
    }
    defer client.Close()
    out, err := client.AccessSecretVersion(ctx, &secretmanagerpb.AccessSecretVersionRequest{Name: res})
    if err != nil {
        return "", fmt.Errorf("access secret %s: %w", res, err)
    }
    return string(out.Payload.Data), nil
}

