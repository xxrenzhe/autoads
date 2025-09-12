package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSecurityValidation 安全测试专项
func TestSecurityValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	app := NewAutoAdsSaaSApp()
	server := httptest.NewServer(app.Router)
	defer server.Close()

	t.Run("用户数据隔离测试", func(t *testing.T) {
		testUserDataIsolation(t, server.URL)
	})

	t.Run("Token消费准确性测试", func(t *testing.T) {
		testTokenConsumptionAccuracy(t, server.URL)
	})

	t.Run("认证授权验证", func(t *testing.T) {
		testAuthenticationAuthorization(t, server.URL)
	})

	t.Run("输入验证和注入防护", func(t *testing.T) {
		testInputValidationAndInjection(t, server.URL)
	})

	t.Run("限流和DDoS防护", func(t *testing.T) {
		testRateLimitingAndDDoSProtection(t, server.URL)
	})

	t.Run("会话安全", func(t *testing.T) {
		testSessionSecurity(t, server.URL)
	})
}

// testUserDataIsolation 测试用户数据隔离
func testUserDataIsolation(t *testing.T, baseURL string) {
	client := &http.Client{}

	// 模拟两个不同用户
	user1Token := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6InVzZXIxQGV4YW1wbGUuY29tIiwiZXhwIjo5OTk5OTk5OTk5fQ.test1"
	user2Token := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJlbWFpbCI6InVzZXIyQGV4YW1wbGUuY29tIiwiZXhwIjo5OTk5OTk5OTk5fQ.test2"

	t.Run("BatchGo任务隔离", func(t *testing.T) {
		// 用户1创建任务
		payload1 := map[string]interface{}{
			"name": "用户1的私有任务",
			"urls": []string{"https://user1-private.com"},
			"type": "silent",
		}

		jsonData1, _ := json.Marshal(payload1)
		req1, _ := http.NewRequest("POST", baseURL+"/api/batchopen/silent-start", bytes.NewBuffer(jsonData1))
		req1.Header.Set("Authorization", "Bearer "+user1Token)
		req1.Header.Set("Content-Type", "application/json")

		resp1, err := client.Do(req1)
		require.NoError(t, err)
		defer resp1.Body.Close()

		var createResp1 map[string]interface{}
		err = json.NewDecoder(resp1.Body).Decode(&createResp1)
		require.NoError(t, err)

		var user1TaskID interface{}
		if createResp1["code"].(float64) == 0 {
			data := createResp1["data"].(map[string]interface{})
			user1TaskID = data["task_id"]
		}

		// 用户2尝试访问用户1的任务列表
		req2, _ := http.NewRequest("GET", baseURL+"/api/batchopen/tasks", nil)
		req2.Header.Set("Authorization", "Bearer "+user2Token)

		resp2, err := client.Do(req2)
		require.NoError(t, err)
		defer resp2.Body.Close()

		var listResp2 map[string]interface{}
		err = json.NewDecoder(resp2.Body).Decode(&listResp2)
		require.NoError(t, err)

		// 用户2应该看不到用户1的任务
		if listResp2["code"].(float64) == 0 {
			tasks := listResp2["data"].([]interface{})
			for _, task := range tasks {
				taskMap := task.(map[string]interface{})
				assert.NotEqual(t, "用户1的私有任务", taskMap["name"], "用户2不应看到用户1的任务")
			}
		}

		// 用户2尝试直接访问用户1的任务详情
		if user1TaskID != nil {
			req3, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/batchopen/tasks/%v", baseURL, user1TaskID), nil)
			req3.Header.Set("Authorization", "Bearer "+user2Token)

			resp3, err := client.Do(req3)
			require.NoError(t, err)
			defer resp3.Body.Close()

			var detailResp3 map[string]interface{}
			err = json.NewDecoder(resp3.Body).Decode(&detailResp3)
			require.NoError(t, err)

			// 应该返回权限错误或找不到
			code := detailResp3["code"].(float64)
			assert.True(t, code == 3003 || code == 4004, "应该返回权限错误或资源不存在")
		}
	})

	t.Run("SiteRank查询隔离", func(t *testing.T) {
		// 用户1执行查询
		req1, _ := http.NewRequest("GET", baseURL+"/api/siterank/rank?domain=user1-private.com", nil)
		req1.Header.Set("Authorization", "Bearer "+user1Token)

		resp1, err := client.Do(req1)
		require.NoError(t, err)
		defer resp1.Body.Close()

		// 用户2查看查询历史，应该看不到用户1的查询
		req2, _ := http.NewRequest("GET", baseURL+"/api/siterank/history", nil)
		req2.Header.Set("Authorization", "Bearer "+user2Token)

		resp2, err := client.Do(req2)
		require.NoError(t, err)
		defer resp2.Body.Close()

		var historyResp map[string]interface{}
		err = json.NewDecoder(resp2.Body).Decode(&historyResp)
		require.NoError(t, err)

		if historyResp["code"].(float64) == 0 {
			queries := historyResp["data"].([]interface{})
			for _, query := range queries {
				queryMap := query.(map[string]interface{})
				assert.NotEqual(t, "user1-private.com", queryMap["domain"], "用户2不应看到用户1的查询历史")
			}
		}
	})

	t.Run("Token交易记录隔离", func(t *testing.T) {
		// 用户1查看Token交易记录
		req1, _ := http.NewRequest("GET", baseURL+"/api/tokens/transactions", nil)
		req1.Header.Set("Authorization", "Bearer "+user1Token)

		resp1, err := client.Do(req1)
		require.NoError(t, err)
		defer resp1.Body.Close()

		var transactions1 map[string]interface{}
		err = json.NewDecoder(resp1.Body).Decode(&transactions1)
		require.NoError(t, err)

		// 用户2查看Token交易记录
		req2, _ := http.NewRequest("GET", baseURL+"/api/tokens/transactions", nil)
		req2.Header.Set("Authorization", "Bearer "+user2Token)

		resp2, err := client.Do(req2)
		require.NoError(t, err)
		defer resp2.Body.Close()

		var transactions2 map[string]interface{}
		err = json.NewDecoder(resp2.Body).Decode(&transactions2)
		require.NoError(t, err)

		// 两个用户的交易记录应该完全不同
		if transactions1["code"].(float64) == 0 && transactions2["code"].(float64) == 0 {
			data1 := transactions1["data"].([]interface{})
			data2 := transactions2["data"].([]interface{})

			// 检查是否有重叠的交易记录
			for _, tx1 := range data1 {
				tx1Map := tx1.(map[string]interface{})
				for _, tx2 := range data2 {
					tx2Map := tx2.(map[string]interface{})
					assert.NotEqual(t, tx1Map["id"], tx2Map["id"], "不同用户不应有相同的交易记录")
				}
			}
		}
	})

	t.Run("个人信息隔离", func(t *testing.T) {
		// 用户1获取个人信息
		req1, _ := http.NewRequest("GET", baseURL+"/api/user/profile", nil)
		req1.Header.Set("Authorization", "Bearer "+user1Token)

		resp1, err := client.Do(req1)
		require.NoError(t, err)
		defer resp1.Body.Close()

		var profile1 map[string]interface{}
		err = json.NewDecoder(resp1.Body).Decode(&profile1)
		require.NoError(t, err)

		// 用户2获取个人信息
		req2, _ := http.NewRequest("GET", baseURL+"/api/user/profile", nil)
		req2.Header.Set("Authorization", "Bearer "+user2Token)

		resp2, err := client.Do(req2)
		require.NoError(t, err)
		defer resp2.Body.Close()

		var profile2 map[string]interface{}
		err = json.NewDecoder(resp2.Body).Decode(&profile2)
		require.NoError(t, err)

		// 验证用户信息不同
		if profile1["code"].(float64) == 0 && profile2["code"].(float64) == 0 {
			data1 := profile1["data"].(map[string]interface{})
			data2 := profile2["data"].(map[string]interface{})

			assert.NotEqual(t, data1["id"], data2["id"], "不同用户应有不同的ID")
			assert.NotEqual(t, data1["email"], data2["email"], "不同用户应有不同的邮箱")
		}
	})
}

