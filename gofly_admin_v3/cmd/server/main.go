package main

import (
	"crypto/sha256"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	// 引入数据库驱动
	_ "gofly-admin-v3/utils/drivers/mysql"
	_ "gofly-admin-v3/utils/drivers/redis"

	"gofly-admin-v3/internal/auth"
	"gofly-admin-v3/internal/batchgo"
	"gofly-admin-v3/internal/audit"
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/internal/checkin"
	"gofly-admin-v3/internal/chengelink"
	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/internal/docs"
	"gofly-admin-v3/internal/health"
	dbinit "gofly-admin-v3/internal/init"
	"gofly-admin-v3/internal/invitation"
    "gofly-admin-v3/internal/metrics"
    "gofly-admin-v3/internal/middleware"
    "gofly-admin-v3/internal/siterankgo"
    "gofly-admin-v3/internal/adscentergo"
    "gofly-admin-v3/internal/store"
    "gofly-admin-v3/internal/user"
    "gofly-admin-v3/internal/websocket"
    "gofly-admin-v3/internal/scheduler"
    "gofly-admin-v3/internal/admin"
    redisv8 "github.com/go-redis/redis/v8"
    "gofly-admin-v3/internal/ratelimit"
    "gofly-admin-v3/utils/gf"
    "gorm.io/datatypes"
)

// 临时禁用静态文件嵌入，使用本地文件系统
// TODO: 在生产环境中应该启用静态文件嵌入

// 版本信息
var (
	Version   = "1.0.0"
	BuildTime = "unknown"
	GitCommit = "unknown"
)

// ==== AdsCenter minimal models (map to Prisma tables) ====
type AdsAccount struct {
    ID          string    `json:"id" gorm:"primaryKey;size:36"`
    UserID      string    `json:"userId" gorm:"index;size:36"`
    AccountID   string    `json:"accountId"`
    AccountName string    `json:"accountName"`
    Status      string    `json:"status"`
    CreatedAt   time.Time `json:"createdAt"`
    UpdatedAt   time.Time `json:"updatedAt"`
}

func (AdsAccount) TableName() string { return "ads_accounts" }

type AdsConfiguration struct {
    ID          string         `json:"id" gorm:"primaryKey;size:36"`
    UserID      string         `json:"userId" gorm:"index;size:36"`
    Name        string         `json:"name"`
    Description string         `json:"description"`
    Payload     datatypes.JSON `json:"payload" gorm:"type:json"`
    Status      string         `json:"status"`
    CreatedAt   time.Time      `json:"createdAt"`
    UpdatedAt   time.Time      `json:"updatedAt"`
}

func (AdsConfiguration) TableName() string { return "ads_configurations" }

type AdsExecution struct {
    ID              string    `json:"id" gorm:"primaryKey;size:36"`
    UserID          string    `json:"userId" gorm:"index;size:36"`
    ConfigurationID string    `json:"configurationId"`
    Status          string    `json:"status"`
    Message         string    `json:"message" gorm:"type:text"`
    Progress        int       `json:"progress"`
    TotalItems      int       `json:"totalItems"`
    ProcessedItems  int       `json:"processedItems"`
    StartedAt       *time.Time `json:"startedAt"`
    CompletedAt     *time.Time `json:"completedAt"`
    CreatedAt       time.Time `json:"createdAt"`
    UpdatedAt       time.Time `json:"updatedAt"`
}

func (AdsExecution) TableName() string { return "ads_executions" }

// 全局服务实例（用于旧API处理器中复用）
var (
    gormDB            *gorm.DB
	storeDB           *store.DB
	storeRedis        *store.Redis
	jwtSvc            *auth.JWTService
	wsManager         *websocket.Manager
	batchService      *batchgo.Service
	tokenSvc          *user.TokenService
	swebClient        *siterankgo.SimilarWebClient
	chengelinkService *chengelink.ChengeLinkService
    auditSvc          *audit.AutoAdsAuditService
    rateLimitManager  *ratelimit.RateLimitManager
    adsUpdater        adscentergo.AdsUpdater
)

// simpleUserSvc: 为 RateLimitManager 提供最小化的用户查询实现
type simpleUserSvc struct{}

func (s *simpleUserSvc) GetUserByID(userID string) (*ratelimit.UserInfo, error) {
    if userID == "" {
        return &ratelimit.UserInfo{PlanName: "FREE", Plan: "FREE"}, nil
    }
    rows, err := gf.DB().Query(context.Background(), `SELECT p.name AS plan_name FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? AND s.status='ACTIVE' ORDER BY s.updated_at DESC LIMIT 1`, userID)
    if err != nil || len(rows) == 0 {
        return &ratelimit.UserInfo{PlanName: "FREE", Plan: "FREE"}, nil
    }
    plan := gf.String(rows[0]["plan_name"])
    if plan == "" { plan = "FREE" }
    return &ratelimit.UserInfo{PlanName: plan, Plan: plan}, nil
}

// 适配器：将 user.TokenService 适配为 chengelink.TokenService
type tokenServiceAdapter struct{ ts *user.TokenService }

func (a *tokenServiceAdapter) ConsumeTokens(userID string, amount int, description string) error {
    return a.ts.ConsumeTokens(userID, amount, description, "")
}
func (a *tokenServiceAdapter) GetBalance(userID string) (int, error) {
    return a.ts.GetTokenBalance(userID)
}
// 满足 chengelink.TokenService 接口
func (a *tokenServiceAdapter) ConsumeTokensByService(userID, service, action string, quantity int, reference string) error {
    return a.ts.ConsumeTokensByService(userID, service, action, quantity, reference)
}

// 适配器：为邀请/签到模块提供 AddTokens 简化签名
type invTokenAdapter struct{ ts *user.TokenService }

func (a *invTokenAdapter) AddTokens(userID string, amount int, tokenType, description string) error {
	return a.ts.AddTokens(userID, amount, tokenType, description, "")
}
func (a *invTokenAdapter) GetBalance(userID string) (int, error) { return a.ts.GetTokenBalance(userID) }

