package main

import (
    "encoding/json"
    "context"
    "log"
    "net/http"
    "os"
    "regexp"

    "github.com/xxrenzhe/autoads/services/adscenter/internal/auth"
)

type PreflightRequest struct {
    AccountID string `json:"accountId"`
}

type PreflightCheck struct {
    Name   string `json:"name"`
    Status string `json:"status"` // ok, warn, error
    Detail string `json:"detail,omitempty"`
}

type PreflightResponse struct {
    Summary string          `json:"summary"`
    Checks  []PreflightCheck `json:"checks"`
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    _ = json.NewEncoder(w).Encode(v)
}

func accountsHandler(w http.ResponseWriter, r *http.Request) {
    // Placeholder: integrate Google Ads listing later
    writeJSON(w, http.StatusOK, map[string]interface{}{"items": []interface{}{}})
}

func preflightHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }
    var req PreflightRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    checks := make([]PreflightCheck, 0, 6)

    devToken := os.Getenv("GOOGLE_ADS_DEVELOPER_TOKEN")
    clientID := os.Getenv("GOOGLE_ADS_OAUTH_CLIENT_ID")
    clientSecret := os.Getenv("GOOGLE_ADS_OAUTH_CLIENT_SECRET")
    loginCID := os.Getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")
    testCID := os.Getenv("GOOGLE_ADS_TEST_CUSTOMER_ID")
    refresh := os.Getenv("GOOGLE_ADS_REFRESH_TOKEN")

    add := func(name, status, detail string) { checks = append(checks, PreflightCheck{Name: name, Status: status, Detail: detail}) }

    if devToken == "" { add("developer_token", "error", "missing GOOGLE_ADS_DEVELOPER_TOKEN") } else { add("developer_token", "ok", "present") }
    if clientID == "" { add("oauth_client_id", "error", "missing GOOGLE_ADS_OAUTH_CLIENT_ID") } else { add("oauth_client_id", "ok", "present") }
    if clientSecret == "" { add("oauth_client_secret", "error", "missing GOOGLE_ADS_OAUTH_CLIENT_SECRET") } else { add("oauth_client_secret", "ok", "present") }
    if loginCID == "" { add("login_customer_id", "error", "missing GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC)") } else {
        if ok, _ := regexp.MatchString(`^[0-9]{10}$`, loginCID); !ok { add("login_customer_id", "warn", "format not 10-digit numeric") } else { add("login_customer_id", "ok", "present") }
    }
    if refresh == "" { add("refresh_token", "warn", "missing GOOGLE_ADS_REFRESH_TOKEN (required for server-side calls)") } else { add("refresh_token", "ok", "present") }
    if testCID != "" {
        if ok, _ := regexp.MatchString(`^[0-9]{10}$`, testCID); !ok { add("test_customer_id", "warn", "format not 10-digit numeric") } else { add("test_customer_id", "ok", "present") }
    }
    if req.AccountID == "" {
        add("request.account_id", "warn", "accountId not provided in request")
    } else {
        if ok, _ := regexp.MatchString(`^[0-9]{10}$`, req.AccountID); !ok {
            add("request.account_id", "warn", "format not 10-digit numeric")
        } else {
            add("request.account_id", "ok", "present")
        }
    }

    // Summary
    summary := "ready"
    for _, c := range checks {
        if c.Status == "error" { summary = "blocked"; break }
        if c.Status == "warn" && summary != "blocked" { summary = "degraded" }
    }

    writeJSON(w, http.StatusOK, PreflightResponse{Summary: summary, Checks: checks})
}

func bulkActionsHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }
    writeJSON(w, http.StatusAccepted, map[string]string{"status": "queued"})
}

func main() {
    log.Println("Starting Adscenter service...")

    authClient := auth.NewClient(context.Background())
    mux := http.NewServeMux()
    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
    mux.Handle("/api/v1/adscenter/accounts", authClient.Middleware(http.HandlerFunc(accountsHandler)))
    mux.Handle("/api/v1/adscenter/preflight", authClient.Middleware(http.HandlerFunc(preflightHandler)))
    mux.Handle("/api/v1/adscenter/bulk-actions", authClient.Middleware(http.HandlerFunc(bulkActionsHandler)))

    port := os.Getenv("PORT")
    if port == "" { port = "8080" }
    log.Printf("Listening on port %s", port)
    if err := http.ListenAndServe(":"+port, mux); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}
