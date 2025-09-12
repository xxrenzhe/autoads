//go:build autoads_siterank_enhanced

package siterankgo

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
	"github.com/redis/go-redis/v9"
	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/internal/user"
	"gofly-admin-v3/utils/gform"
	"gorm.io/gorm"
)

// EnhancedService 增强的SiteRankGo服务
type EnhancedService struct {
	*Service

	// SimilarWeb API配置
	similarWebAPIKey  string
	similarWebBaseURL string

	// 缓存
	redis *store.Redis

	// 并发控制
	maxConcurrency int
	queryQueue     chan *Query

	// 代理管理
	proxyPool *ProxyPool

	// 上下文
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// SimilarWebResponse SimilarWeb API响应
type SimilarWebResponse struct {
	Data []SimilarWebData `json:"data"`
	Meta SimilarWebMeta   `json:"meta"`
}

type SimilarWebData struct {
	URL          string                 `json:"url"`
	Rank         int                    `json:"rank"`
	Category     string                 `json:"category"`
	CategoryRank int                    `json:"category_rank"`
	Engagement   SimilarWebEngagement   `json:"engagement"`
	Traffic      SimilarWebTraffic      `json:"traffic"`
	Demographics SimilarWebDemographics `json:"demographics"`
	RelatedSites []string               `json:"related_sites"`
}

type SimilarWebMeta struct {
	Status    string `json:"status"`
	RequestID string `json:"request_id"`
}

type SimilarWebEngagement struct {
	TimeOnSite float64 `json:"time_on_site"`
	PageViews  float64 `json:"page_views"`
	BounceRate float64 `json:"bounce_rate"`
	Visits     int     `json:"visits"`
}

type SimilarWebTraffic struct {
	TotalVisits    int64              `json:"total_visits"`
	MonthlyVisits  int64              `json:"monthly_visits"`
	OrganicSearch  float64            `json:"organic_search"`
	PaidSearch     float64            `json:"paid_search"`
	Direct         float64            `json:"direct"`
	Referrals      float64            `json:"referrals"`
	Social         float64            `json:"social"`
	Mail           float64            `json:"mail"`
	Display        float64            `json:"display"`
	TrafficSources map[string]float64 `json:"traffic_sources"`
	GrowthRate     float64            `json:"growth_rate"`
}

type SimilarWebDemographics struct {
	AgeDistribution    map[string]float64 `json:"age_distribution"`
	GenderDistribution map[string]float64 `json:"gender_distribution"`
	TopCountries       []CountryData      `json:"top_countries"`
}

type CountryData struct {
	Country string  `json:"country"`
	Share   float64 `json:"share"`
}

// NewEnhancedService 创建增强的SiteRankGo服务
func NewEnhancedService(db *store.DB, redis *store.Redis) *EnhancedService {
	ctx, cancel := context.WithCancel(context.Background())

	s := &EnhancedService{
		Service:           NewService(db, redis),
		similarWebAPIKey:  "your_similarweb_api_key", // 应该从配置中读取
		similarWebBaseURL: "https://api.similarweb.com/v1",
		redis:             redis,
		maxConcurrency:    20,                      // 最大并发数
		queryQueue:        make(chan *Query, 1000), // 查询队列
		proxyPool:         NewProxyPool(),
		ctx:               ctx,
		cancel:            cancel,
	}

	// 启动查询处理器
	go s.startQueryProcessor()

	return s
}

// CreateEnhancedQuery 创建增强查询
func (s *EnhancedService) CreateEnhancedQuery(userID string, req *EnhancedQueryCreateRequest) (*Query, error) {
	// 转换为标准查询请求
	standardReq := &QueryCreateRequest{
		Name:         req.Name,
		URLs:         req.URLs,
		Keywords:     req.Keywords,
		SearchEngine: req.SearchEngine,
		Region:       req.Region,
		Language:     req.Language,
		DeviceType:   req.DeviceType,
		IsBatch:      req.IsBatch,
		BatchSize:    req.BatchSize,
		QueryDepth:   req.QueryDepth,
		ProxyEnabled: req.ProxyEnabled,
		ProxyList:    req.ProxyList,
		DelayRange:   req.DelayRange,
		UserAgents:   req.UserAgents,
	}

	// 创建基础查询
	query, err := s.CreateQuery(userID, standardReq)
	if err != nil {
		return nil, err
	}

	// 保存增强配置
	if err := s.saveEnhancedConfig(query.ID, req); err != nil {
		// 删除已创建的查询
		s.DeleteQuery(query.ID, userID)
		return nil, fmt.Errorf("保存增强配置失败: %v", err)
	}

	return query, nil
}

// saveEnhancedConfig 保存增强配置
func (s *EnhancedService) saveEnhancedConfig(queryID string, req *EnhancedQueryCreateRequest) error {
	// 将增强配置保存到Redis
	key := fmt.Sprintf("siterank:enhanced:%s", queryID)

	config := map[string]interface{}{
		"enable_similarweb":  req.EnableSimilarWeb,
		"enable_alexa":       req.EnableAlexa,
		"enable_semrush":     req.EnableSEMrush,
		"custom_metrics":     req.CustomMetrics,
		"webhook_url":        req.WebhookURL,
		"report_format":      req.ReportFormat,
		"notification_email": req.NotificationEmail,
	}

	// 序列化配置
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}

	// 保存到Redis，设置7天过期时间
	return s.redis.Client.Set(s.ctx, key, data, 7*24*time.Hour).Err()
}