// testTokenConsumptionAccuracy 测试Token消费准确性
func testTokenConsumptionAccuracy(t *testing.T, baseURL string) {
	client := &http.Client{}
	userToken := "test_user_token_for_consumption"

	// 获取初始Token余额
	getBalance := func() int {
		req, _ := http.NewRequest("GET", baseURL+"/api/tokens/balance", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp, err := client.Do(req)
		if err != nil {
			return -1
		}
		defer resp.Body.Close()

		var balanceResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&balanceResp)
		if err != nil {
			return -1
		}

		if balanceResp["code"].(float64) == 0 {
			data := balanceResp["data"].(map[string]interface{})
			return int(data["balance"].(float64))
		}
		return -1
	}

	t.Run("SiteRank查询Token消费", func(t *testing.T) {
		initialBalance := getBalance()
		if initialBalance < 0 {
			t.Skip("无法获取初始Token余额")
		}

		// 执行SiteRank查询 (应消费1个Token)
		req, _ := http.NewRequest("GET", baseURL+"/api/siterank/rank?domain=token-test.com", nil)
		req.Header.Set("Authorization", "Bearer "+userToken)

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var queryResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&queryResp)
		require.NoError(t, err)

		// 检查Token余额变化
		finalBalance := getBalance()
		if finalBalance >= 0 && queryResp["code"].(float64) == 0 {
			expectedBalance := initialBalance - 1
			assert.Equal(t, expectedBalance, finalBalance, "SiteRank查询应消费1个Token")
		}
	})

	t.Run("BatchGo HTTP模式Token消费", func(t *testing.T) {
		initialBalance := getBalance()
		if initialBalance < 0 {
			t.Skip("无法获取初始Token余额")
		}

		// 创建HTTP模式BatchGo任务 (2个URL，应消费2个Token)
		payload := map[string]interface{}{
			"name":        "Token消费测试",
			"urls":        []string{"https://example1.com", "https://example2.com"},
			"access_mode": "http",
		}

		jsonData, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", baseURL+"/api/batchopen/silent-start", bytes.NewBuffer(jsonData))
		req.Header.Set("Authorization", "Bearer "+userToken)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var taskResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&taskResp)
		require.NoError(t, err)

		// 检查Token余额变化
		finalBalance := getBalance()
		if finalBalance >= 0 && taskResp["code"].(float64) == 0 {
			expectedBalance := initialBalance - 2 // 2个URL，HTTP模式每个1Token
			assert.Equal(t, expectedBalance, finalBalance, "HTTP模式BatchGo应按URL数量消费Token")
		}
	})

	t.Run("BatchGo Puppeteer模式Token消费", func(t *testing.T) {
		initialBalance := getBalance()
		if initialBalance < 0 {
			t.Skip("无法获取初始Token余额")
		}

		// 创建Puppeteer模式BatchGo任务 (2个URL，应消费4个Token)
		payload := map[string]interface{}{
			"name":        "Puppeteer Token消费测试",
			"urls":        []string{"https://example1.com", "https://example2.com"},
			"access_mode": "puppeteer",
		}

		jsonData, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", baseURL+"/api/batchopen/silent-start", bytes.NewBuffer(jsonData))
		req.Header.Set("Authorization", "Bearer "+userToken)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var taskResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&taskResp)
		require.NoError(t, err)

		// 检查Token余额变化
		finalBalance := getBalance()
		if finalBalance >= 0 && taskResp["code"].(float64) == 0 {
			expectedBalance := initialBalance - 4 // 2个URL，Puppeteer模式每个2Token
			assert.Equal(t, expectedBalance, finalBalance, "Puppeteer模式BatchGo应按2倍URL数量消费Token")
		}
	})

	t.Run("Chengelink Token消费", func(t *testing.T) {
		initialBalance := getBalance()
		if initialBalance < 0 {
			t.Skip("无法获取初始Token余额")
		}

		// 创建Chengelink任务 (链接提取1Token + 广告更新3Token/广告)
		payload := map[string]interface{}{
			"name":               "Chengelink Token消费测试",
			"affiliate_link":     "https://example.com/affiliate",
			"adspower_env":       "test_env",
			"google_ads_account": "test_account",
		}

		jsonData, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", baseURL+"/api/chengelink/create", bytes.NewBuffer(jsonData))
		req.Header.Set("Authorization", "Bearer "+userToken)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var taskResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&taskResp)
		require.NoError(t, err)

		// 检查Token余额变化
		finalBalance := getBalance()
		if finalBalance >= 0 && taskResp["code"].(float64) == 0 {
			// 至少应消费链接提取的1个Token
			assert.LessOrEqual(t, finalBalance, initialBalance-1, "Chengelink任务应至少消费1个Token")
		}
	})

	t.Run("Token不足时的处理", func(t *testing.T) {
		// 模拟Token不足的用户
		lowTokenUser := "low_token_user"

		// 尝试执行需要Token的操作
		req, _ := http.NewRequest("GET", baseURL+"/api/siterank/rank?domain=insufficient-token-test.com", nil)
		req.Header.Set("Authorization", "Bearer "+lowTokenUser)

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		var queryResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&queryResp)
		require.NoError(t, err)

		// 应该返回Token不足错误
		code := queryResp["code"].(float64)
		if code != 0 {
			assert.True(t, code == 2001 || code == 2002, "Token不足应返回相应错误码")
			message := queryResp["message"].(string)
			assert.Contains(t, strings.ToLower(message), "token", "错误消息应提及Token")
		}
	})
}

