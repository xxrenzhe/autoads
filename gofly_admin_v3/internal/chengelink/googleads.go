package chengelink

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// GoogleAdsClient Google Ads API客户端
type GoogleAdsClient struct {
	CustomerID     string
	DeveloperToken string
	ClientID       string
	ClientSecret   string
	RefreshToken   string
	AccessToken    string
	HTTPClient     *http.Client
}

// NewGoogleAdsClient 创建Google Ads客户端
func NewGoogleAdsClient(config *GoogleAdsConfig) *GoogleAdsClient {
	return &GoogleAdsClient{
		CustomerID:     config.CustomerID,
		DeveloperToken: config.DeveloperToken,
		ClientID:       config.ClientID,
		ClientSecret:   config.ClientSecret,
		RefreshToken:   config.RefreshToken,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// AdInfo 广告信息
type AdInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Status     string `json:"status"`
	FinalURL   string `json:"final_url"`
	CampaignID string `json:"campaign_id"`
	AdGroupID  string `json:"ad_group_id"`
	AdType     string `json:"ad_type"`
}

// UpdateAdRequest 更新广告请求
type UpdateAdRequest struct {
	AdID     string `json:"ad_id"`
	FinalURL string `json:"final_url"`
}

// UpdateAdResponse 更新广告响应
type UpdateAdResponse struct {
	Success      bool   `json:"success"`
	AdID         string `json:"ad_id"`
	ErrorMessage string `json:"error_message,omitempty"`
}

// TokenResponse OAuth Token响应
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token,omitempty"`
}

