//go:build autoads_advanced

package ratelimit

import (
    "fmt"
    "sync"
    "time"

    "gofly-admin-v3/internal/store"
    "gofly-admin-v3/utils/gtime"
)

// DatabaseConfigLoader 数据库配置加载器
type DatabaseConfigLoader struct {
	db          *store.DB
	configCache map[string]*PlanRateLimit
	mu          sync.RWMutex
	lastUpdate  time.Time
	updateChan  chan ConfigUpdateEvent
	broadcaster *ConfigChangeBroadcaster
}

// ConfigUpdateEvent 配置更新事件
type ConfigUpdateEvent struct {
	Plan   string         `json:"plan"`
	Config *PlanRateLimit `json:"config"`
	Action string         `json:"action"` // create/update/delete
}

// NewDatabaseConfigLoader 创建数据库配置加载器
func NewDatabaseConfigLoader(db *store.DB) *DatabaseConfigLoader {
	dcl := &DatabaseConfigLoader{
		db:          db,
		configCache: make(map[string]*PlanRateLimit),
		updateChan:  make(chan ConfigUpdateEvent, 100),
		broadcaster: NewConfigChangeBroadcaster(),
	}

	// 启动配置监听器
	go dcl.watchDatabaseChanges()

	return dcl
}

// LoadPlanLimits 从数据库加载套餐限制配置
func (dcl *DatabaseConfigLoader) LoadPlanLimits() (map[string]*PlanRateLimit, error) {
	dcl.mu.Lock()
	defer dcl.mu.Unlock()

	var configs []RateLimitConfig
	if err := dcl.db.Where("is_active = ?", true).Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("failed to load rate limit configs: %v", err)
	}

	// 按plan分组
	planConfigs := make(map[string]*PlanRateLimitDB)
	for _, config := range configs {
		if _, exists := planConfigs[config.Plan]; !exists {
			planConfigs[config.Plan] = &PlanRateLimitDB{
				Plan:      config.Plan,
				IsActive:  config.IsActive,
				CreatedAt: config.CreatedAt,
				UpdatedAt: config.UpdatedAt,
			}
		}

		feature := &PlanRateLimitFeature{
			PerMinute:  config.PerMinute,
			PerHour:    config.PerHour,
			Concurrent: config.Concurrent,
		}

		switch config.Feature {
		case "API":
			planConfigs[config.Plan].API = feature
		case "SITE_RANK":
			planConfigs[config.Plan].SiteRank = feature
		case "BATCH":
			planConfigs[config.Plan].Batch = feature
		}
	}

	result := make(map[string]*PlanRateLimit)
	for plan, planConfig := range planConfigs {
		result[plan] = planConfig.ToConfig()
	}

	dcl.configCache = result
	dcl.lastUpdate = time.Now()

	return result, nil
}

// SavePlanLimit 保存套餐限制配置
func (dcl *DatabaseConfigLoader) SavePlanLimit(plan string, config *PlanRateLimit) error {
	// API配置
	apiConfig := RateLimitConfig{
		Plan:      plan,
		Feature:   "API",
		PerMinute: config.APIRequestsPerMinute,
		PerHour:   config.APIRequestsPerHour,
		IsActive:  true,
		UpdatedAt: gtime.Now(),
	}

	// SiteRank配置
	siteRankConfig := RateLimitConfig{
		Plan:      plan,
		Feature:   "SITE_RANK",
		PerMinute: config.SiteRankRequestsPerMinute,
		PerHour:   config.SiteRankRequestsPerHour,
		IsActive:  true,
		UpdatedAt: gtime.Now(),
	}

	// Batch配置
	batchConfig := RateLimitConfig{
		Plan:       plan,
		Feature:    "BATCH",
		PerMinute:  config.BatchTasksPerMinute,
		Concurrent: config.BatchConcurrentTasks,
		IsActive:   true,
		UpdatedAt:  gtime.Now(),
	}

	// 保存或更新配置
	configs := []RateLimitConfig{apiConfig, siteRankConfig, batchConfig}
	for _, cfg := range configs {
		var existing RateLimitConfig
		if err := dcl.db.Where("plan = ? AND feature = ?", cfg.Plan, cfg.Feature).First(&existing).Error; err != nil {
			// 创建新配置
			if err := dcl.db.Create(&cfg).Error; err != nil {
				return fmt.Errorf("failed to create config for %s-%s: %v", cfg.Plan, cfg.Feature, err)
			}
		} else {
			// 更新现有配置
			if err := dcl.db.Model(&existing).Updates(cfg).Error; err != nil {
				return fmt.Errorf("failed to update config for %s-%s: %v", cfg.Plan, cfg.Feature, err)
			}
		}
	}

	// 发送更新事件
	dcl.updateChan <- ConfigUpdateEvent{
		Plan:   plan,
		Config: config,
		Action: "update",
	}

	return nil
}