// testAuthenticationAuthorization 测试认证授权
func testAuthenticationAuthorization(t *testing.T, baseURL string) {
	client := &http.Client{}

	t.Run("无Token访问保护资源", func(t *testing.T) {
		protectedEndpoints := []string{
			"/api/user/profile",
			"/api/tokens/balance",
			"/api/batchopen/tasks",
			"/api/siterank/history",
			"/api/chengelink/tasks",
		}

		for _, endpoint := range protectedEndpoints {
			t.Run(endpoint, func(t *testing.T) {
				resp, err := http.Get(baseURL + endpoint)
				require.NoError(t, err)
				defer resp.Body.Close()

				assert.Equal(t, 401, resp.StatusCode, "无Token访问应返回401")

				var response map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&response)
				require.NoError(t, err)

				code := response["code"].(float64)
				assert.True(t, code == 3001 || code == 401, "应返回认证错误码")
			})
		}
	})

	t.Run("无效Token访问", func(t *testing.T) {
		invalidTokens := []string{
			"invalid_token",
			"expired.token.here",
			"malformed-token",
			"",
		}

		for _, token := range invalidTokens {
			t.Run(fmt.Sprintf("Token: %s", token), func(t *testing.T) {
				req, _ := http.NewRequest("GET", baseURL+"/api/user/profile", nil)
				if token != "" {
					req.Header.Set("Authorization", "Bearer "+token)
				}

				resp, err := client.Do(req)
				require.NoError(t, err)
				defer resp.Body.Close()

				assert.Equal(t, 401, resp.StatusCode, "无效Token应返回401")
			})
		}
	})

	t.Run("Token格式验证", func(t *testing.T) {
		malformedTokens := []string{
			"Bearer",
			"Bearer ",
			"Basic dGVzdDp0ZXN0", // Basic auth instead of Bearer
			"token_without_bearer",
		}

		for _, authHeader := range malformedTokens {
			t.Run(fmt.Sprintf("Auth: %s", authHeader), func(t *testing.T) {
				req, _ := http.NewRequest("GET", baseURL+"/api/user/profile", nil)
				req.Header.Set("Authorization", authHeader)

				resp, err := client.Do(req)
				require.NoError(t, err)
				defer resp.Body.Close()

				assert.Equal(t, 401, resp.StatusCode, "格式错误的Token应返回401")
			})
		}
	})

	t.Run("管理员权限验证", func(t *testing.T) {
		// 普通用户Token
		userToken := "user_token"

		adminEndpoints := []string{
			"/admin/users",
			"/admin/system/config",
			"/admin/audit/security-events",
		}

		for _, endpoint := range adminEndpoints {
			t.Run(endpoint, func(t *testing.T) {
				req, _ := http.NewRequest("GET", baseURL+endpoint, nil)
				req.Header.Set("Authorization", "Bearer "+userToken)

				resp, err := client.Do(req)
				require.NoError(t, err)
				defer resp.Body.Close()

				// 应该返回权限不足错误
				assert.True(t, resp.StatusCode == 403 || resp.StatusCode == 401, "普通用户访问管理员接口应返回403或401")
			})
		}
	})

	t.Run("Token过期处理", func(t *testing.T) {
		// 模拟过期Token
		expiredToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE2MDAwMDAwMDB9.expired"

		req, _ := http.NewRequest("GET", baseURL+"/api/user/profile", nil)
		req.Header.Set("Authorization", "Bearer "+expiredToken)

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, 401, resp.StatusCode, "过期Token应返回401")

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		message := response["message"].(string)
		assert.Contains(t, strings.ToLower(message), "expired", "错误消息应提及过期")
	})
}

