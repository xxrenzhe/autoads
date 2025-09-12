package siterankgo

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "os"
    "strconv"
    "strings"
    "sync"
    "time"
)

// SimilarWebClient SimilarWeb API客户端
type SimilarWebClient struct {
	baseURL     string
	httpClient  *http.Client
	rateLimiter *UserRateLimiter
	retryConfig *RetryConfig
}

// SimilarWebResponse SimilarWeb API响应结构
type SimilarWebResponse struct {
	GlobalRank      *int                    `json:"global_rank"`
	CategoryRank    *int                    `json:"category_rank"`
	Category        string                  `json:"category"`
	CountryRank     *int                    `json:"country_rank"`
	Country         string                  `json:"country"`
	Engagement      SimilarWebEngagement    `json:"engagement"`
	EngagementRate  float64                 `json:"engagement_rate"`
	Visits          interface{}             `json:"visits"` // 可能是float64或string
	PageViews       interface{}             `json:"page_views"`
	BounceRate      float64                 `json:"bounce_rate"`
	VisitDuration   float64                 `json:"visit_duration"`
	VisitsLastMonth interface{}             `json:"visits_last_month"`
	PagePerVisit    float64                 `json:"page_per_visit"`
	TrafficSources  map[string]float64      `json:"traffic_sources"`
	TopCountries    []SimilarWebCountryData `json:"top_countries"`
	RelatedSites    []string                `json:"related_sites"`
	Description     string                  `json:"description"`
	EstimatedValue  float64                 `json:"estimated_value"`
	AdRevenue       float64                 `json:"ad_revenue"`
	OrganicKeywords int                     `json:"organic_keywords"`
	PaidKeywords    int                     `json:"paid_keywords"`
	Backlinks       int                     `json:"backlinks"`
	ReferringIPs    int                     `json:"referring_ips"`
	Adult           bool                    `json:"adult"`
	LastUpdated     string                  `json:"last_updated"`
}

// SimilarWebEngagement 用户参与度数据
type SimilarWebEngagement struct {
	TimeOnSite float64 `json:"time_on_site"`
	PageViews  float64 `json:"page_views"`
	BounceRate float64 `json:"bounce_rate"`
	Visits     int     `json:"visits"`
}

// SimilarWebCountryData 国家数据
type SimilarWebCountryData struct {
	Country string  `json:"country"`
	Share   float64 `json:"share"`
	Visits  float64 `json:"visits"`
	Rank    int     `json:"rank"`
}

// SimilarWebRequest SimilarWeb请求参数
type SimilarWebRequest struct {
	Domain         string `json:"domain"`
	Country        string `json:"country,omitempty"`
	Granularity    string `json:"granularity,omitempty"` // daily, weekly, monthly
	MainDomainOnly bool   `json:"main_domain_only,omitempty"`
}

// RateLimiter 速率限制器
type RateLimiter struct {
	requestsPerMinute int
	requestsPerHour   int
	tokens            chan time.Time
	mu                sync.Mutex
	lastReset         time.Time
	hourlyCount       int
}

// UserRateLimiter 用户级别速率限制器
type UserRateLimiter struct {
	globalLimit *RateLimiter
	userLimits  map[string]*RateLimit
	mu          sync.RWMutex
}

// RateLimit 用户速率限制状态
type RateLimit struct {
	mu              sync.Mutex
	UserID          string
	MinuteRequests  int
	HourRequests    int
	LastMinuteReset time.Time
	LastHourReset   time.Time
	TokenBucket     chan time.Time
}

// RetryConfig 重试配置
type RetryConfig struct {
	MaxAttempts     int           `json:"max_attempts"`
	InitialDelay    time.Duration `json:"initial_delay"`
	MaxDelay        time.Duration `json:"max_delay"`
	BackoffFactor   float64       `json:"backoff_factor"`
	RetryableErrors []string      `json:"retryable_errors"`
}

