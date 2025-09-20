package health

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/internal/store"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// HealthStatus 健康状态
type HealthStatus struct {
	Status    string                 `json:"status"`
	Timestamp string                 `json:"timestamp"`
	Checks    map[string]CheckResult `json:"checks"`
	Version   string                 `json:"version"`
	Uptime    time.Duration          `json:"uptime"`
}

// CheckResult 检查结果
type CheckResult struct {
	Status   string        `json:"status"`
	Duration time.Duration `json:"duration"`
	Message  string        `json:"message,omitempty"`
	Details  interface{}   `json:"details,omitempty"`
}

// HealthChecker 健康检查器
type HealthChecker struct {
	db         *gorm.DB
	redis      *store.Redis
	startTime  time.Time
	checks     map[string]func(ctx context.Context) CheckResult
	mu         sync.RWMutex
	lastStatus *HealthStatus
}

// NewHealthChecker 创建健康检查器
func NewHealthChecker(cfg *config.Config) (*HealthChecker, error) {
	hc := &HealthChecker{
		startTime: time.Now(),
		checks:    make(map[string]func(ctx context.Context) CheckResult),
	}

	// 初始化数据库连接
	if err := hc.initDB(cfg); err != nil {
		log.Printf("警告：数据库连接失败: %v", err)
	}

	// 初始化 Redis 连接
	if err := hc.initRedis(cfg); err != nil {
		log.Printf("警告：Redis 连接失败: %v", err)
	}

	// 注册检查项
	hc.registerChecks()

	return hc, nil
}

// initDB 初始化数据库连接
func (hc *HealthChecker) initDB(cfg *config.Config) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DB.Username,
		cfg.DB.Password,
		cfg.DB.Host,
		cfg.DB.Port,
		cfg.DB.Database,
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return err
	}

	// 配置连接池
	sqlDB.SetMaxIdleConns(cfg.DB.Pool.MaxIdle)
	sqlDB.SetMaxOpenConns(cfg.DB.Pool.MaxOpen)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.DB.Pool.MaxLifetime) * time.Second)

	hc.db = db
	return nil
}

// initRedis 初始化 Redis 连接
func (hc *HealthChecker) initRedis(cfg *config.Config) error {
	redis, err := store.NewRedis(&cfg.Redis)
	if err != nil {
		return err
	}

	hc.redis = redis
	return nil
}

// registerChecks 注册检查项
func (hc *HealthChecker) registerChecks() {
	// 数据库检查
	hc.checks["database"] = hc.checkDatabase

	// Redis 检查
	if hc.redis != nil {
		hc.checks["redis"] = hc.checkRedis
	}

	// 数据库表检查
	hc.checks["database_tables"] = hc.checkDatabaseTables

	// 速率限制配置检查
	hc.checks["rate_limit_config"] = hc.checkRateLimitConfig
}

// Check 执行健康检查
func (hc *HealthChecker) Check(ctx context.Context) *HealthStatus {
	status := &HealthStatus{
		Status:    "healthy",
		Timestamp: time.Now().Format(time.RFC3339),
		Checks:    make(map[string]CheckResult),
		Version:   "3.0.0",
		Uptime:    time.Since(hc.startTime),
	}

	// 执行所有检查
	for name, check := range hc.checks {
		result := check(ctx)
		status.Checks[name] = result

		// 如果有检查失败，整体状态为 unhealthy
		if result.Status == "unhealthy" {
			status.Status = "unhealthy"
		}
	}

	// 缓存最后状态
	hc.mu.Lock()
	hc.lastStatus = status
	hc.mu.Unlock()

	return status
}

// checkDatabase 检查数据库
func (hc *HealthChecker) checkDatabase(ctx context.Context) CheckResult {
	start := time.Now()

	if hc.db == nil {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  "数据库未连接",
		}
	}

	sqlDB, err := hc.db.DB()
	if err != nil {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  fmt.Sprintf("获取数据库连接失败: %v", err),
		}
	}

	if err := sqlDB.PingContext(ctx); err != nil {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  fmt.Sprintf("数据库 Ping 失败: %v", err),
		}
	}

	// 获取连接池状态
	stats := sqlDB.Stats()
	details := map[string]interface{}{
		"open_connections":    stats.OpenConnections,
		"in_use":              stats.InUse,
		"idle":                stats.Idle,
		"wait_count":          stats.WaitCount,
		"wait_duration":       stats.WaitDuration,
		"max_idle_closed":     stats.MaxIdleClosed,
		"max_lifetime_closed": stats.MaxLifetimeClosed,
	}

	return CheckResult{
		Status:   "healthy",
		Duration: time.Since(start),
		Details:  details,
	}
}

