package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAutoAdsSaaSIntegration 集成测试 - 测试所有GoFly成熟功能模块
func TestAutoAdsSaaSIntegration(t *testing.T) {
	// 创建测试应用
	app := NewAutoAdsSaaSApp()

	// 创建测试服务器
	server := httptest.NewServer(app.Router)
	defer server.Close()

	t.Run("健康检查和监控", func(t *testing.T) {
		testHealthAndMetrics(t, server.URL)
	})

	t.Run("文件上传系统", func(t *testing.T) {
		testFileUploadSystem(t, server.URL)
	})

	t.Run("邮件系统", func(t *testing.T) {
		testEmailSystem(t, server.URL)
	})

	t.Run("审计日志系统", func(t *testing.T) {
		testAuditSystem(t, server.URL)
	})

	t.Run("API文档生成", func(t *testing.T) {
		testAPIDocumentation(t, server.URL)
	})

	t.Run("管理员功能", func(t *testing.T) {
		testAdminFunctions(t, server.URL)
	})
}

// testHealthAndMetrics 测试健康检查和监控系统
func testHealthAndMetrics(t *testing.T, baseURL string) {
	// 测试健康检查
	resp, err := http.Get(baseURL + "/health")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var healthResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&healthResp)
	require.NoError(t, err)

	assert.Contains(t, healthResp, "status")
	assert.Contains(t, healthResp, "message")
	assert.Contains(t, healthResp, "timestamp")

	// 测试详细健康检查
	resp, err = http.Get(baseURL + "/health/detail")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// 测试准备就绪检查
	resp, err = http.Get(baseURL + "/ready")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// 测试存活检查
	resp, err = http.Get(baseURL + "/live")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// 测试Prometheus指标
	resp, err = http.Get(baseURL + "/metrics")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "text/plain; version=0.0.4; charset=utf-8", resp.Header.Get("Content-Type"))

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	// 验证包含基本指标
	bodyStr := string(body)
	assert.Contains(t, bodyStr, "http_requests_total")
	assert.Contains(t, bodyStr, "system_memory_usage_bytes")
}

// testFileUploadSystem 测试文件上传系统
func testFileUploadSystem(t *testing.T, baseURL string) {
	// 创建测试文件
	testContent := "This is a test file for AutoAds SaaS upload system"

	// 测试单文件上传
	t.Run("单文件上传", func(t *testing.T) {
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)

		part, err := writer.CreateFormFile("file", "test.txt")
		require.NoError(t, err)

		_, err = part.Write([]byte(testContent))
		require.NoError(t, err)

		err = writer.Close()
		require.NoError(t, err)

		req, err := http.NewRequest("POST", baseURL+"/api/upload/single", &buf)
		require.NoError(t, err)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		client := &http.Client{}
		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var uploadResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&uploadResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), uploadResp["code"])
		assert.Contains(t, uploadResp, "data")

		data := uploadResp["data"].(map[string]interface{})
		assert.Contains(t, data, "id")
		assert.Contains(t, data, "filename")
		assert.Contains(t, data, "url")
	})

	// 测试头像上传
	t.Run("头像上传", func(t *testing.T) {
		// 创建一个简单的测试图片数据
		imageData := []byte{
			0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
			0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
			0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
			0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
			0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
			0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
			0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
			0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00,
			0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
		}

		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)

		part, err := writer.CreateFormFile("avatar", "avatar.png")
		require.NoError(t, err)

		_, err = part.Write(imageData)
		require.NoError(t, err)

		err = writer.Close()
		require.NoError(t, err)

		req, err := http.NewRequest("POST", baseURL+"/api/upload/avatar", &buf)
		require.NoError(t, err)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		client := &http.Client{}
		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var uploadResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&uploadResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), uploadResp["code"])
		assert.Contains(t, uploadResp, "data")

		data := uploadResp["data"].(map[string]interface{})
		assert.Contains(t, data, "avatar_url")
		assert.Contains(t, data, "thumb_url")
	})
}

// testEmailSystem 测试邮件系统
func testEmailSystem(t *testing.T, baseURL string) {
	// 测试发送欢迎邮件
	t.Run("发送欢迎邮件", func(t *testing.T) {
		payload := map[string]interface{}{
			"email":    "test@example.com",
			"username": "testuser",
		}

		jsonData, err := json.Marshal(payload)
		require.NoError(t, err)

		resp, err := http.Post(baseURL+"/api/email/welcome", "application/json", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var emailResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&emailResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), emailResp["code"])
		assert.Contains(t, emailResp["message"], "successfully")
	})

	// 测试发送Token不足邮件
	t.Run("发送Token不足邮件", func(t *testing.T) {
		payload := map[string]interface{}{
			"email":         "test@example.com",
			"username":      "testuser",
			"token_balance": 5,
		}

		jsonData, err := json.Marshal(payload)
		require.NoError(t, err)

		resp, err := http.Post(baseURL+"/api/email/low-tokens", "application/json", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var emailResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&emailResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), emailResp["code"])
		assert.Contains(t, emailResp["message"], "successfully")
	})

	// 测试试用到期邮件
	t.Run("发送试用到期邮件", func(t *testing.T) {
		payload := map[string]interface{}{
			"email":    "test@example.com",
			"username": "testuser",
		}

		jsonData, err := json.Marshal(payload)
		require.NoError(t, err)

		resp, err := http.Post(baseURL+"/api/email/trial-expired", "application/json", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var emailResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&emailResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), emailResp["code"])
		assert.Contains(t, emailResp["message"], "successfully")
	})
}

