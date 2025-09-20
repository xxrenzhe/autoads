package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestComprehensiveValidation 全面测试和验证
func TestComprehensiveValidation(t *testing.T) {
	// 设置测试模式
	gin.SetMode(gin.TestMode)

	// 创建测试应用
	app := NewTestAutoAdsSaaSApp()
	server := httptest.NewServer(app.Router)
	defer server.Close()

	t.Run("API兼容性测试", func(t *testing.T) {
		testAPICompatibility(t, server.URL)
	})

	t.Run("功能完整性测试", func(t *testing.T) {
		testFunctionalCompleteness(t, server.URL)
	})

	t.Run("性能测试", func(t *testing.T) {
		testPerformance(t, server.URL)
	})

	t.Run("安全测试", func(t *testing.T) {
		testSecurity(t, server.URL)
	})

	t.Run("端到端测试", func(t *testing.T) {
		testEndToEnd(t, server.URL)
	})
}

// testAPICompatibility 测试API兼容性 - 确保所有现有API路径和响应格式100%兼容
func testAPICompatibility(t *testing.T, baseURL string) {
	t.Run("BatchGo API兼容性", func(t *testing.T) {
		// 测试Silent模式API
		t.Run("Silent模式API", func(t *testing.T) {
			// 测试启动Silent任务
			payload := map[string]interface{}{
				"name":        "测试Silent任务",
				"urls":        []string{"https://example.com", "https://google.com"},
				"cycle_count": 1,
				"proxy_url":   "",
				"access_mode": "http",
				"concurrency": 3,
			}

			jsonData, _ := json.Marshal(payload)
			resp, err := http.Post(baseURL+"/api/batchopen/silent-start", "application/json", bytes.NewBuffer(jsonData))
			require.NoError(t, err)
			defer resp.Body.Close()

			// 验证响应格式兼容性
			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			// 验证标准响应格式
			assert.Contains(t, response, "code")
			assert.Contains(t, response, "message")
			assert.Contains(t, response, "data")

			// 验证错误码格式 (0: 成功, 1000-1999: 参数错误, 2000-2999: 业务错误)
			code := response["code"].(float64)
			assert.True(t, code == 0 || (code >= 1000 && code < 3000))
		})

		// 测试AutoClick模式API
		t.Run("AutoClick模式API", func(t *testing.T) {
			payload := map[string]interface{}{
				"name":         "测试AutoClick任务",
				"urls":         []string{"https://example.com"},
				"schedule":     "daily",
				"daily_target": 10,
			}

			jsonData, _ := json.Marshal(payload)
			resp, err := http.Post(baseURL+"/api/autoclick/tasks", "application/json", bytes.NewBuffer(jsonData))
			require.NoError(t, err)
			defer resp.Body.Close()

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
			assert.Contains(t, response, "message")
		})

		// 测试Basic模式API (WebSocket通知)
		t.Run("Basic模式API", func(t *testing.T) {
			payload := map[string]interface{}{
				"name": "测试Basic任务",
				"urls": []string{"https://example.com", "https://google.com"},
			}

			jsonData, _ := json.Marshal(payload)
			resp, err := http.Post(baseURL+"/api/batchopen/basic-start", "application/json", bytes.NewBuffer(jsonData))
			require.NoError(t, err)
			defer resp.Body.Close()

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
			assert.Contains(t, response, "message")
		})
	})

	t.Run("SiteRankGo API兼容性", func(t *testing.T) {
		// 测试单域名查询
		resp, err := http.Get(baseURL + "/api/siterank/rank?domain=example.com")
		require.NoError(t, err)
		defer resp.Body.Close()

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		assert.Contains(t, response, "code")
		assert.Contains(t, response, "message")
		assert.Contains(t, response, "data")

		// 测试批量查询
		payload := map[string]interface{}{
			"domains": []string{"example.com", "google.com", "github.com"},
		}

		jsonData, _ := json.Marshal(payload)
		resp, err = http.Post(baseURL+"/api/siterank/batch", "application/json", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		defer resp.Body.Close()

		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		assert.Contains(t, response, "code")
		assert.Contains(t, response, "message")
	})

	t.Run("AdsCenter API兼容性", func(t *testing.T) {
		// 测试创建AdsCenter任务
		payload := map[string]interface{}{
			"name":               "测试AdsCenter任务",
			"affiliate_link":     "https://example.com/affiliate",
			"adspower_env":       "test_env",
			"google_ads_account": "test_account",
		}

		jsonData, _ := json.Marshal(payload)
		resp, err := http.Post(baseURL+"/api/adscenter/create", "application/json", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		defer resp.Body.Close()

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		assert.Contains(t, response, "code")
		assert.Contains(t, response, "message")

		// 测试获取任务列表
		resp, err = http.Get(baseURL + "/api/adscenter/tasks")
		require.NoError(t, err)
		defer resp.Body.Close()

		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		assert.Contains(t, response, "code")
		assert.Contains(t, response, "data")
		assert.Contains(t, response, "pagination")
	})
}

// testFunctionalCompleteness 测试功能完整性 - BatchGo、SiteRankGo、AdsCenter功能100%迁移验证
func testFunctionalCompleteness(t *testing.T, baseURL string) {
	t.Run("BatchGo功能完整性", func(t *testing.T) {
		// 测试所有三种模式
		modes := []string{"basic", "silent", "autoclick"}

		for _, mode := range modes {
			t.Run(fmt.Sprintf("%s模式", mode), func(t *testing.T) {
				// 创建任务
				payload := map[string]interface{}{
					"name": fmt.Sprintf("测试%s任务", mode),
					"type": mode,
					"urls": []string{"https://example.com", "https://google.com"},
				}

				if mode == "autoclick" {
					payload["schedule"] = "daily"
					payload["daily_target"] = 10
				}

				jsonData, _ := json.Marshal(payload)
				endpoint := fmt.Sprintf("/api/batchopen/%s-start", mode)
				if mode == "autoclick" {
					endpoint = "/api/autoclick/tasks"
				}

				resp, err := http.Post(baseURL+endpoint, "application/json", bytes.NewBuffer(jsonData))
				require.NoError(t, err)
				defer resp.Body.Close()

				var response map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&response)
				require.NoError(t, err)

				// 验证任务创建成功或返回合理错误
				code := response["code"].(float64)
				assert.True(t, code == 0 || code >= 1000)

				// 如果创建成功，测试进度查询
				if code == 0 && response["data"] != nil {
					data := response["data"].(map[string]interface{})
					if taskID, exists := data["task_id"]; exists {
						progressEndpoint := fmt.Sprintf("/api/batchopen/%s-progress?task_id=%v", mode, taskID)
						if mode == "autoclick" {
							progressEndpoint = fmt.Sprintf("/api/autoclick/tasks/%v/progress", taskID)
						}

						progressResp, err := http.Get(baseURL + progressEndpoint)
						require.NoError(t, err)
						defer progressResp.Body.Close()

						var progressResponse map[string]interface{}
						err = json.NewDecoder(progressResp.Body).Decode(&progressResponse)
						require.NoError(t, err)

						assert.Contains(t, progressResponse, "code")
					}
				}
			})
		}

		// 测试并发控制
		t.Run("并发控制", func(t *testing.T) {
			payload := map[string]interface{}{
				"name":        "并发测试任务",
				"urls":        []string{"https://example.com"},
				"concurrency": 5,
			}

			jsonData, _ := json.Marshal(payload)
			resp, err := http.Post(baseURL+"/api/batchopen/silent-start", "application/json", bytes.NewBuffer(jsonData))
			require.NoError(t, err)
			defer resp.Body.Close()

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
		})

		// 测试代理支持
		t.Run("代理支持", func(t *testing.T) {
			payload := map[string]interface{}{
				"name":      "代理测试任务",
				"urls":      []string{"https://example.com"},
				"proxy_url": "http://proxy.example.com:8080",
			}

			jsonData, _ := json.Marshal(payload)
			resp, err := http.Post(baseURL+"/api/batchopen/silent-start", "application/json", bytes.NewBuffer(jsonData))
			require.NoError(t, err)
			defer resp.Body.Close()

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
		})
	})

	t.Run("SiteRankGo功能完整性", func(t *testing.T) {
		// 测试SimilarWeb集成
		t.Run("SimilarWeb集成", func(t *testing.T) {
			resp, err := http.Get(baseURL + "/api/siterank/rank?domain=example.com&source=similarweb")
			require.NoError(t, err)
			defer resp.Body.Close()

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
			assert.Contains(t, response, "data")

			// 验证数据结构
			if response["code"].(float64) == 0 {
				data := response["data"].(map[string]interface{})
				expectedFields := []string{"domain", "global_rank", "category", "visits"}
				for _, field := range expectedFields {
					assert.Contains(t, data, field)
				}
			}
		})

		// 测试批量查询
		t.Run("批量查询", func(t *testing.T) {
			payload := map[string]interface{}{
				"domains":    []string{"example.com", "google.com", "github.com"},
				"batch_size": 5,
			}

			jsonData, _ := json.Marshal(payload)
			resp, err := http.Post(baseURL+"/api/siterank/batch", "application/json", bytes.NewBuffer(jsonData))
			require.NoError(t, err)
			defer resp.Body.Close()

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
		})

		// 测试优先级计算
		t.Run("优先级计算", func(t *testing.T) {
			resp, err := http.Get(baseURL + "/api/siterank/priority?domain=example.com")
			require.NoError(t, err)
			defer resp.Body.Close()

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")

			if response["code"].(float64) == 0 {
				data := response["data"].(map[string]interface{})
				assert.Contains(t, data, "priority")
				priority := data["priority"].(string)
				assert.Contains(t, []string{"High", "Medium", "Low"}, priority)
			}
		})

		// 测试缓存机制
		t.Run("缓存机制", func(t *testing.T) {
			domain := "cache-test.com"

			// 第一次查询
			start1 := time.Now()
			resp1, err := http.Get(baseURL + "/api/siterank/rank?domain=" + domain)
			require.NoError(t, err)
			defer resp1.Body.Close()
			duration1 := time.Since(start1)

			// 第二次查询（应该从缓存获取）
			start2 := time.Now()
			resp2, err := http.Get(baseURL + "/api/siterank/rank?domain=" + domain)
			require.NoError(t, err)
			defer resp2.Body.Close()
			duration2 := time.Since(start2)

			// 缓存查询应该更快
			assert.True(t, duration2 < duration1 || duration2 < 100*time.Millisecond)
		})
	})

	t.Run("AdsCenter功能完整性", func(t *testing.T) {
		// 测试链接提取
		t.Run("链接提取", func(t *testing.T) {
			payload := map[string]interface{}{
				"affiliate_link": "https://example.com/affiliate?ref=123",
				"adspower_env":   "test_env",
			}

			jsonData, _ := json.Marshal(payload)
			resp, err := http.Post(baseURL+"/api/adscenter/extract", "application/json", bytes.NewBuffer(jsonData))
			require.NoError(t, err)
			defer resp.Body.Close()

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
		})

		// 测试Google Ads更新
		t.Run("Google Ads更新", func(t *testing.T) {
			payload := map[string]interface{}{
				"google_ads_account": "test_account",
				"final_url":          "https://example.com/final",
			}

			jsonData, _ := json.Marshal(payload)
			resp, err := http.Post(baseURL+"/api/adscenter/update-ads", "application/json", bytes.NewBuffer(jsonData))
			require.NoError(t, err)
			defer resp.Body.Close()

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
		})

		// 测试执行状态监控
		t.Run("执行状态监控", func(t *testing.T) {
			resp, err := http.Get(baseURL + "/api/adscenter/tasks?status=running")
			require.NoError(t, err)
			defer resp.Body.Close()

			var response map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.Contains(t, response, "code")
			assert.Contains(t, response, "data")
		})
	})
}

// testPerformance 测试性能 - 50并发用户测试，P95响应时间<200ms验证
func testPerformance(t *testing.T, baseURL string) {
	t.Run("并发性能测试", func(t *testing.T) {
		concurrency := 50
		requestsPerUser := 10
		totalRequests := concurrency * requestsPerUser

		var wg sync.WaitGroup
		responseTimes := make([]time.Duration, totalRequests)
		errors := make([]error, totalRequests)

		startTime := time.Now()

		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func(userID int) {
				defer wg.Done()

				for j := 0; j < requestsPerUser; j++ {
					requestIndex := userID*requestsPerUser + j

					requestStart := time.Now()
					resp, err := http.Get(baseURL + "/health")
					requestDuration := time.Since(requestStart)

					responseTimes[requestIndex] = requestDuration
					errors[requestIndex] = err

					if resp != nil {
						resp.Body.Close()
					}
				}
			}(i)
		}

		wg.Wait()
		totalDuration := time.Since(startTime)

		// 计算统计信息
		var validResponses []time.Duration
		errorCount := 0

		for i, err := range errors {
			if err != nil {
				errorCount++
			} else {
				validResponses = append(validResponses, responseTimes[i])
			}
		}

		require.Greater(t, len(validResponses), 0, "No valid responses received")

		// 计算P95响应时间
		p95Index := int(float64(len(validResponses)) * 0.95)
		if p95Index >= len(validResponses) {
			p95Index = len(validResponses) - 1
		}

		// 排序响应时间
		for i := 0; i < len(validResponses)-1; i++ {
			for j := i + 1; j < len(validResponses); j++ {
				if validResponses[i] > validResponses[j] {
					validResponses[i], validResponses[j] = validResponses[j], validResponses[i]
				}
			}
		}

		p95ResponseTime := validResponses[p95Index]

		// 计算平均响应时间
		var totalResponseTime time.Duration
		for _, rt := range validResponses {
			totalResponseTime += rt
		}
		avgResponseTime := totalResponseTime / time.Duration(len(validResponses))

		// 计算QPS
		qps := float64(len(validResponses)) / totalDuration.Seconds()

		// 输出性能统计
		t.Logf("性能测试结果:")
		t.Logf("  并发用户: %d", concurrency)
		t.Logf("  总请求数: %d", totalRequests)
		t.Logf("  成功请求: %d", len(validResponses))
		t.Logf("  失败请求: %d", errorCount)
		t.Logf("  错误率: %.2f%%", float64(errorCount)/float64(totalRequests)*100)
		t.Logf("  平均响应时间: %v", avgResponseTime)
		t.Logf("  P95响应时间: %v", p95ResponseTime)
		t.Logf("  QPS: %.2f", qps)
		t.Logf("  总耗时: %v", totalDuration)

		// 验证性能要求
		assert.Less(t, p95ResponseTime, 200*time.Millisecond, "P95响应时间应小于200ms")
		assert.Less(t, float64(errorCount)/float64(totalRequests), 0.01, "错误率应小于1%")
		assert.Greater(t, qps, 100.0, "QPS应大于100")
	})

	t.Run("API响应时间测试", func(t *testing.T) {
		endpoints := []string{
			"/health",
			"/api/docs/swagger.json",
			"/metrics",
		}

		for _, endpoint := range endpoints {
			t.Run(endpoint, func(t *testing.T) {
				start := time.Now()
				resp, err := http.Get(baseURL + endpoint)
				duration := time.Since(start)

				require.NoError(t, err)
				defer resp.Body.Close()

				assert.Less(t, duration, 100*time.Millisecond, fmt.Sprintf("%s响应时间应小于100ms", endpoint))
				assert.Equal(t, 200, resp.StatusCode)
			})
		}
	})

	t.Run("内存使用测试", func(t *testing.T) {
		// 发送大量请求测试内存泄漏
		for i := 0; i < 1000; i++ {
			resp, err := http.Get(baseURL + "/health")
			require.NoError(t, err)
			resp.Body.Close()
		}

		// 检查内存指标
		resp, err := http.Get(baseURL + "/metrics")
		require.NoError(t, err)
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		bodyStr := string(body)
		assert.Contains(t, bodyStr, "go_memstats_alloc_bytes")
	})
}