// NewSimilarWebClient 创建SimilarWeb客户端
func NewSimilarWebClient() *SimilarWebClient {
	// 从环境变量获取API URL
	baseURL := os.Getenv("SIMILARWEB_API_URL")
	if baseURL == "" {
		baseURL = "https://data.similarweb.com/api/v1/data"
	}

	// 确保URL格式正确
	if !strings.HasSuffix(baseURL, "/") {
		baseURL += "/"
	}

	return &SimilarWebClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				MaxIdleConnsPerHost: 5,
				IdleConnTimeout:     30 * time.Second,
			},
		},
		rateLimiter: NewUserRateLimiter(5, 50, 20, 1000), // 每用户每分钟5个，每小时50个；全局每分钟20个，每小时1000个
		retryConfig: &RetryConfig{
			MaxAttempts:     5,
			InitialDelay:    1 * time.Second,
			MaxDelay:        30 * time.Second,
			BackoffFactor:   2.0,
			RetryableErrors: []string{"timeout", "network", "rate_limit", "server_error"},
		},
	}
}

// NewUserRateLimiter 创建用户级别速率限制器
func NewUserRateLimiter(userPerMinute, userPerHour, globalPerMinute, globalPerHour int) *UserRateLimiter {
	return &UserRateLimiter{
		globalLimit: NewRateLimiter(globalPerMinute, globalPerHour),
		userLimits:  make(map[string]*RateLimit),
	}
}

// NewRateLimiter 创建全局速率限制器
func NewRateLimiter(requestsPerMinute, requestsPerHour int) *RateLimiter {
	rl := &RateLimiter{
		requestsPerMinute: requestsPerMinute,
		requestsPerHour:   requestsPerHour,
		tokens:            make(chan time.Time, requestsPerMinute),
		lastReset:         time.Now(),
	}

	// 初始化令牌
	go rl.fillTokens()

	return rl
}

// fillTokens 填充令牌
func (rl *RateLimiter) fillTokens() {
	ticker := time.NewTicker(time.Minute / time.Duration(rl.requestsPerMinute))
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.mu.Lock()
			// 检查是否需要重置小时计数
			if time.Since(rl.lastReset) > time.Hour {
				rl.hourlyCount = 0
				rl.lastReset = time.Now()
			}
			rl.mu.Unlock()

			select {
			case rl.tokens <- time.Now():
				// 成功添加令牌
			default:
				// 令牌桶已满
			}
		}
	}
}

