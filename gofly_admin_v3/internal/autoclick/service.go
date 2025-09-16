package autoclick

import (
    "context"
    "bytes"
    "encoding/json"
    "crypto/sha256"
    "encoding/hex"
    "net/http"
    "net/url"
    "time"

    "gofly-admin-v3/internal/store"
    "gofly-admin-v3/internal/user"
    "gofly-admin-v3/internal/system"
)

var tokenSvc *user.TokenService
var rateLimitProvider func(userID string) (rpm int, concurrent int)

// SetTokenService 由 main 在初始化后注入
func SetTokenService(ts *user.TokenService) { tokenSvc = ts }

// SetRateLimitProvider 注入外部速率限制提供者（按套餐）
// 返回 rpm（每分钟任务推进上限）与 concurrent（并发任务上限）
func SetRateLimitProvider(fn func(userID string) (rpm int, concurrent int)) { rateLimitProvider = fn }

func hashURL(u string) string {
    h := sha256.Sum256([]byte(u))
    return hex.EncodeToString(h[:])
}

// HTTP 执行器（最小实现）
type HTTPExecutor struct{}

type ExecOptions struct {
    Proxy string
    Referer string
    Timeout time.Duration
}

func (e *HTTPExecutor) Do(raw string, opt *ExecOptions) (bool, string, error) {
    client := &http.Client{ Timeout: 15 * time.Second }
    if opt != nil && opt.Timeout > 0 { client.Timeout = opt.Timeout }
    if opt != nil && opt.Proxy != "" {
        if purl, err := url.Parse(opt.Proxy); err == nil {
            tr := &http.Transport{ Proxy: http.ProxyURL(purl) }
            client.Transport = tr
        }
    }
    req, _ := http.NewRequest("GET", raw, nil)
    req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36")
    if opt != nil && opt.Referer != "" { req.Header.Set("Referer", opt.Referer) }
    resp, err := client.Do(req)
    if err != nil { return false, classifyNetworkError(err), err }
    defer resp.Body.Close()
    if resp.StatusCode >= 200 && resp.StatusCode < 400 { return true, "success", nil }
    if resp.StatusCode == 403 { return false, "403_blocked", nil }
    if resp.StatusCode == 429 { return false, "rate_limited", nil }
    return false, "http_" + resp.Status, nil
}

// Browser 执行器（占位实现）
type BrowserExecutor struct{}

func (e *BrowserExecutor) Do(raw string, opt *ExecOptions) (bool, string, error) {
    // 调用外部 Node 执行器（Next API 或独立服务）
    execURL := ""
    if v, ok := system.Get("AutoClick_Browser_Executor_URL"); ok && v != "" { execURL = v }
    if execURL == "" { execURL = GetEnv("AUTOCLICK_BROWSER_EXECUTOR_URL", "") }
    if execURL == "" {
        // Fallback 占位逻辑
        if time.Now().UnixNano()%10 < 8 { return true, "browser_success", nil }
        if time.Now().UnixNano()%2 == 0 { return false, "captcha_detected", nil }
        return false, "browser_failed", nil
    }
    payload := map[string]any{
        "url": raw,
        "proxy": opt.Proxy,
        "referer": opt.Referer,
        "waitUntil": "domcontentloaded",
        "timeoutMs": int(opt.Timeout / time.Millisecond),
    }
    b, _ := json.Marshal(payload)
    ctx, cancel := context.WithTimeout(context.Background(), opt.Timeout)
    defer cancel()
    req, _ := http.NewRequestWithContext(ctx, http.MethodPost, execURL, bytes.NewReader(b))
    req.Header.Set("content-type", "application/json")
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return false, "browser_error", err }
    defer resp.Body.Close()
    var out struct{ Ok bool `json:"ok"`; Classification string `json:"classification"`; HttpStatus int `json:"httpStatus"` }
    _ = json.NewDecoder(resp.Body).Decode(&out)
    if out.Ok { return true, "browser_success", nil }
    c := out.Classification
    if c == "" { c = "browser_failed" }
    return false, c, nil
}

// per-URL 失败计数与标记
func incrFail(key string, ttl time.Duration) int {
    r := store.GetRedis(); if r == nil { return 0 }
    ctx := context.Background()
    // INCR 并设置 TTL
    n, _ := r.GetClient().Incr(ctx, key).Result()
    _ = r.GetClient().Expire(ctx, key, ttl).Err()
    return int(n)
}

func getFlag(key string) bool {
    r := store.GetRedis(); if r == nil { return false }
    ctx := context.Background()
    v, err := r.Get(ctx, key)
    return err == nil && v != ""
}

func setFlag(key string, ttl time.Duration) {
    r := store.GetRedis(); if r == nil { return }
    ctx := context.Background()
    _ = r.GetClient().SetEX(ctx, key, "1", ttl).Err()
}

func classifyNetworkError(err error) string {
    s := strings.ToLower(err.Error())
    switch {
    case strings.Contains(s, "timeout") || strings.Contains(s, "deadline"):
        return "http_timeout"
    case strings.Contains(s, "proxy"):
        return "proxy_error"
    case strings.Contains(s, "tls") || strings.Contains(s, "certificate"):
        return "tls_error"
    default:
        return "http_error"
    }
}

func GetEnv(key, def string) string {
    if v := SystemGetEnv(key); v != "" { return v }
    return def
}

// decoupled for testing/mocking
var SystemGetEnv = func(key string) string { return "" }
