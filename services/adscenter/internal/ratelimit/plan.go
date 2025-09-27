package ratelimit

import (
    "context"
    "os"
    "strings"
    "time"
    httpx "github.com/xxrenzhe/autoads/pkg/http"
)

// ResolveUserPlan queries billing service for current user's plan name.
// Fallback: "Free" when unavailable.
func ResolveUserPlan(ctx context.Context, userID string) string {
    base := strings.TrimSpace(os.Getenv("BILLING_URL"))
    if base == "" || userID == "" { return "Free" }
    cli := httpx.New(2 * time.Second)
    hdr := map[string]string{"X-User-Id": userID}
    var out struct{ PlanName string `json:"planName"` }
    if err := cli.DoJSON(ctx, "GET", strings.TrimRight(base, "/")+"/api/v1/billing/subscriptions/me", nil, hdr, 1, &out); err != nil { return "Free" }
    if strings.TrimSpace(out.PlanName) == "" { return "Free" }
    return out.PlanName
}