// testInputValidationAndInjection 测试输入验证和注入防护
func testInputValidationAndInjection(t *testing.T, baseURL string) {
	client := &http.Client{}

	t.Run("SQL注入防护", func(t *testing.T) {
		sqlInjectionPayloads := []string{
			"'; DROP TABLE users; --",
			"' OR '1'='1",
			"'; UPDATE users SET password='hacked'; --",
			"' UNION SELECT * FROM users --",
		}

		for _, payload := range sqlInjectionPayloads {
			t.Run(fmt.Sprintf("Payload: %s", payload), func(t *testing.T) {
				// 测试域名参数注入
				resp, err := http.Get(baseURL + "/api/siterank/rank?domain=" + payload)
				require.NoError(t, err)
				defer resp.Body.Close()

				var response map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&response)
				require.NoError(t, err)

				// 应该返回参数验证错误，而不是执行SQL
				code := response["code"].(float64)
				assert.True(t, code >= 1000 && code < 2000, "SQL注入应被参数验证拦截")
			})
		}
	})

	t.Run("XSS防护", func(t *testing.T) {
		xssPayloads := []string{
			"<script>alert('xss')</script>",
			"javascript:alert('xss')",
			"<img src=x onerror=alert('xss')>",
			"<svg onload=alert('xss')>",
		}

		for _, payload := range xssPayloads {
			t.Run(fmt.Sprintf("Payload: %s", payload), func(t *testing.T) {
				taskPayload := map[string]interface{}{
					"name": payload,
					"urls": []string{"https://example.com"},
				}

				jsonData, _ := json.Marshal(taskPayload)
				resp, err := client.Post(baseURL+"/api/batchopen/silent-start", "application/json", bytes.NewBuffer(jsonData))
				require.NoError(t, err)
				defer resp.Body.Close()

				var response map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&response)
				require.NoError(t, err)

				// 检查响应中是否包含未转义的脚本
				responseStr, _ := json.Marshal(response)
				assert.NotContains(t, string(responseStr), "<script>", "响应不应包含未转义的脚本标签")
				assert.NotContains(t, string(responseStr), "javascript:", "响应不应包含javascript协议")
			})
		}
	})

	t.Run("路径遍历防护", func(t *testing.T) {
		pathTraversalPayloads := []string{
			"../../../etc/passwd",
			"..\\..\\..\\windows\\system32\\config\\sam",
			"%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
			"....//....//....//etc/passwd",
		}

		for _, payload := range pathTraversalPayloads {
			t.Run(fmt.Sprintf("Payload: %s", payload), func(t *testing.T) {
				resp, err := http.Get(baseURL + "/api/files/" + payload)
				require.NoError(t, err)
				defer resp.Body.Close()

				// 应该返回404或403，而不是文件内容
				assert.True(t, resp.StatusCode == 404 || resp.StatusCode == 403, "路径遍历应被阻止")
			})
		}
	})

	t.Run("命令注入防护", func(t *testing.T) {
		commandInjectionPayloads := []string{
			"; ls -la",
			"| cat /etc/passwd",
			"&& rm -rf /",
			"`whoami`",
		}

		for _, payload := range commandInjectionPayloads {
			t.Run(fmt.Sprintf("Payload: %s", payload), func(t *testing.T) {
				taskPayload := map[string]interface{}{
					"name":      "test",
					"urls":      []string{"https://example.com"},
					"proxy_url": "http://proxy.com:8080" + payload,
				}

				jsonData, _ := json.Marshal(taskPayload)
				resp, err := client.Post(baseURL+"/api/batchopen/silent-start", "application/json", bytes.NewBuffer(jsonData))
				require.NoError(t, err)
				defer resp.Body.Close()

				var response map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&response)
				require.NoError(t, err)

				// 应该返回参数验证错误
				code := response["code"].(float64)
				assert.True(t, code >= 1000 && code < 2000, "命令注入应被参数验证拦截")
			})
		}
	})

	t.Run("大文件上传防护", func(t *testing.T) {
		// 创建大文件内容 (模拟)
		largeContent := strings.Repeat("A", 100*1024*1024) // 100MB

		resp, err := client.Post(baseURL+"/api/upload/single", "text/plain", strings.NewReader(largeContent))
		require.NoError(t, err)
		defer resp.Body.Close()

		// 应该返回文件过大错误
		assert.True(t, resp.StatusCode == 413 || resp.StatusCode == 400, "大文件上传应被拒绝")
	})
}

