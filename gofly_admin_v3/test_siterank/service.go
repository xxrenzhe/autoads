package siterank

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SimilarWebClientInterface SimilarWeb客户端接口
type SimilarWebClientInterface interface {
	GetDomainRank(domain, country string) (*SiteRankData, error)
	GetDomainInfo(domain string) (*SiteRankData, error)
	ValidateDomain(domain string) error
	NormalizeDomain(domain string) string
}

// TokenService Token服务接口
type TokenService interface {
	CheckTokenSufficiency(userID, service, action string, quantity int) (bool, int, int, error)
	ConsumeTokensByService(userID, service, action string, quantity int, reference string) error
}

// Service SiteRank服务
type Service struct {
	db              *gorm.DB
	similarWebClient SimilarWebClientInterface
	tokenService    TokenService
	config          *SimilarWebConfig
}

// NewService 创建SiteRank服务
func NewService(db *gorm.DB, tokenService TokenService, config *SimilarWebConfig) *Service {
	if config == nil {
		config = DefaultSimilarWebConfig()
	}
	
	// 如果没有提供tokenService，使用模拟服务
	if tokenService == nil {
		tokenService = NewMockTokenService()
	}
	
	var client SimilarWebClientInterface
	if config.APIKey == "your-similarweb-api-key" || config.APIKey == "" {
		// 使用模拟客户端
		client = NewMockSimilarWebClient()
	} else {
		// 使用真实客户端
		client = NewSimilarWebClient(config)
	}
	
	return &Service{
		db:               db,
		similarWebClient: client,
		tokenService:     tokenService,
		config:           config,
	}
}

// NewServiceWithMockToken 创建带有模拟Token服务的SiteRank服务（用于测试）
func NewServiceWithMockToken(db *gorm.DB, config *SimilarWebConfig) *Service {
	return NewService(db, NewMockTokenService(), config)
}

