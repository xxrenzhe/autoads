//go:build autoads_advanced

package ratelimit

import (
	"context"
	"fmt"
	"sync"
	"time"

	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/gtime"
	"gofly-admin-v3/utils/tools/glog"
)

// StatsCollector 统计收集器
type StatsCollector struct {
	db            *store.DB
	manager       *RateLimitManager
	flushInterval time.Duration
	buffer        map[string]*UserUsageBuffer
	mu            sync.RWMutex
	stopChan      chan struct{}
}

// UserUsageBuffer 用户使用缓冲区
type UserUsageBuffer struct {
	UserID   string
	Plan     string
	API      *UsageBuffer
	SiteRank *UsageBuffer
	Batch    *UsageBuffer
}

// UsageBuffer 使用缓冲区
type UsageBuffer struct {
	MinuteCount int
	HourCount   int
	LastFlush   time.Time
}

// NewStatsCollector 创建统计收集器
func NewStatsCollector(db *store.DB, manager *RateLimitManager, flushInterval time.Duration) *StatsCollector {
	sc := &StatsCollector{
		db:            db,
		manager:       manager,
		flushInterval: flushInterval,
		buffer:        make(map[string]*UserUsageBuffer),
		stopChan:      make(chan struct{}),
	}

	// 启动定时刷写
	go sc.startFlusher()

	return sc
}

// RecordUsage 记录使用情况
func (sc *StatsCollector) RecordUsage(userID, feature string, count int) {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	// 获取或创建用户缓冲区
	buffer, exists := sc.buffer[userID]
	if !exists {
		userInfo, err := sc.manager.userService.GetUserByID(userID)
		if err != nil {
			return
		}

		buffer = &UserUsageBuffer{
			UserID: userID,
			Plan: func() string {
				if userInfo.Plan != "" {
					return userInfo.Plan
				}
				return userInfo.PlanName
			}(),
			API:      &UsageBuffer{},
			SiteRank: &UsageBuffer{},
			Batch:    &UsageBuffer{},
		}
		sc.buffer[userID] = buffer
	}

	// 更新对应特性的计数
	switch feature {
	case "API":
		buffer.API.MinuteCount += count
		buffer.API.HourCount += count
	case "SITE_RANK":
		buffer.SiteRank.MinuteCount += count
		buffer.SiteRank.HourCount += count
	case "BATCH":
		buffer.Batch.MinuteCount += count
		buffer.Batch.HourCount += count
	}

	// 检查是否需要立即刷写
	if time.Since(buffer.API.LastFlush) > sc.flushInterval ||
		time.Since(buffer.SiteRank.LastFlush) > sc.flushInterval ||
		time.Since(buffer.Batch.LastFlush) > sc.flushInterval {
		go sc.flushUserBuffer(userID)
	}
}

// startFlusher 启动定时刷写器
func (sc *StatsCollector) startFlusher() {
	ticker := time.NewTicker(sc.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			sc.flushAllBuffers()

		case <-sc.stopChan:
			// 刷写剩余数据
			sc.flushAllBuffers()
			return
		}
	}
}

// flushAllBuffers 刷写所有缓冲区
func (sc *StatsCollector) flushAllBuffers() {
	sc.mu.RLock()
	userIDs := make([]string, 0, len(sc.buffer))
	for userID := range sc.buffer {
		userIDs = append(userIDs, userID)
	}
	sc.mu.RUnlock()

	// 并发刷写
	var wg sync.WaitGroup
	for _, userID := range userIDs {
		wg.Add(1)
		go func(uid string) {
			defer wg.Done()
			sc.flushUserBuffer(uid)
		}(userID)
	}

	wg.Wait()
}