func main() {
	// 解析命令行参数
	var (
		configPath = flag.String("config", "config.yaml", "配置文件路径")
		initDB     = flag.Bool("init-db", false, "是否初始化数据库")
		forceInit  = flag.Bool("force-init", false, "强制初始化数据库（会清空现有数据）")
		migrate    = flag.Bool("migrate", false, "执行数据库迁移")
		version    = flag.Bool("version", false, "显示版本信息")
		port       = flag.String("port", "8888", "服务端口")
		host       = flag.String("host", "0.0.0.0", "服务主机")
	)
	flag.Parse()

	if *version {
		fmt.Printf("AutoAds SaaS Server\n")
		fmt.Printf("Version: %s\n", Version)
		fmt.Printf("Build Time: %s\n", BuildTime)
		fmt.Printf("Git Commit: %s\n", GitCommit)
		os.Exit(0)
	}

	log.Printf("🚀 启动 AutoAds SaaS Server v%s", Version)

	// 1. 检查配置文件
	if _, err := os.Stat(*configPath); os.IsNotExist(err) {
		log.Printf("配置文件不存在: %s，使用环境变量配置", *configPath)
	}

	// 2. 数据库初始化（如果需要）
    if *initDB || *forceInit || *migrate {
        log.Println("开始数据库操作...")

		if *forceInit {
			log.Println("⚠️  警告：强制初始化将清空所有现有数据！")
			fmt.Print("确认继续？(y/N): ")
			var confirm string
			fmt.Scanln(&confirm)
			if confirm != "y" && confirm != "Y" {
				log.Println("操作已取消")
				os.Exit(0)
			}
		}

		if err := dbinit.AutoInitialize(); err != nil {
			log.Fatalf("数据库操作失败: %v", err)
		}

        log.Println("✅ 数据库初始化流程完成（基础表检查/创建）")
        // 不在此处退出，允许后续基于 GORM 的模型迁移在同一进程内执行；
        // 若仅需迁移，稍后将根据 *migrate 标记在建立 DB 连接后退出。
    }

	// 3. 初始化配置管理器
	configManager := config.GetConfigManager()

	// 加载配置
	if err := configManager.LoadConfig(*configPath); err != nil {
		log.Printf("警告：加载配置文件失败: %v，使用环境变量配置", err)
		// 不退出，继续使用环境变量
	} else {
		log.Println("✅ 配置加载成功")
	}

	// 添加配置变更回调
	configManager.AddCallback(func(cfg *config.Config) {
		log.Printf("配置重新加载: %s", time.Now().Format(time.RFC3339))
	})

	// 4. 初始化缓存
	if err := cache.InitCache(); err != nil {
		log.Printf("警告：Redis 缓存初始化失败，使用内存缓存: %v", err)
	} else {
		log.Println("✅ 缓存初始化成功")
	}

	// 4.1 初始化数据库与业务服务
    if cfg2, err := config.Load(); err != nil {
		log.Printf("⚠️  加载配置失败，无法初始化数据库: %v", err)
	} else {
		// 数据库
		dbConf := store.DatabaseConfig{
			Host:        cfg2.DB.Host,
			Port:        cfg2.DB.Port,
			Username:    cfg2.DB.Username,
			Password:    cfg2.DB.Password,
			Database:    cfg2.DB.Database,
			Charset:     cfg2.DB.Charset,
			MaxIdle:     cfg2.DB.Pool.MaxIdle,
			MaxOpen:     cfg2.DB.Pool.MaxOpen,
			MaxLifetime: cfg2.DB.Pool.MaxLifetime,
		}
        if sdb, err := store.NewDB(dbConf); err != nil {
            log.Printf("⚠️  数据库连接失败: %v", err)
        } else {
            storeDB = sdb
            gormDB = sdb.DB
            log.Println("✅ 数据库连接成功")

			// Redis
			if r, err := store.NewRedis(&cfg2.Redis); err != nil {
				log.Fatalf("Redis 初始化失败（为必选项）: %v", err)
			} else {
				storeRedis = r
				if storeRedis == nil {
					log.Fatalf("Redis 未启用（为必选项），请在配置中开启 redis.enable 并正确配置连接")
				}
				log.Println("✅ Redis 初始化成功")
			}

            // 执行模型迁移（在提供 -migrate 时执行，保证幂等）
            if *migrate {
                // 仅迁移模型相关表（幂等）
                if err := gormDB.AutoMigrate(&batchgo.BatchJob{}, &batchgo.BatchJobItem{}, &batchgo.BatchJobProgress{}); err != nil {
                    log.Fatalf("模型迁移失败: %v", err)
                }
                log.Println("✅ 模型迁移完成：batch_jobs / batch_job_items / batch_job_progress")
                // 迁移完成即退出（部署阶段幂等执行）
                os.Exit(0)
            }

            // JWT 服务（优先使用环境变量 AUTH_SECRET）
			secret := os.Getenv("AUTH_SECRET")
			if secret == "" {
				secret = "autoads-saas-secret-key-2025"
			}
			jwtSvc = auth.NewJWTService(&auth.JWTConfig{SecretKey: secret, ExpireHours: 24, RefreshHours: 168, Issuer: "autoads-saas"})

			// WebSocket 管理器
			wsManager = websocket.NewManager()
			go wsManager.Run()

			// Token 服务
			tokenSvc = user.NewTokenService(gormDB)

            // BatchGo 服务（注入 Redis 以共享 BadURL 标记）
            batchService = batchgo.NewService(gormDB, tokenSvc, wsManager, auditSvc, storeRedis)

            // Auto-migrate BatchOpen unified tables (minimal)
            if err := gormDB.AutoMigrate(&batchgo.BatchJob{}, &batchgo.BatchJobItem{}, &batchgo.BatchJobProgress{}); err != nil {
                log.Printf("警告：BatchOpen 统一模型迁移失败: %v", err)
            } else {
                log.Println("✅ BatchOpen 统一模型表已就绪（batch_jobs, batch_job_items, batch_job_progress）")
            }

			// SiteRank SimilarWeb 客户端
			swebClient = siterankgo.NewSimilarWebClient()

			// Chengelink 服务（使用适配器桥接Token能力）
			chengelinkService = chengelink.NewChengeLinkService(gormDB, &tokenServiceAdapter{ts: tokenSvc})

            // 审计服务
            auditSvc = audit.NewAutoAdsAuditService(gormDB)

            // RateLimitManager（最小实现：通过 SQL 解析用户套餐）
            rateLimitManager = ratelimit.NewRateLimitManager(cfg2, storeDB, &simpleUserSvc{})

            // AdsCenter 执行器（外部服务，可选）
            if u := os.Getenv("ADSCENTER_EXECUTOR_URL"); u != "" {
                adsUpdater = adscentergo.NewHTTPAdsUpdater(u)
                log.Printf("✅ AdsCenter 执行器已配置: %s", u)
            } else {
                log.Printf("ℹ️ AdsCenter 执行器未配置（ADSCENTER_EXECUTOR_URL 为空），执行将使用占位逻辑")
            }
        }
    }

	// 5. 初始化监控和指标收集
	metrics.InitializeDefaultChecks()
	log.Println("✅ 监控系统初始化成功")

    // 5.1 启动调度器（系统任务）
    sch := scheduler.GetScheduler()
    // 注册优化方案系统任务
    sch.RegisterOptimizationJobs()
    if err := sch.Start(); err != nil {
        log.Printf("警告：调度器启动失败: %v", err)
    } else {
        log.Println("✅ 调度器启动成功")
    }

	// 6. 初始化健康检查
	cfg, _ := config.Load()
	healthChecker, err := health.NewHealthChecker(cfg)
	if err != nil {
		log.Printf("警告：健康检查器初始化失败: %v", err)
	} else {
		log.Println("✅ 健康检查器初始化成功")
	}

	// 7. 初始化API文档系统（可选）
	if err := docs.GenerateAPIDocs(); err != nil {
		log.Printf("警告：API 文档生成失败: %v", err)
	} else {
		log.Println("✅ API 文档系统初始化成功")
	}

	// 8. 设置Gin模式
	gin.SetMode(gin.ReleaseMode)

	// 9. 创建路由器
	r := gin.New()

	// 添加中间件
	r.Use(requestLogger())
	r.Use(gin.Recovery())
    // 可根据需要添加自定义中间件（CORS、安全等）
    // 统一限流（使用内部中间件，支持 Redis 与计划维度）
    var rlConfig = middleware.DefaultRateLimitConfig
    if cfgVal := configManager.GetRateLimitConfig(); cfgVal.Enabled {
        if cfgVal.RequestsPerMinute > 0 { rlConfig.GlobalRPS = float64(cfgVal.RequestsPerMinute)/60.0 }
        if cfgVal.Burst > 0 { rlConfig.GlobalBurst = cfgVal.Burst }
    }
    // Redis 开关
    rconf := configManager.GetRedisConfig()
    rlConfig.UseRedis = rconf.Enable
    rlConfig.Window = time.Minute
    var redisClient *redisv8.Client
    if storeRedis != nil { redisClient = storeRedis.GetClient() }
    rl := middleware.NewRateLimitMiddleware(rlConfig, redisClient)
    r.Use(rl.GlobalRateLimit())
    r.Use(rl.IPRateLimit())

	// 10. 注册健康检查路由
	if healthChecker != nil {
		r.GET("/health", gin.WrapH(healthChecker.Handler()))
		r.GET("/ready", gin.WrapH(healthChecker.ReadyHandler()))
		r.GET("/live", gin.WrapH(healthChecker.LiveHandler()))
	}

	// 11. 注册API路由
	setupAPIRoutes(r)

	// 11.1 配置聚合只读API（供前台只读下发）
	r.GET("/console/config/v1", func(c *gin.Context) {
		cfg := configManager.GetConfig()
		if cfg == nil {
			c.JSON(503, gin.H{"code": 5000, "message": "config unavailable"})
			return
		}
		// 生成快照与 ETag
		b, _ := json.Marshal(cfg)
		etag := fmt.Sprintf("W/\"%x\"", sha256sum(b))
		if match := c.GetHeader("If-None-Match"); match != "" && match == etag {
			c.Status(304)
			return
		}
		c.Header("ETag", etag)
		c.JSON(200, gin.H{
			"version":  time.Now().UTC().Format(time.RFC3339),
			"config":   cfg,
		})
	})

	// 12. 设置静态文件服务
	setupStaticFiles(r)

	// 13. 启动服务器
	addr := fmt.Sprintf("%s:%s", *host, *port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 在goroutine中启动服务器
	go func() {
		log.Printf("🌐 服务器启动在 http://%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("服务器启动失败: %v", err)
		}
	}()

	// 14. 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("正在关闭服务器...")

	// 优雅关闭
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("服务器强制关闭: %v", err)
	}

	// 关闭配置管理器
	configManager.Close()

	log.Println("✅ 服务器已关闭")
}