// QueryDomain 查询单个域名
func (s *Service) QueryDomain(userID string, req *QueryRequest) (*SiteRankQuery, error) {
	// 1. 验证和标准化域名
	if err := s.similarWebClient.ValidateDomain(req.Domain); err != nil {
		return nil, fmt.Errorf("域名验证失败: %w", err)
	}
	
	normalizedDomain := s.similarWebClient.NormalizeDomain(req.Domain)
	
	// 2. 检查缓存
	if !req.Force {
		if cached, err := s.getCachedQuery(userID, normalizedDomain); err == nil && !cached.IsExpired() {
			cached.Source = SourceCache
			cached.Status = StatusCached
			return cached, nil
		}
	}
	
	// 3. 检查Token余额
	sufficient, balance, cost, err := s.tokenService.CheckTokenSufficiency(userID, "siterank", "query", 1)
	if err != nil {
		return nil, err
	}
	if !sufficient {
		return nil, fmt.Errorf("Token余额不足，需要%d，当前%d", cost, balance)
	}
	
	// 4. 创建查询记录
	query := &SiteRankQuery{
		ID:        uuid.New().String(),
		UserID:    userID,
		Domain:    normalizedDomain,
		Status:    StatusPending,
		Source:    SourceSimilarWeb,
		Country:   req.Country,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	if err := s.db.Create(query).Error; err != nil {
		return nil, fmt.Errorf("创建查询记录失败: %w", err)
	}
	
	// 5. 消费Token
	if err := s.tokenService.ConsumeTokensByService(userID, "siterank", "query", 1, query.ID); err != nil {
		return nil, fmt.Errorf("Token消费失败: %w", err)
	}
	
	// 6. 异步执行查询
	go s.executeQuery(query)
	
	return query, nil
}

// BatchQueryDomains 批量查询域名
func (s *Service) BatchQueryDomains(userID string, req *BatchQueryRequest) (*BatchQuery, error) {
	// 1. 验证请求
	if len(req.Domains) == 0 {
		return nil, fmt.Errorf("域名列表不能为空")
	}
	if len(req.Domains) > 1000 {
		return nil, fmt.Errorf("域名数量不能超过1000个")
	}
	
	// 2. 标准化域名
	normalizedDomains := make([]string, 0, len(req.Domains))
	for _, domain := range req.Domains {
		if err := s.similarWebClient.ValidateDomain(domain); err != nil {
			continue // 跳过无效域名
		}
		normalized := s.similarWebClient.NormalizeDomain(domain)
		normalizedDomains = append(normalizedDomains, normalized)
	}
	
	if len(normalizedDomains) == 0 {
		return nil, fmt.Errorf("没有有效的域名")
	}
	
	// 3. 检查Token余额
	sufficient, balance, cost, err := s.tokenService.CheckTokenSufficiency(userID, "siterank", "query", len(normalizedDomains))
	if err != nil {
		return nil, err
	}
	if !sufficient {
		return nil, fmt.Errorf("Token余额不足，需要%d，当前%d", cost, balance)
	}
	
	// 4. 创建批量查询记录
	batchQuery := &BatchQuery{
		ID:        uuid.New().String(),
		UserID:    userID,
		Domains:   normalizedDomains,
		Status:    "pending",
		Progress:  0,
		Total:     len(normalizedDomains),
		Results:   make([]string, 0),
		BatchSize: s.calculateBatchSize(len(normalizedDomains)),
		RateLimit: s.config.RateLimit,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	// 设置批次大小
	if req.BatchSize > 0 && req.BatchSize <= 20 {
		batchQuery.BatchSize = req.BatchSize
	}
	
	// 5. 异步执行批量查询
	go s.executeBatchQuery(userID, batchQuery, req.Force)
	
	return batchQuery, nil
}

// executeQuery 执行单个查询
func (s *Service) executeQuery(query *SiteRankQuery) {
	// 更新状态为运行中
	s.updateQueryStatus(query.ID, StatusRunning, "")
	
	// 调用SimilarWeb API
	data, err := s.similarWebClient.GetDomainRank(query.Domain, query.Country)
	if err != nil {
		// 查询失败
		s.updateQueryStatus(query.ID, StatusFailed, err.Error())
		return
	}
	
	// 更新查询结果
	s.updateQueryResult(query.ID, data, StatusCompleted)
}

// executeBatchQuery 执行批量查询
func (s *Service) executeBatchQuery(userID string, batchQuery *BatchQuery, force bool) {
	ctx := context.Background()
	
	// 创建工作池
	semaphore := make(chan struct{}, batchQuery.BatchSize)
	var wg sync.WaitGroup
	var mu sync.Mutex
	
	processed := 0
	
	for _, domain := range batchQuery.Domains {
		wg.Add(1)
		
		go func(domain string) {
			defer wg.Done()
			
			// 获取信号量
			semaphore <- struct{}{}
			defer func() { <-semaphore }()
			
			// 检查缓存
			var query *SiteRankQuery
			var err error
			
			if !force {
				if cached, cacheErr := s.getCachedQuery(userID, domain); cacheErr == nil && !cached.IsExpired() {
					query = cached
					query.Source = SourceCache
					query.Status = StatusCached
				}
			}
			
			// 如果没有缓存，执行查询
			if query == nil {
				query = &SiteRankQuery{
					ID:        uuid.New().String(),
					UserID:    userID,
					Domain:    domain,
					Status:    StatusPending,
					Source:    SourceSimilarWeb,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				
				if err := s.db.Create(query).Error; err == nil {
					s.executeQuery(query)
				}
			}
			
			// 更新进度
			mu.Lock()
			processed++
			batchQuery.Progress = processed
			batchQuery.Results = append(batchQuery.Results, query.ID)
			mu.Unlock()
			
			// 速率控制
			time.Sleep(time.Duration(3600/batchQuery.RateLimit) * time.Second)
		}(domain)
	}
	
	// 等待所有查询完成
	wg.Wait()
	
	// 消费Token
	s.tokenService.ConsumeTokensByService(userID, "siterank", "query", len(batchQuery.Domains), batchQuery.ID)
	
	// 更新批量查询状态
	batchQuery.Status = "completed"
	batchQuery.UpdatedAt = time.Now()
}

// calculateBatchSize 计算批次大小
func (s *Service) calculateBatchSize(totalDomains int) int {
	// 动态调整批次大小：5-20之间
	batchSize := int(math.Sqrt(float64(totalDomains)))
	
	if batchSize < 5 {
		batchSize = 5
	} else if batchSize > 20 {
		batchSize = 20
	}
	
	return batchSize
}

// getCachedQuery 获取缓存的查询结果
func (s *Service) getCachedQuery(userID, domain string) (*SiteRankQuery, error) {
	var query SiteRankQuery
	err := s.db.Where("user_id = ? AND domain = ? AND status IN ?", 
		userID, domain, []QueryStatus{StatusCompleted, StatusFailed}).
		Order("created_at DESC").
		First(&query).Error
	
	return &query, err
}

// updateQueryStatus 更新查询状态
func (s *Service) updateQueryStatus(queryID string, status QueryStatus, errorMsg string) {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}
	
	if errorMsg != "" {
		updates["error_message"] = errorMsg
	}
	
	s.db.Model(&SiteRankQuery{}).Where("id = ?", queryID).Updates(updates)
}

// updateQueryResult 更新查询结果
func (s *Service) updateQueryResult(queryID string, data *SiteRankData, status QueryStatus) {
	query := &SiteRankQuery{}
	if err := s.db.Where("id = ?", queryID).First(query).Error; err != nil {
		return
	}
	
	// 更新数据
	query.UpdateFromSimilarWebData(data)
	query.Status = status
	
	s.db.Save(query)
}

// GetQuery 获取查询结果
func (s *Service) GetQuery(userID, queryID string) (*SiteRankQuery, error) {
	var query SiteRankQuery
	err := s.db.Where("id = ? AND user_id = ?", queryID, userID).First(&query).Error
	if err != nil {
		return nil, err
	}
	return &query, nil
}

// GetQueries 获取查询列表
func (s *Service) GetQueries(userID string, page, pageSize int) ([]*SiteRankQuery, int64, error) {
	var queries []*SiteRankQuery
	var total int64
	
	offset := (page - 1) * pageSize
	
	// 获取总数
	if err := s.db.Model(&SiteRankQuery{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	
	// 获取分页数据
	if err := s.db.Where("user_id = ?", userID).
		Offset(offset).Limit(pageSize).
		Order("created_at DESC").
		Find(&queries).Error; err != nil {
		return nil, 0, err
	}
	
	return queries, total, nil
}

// GetQueryStats 获取查询统计
func (s *Service) GetQueryStats(userID string) (*QueryStats, error) {
	stats := &QueryStats{}
	
	// 总查询数
	s.db.Model(&SiteRankQuery{}).Where("user_id = ?", userID).Count(&stats.TotalQueries)
	
	// 缓存命中数
	s.db.Model(&SiteRankQuery{}).Where("user_id = ? AND source = ?", userID, SourceCache).Count(&stats.CachedQueries)
	
	// 成功查询数
	s.db.Model(&SiteRankQuery{}).Where("user_id = ? AND status = ?", userID, StatusCompleted).Count(&stats.SuccessQueries)
	
	// 失败查询数
	s.db.Model(&SiteRankQuery{}).Where("user_id = ? AND status = ?", userID, StatusFailed).Count(&stats.FailedQueries)
	
	// 优先级统计
	s.db.Model(&SiteRankQuery{}).Where("user_id = ? AND priority = ?", userID, PriorityHigh).Count(&stats.HighPriority)
	s.db.Model(&SiteRankQuery{}).Where("user_id = ? AND priority = ?", userID, PriorityMedium).Count(&stats.MediumPriority)
	s.db.Model(&SiteRankQuery{}).Where("user_id = ? AND priority = ?", userID, PriorityLow).Count(&stats.LowPriority)
	
	// 计算缓存命中率
	if stats.TotalQueries > 0 {
		stats.CacheHitRate = float64(stats.CachedQueries) / float64(stats.TotalQueries) * 100
	}
	
	return stats, nil
}

// CleanExpiredCache 清理过期缓存
func (s *Service) CleanExpiredCache() error {
	now := time.Now()
	return s.db.Where("cache_until < ?", now).Delete(&SiteRankQuery{}).Error
}

// GetTopDomains 获取热门域名
func (s *Service) GetTopDomains(limit int) ([]*SiteRankQuery, error) {
	var queries []*SiteRankQuery
	
	err := s.db.Where("status = ? AND global_rank IS NOT NULL", StatusCompleted).
		Order("global_rank ASC").
		Limit(limit).
		Find(&queries).Error
	
	return queries, err
}