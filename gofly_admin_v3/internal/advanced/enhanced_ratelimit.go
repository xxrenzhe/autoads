package advanced

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/internal/ratelimit"
	"gofly-admin-v3/internal/user"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/tools/glog"
	"gorm.io/gorm"
)

// EnhancedRateLimitManager 增强的速率限制管理器
type EnhancedRateLimitManager struct {
	*ratelimit.RateLimitManager
	db        *gorm.DB
	cache     *cache.Cache
	analytics *RateLimitAnalytics
	hotConfig *HotConfigManager
	mu        sync.RWMutex
}

// RateLimitAnalytics 速率限制分析器
type RateLimitAnalytics struct {
	db    *gorm.DB
	cache *cache.Cache
}

// HotConfigManager 热配置管理器
type HotConfigManager struct {
	configs   map[string]*DynamicRateLimit
	callbacks map[string][]ConfigChangeCallback
	mu        sync.RWMutex
}

// DynamicRateLimit 动态速率限制配置
type DynamicRateLimit struct {
	Plan               string    `json:"plan"`
	Feature            string    `json:"feature"`
	BaseLimit          int       `json:"base_limit"`
	BurstLimit         int       `json:"burst_limit"`
	WindowSize         int       `json:"window_size"` // 秒
	AdaptiveEnabled    bool      `json:"adaptive_enabled"`
	AdaptiveThreshold  float64   `json:"adaptive_threshold"`
	PriorityMultiplier float64   `json:"priority_multiplier"`
	LastUpdated        time.Time `json:"last_updated"`
	UpdatedBy          string    `json:"updated_by"`
}

// ConfigChangeCallback 配置变更回调
type ConfigChangeCallback func(oldConfig, newConfig *DynamicRateLimit) error

// UserUsagePattern 用户使用模式
type UserUsagePattern struct {
	UserID              string    `json:"user_id"`
	Plan                string    `json:"plan"`
	Feature             string    `json:"feature"`
	AvgRequestsPerHour  float64   `json:"avg_requests_per_hour"`
	PeakRequestsPerHour int       `json:"peak_requests_per_hour"`
	UsageVariance       float64   `json:"usage_variance"`
	LastAnalyzed        time.Time `json:"last_analyzed"`
	TrendDirection      string    `json:"trend_direction"` // increasing, decreasing, stable
	RiskScore           float64   `json:"risk_score"`      // 0-1, 异常使用风险评分
}

// NewEnhancedRateLimitManager 创建增强的速率限制管理器
func NewEnhancedRateLimitManager(
	baseMgr *ratelimit.RateLimitManager,
	db *gorm.DB,
	cache *cache.Cache,
) *EnhancedRateLimitManager {

	analytics := &RateLimitAnalytics{
		db:    db,
		cache: cache,
	}

	hotConfig := &HotConfigManager{
		configs:   make(map[string]*DynamicRateLimit),
		callbacks: make(map[string][]ConfigChangeCallback),
	}

	enhanced := &EnhancedRateLimitManager{
		RateLimitManager: baseMgr,
		db:               db,
		cache:            cache,
		analytics:        analytics,
		hotConfig:        hotConfig,
	}

	// 启动分析器
	go enhanced.startAnalytics()

	// 加载动态配置
	enhanced.loadDynamicConfigs()

	return enhanced
}

// CheckAdaptiveRateLimit 自适应速率限制检查
func (e *EnhancedRateLimitManager) CheckAdaptiveRateLimit(ctx context.Context, userID, feature string) error {
	// 获取用户使用模式
	pattern, err := e.analytics.GetUserUsagePattern(userID, feature)
	if err != nil {
		// 如果没有使用模式，使用基础限制
		return e.RateLimitManager.CheckAPIRateLimit(ctx, userID)
	}

	// 获取动态配置
	configKey := fmt.Sprintf("%s_%s", pattern.Plan, feature)
	e.hotConfig.mu.RLock()
	dynamicConfig, exists := e.hotConfig.configs[configKey]
	e.hotConfig.mu.RUnlock()

	if !exists || !dynamicConfig.AdaptiveEnabled {
		// 使用基础限制
		return e.RateLimitManager.CheckAPIRateLimit(ctx, userID)
	}

	// 计算自适应限制
	adaptiveLimit := e.calculateAdaptiveLimit(pattern, dynamicConfig)

	// 应用自适应限制
	return e.checkCustomRateLimit(ctx, userID, feature, adaptiveLimit)
}

