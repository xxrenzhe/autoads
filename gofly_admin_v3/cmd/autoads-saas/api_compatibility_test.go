package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAPICompatibility API兼容性专项测试
func TestAPICompatibility(t *testing.T) {
	gin.SetMode(gin.TestMode)
	app := NewTestAutoAdsSaaSApp()
	server := httptest.NewServer(app.Router)
	defer server.Close()

	t.Run("BatchGo API兼容性", func(t *testing.T) {
		testBatchGoAPICompatibility(t, server.URL)
	})

	t.Run("SiteRankGo API兼容性", func(t *testing.T) {
		testSiteRankGoAPICompatibility(t, server.URL)
	})

	t.Run("Chengelink API兼容性", func(t *testing.T) {
		testChengeLinkAPICompatibility(t, server.URL)
	})

	t.Run("响应格式兼容性", func(t *testing.T) {
		testResponseFormatCompatibility(t, server.URL)
	})
}

// testBatchGoAPICompatibility 测试BatchGo API兼容性
func testBatchGoAPICompatibility(t *testing.T, baseURL string) {
	// 定义所有BatchGo API端点
	endpoints := []struct {
		name     string
		method   string
		path     string
		payload  map[string]interface{}
		expected int
	}{
		{
			name:   "Silent模式启动",
			method: "POST",
			path:   "/api/batchopen/silent-start",
			payload: map[string]interface{}{
				"name":        "测试Silent任务",
				"urls":        []string{"https://example.com", "https://google.com"},
				"cycle_count": 1,
				"proxy_url":   "",
				"access_mode": "http",
				"concurrency": 3,
			},
			expected: 200,
		},
		{
			name:     "Silent模式进度查询",
			method:   "GET",
			path:     "/api/batchopen/silent-progress?task_id=123",
			payload:  nil,
			expected: 200,
		},
		{
			name:   "Silent模式终止",
			method: "POST",
			path:   "/api/batchopen/silent-terminate",
			payload: map[string]interface{}{
				"task_id": "123",
			},
			expected: 200,
		},
		{
			name:   "AutoClick任务创建",
			method: "POST",
			path:   "/api/autoclick/tasks",
			payload: map[string]interface{}{
				"name":         "测试AutoClick任务",
				"urls":         []string{"https://example.com"},
				"schedule":     "daily",
				"daily_target": 10,
			},
			expected: 200,
		},
		{
			name:     "AutoClick任务进度",
			method:   "GET",
			path:     "/api/autoclick/tasks/123/progress",
			payload:  nil,
			expected: 200,
		},
		{
			name:   "Basic模式启动",
			method: "POST",
			path:   "/api/batchopen/basic-start",
			payload: map[string]interface{}{
				"name": "测试Basic任务",
				"urls": []string{"https://example.com", "https://google.com"},
			},
			expected: 200,
		},
		{
			name:     "获取任务列表",
			method:   "GET",
			path:     "/api/batchopen/tasks",
			payload:  nil,
			expected: 200,
		},
		{
			name:     "获取任务详情",
			method:   "GET",
			path:     "/api/batchopen/tasks/123",
			payload:  nil,
			expected: 200,
		},
	}

	for _, endpoint := range endpoints {
		t.Run(endpoint.name, func(t *testing.T) {
			var resp *http.Response
			var err error

			if endpoint.method == "GET" {
				resp, err = http.Get(baseURL + endpoint.path)
			} else if endpoint.method == "POST" {
				var body *bytes.Buffer
				if endpoint.payload != nil {
					jsonData, _ := json.Marshal(endpoint.payload)
					body = bytes.NewBuffer(jsonData)
				} else {
					body = bytes.NewBuffer([]byte{})
				}
				resp, err = http.Post(baseURL+endpoint.path, "application/json", body)
			}

			require.NoError(t, err)
			defer resp.Body.Close()

			assert.Equal(t, endpoint.expected, resp.StatusCode, "HTTP状态码不匹配")

			// 验证响应格式
			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			// 验证标准响应格式
			assert.Contains(t, response, "code", "响应缺少code字段")
			assert.Contains(t, response, "message", "响应缺少message字段")

			// 验证错误码格式
			code := response["code"].(float64)
			assert.True(t, code == 0 || (code >= 1000 && code < 6000), "错误码格式不正确")

			// 如果成功，验证data字段
			if code == 0 {
				assert.Contains(t, response, "data", "成功响应缺少data字段")
			}
		})
	}
}

