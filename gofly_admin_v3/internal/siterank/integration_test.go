package siterank

import (
	"fmt"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB 设置测试数据库
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect database: %v", err)
	}

	// 自动迁移
	if err := db.AutoMigrate(&SiteRankQuery{}); err != nil {
		t.Fatalf("Failed to migrate database: %v", err)
	}

	return db
}

// TestSiteRankIntegration 集成测试 - 验证所有需求
func TestSiteRankIntegration(t *testing.T) {

	t.Run("需求5.1: 单域名查询通过SimilarWeb API获取数据", func(t *testing.T) {
		db := setupTestDB(t)
		service := NewServiceWithMockToken(db, nil)
		req := &QueryRequest{
			Domain:  "google.com",
			Country: "world",
			Force:   false,
		}

		query, err := service.QueryDomain("test-user", req)
		if err != nil {
			t.Fatalf("QueryDomain failed: %v", err)
		}

		if query.Domain != "google.com" {
			t.Errorf("Expected domain 'google.com', got '%s'", query.Domain)
		}

		if query.Status != StatusPending {
			t.Errorf("Expected status 'pending', got '%s'", query.Status)
		}

		if query.Source != SourceSimilarWeb {
			t.Errorf("Expected source 'similarweb', got '%s'", query.Source)
		}
	})

	t.Run("需求5.2: 批量查询支持多域名处理和动态批次大小", func(t *testing.T) {
		db := setupTestDB(t)
		service := NewServiceWithMockToken(db, nil)
		domains := []string{"google.com", "facebook.com", "example.com", "test1.com", "test2.com"}

		req := &BatchQueryRequest{
			Domains:   domains,
			Country:   "world",
			BatchSize: 0, // 让系统自动计算
			Force:     false,
		}

		batchQuery, err := service.BatchQueryDomains("test-user", req)
		if err != nil {
			t.Fatalf("BatchQueryDomains failed: %v", err)
		}

		if len(batchQuery.Domains) != len(domains) {
			t.Errorf("Expected %d domains, got %d", len(domains), len(batchQuery.Domains))
		}

		// 验证批次大小在5-20之间
		if batchQuery.BatchSize < 5 || batchQuery.BatchSize > 20 {
			t.Errorf("Batch size %d is not in range 5-20", batchQuery.BatchSize)
		}

		if batchQuery.Status != "pending" {
			t.Errorf("Expected status 'pending', got '%s'", batchQuery.Status)
		}
	})

	t.Run("需求5.3: 优先级计算根据排名数据自动计算", func(t *testing.T) {
		testCases := []struct {
			rank     *int
			expected Priority
		}{
			{intPtr(1000), PriorityLow},   // 排名1000，无流量数据，得分54分
			{intPtr(10000), PriorityLow},  // 排名1万，无流量数据，得分48分
			{intPtr(50000), PriorityLow},  // 排名5万，无流量数据，得分36分
			{intPtr(100000), PriorityLow}, // 排名10万，无流量数据，得分24分
			{intPtr(500000), PriorityLow}, // 排名50万，无流量数据，得分12分
			{nil, PriorityLow},            // 无数据
		}

		for _, tc := range testCases {
			query := &SiteRankQuery{GlobalRank: tc.rank}
			priority := query.CalculatePriority()

			if priority != tc.expected {
				t.Errorf("For rank %v, expected priority %s, got %s", tc.rank, tc.expected, priority)
			}
		}
	})

	t.Run("需求5.4: 数据缓存策略", func(t *testing.T) {
		db := setupTestDB(t)
		// 创建一个已完成的查询记录
		completedQuery := &SiteRankQuery{
			ID:        "test-completed",
			UserID:    "test-user",
			Domain:    "cached-domain.com",
			Status:    StatusCompleted,
			Source:    SourceSimilarWeb,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// 设置缓存时间（7天后过期）
		cacheUntil := time.Now().AddDate(0, 0, 7)
		completedQuery.CacheUntil = &cacheUntil

		// 保存到数据库
		if err := db.Create(completedQuery).Error; err != nil {
			t.Fatalf("Failed to create test query: %v", err)
		}

		// 测试缓存未过期
		if completedQuery.IsExpired() {
			t.Error("Query should not be expired (7 days cache)")
		}

		// 创建一个失败的查询记录
		failedQuery := &SiteRankQuery{
			ID:        "test-failed",
			UserID:    "test-user",
			Domain:    "failed-domain.com",
			Status:    StatusFailed,
			Source:    SourceSimilarWeb,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// 设置缓存时间（1小时后过期）
		cacheUntil = time.Now().Add(1 * time.Hour)
		failedQuery.CacheUntil = &cacheUntil

		// 保存到数据库
		if err := db.Create(failedQuery).Error; err != nil {
			t.Fatalf("Failed to create test query: %v", err)
		}

		// 测试缓存未过期
		if failedQuery.IsExpired() {
			t.Error("Failed query should not be expired (1 hour cache)")
		}

		// 测试过期的缓存
		expiredQuery := &SiteRankQuery{
			ID:        "test-expired",
			UserID:    "test-user",
			Domain:    "expired-domain.com",
			Status:    StatusCompleted,
			Source:    SourceSimilarWeb,
			CreatedAt: time.Now().Add(-8 * 24 * time.Hour), // 8天前
			UpdatedAt: time.Now().Add(-8 * 24 * time.Hour),
		}

		// 设置过期时间（1天前）
		expiredTime := time.Now().Add(-24 * time.Hour)
		expiredQuery.CacheUntil = &expiredTime

		if !expiredQuery.IsExpired() {
			t.Error("Query should be expired")
		}
	})

	t.Run("需求5.5: Token消费规则", func(t *testing.T) {
		db := setupTestDB(t)
		service := NewServiceWithMockToken(db, nil)
		// 测试单域名查询消费1个Token
		req := &QueryRequest{
			Domain:  "token-test.com",
			Country: "world",
			Force:   false,
		}

		// 模拟Token服务会被调用
		query, err := service.QueryDomain("test-user", req)
		if err != nil {
			t.Fatalf("QueryDomain failed: %v", err)
		}

		if query == nil {
			t.Fatal("Query should not be nil")
		}

		// 验证查询记录被创建（说明Token消费成功）
		var savedQuery SiteRankQuery
		if err := db.Where("id = ?", query.ID).First(&savedQuery).Error; err != nil {
			t.Errorf("Query should be saved to database: %v", err)
		}
	})

	t.Run("API兼容性: 响应格式转换", func(t *testing.T) {
		query := &SiteRankQuery{
			ID:           "test-response",
			UserID:       "test-user",
			Domain:       "response-test.com",
			Status:       StatusCompleted,
			Source:       SourceSimilarWeb,
			GlobalRank:   intPtr(12345),
			CategoryRank: intPtr(678),
			Category:     "Technology",
			Country:      "world",
			Priority:     PriorityMedium,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}

		response := query.ToResponse()

		if response.ID != query.ID {
			t.Errorf("Response ID mismatch: expected %s, got %s", query.ID, response.ID)
		}

		if response.Domain != query.Domain {
			t.Errorf("Response Domain mismatch: expected %s, got %s", query.Domain, response.Domain)
		}

		if response.GlobalRank == nil || *response.GlobalRank != *query.GlobalRank {
			t.Errorf("Response GlobalRank mismatch: expected %v, got %v", query.GlobalRank, response.GlobalRank)
		}

		if response.Priority != query.Priority {
			t.Errorf("Response Priority mismatch: expected %s, got %s", query.Priority, response.Priority)
		}
	})

	t.Run("SimilarWeb客户端功能", func(t *testing.T) {
		client := NewMockSimilarWebClient()

		// 测试域名验证
		validDomains := []string{"google.com", "facebook.com", "example.com"}
		for _, domain := range validDomains {
			if err := client.ValidateDomain(domain); err != nil {
				t.Errorf("Domain %s should be valid: %v", domain, err)
			}
		}

		// 测试无效域名
		if err := client.ValidateDomain(""); err == nil {
			t.Error("Empty domain should be invalid")
		}

		// 测试域名标准化
		normalized := client.NormalizeDomain("GOOGLE.COM")
		if normalized != "google.com" {
			t.Errorf("Expected 'google.com', got '%s'", normalized)
		}

		// 测试获取域名数据
		data, err := client.GetDomainRank("google.com", "world")
		if err != nil {
			t.Errorf("GetDomainRank failed: %v", err)
		}

		if data == nil {
			t.Fatal("Data should not be nil")
		}

		if data.GlobalRank == nil || *data.GlobalRank != 1 {
			t.Errorf("Expected rank 1 for google.com, got %v", data.GlobalRank)
		}

		if data.Category != "Search Engines" {
			t.Errorf("Expected category 'Search Engines', got '%s'", data.Category)
		}
	})
}

// TestSiteRankServiceMethods 测试服务方法
func TestSiteRankServiceMethods(t *testing.T) {

	t.Run("GetQueries分页查询", func(t *testing.T) {
		db := setupTestDB(t)
		service := NewServiceWithMockToken(db, nil)
		// 创建测试数据
		for i := 0; i < 25; i++ {
			query := &SiteRankQuery{
				ID:        fmt.Sprintf("test-query-%d", i),
				UserID:    "test-user",
				Domain:    fmt.Sprintf("test%d.com", i),
				Status:    StatusCompleted,
				Source:    SourceSimilarWeb,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}
			db.Create(query)
		}

		// 测试分页
		queries, total, err := service.GetQueries("test-user", 1, 10)
		if err != nil {
			t.Fatalf("GetQueries failed: %v", err)
		}

		if total != 25 {
			t.Errorf("Expected total 25, got %d", total)
		}

		if len(queries) != 10 {
			t.Errorf("Expected 10 queries, got %d", len(queries))
		}
	})

	t.Run("GetQueryStats统计信息", func(t *testing.T) {
		db := setupTestDB(t)
		service := NewServiceWithMockToken(db, nil)

		// 创建一些测试数据
		testQueries := []*SiteRankQuery{
			{
				ID:        "stats-test-1",
				UserID:    "test-user",
				Domain:    "stats1.com",
				Status:    StatusCompleted,
				Source:    SourceSimilarWeb,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			{
				ID:        "stats-test-2",
				UserID:    "test-user",
				Domain:    "stats2.com",
				Status:    StatusFailed,
				Source:    SourceSimilarWeb,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
		}

		for _, query := range testQueries {
			db.Create(query)
		}

		stats, err := service.GetQueryStats("test-user")
		if err != nil {
			t.Fatalf("GetQueryStats failed: %v", err)
		}

		if stats.TotalQueries != 2 {
			t.Errorf("Expected total queries 2, got %d", stats.TotalQueries)
		}

		if stats.CacheHitRate < 0 || stats.CacheHitRate > 100 {
			t.Errorf("Cache hit rate should be between 0-100, got %f", stats.CacheHitRate)
		}
	})

	t.Run("GetTopDomains热门域名", func(t *testing.T) {
		db := setupTestDB(t)
		service := NewServiceWithMockToken(db, nil)
		// 创建有排名的测试数据
		for i := 0; i < 5; i++ {
			query := &SiteRankQuery{
				ID:         fmt.Sprintf("top-query-%d", i),
				UserID:     "test-user",
				Domain:     fmt.Sprintf("top%d.com", i),
				Status:     StatusCompleted,
				Source:     SourceSimilarWeb,
				GlobalRank: intPtr(i + 1),
				CreatedAt:  time.Now(),
				UpdatedAt:  time.Now(),
			}
			db.Create(query)
		}

		topDomains, err := service.GetTopDomains(3)
		if err != nil {
			t.Fatalf("GetTopDomains failed: %v", err)
		}

		if len(topDomains) == 0 {
			t.Error("Should return some top domains")
		}

		// 验证排序（应该按排名升序）
		for i := 1; i < len(topDomains); i++ {
			if topDomains[i-1].GlobalRank != nil && topDomains[i].GlobalRank != nil {
				if *topDomains[i-1].GlobalRank > *topDomains[i].GlobalRank {
					t.Error("Top domains should be sorted by rank (ascending)")
				}
			}
		}
	})
}