// Wait 等待可用令牌
func (rl *RateLimiter) Wait(ctx context.Context) error {
	select {
	case <-rl.tokens:
		rl.mu.Lock()
		rl.hourlyCount++
		if rl.hourlyCount >= rl.requestsPerHour {
			// 达到小时限制，等待到下一小时
			waitTime := time.Hour - time.Since(rl.lastReset)
			rl.mu.Unlock()
			select {
			case <-time.After(waitTime):
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		rl.mu.Unlock()
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(30 * time.Second):
		return fmt.Errorf("rate limit wait timeout")
	}
}

// WaitForUser 等待用户级别的速率限制
func (url *UserRateLimiter) WaitForUser(ctx context.Context, userID string) error {
	// 首先检查全局限制
	if err := url.globalLimit.Wait(ctx); err != nil {
		return fmt.Errorf("global rate limit exceeded: %w", err)
	}

	// 获取或创建用户限制
	url.mu.Lock()
	userLimit, exists := url.userLimits[userID]
	if !exists {
		userLimit = &RateLimit{
			UserID:          userID,
			MinuteRequests:  0,
			HourRequests:    0,
			LastMinuteReset: time.Now(),
			LastHourReset:   time.Now(),
			TokenBucket:     make(chan time.Time, 5), // 每分钟5个
		}
		url.userLimits[userID] = userLimit

		// 启动用户的令牌填充器
		go url.fillUserTokens(userID)
	}
	url.mu.Unlock()

	// 检查并重置计数器
	userLimit.mu.Lock()
	now := time.Now()

	// 重置分钟计数器
	if now.Sub(userLimit.LastMinuteReset) >= time.Minute {
		userLimit.MinuteRequests = 0
		userLimit.LastMinuteReset = now
	}

	// 重置小时计数器
	if now.Sub(userLimit.LastHourReset) >= time.Hour {
		userLimit.HourRequests = 0
		userLimit.LastHourReset = now
	}

	// 检查用户限制
	if userLimit.MinuteRequests >= 5 {
		userLimit.mu.Unlock()
		return fmt.Errorf("user rate limit exceeded: 5 requests per minute")
	}

	if userLimit.HourRequests >= 50 {
		userLimit.mu.Unlock()
		return fmt.Errorf("user rate limit exceeded: 50 requests per hour")
	}

	// 等待用户令牌
	select {
	case <-userLimit.TokenBucket:
		userLimit.MinuteRequests++
		userLimit.HourRequests++
		userLimit.mu.Unlock()
		return nil
	case <-ctx.Done():
		userLimit.mu.Unlock()
		return ctx.Err()
	case <-time.After(30 * time.Second):
		userLimit.mu.Unlock()
		return fmt.Errorf("user rate limit wait timeout")
	}
}

// fillUserTokens 为用户填充令牌
func (url *UserRateLimiter) fillUserTokens(userID string) {
	ticker := time.NewTicker(12 * time.Second) // 每分钟5个 = 每12秒一个
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			url.mu.RLock()
			userLimit, exists := url.userLimits[userID]
			url.mu.RUnlock()

			if !exists {
				return
			}

			select {
			case userLimit.TokenBucket <- time.Now():
				// 成功添加令牌
			default:
				// 令牌桶已满
			}
        }
    }
}

// GetUserRateLimitStats 获取用户速率限制统计
func (url *UserRateLimiter) GetUserRateLimitStats(userID string) map[string]interface{} {
	url.mu.RLock()
	defer url.mu.RUnlock()

	userLimit, exists := url.userLimits[userID]
	if !exists {
		return map[string]interface{}{
			"user_id":          userID,
			"minute_requests":  0,
			"hour_requests":    0,
			"minute_limit":     5,
			"hour_limit":       50,
			"tokens_available": 5,
		}
	}

	userLimit.mu.Lock()
	defer userLimit.mu.Unlock()

	return map[string]interface{}{
		"user_id":           userID,
		"minute_requests":   userLimit.MinuteRequests,
		"hour_requests":     userLimit.HourRequests,
		"minute_limit":      5,
		"hour_limit":        50,
		"tokens_available":  len(userLimit.TokenBucket),
		"last_minute_reset": userLimit.LastMinuteReset,
		"last_hour_reset":   userLimit.LastHourReset,
	}
}

// Cleanup 清理不活跃的用户限制
func (url *UserRateLimiter) Cleanup() {
	url.mu.Lock()
	defer url.mu.Unlock()

	// 清理超过1小时未活动的用户
	now := time.Now()
	for userID, limit := range url.userLimits {
		if now.Sub(limit.LastMinuteReset) > time.Hour {
			delete(url.userLimits, userID)
		}
	}
}