// calculateAdaptiveLimit 计算自适应限制
func (e *EnhancedRateLimitManager) calculateAdaptiveLimit(pattern *UserUsagePattern, config *DynamicRateLimit) int {
	baseLimit := float64(config.BaseLimit)

	// 根据使用趋势调整
	switch pattern.TrendDirection {
	case "increasing":
		if pattern.RiskScore < 0.3 {
			// 低风险用户，允许更高限制
			baseLimit *= 1.2
		}
	case "decreasing":
		// 使用量下降，可以给予更多余量
		baseLimit *= 1.1
	}

	// 根据使用方差调整（稳定用户给予更高限制）
	if pattern.UsageVariance < 0.2 {
		baseLimit *= 1.1
	}

	// 应用优先级乘数
	baseLimit *= config.PriorityMultiplier

	// 确保不超过突发限制
	if int(baseLimit) > config.BurstLimit {
		return config.BurstLimit
	}

	return int(baseLimit)
}

// checkCustomRateLimit 检查自定义速率限制
func (e *EnhancedRateLimitManager) checkCustomRateLimit(ctx context.Context, userID, feature string, limit int) error {
	cacheKey := fmt.Sprintf("rate_limit:%s:%s", userID, feature)

	// 获取当前计数
	count, err := e.cache.Get(cacheKey)
	if err != nil {
		count = 0
	}

	currentCount := count.(int)
	if currentCount >= limit {
		return fmt.Errorf("rate limit exceeded: %d/%d", currentCount, limit)
	}

	// 增加计数
	newCount := currentCount + 1
	e.cache.Set(cacheKey, newCount, time.Minute)

	// 记录使用情况
	e.analytics.RecordUsage(userID, feature, 1)

	return nil
}

// UpdateDynamicConfig 更新动态配置
func (e *EnhancedRateLimitManager) UpdateDynamicConfig(plan, feature string, config *DynamicRateLimit, updatedBy string) error {
	e.hotConfig.mu.Lock()
	defer e.hotConfig.mu.Unlock()

	configKey := fmt.Sprintf("%s_%s", plan, feature)
	oldConfig := e.hotConfig.configs[configKey]

	// 更新配置
	config.LastUpdated = time.Now()
	config.UpdatedBy = updatedBy
	e.hotConfig.configs[configKey] = config

	// 执行回调
	if callbacks, exists := e.hotConfig.callbacks[configKey]; exists {
		for _, callback := range callbacks {
			if err := callback(oldConfig, config); err != nil {
				glog.Error(context.Background(), "config_callback_failed", gf.Map{
					"config_key": configKey,
					"error":      err.Error(),
				})
			}
		}
	}

	// 持久化到数据库
	if err := e.saveDynamicConfig(config); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	glog.Info(context.Background(), "dynamic_config_updated", gf.Map{
		"plan":       plan,
		"feature":    feature,
		"updated_by": updatedBy,
	})

	return nil
}

// RegisterConfigChangeCallback 注册配置变更回调
func (e *EnhancedRateLimitManager) RegisterConfigChangeCallback(plan, feature string, callback ConfigChangeCallback) {
	e.hotConfig.mu.Lock()
	defer e.hotConfig.mu.Unlock()

	configKey := fmt.Sprintf("%s_%s", plan, feature)
	e.hotConfig.callbacks[configKey] = append(e.hotConfig.callbacks[configKey], callback)
}

// GetUserUsagePattern 获取用户使用模式
func (a *RateLimitAnalytics) GetUserUsagePattern(userID, feature string) (*UserUsagePattern, error) {
	// 先从缓存获取
	cacheKey := fmt.Sprintf("usage_pattern:%s:%s", userID, feature)
	if cached, err := a.cache.Get(cacheKey); err == nil {
		if pattern, ok := cached.(*UserUsagePattern); ok {
			return pattern, nil
		}
	}

	// 从数据库分析
	pattern, err := a.analyzeUserUsagePattern(userID, feature)
	if err != nil {
		return nil, err
	}

	// 缓存结果
	a.cache.Set(cacheKey, pattern, 30*time.Minute)

	return pattern, nil
}

