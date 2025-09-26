package ratelimit

import (
    "context"
    "encoding/json"
    "net/http"
    "os"
    "strings"
    "time"
)

// ResolveUserPlan queries billing service for current user's plan name.
// Fallback: "Free" when unavailable.
func ResolveUserPlan(ctx context.Context, userID string) string {
    base := strings.TrimSpace(os.Getenv("BILLING_URL"))
    if base == "" || userID == "" { return "Free" }
    c := &http.Client{ Timeout: 2 * time.Second }
    req, _ := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(base, "/")+"/api/v1/billing/subscriptions/me", nil)
    req.Header.Set("X-User-Id", userID)
    resp, err := c.Do(req)
    if err != nil { return "Free" }
    defer resp.Body.Close()
    if resp.StatusCode != http.StatusOK { return "Free" }
    var out struct{ PlanName string `json:"planName"` }
    if json.NewDecoder(resp.Body).Decode(&out) != nil { return "Free" }
    if strings.TrimSpace(out.PlanName) == "" { return "Free" }
    return out.PlanName
}