// DeletePlanLimit 删除套餐限制配置
func (dcl *DatabaseConfigLoader) DeletePlanLimit(plan string) error {
	if err := dcl.db.Model(&RateLimitConfig{}).Where("plan = ?", plan).Update("is_active", false).Error; err != nil {
		return fmt.Errorf("failed to delete config: %v", err)
	}

	// 发送更新事件
	dcl.updateChan <- ConfigUpdateEvent{
		Plan:   plan,
		Action: "delete",
	}

	return nil
}

// watchDatabaseChanges 监听数据库配置变化
func (dcl *DatabaseConfigLoader) watchDatabaseChanges() {
	// 定期检查数据库更新
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// 检查配置是否更新
			dcl.checkConfigUpdates()

		case event := <-dcl.updateChan:
			// 处理配置更新事件
			dcl.handleConfigUpdate(event)

		case <-time.After(5 * time.Minute):
			// 定期清理缓存
			dcl.cleanupCache()
		}
	}
}

// checkConfigUpdates 检查配置更新
func (dcl *DatabaseConfigLoader) checkConfigUpdates() {
	var configs []RateLimitConfig
	if err := dcl.db.Where("is_active = ? AND updated_at > ?", true, dcl.lastUpdate).Find(&configs).Error; err != nil {
		return
	}

	if len(configs) > 0 {
		dcl.mu.Lock()
		// 重新加载所有配置
		newConfigs, err := dcl.LoadPlanLimits()
		if err == nil {
			dcl.configCache = newConfigs

			// 广播变更事件
			dcl.broadcaster.Broadcast(ConfigChangeEvent{
				Type:      "rate_limit_config",
				Key:       "all",
				NewValue:  newConfigs,
				Timestamp: time.Now(),
			})
		}
		dcl.lastUpdate = time.Now()
		dcl.mu.Unlock()
	}
}

// handleConfigUpdate 处理配置更新
func (dcl *DatabaseConfigLoader) handleConfigUpdate(event ConfigUpdateEvent) {
	dcl.mu.Lock()
	defer dcl.mu.Unlock()

	switch event.Action {
	case "create", "update":
		if event.Config != nil {
			dcl.configCache[event.Plan] = event.Config

			// 广播变更事件
			dcl.broadcaster.Broadcast(ConfigChangeEvent{
				Type:      "rate_limit_config",
				Key:       event.Plan,
				NewValue:  event.Config,
				Timestamp: time.Now(),
			})
		}
	case "delete":
		delete(dcl.configCache, event.Plan)

		// 广播变更事件
		dcl.broadcaster.Broadcast(ConfigChangeEvent{
			Type:      "rate_limit_config",
			Key:       event.Plan,
			Timestamp: time.Now(),
		})
	}
}

// cleanupCache 清理缓存
func (dcl *DatabaseConfigLoader) cleanupCache() {
	dcl.mu.Lock()
	defer dcl.mu.Unlock()

	// 清理超过1小时未更新的配置
	now := time.Now()
	for plan, config := range dcl.configCache {
		// 这里可以添加更多清理逻辑
		_ = plan
		_ = config
		_ = now
	}
}

// GetCachedConfig 获取缓存的配置
func (dcl *DatabaseConfigLoader) GetCachedConfig(plan string) (*PlanRateLimit, bool) {
	dcl.mu.RLock()
	defer dcl.mu.RUnlock()

	config, exists := dcl.configCache[plan]
	return config, exists
}

// Subscribe 订阅配置变更
func (dcl *DatabaseConfigLoader) Subscribe(subscriberID string) <-chan ConfigChangeEvent {
	return dcl.broadcaster.Subscribe(subscriberID)
}

