package app

import (
	"context"
	"fmt"
	"time"

	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/glog"
)

// GoFlyContext GoFly应用上下文
type GoFlyContext struct {
	Config     *Config
	DB         *store.DB
	Redis      *store.Redis
	StopSignal chan struct{}
}

// NewGoFlyContext 创建GoFly应用上下文
func NewGoFlyContext(cfg *Config) (*GoFlyContext, error) {
	// 初始化数据库连接
	db, err := store.NewDB(store.DatabaseConfig{
		Host:        cfg.DB.Host,
		Port:        cfg.DB.Port,
		Username:    cfg.DB.User,
		Password:    cfg.DB.Password,
		Database:    cfg.DB.DBName,
		Charset:     cfg.DB.Charset,
		MaxIdle:     cfg.DB.MaxIdleConns,
		MaxOpen:     cfg.DB.MaxOpenConns,
		MaxLifetime: cfg.DB.MaxLifetime,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	// 初始化Redis连接
	redisConfig := &config.RedisConfig{
		Enable:   true,
		Host:     cfg.Redis.Host,
		Port:     cfg.Redis.Port,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
		PoolSize: cfg.Redis.PoolSize,
	}
	redis, err := store.NewRedis(redisConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize redis: %w", err)
	}

	// 初始化日志
	if cfg.Log != nil {
		glog.SetLevelStr(cfg.Log.Level)
		// glog.SetOutput 方法不存在，暂时跳过
	}

	// 初始化缓存
	if cfg.Cache != nil {
		// TODO: 初始化GoFly缓存配置
	}

	return &GoFlyContext{
		Config:     cfg,
		DB:         db,
		Redis:      redis,
		StopSignal: make(chan struct{}),
	}, nil
}

// Close 关闭应用上下文
func (ctx *GoFlyContext) Close() error {
	var errs []error

	// 关闭数据库连接
	if ctx.DB != nil {
		// GORM v2 不需要手动关闭连接
		// 连接池会自动管理
	}

	// 关闭Redis连接
	if ctx.Redis != nil {
		if err := ctx.Redis.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close redis: %w", err))
		}
	}

	// 关闭停止信号通道
	close(ctx.StopSignal)

	if len(errs) > 0 {
		return fmt.Errorf("errors while closing context: %v", errs)
	}

	return nil
}

// GetDB 获取数据库连接
func (ctx *GoFlyContext) GetDB() *store.DB {
	return ctx.DB
}

// GetRedis 获取Redis连接
func (ctx *GoFlyContext) GetRedis() *store.Redis {
	return ctx.Redis
}

// GetConfig 获取配置
func (ctx *GoFlyContext) GetConfig() *Config {
	return ctx.Config
}

// Context 创建带有超时的context
func (ctx *GoFlyContext) Context(timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), timeout)
}

// LogInfo 记录信息日志
func (ctx *GoFlyContext) LogInfo(msg string, fields ...interface{}) {
	if len(fields) > 0 {
		fieldMap := make(gform.Map)
		for i := 0; i < len(fields); i += 2 {
			if i+1 < len(fields) {
				fieldMap[fmt.Sprintf("%v", fields[i])] = fields[i+1]
			}
		}
		glog.Info(context.Background(), msg, fieldMap)
	} else {
		glog.Info(context.Background(), msg)
	}
}

// LogError 记录错误日志
func (ctx *GoFlyContext) LogError(msg string, err error, fields ...interface{}) {
	logFields := gform.Map{"error": err}
	if len(fields) > 0 {
		for i := 0; i < len(fields); i += 2 {
			if i+1 < len(fields) {
				logFields[fields[i].(string)] = fields[i+1]
			}
		}
	}
	glog.Error(context.Background(), msg, logFields)
}

// LogDebug 记录调试日志
func (ctx *GoFlyContext) LogDebug(msg string, fields ...interface{}) {
	if len(fields) > 0 {
		fieldMap := make(gform.Map)
		for i := 0; i < len(fields); i += 2 {
			if i+1 < len(fields) {
				fieldMap[fmt.Sprintf("%v", fields[i])] = fields[i+1]
			}
		}
		glog.Debug(context.Background(), msg, fieldMap)
	} else {
		glog.Debug(context.Background(), msg)
	}
}

// GetMiddlewareConfig 获取中间件配置
func (ctx *GoFlyContext) GetMiddlewareConfig() map[string]interface{} {
	return map[string]interface{}{
		"enable_cors":       true,
		"enable_logger":     true,
		"enable_recovery":   true,
		"enable_rate_limit": true,
		"enable_security":   true,
		"enable_request_id": true,
	}
}

// IsProduction 检查是否为生产环境
func (ctx *GoFlyContext) IsProduction() bool {
	return ctx.Config.Env == "production"
}

// IsDevelopment 检查是否为开发环境
func (ctx *GoFlyContext) IsDevelopment() bool {
	return ctx.Config.Env == "development"
}

// GetStartTime 获取应用启动时间
func (ctx *GoFlyContext) GetStartTime() time.Time {
	return time.Now()
}

// GetUptime 获取应用运行时间
func (ctx *GoFlyContext) GetUptime() time.Duration {
	return time.Since(ctx.GetStartTime())
}
