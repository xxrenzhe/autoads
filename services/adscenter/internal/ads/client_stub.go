package ads

import (
    "context"
    "strings"
)

// Client is the interface used by preflight to perform optional live checks.
type Client interface{
    ListAccessibleCustomers(ctx context.Context) ([]string, error)
    SendManagerLinkInvitation(ctx context.Context, clientCustomerID string) error
    GetManagerLinkStatus(ctx context.Context, clientCustomerID string) (string, error)
    RemoveManagerLink(ctx context.Context, clientCustomerID string) error
    KeywordIdeas(ctx context.Context, seedDomain string, seeds []string) ([]KeywordIdea, error)
}

// StubClient implements Client but returns not-available results.
type StubClient struct{}

func NewClientStub() *StubClient { return &StubClient{} }
func (c *StubClient) Close() error { return nil }

func (c *StubClient) ListAccessibleCustomers(ctx context.Context) ([]string, error) {
    return nil, nil
}

type LiveConfig struct {
    DeveloperToken   string
    OAuthClientID    string
    OAuthClientSecret string
    RefreshToken     string
    LoginCustomerID  string
}

func NewClient(ctx context.Context, cfg LiveConfig) (*StubClient, error) {
    return &StubClient{}, nil
}

func (c *StubClient) SendManagerLinkInvitation(ctx context.Context, clientCustomerID string) error { return nil }
func (c *StubClient) GetManagerLinkStatus(ctx context.Context, clientCustomerID string) (string, error) { return "pending", nil }
func (c *StubClient) RemoveManagerLink(ctx context.Context, clientCustomerID string) error { return nil }

// Additional methods to satisfy preflight.LiveClient
func (c *StubClient) AdsAPIPing(ctx context.Context) error { return nil }
func (c *StubClient) GetCampaignsCount(ctx context.Context, accountID string) (int, error) { return 0, nil }
func (c *StubClient) HasActiveConversionTracking(ctx context.Context, accountID string) (bool, error) { return false, nil }
func (c *StubClient) HasSufficientBudget(ctx context.Context, accountID string) (bool, error) { return false, nil }

type KeywordIdea struct { Text string; AvgMonthlySearches int; Competition string }

func (c *StubClient) KeywordIdeas(ctx context.Context, seedDomain string, seeds []string) ([]KeywordIdea, error) {
    // Simple stub: derive few ideas per seed
    base := []string{"best", "cheap", "buy", "review", "discount", "top", "near me"}
    out := make([]KeywordIdea, 0, len(seeds)*len(base))
    for _, s := range seeds {
        s = strings.TrimSpace(s)
        if s == "" { continue }
        for i, b := range base {
            k := strings.TrimSpace(s + " " + b)
            vol := 500 + (i+1)*700 // 1200, 1900, ...
            comp := "MEDIUM"
            if i%5 == 0 { comp = "LOW" }
            if i%7 == 0 { comp = "HIGH" }
            out = append(out, KeywordIdea{Text: k, AvgMonthlySearches: vol, Competition: comp})
        }
    }
    if len(out) == 0 && seedDomain != "" {
        // derive from domain
        parts := strings.Split(seedDomain, ".")
        if len(parts) > 0 {
            root := parts[0]
            for i, b := range base {
                k := root + " " + b
                vol := 800 + (i+1)*600
                comp := "MEDIUM"
                if i%3 == 0 { comp = "LOW" }
                if i%4 == 0 { comp = "HIGH" }
                out = append(out, KeywordIdea{Text: k, AvgMonthlySearches: vol, Competition: comp})
            }
        }
    }
    return out, nil
}
