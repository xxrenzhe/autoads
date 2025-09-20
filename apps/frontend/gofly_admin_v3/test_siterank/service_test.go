package siterank

import (
	"testing"
	"time"

	"gofly-admin-v3/internal/user"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// MockTokenService 模拟Token服务
type MockTokenService struct{}

func (m *MockTokenService) CheckTokenSufficiency(userID, service, action string, quantity int) (bool, int, int, error) {
	return true, 1000, 1, nil // 假设用户有足够的Token
}

func (m *MockTokenService) ConsumeTokensByService(userID, service, action string, quantity int, reference string) error {
	return nil // 模拟成功消费
}

func setupTestDB() *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	// 自动迁移
	db.AutoMigrate(&SiteRankQuery{})

	return db
}

func TestSiteRankService_QueryDomain(t *testing.T) {
	// 设置测试数据库
	db := setupTestDB()

	// 创建模拟Token服务
	tokenService := &MockTokenService{}

	// 创建SiteRank服务
	service := NewService(db, tokenService, nil)

	// 测试查询请求
	req := &QueryRequest{
		Domain:  "google.com",
		Country: "world",
		Force:   false,
	}

	// 执行查询
	query, err := service.QueryDomain("test-user-id", req)

	// 验证结果
	if err != nil {
		t.Fatalf("QueryDomain failed: %v", err)
	}

	if query == nil {
		t.Fatal("Query result is nil")
	}

	if query.Domain != "google.com" {
		t.Errorf("Expected domain 'google.com', got '%s'", query.Domain)
	}

	if query.Status != StatusPending {
		t.Errorf("Expected status 'pending', got '%s'", query.Status)
	}

	if query.UserID != "test-user-id" {
		t.Errorf("Expected user_id 'test-user-id', got '%s'", query.UserID)
	}
}

func TestSiteRankService_GetQuery(t *testing.T) {
	// 设置测试数据库
	db := setupTestDB()

	// 创建模拟Token服务
	tokenService := &MockTokenService{}

	// 创建SiteRank服务
	service := NewService(db, tokenService, nil)

	// 创建测试查询记录
	testQuery := &SiteRankQuery{
		ID:        "test-query-id",
		UserID:    "test-user-id",
		Domain:    "example.com",
		Status:    StatusCompleted,
		Source:    SourceSimilarWeb,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 保存到数据库
	if err := db.Create(testQuery).Error; err != nil {
		t.Fatalf("Failed to create test query: %v", err)
	}

	// 获取查询结果
	result, err := service.GetQuery("test-user-id", "test-query-id")

	// 验证结果
	if err != nil {
		t.Fatalf("GetQuery failed: %v", err)
	}

	if result == nil {
		t.Fatal("Query result is nil")
	}

	if result.ID != "test-query-id" {
		t.Errorf("Expected ID 'test-query-id', got '%s'", result.ID)
	}

	if result.Domain != "example.com" {
		t.Errorf("Expected domain 'example.com', got '%s'", result.Domain)
	}
}

func TestSimilarWebClient_ValidateDomain(t *testing.T) {
	client := NewMockSimilarWebClient()

	// 测试有效域名
	validDomains := []string{
		"google.com",
		"facebook.com",
		"example.com",
	}

	for _, domain := range validDomains {
		if err := client.ValidateDomain(domain); err != nil {
			t.Errorf("Domain '%s' should be valid, got error: %v", domain, err)
		}
	}

	// 测试无效域名
	invalidDomains := []string{
		"",
		"invalid",
	}

	for _, domain := range invalidDomains {
		if err := client.ValidateDomain(domain); err == nil {
			t.Errorf("Domain '%s' should be invalid, but validation passed", domain)
		}
	}
}

func TestSimilarWebClient_GetDomainRank(t *testing.T) {
	client := NewMockSimilarWebClient()

	// 测试已知域名
	data, err := client.GetDomainRank("google.com", "world")
	if err != nil {
		t.Fatalf("GetDomainRank failed: %v", err)
	}

	if data == nil {
		t.Fatal("Domain rank data is nil")
	}

	if data.GlobalRank == nil || *data.GlobalRank != 1 {
		t.Errorf("Expected global rank 1 for google.com, got %v", data.GlobalRank)
	}

	// 测试未知域名
	_, err = client.GetDomainRank("unknown-domain-12345.com", "world")
	if err == nil {
		t.Error("Expected error for unknown domain, but got none")
	}
}

func TestPriorityCalculation(t *testing.T) {
	query := &SiteRankQuery{}

	// 测试高优先级
	rank1 := 5000
	query.GlobalRank = &rank1
	priority := query.CalculatePriority()
	if priority != PriorityHigh {
		t.Errorf("Expected High priority for rank 5000, got %s", priority)
	}

	// 测试中优先级
	rank2 := 50000
	query.GlobalRank = &rank2
	priority = query.CalculatePriority()
	if priority != PriorityMedium {
		t.Errorf("Expected Medium priority for rank 50000, got %s", priority)
	}

	// 测试低优先级
	rank3 := 500000
	query.GlobalRank = &rank3
	priority = query.CalculatePriority()
	if priority != PriorityLow {
		t.Errorf("Expected Low priority for rank 500000, got %s", priority)
	}

	// 测试无排名数据
	query.GlobalRank = nil
	priority = query.CalculatePriority()
	if priority != PriorityLow {
		t.Errorf("Expected Low priority for nil rank, got %s", priority)
	}
}
