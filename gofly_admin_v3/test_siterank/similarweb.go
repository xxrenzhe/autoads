package siterank

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// SimilarWebClient SimilarWeb API客户端
type SimilarWebClient struct {
	config     *SimilarWebConfig
	httpClient *http.Client
	rateLimiter *RateLimiter
}

// RateLimiter 简单的速率限制器
type RateLimiter struct {
	requests    []time.Time
	maxRequests int
	window      time.Duration
}

// NewRateLimiter 创建速率限制器
func NewRateLimiter(maxRequests int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		requests:    make([]time.Time, 0),
		maxRequests: maxRequests,
		window:      window,
	}
}

// Allow 检查是否允许请求
func (rl *RateLimiter) Allow() bool {
	now := time.Now()
	
	// 清理过期的请求记录
	cutoff := now.Add(-rl.window)
	validRequests := make([]time.Time, 0)
	for _, req := range rl.requests {
		if req.After(cutoff) {
			validRequests = append(validRequests, req)
		}
	}
	rl.requests = validRequests
	
	// 检查是否超过限制
	if len(rl.requests) >= rl.maxRequests {
		return false
	}
	
	// 记录新请求
	rl.requests = append(rl.requests, now)
	return true
}

// Wait 等待直到可以发送请求
func (rl *RateLimiter) Wait() {
	for !rl.Allow() {
		time.Sleep(100 * time.Millisecond)
	}
}

// NewSimilarWebClient 创建SimilarWeb客户端
func NewSimilarWebClient(config *SimilarWebConfig) *SimilarWebClient {
	if config == nil {
		config = DefaultSimilarWebConfig()
	}
	
	return &SimilarWebClient{
		config: config,
		httpClient: &http.Client{
			Timeout: time.Duration(config.Timeout) * time.Second,
		},
		rateLimiter: NewRateLimiter(config.RateLimit, time.Hour),
	}
}

// GetDomainRank 获取域名排名信息
func (c *SimilarWebClient) GetDomainRank(domain, country string) (*SiteRankData, error) {
	// 速率限制
	c.rateLimiter.Wait()
	
	// 构建API URL
	apiURL := fmt.Sprintf("%s/website/%s/total-traffic-and-engagement/visits", c.config.BaseURL, domain)
	
	// 添加查询参数
	params := url.Values{}
	params.Add("api_key", c.config.APIKey)
	params.Add("start_date", "2024-01")
	params.Add("end_date", "2024-12")
	params.Add("granularity", "monthly")
	if country != "" {
		params.Add("country", country)
	}
	
	fullURL := fmt.Sprintf("%s?%s", apiURL, params.Encode())
	
	// 发送请求
	resp, err := c.makeRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}
	
	// 检查HTTP状态码
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API请求失败: %d - %s", resp.StatusCode, string(body))
	}
	
	// 解析响应
	var apiResponse SimilarWebAPIResponse
	if err := json.Unmarshal(body, &apiResponse); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}
	
	// 转换为标准格式
	return c.convertToSiteRankData(&apiResponse, domain), nil
}

// GetDomainInfo 获取域名基本信息
func (c *SimilarWebClient) GetDomainInfo(domain string) (*SiteRankData, error) {
	// 速率限制
	c.rateLimiter.Wait()
	
	// 构建API URL
	apiURL := fmt.Sprintf("%s/website/%s/general-data/overview", c.config.BaseURL, domain)
	
	// 添加查询参数
	params := url.Values{}
	params.Add("api_key", c.config.APIKey)
	
	fullURL := fmt.Sprintf("%s?%s", apiURL, params.Encode())
	
	// 发送请求
	resp, err := c.makeRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}
	
	// 检查HTTP状态码
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API请求失败: %d - %s", resp.StatusCode, string(body))
	}
	
	// 解析响应
	var apiResponse SimilarWebOverviewResponse
	if err := json.Unmarshal(body, &apiResponse); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}
	
	// 转换为标准格式
	return c.convertOverviewToSiteRankData(&apiResponse), nil
}

// makeRequest 发送HTTP请求
func (c *SimilarWebClient) makeRequest(method, url string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	
	// 设置请求头
	req.Header.Set("User-Agent", "AutoAds-SaaS/1.0")
	req.Header.Set("Accept", "application/json")
	
	// 发送请求
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("发送请求失败: %w", err)
	}
	
	return resp, nil
}

// convertToSiteRankData 转换API响应为标准格式
func (c *SimilarWebClient) convertToSiteRankData(apiResp *SimilarWebAPIResponse, domain string) *SiteRankData {
	data := &SiteRankData{}
	
	// 处理访问量数据
	if len(apiResp.Visits) > 0 {
		// 取最新月份的数据
		latestVisit := apiResp.Visits[len(apiResp.Visits)-1]
		data.Visits = &latestVisit.Visits
	}
	
	// 模拟其他数据（实际项目中需要调用相应的API）
	data.Category = "Unknown"
	data.Country = "world"
	
	return data
}