// StartEnhancedQuery 启动增强查询
func (s *EnhancedService) StartEnhancedQuery(queryID, userID string) error {
	query, err := s.GetQuery(queryID)
	if err != nil {
		return err
	}

	// 检查权限
	if query.UserID != userID {
		return fmt.Errorf("无权限操作此查询")
	}

	// 检查查询状态
	if !query.CanExecute() {
		return fmt.Errorf("查询状态不允许执行")
	}

	// 获取增强配置
	enhancedConfig, err := s.getEnhancedConfig(queryID)
	if err != nil {
		return fmt.Errorf("获取增强配置失败: %v", err)
	}

	// 计算增强Token消耗
	tokenCost := s.calculateEnhancedTokenCost(query, enhancedConfig)

	// 检查用户Token余额
	userService := user.NewService(s.db)
	userBalance, err := userService.GetUserTokenBalance(userID)
	if err != nil {
		return fmt.Errorf("获取用户Token余额失败: %v", err)
	}

	if userBalance < tokenCost {
		return fmt.Errorf("Token余额不足，需要%d个Token，当前余额%d", tokenCost, userBalance)
	}

	// 扣除Token
	if err := userService.DeductToken(userID, tokenCost, fmt.Sprintf("SiteRank增强查询执行: %s", query.Name)); err != nil {
		return fmt.Errorf("扣除Token失败: %v", err)
	}

	// 更新查询Token消耗
	query.TokenCost = tokenCost
	s.db.Save(query)

	// 将查询加入队列
	query.Status = "queued"
	query.UpdatedAt = time.Now()
	s.db.Save(query)

	s.queryQueue <- query

	return nil
}

// getEnhancedConfig 获取增强配置
func (s *EnhancedService) getEnhancedConfig(queryID string) (map[string]interface{}, error) {
	key := fmt.Sprintf("siterank:enhanced:%s", queryID)

	data, err := s.redis.Client.Get(s.ctx, key).Result()
	if err == redis.Nil {
		// 返回默认配置
		return map[string]interface{}{
			"enable_similarweb":  false,
			"enable_alexa":       false,
			"enable_semrush":     false,
			"custom_metrics":     []string{},
			"webhook_url":        "",
			"report_format":      "json",
			"notification_email": "",
		}, nil
	}
	if err != nil {
		return nil, err
	}

	var config map[string]interface{}
	if err := json.Unmarshal([]byte(data), &config); err != nil {
		return nil, err
	}

	return config, nil
}

