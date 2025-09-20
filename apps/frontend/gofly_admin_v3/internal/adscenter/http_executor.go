package adscenter

import (
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "os"
    "strings"
    "time"
)

// HTTPExecutorClient 通过外部执行器解析联盟链接最终URL
// 约定执行器支持：
// - GET  {BASE}/resolve?url=...
//   返回: { classification: string, finalUrl?: string, finalUrlSuffix?: string, durationMs?: number, message?: string }
// 若 /resolve 不可用，则回退使用 POST {BASE}/visit { url }，仅用以探测连通性（不返回finalUrl）。
type HTTPExecutorClient struct {
    base       string
    httpClient *http.Client
}

func NewHTTPExecutorClient(base string) *HTTPExecutorClient {
    if base == "" {
        // 浏览器执行器（统一用 PUPPETEER_EXECUTOR_URL；默认由 entrypoint 启动本地 127.0.0.1:8081）
        base = os.Getenv("PUPPETEER_EXECUTOR_URL")
        if base == "" { base = "http://127.0.0.1:8081" }
    }
    return &HTTPExecutorClient{ base: strings.TrimRight(base, "/"), httpClient: &http.Client{ Timeout: 20 * time.Second } }
}

// ExtractFinalURL 实现 AdsPowerClientInterface 接口
func (c *HTTPExecutorClient) ExtractFinalURL(profileID, affiliateURL string, opts *ExtractionOptions) (*LinkExtractionResult, error) {
    if c.base == "" {
        return &LinkExtractionResult{ AffiliateURL: affiliateURL, Success: false, Classification: "config_error", Error: "executor base empty" }, nil
    }
    // 优先 /resolve
    params := url.Values{}
    params.Set("url", affiliateURL)
    if opts != nil {
        if country := strings.TrimSpace(opts.Country); country != "" { params.Set("country", country) }
        if proxy := strings.TrimSpace(opts.Proxy); proxy != "" { params.Set("proxy", proxy) }
        if opts.Referer != nil && *opts.Referer != "" { params.Set("referer", *opts.Referer) }
    }
    u := fmt.Sprintf("%s/resolve?%s", c.base, params.Encode())
    req, _ := http.NewRequest("GET", u, nil)
    resp, err := c.httpClient.Do(req)
    if err != nil {
        return &LinkExtractionResult{ AffiliateURL: affiliateURL, Success: false, Classification: "network_error", Error: err.Error() }, nil
    }
    defer resp.Body.Close()
    var body map[string]any
    if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
        return &LinkExtractionResult{ AffiliateURL: affiliateURL, Success: false, Classification: "upstream_error", Error: fmt.Sprintf("decode: %v", err) }, nil
    }
    cls, _ := body["classification"].(string)
    if resp.StatusCode >= 400 {
        if cls == "" { cls = "upstream_error" }
        return &LinkExtractionResult{ AffiliateURL: affiliateURL, Success: false, Classification: cls, Error: fmt.Sprintf("http %d", resp.StatusCode) }, nil
    }
    finalURL, _ := body["finalUrl"].(string)
    if finalURL == "" {
        // 无 finalUrl 认为失败
        if cls == "" { cls = "upstream_error" }
        return &LinkExtractionResult{ AffiliateURL: affiliateURL, Success: false, Classification: cls, Error: "empty finalUrl" }, nil
    }
    return &LinkExtractionResult{ AffiliateURL: affiliateURL, FinalURL: finalURL, Success: true, Classification: ifEmpty(cls, "success") }, nil
}

func (c *HTTPExecutorClient) TestConnection() error {
    // 调用 /health
    u := fmt.Sprintf("%s/health", c.base)
    req, _ := http.NewRequest("GET", u, nil)
    resp, err := c.httpClient.Do(req)
    if err != nil { return err }
    defer resp.Body.Close()
    if resp.StatusCode >= 400 { return fmt.Errorf("executor unhealthy: %d", resp.StatusCode) }
    return nil
}

func ifEmpty(s string, def string) string { if s == "" { return def }; return s }