// convertOverviewToSiteRankData 转换概览数据为标准格式
func (c *SimilarWebClient) convertOverviewToSiteRankData(apiResp *SimilarWebOverviewResponse) *SiteRankData {
	data := &SiteRankData{
		GlobalRank:    apiResp.GlobalRank,
		CategoryRank:  apiResp.CategoryRank,
		Category:      apiResp.Category,
		Country:       apiResp.Country,
		BounceRate:    apiResp.BounceRate,
		PagesPerVisit: apiResp.PagesPerVisit,
		AvgDuration:   apiResp.AvgDuration,
	}
	
	return data
}

// ValidateDomain 验证域名格式
func (c *SimilarWebClient) ValidateDomain(domain string) error {
	// 基本格式检查
	if domain == "" {
		return fmt.Errorf("域名不能为空")
	}
	
	// 移除协议前缀
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "www.")
	
	// 检查域名格式
	if !strings.Contains(domain, ".") {
		return fmt.Errorf("无效的域名格式")
	}
	
	// 检查长度
	if len(domain) > 253 {
		return fmt.Errorf("域名长度不能超过253个字符")
	}
	
	return nil
}

// NormalizeDomain 标准化域名
func (c *SimilarWebClient) NormalizeDomain(domain string) string {
	// 转换为小写
	domain = strings.ToLower(domain)
	
	// 移除协议前缀
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "www.")
	
	// 移除尾部斜杠
	domain = strings.TrimSuffix(domain, "/")
	
	return domain
}

// SimilarWebAPIResponse SimilarWeb API响应结构
type SimilarWebAPIResponse struct {
	Visits []struct {
		Date   string  `json:"date"`
		Visits float64 `json:"visits"`
	} `json:"visits"`
	Meta struct {
		Request struct {
			Domain    string `json:"domain"`
			StartDate string `json:"start_date"`
			EndDate   string `json:"end_date"`
		} `json:"request"`
	} `json:"meta"`
}

// SimilarWebOverviewResponse SimilarWeb概览响应结构
type SimilarWebOverviewResponse struct {
	GlobalRank    *int     `json:"global_rank"`
	CategoryRank  *int     `json:"category_rank"`
	Category      string   `json:"category"`
	Country       string   `json:"country"`
	BounceRate    *float64 `json:"bounce_rate"`
	PagesPerVisit *float64 `json:"pages_per_visit"`
	AvgDuration   *float64 `json:"avg_visit_duration"`
}

// MockSimilarWebClient 模拟SimilarWeb客户端（用于测试）
type MockSimilarWebClient struct{}

// NewMockSimilarWebClient 创建模拟客户端
func NewMockSimilarWebClient() *MockSimilarWebClient {
	return &MockSimilarWebClient{}
}

// GetDomainRank 模拟获取域名排名
func (m *MockSimilarWebClient) GetDomainRank(domain, country string) (*SiteRankData, error) {
	// 模拟不同域名的数据
	switch domain {
	case "google.com":
		return &SiteRankData{
			GlobalRank:    intPtr(1),
			CategoryRank:  intPtr(1),
			Category:      "Search Engines",
			Country:       "world",
			Visits:        float64Ptr(15000000000),
			BounceRate:    float64Ptr(0.25),
			PagesPerVisit: float64Ptr(8.5),
			AvgDuration:   float64Ptr(600),
		}, nil
	case "facebook.com":
		return &SiteRankData{
			GlobalRank:    intPtr(3),
			CategoryRank:  intPtr(1),
			Category:      "Social Networks",
			Country:       "world",
			Visits:        float64Ptr(8000000000),
			BounceRate:    float64Ptr(0.35),
			PagesPerVisit: float64Ptr(12.3),
			AvgDuration:   float64Ptr(1200),
		}, nil
	case "example.com":
		return &SiteRankData{
			GlobalRank:    intPtr(50000),
			CategoryRank:  intPtr(1000),
			Category:      "Technology",
			Country:       "world",
			Visits:        float64Ptr(100000),
			BounceRate:    float64Ptr(0.45),
			PagesPerVisit: float64Ptr(3.2),
			AvgDuration:   float64Ptr(180),
		}, nil
	default:
		// 未知域名返回错误
		return nil, fmt.Errorf("域名 %s 未找到排名数据", domain)
	}
}

// GetDomainInfo 模拟获取域名信息
func (m *MockSimilarWebClient) GetDomainInfo(domain string) (*SiteRankData, error) {
	return m.GetDomainRank(domain, "")
}

// ValidateDomain 验证域名
func (m *MockSimilarWebClient) ValidateDomain(domain string) error {
	if domain == "" {
		return fmt.Errorf("域名不能为空")
	}
	return nil
}

// NormalizeDomain 标准化域名
func (m *MockSimilarWebClient) NormalizeDomain(domain string) string {
	return strings.ToLower(strings.TrimSpace(domain))
}

// 辅助函数
func intPtr(i int) *int {
	return &i
}

func float64Ptr(f float64) *float64 {
	return &f
}