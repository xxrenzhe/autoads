package ads

import "context"

// Client is the interface used by preflight to perform optional live checks.
type Client interface{
    ListAccessibleCustomers(ctx context.Context) ([]string, error)
    SendManagerLinkInvitation(ctx context.Context, clientCustomerID string) error
    GetManagerLinkStatus(ctx context.Context, clientCustomerID string) (string, error)
    RemoveManagerLink(ctx context.Context, clientCustomerID string) error
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