// checkRedis 检查 Redis
func (hc *HealthChecker) checkRedis(ctx context.Context) CheckResult {
	start := time.Now()

	if hc.redis == nil {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  "Redis 未连接",
		}
	}

	// 测试 PING
	if err := hc.redis.GetClient().Ping(ctx).Err(); err != nil {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  fmt.Sprintf("Redis Ping 失败: %v", err),
		}
	}

	// 测试读写
	testKey := "health_check"
	testValue := "ok"

	if err := hc.redis.Set(ctx, testKey, testValue, 5*time.Second); err != nil {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  fmt.Sprintf("Redis 写入失败: %v", err),
		}
	}

	value, err := hc.redis.Get(ctx, testKey)
	if err != nil || value != testValue {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  fmt.Sprintf("Redis 读取失败: %v", err),
		}
	}

	// 清理测试数据
	hc.redis.Delete(ctx, testKey)

	poolStats := hc.redis.GetClient().PoolStats()
	details := map[string]interface{}{
		"total_conns": poolStats.TotalConns,
		"idle_conns":  poolStats.IdleConns,
		"stale_conns": poolStats.StaleConns,
		"hits":        poolStats.Hits,
		"misses":      poolStats.Misses,
		"timeouts":    poolStats.Timeouts,
	}

	return CheckResult{
		Status:   "healthy",
		Duration: time.Since(start),
		Details:  details,
	}
}

// checkDatabaseTables 检查数据库表
func (hc *HealthChecker) checkDatabaseTables(ctx context.Context) CheckResult {
	start := time.Now()

	if hc.db == nil {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  "数据库未连接",
		}
	}

	// 需要检查的表
    requiredTables := []string{
        "users",
        "admin_users",
        "rate_limit_configs",
        "_prisma_migrations",
    }

	var missingTables []string
	var tableDetails []map[string]interface{}

	for _, table := range requiredTables {
		if !hc.db.Migrator().HasTable(table) {
			missingTables = append(missingTables, table)
			continue
		}

		// 获取表记录数
		var count int64
		hc.db.Table(table).Count(&count)

		tableDetails = append(tableDetails, map[string]interface{}{
			"name":   table,
			"count":  count,
			"exists": true,
		})
	}

	if len(missingTables) > 0 {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  fmt.Sprintf("缺少表: %v", missingTables),
			Details: map[string]interface{}{
				"missing_tables": missingTables,
				"table_details":  tableDetails,
			},
		}
	}

	return CheckResult{
		Status:   "healthy",
		Duration: time.Since(start),
		Details: map[string]interface{}{
			"tables": tableDetails,
		},
	}
}

// checkRateLimitConfig 检查速率限制配置
func (hc *HealthChecker) checkRateLimitConfig(ctx context.Context) CheckResult {
	start := time.Now()

	if hc.db == nil {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  "数据库未连接",
		}
	}

	// 检查速率限制配置表
	if !hc.db.Migrator().HasTable("rate_limit_configs") {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  "rate_limit_configs 表不存在",
		}
	}

	// 统计配置数量
	var totalConfigs int64
	var activeConfigs int64

	hc.db.Table("rate_limit_configs").Count(&totalConfigs)
	hc.db.Table("rate_limit_configs").Where("is_active = ?", true).Count(&activeConfigs)

	// 按套餐统计
	var planStats []map[string]interface{}
	hc.db.Table("rate_limit_configs").
		Select("plan, COUNT(*) as count, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count").
		Group("plan").
		Scan(&planStats)

	details := map[string]interface{}{
		"total_configs":  totalConfigs,
		"active_configs": activeConfigs,
		"plan_stats":     planStats,
	}

	// 检查是否有激活的配置
	if activeConfigs == 0 {
		return CheckResult{
			Status:   "unhealthy",
			Duration: time.Since(start),
			Message:  "没有激活的速率限制配置",
			Details:  details,
		}
	}

	return CheckResult{
		Status:   "healthy",
		Duration: time.Since(start),
		Details:  details,
	}
}

// GetLastStatus 获取最后的状态
func (hc *HealthChecker) GetLastStatus() *HealthStatus {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	return hc.lastStatus
}

// Handler HTTP 处理器
func (hc *HealthChecker) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// 设置超时
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()

		status := hc.Check(ctx)

		w.Header().Set("Content-Type", "application/json")

		if status.Status == "healthy" {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
		}

		json.NewEncoder(w).Encode(status)
	})
}

// ReadyHandler 就绪检查处理器
func (hc *HealthChecker) ReadyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// 设置超时
		ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()

		status := hc.Check(ctx)

		// 检查是否所有关键组件都就绪
		for name, check := range status.Checks {
			if check.Status != "healthy" && name != "redis" { // Redis 不是必需的
				w.WriteHeader(http.StatusServiceUnavailable)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"status":  "not ready",
					"reason":  fmt.Sprintf("%s is not healthy", name),
					"details": check,
				})
				return
			}
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "ready",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})
}

// LiveHandler 存活检查处理器
func (hc *HealthChecker) LiveHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "alive",
			"timestamp": time.Now().Format(time.RFC3339),
			"uptime":    time.Since(hc.startTime).String(),
		})
	})
}
