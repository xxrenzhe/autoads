//go:build ads_live

package ads

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"

    "golang.org/x/oauth2"
    "golang.org/x/oauth2/google"
    "strings"
)

// Live client placeholder for future Google Ads SDK wiring.
// Intentionally avoids importing the SDK to keep builds lightweight.

type LiveConfig struct {
    DeveloperToken   string
    OAuthClientID    string
    OAuthClientSecret string
    RefreshToken     string
    LoginCustomerID  string
}

type LiveClient struct{
    http *http.Client
    devToken string
    loginCID string
    ts oauth2.TokenSource
}

func NewClient(ctx context.Context, cfg LiveConfig) (*LiveClient, error) {
    conf := &oauth2.Config{
        ClientID: cfg.OAuthClientID,
        ClientSecret: cfg.OAuthClientSecret,
        Endpoint: google.Endpoint,
        Scopes: []string{"https://www.googleapis.com/auth/adwords"},
    }
    ts := conf.TokenSource(ctx, &oauth2.Token{RefreshToken: cfg.RefreshToken})
    return &LiveClient{http: &http.Client{Timeout: 5 * time.Second}, devToken: cfg.DeveloperToken, loginCID: cfg.LoginCustomerID, ts: ts}, nil
}

func (c *LiveClient) Close() error { return nil }

func (c *LiveClient) authHeaders(ctx context.Context) (http.Header, error) {
    tok, err := c.ts.Token()
    if err != nil { return nil, err }
    h := http.Header{}
    h.Set("Authorization", "Bearer "+tok.AccessToken)
    h.Set("developer-token", c.devToken)
    if c.loginCID != "" { h.Set("login-customer-id", c.loginCID) }
    h.Set("Content-Type", "application/json")
    return h, nil
}

func (c *LiveClient) doJSON(ctx context.Context, method, url string, body any) ([]byte, int, error) {
    var br io.Reader
    if body != nil { b, _ := json.Marshal(body); br = bytes.NewReader(b) }
    req, _ := http.NewRequestWithContext(ctx, method, url, br)
    hdr, err := c.authHeaders(ctx)
    if err != nil { return nil, 0, err }
    req.Header = hdr
    resp, err := c.http.Do(req)
    if err != nil { return nil, 0, err }
    defer resp.Body.Close()
    data, _ := io.ReadAll(resp.Body)
    if resp.StatusCode >= 400 {
        return data, resp.StatusCode, fmt.Errorf("google ads http %d: %s", resp.StatusCode, string(data))
    }
    return data, resp.StatusCode, nil
}

func (c *LiveClient) ListAccessibleCustomers(ctx context.Context) ([]string, error) {
    url := "https://googleads.googleapis.com/v16/customers:listAccessibleCustomers"
    data, _, err := c.doJSON(ctx, http.MethodGet, url, nil)
    if err != nil { return nil, err }
    var resp struct{ ResourceNames []string `json:"resourceNames"` }
    _ = json.Unmarshal(data, &resp)
    return resp.ResourceNames, nil
}

func (c *LiveClient) SendManagerLinkInvitation(ctx context.Context, clientCustomerID string) error {
    // Create invitation from client perspective to link to manager (platform MCC)
    url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/customerManagerLinks:mutate", clientCustomerID)
    body := map[string]any{
        "operations": []any{
            map[string]any{
                "create": map[string]any{
                    "manager": fmt.Sprintf("customers/%s", c.loginCID),
                },
            },
        },
    }
    _, _, err := c.doJSON(ctx, http.MethodPost, url, body)
    return err
}

func (c *LiveClient) GetManagerLinkStatus(ctx context.Context, clientCustomerID string) (string, error) {
    // Query via GAQL: filter for platform MCC (loginCID)
    url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", clientCustomerID)
    q := "SELECT customer_manager_link.resource_name, customer_manager_link.status, customer_manager_link.manager_customer FROM customer_manager_link"
    body := map[string]any{"query": q}
    data, _, err := c.doJSON(ctx, http.MethodPost, url, body)
    if err != nil { return "", err }
    var arr []map[string]any
    _ = json.Unmarshal(data, &arr)
    for _, msg := range arr {
        if results, ok := msg["results"].([]any); ok {
            for _, it := range results {
                if m, ok := it.(map[string]any); ok {
                    if l, ok := m["customerManagerLink"].(map[string]any); ok {
                        if mgr, ok := l["managerCustomer"].(string); ok {
                            // mgr like "customers/1234567890"
                            if strings.HasSuffix(mgr, "/"+c.loginCID) {
                                if s, ok := l["status"].(string); ok { return s, nil }
                            }
                        }
                    }
                }
            }
        }
    }
    return "unknown", nil
}

func (c *LiveClient) RemoveManagerLink(ctx context.Context, clientCustomerID string) error {
    // Find resource name for manager link to platform MCC
    url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", clientCustomerID)
    q := "SELECT customer_manager_link.resource_name, customer_manager_link.status, customer_manager_link.manager_customer FROM customer_manager_link"
    body := map[string]any{"query": q}
    data, _, err := c.doJSON(ctx, http.MethodPost, url, body)
    if err != nil { return err }
    var resourceName string
    var arr []map[string]any
    _ = json.Unmarshal(data, &arr)
    for _, msg := range arr {
        if results, ok := msg["results"].([]any); ok {
            for _, it := range results {
                if m, ok := it.(map[string]any); ok {
                    if l, ok := m["customerManagerLink"].(map[string]any); ok {
                        if mgr, ok := l["managerCustomer"].(string); ok && strings.HasSuffix(mgr, "/"+c.loginCID) {
                            if rn, ok := l["resourceName"].(string); ok { resourceName = rn; break }
                        }
                    }
                }
            }
        }
    }
    if resourceName == "" { return fmt.Errorf("manager link resource not found") }
    // Update status to INACTIVE
    mutateURL := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/customerManagerLinks:mutate", clientCustomerID)
    upd := map[string]any{
        "resourceName": resourceName,
        "status": "INACTIVE",
    }
    req := map[string]any{
        "operations": []any{ map[string]any{ "update": upd, "updateMask": "status" } },
    }
    _, _, err = c.doJSON(ctx, http.MethodPost, mutateURL, req)
    return err
}
