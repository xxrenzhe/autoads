//go:build autoads_advanced

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
	"time"

	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/glog"
)

// SEORankingClient SEO排名查询客户端
type SEORankingClient struct {
	providers map[string]SEOProvider
	client    *http.Client
}

// SEOProvider SEO服务提供商接口
type SEOProvider interface {
	GetRanking(ctx context.Context, req *RankingRequest) (*RankingResult, error)
	Name() string
}

// RankingRequest 排名查询请求
type RankingRequest struct {
	Domain       string
	Keyword      string
	SearchEngine string // google, bing, baidu
	Region       string
	Language     string
	Depth        int
}

// RankingResult 排名查询结果
type RankingResult struct {
	Position     int
	URL          string
	Title        string
	Description  string
	SERPFeatures []string
	Competition  float64
	Volume       int
	LastChecked  time.Time
	Provider     string
}

// SerpApiProvider SerpApi服务提供商
type SerpApiProvider struct {
	apiKey string
	apiURL string
	client *http.Client
}

// NewSerpApiProvider 创建SerpApi提供商
func NewSerpApiProvider(apiKey string) *SerpApiProvider {
	return &SerpApiProvider{
		apiKey: apiKey,
		apiURL: "https://serpapi.com/search",
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetRanking 获取排名
func (p *SerpApiProvider) GetRanking(ctx context.Context, req *RankingRequest) (*RankingResult, error) {
	if p.apiKey == "" {
		return nil, fmt.Errorf("SerpApi API key not configured")
	}

	// 构建请求参数
	params := url.Values{}
	params.Set("engine", req.SearchEngine)
	params.Set("q", req.Keyword)
	params.Set("api_key", p.apiKey)

	// 设置地区和语言
	if req.Region != "" {
		params.Set("gl", req.Region)
		params.Set("google_domain", fmt.Sprintf("google.%s", req.Region))
	}
	if req.Language != "" {
		params.Set("hl", req.Language)
	}

	// 设置搜索数量
	params.Set("num", strconv.Itoa(req.Depth*10))

	// 构建请求URL
	reqURL := p.apiURL + "?" + params.Encode()

	glog.Info(ctx, "serpapi_request_start", gform.Map{
		"keyword": req.Keyword,
		"domain":  req.Domain,
		"engine":  req.SearchEngine,
		"region":  req.Region,
	})

	// 发送请求
	httpReq, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// 解析响应
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d", resp.StatusCode)
	}

	var serpResponse SerpApiResponse
	if err := json.NewDecoder(resp.Body).Decode(&serpResponse); err != nil {
		return nil, fmt.Errorf("parse response failed: %w", err)
	}

	// 查找目标域名在搜索结果中的位置
	return p.findDomainPosition(req.Domain, &serpResponse)
}

// findDomainPosition 在搜索结果中查找域名位置
func (p *SerpApiProvider) findDomainPosition(domain string, response *SerpApiResponse) (*RankingResult, error) {
	if response.OrganicResults == nil {
		return nil, fmt.Errorf("no organic results found")
	}

	for i, result := range response.OrganicResults {
		resultURL := result.Link
		if strings.Contains(resultURL, domain) {
			// 提取SERP特性
			var features []string
			if result.Snippet != "" {
				features = append(features, "snippet")
			}
			if result.RichSnippet != nil {
				features = append(features, "rich_snippet")
			}

			return &RankingResult{
				Position:     i + 1,
				URL:          result.Link,
				Title:        result.Title,
				Description:  result.Snippet,
				SERPFeatures: features,
				LastChecked:  time.Now(),
				Provider:     "SerpApi",
			}, nil
		}
	}

	// 未找到排名
	return &RankingResult{
		Position:     -1,
		URL:          "",
		Title:        "",
		Description:  fmt.Sprintf("Domain %s not found in top %d results", domain, len(response.OrganicResults)),
		SERPFeatures: []string{},
		LastChecked:  time.Now(),
		Provider:     "SerpApi",
	}, nil
}

// Name 返回提供商名称
func (p *SerpApiProvider) Name() string {
	return "SerpApi"
}

// SerpApiResponse SerpApi响应结构
type SerpApiResponse struct {
	OrganicResults []struct {
		Link        string `json:"link"`
		Title       string `json:"title"`
		Snippet     string `json:"snippet"`
		RichSnippet *struct {
			Type string `json:"type"`
		} `json:"rich_snippet"`
	} `json:"organic_results"`
	SearchInformation struct {
		TotalResults string  `json:"total_results"`
		TimeTaken    float64 `json:"time_taken_displayed"`
	} `json:"search_information"`
}

// NewSEORankingClient 创建SEO排名查询客户端
func NewSEORankingClient() *SEORankingClient {
	client := &SEORankingClient{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		providers: make(map[string]SEOProvider),
	}

	// 初始化默认提供商
	if apiKey := getEnv("SERPAPI_API_KEY", ""); apiKey != "" {
		client.providers["serpapi"] = NewSerpApiProvider(apiKey)
	}

	return client
}

// GetRanking 获取排名
func (c *SEORankingClient) GetRanking(ctx context.Context, req *RankingRequest) (*RankingResult, error) {
	// 根据搜索引擎选择提供商
	var provider SEOProvider
	switch req.SearchEngine {
	case "google":
		provider = c.providers["serpapi"]
	case "bing", "baidu":
		// 对于其他搜索引擎，先使用SerpApi
		provider = c.providers["serpapi"]
	default:
		return nil, fmt.Errorf("unsupported search engine: %s", req.SearchEngine)
	}

	if provider == nil {
		return nil, fmt.Errorf("no SEO provider available for %s", req.SearchEngine)
	}

	// 获取排名
	result, err := provider.GetRanking(ctx, req)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// GetAvailableProviders 获取可用的提供商
func (c *SEORankingClient) GetAvailableProviders() []string {
	var providers []string
	for name := range c.providers {
		providers = append(providers, name)
	}
	return providers
}

// getEnv 获取环境变量
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