// testSecurity 测试安全 - 用户数据隔离、Token消费准确性、认证授权验证
func testSecurity(t *testing.T, baseURL string) {
	t.Run("用户数据隔离测试", func(t *testing.T) {
		// 模拟两个不同用户
		user1Token := "user1_token"
		user2Token := "user2_token"

		// 用户1创建任务
		payload1 := map[string]interface{}{
			"name": "用户1的任务",
			"urls": []string{"https://user1.com"},
		}

		jsonData1, _ := json.Marshal(payload1)
		req1, _ := http.NewRequest("POST", baseURL+"/api/batchopen/silent-start", bytes.NewBuffer(jsonData1))
		req1.Header.Set("Authorization", "Bearer "+user1Token)
		req1.Header.Set("Content-Type", "application/json")

		client := &http.Client{}
		resp1, err := client.Do(req1)
		require.NoError(t, err)
		defer resp1.Body.Close()

		// 用户2尝试访问用户1的任务
		req2, _ := http.NewRequest("GET", baseURL+"/api/batchopen/tasks", nil)
		req2.Header.Set("Authorization", "Bearer "+user2Token)

		resp2, err := client.Do(req2)
		require.NoError(t, err)
		defer resp2.Body.Close()

		var response2 map[string]interface{}
		err = json.NewDecoder(resp2.Body).Decode(&response2)
		require.NoError(t, err)

		// 用户2应该看不到用户1的任务
		if response2["code"].(float64) == 0 {
			data := response2["data"].([]interface{})
			for _, task := range data {
				taskMap := task.(map[string]interface{})
				assert.NotEqual(t, "用户1的任务", taskMap["name"])
			}
		}
	})

	t.Run("Token消费准确性测试", func(t *testing.T) {
		userToken := "test_user_token"

		// 获取初始Token余额
		req, _ := http.NewRequest("GET", baseURL+"/api/tokens/balance", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		client := &http.Client{}
		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var balanceResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&balanceResp)
		require.NoError(t, err)

		initialBalance := 0
		if balanceResp["code"].(float64) == 0 {
			data := balanceResp["data"].(map[string]interface{})
			initialBalance = int(data["balance"].(float64))
		}

		// 执行消费Token的操作 (SiteRank查询)
		req, _ = http.NewRequest("GET", baseURL+"/api/siterank/rank?domain=test.com", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		// 检查Token余额变化
		req, _ = http.NewRequest("GET", baseURL+"/api/tokens/balance", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		err = json.NewDecoder(resp.Body).Decode(&balanceResp)
		require.NoError(t, err)

		if balanceResp["code"].(float64) == 0 {
			data := balanceResp["data"].(map[string]interface{})
			finalBalance := int(data["balance"].(float64))

			// SiteRank查询应该消费1个Token
			expectedBalance := initialBalance - 1
			assert.Equal(t, expectedBalance, finalBalance, "Token消费不准确")
		}
	})

	t.Run("认证授权验证", func(t *testing.T) {
		// 测试无Token访问
		resp, err := http.Get(baseURL + "/api/user/profile")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, 401, resp.StatusCode)

		// 测试无效Token
		req, _ := http.NewRequest("GET", baseURL+"/api/user/profile", nil)
		req.Header.Set("Authorization", "Bearer invalid_token")

		client := &http.Client{}
		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, 401, resp.StatusCode)

		// 测试过期Token
		req, _ = http.NewRequest("GET", baseURL+"/api/user/profile", nil)
		req.Header.Set("Authorization", "Bearer expired_token")

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, 401, resp.StatusCode)
	})

	t.Run("输入验证测试", func(t *testing.T) {
		// 测试SQL注入防护
		maliciousPayload := map[string]interface{}{
			"domain": "'; DROP TABLE users; --",
		}

		jsonData, _ := json.Marshal(maliciousPayload)
		resp, err := http.Post(baseURL+"/api/siterank/rank", "application/json", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		defer resp.Body.Close()

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		// 应该返回参数错误，而不是执行恶意SQL
		code := response["code"].(float64)
		assert.True(t, code >= 1000 && code < 2000, "应该返回参数验证错误")

		// 测试XSS防护
		xssPayload := map[string]interface{}{
			"name": "<script>alert('xss')</script>",
			"urls": []string{"https://example.com"},
		}

		jsonData, _ = json.Marshal(xssPayload)
		resp, err = http.Post(baseURL+"/api/batchopen/silent-start", "application/json", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		defer resp.Body.Close()

		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		// 检查响应中是否包含未转义的脚本
		responseStr, _ := json.Marshal(response)
		assert.NotContains(t, string(responseStr), "<script>")
	})

	t.Run("限流测试", func(t *testing.T) {
		// 快速发送大量请求测试限流
		client := &http.Client{Timeout: 5 * time.Second}

		var rateLimitHit bool
		for i := 0; i < 200; i++ {
			resp, err := client.Get(baseURL + "/api/siterank/rank?domain=test.com")
			if err != nil {
				continue
			}

			if resp.StatusCode == 429 {
				rateLimitHit = true
				resp.Body.Close()
				break
			}
			resp.Body.Close()
		}

		assert.True(t, rateLimitHit, "应该触发限流机制")
	})
}

// testEndToEnd 测试端到端 - 完整用户流程测试，从注册到使用所有功能
func testEndToEnd(t *testing.T, baseURL string) {
	t.Run("完整用户流程", func(t *testing.T) {
		client := &http.Client{}

		// 1. 用户注册
		t.Log("步骤1: 用户注册")
		registerPayload := map[string]interface{}{
			"email":    "e2e_test@example.com",
			"password": "password123",
			"username": "e2e_testuser",
		}

		jsonData, _ := json.Marshal(registerPayload)
		resp, err := client.Post(baseURL+"/api/auth/register", "application/json", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		defer resp.Body.Close()

		var registerResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&registerResp)
		require.NoError(t, err)

		var userToken string
		if registerResp["code"].(float64) == 0 {
			data := registerResp["data"].(map[string]interface{})
			userToken = data["token"].(string)
		} else {
			// 如果注册失败，尝试登录
			t.Log("注册失败，尝试登录")
			loginPayload := map[string]interface{}{
				"email":    "e2e_test@example.com",
				"password": "password123",
			}

			jsonData, _ = json.Marshal(loginPayload)
			resp, err = client.Post(baseURL+"/api/auth/login", "application/json", bytes.NewBuffer(jsonData))
			require.NoError(t, err)
			defer resp.Body.Close()

			var loginResp map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&loginResp)
			require.NoError(t, err)

			if loginResp["code"].(float64) == 0 {
				data := loginResp["data"].(map[string]interface{})
				userToken = data["token"].(string)
			}
		}

		require.NotEmpty(t, userToken, "无法获取用户Token")

		// 2. 获取用户信息
		t.Log("步骤2: 获取用户信息")
		req, _ := http.NewRequest("GET", baseURL+"/api/user/profile", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var profileResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&profileResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), profileResp["code"])

		// 3. 检查Token余额
		t.Log("步骤3: 检查Token余额")
		req, _ = http.NewRequest("GET", baseURL+"/api/tokens/balance", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var balanceResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&balanceResp)
		require.NoError(t, err)

		initialBalance := 0
		if balanceResp["code"].(float64) == 0 {
			data := balanceResp["data"].(map[string]interface{})
			initialBalance = int(data["balance"].(float64))
		}

		t.Logf("初始Token余额: %d", initialBalance)

		// 4. 执行SiteRank查询
		t.Log("步骤4: 执行SiteRank查询")
		req, _ = http.NewRequest("GET", baseURL+"/api/siterank/rank?domain=example.com", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var siterankResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&siterankResp)
		require.NoError(t, err)

		t.Logf("SiteRank查询结果: %v", siterankResp["code"])

		// 5. 创建BatchGo任务
		t.Log("步骤5: 创建BatchGo任务")
		batchPayload := map[string]interface{}{
			"name": "E2E测试BatchGo任务",
			"urls": []string{"https://example.com", "https://google.com"},
			"type": "silent",
		}

		jsonData, _ = json.Marshal(batchPayload)
		req, _ = http.NewRequest("POST", baseURL+"/api/batchopen/silent-start", bytes.NewBuffer(jsonData))
		req.Header.Set("Authorization", "Bearer "+userToken)
		req.Header.Set("Content-Type", "application/json")

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var batchResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&batchResp)
		require.NoError(t, err)

		t.Logf("BatchGo任务创建结果: %v", batchResp["code"])

		var taskID interface{}
		if batchResp["code"].(float64) == 0 {
			data := batchResp["data"].(map[string]interface{})
			taskID = data["task_id"]
		}

		// 6. 查询任务进度
		if taskID != nil {
			t.Log("步骤6: 查询任务进度")
			req, _ = http.NewRequest("GET", fmt.Sprintf("%s/api/batchopen/silent-progress?task_id=%v", baseURL, taskID), nil)
			req.Header.Set("Authorization", "Bearer "+userToken)

			resp, err = client.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()

			var progressResp map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&progressResp)
			require.NoError(t, err)

			t.Logf("任务进度查询结果: %v", progressResp["code"])
		}

        // 7. 创建 AdsCenter 任务
        t.Log("步骤7: 创建 AdsCenter 任务")
		adscenterPayload := map[string]interface{}{
			"name":               "E2E测试AdsCenter任务",
			"affiliate_link":     "https://example.com/affiliate",
			"adspower_env":       "test_env",
			"google_ads_account": "test_account",
		}

        jsonData, _ = json.Marshal(adscenterPayload)
        req, _ = http.NewRequest("POST", baseURL+"/api/adscenter/create", bytes.NewBuffer(jsonData))
		req.Header.Set("Authorization", "Bearer "+userToken)
		req.Header.Set("Content-Type", "application/json")

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

        var adscenterResp map[string]interface{}
        err = json.NewDecoder(resp.Body).Decode(&adscenterResp)
        require.NoError(t, err)
        t.Logf("AdsCenter 任务创建结果: %v", adscenterResp["code"])

		// 8. 检查最终Token余额
		t.Log("步骤8: 检查最终Token余额")
		req, _ = http.NewRequest("GET", baseURL+"/api/tokens/balance", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		err = json.NewDecoder(resp.Body).Decode(&balanceResp)
		require.NoError(t, err)

		finalBalance := 0
		if balanceResp["code"].(float64) == 0 {
			data := balanceResp["data"].(map[string]interface{})
			finalBalance = int(data["balance"].(float64))
		}

		t.Logf("最终Token余额: %d", finalBalance)
		t.Logf("Token消费: %d", initialBalance-finalBalance)

		// 9. 获取Token交易记录
		t.Log("步骤9: 获取Token交易记录")
		req, _ = http.NewRequest("GET", baseURL+"/api/tokens/transactions", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var transactionsResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&transactionsResp)
		require.NoError(t, err)

		t.Logf("Token交易记录查询结果: %v", transactionsResp["code"])

		// 10. 每日签到
		t.Log("步骤10: 每日签到")
		req, _ = http.NewRequest("POST", baseURL+"/api/checkin/perform", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var checkinResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&checkinResp)
		require.NoError(t, err)

		t.Logf("签到结果: %v", checkinResp["code"])

		t.Log("✅ 端到端测试完成")
	})

	t.Run("邀请流程测试", func(t *testing.T) {
		client := &http.Client{}

		// 模拟邀请者
		inviterToken := "inviter_token"

		// 1. 生成邀请链接
		t.Log("步骤1: 生成邀请链接")
		req, _ := http.NewRequest("POST", baseURL+"/api/invitation/generate-link", nil)
		req.Header.Set("Authorization", "Bearer "+inviterToken)

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var inviteResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&inviteResp)
		require.NoError(t, err)

		var inviteCode string
		if inviteResp["code"].(float64) == 0 {
			data := inviteResp["data"].(map[string]interface{})
			inviteCode = data["invite_code"].(string)
		}

		t.Logf("邀请码: %s", inviteCode)

		// 2. 被邀请用户注册
		if inviteCode != "" {
			t.Log("步骤2: 被邀请用户注册")
			registerPayload := map[string]interface{}{
				"email":       "invited_user@example.com",
				"password":    "password123",
				"username":    "invited_user",
				"invite_code": inviteCode,
			}

			jsonData, _ := json.Marshal(registerPayload)
			resp, err = client.Post(baseURL+"/api/auth/register", "application/json", bytes.NewBuffer(jsonData))
			require.NoError(t, err)
			defer resp.Body.Close()

			var registerResp map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&registerResp)
			require.NoError(t, err)

			t.Logf("被邀请用户注册结果: %v", registerResp["code"])
		}

		// 3. 检查邀请统计
		t.Log("步骤3: 检查邀请统计")
		req, _ = http.NewRequest("GET", baseURL+"/api/invitation/history", nil)
		req.Header.Set("Authorization", "Bearer "+inviterToken)

		resp, err = client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var historyResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&historyResp)
		require.NoError(t, err)

		t.Logf("邀请历史查询结果: %v", historyResp["code"])
	})
}

// BenchmarkComprehensivePerformance 性能基准测试
func BenchmarkComprehensivePerformance(b *testing.B) {
	gin.SetMode(gin.TestMode)
	app := NewTestAutoAdsSaaSApp()
	server := httptest.NewServer(app.Router)
	defer server.Close()

	b.Run("HealthCheck", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			resp, err := http.Get(server.URL + "/health")
			if err != nil {
				b.Fatal(err)
			}
			resp.Body.Close()
		}
	})

	b.Run("SiteRankQuery", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			resp, err := http.Get(server.URL + "/api/siterank/rank?domain=example.com")
			if err != nil {
				b.Fatal(err)
			}
			resp.Body.Close()
		}
	})

	b.Run("BatchGoCreate", func(b *testing.B) {
		payload := map[string]interface{}{
			"name": "benchmark_task",
			"urls": []string{"https://example.com"},
		}
		jsonData, _ := json.Marshal(payload)

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			resp, err := http.Post(server.URL+"/api/batchopen/silent-start", "application/json", bytes.NewBuffer(jsonData))
			if err != nil {
				b.Fatal(err)
			}
			resp.Body.Close()
		}
	})
}