// setupAPIRoutes 设置API路由
func setupAPIRoutes(r *gin.Engine) {
	// API v1 路由组
    v1 := r.Group("/api/v1")
	// 可选：内部JWT验签（默认不强制，设置 INTERNAL_JWT_ENFORCE=true 强制）
	if os.Getenv("INTERNAL_JWT_ENFORCE") == "true" {
		v1.Use(middleware.InternalJWTAuth(true))
	} else {
		v1.Use(middleware.InternalJWTAuth(false))
	}
	{
		// 认证路由
		auth := v1.Group("/auth")
		{
			auth.POST("/google", handleGoogleAuth)
			auth.POST("/callback", handleAuthCallback)
			auth.POST("/logout", handleLogout)
		}

		// 用户路由
		user := v1.Group("/user")
		user.Use(authMiddleware())
		{
			user.GET("/profile", handleGetProfile)
			user.PUT("/profile", handleUpdateProfile)
			user.GET("/stats", handleGetUserStats)
		}

        // Token路由
        tokens := v1.Group("/tokens")
        tokens.Use(authMiddleware())
        {
            tokens.GET("/balance", handleGetTokenBalance)
            tokens.GET("/transactions", handleGetTokenTransactions)
            tokens.POST("/purchase", handlePurchaseTokens)
        }

        // 管理路由（/api/v1/console）
        // 登录（无需 AdminJWT）
        v1.POST("/console/login", admin.AdminLoginHandler)
        console := v1.Group("/console")
        console.Use(admin.AdminJWT())
        {
            // 系统配置管理（热更新）
            ctrl := admin.NewAdminController(nil, nil, nil, nil)
            console.GET("/system/config", ctrl.GetSystemConfig)
            console.POST("/system/config", ctrl.UpsertSystemConfig)
            console.DELETE("/system/config/:key", ctrl.DeleteSystemConfig)
            console.GET("/system/config/history", ctrl.GetSystemConfigHistory)
            console.PATCH("/system/config/batch", ctrl.BatchSystemConfig)

            // 最小可用管理能力（users/subscriptions/tokens/monitoring）
            admin.RegisterUserRoutes(console)
            admin.RegisterSubscriptionRoutes(console)
            admin.RegisterTokenRoutes(console)
            admin.RegisterMonitoringRoutes(console)

            // 速率限制管理（需要 RateLimitManager）
            if rateLimitManager != nil {
                rlCtrl := admin.NewRateLimitController(rateLimitManager)
                rlCtrl.RegisterRoutes(console)
            }

            // 调度器管理（列表/立即运行/启用禁用）
            console.GET("/scheduler/jobs", func(c *gin.Context) {
                jobs := scheduler.GetScheduler().GetJobs()
                out := make([]map[string]interface{}, 0, len(jobs))
                for name, j := range jobs {
                    out = append(out, map[string]interface{}{
                        "name": name,
                        "enabled": j.Enabled,
                        "schedule": j.Schedule,
                        "desc": j.Description,
                    })
                }
                c.JSON(200, gin.H{"code":0, "data": out})
            })
            console.POST("/scheduler/run", func(c *gin.Context) {
                var body struct{ Name string `json:"name"` }
                if err := c.ShouldBindJSON(&body); err != nil || body.Name == "" { c.JSON(200, gin.H{"code":1001, "message":"name required"}); return }
                id, err := scheduler.GetScheduler().RunJobNow(body.Name, c.GetString("admin_id"))
                if err != nil { c.JSON(200, gin.H{"code":5001, "message": err.Error()}); return }
                c.JSON(200, gin.H{"code":0, "execution_id": id})
            })
            console.PATCH("/scheduler/jobs/:name", func(c *gin.Context) {
                name := c.Param("name")
                var body struct{ Enabled *bool `json:"enabled"` }
                if name == "" || c.ShouldBindJSON(&body) != nil || body.Enabled == nil { c.JSON(200, gin.H{"code":1001, "message":"invalid body"}); return }
                var err error
                if *body.Enabled { err = scheduler.GetScheduler().EnableJob(name) } else { err = scheduler.GetScheduler().DisableJob(name) }
                if err != nil { c.JSON(200, gin.H{"code":5001, "message": err.Error()}); return }
                c.JSON(200, gin.H{"code":0, "message":"updated"})
            })

            // API 管理（端点与 Keys）
            apiMgmt := &admin.ApiManagementController{}
            apiGroup := console.Group("/api-management")
            {
                apiGroup.GET("/endpoints", apiMgmt.ListEndpoints)
                apiGroup.POST("/endpoints", apiMgmt.CreateEndpoint)
                apiGroup.PUT("/endpoints/:id", apiMgmt.UpdateEndpoint)
                apiGroup.DELETE("/endpoints/:id", apiMgmt.DeleteEndpoint)
                apiGroup.POST("/endpoints/:id/toggle", apiMgmt.ToggleEndpoint)
                apiGroup.GET("/endpoints/:id/metrics", apiMgmt.GetEndpointMetrics)

                apiGroup.GET("/keys", apiMgmt.ListKeys)
                apiGroup.POST("/keys", apiMgmt.CreateKey)
                apiGroup.PUT("/keys/:id", apiMgmt.UpdateKey)
                apiGroup.DELETE("/keys/:id", apiMgmt.DeleteKey)
                apiGroup.POST("/keys/:id/revoke", apiMgmt.RevokeKey)

                apiGroup.GET("/analytics", apiMgmt.GetAnalytics)
                apiGroup.GET("/performance", apiMgmt.GetPerformance)
                apiGroup.GET("/request/:id", apiMgmt.GetRequestById)
            }
        }

        // ===== SITERANK 原子端点（check/execute） =====
		siterank := v1.Group("/siterank")
		{
            // 预检成本与可执行性
            siterank.POST("/batch:check", func(c *gin.Context) {
                type reqBody struct{ Domains []string `json:"domains"` }
                var body reqBody
                if err := c.ShouldBindJSON(&body); err != nil || len(body.Domains) == 0 {
                    c.JSON(400, gin.H{"code": 400, "message": "invalid request: domains required"})
                    return
                }
                userID := c.GetString("user_id")
                if userID == "" {
                    c.JSON(401, gin.H{"code": 401, "message": "unauthorized"})
                    return
                }
                if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }
                // 使用 TokenService 规则计算
                sufficient, balance, total, err := tokenSvc.CheckTokenSufficiency(userID, "siterank", "query", len(body.Domains))
                if err != nil {
                    c.JSON(500, gin.H{"code": 500, "message": err.Error()})
                    return
                }
                c.JSON(200, gin.H{
                    "sufficient": sufficient,
                    "balance": balance,
                    "required": total,
                    "quantity": len(body.Domains),
                })
            })

            // 原子扣费 + 执行
            siterank.POST("/batch:execute", func(c *gin.Context) {
                type reqBody struct{ Domains []string `json:"domains"` }
                var body reqBody
                if err := c.ShouldBindJSON(&body); err != nil || len(body.Domains) == 0 {
                    c.JSON(400, gin.H{"code": 400, "message": "invalid request: domains required"})
                    return
                }
                userID := c.GetString("user_id")
                if userID == "" {
                    c.JSON(401, gin.H{"code": 401, "message": "unauthorized"})
                    return
                }
                // request id echo
                if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }
                // 幂等：DB 唯一 + Redis SetNX 双重保护
                idemKey := c.GetHeader("Idempotency-Key")
                if idemKey != "" {
                    // 1) DB 唯一键
                    if gormDB != nil {
                        res := gormDB.Exec("INSERT IGNORE INTO idempotency_requests(user_id, endpoint, idem_key, status) VALUES (?,?,?,?)", userID, "siterank.batch.execute", idemKey, "PENDING")
                        if res.Error == nil && res.RowsAffected == 0 {
                            c.JSON(200, gin.H{"code":200, "duplicate": true, "message": "duplicate request"}); return
                        }
                    }
                    // 2) Redis 锁（短期并发）
                    if storeRedis != nil {
                        ctx := c.Request.Context()
                        key := "autoads:idem:" + userID + ":" + idemKey
                        ok, _ := storeRedis.GetClient().SetNX(ctx, key, "locked", 10*time.Minute).Result()
                        if !ok { c.JSON(200, gin.H{"code":200, "duplicate": true, "message":"duplicate request"}); return }
                        _ = storeRedis.Expire(ctx, key, 10*time.Minute)
                    }
                }
                // 再次校验余额
                sufficient, balance, total, err := tokenSvc.CheckTokenSufficiency(userID, "siterank", "query", len(body.Domains))
                if err != nil {
                    c.JSON(500, gin.H{"code": 500, "message": err.Error()})
                    return
                }
                if !sufficient {
                    c.JSON(402, gin.H{"code": 402, "message": "INSUFFICIENT_TOKENS", "required": total, "balance": balance})
                    return
                }
                // 先扣费（描述与引用）
                if err := tokenSvc.ConsumeTokensByService(userID, "siterank", "query", len(body.Domains), "siterank.batch"); err != nil {
                    c.JSON(402, gin.H{"code": 402, "message": err.Error(), "required": total, "balance": balance})
                    return
                }
                // 执行业务（SimilarWeb 批量）
                ctx := c.Request.Context()
                data, execErr := swebClient.BatchGetWebsiteData(ctx, userID, body.Domains)
                if execErr != nil {
                    // 失败时尝试退款（best-effort）
                    _ = tokenSvc.AddTokens(userID, total, "refund", "siterank batch failed", "")
                    if auditSvc != nil {
                        _ = auditSvc.LogSiteRankQuery(userID, "batch", map[string]any{"domains": len(body.Domains), "error": execErr.Error()}, c.ClientIP(), c.Request.UserAgent(), false, execErr.Error(), 0)
                    }
                    c.JSON(502, gin.H{"code": 502, "message": execErr.Error()})
                    return
                }
                // 成功：返回结果与最新余额
                newBalance, _ := tokenSvc.GetTokenBalance(userID)
                c.Header("X-Tokens-Consumed", fmt.Sprintf("%d", total))
                c.Header("X-Tokens-Balance", fmt.Sprintf("%d", newBalance))
                // 幂等状态更新
                if idemKey != "" {
                    if gormDB != nil {
                        _ = gormDB.Exec("UPDATE idempotency_requests SET status='DONE' WHERE user_id=? AND endpoint=? AND idem_key=?", userID, "siterank.batch.execute", idemKey).Error
                    }
                    if storeRedis != nil { _ = storeRedis.Set(c.Request.Context(), "autoads:idem:"+userID+":"+idemKey, "done", 24*time.Hour) }
                }
                if auditSvc != nil {
                    _ = auditSvc.LogSiteRankQuery(userID, "batch", map[string]any{"domains": len(body.Domains)}, c.ClientIP(), c.Request.UserAgent(), true, "", 0)
                }
                c.JSON(200, gin.H{
                    "consumed": total,
                    "balance": newBalance,
                    "quantity": len(body.Domains),
                    "results": data,
                })
            })
        }

        // BatchGo路由（避免与 package 名冲突）
        batchGroup := v1.Group("/batchgo")
        batchGroup.Use(authMiddleware())
        {
            // 任务级控制（用于 AutoClick/调度的精确控制）
            batchGroup.POST("/tasks/:id/start", func(c *gin.Context) {
                if batchService == nil { c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"}); return }
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"code": 400, "message": "missing id"}); return }
                if err := batchService.StartTask(userID, id); err != nil { c.JSON(400, gin.H{"code": 400, "message": err.Error()}); return }
                c.JSON(200, gin.H{"code": 0, "message": "started"})
            })
            batchGroup.POST("/tasks/:id/stop", func(c *gin.Context) {
                if batchService == nil { c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"}); return }
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"code": 400, "message": "missing id"}); return }
                if err := batchService.StopTask(userID, id); err != nil { c.JSON(400, gin.H{"code": 400, "message": err.Error()}); return }
                c.JSON(200, gin.H{"code": 0, "message": "stopped"})
            })
            batchGroup.POST("/tasks/:id/terminate", func(c *gin.Context) {
                if batchService == nil { c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"}); return }
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"code": 400, "message": "missing id"}); return }
                if err := batchService.TerminateTask(userID, id); err != nil { c.JSON(400, gin.H{"code": 400, "message": err.Error()}); return }
                c.JSON(200, gin.H{"code": 0, "message": "terminated"})
            })
            batchGroup.POST("/silent-start", handleSilentStart)
            batchGroup.GET("/silent-progress", handleSilentProgress)
            batchGroup.POST("/silent-terminate", handleSilentTerminate)
            batchGroup.POST("/autoclick/tasks", handleAutoClickCreate)
            batchGroup.GET("/autoclick/tasks/:id/progress", handleAutoClickProgress)
        }

			// ===== BATCHOPEN 原子端点（silent 模式 check/execute） =====
			batchopen := v1.Group("/batchopen")
			{
			// 预检：根据 urls 与 cycleCount 计算总量并检查余额
			batchopen.POST("/silent:check", func(c *gin.Context) {
				var body struct {
					URLs       []string `json:"urls"`
					CycleCount int      `json:"cycleCount"`
					AccessMode string   `json:"accessMode"` // http | puppeteer
				}
				if err := c.ShouldBindJSON(&body); err != nil || len(body.URLs) == 0 {
					c.JSON(400, gin.H{"code": 400, "message": "invalid request: urls required"})
					return
				}
                userID := c.GetString("user_id")
                if userID == "" {
                    c.JSON(401, gin.H{"code": 401, "message": "unauthorized"})
                    return
                }
                if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }
                cycle := body.CycleCount
				if cycle <= 0 { cycle = 1 }
				action := "http"
				if body.AccessMode == "puppeteer" { action = "puppeteer" }
				totalQty := len(body.URLs) * cycle
				sufficient, balance, required, err := tokenSvc.CheckTokenSufficiency(userID, "batchgo", action, totalQty)
				if err != nil {
					c.JSON(500, gin.H{"code": 500, "message": err.Error()})
					return
				}
				c.JSON(200, gin.H{"sufficient": sufficient, "balance": balance, "required": required, "quantity": totalQty})
			})

			// 原子执行：扣费 + 创建并启动 silent 任务
			batchopen.POST("/silent:execute", func(c *gin.Context) {
				var body struct {
					TaskName   string            `json:"taskName"`
					URLs       []string          `json:"urls"`
					CycleCount int               `json:"cycleCount"`
					AccessMode string            `json:"accessMode"` // http | puppeteer
					Silent     map[string]any    `json:"silent"`
				}
				if err := c.ShouldBindJSON(&body); err != nil || len(body.URLs) == 0 {
					c.JSON(400, gin.H{"code": 400, "message": "invalid request: urls required"})
					return
				}
				userID := c.GetString("user_id")
				if userID == "" {
					c.JSON(401, gin.H{"code": 401, "message": "unauthorized"})
					return
				}
				cycle := body.CycleCount
				if cycle <= 0 { cycle = 1 }
				action := "http"
				if body.AccessMode == "puppeteer" { action = "puppeteer" }
				totalQty := len(body.URLs) * cycle
				// 幂等
				iKey := c.GetHeader("Idempotency-Key")
                if iKey != "" {
                    if gormDB != nil {
                        res := gormDB.Exec("INSERT IGNORE INTO idempotency_requests(user_id, endpoint, idem_key, status) VALUES (?,?,?,?)", userID, "batchopen.silent.execute", iKey, "PENDING")
                        if res.Error == nil && res.RowsAffected == 0 { c.JSON(200, gin.H{"duplicate": true, "message": "duplicate request"}); return }
                    }
                    if storeRedis != nil {
                        ctx := c.Request.Context()
                        key := "autoads:idem_batch:" + userID + ":" + iKey
                        ok, _ := storeRedis.GetClient().SetNX(ctx, key, "locked", 10*time.Minute).Result()
                        if !ok { c.JSON(200, gin.H{"duplicate": true, "message": "duplicate request"}); return }
                        _ = storeRedis.Expire(ctx, key, 10*time.Minute)
                    }
                }
				// 再次余额校验
				sufficient, balance, required, err := tokenSvc.CheckTokenSufficiency(userID, "batchgo", action, totalQty)
				if err != nil { c.JSON(500, gin.H{"code": 500, "message": err.Error()}); return }
				if !sufficient { c.JSON(402, gin.H{"code": 402, "message": "INSUFFICIENT_TOKENS", "required": required, "balance": balance}); return }
				// 扣费
				if err := tokenSvc.ConsumeTokensByService(userID, "batchgo", action, totalQty, "batchopen.silent"); err != nil {
					c.JSON(402, gin.H{"code": 402, "message": err.Error(), "required": required, "balance": balance})
					return
				}
				// 创建任务
				cfg := batchgo.BatchTaskConfig{ Silent: &batchgo.SilentConfig{ Concurrency: 5, Timeout: 30, RetryCount: 3 } }
				// 合并用户传参（非严格）
				if body.Silent != nil {
					if v, ok := body.Silent["concurrency"].(float64); ok { cfg.Silent.Concurrency = int(v) }
					if v, ok := body.Silent["timeout"].(float64); ok { cfg.Silent.Timeout = int(v) }
					if v, ok := body.Silent["retry_count"].(float64); ok { cfg.Silent.RetryCount = int(v) }
				}
				createReq := &batchgo.CreateTaskRequest{ Name: body.TaskName, Mode: batchgo.ModeSilent, URLs: body.URLs, Config: cfg }
				task, err := batchService.CreateTask(userID, createReq)
				if err != nil {
					// 失败退款（best-effort）
					_ = tokenSvc.AddTokens(userID, required, "refund", "batchopen create failed", "")
					if auditSvc != nil { _ = auditSvc.LogBatchTaskAction(userID, "create", "", map[string]any{"urls": len(body.URLs), "mode": "silent", "error": err.Error()}, c.ClientIP(), c.Request.UserAgent(), false, err.Error(), 0) }
					c.JSON(500, gin.H{"code": 500, "message": err.Error()})
					return
				}
				// 启动任务（异步）
				go func() {
					if err := batchService.StartTask(userID, task.ID); err != nil {
						// 启动失败退款（best-effort）
						_ = tokenSvc.AddTokens(userID, required, "refund", "batchopen start failed", task.ID)
						if auditSvc != nil { _ = auditSvc.LogBatchTaskAction(userID, "start", task.ID, map[string]any{"urls": len(body.URLs), "mode": "silent", "error": err.Error()}, c.ClientIP(), c.Request.UserAgent(), false, err.Error(), 0) }
					} else {
						if auditSvc != nil { _ = auditSvc.LogBatchTaskAction(userID, "start", task.ID, map[string]any{"urls": len(body.URLs), "mode": "silent"}, c.ClientIP(), c.Request.UserAgent(), true, "", 0) }
					}
				}()
                newBalance, _ := tokenSvc.GetTokenBalance(userID)
                c.Header("X-Tokens-Consumed", fmt.Sprintf("%d", required))
                c.Header("X-Tokens-Balance", fmt.Sprintf("%d", newBalance))
                if iKey != "" {
                    if gormDB != nil { _ = gormDB.Exec("UPDATE idempotency_requests SET status='DONE' WHERE user_id=? AND endpoint=? AND idem_key=?", userID, "batchopen.silent.execute", iKey).Error }
                    if storeRedis != nil { _ = storeRedis.Set(c.Request.Context(), "autoads:idem_batch:"+userID+":"+iKey, "done", 24*time.Hour) }
                }
				c.JSON(200, gin.H{"taskId": task.ID, "consumed": required, "balance": newBalance, "status": "running"})
			})

			// 任务进度查询（最小集：基于 batch_tasks 聚合）
			batchopen.GET("/tasks/:id", func(c *gin.Context) {
				userID := c.GetString("user_id")
				if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
				if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }
				taskID := c.Param("id")
				if taskID == "" { c.JSON(400, gin.H{"code": 400, "message": "missing id"}); return }
                if task, err := batchService.GetTask(userID, taskID); err == nil {
                    processed := task.ProcessedCount
                    total := task.URLCount
                    percent := 0
                    if total > 0 { percent = int(float64(processed) / float64(total) * 100.0) }
                    pending := total - processed
                    message := task.ErrorMessage
                    if message == "" {
                        switch task.Status {
                        case batchgo.StatusPending:
                            message = "任务等待中"
                        case batchgo.StatusRunning:
                            message = "任务运行中"
                        case batchgo.StatusCompleted:
                            message = "任务已完成"
                        case batchgo.StatusFailed:
                            message = "任务失败"
                        case batchgo.StatusCancelled:
                            message = "任务已取消"
                        case batchgo.StatusPaused:
                            message = "任务已暂停"
                        }
                    }
                    c.JSON(200, gin.H{"success": true, "status": string(task.Status), "progress": percent, "successCount": task.SuccessCount, "failCount": task.FailedCount, "total": total, "pendingCount": pending, "message": message, "timestamp": time.Now().UnixMilli(), "serverTime": time.Now().Format(time.RFC3339)})
                    return
                }
                // 聚合新三表
                dao := batchgo.NewDAO(gormDB)
                if prog, err := dao.AggregateProgress(taskID); err == nil {
                    percent := 0
                    if prog.Total > 0 { percent = int(float64(prog.Success+prog.Fail) / float64(prog.Total) * 100.0) }
                    c.JSON(200, gin.H{"success": true, "status": "running", "progress": percent, "successCount": prog.Success, "failCount": prog.Fail, "total": prog.Total, "pendingCount": prog.Running, "message": "聚合进度", "timestamp": time.Now().UnixMilli(), "serverTime": time.Now().Format(time.RFC3339)})
                    return
                }
                c.JSON(404, gin.H{"success": false, "message": "TASK_NOT_FOUND"})
            })

			// ===== 为 Next BFF 提供的统一端点（保持合同） =====
			// POST /api/v1/batchopen/start?type=silent|basic|autoclick
			batchopen.POST("/start", func(c *gin.Context) {
				// 目前仅实现 silent，basic/autoclick 预留
				// 复用现有兼容处理器，确保老合同可用
				mode := strings.ToLower(c.DefaultQuery("type", "silent"))
				switch mode {
				case "silent":
					handleSilentStart(c)
				case "basic":
					// 直接复用 silent pipeline，后续按需拆分
					handleSilentStart(c)
				case "autoclick":
					// 先走通创建流程（与 silent 一致），未来接入定时/调度
					handleSilentStart(c)
				default:
					c.JSON(400, gin.H{"code": 400, "message": "unsupported type"})
				}
			})

			// GET /api/v1/batchopen/progress?taskId=xxx
			batchopen.GET("/progress", func(c *gin.Context) {
				handleSilentProgress(c)
			})

			// POST /api/v1/batchopen/terminate { taskId }
			batchopen.POST("/terminate", func(c *gin.Context) {
				handleSilentTerminate(c)
			})

			// GET /api/v1/batchopen/version
			batchopen.GET("/version", func(c *gin.Context) {
				c.JSON(200, gin.H{
					"name":     "batchopen-go",
					"version":  Version,
					"build":    BuildTime,
					"commit":   GitCommit,
					"provider": "go",
				})
			})

			// POST /api/v1/batchopen/proxy-url-validate { proxyUrl }
			batchopen.POST("/proxy-url-validate", func(c *gin.Context) {
				var body struct{ ProxyURL string `json:"proxyUrl"` }
				if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.ProxyURL) == "" {
					c.JSON(400, gin.H{"code": 400, "message": "invalid request: proxyUrl required"})
					return
				}
				u, err := url.Parse(body.ProxyURL)
				if err != nil {
					c.JSON(200, gin.H{"valid": false, "message": "parse error", "error": err.Error()})
					return
				}
				if u.Scheme == "" || u.Host == "" {
					c.JSON(200, gin.H{"valid": false, "message": "missing scheme or host"})
					return
				}
				// 允许 http/https/socks5 三类
				switch strings.ToLower(u.Scheme) {
				case "http", "https", "socks5":
					// ok
				default:
					c.JSON(200, gin.H{"valid": false, "message": "unsupported scheme"})
					return
				}
				// 校验端口
				host := u.Host
				if !strings.Contains(host, ":") {
					c.JSON(200, gin.H{"valid": false, "message": "missing port"})
					return
				}
				c.JSON(200, gin.H{"valid": true, "normalized": u.String()})
			})
		}

			// SiteRank路由（避免重复声明变量名）
        siteRankGroup := v1.Group("/siterank")
        siteRankGroup.Use(authMiddleware())
        {
            siteRankGroup.GET("/rank", handleSiteRank)
            siteRankGroup.POST("/batch", handleBatchSiteRank)
            // 原子端点：预检与执行（供前端 BFF 使用）
            siteRankGroup.POST("/batch:check", func(c *gin.Context) {
                if tokenSvc == nil { c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"}); return }
                var body struct { Domains []string `json:"domains"` }
                if err := c.ShouldBindJSON(&body); err != nil || len(body.Domains) == 0 {
                    c.JSON(400, gin.H{"code": 400, "message": "invalid request: domains required"}); return
                }
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                qty := len(body.Domains)
                sufficient, balance, required, err := tokenSvc.CheckTokenSufficiency(userID, "siterank", "batch", qty)
                if err != nil { c.JSON(500, gin.H{"code": 500, "message": err.Error()}); return }
                c.JSON(200, gin.H{"sufficient": sufficient, "balance": balance, "required": required, "quantity": qty})
            })
            siteRankGroup.POST("/batch:execute", func(c *gin.Context) {
                if tokenSvc == nil || swebClient == nil { c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"}); return }
                var body struct { Domains []string `json:"domains"`; Force bool `json:"force"` }
                if err := c.ShouldBindJSON(&body); err != nil || len(body.Domains) == 0 {
                    c.JSON(400, gin.H{"code": 400, "message": "invalid request: domains required"}); return
                }
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                qty := len(body.Domains)
                sufficient, balance, required, err := tokenSvc.CheckTokenSufficiency(userID, "siterank", "batch", qty)
                if err != nil { c.JSON(500, gin.H{"code": 500, "message": err.Error()}); return }
                if !sufficient { c.JSON(402, gin.H{"code": 402, "message": "INSUFFICIENT_TOKENS", "required": required, "balance": balance}); return }
                if err := tokenSvc.ConsumeTokensByService(userID, "siterank", "batch", qty, "siterank.batch"); err != nil {
                    c.JSON(402, gin.H{"code": 402, "message": err.Error(), "required": required, "balance": balance}); return
                }
                // 执行批量查询
                ctx := c.Request.Context()
                data, execErr := swebClient.BatchGetWebsiteData(ctx, userID, body.Domains)
                if execErr != nil {
                    // 失败退款（best-effort）
                    _ = tokenSvc.AddTokens(userID, required, "refund", "siterank batch failed", "")
                    c.JSON(502, gin.H{"code": 502, "message": execErr.Error()}); return
                }
                newBalance, _ := tokenSvc.GetTokenBalance(userID)
                c.Header("X-Tokens-Consumed", fmt.Sprintf("%d", required))
                c.Header("X-Tokens-Balance", fmt.Sprintf("%d", newBalance))
                c.JSON(200, gin.H{"success": true, "results": data, "consumed": required, "balance": newBalance})
            })
        }

		// Chengelink路由
		chengelink := v1.Group("/chengelink")
		chengelink.Use(authMiddleware())
		{
			chengelink.POST("/create", handleChengeLinkCreate)
			chengelink.GET("/tasks", handleChengeLinkTasks)
			chengelink.GET("/tasks/:id", handleChengeLinkTask)
		}

		// 邀请路由
		invGroup := v1.Group("/invitation")
		invGroup.Use(authMiddleware())
		{
			invGroup.GET("/info", func(c *gin.Context) {
				if gormDB == nil || tokenSvc == nil {
					c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
					return
				}
				ctrl := invitation.NewInvitationController(invitation.NewInvitationService(gormDB, &invTokenAdapter{ts: tokenSvc}))
				ctrl.GetInvitationInfo(c)
			})
			invGroup.POST("/generate-link", func(c *gin.Context) {
				if gormDB == nil || tokenSvc == nil {
					c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
					return
				}
				ctrl := invitation.NewInvitationController(invitation.NewInvitationService(gormDB, &invTokenAdapter{ts: tokenSvc}))
				ctrl.GenerateInviteLink(c)
			})
			invGroup.GET("/history", func(c *gin.Context) {
				if gormDB == nil || tokenSvc == nil {
					c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
					return
				}
				ctrl := invitation.NewInvitationController(invitation.NewInvitationService(gormDB, &invTokenAdapter{ts: tokenSvc}))
				ctrl.GetInvitationHistory(c)
			})
		}

		// 签到路由
		checkinGroup := v1.Group("/checkin")
		checkinGroup.Use(authMiddleware())
		{
			checkinGroup.GET("/info", func(c *gin.Context) {
				if gormDB == nil || tokenSvc == nil {
					c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
					return
				}
				ctrl := checkin.NewCheckinController(checkin.NewCheckinService(gormDB, &invTokenAdapter{ts: tokenSvc}))
				ctrl.GetCheckinInfo(c)
			})
			checkinGroup.POST("/perform", func(c *gin.Context) {
				if gormDB == nil || tokenSvc == nil {
					c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
					return
				}
				ctrl := checkin.NewCheckinController(checkin.NewCheckinService(gormDB, &invTokenAdapter{ts: tokenSvc}))
				ctrl.PerformCheckin(c)
			})
			checkinGroup.GET("/history", func(c *gin.Context) {
				if gormDB == nil || tokenSvc == nil {
					c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
					return
				}
				ctrl := checkin.NewCheckinController(checkin.NewCheckinService(gormDB, &invTokenAdapter{ts: tokenSvc}))
				ctrl.GetCheckinHistory(c)
			})
		}
	}

	// 兼容旧API路径
	setupLegacyAPIRoutes(r)

	// WebSocket路由
	r.GET("/ws", handleWebSocket)

	// 管理员路由
    admin := r.Group("/admin")
    admin.Use(adminAuthMiddleware())
    {
        admin.GET("/users", handleAdminGetUsers)
        admin.PUT("/users/:id", handleAdminUpdateUser)
        admin.GET("/stats", handleAdminGetStats)
        admin.GET("/dashboard", handleAdminDashboard)
        // Bad URL 管理（共享 Redis 标记）
        admin.GET("/badurls", func(c *gin.Context) {
            if storeRedis == nil { c.JSON(503, gin.H{"code": 5000, "message": "redis unavailable"}); return }
            q := c.Query("q")
            page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
            size, _ := strconv.Atoi(c.DefaultQuery("size", "50"))
            if page < 1 { page = 1 }; if size < 1 || size > 200 { size = 50 }
            pattern := "autoads:badurl:*"
            ctx := context.Background()
            var cursor uint64 = 0
            items := make([]map[string]any, 0, size)
            collected := 0
            skipped := 0
            start := (page-1)*size
            // naive scan and paginate
            for {
                keys, cur, err := storeRedis.GetClient().Scan(ctx, cursor, pattern, 1000).Result()
                if err != nil { c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return }
                cursor = cur
                for _, k := range keys {
                    // read value (original URL) and ttl
                    val, _ := storeRedis.Get(ctx, k)
                    if q != "" && !strings.Contains(val, q) { continue }
                    if skipped < start { skipped++; continue }
                    ttl, _ := storeRedis.GetClient().TTL(ctx, k).Result()
                    hash := strings.TrimPrefix(k, "autoads:badurl:")
                    item := map[string]any{"hash": hash, "url": val}
                    if ttl > 0 { item["ttlSeconds"] = int(ttl.Seconds()); item["expiresAt"] = time.Now().Add(ttl).Format(time.RFC3339) }
                    items = append(items, item)
                    collected++
                    if collected >= size { break }
                }
                if cursor == 0 || collected >= size { break }
            }
            c.JSON(200, gin.H{"items": items, "page": page, "size": size})
        })
        admin.DELETE("/badurls/:hash", func(c *gin.Context) {
            if storeRedis == nil { c.JSON(503, gin.H{"code": 5000, "message": "redis unavailable"}); return }
            hash := c.Param("hash")
            if hash == "" { c.JSON(400, gin.H{"code": 400, "message": "missing hash"}); return }
            key := "autoads:badurl:" + hash
            if err := storeRedis.Delete(context.Background(), key); err != nil { c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return }
            c.JSON(200, gin.H{"code": 0, "message": "deleted"})
        })
        admin.DELETE("/badurls", func(c *gin.Context) {
            if storeRedis == nil { c.JSON(503, gin.H{"code": 5000, "message": "redis unavailable"}); return }
            q := c.Query("q")
            ctx := context.Background()
            pattern := "autoads:badurl:*"
            var cursor uint64 = 0
            deleted := 0
            for {
                keys, cur, err := storeRedis.GetClient().Scan(ctx, cursor, pattern, 1000).Result()
                if err != nil { c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return }
                cursor = cur
                for _, k := range keys {
                    if q != "" {
                        v, _ := storeRedis.Get(ctx, k)
                        if !strings.Contains(v, q) { continue }
                    }
                    if err := storeRedis.Delete(ctx, k); err == nil { deleted++ }
                }
                if cursor == 0 { break }
            }
            c.JSON(200, gin.H{"code": 0, "deleted": deleted})
        })
    }

	// API健康检查
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "ok",
			"timestamp": time.Now(),
			"version":   Version,
		})
	})

	// 进一步健康检查（DB ping）
	r.GET("/api/health/v2", func(c *gin.Context) {
		status := "ok"
		reason := ""
		if gormDB == nil {
			status = "degraded"
			reason = "db not initialized"
		} else {
			var one int
			if err := gormDB.Raw("SELECT 1").Scan(&one).Error; err != nil || one != 1 {
				status = "degraded"
				reason = "db ping failed"
			}

			// ===== ADSCENTER 原子端点（链接替换 check/execute） =====
            adscenter := v1.Group("/adscenter")
            {
                // 预检：按 extract_link + update_ads 规则估算总消耗
                adscenter.POST("/link:update:check", func(c *gin.Context) {
					var body struct {
						AffiliateLinks   []string `json:"affiliate_links"`
						AdsPowerProfile  string   `json:"adspower_profile"`
						GoogleAdsAccount string   `json:"google_ads_account"`
					}
					if err := c.ShouldBindJSON(&body); err != nil || len(body.AffiliateLinks) == 0 {
						c.JSON(400, gin.H{"code": 400, "message": "invalid request: affiliate_links required"})
						return
					}
					userID := c.GetString("user_id")
					if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
					if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }
					// 估算消耗：分别按 extract 与 update_ads 规则
					_, balance1, requiredExtract, err1 := tokenSvc.CheckTokenSufficiency(userID, "chengelink", "extract", len(body.AffiliateLinks))
					if err1 != nil { c.JSON(500, gin.H{"code": 500, "message": err1.Error()}); return }
					_, _, requiredUpdate, err2 := tokenSvc.CheckTokenSufficiency(userID, "chengelink", "update_ads", len(body.AffiliateLinks))
					if err2 != nil { c.JSON(500, gin.H{"code": 500, "message": err2.Error()}); return }
					required := requiredExtract + requiredUpdate
					sufficient := balance1 >= required
					c.JSON(200, gin.H{"sufficient": sufficient, "balance": balance1, "required": required, "quantity": len(body.AffiliateLinks)})
                })

                // 执行：创建并启动任务（任务内部阶段性扣费），保持原子化在服务内部
                adscenter.POST("/link:update:execute", func(c *gin.Context) {
					var body struct {
						Name             string   `json:"name"`
						AffiliateLinks   []string `json:"affiliate_links"`
						AdsPowerProfile  string   `json:"adspower_profile"`
						GoogleAdsAccount string   `json:"google_ads_account"`
					}
					if err := c.ShouldBindJSON(&body); err != nil || len(body.AffiliateLinks) == 0 {
						c.JSON(400, gin.H{"code": 400, "message": "invalid request: affiliate_links required"})
						return
					}
					userID := c.GetString("user_id")
					if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
					if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }
					// 幂等键（可选）
					iKey := c.GetHeader("Idempotency-Key")
                    if iKey != "" {
                        if gormDB != nil {
                            res := gormDB.Exec("INSERT IGNORE INTO idempotency_requests(user_id, endpoint, idem_key, status) VALUES (?,?,?,?)", userID, "adscenter.link.update.execute", iKey, "PENDING")
                            if res.Error == nil && res.RowsAffected == 0 { c.JSON(200, gin.H{"duplicate": true, "message": "duplicate request"}); return }
                        }
                        if storeRedis != nil {
                            ctx := c.Request.Context()
                            key := "autoads:idem_ads:" + userID + ":" + iKey
                            ok, _ := storeRedis.GetClient().SetNX(ctx, key, "locked", 10*time.Minute).Result()
                            if !ok { c.JSON(200, gin.H{"duplicate": true, "message": "duplicate request"}); return }
                            _ = storeRedis.Expire(ctx, key, 10*time.Minute)
                        }
                    }
					// 创建任务
					creq := &chengelink.CreateTaskRequest{ Name: body.Name, AffiliateLinks: body.AffiliateLinks, AdsPowerProfile: body.AdsPowerProfile, GoogleAdsAccount: body.GoogleAdsAccount }
					task, err := chengelinkService.CreateTask(userID, creq)
					if err != nil {
						if auditSvc != nil { _ = auditSvc.LogChengeLinkAction(userID, "create", "", map[string]any{"links": len(body.AffiliateLinks), "error": err.Error()}, c.ClientIP(), c.Request.UserAgent(), false, err.Error(), 0) }
						c.JSON(500, gin.H{"code": 500, "message": err.Error()})
						return
					}
					// 启动任务
					go func() {
						if err := chengelinkService.StartTask(task.ID); err != nil {
							if auditSvc != nil { _ = auditSvc.LogChengeLinkAction(userID, "start", task.ID, map[string]any{"links": len(body.AffiliateLinks), "error": err.Error()}, c.ClientIP(), c.Request.UserAgent(), false, err.Error(), 0) }
						} else {
							if auditSvc != nil { _ = auditSvc.LogChengeLinkAction(userID, "start", task.ID, map[string]any{"links": len(body.AffiliateLinks)}, c.ClientIP(), c.Request.UserAgent(), true, "", 0) }
						}
                    }()
                    if iKey != "" && gormDB != nil { _ = gormDB.Exec("UPDATE idempotency_requests SET status='DONE' WHERE user_id=? AND endpoint=? AND idem_key=?", userID, "adscenter.link.update.execute", iKey).Error }
                    c.JSON(200, gin.H{"taskId": task.ID, "status": string(task.Status)})
                })

                // ===== v1: minimal accounts/configurations/executions =====
                // GET /api/v1/adscenter/accounts
                adscenter.GET("/accounts", func(c *gin.Context) {
                    if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
                    userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                    var rows []AdsAccount
                    if err := gormDB.Where("user_id = ?", userID).Order("created_at DESC").Find(&rows).Error; err != nil {
                        c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return
                    }
                    c.JSON(200, gin.H{"accounts": rows, "count": len(rows)})
                })

                // GET /api/v1/adscenter/configurations
                adscenter.GET("/configurations", func(c *gin.Context) {
                    if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
                    userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                    var rows []AdsConfiguration
                    if err := gormDB.Where("user_id = ?", userID).Order("created_at DESC").Find(&rows).Error; err != nil {
                        c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return
                    }
                    c.JSON(200, gin.H{"configurations": rows, "count": len(rows)})
                })

                // POST /api/v1/adscenter/configurations
                adscenter.POST("/configurations", func(c *gin.Context) {
                    if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
                    userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                    var body struct{ Name string `json:"name"`; Description string `json:"description"`; Payload map[string]any `json:"payload"` }
                    if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" {
                        c.JSON(400, gin.H{"code": 400, "message": "invalid request: name required"}); return
                    }
                    b, _ := json.Marshal(body.Payload)
                    row := &AdsConfiguration{ ID: fmt.Sprintf("%d", time.Now().UnixNano()), UserID: userID, Name: body.Name, Description: body.Description, Payload: datatypes.JSON(b), Status: "active", CreatedAt: time.Now(), UpdatedAt: time.Now() }
                    if err := gormDB.Create(row).Error; err != nil { c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return }
                    c.JSON(200, gin.H{"configuration": row})
                })

                // POST /api/v1/adscenter/executions（分阶段扣费：每处理1项先扣1次，失败立即退款；附带审计分类）
                adscenter.POST("/executions", func(c *gin.Context) {
                    if gormDB == nil || tokenSvc == nil { c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"}); return }
                    userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                    var body struct{ ConfigurationID string `json:"configurationId"` }
                    if err := c.ShouldBindJSON(&body); err != nil || body.ConfigurationID == "" { c.JSON(400, gin.H{"code": 400, "message": "configurationId required"}); return }
                    var cfg AdsConfiguration
                    if err := gormDB.Where("id = ? AND user_id = ?", body.ConfigurationID, userID).First(&cfg).Error; err != nil {
                        c.JSON(404, gin.H{"code": 404, "message": "configuration not found"}); return
                    }
                    // compute quantity from payload + extract items list
                    qty := 1
                    links := make([]string, 0)
                    var payload map[string]any
                    _ = json.Unmarshal([]byte(cfg.Payload), &payload)
                    if payload != nil {
                        if arr, ok := payload["affiliate_links"].([]any); ok && len(arr) > 0 {
                            qty = len(arr)
                            for _, v := range arr { if s, ok := v.(string); ok { links = append(links, s) } }
                        } else if arr2, ok2 := payload["links"].([]any); ok2 && len(arr2) > 0 {
                            qty = len(arr2)
                            for _, v := range arr2 { if s, ok := v.(string); ok { links = append(links, s) } }
                        }
                    }
                    // 仅校验余额充足（不预扣），实际消费按处理进度逐步扣减
                    sufficient, balance, required, err := tokenSvc.CheckTokenSufficiency(userID, "adscenter", "update", qty)
                    if err != nil { c.JSON(500, gin.H{"code": 500, "message": err.Error()}); return }
                    if !sufficient { c.JSON(402, gin.H{"code": 402, "message": "INSUFFICIENT_TOKENS", "required": required, "balance": balance}); return }
                    now := time.Now()
                    exec := &AdsExecution{ ID: fmt.Sprintf("%d", now.UnixNano()), UserID: userID, ConfigurationID: cfg.ID, Status: "running", Message: "processing", Progress: 0, TotalItems: qty, ProcessedItems: 0, StartedAt: &now, CreatedAt: now, UpdatedAt: now }
                    if err := gormDB.Create(exec).Error; err != nil { c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return }
                // 异步处理：每处理1项，先消费1次；若失败则立即退款 + 审计分类
                    go func(executionID string, items []string) {
                        processed := 0
                        total := len(items)
                        for processed < total {
                            time.Sleep(150 * time.Millisecond)
                            // 1) 预先消费 1 项；若余额不足则终止
                            if err := tokenSvc.ConsumeTokensByService(userID, "adscenter", "update", 1, executionID); err != nil {
                                _ = gormDB.Model(&AdsExecution{}).Where("id = ?", executionID).Updates(map[string]any{"status": "failed", "message": "INSUFFICIENT_TOKENS", "updated_at": time.Now()}).Error
                                if auditSvc != nil { _ = auditSvc.LogAdsCenterAction(userID, "adscenter_execute_item", executionID, map[string]any{"index": processed, "classification": "insufficient_tokens"}, c.ClientIP(), c.Request.UserAgent(), false, err.Error(), 0) }
                                return
                            }
                            // 2) 执行具体更新（此处最小实现：总是成功；预留分类）
                            var stepErr error
                            classification := "success"
                            success := true
                            if adsUpdater != nil && processed < len(items) {
                                link := items[processed]
                                success, classification, stepErr = adsUpdater.Update(link)
                            }
                            if !success {
                                // 失败退款
                                _ = tokenSvc.AddTokens(userID, 1, "refund", "adscenter item failed", executionID)
                                if auditSvc != nil { _ = auditSvc.LogAdsCenterAction(userID, "adscenter_execute_item", executionID, map[string]any{"index": processed, "classification": classification}, c.ClientIP(), c.Request.UserAgent(), false, stepErr.Error(), 0) }
                            } else {
                                if auditSvc != nil { _ = auditSvc.LogAdsCenterAction(userID, "adscenter_execute_item", executionID, map[string]any{"index": processed, "classification": "success"}, c.ClientIP(), c.Request.UserAgent(), true, "", 0) }
                                processed++
                            }
                            prog := int(float64(processed) / float64(total) * 100.0)
                            _ = gormDB.Model(&AdsExecution{}).Where("id = ?", executionID).Updates(map[string]any{"processed_items": processed, "progress": prog, "updated_at": time.Now()}).Error
                        }
                        done := time.Now()
                        _ = gormDB.Model(&AdsExecution{}).Where("id = ?", executionID).Updates(map[string]any{"status": "completed", "message": "done", "completed_at": done, "updated_at": done}).Error
                    }(exec.ID, links)
                    // 创建响应（尚未消费）
                    newBalance, _ := tokenSvc.GetTokenBalance(userID)
                    c.Header("X-Tokens-Consumed", "0")
                    c.Header("X-Tokens-Balance", fmt.Sprintf("%d", newBalance))
                    c.JSON(200, gin.H{"execution": exec})
                })

                // GET /api/v1/adscenter/executions
                adscenter.GET("/executions", func(c *gin.Context) {
                    if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
                    userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                    var rows []AdsExecution
                    if err := gormDB.Where("user_id = ?", userID).Order("created_at DESC").Limit(100).Find(&rows).Error; err != nil {
                        c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return
                    }
                    c.JSON(200, gin.H{"executions": rows, "count": len(rows)})
                })

                // GET /api/v1/adscenter/executions/:id
                adscenter.GET("/executions/:id", func(c *gin.Context) {
                    if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
                    userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
                    id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"code": 400, "message": "missing id"}); return }
                    var exec AdsExecution
                    if err := gormDB.Where("id = ? AND user_id = ?", id, userID).First(&exec).Error; err != nil {
                        c.JSON(404, gin.H{"code": 404, "message": "execution not found"}); return
                    }
                    c.JSON(200, gin.H{"execution": exec})
                })
            }
		}
		c.JSON(200, gin.H{
			"status":    status,
			"reason":    reason,
			"timestamp": time.Now(),
			"version":   Version,
		})
	})
}