// flushUserBuffer 刷写用户缓冲区
func (sc *StatsCollector) flushUserBuffer(userID string) {
	sc.mu.Lock()
	buffer, exists := sc.buffer[userID]
	if !exists {
		sc.mu.Unlock()
		return
	}

	// 创建副本
	apiBuffer := *buffer.API
	siteRankBuffer := *buffer.SiteRank
	batchBuffer := *buffer.Batch

	// 重置缓冲区
	buffer.API.MinuteCount = 0
	buffer.SiteRank.MinuteCount = 0
	buffer.Batch.MinuteCount = 0
	buffer.API.LastFlush = time.Now()
	buffer.SiteRank.LastFlush = time.Now()
	buffer.Batch.LastFlush = time.Now()
	sc.mu.Unlock()

	now := gtime.Now()

	// 批量插入数据库
	var usages []RateLimitUsage

	// API使用统计
	if apiBuffer.MinuteCount > 0 {
		usages = append(usages, RateLimitUsage{
			ID:         gf.UUID(),
			UserID:     userID,
			Plan:       buffer.Plan,
			Feature:    "API",
			UsedCount:  apiBuffer.MinuteCount,
			LimitCount: 0, // 将在保存时填充
			Period:     "MINUTE",
			RecordedAt: now,
			CreatedAt:  now,
			Status:     "success",
		})
	}

	if apiBuffer.HourCount > 0 {
		usages = append(usages, RateLimitUsage{
			ID:         gf.UUID(),
			UserID:     userID,
			Plan:       buffer.Plan,
			Feature:    "API",
			UsedCount:  apiBuffer.HourCount,
			LimitCount: 0,
			Period:     "HOUR",
			RecordedAt: now,
			CreatedAt:  now,
			Status:     "success",
		})
	}

	// SiteRank使用统计
	if siteRankBuffer.MinuteCount > 0 {
		usages = append(usages, RateLimitUsage{
			ID:         gf.UUID(),
			UserID:     userID,
			Plan:       buffer.Plan,
			Feature:    "SITE_RANK",
			UsedCount:  siteRankBuffer.MinuteCount,
			LimitCount: 0,
			Period:     "MINUTE",
			RecordedAt: now,
			CreatedAt:  now,
			Status:     "success",
		})
	}

	if siteRankBuffer.HourCount > 0 {
		usages = append(usages, RateLimitUsage{
			ID:         gf.UUID(),
			UserID:     userID,
			Plan:       buffer.Plan,
			Feature:    "SITE_RANK",
			UsedCount:  siteRankBuffer.HourCount,
			LimitCount: 0,
			Period:     "HOUR",
			RecordedAt: now,
			CreatedAt:  now,
			Status:     "success",
		})
	}

	// Batch使用统计
	if batchBuffer.MinuteCount > 0 {
		usages = append(usages, RateLimitUsage{
			ID:         gf.UUID(),
			UserID:     userID,
			Plan:       buffer.Plan,
			Feature:    "BATCH",
			UsedCount:  batchBuffer.MinuteCount,
			LimitCount: 0,
			Period:     "MINUTE",
			RecordedAt: now,
			CreatedAt:  now,
			Status:     "success",
		})
	}

	// 批量保存
	if len(usages) > 0 {
		if err := sc.db.CreateInBatches(usages, 100).Error; err != nil {
			glog.Error(context.Background(), "rate_limit_stats_save_failed", map[string]interface{}{
				"user_id": userID,
				"error":   err.Error(),
			})
		}
	}
}

// Stop 停止统计收集器
func (sc *StatsCollector) Stop() {
	close(sc.stopChan)
}

// UsageStatsReporter 使用统计报告器
type UsageStatsReporter struct {
	db      *store.DB
	manager *RateLimitManager
}

// NewUsageStatsReporter 创建使用统计报告器
func NewUsageStatsReporter(db *store.DB, manager *RateLimitManager) *UsageStatsReporter {
	return &UsageStatsReporter{db: db, manager: manager}
}

