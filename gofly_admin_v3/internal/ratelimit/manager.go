package ratelimit

import (
	"context"
	"fmt"
	"sync"
	"time"

	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/internal/store"
)

// UserInfo 速率限制所需的用户信息（最小化）
type UserInfo struct {
	PlanName string
	Plan     string
}

// UserService 用户服务接口（最小化）
type UserService interface {
	GetUserByID(userID string) (*UserInfo, error)
}

// RateLimitManager 统一速率限制管理器
type RateLimitManager struct {
	config      *config.Config
	db          *store.DB
	userService UserService
	limits      map[string]*RateLimiter
	mu          sync.RWMutex

	// 基于套餐的限制配置
	planLimits map[string]*PlanRateLimit

	// 热更新通道
	configChan chan *config.Config

	// 统计信息
	stats map[string]*UserRateLimitStats
}

// PlanRateLimit 套餐速率限制配置
type PlanRateLimit struct {
	Plan                      string
	APIRequestsPerMinute      int
	APIRequestsPerHour        int
	SiteRankRequestsPerMinute int
	SiteRankRequestsPerHour   int
	BatchConcurrentTasks      int
	BatchTasksPerMinute       int
}

// RateLimiter 速率限制器
type RateLimiter struct {
	requestsPerMinute int
	requestsPerHour   int
	tokens            chan time.Time
	mu                sync.Mutex
	lastReset         time.Time
	hourlyCount       int
}

// NewRateLimitManager 创建速率限制管理器
func NewRateLimitManager(cfg *config.Config, db *store.DB, userService UserService) *RateLimitManager {
	rlm := &RateLimitManager{
		config:      cfg,
		db:          db,
		userService: userService,
		limits:      make(map[string]*RateLimiter),
		planLimits:  make(map[string]*PlanRateLimit),
		configChan:  make(chan *config.Config, 1),
		stats:       make(map[string]*UserRateLimitStats),
	}

	// 初始化套餐限制配置
	rlm.initPlanLimits()

	// 启动配置监听
	go rlm.watchConfigChanges()

	return rlm
}

// initPlanLimits 初始化套餐限制配置
func (rlm *RateLimitManager) initPlanLimits() {
	// 先加载默认配置
	rlm.loadDefaultPlanLimits()

	// 从数据库加载套餐配置
	rlm.loadPlanLimitsFromDB()
}

// loadDefaultPlanLimits 加载默认的套餐限制配置
func (rlm *RateLimitManager) loadDefaultPlanLimits() {
	// 从配置或数据库加载套餐限制
	rlm.planLimits["FREE"] = &PlanRateLimit{
		Plan:                      "FREE",
		APIRequestsPerMinute:      30,
		APIRequestsPerHour:        1000,
		SiteRankRequestsPerMinute: 2,
		SiteRankRequestsPerHour:   50,
		BatchConcurrentTasks:      1,
		BatchTasksPerMinute:       5,
	}

	rlm.planLimits["PRO"] = &PlanRateLimit{
		Plan:                      "PRO",
		APIRequestsPerMinute:      100,
		APIRequestsPerHour:        5000,
		SiteRankRequestsPerMinute: 10,
		SiteRankRequestsPerHour:   200,
		BatchConcurrentTasks:      5,
		BatchTasksPerMinute:       20,
	}

	rlm.planLimits["MAX"] = &PlanRateLimit{
		Plan:                      "MAX",
		APIRequestsPerMinute:      500,
		APIRequestsPerHour:        20000,
		SiteRankRequestsPerMinute: 50,
		SiteRankRequestsPerHour:   1000,
		BatchConcurrentTasks:      20,
		BatchTasksPerMinute:       100,
	}
}