// sha256sum returns a 16-byte trimmed hex-like slice for ETag generation
func sha256sum(b []byte) []byte {
	h := sha256.Sum256(b)
	// reduce size for weak etag aesthetics (still ok as identifier)
	return h[:16]
}

// ====== 简易请求限流（100次/分钟） ======
type rlEntry struct {
	count       int
	windowStart time.Time
}

var rateLimiterStore = struct {
	m  map[string]*rlEntry
	mu sync.Mutex
}{m: make(map[string]*rlEntry)}

func rateLimitMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 只限制 /api 路径
		if !strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Next()
			return
		}
		key := c.ClientIP()
		if uid := c.GetString("user_id"); uid != "" {
			key = uid
		}
		// 使用Redis限流（可用时），否则回退到内存
        if storeRedis != nil {
            ctx := context.Background()
            redisKey := "autoads:rl:" + key
            n, err := storeRedis.Incr(ctx, redisKey)
            if err == nil {
                if n == 1 {
                    _ = storeRedis.Expire(ctx, redisKey, window)
                }
                if n > int64(limit) {
                    c.JSON(http.StatusTooManyRequests, gin.H{"code": 429, "message": "Too many requests"})
                    c.Abort()
                    return
                }
                // Success path: set rate limit headers
                remaining := limit - int(n)
                if remaining < 0 { remaining = 0 }
                // best-effort TTL
                var resetAt int64
                if ttl, err2 := storeRedis.GetClient().TTL(ctx, redisKey).Result(); err2 == nil && ttl > 0 {
                    resetAt = time.Now().Add(ttl).Unix()
                } else {
                    resetAt = time.Now().Add(window).Unix()
                }
                c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
                c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
                c.Header("X-RateLimit-Reset", strconv.FormatInt(resetAt, 10))
                c.Next()
                return
            }
            // Redis异常时回退
        }
        now := time.Now()
        rateLimiterStore.mu.Lock()
        e, ok := rateLimiterStore.m[key]
        if !ok || now.Sub(e.windowStart) >= window {
            rateLimiterStore.m[key] = &rlEntry{count: 1, windowStart: now}
            rateLimiterStore.mu.Unlock()
            // headers for first request of a window
            c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
            c.Header("X-RateLimit-Remaining", strconv.Itoa(limit-1))
            c.Header("X-RateLimit-Reset", strconv.FormatInt(now.Add(window).Unix(), 10))
            c.Next()
            return
        }
        if e.count >= limit {
            rateLimiterStore.mu.Unlock()
            c.JSON(http.StatusTooManyRequests, gin.H{"code": 429, "message": "Too many requests"})
            c.Abort()
            return
        }
        e.count++
        rateLimiterStore.mu.Unlock()
        // success headers for memory limiter
        remaining := limit - e.count
        if remaining < 0 { remaining = 0 }
        c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
        c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
        c.Header("X-RateLimit-Reset", strconv.FormatInt(e.windowStart.Add(window).Unix(), 10))
        c.Next()
    }
}

