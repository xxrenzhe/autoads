package siterank

import (
	"testing"
)

func TestMockSimilarWebClient(t *testing.T) {
	client := NewMockSimilarWebClient()
	
	// 测试域名验证
	err := client.ValidateDomain("google.com")
	if err != nil {
		t.Errorf("ValidateDomain failed: %v", err)
	}
	
	// 测试域名标准化
	normalized := client.NormalizeDomain("GOOGLE.COM")
	if normalized != "google.com" {
		t.Errorf("Expected 'google.com', got '%s'", normalized)
	}
	
	// 测试获取域名排名
	data, err := client.GetDomainRank("google.com", "world")
	if err != nil {
		t.Errorf("GetDomainRank failed: %v", err)
	}
	
	if data == nil {
		t.Fatal("Domain rank data is nil")
	}
	
	if data.GlobalRank == nil || *data.GlobalRank != 1 {
		t.Errorf("Expected global rank 1 for google.com, got %v", data.GlobalRank)
	}
	
	if data.Category != "Search Engines" {
		t.Errorf("Expected category 'Search Engines', got '%s'", data.Category)
	}
}

func TestPriorityCalculation(t *testing.T) {
	query := &SiteRankQuery{}
	
	// 测试高优先级 (排名 <= 10000)
	rank1 := 5000
	query.GlobalRank = &rank1
	priority := query.CalculatePriority()
	if priority != PriorityHigh {
		t.Errorf("Expected High priority for rank 5000, got %s", priority)
	}
	
	// 测试中优先级 (排名 <= 100000)
	rank2 := 50000
	query.GlobalRank = &rank2
	priority = query.CalculatePriority()
	if priority != PriorityMedium {
		t.Errorf("Expected Medium priority for rank 50000, got %s", priority)
	}
	
	// 测试低优先级 (排名 > 100000)
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

func TestSiteRankQueryModel(t *testing.T) {
	query := &SiteRankQuery{
		ID:     "test-id",
		UserID: "user-123",
		Domain: "example.com",
		Status: StatusPending,
		Source: SourceSimilarWeb,
	}
	
	// 测试表名
	tableName := query.TableName()
	if tableName != "siterank_queries" {
		t.Errorf("Expected table name 'siterank_queries', got '%s'", tableName)
	}
	
	// 测试转换为响应格式
	response := query.ToResponse()
	if response == nil {
		t.Fatal("Response is nil")
	}
	
	if response.ID != query.ID {
		t.Errorf("Expected ID '%s', got '%s'", query.ID, response.ID)
	}
	
	if response.Domain != query.Domain {
		t.Errorf("Expected domain '%s', got '%s'", query.Domain, response.Domain)
	}
}

func TestSimilarWebConfig(t *testing.T) {
	config := DefaultSimilarWebConfig()
	
	if config == nil {
		t.Fatal("Config is nil")
	}
	
	if config.BaseURL == "" {
		t.Error("BaseURL should not be empty")
	}
	
	if config.RateLimit <= 0 {
		t.Error("RateLimit should be positive")
	}
	
	if config.Timeout <= 0 {
		t.Error("Timeout should be positive")
	}
	
	if config.RetryCount < 0 {
		t.Error("RetryCount should not be negative")
	}
}