// analyzeUserUsagePattern 分析用户使用模式
func (a *RateLimitAnalytics) analyzeUserUsagePattern(userID, feature string) (*UserUsagePattern, error) {
	// 查询最近30天的使用数据
	var usages []ratelimit.RateLimitUsage
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	if err := a.db.Where("user_id = ? AND feature = ? AND recorded_at > ?",
		userID, feature, thirtyDaysAgo).
		Order("recorded_at ASC").
		Find(&usages).Error; err != nil {
		return nil, err
	}

	if len(usages) == 0 {
		return &UserUsagePattern{
			UserID:              userID,
			Feature:             feature,
			AvgRequestsPerHour:  0,
			PeakRequestsPerHour: 0,
			UsageVariance:       0,
			LastAnalyzed:        time.Now(),
			TrendDirection:      "stable",
			RiskScore:           0,
		}, nil
	}

	// 计算统计指标
	totalRequests := 0
	hourlyUsage := make(map[string]int)

	for _, usage := range usages {
		totalRequests += usage.UsedCount
		hour := usage.RecordedAt.Format("2006-01-02-15")
		hourlyUsage[hour] += usage.UsedCount
	}

	// 计算平均值和峰值
	avgPerHour := float64(totalRequests) / float64(len(hourlyUsage))
	peakPerHour := 0

	var hourlyValues []float64
	for _, count := range hourlyUsage {
		if count > peakPerHour {
			peakPerHour = count
		}
		hourlyValues = append(hourlyValues, float64(count))
	}

	// 计算方差
	variance := calculateVariance(hourlyValues, avgPerHour)

	// 分析趋势
	trend := analyzeTrend(usages)

	// 计算风险评分
	riskScore := calculateRiskScore(avgPerHour, float64(peakPerHour), variance, trend)

	// 获取用户计划
	var user user.User
	if err := a.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}

	return &UserUsagePattern{
		UserID:              userID,
		Plan:                user.Plan,
		Feature:             feature,
		AvgRequestsPerHour:  avgPerHour,
		PeakRequestsPerHour: peakPerHour,
		UsageVariance:       variance,
		LastAnalyzed:        time.Now(),
		TrendDirection:      trend,
		RiskScore:           riskScore,
	}, nil
}

// calculateVariance 计算方差
func calculateVariance(values []float64, mean float64) float64 {
	if len(values) == 0 {
		return 0
	}

	sum := 0.0
	for _, v := range values {
		diff := v - mean
		sum += diff * diff
	}

	return sum / float64(len(values))
}

// analyzeTrend 分析趋势
func analyzeTrend(usages []ratelimit.RateLimitUsage) string {
	if len(usages) < 7 {
		return "stable"
	}

	// 比较最近7天和之前7天的平均使用量
	mid := len(usages) / 2

	recentSum := 0
	for i := mid; i < len(usages); i++ {
		recentSum += usages[i].UsedCount
	}
	recentAvg := float64(recentSum) / float64(len(usages)-mid)

	earlierSum := 0
	for i := 0; i < mid; i++ {
		earlierSum += usages[i].UsedCount
	}
	earlierAvg := float64(earlierSum) / float64(mid)

	if recentAvg > earlierAvg*1.2 {
		return "increasing"
	} else if recentAvg < earlierAvg*0.8 {
		return "decreasing"
	}

	return "stable"
}

// calculateRiskScore 计算风险评分
func calculateRiskScore(avgPerHour, peakPerHour, variance float64, trend string) float64 {
	score := 0.0

	// 基于峰值和平均值的比率
	if avgPerHour > 0 {
		peakRatio := peakPerHour / avgPerHour
		if peakRatio > 5 {
			score += 0.3
		} else if peakRatio > 3 {
			score += 0.2
		} else if peakRatio > 2 {
			score += 0.1
		}
	}

	// 基于方差
	if variance > 100 {
		score += 0.3
	} else if variance > 50 {
		score += 0.2
	} else if variance > 20 {
		score += 0.1
	}

	// 基于趋势
	if trend == "increasing" {
		score += 0.2
	}

	// 基于绝对使用量
	if avgPerHour > 1000 {
		score += 0.2
	} else if avgPerHour > 500 {
		score += 0.1
	}

	if score > 1.0 {
		score = 1.0
	}

	return score
}

// RecordUsage 记录使用情况
func (a *RateLimitAnalytics) RecordUsage(userID, feature string, count int) {
	// 异步记录，避免影响性能
	go func() {
		// 更新实时统计
		cacheKey := fmt.Sprintf("usage_stats:%s:%s", userID, feature)
		currentStats, _ := a.cache.Get(cacheKey)

		stats := map[string]interface{}{
			"total_requests": count,
			"last_request":   time.Now(),
		}

		if currentStats != nil {
			if existing, ok := currentStats.(map[string]interface{}); ok {
				if total, ok := existing["total_requests"].(int); ok {
					stats["total_requests"] = total + count
				}
			}
		}

		a.cache.Set(cacheKey, stats, time.Hour)
	}()
}

// startAnalytics 启动分析器
func (e *EnhancedRateLimitManager) startAnalytics() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			e.runPeriodicAnalysis()
		}
	}
}