// GetWebsiteData 获取网站数据
func (c *SimilarWebClient) GetWebsiteData(ctx context.Context, userID string, req *SimilarWebRequest) (*SimilarWebResponse, error) {
	var lastErr error

	for attempt := 1; attempt <= c.retryConfig.MaxAttempts; attempt++ {
		// 等待速率限制
		if err := c.rateLimiter.WaitForUser(ctx, userID); err != nil {
			return nil, fmt.Errorf("rate limit error: %w", err)
		}

		// 构建请求URL
		apiURL, err := c.buildRequestURL(req)
		if err != nil {
			return nil, err
		}

		// 创建请求
		httpReq, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
		if err != nil {
			if attempt < c.retryConfig.MaxAttempts {
				time.Sleep(c.calculateDelay(attempt))
				continue
			}
			return nil, err
		}

		// 设置请求头
		c.setRequestHeaders(httpReq)

		// 发送请求
		resp, err := c.httpClient.Do(httpReq)
		if err != nil {
			lastErr = err
			if c.shouldRetry(err) && attempt < c.retryConfig.MaxAttempts {
				time.Sleep(c.calculateDelay(attempt))
				continue
			}
			return nil, err
		}
		defer resp.Body.Close()

		// 检查响应状态码
		if resp.StatusCode != http.StatusOK {
			body := make([]byte, 1024)
			resp.Body.Read(body)

			if resp.StatusCode == http.StatusTooManyRequests {
				// 触发速率限制，等待更长时间
				waitTime := time.Duration(attempt) * 10 * time.Second
				time.Sleep(waitTime)
				lastErr = fmt.Errorf("rate limited (attempt %d/%d): %s", attempt, c.retryConfig.MaxAttempts, string(body))
				continue
			}

			if resp.StatusCode >= 500 && attempt < c.retryConfig.MaxAttempts {
				// 服务器错误，重试
				time.Sleep(c.calculateDelay(attempt))
				lastErr = fmt.Errorf("server error %d: %s", resp.StatusCode, string(body))
				continue
			}

			return nil, fmt.Errorf("HTTP error %d: %s", resp.StatusCode, string(body))
		}

		// 解析响应
		var response SimilarWebResponse
		if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
			if attempt < c.retryConfig.MaxAttempts {
				time.Sleep(c.calculateDelay(attempt))
				lastErr = err
				continue
			}
			return nil, err
		}

		// 成功获取数据
		return &response, nil
	}

	return nil, fmt.Errorf("max retry attempts reached, last error: %v", lastErr)
}

// buildRequestURL 构建请求URL
func (c *SimilarWebClient) buildRequestURL(req *SimilarWebRequest) (string, error) {
	// 确保域名格式正确
	domain := strings.TrimPrefix(req.Domain, "http://")
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimSuffix(domain, "/")

	// 构建查询参数
	params := url.Values{}
	params.Add("domain", domain)

	if req.Country != "" {
		params.Add("country", req.Country)
	}

	if req.Granularity != "" {
		params.Add("granularity", req.Granularity)
	}

	if req.MainDomainOnly {
		params.Add("main_domain_only", "true")
	}

	// 构建完整URL
	return fmt.Sprintf("%s?%s", c.baseURL, params.Encode()), nil
}

// setRequestHeaders 设置请求头
func (c *SimilarWebClient) setRequestHeaders(req *http.Request) {
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Accept-Encoding", "gzip, deflate, br")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Pragma", "no-cache")
}

// shouldRetry 判断是否应该重试
func (c *SimilarWebClient) shouldRetry(err error) bool {
	errStr := strings.ToLower(err.Error())

	for _, retryableError := range c.retryConfig.RetryableErrors {
		if strings.Contains(errStr, retryableError) {
			return true
		}
	}

	// 检查是否是网络错误
	if strings.Contains(errStr, "timeout") ||
		strings.Contains(errStr, "connection") ||
		strings.Contains(errStr, "network") ||
		strings.Contains(errStr, "temporary") {
		return true
	}

	return false
}

// calculateDelay 计算重试延迟时间
func (c *SimilarWebClient) calculateDelay(attempt int) time.Duration {
	delay := time.Duration(float64(c.retryConfig.InitialDelay) *
		float64(attempt) * c.retryConfig.BackoffFactor)

	if delay > c.retryConfig.MaxDelay {
		delay = c.retryConfig.MaxDelay
	}

	// 添加随机抖动
	jitter := time.Duration(float64(delay) * 0.1 * (randFloat() - 0.5))
	return delay + jitter
}

// randFloat 生成随机浮点数
func randFloat() float64 {
	return float64(time.Now().UnixNano()%1000) / 1000.0
}