// Unsubscribe 取消订阅
func (dcl *DatabaseConfigLoader) Unsubscribe(subscriberID string) {
	dcl.broadcaster.Unsubscribe(subscriberID)
}

// CreateDefaultConfigs 创建默认配置
func (dcl *DatabaseConfigLoader) CreateDefaultConfigs() error {
	// API配置
	apiConfigs := []RateLimitConfig{
		{
			Plan:      "FREE",
			Feature:   "API",
			PerMinute: 30,
			PerHour:   1000,
			IsActive:  true,
		},
		{
			Plan:      "PRO",
			Feature:   "API",
			PerMinute: 100,
			PerHour:   5000,
			IsActive:  true,
		},
		{
			Plan:      "MAX",
			Feature:   "API",
			PerMinute: 500,
			PerHour:   20000,
			IsActive:  true,
		},
	}

	// SiteRank配置
	siteRankConfigs := []RateLimitConfig{
		{
			Plan:      "FREE",
			Feature:   "SITE_RANK",
			PerMinute: 2,
			PerHour:   50,
			IsActive:  true,
		},
		{
			Plan:      "PRO",
			Feature:   "SITE_RANK",
			PerMinute: 10,
			PerHour:   200,
			IsActive:  true,
		},
		{
			Plan:      "MAX",
			Feature:   "SITE_RANK",
			PerMinute: 50,
			PerHour:   1000,
			IsActive:  true,
		},
	}

	// Batch配置
	batchConfigs := []RateLimitConfig{
		{
			Plan:       "FREE",
			Feature:    "BATCH",
			PerMinute:  5,
			Concurrent: 1,
			IsActive:   true,
		},
		{
			Plan:       "PRO",
			Feature:    "BATCH",
			PerMinute:  20,
			Concurrent: 5,
			IsActive:   true,
		},
		{
			Plan:       "MAX",
			Feature:    "BATCH",
			PerMinute:  100,
			Concurrent: 20,
			IsActive:   true,
		},
	}

	allConfigs := append(append(apiConfigs, siteRankConfigs...), batchConfigs...)

	for _, config := range allConfigs {
		// 检查是否已存在
		var existing RateLimitConfig
		if err := dcl.db.Where("plan = ? AND feature = ?", config.Plan, config.Feature).First(&existing).Error; err != nil {
			// 创建新配置
			if err := dcl.db.Create(&config).Error; err != nil {
				return fmt.Errorf("failed to create default config for %s-%s: %v", config.Plan, config.Feature, err)
			}
		}
	}

	return nil
}

// ConfigChangeBroadcaster 配置变更广播器
type ConfigChangeBroadcaster struct {
	subscribers map[string]chan ConfigChangeEvent
	mu          sync.RWMutex
}

// NewConfigChangeBroadcaster 创建配置变更广播器
func NewConfigChangeBroadcaster() *ConfigChangeBroadcaster {
	return &ConfigChangeBroadcaster{
		subscribers: make(map[string]chan ConfigChangeEvent),
	}
}

// Subscribe 订阅配置变更
func (b *ConfigChangeBroadcaster) Subscribe(subscriberID string) chan ConfigChangeEvent {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(chan ConfigChangeEvent, 100)
	b.subscribers[subscriberID] = ch
	return ch
}

// Unsubscribe 取消订阅
func (b *ConfigChangeBroadcaster) Unsubscribe(subscriberID string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if ch, exists := b.subscribers[subscriberID]; exists {
		close(ch)
		delete(b.subscribers, subscriberID)
	}
}

// Broadcast 广播配置变更
func (b *ConfigChangeBroadcaster) Broadcast(event ConfigChangeEvent) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, ch := range b.subscribers {
		select {
		case ch <- event:
		default:
			// Channel full, skip
		}
	}
}

// ConfigChangeEvent 配置变更事件
type ConfigChangeEvent struct {
	Plan      string         `json:"plan"`
	Config    *PlanRateLimit `json:"config"`
	Action    string         `json:"action"` // create/update/delete
	Type      string         `json:"type,omitempty"`
	Key       string         `json:"key,omitempty"`
	NewValue  interface{}    `json:"new_value,omitempty"`
	Timestamp time.Time      `json:"timestamp,omitempty"`
}