// calculateEnhancedTokenCost 计算增强Token消耗
func (s *EnhancedService) calculateEnhancedTokenCost(query *Query, config map[string]interface{}) int {
	baseCost := query.TokenCost

	// SimilarWeb集成加成
	if enable, ok := config["enable_similarweb"].(bool); ok && enable {
		baseCost = int(float64(baseCost) * 2.0)
	}

	// Alexa集成加成
	if enable, ok := config["enable_alexa"].(bool); ok && enable {
		baseCost = int(float64(baseCost) * 1.5)
	}

	// SEMrush集成加成
	if enable, ok := config["enable_semrush"].(bool); ok && enable {
		baseCost = int(float64(baseCost) * 1.8)
	}

	// 自定义指标加成
	if metrics, ok := config["custom_metrics"].([]interface{}); ok && len(metrics) > 0 {
		baseCost = int(float64(baseCost) * (1.0 + float64(len(metrics))*0.2))
	}

	return baseCost
}

// startQueryProcessor 启动查询处理器
func (s *EnhancedService) startQueryProcessor() {
	// 创建工作池
	for i := 0; i < s.maxConcurrency; i++ {
		go s.queryWorker(i)
	}
}

// queryWorker 查询工作协程
func (s *EnhancedService) queryWorker(id int) {
	for {
		select {
		case query := <-s.queryQueue:
			// 处理查询
			s.processEnhancedQuery(id, query)
		case <-s.ctx.Done():
			return
		}
	}
}

// processEnhancedQuery 处理增强查询
func (s *EnhancedService) processEnhancedQuery(workerID int, query *Query) {
	// 获取增强配置
	enhancedConfig, _ := s.getEnhancedConfig(query.ID)

	// 创建增强查询运行器
	runner := &EnhancedQueryRunner{
		query:          query,
		service:        s,
		workerID:       workerID,
		enhancedConfig: enhancedConfig,
		proxyPool:      s.proxyPool,
		ctx:            s.ctx,
	}

	// 记录运行中的查询
	s.mu.Lock()
	s.runningQueries[query.ID] = runner
	s.mu.Unlock()

	// 执行查询
	runner.Run()

	// 清理
	s.mu.Lock()
	delete(s.runningQueries, query.ID)
	s.mu.Unlock()
}

// GetSimilarWebData 获取SimilarWeb数据
func (s *EnhancedService) GetSimilarWebData(domain string) (*SimilarWebData, error) {
	// 构建请求URL
	apiURL := fmt.Sprintf("%s/website/%s?api_key=%s",
		s.similarWebBaseURL, domain, s.similarWebAPIKey)

	// 创建请求
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	// 设置请求头
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	// 发送请求
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// 解析响应
	var response SimilarWebResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	// 检查响应状态
	if response.Meta.Status != "success" {
		return nil, fmt.Errorf("SimilarWeb API错误: %s", response.Meta.Status)
	}

	if len(response.Data) == 0 {
		return nil, fmt.Errorf("未找到域名数据")
	}

	return &response.Data[0], nil
}

// GetQueryWithCache 带缓存的查询
func (s *EnhancedService) GetQueryWithCache(queryID string) (*QueryResponse, error) {
	// 尝试从缓存获取
	cacheKey := fmt.Sprintf("siterank:query:%s", queryID)
	cached, err := s.redis.Client.Get(s.ctx, cacheKey).Result()
	if err == nil {
		var response QueryResponse
		if err := json.Unmarshal([]byte(cached), &response); err == nil {
			return &response, nil
		}
	}

	// 从数据库获取
	response, err := s.GetQueryWithResults(queryID)
	if err != nil {
		return nil, err
	}

	// 缓存结果（1小时）
	data, _ := json.Marshal(response)
	s.redis.Client.Set(s.ctx, cacheKey, data, time.Hour)

	return response, nil
}

// BatchGetSimilarWebData 批量获取SimilarWeb数据
func (s *EnhancedService) BatchGetSimilarWebData(domains []string) (map[string]*SimilarWebData, error) {
	results := make(map[string]*SimilarWebData)
	var mu sync.Mutex
	var wg sync.WaitGroup

	// 限制并发数
	semaphore := make(chan struct{}, 5)

	for _, domain := range domains {
		wg.Add(1)
		go func(d string) {
			defer wg.Done()

			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			data, err := s.GetSimilarWebData(d)
			if err == nil {
				mu.Lock()
				results[d] = data
				mu.Unlock()
			}
		}(domain)
	}

	wg.Wait()
	return results, nil
}