// ====== 结构化请求日志 ======
func requestLogger() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        // ensure a request-id exists, and echo back
        rid := c.GetHeader("X-Request-Id")
        if rid == "" {
            rid = fmt.Sprintf("%d-%s", start.UnixNano(), strconv.FormatInt(int64(randInt()), 36))
            c.Request.Header.Set("X-Request-Id", rid)
        }
        c.Next()
        duration := time.Since(start)
        // set Server-Timing: app duration
        if c.Writer.Header().Get("Server-Timing") == "" {
            c.Header("Server-Timing", fmt.Sprintf("app;dur=%.3f", float64(duration.Microseconds())/1000.0))
        }
        // echo request id on response
        c.Header("X-Request-Id", rid)
        uid := c.GetString("user_id")
        entry := map[string]interface{}{
            "ts":         start.Format(time.RFC3339Nano),
            "method":     c.Request.Method,
            "path":       c.Request.URL.Path,
            "status":     c.Writer.Status(),
            "latency_ms": float64(duration.Microseconds()) / 1000.0,
            "ip":         c.ClientIP(),
            "request_id": rid,
        }
        if uid != "" {
            entry["user_id"] = uid
        }
        // feature detection based on path
        path := c.Request.URL.Path
        feature := "unknown"
        if strings.Contains(path, "/siterank") { feature = "siterank" } else
        if strings.Contains(path, "/batchopen") { feature = "batchopen" } else
        if strings.Contains(path, "/console") || strings.Contains(path, "/admin") { feature = "admin" } else
        if strings.Contains(path, "/tokens") { feature = "token" } else
        if strings.Contains(path, "/user") { feature = "user" }
        entry["feature"] = feature
        // optional fields from response headers
        if ch := c.Writer.Header().Get("X-Cache-Hit"); ch != "" { entry["cache_hit"] = ch }
        if tk := c.Writer.Header().Get("X-Tokens-Consumed"); tk != "" { entry["tokens"] = tk }
        if b, err := json.Marshal(entry); err == nil {
            log.Printf("%s", string(b))
        } else {
            log.Printf("%v", entry)
        }
    }
}