// loadPlanLimitsFromDB 从数据库加载套餐限制配置
func (rlm *RateLimitManager) loadPlanLimitsFromDB() {
	if rlm.db == nil {
		return
	}

	// 查询所有活跃的速率限制配置
	var configs []RateLimitConfig
	if err := rlm.db.Where("is_active = ?", true).Find(&configs).Error; err != nil {
		// 查询失败，使用默认配置
		return
	}

	// 按套餐分组配置
	planConfigs := make(map[string]*PlanRateLimitDB)

	for _, config := range configs {
		if _, exists := planConfigs[config.Plan]; !exists {
			planConfigs[config.Plan] = &PlanRateLimitDB{
				Plan:      config.Plan,
				IsActive:  true,
				CreatedAt: config.CreatedAt,
				UpdatedAt: config.UpdatedAt,
			}
		}

		featureConfig := config.ToConfig()

		switch config.Feature {
		case "API":
			planConfigs[config.Plan].API = featureConfig
		case "SITE_RANK":
			planConfigs[config.Plan].SiteRank = featureConfig
		case "BATCH":
			planConfigs[config.Plan].Batch = featureConfig
		}
	}

	// 转换并更新到内存配置
	for plan, dbConfig := range planConfigs {
		rlm.planLimits[plan] = dbConfig.ToConfig()
	}
}

// CheckAPIRateLimit 检查API速率限制
func (rlm *RateLimitManager) CheckAPIRateLimit(ctx context.Context, userID string) error {
	// 获取用户信息
	userInfo, err := rlm.userService.GetUserByID(userID)
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}

	// 获取用户套餐限制
	plan := userInfo.PlanName
	if plan == "" {
		plan = userInfo.Plan
	}
	planLimit, exists := rlm.planLimits[plan]
	if !exists {
		planLimit = rlm.planLimits["FREE"] // 默认限制
	}

	// 获取或创建用户限流器
	limiter := rlm.getUserLimiter(userID, planLimit.APIRequestsPerMinute, planLimit.APIRequestsPerHour)

	// 检查限制
	return limiter.Wait(ctx)
}

// CheckSiteRankRateLimit 检查SiteRank速率限制
func (rlm *RateLimitManager) CheckSiteRankRateLimit(ctx context.Context, userID string) error {
	// 获取用户信息
	userInfo, err := rlm.userService.GetUserByID(userID)
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}

	// 获取用户套餐限制
	plan := userInfo.PlanName
	if plan == "" {
		plan = userInfo.Plan
	}
	planLimit, exists := rlm.planLimits[plan]
	if !exists {
		planLimit = rlm.planLimits["FREE"] // 默认限制
	}

	// 获取或创建用户限流器
	limiter := rlm.getUserLimiter(userID,
		planLimit.SiteRankRequestsPerMinute,
		planLimit.SiteRankRequestsPerHour)

	// 检查限制
	return limiter.Wait(ctx)
}

// CheckBatchRateLimit 检查Batch任务速率限制
func (rlm *RateLimitManager) CheckBatchRateLimit(ctx context.Context, userID string) error {
	// 获取用户信息
	userInfo, err := rlm.userService.GetUserByID(userID)
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}

	// 获取用户套餐限制
	plan := userInfo.PlanName
	if plan == "" {
		plan = userInfo.Plan
	}
	planLimit, exists := rlm.planLimits[plan]
	if !exists {
		planLimit = rlm.planLimits["FREE"] // 默认限制
	}

	// 获取或创建用户限流器
	limiter := rlm.getUserLimiter(userID,
		planLimit.BatchTasksPerMinute,
		planLimit.BatchTasksPerMinute*60) // 简化处理

	// 检查限制
	return limiter.Wait(ctx)
}

// GetBatchConcurrentLimit 获取Batch并发限制
func (rlm *RateLimitManager) GetBatchConcurrentLimit(userID string) int {
	// 获取用户信息
	userInfo, err := rlm.userService.GetUserByID(userID)
	if err != nil {
		return 1 // 默认限制
	}

	// 获取用户套餐限制
	plan := userInfo.PlanName
	if plan == "" {
		plan = userInfo.Plan
	}
	planLimit, exists := rlm.planLimits[plan]
	if !exists {
		planLimit = rlm.planLimits["FREE"]
	}

	return planLimit.BatchConcurrentTasks
}

// getUserLimiter 获取或创建用户限流器
func (rlm *RateLimitManager) getUserLimiter(userID string, perMinute, perHour int) *RateLimiter {
	rlm.mu.RLock()
	limiter, exists := rlm.limits[userID]
	rlm.mu.RUnlock()

	if !exists {
		rlm.mu.Lock()
		// 双重检查
		limiter, exists = rlm.limits[userID]
		if !exists {
			limiter = NewRateLimiter(perMinute, perHour)
			rlm.limits[userID] = limiter

			// 启动清理goroutine
			go rlm.cleanupUserLimiter(userID)
		}
		rlm.mu.Unlock()
	}

	return limiter
}