// runPeriodicAnalysis 运行周期性分析
func (e *EnhancedRateLimitManager) runPeriodicAnalysis() {
	ctx := context.Background()

	// 分析所有活跃用户的使用模式
	var users []user.User
	if err := e.db.Where("status = ?", 1).Find(&users).Error; err != nil {
		glog.Error(ctx, "failed_to_get_users_for_analysis", gf.Map{
			"error": err.Error(),
		})
		return
	}

	features := []string{"API", "SITE_RANK", "BATCH"}

	for _, u := range users {
		for _, feature := range features {
			pattern, err := e.analytics.analyzeUserUsagePattern(fmt.Sprintf("%d", u.ID), feature)
			if err != nil {
				continue
			}

			// 缓存分析结果
			cacheKey := fmt.Sprintf("usage_pattern:%d:%s", u.ID, feature)
			e.cache.Set(cacheKey, pattern, 30*time.Minute)

			// 检查是否需要调整限制
			if pattern.RiskScore > 0.7 {
				glog.Warn(ctx, "high_risk_user_detected", gf.Map{
					"user_id":    u.ID,
					"feature":    feature,
					"risk_score": pattern.RiskScore,
				})
			}
		}
	}

	glog.Info(ctx, "periodic_analysis_completed", gf.Map{
		"analyzed_users": len(users),
		"features":       features,
	})
}

// loadDynamicConfigs 加载动态配置
func (e *EnhancedRateLimitManager) loadDynamicConfigs() {
	// 从数据库加载动态配置
	// 这里简化处理，实际应该从数据库加载
	defaultConfigs := map[string]*DynamicRateLimit{
		"FREE_API": {
			Plan:               "FREE",
			Feature:            "API",
			BaseLimit:          30,
			BurstLimit:         60,
			WindowSize:         60,
			AdaptiveEnabled:    true,
			AdaptiveThreshold:  0.8,
			PriorityMultiplier: 1.0,
			LastUpdated:        time.Now(),
		},
		"PRO_API": {
			Plan:               "PRO",
			Feature:            "API",
			BaseLimit:          100,
			BurstLimit:         200,
			WindowSize:         60,
			AdaptiveEnabled:    true,
			AdaptiveThreshold:  0.8,
			PriorityMultiplier: 1.2,
			LastUpdated:        time.Now(),
		},
	}

	e.hotConfig.mu.Lock()
	e.hotConfig.configs = defaultConfigs
	e.hotConfig.mu.Unlock()
}

// saveDynamicConfig 保存动态配置
func (e *EnhancedRateLimitManager) saveDynamicConfig(config *DynamicRateLimit) error {
	// 这里应该保存到数据库
	// 简化处理，实际应该有专门的配置表
	return nil
}

// RegisterEnhancedRateLimitRoutes 注册增强速率限制路由
func RegisterEnhancedRateLimitRoutes(r *gin.RouterGroup, manager *EnhancedRateLimitManager) {
	rateLimit := r.Group("/rate-limit")
	{
		// 获取用户使用模式
		rateLimit.GET("/usage-pattern/:userID/:feature", func(c *gin.Context) {
			userID := c.Param("userID")
			feature := c.Param("feature")

			pattern, err := manager.analytics.GetUserUsagePattern(userID, feature)
			if err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code": 0,
				"data": pattern,
			})
		})

		// 更新动态配置
		rateLimit.POST("/config/:plan/:feature", func(c *gin.Context) {
			plan := c.Param("plan")
			feature := c.Param("feature")

			var config DynamicRateLimit
			if err := c.ShouldBindJSON(&config); err != nil {
				c.JSON(200, gin.H{
					"code":    1001,
					"message": "Invalid request body",
				})
				return
			}

			config.Plan = plan
			config.Feature = feature

			if err := manager.UpdateDynamicConfig(plan, feature, &config, "admin"); err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code":    0,
				"message": "Configuration updated successfully",
			})
		})

		// 获取动态配置
		rateLimit.GET("/config/:plan/:feature", func(c *gin.Context) {
			plan := c.Param("plan")
			feature := c.Param("feature")

			configKey := fmt.Sprintf("%s_%s", plan, feature)
			manager.hotConfig.mu.RLock()
			config, exists := manager.hotConfig.configs[configKey]
			manager.hotConfig.mu.RUnlock()

			if !exists {
				c.JSON(200, gin.H{
					"code":    4004,
					"message": "Configuration not found",
				})
				return
			}

			c.JSON(200, gin.H{
				"code": 0,
				"data": config,
			})
		})
	}
}