// testRateLimitingAndDDoSProtection 测试限流和DDoS防护
func testRateLimitingAndDDoSProtection(t *testing.T, baseURL string) {
	t.Run("API限流测试", func(t *testing.T) {
		client := &http.Client{Timeout: 5 * time.Second}

		var rateLimitHit bool
		var successCount, errorCount int

		// 快速发送大量请求
		for i := 0; i < 200; i++ {
			resp, err := client.Get(baseURL + "/api/siterank/rank?domain=ratelimit-test.com")
			if err != nil {
				errorCount++
				continue
			}

			if resp.StatusCode == 429 {
				rateLimitHit = true
				resp.Body.Close()
				break
			} else if resp.StatusCode == 200 {
				successCount++
			}
			resp.Body.Close()
		}

		assert.True(t, rateLimitHit, "应该触发限流机制")
		t.Logf("成功请求: %d, 错误请求: %d", successCount, errorCount)
	})

	t.Run("并发限流测试", func(t *testing.T) {
		concurrency := 100
		var wg sync.WaitGroup
		var rateLimitCount int32
		var mu sync.Mutex

		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()

				client := &http.Client{Timeout: 5 * time.Second}
				resp, err := client.Get(baseURL + "/api/siterank/rank?domain=concurrent-test.com")
				if err != nil {
					return
				}
				defer resp.Body.Close()

				if resp.StatusCode == 429 {
					mu.Lock()
					rateLimitCount++
					mu.Unlock()
				}
			}()
		}

		wg.Wait()

		assert.Greater(t, rateLimitCount, int32(0), "并发请求应触发限流")
		t.Logf("限流请求数: %d", rateLimitCount)
	})

	t.Run("IP限流测试", func(t *testing.T) {
		// 模拟不同IP的请求
		ips := []string{
			"192.168.1.1",
			"192.168.1.2",
			"192.168.1.3",
		}

		for _, ip := range ips {
			t.Run(fmt.Sprintf("IP: %s", ip), func(t *testing.T) {
				client := &http.Client{}

				var rateLimitHit bool
				for i := 0; i < 150; i++ {
					req, _ := http.NewRequest("GET", baseURL+"/api/siterank/rank?domain=ip-test.com", nil)
					req.Header.Set("X-Forwarded-For", ip)
					req.Header.Set("X-Real-IP", ip)

					resp, err := client.Do(req)
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

				// 每个IP应该独立限流
				assert.True(t, rateLimitHit, fmt.Sprintf("IP %s 应该被独立限流", ip))
			})
		}
	})

	t.Run("慢速攻击防护", func(t *testing.T) {
		client := &http.Client{Timeout: 30 * time.Second}

		// 发送慢速请求
		req, _ := http.NewRequest("POST", baseURL+"/api/batchopen/silent-start", strings.NewReader(`{"name":"slow`))
		req.Header.Set("Content-Type", "application/json")

		start := time.Now()
		resp, err := client.Do(req)
		duration := time.Since(start)

		if err == nil {
			defer resp.Body.Close()
		}

		// 服务器应该在合理时间内关闭连接
		assert.Less(t, duration, 10*time.Second, "慢速请求应被及时关闭")
	})
}

