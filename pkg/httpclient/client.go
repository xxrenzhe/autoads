package httpclient

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
    "github.com/xxrenzhe/autoads/pkg/idempotency"
    "math"
)

// Client is a simple wrapper around http.Client.
type Client struct {
    httpClient *http.Client
}

// New creates a new Client with a default timeout.
func New(timeout time.Duration) *Client {
    return &Client{
        httpClient: &http.Client{
            Timeout: timeout,
        },
    }
}

// Do exposes underlying http.Client.Do for advanced use-cases.
func (c *Client) Do(req *http.Request) (*http.Response, error) {
    return c.httpClient.Do(req)
}

// GetJSON performs a GET request and decodes the JSON response into the target interface.
func (c *Client) GetJSON(ctx context.Context, url string, target interface{}) error {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return fmt.Errorf("failed to create request: %w", err)
    }

    req.Header.Set("Accept", "application/json")
    req.Header.Set("User-Agent", "AutoAds-HTTP-Client/1.0")
    // propagate idempotency key if available
    if k, ok := idempotency.FromContext(ctx); ok && k != "" {
        req.Header.Set("X-Idempotency-Key", k)
    }

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status code: %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		return fmt.Errorf("failed to decode json response: %w", err)
	}

	return nil
}

// GetJSONWithHeaders performs GET and decodes JSON with custom headers and simple retries.
// retries includes the first attempt, e.g., retries=3 means 1 + 2 retries on failure.
func (c *Client) GetJSONWithHeaders(ctx context.Context, url string, headers map[string]string, retries int, target interface{}) error {
    if retries <= 0 { retries = 1 }
    var lastErr error
    for attempt := 0; attempt < retries; attempt++ {
        req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
        if err != nil { return fmt.Errorf("failed to create request: %w", err) }
        // defaults
        req.Header.Set("Accept", "application/json")
        ua := "AutoAds-HTTP-Client/1.0"
        if hUA, ok := headers["User-Agent"]; ok && hUA != "" { ua = hUA }
        req.Header.Set("User-Agent", ua)
        // propagate idempotency key if available
        if k, ok := idempotency.FromContext(ctx); ok && k != "" { req.Header.Set("X-Idempotency-Key", k) }
        // apply extra headers
        for k, v := range headers { if k != "User-Agent" && v != "" { req.Header.Set(k, v) } }

        resp, err := c.httpClient.Do(req)
        if err != nil {
            lastErr = fmt.Errorf("request error: %w", err)
        } else {
            func() {
                defer resp.Body.Close()
                if resp.StatusCode != http.StatusOK {
                    lastErr = fmt.Errorf("bad status code: %d", resp.StatusCode)
                    return
                }
                if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
                    lastErr = fmt.Errorf("failed to decode json response: %w", err)
                    return
                }
                lastErr = nil
            }()
        }
        if lastErr == nil { return nil }
        if attempt+1 < retries {
            // exponential backoff with jitterless simple cap
            sleepMs := int(math.Min(1500, float64(200*int(math.Pow(2, float64(attempt))))))
            time.Sleep(time.Duration(sleepMs) * time.Millisecond)
        }
    }
    return lastErr
}