// randInt provides a simple pseudo-random int for request id suffix
func randInt() int { return int(time.Now().UnixNano() & 0xffff) }

// setupLegacyAPIRoutes 设置兼容旧API的路由
func setupLegacyAPIRoutes(r *gin.Engine) {
    // 解析内部 JWT（非强制）以便从 Next 反代获取 user_id（用于计费等）
    r.Use(middleware.InternalJWTAuth(false))
    // 保持与现有前端100%兼容的API路径
    r.POST("/api/batchopen/silent-start", handleSilentStart)
	r.GET("/api/batchopen/silent-progress", handleSilentProgress)
	r.POST("/api/batchopen/silent-terminate", handleSilentTerminate)
	r.POST("/api/autoclick/tasks", handleAutoClickCreate)
	r.GET("/api/autoclick/tasks/:id/progress", handleAutoClickProgress)
	r.GET("/api/siterank/rank", handleSiteRank)
	r.POST("/api/chengelink/create", handleChengeLinkCreate)
	r.GET("/api/chengelink/tasks", handleChengeLinkTasks)
}

// setupStaticFiles 设置静态文件服务
func setupStaticFiles(r *gin.Engine) {
    // 管理前端（GoFly Admin Web）托管到 /console
    dist := "./web/dist"
    if _, err := os.Stat(dist); err == nil {
        log.Println("托管管理前端到 /console (web/dist)")
        r.Static("/console/assets", dist+"/assets")
        r.StaticFile("/console", dist+"/index.html")
        r.NoRoute(func(c *gin.Context) {
            p := c.Request.URL.Path
            if strings.HasPrefix(p, "/console") {
                c.File(dist+"/index.html")
                return
            }
            c.JSON(404, gin.H{"message": "not found"})
        })
    } else {
        log.Println("警告：未找到管理前端 web/dist，仅提供API与健康检查")
    }
}