// testSessionSecurity 测试会话安全
func testSessionSecurity(t *testing.T, baseURL string) {
	client := &http.Client{}

	t.Run("会话固定攻击防护", func(t *testing.T) {
		// 获取初始会话
		resp1, err := client.Get(baseURL + "/api/auth/session")
		require.NoError(t, err)
		defer resp1.Body.Close()

		sessionCookie1 := resp1.Header.Get("Set-Cookie")

		// 模拟登录
		loginPayload := map[string]interface{}{
			"email":    "test@example.com",
			"password": "password123",
		}

		jsonData, _ := json.Marshal(loginPayload)
		req, _ := http.NewRequest("POST", baseURL+"/api/auth/login", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		if sessionCookie1 != "" {
			req.Header.Set("Cookie", sessionCookie1)
		}

		resp2, err := client.Do(req)
		require.NoError(t, err)
		defer resp2.Body.Close()

		sessionCookie2 := resp2.Header.Get("Set-Cookie")

		// 登录后应该生成新的会话ID
		if sessionCookie1 != "" && sessionCookie2 != "" {
			assert.NotEqual(t, sessionCookie1, sessionCookie2, "登录后应生成新的会话ID")
		}
	})

	t.Run("会话超时测试", func(t *testing.T) {
		// 模拟过期会话
		req, _ := http.NewRequest("GET", baseURL+"/api/user/profile", nil)
		req.Header.Set("Cookie", "session_id=expired_session_12345")

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, 401, resp.StatusCode, "过期会话应返回401")
	})

	t.Run("安全头检查", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/user/profile")
		require.NoError(t, err)
		defer resp.Body.Close()

		// 检查安全头
		assert.Equal(t, "nosniff", resp.Header.Get("X-Content-Type-Options"), "应设置X-Content-Type-Options")
		assert.Equal(t, "DENY", resp.Header.Get("X-Frame-Options"), "应设置X-Frame-Options")
		assert.Equal(t, "1; mode=block", resp.Header.Get("X-XSS-Protection"), "应设置X-XSS-Protection")
		assert.Contains(t, resp.Header.Get("Referrer-Policy"), "strict-origin", "应设置Referrer-Policy")
	})

	t.Run("CORS安全配置", func(t *testing.T) {
		req, _ := http.NewRequest("OPTIONS", baseURL+"/api/user/profile", nil)
		req.Header.Set("Origin", "https://malicious-site.com")
		req.Header.Set("Access-Control-Request-Method", "GET")

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		// 检查CORS配置
		allowOrigin := resp.Header.Get("Access-Control-Allow-Origin")
		if allowOrigin != "*" {
			// 如果不是通配符，应该验证Origin
			assert.NotEqual(t, "https://malicious-site.com", allowOrigin, "不应允许恶意域名")
		}
	})
}
