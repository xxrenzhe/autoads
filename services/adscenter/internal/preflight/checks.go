package preflight

import (
    "context"
    "regexp"
    "time"
)

type Severity string

const (
    SevOK    Severity = "ok"
    SevWarn  Severity = "warn"
    SevError Severity = "error"
    SevSkip  Severity = "skip"
)

type Check struct {
    Code     string                 `json:"code"`
    Severity Severity               `json:"severity"`
    Message  string                 `json:"message"`
    Skipped  bool                   `json:"skipped,omitempty"`
    Details  map[string]interface{} `json:"details,omitempty"`
}

type Result struct {
    Summary string  `json:"summary"`
    Checks  []Check `json:"checks"`
}

type EnvInputs struct {
    DeveloperToken    string
    OAuthClientID     string
    OAuthClientSecret string
    RefreshToken      string
    LoginCustomerID   string
    TestCustomerID    string
    AccountID         string
}

type LiveClient interface {
    ListAccessibleCustomers(ctx context.Context) ([]string, error)
    // Future: ValidateOnly(ctx context.Context, inputs ...)
}

// Run executes preflight checks with optional live calls via client (may be nil).
func Run(ctx context.Context, in EnvInputs, liveEnabled bool, client LiveClient) Result {
    checks := make([]Check, 0, 8)
    add := func(c Check) { checks = append(checks, c) }

    // Basic env checks
    if in.DeveloperToken == "" { add(Check{Code:"env.developer_token", Severity:SevError, Message:"missing GOOGLE_ADS_DEVELOPER_TOKEN"}) } else { add(Check{Code:"env.developer_token", Severity:SevOK, Message:"present"}) }
    if in.OAuthClientID == "" { add(Check{Code:"env.oauth_client_id", Severity:SevError, Message:"missing GOOGLE_ADS_OAUTH_CLIENT_ID"}) } else { add(Check{Code:"env.oauth_client_id", Severity:SevOK, Message:"present"}) }
    if in.OAuthClientSecret == "" { add(Check{Code:"env.oauth_client_secret", Severity:SevError, Message:"missing GOOGLE_ADS_OAUTH_CLIENT_SECRET"}) } else { add(Check{Code:"env.oauth_client_secret", Severity:SevOK, Message:"present"}) }
    if in.LoginCustomerID == "" { add(Check{Code:"env.login_customer_id", Severity:SevError, Message:"missing GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC)"}) } else {
        if ok, _ := regexp.MatchString(`^[0-9]{10}$`, in.LoginCustomerID); !ok {
            add(Check{Code:"env.login_customer_id", Severity:SevWarn, Message:"format not 10-digit numeric"})
        } else { add(Check{Code:"env.login_customer_id", Severity:SevOK, Message:"present"}) }
    }
    if in.RefreshToken == "" { add(Check{Code:"env.refresh_token", Severity:SevWarn, Message:"missing GOOGLE_ADS_REFRESH_TOKEN (required for server-side calls)"}) } else { add(Check{Code:"env.refresh_token", Severity:SevOK, Message:"present"}) }
    if in.TestCustomerID != "" {
        if ok, _ := regexp.MatchString(`^[0-9]{10}$`, in.TestCustomerID); !ok { add(Check{Code:"env.test_customer_id", Severity:SevWarn, Message:"format not 10-digit numeric"}) } else { add(Check{Code:"env.test_customer_id", Severity:SevOK, Message:"present"}) }
    }
    if in.AccountID == "" { add(Check{Code:"request.account_id", Severity:SevWarn, Message:"accountId not provided in request"}) } else {
        if ok, _ := regexp.MatchString(`^[0-9]{10}$`, in.AccountID); !ok { add(Check{Code:"request.account_id", Severity:SevWarn, Message:"format not 10-digit numeric"}) } else { add(Check{Code:"request.account_id", Severity:SevOK, Message:"present"}) }
    }

    // Live checks
    if !liveEnabled || client == nil {
        add(Check{Code:"ads.accessible_customers", Severity:SevSkip, Message:"live check disabled", Skipped:true})
        add(Check{Code:"ads.validate_only", Severity:SevSkip, Message:"live check disabled", Skipped:true})
    } else {
        // Accessible customers (soft-fail)
        ctx1, cancel := context.WithTimeout(ctx, 2*time.Second)
        defer cancel()
        customers, err := client.ListAccessibleCustomers(ctx1)
        if err != nil {
            add(Check{Code:"ads.accessible_customers", Severity:SevWarn, Message:"failed to list accessible customers", Details: map[string]interface{}{"error": err.Error()}})
        } else {
            ok := len(customers) > 0
            add(Check{Code:"ads.accessible_customers", Severity: ternary(ok, SevOK, SevWarn), Message: ternary(ok, "ok", "empty list"), Details: map[string]interface{}{"count": len(customers)}})
        }
        // Validate-only placeholder (not implemented yet)
        add(Check{Code:"ads.validate_only", Severity:SevSkip, Message:"not implemented", Skipped:true})
    }

    // Summary
    summary := "ready"
    for _, c := range checks {
        if c.Severity == SevError { summary = "blocked"; break }
        if c.Severity == SevWarn && summary != "blocked" { summary = "degraded" }
    }
    return Result{Summary: summary, Checks: checks}
}

func ternary[T any](cond bool, a, b T) T { if cond { return a }; return b }

