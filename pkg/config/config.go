package config

import (
    "context"
    "fmt"
    "os"
    "strings"
    "sync"
    "time"

    secretmanager "cloud.google.com/go/secretmanager/apiv1"
    "cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
    "encoding/json"
)

// Simple environment-backed config with Secret Manager helper.

type Config struct {
    Stack     string // dev|preview|prod
    ProjectID string
}

var (
    once sync.Once
    cfg  Config
    secMu sync.RWMutex
    secCache = map[string]secretEntry{}
)

type secretEntry struct{ val string; exp time.Time }

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

// SecretForStack attempts to fetch a secret with stack suffix first, then falls back.
// Example: base="billing-pricing" and STACK=preview → tries
//   projects/<proj>/secrets/billing-pricing-preview/versions/latest
// then falls back to base name. When name is a full resource path, this function
// simply calls Secret without modification.
func SecretForStack(ctx context.Context, base string) (string, error) {
    if base == "" { return "", fmt.Errorf("empty base secret name") }
    // Full resource path – no stacking logic
    if strings.HasPrefix(base, "projects/") {
        return Secret(ctx, base)
    }
    st := Load().Stack
    proj := Load().ProjectID
    if proj == "" {
        return Secret(ctx, base) // let Secret error with context
    }
    if st != "" {
        // try <base>-<stack>
        stacked := fmt.Sprintf("projects/%s/secrets/%s-%s/versions/latest", proj, base, st)
        if v, err := Secret(ctx, stacked); err == nil && strings.TrimSpace(v) != "" {
            return v, nil
        }
    }
    // fallback to base (latest)
    return Secret(ctx, fmt.Sprintf("projects/%s/secrets/%s/versions/latest", proj, base))
}

// SecretCached fetches a secret and caches it in-memory for the given TTL.
// This provides a simple best-effort hot-reload: after TTL, the next call will re-fetch.
func SecretCached(ctx context.Context, name string, ttl time.Duration) (string, error) {
    key := name
    // normalize to full resource path for cache key
    if !strings.HasPrefix(name, "projects/") {
        version := "latest"
        base := name
        if parts := strings.SplitN(name, ":", 2); len(parts) == 2 { base, version = parts[0], parts[1] }
        proj := Load().ProjectID
        key = fmt.Sprintf("projects/%s/secrets/%s/versions/%s", proj, base, version)
    }
    now := time.Now()
    secMu.RLock()
    if e, ok := secCache[key]; ok && now.Before(e.exp) { val := e.val; secMu.RUnlock(); return val, nil }
    secMu.RUnlock()
    val, err := Secret(ctx, name)
    if err != nil { return "", err }
    secMu.Lock(); secCache[key] = secretEntry{val: val, exp: now.Add(ttl)}; secMu.Unlock()
    return val, nil
}

// JSONSecret loads a secret value and parses it as JSON into v (pointer to map/struct).
func JSONSecret(ctx context.Context, name string, v any) error {
    s, err := Secret(ctx, name)
    if err != nil { return err }
    return json.Unmarshal([]byte(s), v)
}

// Helpers to parse env values with defaults
func GetBool(key string, def bool) bool {
    v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
    switch v {
    case "1", "true", "yes", "on": return true
    case "0", "false", "no", "off": return false
    default: return def
    }
}
func GetInt(key string, def int) int {
    v := strings.TrimSpace(os.Getenv(key))
    if v == "" { return def }
    var n int
    _, err := fmt.Sscanf(v, "%d", &n)
    if err != nil { return def }
    return n
}
func GetDuration(key string, def time.Duration) time.Duration {
    v := strings.TrimSpace(os.Getenv(key))
    if v == "" { return def }
    if d, err := time.ParseDuration(v); err == nil { return d }
    return def
}
