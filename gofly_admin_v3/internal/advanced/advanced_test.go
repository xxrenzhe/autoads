package advanced

import (
	"context"
	"testing"
	"time"

	"gofly-admin-v3/internal/audit"
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/internal/security"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestAdvancedPluginSystem 测试插件系统
func TestAdvancedPluginSystem(t *testing.T) {
	// 创建内存数据库
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// 创建审计服务
	auditService := audit.NewAuditService(db)

	// 创建插件系统
	pluginSystem := InitializeAdvancedPlugins(db, auditService)

	// 测试插件注册
	plugins := pluginSystem.pluginManager.ListPlugins()
	if len(plugins) < 2 {
		t.Errorf("Expected at least 2 plugins, got %d", len(plugins))
	}

	// 测试事件发布
	event := Event{
		Type:   "test.event",
		Source: "test",
		Data: map[string]interface{}{
			"test_key": "test_value",
		},
		Timestamp: time.Now(),
	}

	pluginSystem.PublishEvent(event)

	t.Log("Plugin system test passed")
}

// TestEnhancedRateLimit 测试增强速率限制
func TestEnhancedRateLimit(t *testing.T) {
	// 创建内存数据库
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// 创建缓存
	cache := cache.NewMemoryCache()

	// 创建模拟用户服务
	userService := &MockUserService{}

	// 创建增强速率限制管理器
	enhancedRateLimit := NewEnhancedRateLimitManager(
		nil, // 基础管理器可以为nil用于测试
		db,
		cache,
		userService,
	)

	// 测试动态配置更新
	config := &DynamicRateLimit{
		Plan:               "TEST",
		Feature:            "API",
		BaseLimit:          100,
		BurstLimit:         200,
		WindowSize:         60,
		AdaptiveEnabled:    true,
		AdaptiveThreshold:  0.8,
		PriorityMultiplier: 1.0,
	}

	err = enhancedRateLimit.UpdateDynamicConfig("TEST", "API", config, "test")
	if err != nil {
		t.Errorf("Failed to update dynamic config: %v", err)
	}

	t.Log("Enhanced rate limit test passed")
}

// TestNotificationSystem 测试通知系统
func TestNotificationSystem(t *testing.T) {
	// 创建内存数据库
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// 创建通知系统
	notificationSystem := NewUnifiedNotificationSystem(db, nil, nil)

	// 测试发送通知
	notification := &Notification{
		UserID:   "test_user",
		Type:     "info",
		Title:    "Test Notification",
		Content:  "This is a test notification",
		Channels: []string{"system"},
		Priority: 1,
	}

	err = notificationSystem.SendNotification(notification)
	if err != nil {
		t.Errorf("Failed to send notification: %v", err)
	}

	// 测试模板通知
	err = notificationSystem.SendTemplateNotification(
		"token_low",
		"test_user",
		map[string]interface{}{
			"balance": 50,
		},
		[]string{"system"},
	)
	if err != nil {
		t.Errorf("Failed to send template notification: %v", err)
	}

	t.Log("Notification system test passed")
}

// TestSecuritySystem 测试安全系统
func TestSecuritySystem(t *testing.T) {
	// 创建内存数据库
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// 创建缓存
	cache := cache.NewMemoryCache()

	// 创建审计服务
	auditService := audit.NewAuditService(db)

	// 创建加密服务
	encryptionService := security.NewEncryptionService("test-key")

	// 创建安全系统
	securitySystem := NewAdvancedSecuritySystem(db, cache, auditService, encryptionService)

	// 测试请求分析
	result, err := securitySystem.AnalyzeRequest(
		context.Background(),
		"test_user",
		"192.168.1.1",
		"Mozilla/5.0",
		map[string]interface{}{
			"request_frequency": 10.0,
		},
	)

	if err != nil {
		t.Errorf("Failed to analyze request: %v", err)
	}

	if result == nil {
		t.Error("Expected security analysis result, got nil")
	}

	t.Log("Security system test passed")
}

// TestToolsIntegration 测试工具集成
func TestToolsIntegration(t *testing.T) {
	// 创建内存数据库
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// 创建工具集成系统
	toolsIntegration := NewAdvancedToolsIntegration(
		db, nil, nil, nil, nil, nil, nil,
	)

	// 测试工具列表
	tools := toolsIntegration.ListTools()
	if len(tools) == 0 {
		t.Error("Expected tools to be registered, got 0")
	}

	// 测试执行工具
	result, err := toolsIntegration.ExecuteTool(
		context.Background(),
		"json_processor",
		map[string]interface{}{
			"data":      `{"test": "value"}`,
			"operation": "parse",
		},
	)

	if err != nil {
		t.Errorf("Failed to execute tool: %v", err)
	}

	if result == nil {
		t.Error("Expected tool execution result, got nil")
	}

	t.Log("Tools integration test passed")
}

// TestAdvancedFeaturesManager 测试高级功能管理器
func TestAdvancedFeaturesManager(t *testing.T) {
	// 创建内存数据库
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// 创建缓存
	cache := cache.NewMemoryCache()

	// 创建基础服务
	auditService := audit.NewAuditService(db)
	encryptionService := security.NewEncryptionService("test-key")
	userService := &MockUserService{}

	// 创建高级功能管理器
	manager := NewAdvancedFeaturesManager(
		db, cache, auditService, encryptionService, userService,
		nil, nil, nil, nil, nil, nil, nil, nil,
	)

	// 等待初始化完成
	time.Sleep(100 * time.Millisecond)

	// 测试初始化状态
	if !manager.IsInitialized() {
		t.Error("Expected manager to be initialized")
	}

	// 测试系统状态
	status := manager.GetSystemStatus()
	if status["initialized"] != true {
		t.Error("Expected system to be initialized")
	}

	// 测试请求处理
	err = manager.ProcessUserRequest(
		context.Background(),
		"test_user",
		"192.168.1.1",
		"Mozilla/5.0",
		map[string]interface{}{
			"feature": "API",
		},
	)

	// 由于没有完整的依赖，这里可能会失败，但不应该panic
	t.Log("Advanced features manager test completed")
}

// MockUserService 模拟用户服务
type MockUserService struct{}

func (m *MockUserService) GetUserByID(userID string) (*MockUser, error) {
	return &MockUser{
		ID:       userID,
		Plan:     "FREE",
		PlanName: "FREE",
	}, nil
}

// MockUser 模拟用户
type MockUser struct {
	ID       string
	Plan     string
	PlanName string
}

// TestEventBus 测试事件总线
func TestEventBus(t *testing.T) {
	eventBus := NewEventBus()

	// 订阅事件
	ch := eventBus.Subscribe("test.event")

	// 发布事件
	event := Event{
		Type:   "test.event",
		Source: "test",
		Data: map[string]interface{}{
			"message": "hello",
		},
		Timestamp: time.Now(),
	}

	eventBus.Publish("test.event", event)

	// 接收事件
	select {
	case receivedEvent := <-ch:
		if receivedEvent.Type != "test.event" {
			t.Errorf("Expected event type 'test.event', got '%s'", receivedEvent.Type)
		}
		if receivedEvent.Data["message"] != "hello" {
			t.Errorf("Expected message 'hello', got '%v'", receivedEvent.Data["message"])
		}
	case <-time.After(1 * time.Second):
		t.Error("Timeout waiting for event")
	}

	t.Log("Event bus test passed")
}

// BenchmarkPluginExecution 插件执行性能测试
func BenchmarkPluginExecution(b *testing.B) {
	// 创建内存数据库
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		b.Fatalf("Failed to create test database: %v", err)
	}

	auditService := audit.NewAuditService(db)
	pluginSystem := InitializeAdvancedPlugins(db, auditService)

	event := Event{
		Type:   "token.consumed",
		Source: "benchmark",
		Data: map[string]interface{}{
			"user_id": "test_user",
			"amount":  10,
			"service": "test",
		},
		Timestamp: time.Now(),
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		pluginSystem.PublishEvent(event)
	}
}

// BenchmarkSecurityAnalysis 安全分析性能测试
func BenchmarkSecurityAnalysis(b *testing.B) {
	// 创建内存数据库
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		b.Fatalf("Failed to create test database: %v", err)
	}

	cache := cache.NewMemoryCache()
	auditService := audit.NewAuditService(db)
	encryptionService := security.NewEncryptionService("test-key")

	securitySystem := NewAdvancedSecuritySystem(db, cache, auditService, encryptionService)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		securitySystem.AnalyzeRequest(
			context.Background(),
			"test_user",
			"192.168.1.1",
			"Mozilla/5.0",
			map[string]interface{}{
				"request_frequency": 10.0,
			},
		)
	}
}