// testSiteRankGoAPICompatibility 测试SiteRankGo API兼容性
func testSiteRankGoAPICompatibility(t *testing.T, baseURL string) {
	endpoints := []struct {
		name     string
		method   string
		path     string
		payload  map[string]interface{}
		expected int
	}{
		{
			name:     "单域名查询",
			method:   "GET",
			path:     "/api/siterank/rank?domain=example.com",
			payload:  nil,
			expected: 200,
		},
		{
			name:     "带来源的查询",
			method:   "GET",
			path:     "/api/siterank/rank?domain=example.com&source=similarweb",
			payload:  nil,
			expected: 200,
		},
		{
			name:   "批量查询",
			method: "POST",
			path:   "/api/siterank/batch",
			payload: map[string]interface{}{
				"domains": []string{"example.com", "google.com", "github.com"},
			},
			expected: 200,
		},
		{
			name:     "优先级查询",
			method:   "GET",
			path:     "/api/siterank/priority?domain=example.com",
			payload:  nil,
			expected: 200,
		},
		{
			name:     "查询历史",
			method:   "GET",
			path:     "/api/siterank/history?domain=example.com",
			payload:  nil,
			expected: 200,
		},
		{
			name:     "缓存状态",
			method:   "GET",
			path:     "/api/siterank/cache-status?domain=example.com",
			payload:  nil,
			expected: 200,
		},
	}

	for _, endpoint := range endpoints {
		t.Run(endpoint.name, func(t *testing.T) {
			var resp *http.Response
			var err error

			if endpoint.method == "GET" {
				resp, err = http.Get(baseURL + endpoint.path)
			} else if endpoint.method == "POST" {
				jsonData, _ := json.Marshal(endpoint.payload)
				resp, err = http.Post(baseURL+endpoint.path, "application/json", bytes.NewBuffer(jsonData))
			}

			require.NoError(t, err)
			defer resp.Body.Close()

			assert.Equal(t, endpoint.expected, resp.StatusCode)

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
			assert.Contains(t, response, "message")

			// 验证SiteRank特定的响应格式
			if response["code"].(float64) == 0 {
				data := response["data"]
				assert.NotNil(t, data, "成功响应应包含data")

				// 如果是单域名查询，验证数据结构
				if endpoint.name == "单域名查询" || endpoint.name == "带来源的查询" {
					dataMap := data.(map[string]interface{})
					expectedFields := []string{"domain", "global_rank", "category"}
					for _, field := range expectedFields {
						assert.Contains(t, dataMap, field, fmt.Sprintf("缺少字段: %s", field))
					}
				}
			}
		})
	}
}

// testChengeLinkAPICompatibility 测试Chengelink API兼容性
func testChengeLinkAPICompatibility(t *testing.T, baseURL string) {
	endpoints := []struct {
		name     string
		method   string
		path     string
		payload  map[string]interface{}
		expected int
	}{
		{
			name:   "创建Chengelink任务",
			method: "POST",
			path:   "/api/chengelink/create",
			payload: map[string]interface{}{
				"name":               "测试Chengelink任务",
				"affiliate_link":     "https://example.com/affiliate",
				"adspower_env":       "test_env",
				"google_ads_account": "test_account",
			},
			expected: 200,
		},
		{
			name:     "获取任务列表",
			method:   "GET",
			path:     "/api/chengelink/tasks",
			payload:  nil,
			expected: 200,
		},
		{
			name:     "获取任务详情",
			method:   "GET",
			path:     "/api/chengelink/tasks/123",
			payload:  nil,
			expected: 200,
		},
		{
			name:   "链接提取",
			method: "POST",
			path:   "/api/chengelink/extract",
			payload: map[string]interface{}{
				"affiliate_link": "https://example.com/affiliate?ref=123",
				"adspower_env":   "test_env",
			},
			expected: 200,
		},
		{
			name:   "Google Ads更新",
			method: "POST",
			path:   "/api/chengelink/update-ads",
			payload: map[string]interface{}{
				"google_ads_account": "test_account",
				"final_url":          "https://example.com/final",
			},
			expected: 200,
		},
		{
			name:     "执行日志",
			method:   "GET",
			path:     "/api/chengelink/tasks/123/logs",
			payload:  nil,
			expected: 200,
		},
	}

	for _, endpoint := range endpoints {
		t.Run(endpoint.name, func(t *testing.T) {
			var resp *http.Response
			var err error

			if endpoint.method == "GET" {
				resp, err = http.Get(baseURL + endpoint.path)
			} else if endpoint.method == "POST" {
				jsonData, _ := json.Marshal(endpoint.payload)
				resp, err = http.Post(baseURL+endpoint.path, "application/json", bytes.NewBuffer(jsonData))
			}

			require.NoError(t, err)
			defer resp.Body.Close()

			assert.Equal(t, endpoint.expected, resp.StatusCode)

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
			assert.Contains(t, response, "message")

			// 验证Chengelink特定的响应格式
			if response["code"].(float64) == 0 {
				assert.Contains(t, response, "data")

				// 验证任务列表的分页格式
				if endpoint.name == "获取任务列表" {
					assert.Contains(t, response, "pagination")
					pagination := response["pagination"].(map[string]interface{})
					assert.Contains(t, pagination, "total")
					assert.Contains(t, pagination, "limit")
					assert.Contains(t, pagination, "offset")
				}
			}
		})
	}
}

