package secrets

import (
    "context"
    "fmt"
    "os"
    "strconv"
    "strings"
    "sync"
    "time"

    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
)

// simple in-process cache for Secret Manager results
var (
    cacheMu sync.RWMutex
    cache   = map[string]cacheEntry{}
)
type cacheEntry struct { val string; exp time.Time }

func ttl() time.Duration {
    if s := strings.TrimSpace(os.Getenv("SECRET_CACHE_TTL_MS")); s != "" {
        if n, err := strconv.Atoi(s); err == nil && n > 0 { return time.Duration(n) * time.Millisecond }
    }
    return 10 * time.Minute
}

// GetSecret retrieves a secret from Google Cloud Secret Manager.
// The name should be in the format: "projects/<project>/secrets/<name>/versions/latest".
func GetSecret(name string) (string, error) {
    if name == "" { return "", fmt.Errorf("secret name empty") }
    // try cache first
    cacheMu.RLock()
    if ent, ok := cache[name]; ok && time.Now().Before(ent.exp) {
        v := ent.val
        cacheMu.RUnlock()
        return v, nil
    }
    cacheMu.RUnlock()
    ctx := context.Background()
    client, err := secretmanager.NewClient(ctx)
    if err != nil {
        return "", fmt.Errorf("failed to create secretmanager client: %w", err)
    }
    defer client.Close()
    req := &secretmanagerpb.AccessSecretVersionRequest{Name: name}
    result, err := client.AccessSecretVersion(ctx, req)
    if err != nil {
        return "", fmt.Errorf("failed to access secret version: %w", err)
    }
    val := string(result.Payload.Data)
    cacheMu.Lock()
    cache[name] = cacheEntry{val: val, exp: time.Now().Add(ttl())}
    cacheMu.Unlock()
    return val, nil
}
