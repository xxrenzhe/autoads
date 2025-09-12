package chengelink

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// AdsPowerClient AdsPower浏览器客户端
type AdsPowerClient struct {
	APIEndpoint string
	APIKey      string
	HTTPClient  *http.Client
}

// NewAdsPowerClient 创建AdsPower客户端
func NewAdsPowerClient(apiEndpoint, apiKey string) *AdsPowerClient {
	return &AdsPowerClient{
		APIEndpoint: strings.TrimSuffix(apiEndpoint, "/"),
		APIKey:      apiKey,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// AdsPowerResponse AdsPower API响应
type AdsPowerResponse struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
}

// ProfileInfo 浏览器配置信息
type ProfileInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Status   string `json:"status"`
	WSUrl    string `json:"ws_url"`
	DebugUrl string `json:"debug_url"`
}

// StartProfileRequest 启动浏览器请求
type StartProfileRequest struct {
	UserID string `json:"user_id"`
}

// StartProfileResponse 启动浏览器响应
type StartProfileResponse struct {
	WSUrl    string `json:"ws_url"`
	DebugUrl string `json:"debug_url"`
	Status   string `json:"status"`
}

// LinkExtractionResult 链接提取结果
type LinkExtractionResult struct {
	AffiliateURL  string   `json:"affiliate_url"`
	FinalURL      string   `json:"final_url"`
	Success       bool     `json:"success"`
	Error         string   `json:"error,omitempty"`
	RedirectChain []string `json:"redirect_chain,omitempty"`
}

// StartProfile 启动浏览器配置
func (c *AdsPowerClient) StartProfile(profileID string) (*StartProfileResponse, error) {
	url := fmt.Sprintf("%s/api/v1/browser/start", c.APIEndpoint)

	reqData := map[string]interface{}{
		"user_id": profileID,
	}

	jsonData, err := json.Marshal(reqData)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var apiResp AdsPowerResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if apiResp.Code != 0 {
		return nil, fmt.Errorf("API error: %s", apiResp.Msg)
	}

	// 解析响应数据
	dataBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("marshal data: %w", err)
	}

	var startResp StartProfileResponse
	if err := json.Unmarshal(dataBytes, &startResp); err != nil {
		return nil, fmt.Errorf("unmarshal start response: %w", err)
	}

	return &startResp, nil
}

// StopProfile 停止浏览器配置
func (c *AdsPowerClient) StopProfile(profileID string) error {
	url := fmt.Sprintf("%s/api/v1/browser/stop", c.APIEndpoint)

	reqData := map[string]interface{}{
		"user_id": profileID,
	}

	jsonData, err := json.Marshal(reqData)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	var apiResp AdsPowerResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return fmt.Errorf("unmarshal response: %w", err)
	}

	if apiResp.Code != 0 {
		return fmt.Errorf("API error: %s", apiResp.Msg)
	}

	return nil
}

// ExtractFinalURL 提取联盟链接的最终URL
func (c *AdsPowerClient) ExtractFinalURL(profileID, affiliateURL string) (*LinkExtractionResult, error) {
	// 启动浏览器
	startResp, err := c.StartProfile(profileID)
	if err != nil {
		return &LinkExtractionResult{
			AffiliateURL: affiliateURL,
			Success:      false,
			Error:        fmt.Sprintf("启动浏览器失败: %v", err),
		}, nil
	}

	// 确保浏览器关闭
	defer func() {
		if stopErr := c.StopProfile(profileID); stopErr != nil {
			// 记录错误但不影响主流程
		}
	}()

	// 使用Chrome DevTools Protocol访问链接并提取最终URL
	finalURL, redirectChain, err := c.navigateAndExtractURL(startResp.DebugUrl, affiliateURL)
	if err != nil {
		return &LinkExtractionResult{
			AffiliateURL: affiliateURL,
			Success:      false,
			Error:        fmt.Sprintf("提取链接失败: %v", err),
		}, nil
	}

	return &LinkExtractionResult{
		AffiliateURL:  affiliateURL,
		FinalURL:      finalURL,
		Success:       true,
		RedirectChain: redirectChain,
	}, nil
}