// testResponseFormatCompatibility 测试响应格式兼容性
func testResponseFormatCompatibility(t *testing.T, baseURL string) {
	t.Run("标准响应格式", func(t *testing.T) {
		endpoints := []string{
			"/health",
			"/api/siterank/rank?domain=example.com",
			"/api/batchopen/tasks",
			"/api/chengelink/tasks",
		}

		for _, endpoint := range endpoints {
			t.Run(endpoint, func(t *testing.T) {
				resp, err := http.Get(baseURL + endpoint)
				require.NoError(t, err)
				defer resp.Body.Close()

				var response map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&response)
				require.NoError(t, err)

				// 验证标准字段
				assert.Contains(t, response, "code", "缺少code字段")
				assert.Contains(t, response, "message", "缺少message字段")

				// 验证code字段类型
				code, ok := response["code"].(float64)
				assert.True(t, ok, "code字段应为数字类型")

				// 验证message字段类型
				message, ok := response["message"].(string)
				assert.True(t, ok, "message字段应为字符串类型")
				assert.NotEmpty(t, message, "message字段不应为空")

				// 如果成功，验证data字段
				if code == 0 {
					assert.Contains(t, response, "data", "成功响应应包含data字段")
				}
			})
		}
	})

	t.Run("错误码兼容性", func(t *testing.T) {
		// 测试各种错误情况
		errorCases := []struct {
			name         string
			method       string
			path         string
			payload      map[string]interface{}
			expectedCode float64
		}{
			{
				name:         "参数错误",
				method:       "POST",
				path:         "/api/batchopen/silent-start",
				payload:      map[string]interface{}{"invalid": "data"},
				expectedCode: 1001, // 参数错误
			},
			{
				name:         "缺少必填参数",
				method:       "POST",
				path:         "/api/siterank/batch",
				payload:      map[string]interface{}{},
				expectedCode: 1002, // 缺少必填参数
			},
			{
				name:         "无效域名",
				method:       "GET",
				path:         "/api/siterank/rank?domain=invalid-domain",
				payload:      nil,
				expectedCode: 1003, // 参数格式错误
			},
		}

		for _, errorCase := range errorCases {
			t.Run(errorCase.name, func(t *testing.T) {
				var resp *http.Response
				var err error

				if errorCase.method == "GET" {
					resp, err = http.Get(baseURL + errorCase.path)
				} else if errorCase.method == "POST" {
					jsonData, _ := json.Marshal(errorCase.payload)
					resp, err = http.Post(baseURL+errorCase.path, "application/json", bytes.NewBuffer(jsonData))
				}

				require.NoError(t, err)
				defer resp.Body.Close()

				var response map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&response)
				require.NoError(t, err)

				code := response["code"].(float64)

				// 验证错误码范围
				assert.True(t, code >= 1000, "错误码应大于等于1000")
				assert.True(t, code < 6000, "错误码应小于6000")

				// 验证错误消息
				message := response["message"].(string)
				assert.NotEmpty(t, message, "错误消息不应为空")
			})
		}
	})

	t.Run("分页格式兼容性", func(t *testing.T) {
		endpoints := []string{
			"/api/batchopen/tasks",
			"/api/chengelink/tasks",
			"/api/tokens/transactions",
		}

		for _, endpoint := range endpoints {
			t.Run(endpoint, func(t *testing.T) {
				resp, err := http.Get(baseURL + endpoint + "?limit=10&offset=0")
				require.NoError(t, err)
				defer resp.Body.Close()

				var response map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&response)
				require.NoError(t, err)

				if response["code"].(float64) == 0 {
					// 验证分页信息
					assert.Contains(t, response, "pagination", "应包含分页信息")

					pagination := response["pagination"].(map[string]interface{})
					assert.Contains(t, pagination, "total", "分页信息应包含total")
					assert.Contains(t, pagination, "limit", "分页信息应包含limit")
					assert.Contains(t, pagination, "offset", "分页信息应包含offset")

					// 验证分页字段类型
					total, ok := pagination["total"].(float64)
					assert.True(t, ok, "total应为数字类型")
					assert.True(t, total >= 0, "total应大于等于0")

					limit, ok := pagination["limit"].(float64)
					assert.True(t, ok, "limit应为数字类型")
					assert.True(t, limit > 0, "limit应大于0")

					offset, ok := pagination["offset"].(float64)
					assert.True(t, ok, "offset应为数字类型")
					assert.True(t, offset >= 0, "offset应大于等于0")
				}
			})
		}
	})

	t.Run("Content-Type兼容性", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/siterank/rank?domain=example.com")
		require.NoError(t, err)
		defer resp.Body.Close()

		contentType := resp.Header.Get("Content-Type")
		assert.Contains(t, contentType, "application/json", "应返回JSON格式")
	})
}