// cleanupUserLimiter 清理不活跃的用户限流器
func (rlm *RateLimitManager) cleanupUserLimiter(userID string) {
	time.Sleep(1 * time.Hour) // 等待1小时

	rlm.mu.Lock()
	defer rlm.mu.Unlock()

	// 检查是否还存在，如果存在说明用户仍然活跃
	if limiter, exists := rlm.limits[userID]; exists {
		// 检查最后活动时间
		if time.Since(limiter.lastReset) > 30*time.Minute {
			delete(rlm.limits, userID)
		}
	}
}

// UpdatePlanLimit 更新套餐限制配置
func (rlm *RateLimitManager) UpdatePlanLimit(plan string, limit *PlanRateLimit) error {
	rlm.mu.Lock()
	defer rlm.mu.Unlock()

	// 更新内存配置
	rlm.planLimits[plan] = limit

	// 更新数据库配置
	if rlm.db != nil {
		// API 配置
		apiConfig := RateLimitConfig{
			Plan:      plan,
			Feature:   "API",
			PerMinute: limit.APIRequestsPerMinute,
			PerHour:   limit.APIRequestsPerHour,
			IsActive:  true,
		}
		rlm.db.Where("plan = ? AND feature = ?", plan, "API").Assign(apiConfig).FirstOrCreate(&apiConfig)

		// SiteRank 配置
		siterankConfig := RateLimitConfig{
			Plan:      plan,
			Feature:   "SITE_RANK",
			PerMinute: limit.SiteRankRequestsPerMinute,
			PerHour:   limit.SiteRankRequestsPerHour,
			IsActive:  true,
		}
		rlm.db.Where("plan = ? AND feature = ?", plan, "SITE_RANK").Assign(siterankConfig).FirstOrCreate(&siterankConfig)

		// Batch 配置
		batchConfig := RateLimitConfig{
			Plan:       plan,
			Feature:    "BATCH",
			PerMinute:  limit.BatchTasksPerMinute,
			PerHour:    limit.BatchTasksPerMinute,
			Concurrent: limit.BatchConcurrentTasks,
			IsActive:   true,
		}
		rlm.db.Where("plan = ? AND feature = ?", plan, "BATCH").Assign(batchConfig).FirstOrCreate(&batchConfig)
	}

	// 更新现有用户的限流器
	for userID, limiter := range rlm.limits {
		userInfo, err := rlm.userService.GetUserByID(userID)
		if err != nil {
			continue
		}

		if userInfo.PlanName == plan {
			// 更新限流器配置
			limiter.requestsPerMinute = limit.APIRequestsPerMinute
			limiter.requestsPerHour = limit.APIRequestsPerHour
		}
	}

	return nil
}

// GetRateLimitStats 获取速率限制统计
func (rlm *RateLimitManager) GetRateLimitStats(userID string) map[string]interface{} {
	userInfo, err := rlm.userService.GetUserByID(userID)
	if err != nil {
		return map[string]interface{}{"error": "user not found"}
	}

	plan := userInfo.Plan
	if plan == "" {
		plan = userInfo.PlanName
	}
	planLimit, exists := rlm.planLimits[plan]
	if !exists {
		planLimit = rlm.planLimits["FREE"]
	}

	rlm.mu.RLock()
	limiter := rlm.limits[userID]
	rlm.mu.RUnlock()

	stats := map[string]interface{}{
		"user_id":                   userID,
		"plan":                      userInfo.Plan,
		"api_limit_per_minute":      planLimit.APIRequestsPerMinute,
		"api_limit_per_hour":        planLimit.APIRequestsPerHour,
		"siterank_limit_per_minute": planLimit.SiteRankRequestsPerMinute,
		"siterank_limit_per_hour":   planLimit.SiteRankRequestsPerHour,
		"batch_concurrent_limit":    planLimit.BatchConcurrentTasks,
		"batch_tasks_per_minute":    planLimit.BatchTasksPerMinute,
	}

	if limiter != nil {
		limiter.mu.Lock()
		stats["api_minute_requests"] = limiter.hourlyCount // 简化统计
		stats["api_tokens_available"] = len(limiter.tokens)
		limiter.mu.Unlock()
	}

	return stats
}