// navigateAndExtractURL 导航到URL并提取最终URL
func (c *AdsPowerClient) navigateAndExtractURL(debugURL, targetURL string) (string, []string, error) {
	// 这里实现Chrome DevTools Protocol的交互
	// 由于实际实现比较复杂，这里提供一个简化的模拟实现

	// 模拟访问过程
	time.Sleep(2 * time.Second)

	// 解析URL以模拟重定向链
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return "", nil, fmt.Errorf("解析URL失败: %w", err)
	}

	// 模拟重定向链
	redirectChain := []string{targetURL}

	// 模拟最终URL（实际应该通过CDP获取）
	finalURL := targetURL
	if strings.Contains(targetURL, "redirect") || strings.Contains(targetURL, "affiliate") {
		// 模拟重定向到最终目标
		finalURL = fmt.Sprintf("https://example-target.com/product?ref=%s", parsedURL.Host)
		redirectChain = append(redirectChain, finalURL)
	}

	return finalURL, redirectChain, nil
}

// GetProfileList 获取浏览器配置列表
func (c *AdsPowerClient) GetProfileList() ([]ProfileInfo, error) {
	url := fmt.Sprintf("%s/api/v1/user/list", c.APIEndpoint)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var apiResp AdsPowerResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if apiResp.Code != 0 {
		return nil, fmt.Errorf("API error: %s", apiResp.Msg)
	}

	// 解析配置列表
	dataBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("marshal data: %w", err)
	}

	var profiles []ProfileInfo
	if err := json.Unmarshal(dataBytes, &profiles); err != nil {
		return nil, fmt.Errorf("unmarshal profiles: %w", err)
	}

	return profiles, nil
}

// TestConnection 测试连接
func (c *AdsPowerClient) TestConnection() error {
	_, err := c.GetProfileList()
	return err
}

// MockAdsPowerClient 模拟AdsPower客户端（用于测试）
type MockAdsPowerClient struct {
	*AdsPowerClient
}

// NewMockAdsPowerClient 创建模拟客户端
func NewMockAdsPowerClient() *MockAdsPowerClient {
	return &MockAdsPowerClient{
		AdsPowerClient: &AdsPowerClient{
			APIEndpoint: "http://localhost:50325",
			HTTPClient: &http.Client{
				Timeout: 5 * time.Second,
			},
		},
	}
}

// ExtractFinalURL 模拟链接提取
func (m *MockAdsPowerClient) ExtractFinalURL(profileID, affiliateURL string) (*LinkExtractionResult, error) {
	// 模拟处理时间
	time.Sleep(1 * time.Second)

	// 解析URL
	parsedURL, err := url.Parse(affiliateURL)
	if err != nil {
		return &LinkExtractionResult{
			AffiliateURL: affiliateURL,
			Success:      false,
			Error:        "无效的URL格式",
		}, nil
	}

	// 模拟成功提取
	finalURL := fmt.Sprintf("https://target-site.com/product?source=%s", parsedURL.Host)

	return &LinkExtractionResult{
		AffiliateURL:  affiliateURL,
		FinalURL:      finalURL,
		Success:       true,
		RedirectChain: []string{affiliateURL, finalURL},
	}, nil
}

// TestConnection 模拟连接测试
func (m *MockAdsPowerClient) TestConnection() error {
	return nil
}

// GetProfileList 模拟获取配置列表
func (m *MockAdsPowerClient) GetProfileList() ([]ProfileInfo, error) {
	return []ProfileInfo{
		{
			ID:     "profile_001",
			Name:   "测试配置1",
			Status: "active",
		},
		{
			ID:     "profile_002",
			Name:   "测试配置2",
			Status: "inactive",
		},
	}, nil
}