// refreshAccessToken 刷新访问令牌
func (c *GoogleAdsClient) refreshAccessToken() error {
	tokenURL := "https://oauth2.googleapis.com/token"

	data := map[string]string{
		"client_id":     c.ClientID,
		"client_secret": c.ClientSecret,
		"refresh_token": c.RefreshToken,
		"grant_type":    "refresh_token",
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal token request: %w", err)
	}

	req, err := http.NewRequest("POST", tokenURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("create token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("send token request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read token response: %w", err)
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return fmt.Errorf("unmarshal token response: %w", err)
	}

	if tokenResp.AccessToken == "" {
		return fmt.Errorf("empty access token in response")
	}

	c.AccessToken = tokenResp.AccessToken
	return nil
}

// makeAPIRequest 发送API请求
func (c *GoogleAdsClient) makeAPIRequest(method, endpoint string, data interface{}) ([]byte, error) {
	// 确保有有效的访问令牌
	if c.AccessToken == "" {
		if err := c.refreshAccessToken(); err != nil {
			return nil, fmt.Errorf("refresh access token: %w", err)
		}
	}

	var reqBody io.Reader
	if data != nil {
		jsonData, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("marshal request data: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	url := fmt.Sprintf("https://googleads.googleapis.com/v14/customers/%s/%s", c.CustomerID, endpoint)

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.AccessToken)
	req.Header.Set("developer-token", c.DeveloperToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// GetAds 获取广告列表
func (c *GoogleAdsClient) GetAds() ([]AdInfo, error) {
	// 使用Google Ads Query Language查询广告
	query := `
		SELECT 
			ad_group_ad.ad.id,
			ad_group_ad.ad.name,
			ad_group_ad.status,
			ad_group_ad.ad.final_urls,
			campaign.id,
			ad_group.id,
			ad_group_ad.ad.type
		FROM ad_group_ad 
		WHERE ad_group_ad.status != 'REMOVED'
	`

	requestData := map[string]interface{}{
		"query": query,
	}

	body, err := c.makeAPIRequest("POST", "googleAds:search", requestData)
	if err != nil {
		return nil, fmt.Errorf("search ads: %w", err)
	}

	// 解析响应
	var searchResp struct {
		Results []struct {
			AdGroupAd struct {
				Ad struct {
					ID        string   `json:"id"`
					Name      string   `json:"name"`
					FinalUrls []string `json:"finalUrls"`
					Type      string   `json:"type"`
				} `json:"ad"`
				Status string `json:"status"`
			} `json:"adGroupAd"`
			Campaign struct {
				ID string `json:"id"`
			} `json:"campaign"`
			AdGroup struct {
				ID string `json:"id"`
			} `json:"adGroup"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, fmt.Errorf("unmarshal search response: %w", err)
	}

	var ads []AdInfo
	for _, result := range searchResp.Results {
		finalURL := ""
		if len(result.AdGroupAd.Ad.FinalUrls) > 0 {
			finalURL = result.AdGroupAd.Ad.FinalUrls[0]
		}

		ads = append(ads, AdInfo{
			ID:         result.AdGroupAd.Ad.ID,
			Name:       result.AdGroupAd.Ad.Name,
			Status:     result.AdGroupAd.Status,
			FinalURL:   finalURL,
			CampaignID: result.Campaign.ID,
			AdGroupID:  result.AdGroup.ID,
			AdType:     result.AdGroupAd.Ad.Type,
		})
	}

	return ads, nil
}

// UpdateAdFinalURL 更新广告的Final URL
func (c *GoogleAdsClient) UpdateAdFinalURL(adID, newFinalURL string) (*UpdateAdResponse, error) {
	// 构建更新请求
	operations := []map[string]interface{}{
		{
			"update": map[string]interface{}{
				"resourceName": fmt.Sprintf("customers/%s/ads/%s", c.CustomerID, adID),
				"finalUrls":    []string{newFinalURL},
			},
			"updateMask": "finalUrls",
		},
	}

	requestData := map[string]interface{}{
		"operations": operations,
	}

	body, err := c.makeAPIRequest("POST", "ads:mutate", requestData)
	if err != nil {
		return &UpdateAdResponse{
			Success:      false,
			AdID:         adID,
			ErrorMessage: fmt.Sprintf("API请求失败: %v", err),
		}, nil
	}

	// 解析响应
	var mutateResp struct {
		Results []struct {
			ResourceName string `json:"resourceName"`
		} `json:"results"`
		PartialFailureError struct {
			Message string `json:"message"`
		} `json:"partialFailureError"`
	}

	if err := json.Unmarshal(body, &mutateResp); err != nil {
		return &UpdateAdResponse{
			Success:      false,
			AdID:         adID,
			ErrorMessage: fmt.Sprintf("解析响应失败: %v", err),
		}, nil
	}

	// 检查是否有错误
	if mutateResp.PartialFailureError.Message != "" {
		return &UpdateAdResponse{
			Success:      false,
			AdID:         adID,
			ErrorMessage: mutateResp.PartialFailureError.Message,
		}, nil
	}

	// 检查是否有结果
	if len(mutateResp.Results) == 0 {
		return &UpdateAdResponse{
			Success:      false,
			AdID:         adID,
			ErrorMessage: "没有更新任何广告",
		}, nil
	}

	return &UpdateAdResponse{
		Success: true,
		AdID:    adID,
	}, nil
}

// BatchUpdateAds 批量更新广告
func (c *GoogleAdsClient) BatchUpdateAds(updates []UpdateAdRequest) ([]UpdateAdResponse, error) {
	var results []UpdateAdResponse

	// 分批处理，每批最多100个
	batchSize := 100
	for i := 0; i < len(updates); i += batchSize {
		end := i + batchSize
		if end > len(updates) {
			end = len(updates)
		}

		batch := updates[i:end]
		batchResults, err := c.processBatch(batch)
		if err != nil {
			// 如果批量处理失败，逐个处理
			for _, update := range batch {
				result, _ := c.UpdateAdFinalURL(update.AdID, update.FinalURL)
				results = append(results, *result)
			}
		} else {
			results = append(results, batchResults...)
		}
	}

	return results, nil
}

// processBatch 处理一批更新
func (c *GoogleAdsClient) processBatch(updates []UpdateAdRequest) ([]UpdateAdResponse, error) {
	var operations []map[string]interface{}

	for _, update := range updates {
		operations = append(operations, map[string]interface{}{
			"update": map[string]interface{}{
				"resourceName": fmt.Sprintf("customers/%s/ads/%s", c.CustomerID, update.AdID),
				"finalUrls":    []string{update.FinalURL},
			},
			"updateMask": "finalUrls",
		})
	}

	requestData := map[string]interface{}{
		"operations": operations,
	}

	body, err := c.makeAPIRequest("POST", "ads:mutate", requestData)
	if err != nil {
		return nil, fmt.Errorf("batch update request: %w", err)
	}

	// 解析响应
	var mutateResp struct {
		Results []struct {
			ResourceName string `json:"resourceName"`
		} `json:"results"`
		PartialFailureError struct {
			Message string `json:"message"`
		} `json:"partialFailureError"`
	}

	if err := json.Unmarshal(body, &mutateResp); err != nil {
		return nil, fmt.Errorf("unmarshal batch response: %w", err)
	}

	var results []UpdateAdResponse
	for i, update := range updates {
		if i < len(mutateResp.Results) {
			results = append(results, UpdateAdResponse{
				Success: true,
				AdID:    update.AdID,
			})
		} else {
			results = append(results, UpdateAdResponse{
				Success:      false,
				AdID:         update.AdID,
				ErrorMessage: "批量更新失败",
			})
		}
	}

	return results, nil
}

// TestConnection 测试连接
func (c *GoogleAdsClient) TestConnection() error {
	// 尝试获取客户信息
	_, err := c.makeAPIRequest("GET", "", nil)
	return err
}

// MockGoogleAdsClient 模拟Google Ads客户端（用于测试）
type MockGoogleAdsClient struct {
	*GoogleAdsClient
	mockAds []AdInfo
}

// NewMockGoogleAdsClient 创建模拟客户端
func NewMockGoogleAdsClient() *MockGoogleAdsClient {
	return &MockGoogleAdsClient{
		GoogleAdsClient: &GoogleAdsClient{
			CustomerID: "1234567890",
			HTTPClient: &http.Client{
				Timeout: 5 * time.Second,
			},
		},
		mockAds: []AdInfo{
			{
				ID:         "ad_001",
				Name:       "测试广告1",
				Status:     "ENABLED",
				FinalURL:   "https://old-url1.com",
				CampaignID: "campaign_001",
				AdGroupID:  "adgroup_001",
				AdType:     "TEXT_AD",
			},
			{
				ID:         "ad_002",
				Name:       "测试广告2",
				Status:     "ENABLED",
				FinalURL:   "https://old-url2.com",
				CampaignID: "campaign_001",
				AdGroupID:  "adgroup_002",
				AdType:     "RESPONSIVE_SEARCH_AD",
			},
			{
				ID:         "ad_003",
				Name:       "测试广告3",
				Status:     "PAUSED",
				FinalURL:   "https://old-url3.com",
				CampaignID: "campaign_002",
				AdGroupID:  "adgroup_003",
				AdType:     "TEXT_AD",
			},
		},
	}
}

// GetAds 模拟获取广告列表
func (m *MockGoogleAdsClient) GetAds() ([]AdInfo, error) {
	// 模拟API延迟
	time.Sleep(500 * time.Millisecond)
	return m.mockAds, nil
}

// UpdateAdFinalURL 模拟更新广告URL
func (m *MockGoogleAdsClient) UpdateAdFinalURL(adID, newFinalURL string) (*UpdateAdResponse, error) {
	// 模拟API延迟
	time.Sleep(200 * time.Millisecond)

	// 查找广告
	for i, ad := range m.mockAds {
		if ad.ID == adID {
			// 模拟更新
			m.mockAds[i].FinalURL = newFinalURL

			// 模拟一些失败情况
			if strings.Contains(newFinalURL, "invalid") {
				return &UpdateAdResponse{
					Success:      false,
					AdID:         adID,
					ErrorMessage: "无效的URL格式",
				}, nil
			}

			return &UpdateAdResponse{
				Success: true,
				AdID:    adID,
			}, nil
		}
	}

	return &UpdateAdResponse{
		Success:      false,
		AdID:         adID,
		ErrorMessage: "广告不存在",
	}, nil
}

// BatchUpdateAds 模拟批量更新
func (m *MockGoogleAdsClient) BatchUpdateAds(updates []UpdateAdRequest) ([]UpdateAdResponse, error) {
	var results []UpdateAdResponse

	for _, update := range updates {
		result, _ := m.UpdateAdFinalURL(update.AdID, update.FinalURL)
		results = append(results, *result)
	}

	return results, nil
}

// TestConnection 模拟连接测试
func (m *MockGoogleAdsClient) TestConnection() error {
	return nil
}