// watchConfigChanges 监听配置变化
func (rlm *RateLimitManager) watchConfigChanges() {
	for newConfig := range rlm.configChan {
		rlm.mu.Lock()
		rlm.config = newConfig
		// 重新加载套餐限制配置
		rlm.initPlanLimits()
		rlm.mu.Unlock()
	}
}

// UpdateConfig 更新配置（热更新）
func (rlm *RateLimitManager) UpdateConfig(cfg *config.Config) {
	select {
	case rlm.configChan <- cfg:
	default:
		// 通道已满，跳过
	}
}

// NewRateLimiter 创建速率限制器
func NewRateLimiter(requestsPerMinute, requestsPerHour int) *RateLimiter {
	rl := &RateLimiter{
		requestsPerMinute: requestsPerMinute,
		requestsPerHour:   requestsPerHour,
		tokens:            make(chan time.Time, requestsPerMinute),
		lastReset:         time.Now(),
	}

	// 初始化令牌
	go rl.fillTokens()

	return rl
}

// fillTokens 填充令牌
func (rl *RateLimiter) fillTokens() {
	ticker := time.NewTicker(time.Minute / time.Duration(rl.requestsPerMinute))
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.mu.Lock()
			// 检查是否需要重置小时计数
			if time.Since(rl.lastReset) > time.Hour {
				rl.hourlyCount = 0
				rl.lastReset = time.Now()
			}
			rl.mu.Unlock()

			select {
			case rl.tokens <- time.Now():
				// 成功添加令牌
			default:
				// 令牌桶已满
			}
		}
	}
}