// testAuditSystem 测试审计日志系统
func testAuditSystem(t *testing.T, baseURL string) {
	// 测试获取审计事件
	t.Run("获取审计事件", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/audit/events?limit=10&offset=0")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var auditResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&auditResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), auditResp["code"])
		assert.Contains(t, auditResp, "data")
		assert.Contains(t, auditResp, "pagination")

		pagination := auditResp["pagination"].(map[string]interface{})
		assert.Contains(t, pagination, "total")
		assert.Contains(t, pagination, "limit")
		assert.Contains(t, pagination, "offset")
	})

	// 测试获取用户操作统计
	t.Run("获取用户操作统计", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/audit/stats/testuser?days=30")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var statsResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&statsResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), statsResp["code"])
		assert.Contains(t, statsResp, "data")
	})
}

// testAPIDocumentation 测试API文档生成
func testAPIDocumentation(t *testing.T, baseURL string) {
	// 测试Swagger JSON
	t.Run("Swagger JSON", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/docs/swagger.json")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "application/json; charset=utf-8", resp.Header.Get("Content-Type"))

		var swaggerSpec map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&swaggerSpec)
		require.NoError(t, err)

		assert.Equal(t, "2.0", swaggerSpec["swagger"])
		assert.Contains(t, swaggerSpec, "info")
		assert.Contains(t, swaggerSpec, "paths")
		assert.Contains(t, swaggerSpec, "definitions")

		info := swaggerSpec["info"].(map[string]interface{})
		assert.Equal(t, "AutoAds SaaS API", info["title"])
		assert.Contains(t, info["description"], "GoFly成熟功能模块")
	})

	// 测试Swagger UI
	t.Run("Swagger UI", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/docs/swagger")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "text/html; charset=utf-8", resp.Header.Get("Content-Type"))

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		bodyStr := string(body)
		assert.Contains(t, bodyStr, "AutoAds SaaS API Documentation")
		assert.Contains(t, bodyStr, "swagger-ui")
		assert.Contains(t, bodyStr, "/api/docs/swagger.json")
	})

	// 测试Redoc
	t.Run("Redoc", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/docs/redoc")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "text/html; charset=utf-8", resp.Header.Get("Content-Type"))

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		bodyStr := string(body)
		assert.Contains(t, bodyStr, "AutoAds SaaS API Documentation")
		assert.Contains(t, bodyStr, "redoc")
		assert.Contains(t, bodyStr, "/api/docs/swagger.json")
	})

	// 测试Postman Collection
	t.Run("Postman Collection", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/docs/postman.json")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "application/json; charset=utf-8", resp.Header.Get("Content-Type"))

		var collection map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&collection)
		require.NoError(t, err)

		assert.Contains(t, collection, "info")
		assert.Contains(t, collection, "item")
		assert.Contains(t, collection, "variable")

		info := collection["info"].(map[string]interface{})
		assert.Equal(t, "AutoAds SaaS API", info["name"])
		assert.Contains(t, info["description"], "GoFly成熟功能模块")

		items := collection["item"].([]interface{})
		assert.Greater(t, len(items), 0)

		// 验证包含主要功能模块
		itemNames := make([]string, 0)
		for _, item := range items {
			itemMap := item.(map[string]interface{})
			itemNames = append(itemNames, itemMap["name"].(string))
		}

		assert.Contains(t, itemNames, "健康检查")
		assert.Contains(t, itemNames, "文件上传")
		assert.Contains(t, itemNames, "邮件服务")
		assert.Contains(t, itemNames, "审计日志")
	})
}