// GetUserUsageStats 获取用户使用统计
func (r *UsageStatsReporter) GetUserUsageStats(userID string, days int) (map[string]interface{}, error) {
	endTime := gtime.Now()
	startTime := endTime.AddDate(0, 0, -days)

	var usages []RateLimitUsage
	if err := r.db.Where("user_id = ? AND recorded_at >= ? AND recorded_at <= ?",
		userID, startTime, endTime).
		Order("recorded_at DESC").
		Find(&usages).Error; err != nil {
		return nil, err
	}

	// 按特性和周期聚合统计
	stats := map[string]map[string]int{
		"API":       {"MINUTE": 0, "HOUR": 0},
		"SITE_RANK": {"MINUTE": 0, "HOUR": 0},
		"BATCH":     {"MINUTE": 0},
	}

	for _, usage := range usages {
		if featureStats, exists := stats[usage.Feature]; exists {
			if periodCount, exists := featureStats[usage.Period]; exists {
				stats[usage.Feature][usage.Period] = periodCount + usage.UsedCount
			}
		}
	}

	// 获取当前套餐限制
	userService := r.manager.userService
	if userService == nil {
		return nil, fmt.Errorf("user service not available")
	}

	userInfo, err := userService.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	planLimit, exists := r.manager.planLimits[userInfo.Plan]
	if !exists {
		planLimit = r.manager.planLimits["FREE"]
	}

	return map[string]interface{}{
		"user_id": userID,
		"plan":    userInfo.Plan,
		"usage":   stats,
		"limits": map[string]interface{}{
			"api_per_minute":      planLimit.APIRequestsPerMinute,
			"api_per_hour":        planLimit.APIRequestsPerHour,
			"siterank_per_minute": planLimit.SiteRankRequestsPerMinute,
			"siterank_per_hour":   planLimit.SiteRankRequestsPerHour,
			"batch_per_minute":    planLimit.BatchTasksPerMinute,
			"batch_concurrent":    planLimit.BatchConcurrentTasks,
		},
		"period": map[string]interface{}{
			"start_time": startTime,
			"end_time":   endTime,
			"days":       days,
		},
	}, nil
}

// GetSystemUsageStats 获取系统使用统计
func (r *UsageStatsReporter) GetSystemUsageStats(days int) (map[string]interface{}, error) {
	endTime := gtime.Now()
	startTime := endTime.AddDate(0, 0, -days)

	var usages []RateLimitUsage
	if err := r.db.Where("recorded_at >= ? AND recorded_at <= ?", startTime, endTime).
		Find(&usages).Error; err != nil {
		return nil, err
	}

	// 按套餐聚合统计
	planStats := make(map[string]map[string]map[string]int)
	for _, usage := range usages {
		if _, exists := planStats[usage.Plan]; !exists {
			planStats[usage.Plan] = map[string]map[string]int{
				"API":       {"MINUTE": 0, "HOUR": 0},
				"SITE_RANK": {"MINUTE": 0, "HOUR": 0},
				"BATCH":     {"MINUTE": 0},
			}
		}

		if featureStats, exists := planStats[usage.Plan][usage.Feature]; exists {
			if periodCount, exists := featureStats[usage.Period]; exists {
				planStats[usage.Plan][usage.Feature][usage.Period] = periodCount + usage.UsedCount
			}
		}
	}

	// 获取活跃用户数
	var activeUsers int64
	if err := r.db.Model(&RateLimitUsage{}).
		Where("recorded_at >= ? AND recorded_at <= ?", startTime, endTime).
		Distinct("user_id").
		Count(&activeUsers).Error; err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"active_users": activeUsers,
		"plan_usage":   planStats,
		"period": map[string]interface{}{
			"start_time": startTime,
			"end_time":   endTime,
			"days":       days,
		},
	}, nil
}

// GetTopUsers 获取使用量最高的用户
func (r *UsageStatsReporter) GetTopUsers(feature string, days int, limit int) ([]map[string]interface{}, error) {
	endTime := gtime.Now()
	startTime := endTime.AddDate(0, 0, -days)

	type UserUsage struct {
		UserID    string `json:"user_id"`
		Plan      string `json:"plan"`
		TotalUsed int    `json:"total_used"`
	}

	var userUsages []UserUsage
	if err := r.db.Model(&RateLimitUsage{}).
		Select("user_id, plan, SUM(used_count) as total_used").
		Where("feature = ? AND recorded_at >= ? AND recorded_at <= ?", feature, startTime, endTime).
		Group("user_id, plan").
		Order("total_used DESC").
		Limit(limit).
		Scan(&userUsages).Error; err != nil {
		return nil, err
	}

	// 转换结果
	result := make([]map[string]interface{}, 0, len(userUsages))
	for _, usage := range userUsages {
		result = append(result, map[string]interface{}{
			"user_id":    usage.UserID,
			"plan":       usage.Plan,
			"total_used": usage.TotalUsed,
		})
	}

	return result, nil
}