// 中间件和处理器函数（占位符）
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if jwtSvc == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"code": 5000, "message": "auth service unavailable"})
			c.Abort()
			return
		}
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "未提供认证令牌"})
			c.Abort()
			return
		}

		if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "认证令牌格式错误"})
			c.Abort()
			return
		}

		tokenString := authHeader[7:]
		claims, err := jwtSvc.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "令牌无效或已过期"})
			c.Abort()
			return
		}
		// 注入上下文
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

func adminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 简单的BasicAuth管理员认证（从环境变量读取）
		user, pass, ok := c.Request.BasicAuth()
		if !ok {
			c.Header("WWW-Authenticate", `Basic realm="Admin Area"`)
			c.JSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "需要管理员认证"})
			c.Abort()
			return
		}
		adminUser := os.Getenv("ADMIN_USER")
		adminPass := os.Getenv("ADMIN_PASS")
		if adminUser == "" {
			adminUser = "admin"
		}
		if adminPass == "" {
			adminPass = "admin123"
		}
		if user != adminUser || pass != adminPass {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 1001, "message": "管理员认证失败"})
			c.Abort()
			return
		}
		c.Set("admin_username", user)
		c.Next()
	}
}

// API处理器函数（占位符）
func handleGoogleAuth(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Google auth endpoint"})
}

func handleAuthCallback(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Auth callback endpoint"})
}

func handleLogout(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Logout endpoint"})
}

func handleGetProfile(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Get profile endpoint"})
}

func handleUpdateProfile(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Update profile endpoint"})
}

func handleGetUserStats(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Get user stats endpoint"})
}