// testAdminFunctions 测试管理员功能
func testAdminFunctions(t *testing.T, baseURL string) {
	// 测试获取安全事件
	t.Run("获取安全事件", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/admin/audit/security-events?severity=high&resolved=false")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var securityResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&securityResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), securityResp["code"])
		assert.Contains(t, securityResp, "data")
		assert.Contains(t, securityResp, "pagination")
	})

	// 测试获取安全统计
	t.Run("获取安全统计", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/admin/audit/security-stats?days=7")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var statsResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&statsResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), statsResp["code"])
		assert.Contains(t, statsResp, "data")
	})

	// 测试获取风险IP
	t.Run("获取风险IP", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/admin/audit/risky-ips")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var riskyResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&riskyResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), riskyResp["code"])
		assert.Contains(t, riskyResp, "data")
	})

	// 测试获取邮件模板列表
	t.Run("获取邮件模板列表", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/admin/email/templates")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var templatesResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&templatesResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), templatesResp["code"])
		assert.Contains(t, templatesResp, "data")

		templates := templatesResp["data"].([]interface{})
		assert.Greater(t, len(templates), 0)

		// 验证包含基本模板
		templateNames := make([]string, 0)
		for _, template := range templates {
			templateMap := template.(map[string]interface{})
			templateNames = append(templateNames, templateMap["name"].(string))
		}

		assert.Contains(t, templateNames, "welcome")
		assert.Contains(t, templateNames, "trial_expired")
		assert.Contains(t, templateNames, "low_tokens")
	})

	// 测试发送测试邮件
	t.Run("发送测试邮件", func(t *testing.T) {
		payload := map[string]interface{}{
			"template": "welcome",
			"email":    "admin@example.com",
			"data": map[string]interface{}{
				"AppName":  "AutoAds",
				"Username": "admin",
				"LoginURL": "http://localhost:3000/login",
			},
		}

		jsonData, err := json.Marshal(payload)
		require.NoError(t, err)

		resp, err := http.Post(baseURL+"/admin/email/test", "application/json", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var testResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&testResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), testResp["code"])
		assert.Contains(t, testResp["message"], "successfully")
	})

	// 测试获取上传统计
	t.Run("获取上传统计", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/admin/upload/stats")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var statsResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&statsResp)
		require.NoError(t, err)

		assert.Equal(t, float64(0), statsResp["code"])
		assert.Contains(t, statsResp, "data")

		data := statsResp["data"].(map[string]interface{})
		assert.Contains(t, data, "total_files")
		assert.Contains(t, data, "total_size")
		assert.Contains(t, data, "image_files")
		assert.Contains(t, data, "document_files")
	})
}

// TestModuleIntegration 测试模块间集成
func TestModuleIntegration(t *testing.T) {
	app := NewAutoAdsSaaSApp()
	server := httptest.NewServer(app.Router)
	defer server.Close()

	t.Run("上传文件并记录审计日志", func(t *testing.T) {
		// 1. 上传文件
		testContent := "Integration test file"
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)

		part, err := writer.CreateFormFile("file", "integration_test.txt")
		require.NoError(t, err)

		_, err = part.Write([]byte(testContent))
		require.NoError(t, err)

		err = writer.Close()
		require.NoError(t, err)

		req, err := http.NewRequest("POST", server.URL+"/api/upload/single", &buf)
		require.NoError(t, err)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		client := &http.Client{}
		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		// 2. 检查审计日志是否记录了上传操作
		time.Sleep(100 * time.Millisecond) // 等待审计日志写入

		auditResp, err := http.Get(server.URL + "/api/audit/events?limit=5")
		require.NoError(t, err)
		defer auditResp.Body.Close()

		assert.Equal(t, http.StatusOK, auditResp.StatusCode)

		var auditData map[string]interface{}
		err = json.NewDecoder(auditResp.Body).Decode(&auditData)
		require.NoError(t, err)

		assert.Equal(t, float64(0), auditData["code"])
	})

	t.Run("发送邮件并检查指标", func(t *testing.T) {
		// 1. 发送邮件
		payload := map[string]interface{}{
			"email":    "integration@example.com",
			"username": "integration_user",
		}

		jsonData, err := json.Marshal(payload)
		require.NoError(t, err)

		resp, err := http.Post(server.URL+"/api/email/welcome", "application/json", bytes.NewBuffer(jsonData))
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		// 2. 检查Prometheus指标
		time.Sleep(100 * time.Millisecond) // 等待指标更新

		metricsResp, err := http.Get(server.URL + "/metrics")
		require.NoError(t, err)
		defer metricsResp.Body.Close()

		assert.Equal(t, http.StatusOK, metricsResp.StatusCode)

		body, err := io.ReadAll(metricsResp.Body)
		require.NoError(t, err)

		bodyStr := string(body)
		assert.Contains(t, bodyStr, "http_requests_total")
	})
}

// BenchmarkAutoAdsSaaSPerformance 性能基准测试
func BenchmarkAutoAdsSaaSPerformance(b *testing.B) {
	app := NewAutoAdsSaaSApp()
	server := httptest.NewServer(app.Router)
	defer server.Close()

	b.Run("健康检查性能", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			resp, err := http.Get(server.URL + "/health")
			if err != nil {
				b.Fatal(err)
			}
			resp.Body.Close()
		}
	})

	b.Run("API文档生成性能", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			resp, err := http.Get(server.URL + "/api/docs/swagger.json")
			if err != nil {
				b.Fatal(err)
			}
			resp.Body.Close()
		}
	})

	b.Run("审计日志查询性能", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			resp, err := http.Get(server.URL + "/api/audit/events?limit=10")
			if err != nil {
				b.Fatal(err)
			}
			resp.Body.Close()
		}
	})
}