// EnhancedQueryCreateRequest 增强的查询创建请求
type EnhancedQueryCreateRequest struct {
	// 基础配置
	Name         string   `json:"name" binding:"required" validate:"min=1,max=100"`
	URLs         []string `json:"urls" binding:"required" validate:"min=1,max=100"`
	Keywords     []string `json:"keywords" binding:"required" validate:"min=1,max=50"`
	SearchEngine string   `json:"search_engine" validate:"oneof=google bing baidu"`
	Region       string   `json:"region" validate:"min=2,max=5"`
	Language     string   `json:"language" validate:"min=2,max=5"`
	DeviceType   string   `json:"device_type" validate:"oneof=desktop mobile"`
	IsBatch      bool     `json:"is_batch"`
	BatchSize    int      `json:"batch_size" validate:"min=1,max=100"`
	QueryDepth   int      `json:"query_depth" validate:"min=1,max=20"`
	ProxyEnabled bool     `json:"proxy_enabled"`
	ProxyList    []string `json:"proxy_list" validate:"max=50"`
	DelayRange   [2]int   `json:"delay_range" validate:"min=1,max=300"`
	UserAgents   []string `json:"user_agents" validate:"max=10"`

	// 增强功能配置
	EnableSimilarWeb  bool     `json:"enable_similarweb"`
	EnableAlexa       bool     `json:"enable_alexa"`
	EnableSEMrush     bool     `json:"enable_semrush"`
	CustomMetrics     []string `json:"custom_metrics" validate:"max=20"`
	WebhookURL        string   `json:"webhook_url" validate:"url"`
	ReportFormat      string   `json:"report_format" validate:"oneof=json csv pdf excel"`
	NotificationEmail string   `json:"notification_email" validate:"email"`
}

// EnhancedQueryRunner 增强的查询运行器
type EnhancedQueryRunner struct {
	query          *Query
	service        *EnhancedService
	workerID       int
	enhancedConfig map[string]interface{}
	proxyPool      *ProxyPool
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
}

// Run 执行增强查询
func (r *EnhancedQueryRunner) Run() {
	r.ctx, r.cancel = context.WithCancel(r.ctx)
	r.wg.Add(1)

	// 更新查询状态
	now := time.Now()
	r.query.Status = "running"
	r.query.StartedAt = &now
	r.query.UpdatedAt = now
	r.service.db.Save(r.query)

	// 执行查询
	go r.executeEnhanced()
}

// executeEnhanced 执行增强查询逻辑
func (r *EnhancedQueryRunner) executeEnhanced() {
	defer r.wg.Done()
	defer r.completeQuery()

	// 执行基础排名查询
	baseRunner := &QueryRunner{
		query:   r.query,
		service: r.service.Service,
		ctx:     r.ctx,
	}

	// 使用enhanced service的方法执行
	go baseRunner.Run()

	// 等待基础查询完成或被取消
	select {
	case <-r.ctx.Done():
		return
	case <-time.After(time.Duration(len(r.query.URLs)*len(r.query.Keywords)*2) * time.Second):
		// 超时保护
	}

	// 执行增强查询
	if enable, ok := r.enhancedConfig["enable_similarweb"].(bool); ok && enable {
		r.executeSimilarWebQueries()
	}

	if enable, ok := r.enhancedConfig["enable_alexa"].(bool); ok && enable {
		r.executeAlexaQueries()
	}

	// 生成报告
	if format, ok := r.enhancedConfig["report_format"].(string); ok && format != "" {
		r.generateReport(format)
	}

	// 发送通知
	if email, ok := r.enhancedConfig["notification_email"].(string); ok && email != "" {
		r.sendNotification(email)
	}
}