func handleGetTokenBalance(c *gin.Context) {
	if tokenSvc == nil {
		c.JSON(503, gin.H{"code": 5000, "message": "token service unavailable"})
		return
	}
	userID := c.GetString("user_id")
	bal, err := tokenSvc.GetTokenBalance(userID)
	if err != nil {
		c.JSON(500, gin.H{"code": 5000, "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"code": 0, "message": "ok", "data": gin.H{"balance": bal}})
}

func handleGetTokenTransactions(c *gin.Context) {
	if tokenSvc == nil {
		c.JSON(503, gin.H{"code": 5000, "message": "token service unavailable"})
		return
	}
	userID := c.GetString("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	txs, total, err := tokenSvc.GetTokenTransactions(userID, page, size)
	if err != nil {
		c.JSON(500, gin.H{"code": 5000, "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"code": 0, "message": "ok", "data": gin.H{"transactions": txs, "total": total, "page": page, "size": size}})
}

func handlePurchaseTokens(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Purchase tokens endpoint"})
}

func handleSilentStart(c *gin.Context) {
	if batchService == nil || gormDB == nil {
		c.JSON(503, gin.H{"success": false, "message": "service unavailable"})
		return
	}
	// 审计
	auditLog("batch_silent_start", map[string]interface{}{"user_id": c.GetString("user_id")})
	ctrl := batchgo.NewController(batchService, gormDB)
	ctrl.SilentStart(c)
}

func handleSilentProgress(c *gin.Context) {
	if batchService == nil {
		c.JSON(503, gin.H{"success": false, "message": "service unavailable"})
		return
	}
	// 兼容 taskId / task_id 参数
	taskID := c.Query("task_id")
	if taskID == "" {
		taskID = c.Query("taskId")
	}
	if taskID == "" {
		c.JSON(200, gin.H{"success": false, "message": "缺少taskId"})
		return
	}
	// 允许未认证访问旧接口，使用匿名用户
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
		if userID == "" {
			userID = "anonymous"
		}
	}
    task, err := batchService.GetTask(userID, taskID)
    if err != nil {
        // 尝试从三表聚合落地读取进度（兼容新模型）
        if gormDB != nil {
            prog, e2 := batchgo.NewDAO(gormDB).AggregateProgress(taskID)
            if e2 == nil {
                percentage := 0.0
                total := prog.Total
                processed := prog.Success + prog.Fail
                if total > 0 { percentage = float64(processed) / float64(total) * 100 }
                c.JSON(200, gin.H{"success": true, "task_id": taskID, "status": "running", "processed": processed, "total": total, "percentage": percentage})
                return
            }
        }
        c.JSON(200, gin.H{"success": false, "message": "任务不存在"})
        return
    }
	processed := task.ProcessedCount
	total := task.URLCount
	percentage := 0.0
	if total > 0 {
		percentage = float64(processed) / float64(total) * 100
	}
	c.JSON(200, gin.H{
		"success":    true,
		"task_id":    task.ID,
		"status":     task.Status,
		"processed":  processed,
		"total":      total,
		"percentage": percentage,
	})
}

func handleSilentTerminate(c *gin.Context) {
	if gormDB == nil {
		c.JSON(503, gin.H{"success": false, "message": "service unavailable"})
		return
	}
	var req struct {
		TaskID string `json:"taskId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.TaskID == "" {
		c.JSON(200, gin.H{"success": false, "message": "参数错误"})
		return
	}
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
		if userID == "" {
			userID = "anonymous"
		}
	}
	// 将任务标记为取消
	if err := gormDB.Model(&batchgo.BatchTask{}).Where("id = ? AND user_id = ?", req.TaskID, userID).
		Updates(map[string]interface{}{"status": batchgo.StatusCancelled, "updated_at": time.Now()}).Error; err != nil {
		c.JSON(200, gin.H{"success": false, "message": "终止失败"})
		return
	}
	// 审计
	auditLog("batch_silent_terminate", map[string]interface{}{"user_id": userID, "task_id": req.TaskID})
	c.JSON(200, gin.H{"success": true, "message": "任务已终止"})
}

func handleAutoClickCreate(c *gin.Context) {
	c.JSON(200, gin.H{"message": "AutoClick create endpoint"})
}

func handleAutoClickProgress(c *gin.Context) {
	c.JSON(200, gin.H{"message": "AutoClick progress endpoint"})
}

func handleSiteRank(c *gin.Context) {
    if swebClient == nil {
        c.JSON(503, gin.H{"success": false, "message": "service unavailable"})
        return
    }
    domain := c.Query("domain")
    if domain == "" {
        c.JSON(200, gin.H{"success": false, "message": "缺少domain参数"})
        return
    }
    userID := c.GetString("user_id")
    if userID == "" {
        userID = c.GetHeader("X-User-Id")
        if userID == "" {
            userID = "anonymous"
        }
    }
    // 若有用户身份，则进行预检与扣费（单域名=1）
    if userID != "anonymous" && tokenSvc != nil {
        sufficient, balance, required, err := tokenSvc.CheckTokenSufficiency(userID, "siterank", "query", 1)
        if err != nil {
            c.JSON(500, gin.H{"success": false, "message": err.Error()})
            return
        }
        if !sufficient {
            c.JSON(402, gin.H{"success": false, "message": "INSUFFICIENT_TOKENS", "required": required, "balance": balance})
            return
        }
        // 预先扣费（若失败再尝试退款）
        if err := tokenSvc.ConsumeTokensByService(userID, "siterank", "query", 1, "siterank.single"); err != nil {
            c.JSON(402, gin.H{"success": false, "message": err.Error(), "required": required, "balance": balance})
            return
        }
        // 输出提示头（非契约）
        c.Header("X-Tokens-Consumed", "1")
    }
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    data, err := swebClient.GetWebsiteData(ctx, userID, &siterankgo.SimilarWebRequest{Domain: domain, Country: "global", Granularity: "monthly"})
    if err != nil {
        // 失败时尝试退款（best-effort）
        if userID != "anonymous" && tokenSvc != nil {
            _ = tokenSvc.AddTokens(userID, 1, "refund", "siterank single failed", "")
        }
        c.JSON(200, gin.H{"success": false, "message": err.Error()})
        return
    }
	// 组装兼容响应
	resp := gin.H{
		"globalRank":     data.GlobalRank,
		"category":       data.Category,
		"categoryRank":   data.CategoryRank,
		"country":        data.Country,
		"monthlyVisits":  siterankgo.FormatVisits(data.Visits),
		"pagesPerVisit":  data.PagePerVisit,
		"bounceRate":     data.BounceRate,
		"avgDuration":    data.VisitDuration,
		"trafficSources": data.TrafficSources,
		"topCountries":   data.TopCountries,
		"lastUpdated":    data.LastUpdated,
	}
    // 如果进行了扣费，返回余额提示头
    if userID != "anonymous" && tokenSvc != nil {
        if newBal, e := tokenSvc.GetTokenBalance(userID); e == nil {
            c.Header("X-Tokens-Balance", fmt.Sprintf("%d", newBal))
        }
    }
    c.JSON(200, gin.H{
        "success":       true,
        "data":          resp,
        "fromCache":     false,
        "rateLimitInfo": swebClient.GetRateLimitStats(),
    })
}

func handleBatchSiteRank(c *gin.Context) {
	if swebClient == nil || gormDB == nil {
		c.JSON(503, gin.H{"success": false, "message": "service unavailable"})
		return
	}
	var req struct {
		Domains []string `json:"domains"`
		Force   bool     `json:"force"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Domains) == 0 {
		c.JSON(200, gin.H{"success": false, "message": "参数错误，需提供domains数组"})
		return
	}
	userID := c.GetString("user_id")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
		if userID == "" {
			userID = "anonymous"
		}
	}

	type item struct {
		Domain        string      `json:"domain"`
		GlobalRank    *int        `json:"globalRank"`
		MonthlyVisits float64     `json:"monthlyVisits"`
		Priority      string      `json:"priority"`
		FromCache     bool        `json:"fromCache"`
		Data          interface{} `json:"data,omitempty"`
		Error         string      `json:"error,omitempty"`
	}

	results := make([]item, 0, len(req.Domains))
	for _, d := range req.Domains {
		domain := d
		// 1. 读取缓存
		cached, ok, err := getCachedSiteRank(domain, userID)
		if err == nil && ok && !req.Force {
			results = append(results, item{
				Domain:        domain,
				GlobalRank:    cached.GlobalRank,
				MonthlyVisits: cached.MonthlyVisits,
				Priority:      cached.Priority,
				FromCache:     true,
			})
			continue
		}

		// 2. 请求 SimilarWeb
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		resp, err := swebClient.GetWebsiteData(ctx, userID, &siterankgo.SimilarWebRequest{Domain: domain, Country: "global", Granularity: "monthly"})
		cancel()
		if err != nil {
			// 更新失败缓存（1小时）
			_ = upsertSiteRank(domain, userID, nil, err)
			results = append(results, item{Domain: domain, FromCache: false, Error: err.Error(), Priority: "Low"})
			continue
		}
		visits := siterankgo.FormatVisits(resp.Visits)
		priority := computePriority(resp.GlobalRank, visits)
		// 更新成功缓存（7天）
		_ = upsertSiteRank(domain, userID, resp, nil)
		results = append(results, item{Domain: domain, GlobalRank: resp.GlobalRank, MonthlyVisits: visits, Priority: priority, FromCache: false})
	}

	c.JSON(200, gin.H{"success": true, "results": results, "count": len(results)})
}

// 缓存读取
type cachedSR struct {
	GlobalRank    *int
	MonthlyVisits float64
	Priority      string
}

func getCachedSiteRank(domain, userID string) (*cachedSR, bool, error) {
	if gormDB == nil {
		return nil, false, fmt.Errorf("db unavailable")
	}
	type row struct {
		GlobalRank *int
		Visits     *float64
		Priority   *string
		CacheUntil *time.Time
		Status     *string
	}
	var r row
	err := gormDB.Table("siterank_queries").
		Select("global_rank, visits, priority, cache_until, status").
		Where("user_id = ? AND domain = ? AND source = ?", userID, domain, "similarweb").
		Take(&r).Error
	if err != nil {
		return nil, false, err
	}
	if r.CacheUntil == nil || time.Now().After(*r.CacheUntil) {
		return nil, false, nil
	}
	pri := "Low"
	if r.Priority != nil && *r.Priority != "" {
		pri = *r.Priority
	}
	visits := 0.0
	if r.Visits != nil {
		visits = *r.Visits
	}
	return &cachedSR{GlobalRank: r.GlobalRank, MonthlyVisits: visits, Priority: pri}, true, nil
}

// 缓存写入/更新
func upsertSiteRank(domain, userID string, data *siterankgo.SimilarWebResponse, fetchErr error) error {
	if gormDB == nil {
		return fmt.Errorf("db unavailable")
	}
	ttl := time.Hour
	status := "failed"
	var globalRank *int
	var visits *float64
	priority := "Low"
	if fetchErr == nil && data != nil {
		status = "completed"
		ttl = 7 * 24 * time.Hour
		globalRank = data.GlobalRank
		v := siterankgo.FormatVisits(data.Visits)
		visits = &v
		priority = computePriority(globalRank, v)
	}
	// upsert by unique key (user_id, domain, source)
	now := time.Now()
	cacheUntil := now.Add(ttl)
	// Try update
	res := gormDB.Exec(
		"UPDATE siterank_queries SET status=?, global_rank=?, visits=?, priority=?, cache_until=?, updated_at=?, request_count=IFNULL(request_count,0)+1 WHERE user_id=? AND domain=? AND source=?",
		status, globalRank, visits, priority, cacheUntil, now, userID, domain, "similarweb",
	)
	if res.RowsAffected == 0 {
		// Insert
		return gormDB.Exec(
			"INSERT INTO siterank_queries (id, user_id, domain, status, source, global_rank, visits, priority, cache_until, request_count, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
			fmt.Sprintf("%d", time.Now().UnixNano()), userID, domain, status, "similarweb", globalRank, visits, priority, cacheUntil, 1, now, now,
		).Error
	}
	return res.Error
}

func computePriority(globalRank *int, visits float64) string {
	if globalRank != nil {
		if *globalRank > 0 && *globalRank <= 100000 {
			return "High"
		}
		if *globalRank <= 1000000 {
			return "Medium"
		}
	}
	if visits >= 1_000_000 {
		return "High"
	}
	if visits >= 100_000 {
		return "Medium"
	}
	return "Low"
}

func handleChengeLinkCreate(c *gin.Context) {
	if chengelinkService == nil {
		c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
		return
	}
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(200, gin.H{"code": 3001, "message": "用户未认证"})
		return
	}
	var req chengelink.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(200, gin.H{"code": 1001, "message": "参数错误: " + err.Error()})
		return
	}
	task, err := chengelinkService.CreateTask(userID, &req)
	if err != nil {
		c.JSON(200, gin.H{"code": 2001, "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"code": 0, "message": "任务创建成功", "data": task})
}

func handleChengeLinkTasks(c *gin.Context) {
	if chengelinkService == nil {
		c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
		return
	}
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(200, gin.H{"code": 3001, "message": "用户未认证"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	tasks, total, err := chengelinkService.GetUserTasks(userID, page, size)
	if err != nil {
		c.JSON(200, gin.H{"code": 2004, "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"code": 0, "message": "获取成功", "data": gin.H{"tasks": tasks, "pagination": gin.H{"page": page, "size": size, "total": total, "pages": (total + int64(size) - 1) / int64(size)}}})
}

func handleChengeLinkTask(c *gin.Context) {
	c.JSON(200, gin.H{"message": "ChengeLink task endpoint"})
}

func handleGetInvitationInfo(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Get invitation info endpoint"})
}

func handleGenerateInviteLink(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Generate invite link endpoint"})
}

func handleGetInvitationHistory(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Get invitation history endpoint"})
}

func handleGetCheckinInfo(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Get checkin info endpoint"})
}

func handlePerformCheckin(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Perform checkin endpoint"})
}

func handleGetCheckinHistory(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Get checkin history endpoint"})
}

func handleWebSocket(c *gin.Context) {
	// 使用与API相同的认证方式
	if jwtSvc == nil || wsManager == nil {
		c.JSON(503, gin.H{"message": "service unavailable"})
		return
	}
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "未提供认证令牌"})
		return
	}
	tokenString := authHeader[7:]
	claims, err := jwtSvc.ValidateToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "令牌无效或已过期"})
		return
	}
	// 注入上下文后交给管理器
	c.Set("user_id", claims.UserID)
	wsManager.HandleWebSocket(c)
}

func handleAdminGetUsers(c *gin.Context) {
	if gormDB == nil {
		c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}
	offset := (page - 1) * size
	var total int64
	if err := gormDB.Table("users").Count(&total).Error; err != nil {
		c.JSON(500, gin.H{"code": 5000, "message": err.Error()})
		return
	}
	rows := []map[string]interface{}{}
	if err := gormDB.Table("users").Select("id,email,username,role,status,token_balance,plan_name,plan_expires_at,created_at").
		Offset(offset).Limit(size).Order("created_at DESC").Find(&rows).Error; err != nil {
		c.JSON(500, gin.H{"code": 5000, "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"code": 0, "message": "ok", "data": gin.H{"users": rows, "total": total, "page": page, "size": size}})
}

func handleAdminUpdateUser(c *gin.Context) {
	if gormDB == nil || tokenSvc == nil {
		c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
		return
	}
	userID := c.Param("id")
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"code": 1001, "message": "参数错误"})
		return
	}
	updates := map[string]interface{}{}
	if v, ok := body["status"].(string); ok && v != "" {
		updates["status"] = v
	}
	if v, ok := body["plan_name"].(string); ok && v != "" {
		updates["plan_name"] = v
	}
	if v, ok := body["plan_expires_at"].(string); ok && v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			updates["plan_expires_at"] = t
		}
	}
	// 先更新字段
	if len(updates) > 0 {
		if err := gormDB.Table("users").Where("id = ?", userID).Updates(updates).Error; err != nil {
			c.JSON(500, gin.H{"code": 5000, "message": err.Error()})
			return
		}
		auditLog("admin_update_user", map[string]interface{}{"admin": c.GetString("admin_username"), "user_id": userID, "updates": updates})
	}
	// 调整Token
	if adj, ok := body["adjust_token"].(map[string]interface{}); ok {
		amount := 0
		if a, ok2 := adj["amount"].(float64); ok2 {
			amount = int(a)
		}
		if amount != 0 {
			desc := "管理员调整"
			if d, ok3 := adj["description"].(string); ok3 && d != "" {
				desc = d
			}
			ttype := "admin_adjust"
			if err := tokenSvc.AddTokens(userID, amount, ttype, desc, ""); err != nil {
				c.JSON(500, gin.H{"code": 5000, "message": err.Error()})
				return
			}
			auditLog("admin_adjust_token", map[string]interface{}{"admin": c.GetString("admin_username"), "user_id": userID, "amount": amount, "desc": desc})
		}
	}
	c.JSON(200, gin.H{"code": 0, "message": "更新成功"})
}

// 审计日志
func auditLog(action string, fields map[string]interface{}) {
	entry := map[string]interface{}{
		"audit":  true,
		"action": action,
		"ts":     time.Now().Format(time.RFC3339Nano),
	}
	for k, v := range fields {
		entry[k] = v
	}
	if b, err := json.Marshal(entry); err == nil {
		log.Printf("%s", string(b))
	} else {
		log.Printf("%v", entry)
	}
}

func handleAdminGetStats(c *gin.Context) {
	if gormDB == nil {
		c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"})
		return
	}
	var userCount int64
	var batchCount int64
	var siterankCount int64
	var totalTokens int64
	_ = gormDB.Table("users").Count(&userCount).Error
	_ = gormDB.Table("batch_tasks").Count(&batchCount).Error
	_ = gormDB.Table("siterank_queries").Count(&siterankCount).Error
	_ = gormDB.Table("users").Select("SUM(token_balance)").Scan(&totalTokens).Error
	c.JSON(200, gin.H{"code": 0, "message": "ok", "data": gin.H{
		"users": userCount, "batch_tasks": batchCount, "siterank_queries": siterankCount, "total_tokens": totalTokens,
	}})
}

func handleAdminDashboard(c *gin.Context) {
	// 暂时复用 stats 输出
	handleAdminGetStats(c)
}