// Wait 等待可用令牌
func (rl *RateLimiter) Wait(ctx context.Context) error {
	select {
	case <-rl.tokens:
		rl.mu.Lock()
		rl.hourlyCount++
		if rl.hourlyCount >= rl.requestsPerHour {
			// 达到小时限制，等待到下一小时
			waitTime := time.Hour - time.Since(rl.lastReset)
			rl.mu.Unlock()
			select {
			case <-time.After(waitTime):
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		rl.mu.Unlock()
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(30 * time.Second):
		return fmt.Errorf("rate limit wait timeout")
	}
}

// GetPlanLimits 获取套餐限制配置
func (rlm *RateLimitManager) GetPlanLimits() map[string]*PlanRateLimit {
	rlm.mu.RLock()
	defer rlm.mu.RUnlock()

	// 返回配置的副本
	result := make(map[string]*PlanRateLimit)
	for plan, limit := range rlm.planLimits {
		limitCopy := *limit
		result[plan] = &limitCopy
	}

	return result
}

// GetUserService 获取用户服务实例
func (rlm *RateLimitManager) GetUserService() UserService {
	return rlm.userService
}

// GetSystemStats 获取系统统计
func (rlm *RateLimitManager) GetSystemStats() map[string]interface{} {
	rlm.mu.RLock()
	defer rlm.mu.RUnlock()

	// 统计活跃限流器
	totalUsers := len(rlm.limits)

	// 按套餐统计用户数
	planStats := make(map[string]int)
	for uid := range rlm.limits {
		userInfo, err := rlm.userService.GetUserByID(uid)
		if err == nil {
			plan := userInfo.PlanName
			if plan == "" {
				plan = userInfo.Plan
			}
			planStats[plan]++
		}
	}

	return map[string]interface{}{
		"total_active_users": totalUsers,
		"plan_distribution":  planStats,
		"plan_limits":        rlm.planLimits,
		"system_limits": map[string]interface{}{
			"max_concurrent_users":       10000, // 系统最大并发用户数
			"global_requests_per_second": 1000,  // 全局QPS限制
		},
	}
}

// ListActiveLimiters 列出活跃的限流器
func (rlm *RateLimitManager) ListActiveLimiters(page, size int) ([]map[string]interface{}, int64) {
	rlm.mu.RLock()
	defer rlm.mu.RUnlock()

	// 获取所有限流器
	var limiters []map[string]interface{}

	for userID, limiter := range rlm.limits {
		userInfo, err := rlm.userService.GetUserByID(userID)
		if err != nil {
			continue
		}

		limiter.mu.Lock()
		limiterInfo := map[string]interface{}{
			"user_id":          userID,
			"plan":             userInfo.PlanName,
			"hourly_count":     limiter.hourlyCount,
			"tokens_available": len(limiter.tokens),
			"last_active":      limiter.lastReset,
		}
		limiter.mu.Unlock()

		limiters = append(limiters, limiterInfo)
	}

	total := int64(len(limiters))

	// 分页处理
	start := (page - 1) * size
	end := start + size
	if start > len(limiters) {
		start = len(limiters)
	}
	if end > len(limiters) {
		end = len(limiters)
	}

	return limiters[start:end], total
}

// ResetUserLimiter 重置用户限流器
func (rlm *RateLimitManager) ResetUserLimiter(userID string) error {
	rlm.mu.Lock()
	defer rlm.mu.Unlock()

	limiter, exists := rlm.limits[userID]
	if !exists {
		return fmt.Errorf("user limiter not found")
	}

	// 重置限流器状态
	limiter.mu.Lock()
	limiter.hourlyCount = 0
	limiter.lastReset = time.Now()

	// 清空令牌桶并重新填充
	for len(limiter.tokens) > 0 {
		<-limiter.tokens
	}

	// 填充初始令牌
	for i := 0; i < limiter.requestsPerMinute; i++ {
		select {
		case limiter.tokens <- time.Now():
		default:
			break
		}
	}
	limiter.mu.Unlock()

	// 记录重置日志
	rlm.logRateLimitAction(userID, "reset", "User rate limiter reset by admin")

	return nil
}

// logRateLimitAction 记录限流操作日志
func (rlm *RateLimitManager) logRateLimitAction(userID, action, details string) {
	// 简化：此版本不落库，仅保留扩展点
	_ = userID
	_ = action
	_ = details
}

// recordUsage 记录使用情况
func (rlm *RateLimitManager) recordUsage(userID, feature string, period string, count int) {
	rlm.mu.Lock()
	defer rlm.mu.Unlock()

	// 更新内存统计
	if stats, exists := rlm.stats[userID]; exists {
		switch feature {
		case "API":
			if period == "MINUTE" {
				stats.APIMinuteUsed += int64(count)
			} else if period == "HOUR" {
				stats.APIHourUsed += int64(count)
			}
		case "SITE_RANK":
			if period == "MINUTE" {
				stats.SiteRankMinuteUsed += int64(count)
			} else if period == "HOUR" {
				stats.SiteRankHourUsed += int64(count)
			}
		case "BATCH":
			if period == "MINUTE" {
				stats.BatchMinuteUsed += int64(count)
			}
		}
		stats.LastUpdated = time.Now()
	} else {
		// 创建新的统计
		userInfo, err := rlm.userService.GetUserByID(userID)
		if err == nil {
			plan := userInfo.Plan
			if plan == "" {
				plan = userInfo.PlanName
			}
			_, _ = rlm.planLimits[plan]
			stats := &UserRateLimitStats{
				UserID:      userID,
				Plan:        plan,
				LastUpdated: time.Now(),
			}

			// 设置初始使用量
			switch feature {
			case "API":
				if period == "MINUTE" {
					stats.APIMinuteUsed = int64(count)
				} else if period == "HOUR" {
					stats.APIHourUsed = int64(count)
				}
			case "SITE_RANK":
				if period == "MINUTE" {
					stats.SiteRankMinuteUsed = int64(count)
				} else if period == "HOUR" {
					stats.SiteRankHourUsed = int64(count)
				}
			case "BATCH":
				if period == "MINUTE" {
					stats.BatchMinuteUsed = int64(count)
				}
			}

			rlm.stats[userID] = stats
		}
	}

	// 持久化到数据库（如果需要）
	// TODO: 实现数据库持久化逻辑
}

// UserRateLimitStats 用户速率限制统计信息
type UserRateLimitStats struct {
	UserID             string    `json:"user_id"`
	Plan               string    `json:"plan"`
	APIMinuteUsed      int64     `json:"api_minute_used"`
	APIHourUsed        int64     `json:"api_hour_used"`
	SiteRankMinuteUsed int64     `json:"site_rank_minute_used"`
	SiteRankHourUsed   int64     `json:"site_rank_hour_used"`
	BatchMinuteUsed    int64     `json:"batch_minute_used"`
	LastUpdated        time.Time `json:"last_updated"`
	LastActive         time.Time `json:"last_active"`
}