// executeSimilarWebQueries 执行SimilarWeb查询
func (r *EnhancedQueryRunner) executeSimilarWebQueries() {
	// 提取域名
	domains := r.extractDomains(r.query.URLs)

	// 批量获取SimilarWeb数据
	results, err := r.service.BatchGetSimilarWebData(domains)
	if err != nil {
		return
	}

	// 保存SimilarWeb结果
	for domain, data := range results {
		r.saveSimilarWebResult(domain, data)
	}
}

// extractDomains 提取域名
func (r *EnhancedQueryRunner) extractDomains(urls []string) []string {
	domainMap := make(map[string]bool)

	for _, urlStr := range urls {
		u, err := url.Parse(urlStr)
		if err == nil {
			domain := u.Hostname()
			if domain != "" {
				domainMap[domain] = true
			}
		}
	}

	domains := make([]string, 0, len(domainMap))
	for domain := range domainMap {
		domains = append(domains, domain)
	}

	return domains
}

// saveSimilarWebResult 保存SimilarWeb结果
func (r *EnhancedQueryRunner) saveSimilarWebResult(domain string, data *SimilarWebData) {
	// 创建SimilarWeb结果记录
	result := &SimilarWebResult{
		ID:           gform.UUID(),
		QueryID:      r.query.ID,
		Domain:       domain,
		Rank:         data.Rank,
		Category:     data.Category,
		CategoryRank: data.CategoryRank,
		Visits:       data.Engagement.Visits,
		TimeOnSite:   data.Engagement.TimeOnSite,
		PageViews:    data.Engagement.PageViews,
		BounceRate:   data.Engagement.BounceRate,
		TrafficData:  data.Traffic,
		CreatedAt:    time.Now(),
	}

	// 保存到数据库
	if err := r.service.db.Create(result).Error; err != nil {
		// 记录错误
	}
}

// executeAlexaQueries 执行Alexa查询
func (r *EnhancedQueryRunner) executeAlexaQueries() {
	// TODO: 实现Alexa查询逻辑
}

// generateReport 生成报告
func (r *EnhancedQueryRunner) generateReport(format string) {
	// TODO: 实现报告生成逻辑
}

// sendNotification 发送通知
func (r *EnhancedQueryRunner) sendNotification(email string) {
	// TODO: 实现邮件通知逻辑
}

// completeQuery 完成查询
func (r *EnhancedQueryRunner) completeQuery() {
	now := time.Now()
	r.query.CompletedAt = &now
	r.query.UpdatedAt = now

	// 计算最终统计
	var total, successCount int64
	r.service.db.Model(&QueryResult{}).
		Where("query_id = ?", r.query.ID).
		Count(&total)
	r.service.db.Model(&QueryResult{}).
		Where("query_id = ? AND position > 0", r.query.ID).
		Count(&successCount)

	failedCount := total - successCount

	r.query.SuccessQueries = int(successCount)
	r.query.FailedQueries = int(failedCount)
	r.query.Progress = 100

	if failedCount == 0 {
		r.query.Status = "completed"
	} else {
		r.query.Status = "completed_with_errors"
	}

	r.service.db.Save(r.query)
}

// Cancel 取消查询
func (r *EnhancedQueryRunner) Cancel() {
	if r.cancel != nil {
		r.cancel()
	}
}

// SimilarWebResult SimilarWeb结果记录
type SimilarWebResult struct {
	ID           string            `json:"id" gorm:"primaryKey"`
	QueryID      string            `json:"query_id" gorm:"not null;index"`
	Domain       string            `json:"domain" gorm:"not null"`
	Rank         int               `json:"rank"`
	Category     string            `json:"category"`
	CategoryRank int               `json:"category_rank"`
	Visits       int               `json:"visits"`
	TimeOnSite   float64           `json:"time_on_site"`
	PageViews    float64           `json:"page_views"`
	BounceRate   float64           `json:"bounce_rate"`
	TrafficData  SimilarWebTraffic `json:"traffic_data" gorm:"type:json"`
	CreatedAt    time.Time         `json:"created_at"`
}

// TableName 表名
func (SimilarWebResult) TableName() string {
	return "siterank_similarweb_results"
}