// GetRateLimitStats 获取速率限制统计
func (c *SimilarWebClient) GetRateLimitStats() map[string]interface{} {
	return map[string]interface{}{
		"type":              "user_based_rate_limiter",
		"global_per_minute": 20,
		"global_per_hour":   1000,
		"user_per_minute":   5,
		"user_per_hour":     50,
		"active_users":      len(c.rateLimiter.userLimits),
	}
}

// GetUserRateLimitStats 获取用户速率限制统计
func (c *SimilarWebClient) GetUserRateLimitStats(userID string) map[string]interface{} {
	return c.rateLimiter.GetUserRateLimitStats(userID)
}

// RateLimiter 返回内部的速率限制器（用于测试和监控）
func (c *SimilarWebClient) RateLimiter() interface{} {
	return c.rateLimiter
}

// BatchGetWebsiteData 批量获取网站数据
func (c *SimilarWebClient) BatchGetWebsiteData(ctx context.Context, userID string, domains []string) (map[string]*SimilarWebResponse, error) {
	results := make(map[string]*SimilarWebResponse)
	var mu sync.Mutex
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 5) // 限制并发数

	// 创建错误通道
	errChan := make(chan error, len(domains))

	for _, domain := range domains {
		wg.Add(1)
		go func(d string) {
			defer wg.Done()

			// 获取信号量
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			// 创建请求
			req := &SimilarWebRequest{
				Domain:      d,
				Country:     "global",
				Granularity: "monthly",
			}

			// 获取数据
			data, err := c.GetWebsiteData(ctx, userID, req)
			if err != nil {
				errChan <- fmt.Errorf("domain %s: %v", d, err)
				return
			}

			// 保存结果
			mu.Lock()
			results[d] = data
			mu.Unlock()
		}(domain)
	}

	// 等待所有请求完成
	wg.Wait()
	close(errChan)

	// 检查是否有错误
	var errors []error
	for err := range errChan {
		errors = append(errors, err)
	}

	if len(errors) > 0 && len(results) == 0 {
		return nil, fmt.Errorf("all requests failed, first error: %v", errors[0])
	}

	return results, nil
}

// ValidateDomain 验证域名格式
func (c *SimilarWebClient) ValidateDomain(domain string) bool {
	// 基本的域名验证
	if domain == "" {
		return false
	}

	// 移除协议前缀
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimPrefix(domain, "https://")

	// 移除路径和查询参数
	if idx := strings.Index(domain, "/"); idx != -1 {
		domain = domain[:idx]
	}

	// 验证域名格式
	parts := strings.Split(domain, ".")
	if len(parts) < 2 {
		return false
	}

	// 检查每个部分是否有效
	for _, part := range parts {
		if part == "" {
			return false
		}
	}

	return true
}

// FormatVisits 格式化访问量数据
func FormatVisits(visits interface{}) float64 {
	switch v := visits.(type) {
	case float64:
		return v
	case string:
		// 处理带有K、M、B后缀的字符串
		if len(v) == 0 {
			return 0
		}

		multiplier := 1.0
		if strings.HasSuffix(v, "K") {
			multiplier = 1000
			v = strings.TrimSuffix(v, "K")
		} else if strings.HasSuffix(v, "M") {
			multiplier = 1000000
			v = strings.TrimSuffix(v, "M")
		} else if strings.HasSuffix(v, "B") {
			multiplier = 1000000000
			v = strings.TrimSuffix(v, "B")
		}

		num, err := strconv.ParseFloat(v, 64)
		if err != nil {
			return 0
		}
		return num * multiplier
	default:
		return 0
	}
}

// FormatTrafficSources 格式化流量来源数据
func FormatTrafficSources(raw map[string]float64) map[string]float64 {
	if raw == nil {
		return make(map[string]float64)
	}

	// 确保总和为100%
	total := 0.0
	for _, value := range raw {
		total += value
	}

	if total > 0 {
		formatted := make(map[string]float64)
		for key, value := range raw {
			formatted[key] = (value / total) * 100
		}
		return formatted
	}

	return raw
}
