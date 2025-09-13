package app

import (
	"fmt"
	"log"
	"net"
	"strconv"

	// "gofly-admin-v3/internal/admin"
	"gofly-admin-v3/internal/auth"
	// "gofly-admin-v3/internal/adscenter"
	"gofly-admin-v3/internal/batchgo"
	// "gofly-admin-v3/internal/chengelink"
	"gofly-admin-v3/internal/config"
	// "gofly-admin-v3/internal/invitation"
	"gofly-admin-v3/internal/oauth"
	"gofly-admin-v3/internal/ratelimit"
	// "gofly-admin-v3/internal/siterankgo"
	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/internal/subscription"
	// "gofly-admin-v3/internal/token"
	"gofly-admin-v3/service/user"
		)

// Context 应用上下文
type Context struct {
	Config *Config

	// 基础设施
	DB    *store.DB
	Redis *store.Redis

	// 核心服务
	UserService      *user.Service
	AuthService      *auth.Service
	SubService       *subscription.Service
	OAuthService     *oauth.OAuthService
	RateLimitManager *ratelimit.RateLimitManager

	// 业务模块
	BatchGoService       *batchgo.Service
	// AdminService         *admin.Service
	// TokenService         *token.Service
	// SiteRankGoService    *siterankgo.Service
	// AdsCenterGoService   *adscenter.Service
	// ChengelinkService    *chengelink.Service
	// InvitationService    *invitation.Service
}

// NewContext 创建应用上下文
func NewContext(cfg *Config) (*Context, error) {
	// 初始化数据库
	db, err := store.NewDB(cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	// 初始化 Redis - convert store.RedisConfig to config.RedisConfig
	// Parse address to extract host and port
	host, portStr, err := net.SplitHostPort(cfg.Redis.Address)
	if err != nil {
		// If parsing fails, assume the address is just host
		host = cfg.Redis.Address
		portStr = "6379"
	}
	port, _ := strconv.Atoi(portStr)
	
	redisConfig := &config.RedisConfig{
		Enable:   true,
		Host:     host,
		Port:     port,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
		PoolSize: cfg.Redis.PoolSize,
	}
	redis, err := store.NewRedis(redisConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize redis: %w", err)
	}

	log.Println("数据库和Redis连接成功")

	// 创建服务实例
	// Convert app.Config to config.Config for services that need it
	configCfg := &config.Config{
		Redis: *redisConfig, // Copy the Redis config we created
		// TODO: Map other config fields as needed
	}
	
	rateLimitManager := ratelimit.NewRateLimitManager(configCfg, db, nil) // userService still needed
	
	ctx := &Context{
		Config: cfg,
		DB:     db,
		Redis:  redis,

		// TODO: Fix user service to work with gorm.DB or create adapter
		UserService:      nil, // user.NewService expects gform.DB, not *gorm.DB
		AuthService:      auth.NewService(),
		SubService:       subscription.NewService(db),
		RateLimitManager: rateLimitManager,

		BatchGoService:       batchgo.NewService(db.DB, nil, nil),
		// AdminService:         nil, // TODO: Initialize admin service
		// TokenService:         nil, // TODO: Initialize token service
		// SiteRankGoService:    nil, // TODO: Initialize siterankgo service
		// AdsCenterGoService:   nil, // TODO: Initialize adscenter service
		// ChengelinkService:    nil, // TODO: Initialize chengelink service
		// InvitationService:    nil, // TODO: Initialize invitation service
	}

	log.Println("所有服务初始化完成")
	return ctx, nil
}

// Close 关闭所有连接
func (ctx *Context) Close() error {
	if ctx.DB != nil {
		sqlDB, err := ctx.DB.DB.DB()
		if err != nil {
			return err
		}
		sqlDB.Close()
	}
	return nil
}
