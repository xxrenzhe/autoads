package main

import (
    "bytes"
    "crypto/sha1"
    "crypto/sha256"
    "context"
    "encoding/json"
    "flag"
    "fmt"
    "log"
    "net"
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
	app "gofly-admin-v3/internal/app"
	"gofly-admin-v3/internal/batchgo"
	"gofly-admin-v3/internal/audit"
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/internal/checkin"
    adscenter "gofly-admin-v3/internal/adscenter"
	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/internal/docs"
    "gofly-admin-v3/internal/health"
    "gofly-admin-v3/internal/system"
	dbinit "gofly-admin-v3/internal/init"
	"gofly-admin-v3/internal/invitation"
    "gofly-admin-v3/internal/metrics"
    "gofly-admin-v3/internal/middleware"
    "gofly-admin-v3/internal/siterankgo"
    "gofly-admin-v3/internal/adscentergo"
    "gofly-admin-v3/internal/autoclick"
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

// AdsCenter v2 绑定/轮换最小模型（用于功能闭环）
type AdsOffer struct {
    ID        string    `json:"id" gorm:"primaryKey;size:36"`
    UserID    string    `json:"userId" gorm:"index;size:36"`
    OfferURL  string    `json:"offerUrl" gorm:"size:1000"`
    Status    string    `json:"status" gorm:"size:20;default:'active'"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}
func (AdsOffer) TableName() string { return "ads_offers" }

type AdsOfferBinding struct {
    ID               string     `json:"id" gorm:"primaryKey;size:36"`
    OfferID          string     `json:"offerId" gorm:"index;size:36"`
    UserID           string     `json:"userId" gorm:"index;size:36"`
    AccountID        string     `json:"accountId" gorm:"size:255"`
    RotationFrequency string    `json:"rotationFrequency" gorm:"size:20"` // hourly/daily/weekly
    RotationAt       *string    `json:"rotationAt" gorm:"size:5"`        // HH:mm
    UniqueWindowDays int        `json:"uniqueWindowDays" gorm:"default:90"`
    Active           bool       `json:"active" gorm:"default:true"`
    LastRotationAt   *time.Time `json:"lastRotationAt"`
    NextRotationAt   *time.Time `json:"nextRotationAt"`
    CreatedAt        time.Time  `json:"createdAt"`
    UpdatedAt        time.Time  `json:"updatedAt"`
}
func (AdsOfferBinding) TableName() string { return "ads_offer_bindings" }

type AdsOfferRotation struct {
    ID            string    `json:"id" gorm:"primaryKey;size:36"`
    BindingID     string    `json:"bindingId" gorm:"index;size:36"`
    AccountID     string    `json:"accountId" gorm:"size:255"`
    RotatedAt     time.Time `json:"rotatedAt"`
    FinalURL      string    `json:"finalUrl" gorm:"size:1000"`
    FinalURLSuffix string   `json:"finalUrlSuffix" gorm:"size:1000"`
    FinalHash     string    `json:"finalHash" gorm:"size:64;index"`
    Status        string    `json:"status" gorm:"size:20"`
    Message       string    `json:"message" gorm:"type:text"`
}
func (AdsOfferRotation) TableName() string { return "ads_offer_rotations" }

// AdsMetricsDaily 每日指标聚合（Google Ads 指标落库）
type AdsMetricsDaily struct {
    ID              uint      `json:"id" gorm:"primaryKey;autoIncrement"`
    UserID          string    `json:"userId" gorm:"index;size:36"`
    AccountID       string    `json:"accountId" gorm:"index;size:255"`
    Date            string    `json:"date" gorm:"type:date;index"`
    CampaignID      string    `json:"campaignId" gorm:"size:64;index"`
    AdGroupID       string    `json:"adGroupId" gorm:"size:64;index"`
    Device          string    `json:"device" gorm:"size:32"`
    Network         string    `json:"network" gorm:"size:32"`
    Clicks          int64     `json:"clicks"`
    Impressions     int64     `json:"impressions"`
    CostMicros      int64     `json:"costMicros"`
    Conversions     int64     `json:"conversions"`
    ConvValueMicros int64     `json:"convValueMicros"`
    VTC             int64     `json:"vtc"`
    CreatedAt       time.Time `json:"createdAt"`
    UpdatedAt       time.Time `json:"updatedAt"`
}

func (AdsMetricsDaily) TableName() string { return "ads_metrics_daily" }

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
    adscenterService *adscenter.AdsCenterService
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

    // 适配器：将 user.TokenService 适配为 AdsCenter.TokenService
type tokenServiceAdapter struct{ ts *user.TokenService }

func (a *tokenServiceAdapter) ConsumeTokens(userID string, amount int, description string) error {
    return a.ts.ConsumeTokens(userID, amount, description, "")
}
func (a *tokenServiceAdapter) GetBalance(userID string) (int, error) {
    return a.ts.GetTokenBalance(userID)
}
    // 满足 adscenter.TokenService 接口
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
    // 优先从环境变量 PORT 推导默认端口（与部署/前端 BFF 保持一致，推荐 8080）
    defPort := "8080"
    if v := os.Getenv("PORT"); strings.TrimSpace(v) != "" { defPort = strings.TrimSpace(v) }
    var (
        configPath = flag.String("config", "config.yaml", "配置文件路径")
        initDB     = flag.Bool("init-db", false, "是否初始化数据库")
        forceInit  = flag.Bool("force-init", false, "强制初始化数据库（会清空现有数据）")
        migrate    = flag.Bool("migrate", false, "(已废弃) 执行数据库迁移 - 由 Prisma 接管")
        version    = flag.Bool("version", false, "显示版本信息")
        port       = flag.String("port", defPort, "服务端口")
        host       = flag.String("host", "0.0.0.0", "服务主机")
    )
    flag.Parse()
    // keep deprecated flag referenced to avoid unused var during build
    _ = migrate

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
    if *initDB || *forceInit {
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
        // 默认：继续后续流程。
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
    var cfg2 *config.Config
    if c, err := config.LoadFromPath(*configPath); err != nil {
        log.Printf("⚠️  加载配置失败（路径=%s），尝试使用环境变量: %v", *configPath, err)
        if ce, err2 := config.LoadFromEnv(); err2 != nil {
            log.Printf("⚠️  基于环境变量构建配置失败，无法初始化数据库: %v", err2)
        } else {
            cfg2 = ce
        }
    } else {
        cfg2 = c
    }
    if cfg2 != nil {
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
            // 设置全局默认 DB 供内部包（如定时任务）使用
            store.SetDefaultGormDB(gormDB)
            log.Println("✅ 数据库连接成功")

			// Redis
			if r, err := store.NewRedis(&cfg2.Redis); err != nil {
				log.Fatalf("Redis 初始化失败（为必选项）: %v", err)
			} else {
                storeRedis = r
                // 设置全局默认 Redis 供内部包使用
                store.SetDefaultRedis(storeRedis)
                if storeRedis == nil {
					log.Fatalf("Redis 未启用（为必选项），请在配置中开启 redis.enable 并正确配置连接")
				}
				log.Println("✅ Redis 初始化成功")
			}

            // -migrate 已废弃：迁移由 Prisma 统一管理

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
            // 注入 Token 服务到 AutoClick 模块（用于扣费/退款）
            autoclick.SetTokenService(tokenSvc)

            // BatchGo 服务（注入 Redis 以共享 BadURL 标记）
            batchService = batchgo.NewService(gormDB, tokenSvc, wsManager, auditSvc, storeRedis)

            // 移除启动期 AutoMigrate：DDL 统一由 Prisma 迁移管理

            // 初始化 PoolManager 并发（从 automation.* 读取，fallback 旧键）
            httpConc := 10
            brConc := 3
            if v, ok := system.Get("automation.http_concurrency"); ok { if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 { httpConc = n } }
            if v, ok := system.Get("automation.browser_concurrency"); ok { if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 { brConc = n } }
            // 兼容旧键
            if httpConc == 10 { if v, ok := system.Get("AutoClick_HTTP_Concurrency"); ok { if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 { httpConc = n } } }
            if brConc == 3 { if v, ok := system.Get("AutoClick_Browser_Concurrency"); ok { if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 { brConc = n } } }
            autoclick.GetPoolManager().Ensure(httpConc, brConc)
            // 订阅热更新
            system.On("automation.http_concurrency", func(key, value string) {
                if n, err := strconv.Atoi(strings.TrimSpace(value)); err == nil && n > 0 {
                    st := autoclick.GetPoolManager().State()
                    autoclick.GetPoolManager().Ensure(n, st.BrowserWorkers)
                    log.Printf("[automation] http_concurrency -> %d", n)
                }
            })
            system.On("automation.browser_concurrency", func(key, value string) {
                if n, err := strconv.Atoi(strings.TrimSpace(value)); err == nil && n > 0 {
                    st := autoclick.GetPoolManager().State()
                    autoclick.GetPoolManager().Ensure(st.HTTPWorkers, n)
                    log.Printf("[automation] browser_concurrency -> %d", n)
                }
            })

			// SiteRank SimilarWeb 客户端
			swebClient = siterankgo.NewSimilarWebClient()

            // AdsCenter 服务（使用适配器桥接Token能力）
            adscenterService = adscenter.NewAdsCenterService(gormDB, &tokenServiceAdapter{ts: tokenSvc})

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
    // 注册 AdsCenter 自动轮换任务（每5分钟）
    _ = sch.AddJob(&scheduler.CronJob{ Job: &AdsRotateJob{}, Schedule: "0 */5 * * * *", Enabled: true, Description: "AdsCenter auto rotate", Timeout: 20 * time.Second })
    // 注册 AdsCenter 指标采集（每小时第1分钟）
    _ = sch.AddJob(&scheduler.CronJob{ Job: &AdsMetricsCollectorJob{}, Schedule: "0 1 * * * *", Enabled: true, Description: "AdsCenter metrics hourly collect", Timeout: 4 * time.Minute })
    // 注册 AutoClick 调度任务（每分钟tick）
    // 注入 RateLimit provider（plan-based），rpm 使用 BatchTasksPerMinute，concurrent 使用 BatchConcurrentTasks
    if rateLimitManager != nil {
        autoclick.SetRateLimitProvider(func(userID string) (int, int) {
            conc := rateLimitManager.GetBatchConcurrentLimit(userID)
            // 读取计划每分钟任务上限
            // 通过 plan limits 快速获取（不需要用户级状态）
            planLimits := rateLimitManager.GetPlanLimits()
            info, _ := (&simpleUserSvc{}).GetUserByID(userID)
            plan := info.Plan
            if plan == "" { plan = info.PlanName }
            rpm := 0
            if pl, ok := planLimits[plan]; ok { rpm = pl.BatchTasksPerMinute }
            return rpm, conc
        })
    }
    autoclick.RegisterAutoClickJob()
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
		r.GET("/readyz", gin.WrapH(healthChecker.ReadyHandler())) // 兼容 K8s 常用探针路径
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

    // 13. 启动服务器（显式绑定端口，便于排查监听问题）
    addr := fmt.Sprintf("%s:%s", *host, *port)
    srv := &http.Server{
        Addr:         addr,
        Handler:      r,
        ReadTimeout:  30 * time.Second,
        WriteTimeout: 30 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    // 显式监听，若绑定失败立即退出并打印原因
    ln, err := net.Listen("tcp", addr)
    if err != nil {
        log.Fatalf("服务器端口绑定失败 (%s): %v", addr, err)
    }
    log.Printf("🌐 正在监听 http://%s", ln.Addr().String())

    // 在 goroutine 中开始服务
    go func() {
        if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
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

        // ===== 基于套餐的 API 限流（按功能分组） =====
        // 根据 RateLimitManager 的套餐配置，生成 /siterank 与 /batchopen 的计划速率
        var planResolver = func(c *gin.Context) string {
            if rateLimitManager == nil { return "FREE" }
            uid := c.GetString("user_id")
            if uid == "" { return "FREE" }
            if us := rateLimitManager.GetUserService(); us != nil {
                if info, err := us.GetUserByID(uid); err == nil && info != nil {
                    if info.PlanName != "" { return info.PlanName }
                    if info.Plan != "" { return info.Plan }
                }
            }
            return "FREE"
        }
        var siteRankPlanLimiter gin.HandlerFunc
        var batchOpenPlanLimiter gin.HandlerFunc
        if rateLimitManager != nil {
            // 构造计划速率映射（RPS）
            pl := rateLimitManager.GetPlanLimits()
            sRates := map[string]middleware.PlanRateConfig{}
            bRates := map[string]middleware.PlanRateConfig{}
            for name, lim := range pl {
                sRps := float64(lim.SiteRankRequestsPerMinute) / 60.0
                if sRps < 0 { sRps = 0 }
                bRps := float64(lim.BatchTasksPerMinute) / 60.0
                if bRps < 0 { bRps = 0 }
                sRates[name] = middleware.PlanRateConfig{ RPS: sRps, Burst: lim.SiteRankRequestsPerMinute }
                bRates[name] = middleware.PlanRateConfig{ RPS: bRps, Burst: lim.BatchTasksPerMinute }
            }
            var redisClient *redisv8.Client
            if storeRedis != nil { redisClient = storeRedis.GetClient() }
            rlConf := middleware.DefaultRateLimitConfig
            rlConf.Window = time.Minute
            // 为 SiteRank 生成中间件
            srl := middleware.NewRateLimitMiddleware(rlConf, redisClient)
            srl.SetPlanRates(sRates, redisClient)
            siteRankPlanLimiter = srl.PlanAPIRateLimit(planResolver)
            // 为 BatchOpen 生成中间件
            brl := middleware.NewRateLimitMiddleware(rlConf, redisClient)
            brl.SetPlanRates(bRates, redisClient)
            batchOpenPlanLimiter = brl.PlanAPIRateLimit(planResolver)
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

            // 邀请与签到管理（列表/统计/排行榜）
            admin.RegisterInvitationRoutes(console)
            admin.RegisterCheckinAdminRoutes(console)

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

            // AutoClick 最近N天统计（默认30天）
            console.GET("/autoclick/history", func(c *gin.Context) {
                days := gf.IntDefault(strings.TrimSpace(c.DefaultQuery("days", "30")), 30)
                if days <= 0 || days > 90 { days = 30 }
                q := gormDB.Model(&autoclick.AutoClickExecution{})
                if uid := strings.TrimSpace(c.Query("userId")); uid != "" { q = q.Where("user_id = ?", uid) }
                if sid := strings.TrimSpace(c.Query("scheduleId")); sid != "" { q = q.Where("schedule_id = ?", sid) }
                // 按 date 分组聚合
                type row struct { Date string; Total int64; Success int64; Fail int64 }
                var out []row
                if err := q.Select("date, SUM(total) as total, SUM(success) as success, SUM(fail) as fail").
                    Where("STR_TO_DATE(date, '%Y-%m-%d') >= DATE_SUB(CURDATE(), INTERVAL ? DAY)", days).
                    Group("date").Order("date ASC").Find(&out).Error; err != nil {
                    c.JSON(500, gin.H{"code":5000, "message": err.Error()}); return
                }
                c.JSON(200, gin.H{"code":0, "data": out})
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

            // AutoClick 问题 URL 面板接口
            console.GET("/autoclick/url-failures", func(c *gin.Context) {
                // 过滤与分页
                page := gf.IntDefault(c.DefaultQuery("page", "1"), 1)
                limit := gf.IntDefault(c.DefaultQuery("limit", "20"), 20)
                if page <= 0 { page = 1 }
                if limit <= 0 || limit > 200 { limit = 20 }
                offset := (page - 1) * limit

                q := gormDB.Model(&autoclick.AutoClickURLFailure{})
                if uid := strings.TrimSpace(c.Query("userId")); uid != "" { q = q.Where("user_id = ?", uid) }
                if kw := strings.TrimSpace(c.Query("q")); kw != "" { like := "%" + kw + "%"; q = q.Where("url LIKE ?", like) }
                var total int64
                _ = q.Count(&total).Error
                var rows []autoclick.AutoClickURLFailure
                if err := q.Order("updated_at DESC").Offset(offset).Limit(limit).Find(&rows).Error; err != nil {
                    c.JSON(500, gin.H{"code":5000, "message": err.Error()}); return
                }
                c.JSON(200, gin.H{"code":0, "data": rows, "pagination": gin.H{"page": page, "limit": limit, "total": total}})
            })

            console.DELETE("/autoclick/url-failures/:id", func(c *gin.Context) {
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"code":1001, "message":"id required"}); return }
                if err := gormDB.Where("id = ?", id).Delete(&autoclick.AutoClickURLFailure{}).Error; err != nil { c.JSON(500, gin.H{"code":5000, "message": err.Error()}); return }
                c.JSON(200, gin.H{"code":0, "message":"deleted"})
            })

            console.POST("/autoclick/url-failures/:id/prefer_browser", func(c *gin.Context) {
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"code":1001, "message":"id required"}); return }
                var row autoclick.AutoClickURLFailure
                if err := gormDB.Where("id = ?", id).First(&row).Error; err != nil { c.JSON(404, gin.H{"code":404, "message": "not found"}); return }
                // 设置 prefer_browser 标记 7d
                if storeRedis != nil {
                    key := fmt.Sprintf("autoads:ac:prefer_browser:%s:%s", row.UserID, row.URLHash)
                    _ = storeRedis.Set(c.Request.Context(), key, "1", 7*24*time.Hour)
                }
                // 更新 DB 字段以便前端展示
                until := time.Now().Add(7 * 24 * time.Hour)
                _ = gormDB.Model(&autoclick.AutoClickURLFailure{}).Where("id=?", id).Updates(map[string]interface{}{"prefer_browser_until": until, "updated_at": time.Now()}).Error
                c.JSON(200, gin.H{"code":0, "message":"ok"})
            })

            console.POST("/autoclick/url-failures/:id/reset_counters", func(c *gin.Context) {
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"code":1001, "message":"id required"}); return }
                var row autoclick.AutoClickURLFailure
                if err := gormDB.Where("id = ?", id).First(&row).Error; err != nil { c.JSON(404, gin.H{"code":404, "message": "not found"}); return }
                if err := gormDB.Model(&autoclick.AutoClickURLFailure{}).Where("id=?", id).Updates(map[string]interface{}{"http_fail_consecutive": 0, "browser_fail_consecutive": 0, "updated_at": time.Now()}).Error; err != nil {
                    c.JSON(500, gin.H{"code":5000, "message": err.Error()}); return
                }
                // 同步清理 Redis 计数键
                if storeRedis != nil {
                    ctx := c.Request.Context()
                    _ = storeRedis.Del(ctx, fmt.Sprintf("autoads:ac:fail:http:%s:%s", row.UserID, row.URLHash))
                    _ = storeRedis.Del(ctx, fmt.Sprintf("autoads:ac:fail:browser:%s:%s", row.UserID, row.URLHash))
                }
                c.JSON(200, gin.H{"code":0, "message":"reset"})
            })

            // 批量操作：prefer/reset/delete
            console.POST("/autoclick/url-failures/batch", func(c *gin.Context) {
                var body struct {
                    IDs []string `json:"ids"`
                    Op  string   `json:"op"`
                }
                if err := c.ShouldBindJSON(&body); err != nil || len(body.IDs) == 0 || body.Op == "" {
                    c.JSON(400, gin.H{"code":1001, "message":"invalid body"}); return
                }
                op := strings.ToLower(strings.TrimSpace(body.Op))
                switch op {
                case "prefer":
                    if storeRedis == nil { c.JSON(503, gin.H{"code":5000, "message":"redis unavailable"}); return }
                    var rows []autoclick.AutoClickURLFailure
                    _ = gormDB.Where("id IN ?", body.IDs).Find(&rows).Error
                    for _, r := range rows {
                        key := fmt.Sprintf("autoads:ac:prefer_browser:%s:%s", r.UserID, r.URLHash)
                        _ = storeRedis.Set(c.Request.Context(), key, "1", 7*24*time.Hour)
                    }
                    _ = gormDB.Model(&autoclick.AutoClickURLFailure{}).Where("id IN ?", body.IDs).Updates(map[string]interface{}{"prefer_browser_until": time.Now().Add(7*24*time.Hour), "updated_at": time.Now()}).Error
                    c.JSON(200, gin.H{"code":0, "message":"ok", "count": len(rows)})
                case "reset":
                    if err := gormDB.Model(&autoclick.AutoClickURLFailure{}).Where("id IN ?", body.IDs).Updates(map[string]interface{}{"http_fail_consecutive": 0, "browser_fail_consecutive": 0, "updated_at": time.Now()}).Error; err != nil {
                        c.JSON(500, gin.H{"code":5000, "message": err.Error()}); return
                    }
                    if storeRedis != nil {
                        var rows []autoclick.AutoClickURLFailure
                        _ = gormDB.Where("id IN ?", body.IDs).Find(&rows).Error
                        ctx := c.Request.Context()
                        for _, r := range rows {
                            _ = storeRedis.Del(ctx, fmt.Sprintf("autoads:ac:fail:http:%s:%s", r.UserID, r.URLHash))
                            _ = storeRedis.Del(ctx, fmt.Sprintf("autoads:ac:fail:browser:%s:%s", r.UserID, r.URLHash))
                        }
                    }
                    c.JSON(200, gin.H{"code":0, "message":"reset", "count": len(body.IDs)})
                case "delete":
                    if err := gormDB.Where("id IN ?", body.IDs).Delete(&autoclick.AutoClickURLFailure{}).Error; err != nil {
                        c.JSON(500, gin.H{"code":5000, "message": err.Error()}); return
                    }
                    c.JSON(200, gin.H{"code":0, "message":"deleted", "count": len(body.IDs)})
                case "clearprefer":
                    fallthrough
                case "clear_prefer":
                    // 清除优先浏览器标记：DB 置空 prefer_browser_until + 删除 Redis 标记
                    if err := gormDB.Model(&autoclick.AutoClickURLFailure{}).Where("id IN ?", body.IDs).Updates(map[string]interface{}{"prefer_browser_until": nil, "updated_at": time.Now()}).Error; err != nil {
                        c.JSON(500, gin.H{"code":5000, "message": err.Error()}); return
                    }
                    if storeRedis != nil {
                        var rows []autoclick.AutoClickURLFailure
                        _ = gormDB.Where("id IN ?", body.IDs).Find(&rows).Error
                        ctx := c.Request.Context()
                        for _, r := range rows {
                            _ = storeRedis.Del(ctx, fmt.Sprintf("autoads:ac:prefer_browser:%s:%s", r.UserID, r.URLHash))
                        }
                    }
                    c.JSON(200, gin.H{"code":0, "message":"cleared", "count": len(body.IDs)})
                default:
                    c.JSON(400, gin.H{"code":1002, "message":"unsupported op"})
                }
            })

            // 更新备注/可选清理 prefer 标记
            console.PATCH("/autoclick/url-failures/:id", func(c *gin.Context) {
                id := c.Param("id")
                if id == "" { c.JSON(400, gin.H{"code":1001, "message":"id required"}); return }
                var body struct {
                    Notes          *string `json:"notes"`
                    ClearPrefer    *bool   `json:"clearPrefer"`
                }
                if err := c.ShouldBindJSON(&body); err != nil { c.JSON(400, gin.H{"code":1001, "message":"invalid body"}); return }
                updates := map[string]interface{}{"updated_at": time.Now()}
                if body.Notes != nil { updates["notes"] = *body.Notes }
                if body.ClearPrefer != nil && *body.ClearPrefer {
                    updates["prefer_browser_until"] = nil
                }
                if err := gormDB.Model(&autoclick.AutoClickURLFailure{}).Where("id=?", id).Updates(updates).Error; err != nil {
                    c.JSON(500, gin.H{"code":5000, "message": err.Error()}); return
                }
                c.JSON(200, gin.H{"code":0, "message":"updated"})
            })
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

        // ===== BATCHOPEN 原子端点迁移到 internal/app =====
        app.RegisterBatchOpenAtomic(v1, batchOpenPlanLimiter, authMiddleware(), tokenSvc, batchService, gormDB, storeRedis, auditSvc)

			batchopen := v1.Group("/batchopen")
			if batchOpenPlanLimiter != nil {
				batchopen.Use(batchOpenPlanLimiter)
			}
			{
			// moved to internal/app.RegisterBatchOpenAtomic

			// moved to internal/app.RegisterBatchOpenAtomic

            // moved to internal/app.RegisterBatchOpenAtomic: GET /batchopen/tasks/:id

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

            // AutoClick 计划任务（Schedule）CRUD + 启停
            // 路由前缀：/api/v1/batchopen/autoclick
            {
                ac := v1.Group("/batchopen/autoclick")
                if batchOpenPlanLimiter != nil {
                    ac.Use(batchOpenPlanLimiter)
                }
                ac.Use(authMiddleware())
                ctrl := autoclick.NewController(gormDB)
                ac.GET("/schedules", ctrl.ListSchedules)
                ac.POST("/schedules", ctrl.CreateSchedule)
                ac.GET("/schedules/:id", ctrl.GetSchedule)
                ac.PUT("/schedules/:id", ctrl.UpdateSchedule)
                ac.DELETE("/schedules/:id", ctrl.DeleteSchedule)
                ac.POST("/schedules/:id/enable", ctrl.EnableSchedule)
                ac.POST("/schedules/:id/disable", ctrl.DisableSchedule)
            }

            // moved to internal/app.RegisterBatchOpenAtomic: GET /batchopen/tasks/:id/live

            // SSE: 订阅 AutoClick 执行事件（Redis Pub/Sub）
            // GET /api/v1/batchopen/autoclick/executions/live?userId=&scheduleId=&executionId=
            v1.GET("/batchopen/autoclick/executions/live", func(c *gin.Context) {
                if storeRedis == nil { c.String(503, "redis unavailable"); return }
                fUser := strings.TrimSpace(c.Query("userId"))
                fSchedule := strings.TrimSpace(c.Query("scheduleId"))
                fExec := strings.TrimSpace(c.Query("executionId"))
                c.Writer.Header().Set("Content-Type", "text/event-stream")
                c.Writer.Header().Set("Cache-Control", "no-cache")
                c.Writer.Header().Set("Connection", "keep-alive")
                ctx := c.Request.Context()
                sub := storeRedis.GetClient().Subscribe(ctx, "autoclick:executions:updates")
                ch := sub.Channel()
                defer sub.Close()
                hb := time.NewTicker(15 * time.Second)
                defer hb.Stop()
                f, ok := c.Writer.(http.Flusher)
                if !ok { c.String(500, "stream unsupported"); return }
                // 连接即发一次快照，降低首包等待（若提供过滤条件）
                if fExec != "" {
                    var exec autoclick.AutoClickExecution
                    if err := gormDB.Where("id=?", fExec).First(&exec).Error; err == nil {
                        payload := map[string]interface{}{"type":"execution_update","id":exec.ID,"scheduleId":exec.ScheduleID,"status":exec.Status,"progress":exec.Progress,"processedItems":exec.Success+exec.Fail,"totalItems":exec.Total,"timestamp": time.Now().UnixMilli()}
                        b, _ := json.Marshal(payload)
                        fmt.Fprintf(c.Writer, "data: %s\n\n", string(b)); f.Flush()
                    }
                } else if fSchedule != "" || fUser != "" {
                    q := gormDB.Model(&autoclick.AutoClickExecution{})
                    if fSchedule != "" { q = q.Where("schedule_id = ?", fSchedule) }
                    if fUser != "" { q = q.Where("user_id = ?", fUser) }
                    var exec autoclick.AutoClickExecution
                    if err := q.Order("updated_at DESC").First(&exec).Error; err == nil {
                        payload := map[string]interface{}{"type":"execution_update","id":exec.ID,"scheduleId":exec.ScheduleID,"status":exec.Status,"progress":exec.Progress,"processedItems":exec.Success+exec.Fail,"totalItems":exec.Total,"timestamp": time.Now().UnixMilli()}
                        b, _ := json.Marshal(payload)
                        fmt.Fprintf(c.Writer, "data: %s\n\n", string(b)); f.Flush()
                    }
                }
                for {
                    select {
                    case <-ctx.Done():
                        return
                    case <-hb.C:
                        fmt.Fprintf(c.Writer, ": ping\n\n")
                        f.Flush()
                    case msg := <-ch:
                        if msg == nil { continue }
                        p := msg.Payload
                        if fUser != "" && !strings.Contains(p, fUser) { continue }
                        if fSchedule != "" && !strings.Contains(p, fSchedule) { continue }
                        if fExec != "" && !strings.Contains(p, fExec) { continue }
                        fmt.Fprintf(c.Writer, "data: %s\n\n", p)
                        f.Flush()
                    }
                }
            })

            // 快照：提供降级轮询（全量同步）接口
            // GET /api/v1/batchopen/autoclick/executions/snapshot?userId=&scheduleId=&executionId=
            v1.GET("/batchopen/autoclick/executions/snapshot", func(c *gin.Context) {
                uid := strings.TrimSpace(c.Query("userId"))
                sid := strings.TrimSpace(c.Query("scheduleId"))
                eid := strings.TrimSpace(c.Query("executionId"))
                q := gormDB.Model(&autoclick.AutoClickExecution{})
                if eid != "" {
                    var exec autoclick.AutoClickExecution
                    if err := q.Where("id=?", eid).First(&exec).Error; err != nil {
                        c.JSON(404, gin.H{"code": 404, "message": "not_found"}); return
                    }
                    c.JSON(200, gin.H{"code":0, "data": gin.H{
                        "type":"execution_update", "id": exec.ID, "scheduleId": exec.ScheduleID, "status": exec.Status,
                        "progress": exec.Progress, "processedItems": exec.Success+exec.Fail, "totalItems": exec.Total,
                        "timestamp": time.Now().UnixMilli(),
                    }})
                    return
                }
                if sid == "" && uid == "" { c.JSON(400, gin.H{"code":1001, "message":"scheduleId or userId required"}); return }
                if sid != "" { q = q.Where("schedule_id = ?", sid) }
                if uid != "" { q = q.Where("user_id = ?", uid) }
                var exec autoclick.AutoClickExecution
                if err := q.Order("updated_at DESC").First(&exec).Error; err != nil {
                    c.JSON(404, gin.H{"code": 404, "message": "not_found"}); return
                }
                c.JSON(200, gin.H{"code":0, "data": gin.H{
                    "type":"execution_update", "id": exec.ID, "scheduleId": exec.ScheduleID, "status": exec.Status,
                    "progress": exec.Progress, "processedItems": exec.Success+exec.Fail, "totalItems": exec.Total,
                    "timestamp": time.Now().UnixMilli(),
                }})
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

			// ===== AutoClick schedules (最小CRUD与启停) =====
        {
            autoCtrl := autoclick.NewController(gormDB)
            autoGroup := v1.Group("/batchopen/autoclick")
            autoGroup.Use(authMiddleware())
            {
                autoGroup.GET("/schedules", autoCtrl.ListSchedules)
                autoGroup.POST("/schedules", autoCtrl.CreateSchedule)
                autoGroup.GET("/schedules/:id", autoCtrl.GetSchedule)
                autoGroup.PUT("/schedules/:id", autoCtrl.UpdateSchedule)
                autoGroup.DELETE("/schedules/:id", autoCtrl.DeleteSchedule)
                autoGroup.POST("/schedules/:id/enable", autoCtrl.EnableSchedule)
                autoGroup.POST("/schedules/:id/disable", autoCtrl.DisableSchedule)
                // 池队列状态只读接口
                autoGroup.GET("/queue/state", func(c *gin.Context) {
                    st := autoclick.GetPoolManager().State()
                    c.JSON(200, gin.H{"code":0, "data": st})
                })
            }
        }

			// SiteRank路由（避免重复声明变量名）
        siteRankGroup := v1.Group("/siterank")
        if siteRankPlanLimiter != nil { siteRankGroup.Use(siteRankPlanLimiter) }
        siteRankGroup.Use(authMiddleware())
        {
            siteRankGroup.GET("/rank", handleSiteRank)
            siteRankGroup.POST("/batch", handleBatchSiteRank)
        }
        // 将原子端点注册迁移到 internal/app，逐步收敛 main.go 内的路由实现
        app.RegisterSiteRankAtomic(v1, siteRankPlanLimiter, authMiddleware(), swebClient, tokenSvc, gormDB, storeRedis, auditSvc)

		// AdsCenter 路由
		adscenterGroup := v1.Group("/adscenter")
		adscenterGroup.Use(authMiddleware())
		{
			adscenterGroup.POST("/create", handleAdsCenterCreate)
			adscenterGroup.GET("/tasks", handleAdsCenterTasks)
			adscenterGroup.GET("/tasks/:id", handleAdsCenterTask)
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
    adminGroup := r.Group("/admin")
    adminGroup.Use(adminAuthMiddleware())
    {
        adminGroup.GET("/users", handleAdminGetUsers)
        adminGroup.PUT("/users/:id", handleAdminUpdateUser)
        adminGroup.GET("/stats", handleAdminGetStats)
        adminGroup.GET("/dashboard", handleAdminDashboard)
        // Bad URL 管理（共享 Redis 标记）
        adminGroup.GET("/badurls", func(c *gin.Context) {
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
        adminGroup.DELETE("/badurls/:hash", func(c *gin.Context) {
            if storeRedis == nil { c.JSON(503, gin.H{"code": 5000, "message": "redis unavailable"}); return }
            hash := c.Param("hash")
            if hash == "" { c.JSON(400, gin.H{"code": 400, "message": "missing hash"}); return }
            key := "autoads:badurl:" + hash
            if err := storeRedis.Delete(context.Background(), key); err != nil { c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return }
            c.JSON(200, gin.H{"code": 0, "message": "deleted"})
        })
        adminGroup.DELETE("/badurls", func(c *gin.Context) {
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

    // ===== 新版 API: /api/v2 =====
    v2 := r.Group("/api/v2")
    // 内部JWT桥接（不强制） + 用户鉴权（要求 Authorization）
    v2.Use(middleware.InternalJWTAuth(false))
    v2.Use(authMiddleware())
    {
        // v2 任务统一快照与 SSE 迁移至 internal/app
        app.RegisterV2TaskSnapshot(v2, gormDB)

        // 统计只读端点（简化版）
        app.RegisterStats(v1, gormDB)
        app.RegisterPerformance(v1, gormDB)
        app.RegisterCacheInsights(v1, gormDB)
        app.RegisterSiteRankTimeSeries(v1, gormDB)

        // BatchOpen Silent v2
        batchV2 := v2.Group("/batchopen")
        {
            batchV2.POST("/silent/start", func(c *gin.Context) { handleSilentStart(c) })
            batchV2.GET("/silent/tasks/:id", func(c *gin.Context) {
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"message":"missing id"}); return }
                snap, ok, err := buildExecutionUpdateSnapshot(c, id)
                if err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                if !ok { c.JSON(404, gin.H{"message":"not found"}); return }
                c.JSON(200, snap)
            })
            batchV2.POST("/silent/terminate", func(c *gin.Context) { handleSilentTerminate(c) })
            batchV2.POST("/proxy/validate", func(c *gin.Context) {
                type req struct{ ProxyUrl string `json:"proxyUrl"` }
                var body req
                if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.ProxyUrl) == "" {
                    c.JSON(400, gin.H{"valid": false, "message": "invalid request"}); return
                }
                u, err := url.Parse(body.ProxyUrl)
                if err != nil { c.JSON(200, gin.H{"valid": false, "message": err.Error()}); return }
                scheme := strings.ToLower(u.Scheme)
                if scheme != "http" && scheme != "https" && scheme != "socks5" { c.JSON(200, gin.H{"valid": false, "message": "unsupported scheme"}); return }
                if !strings.Contains(u.Host, ":") { c.JSON(200, gin.H{"valid": false, "message": "missing port"}); return }
                c.JSON(200, gin.H{"valid": true, "normalized": u.String()})
            })
        }

        // AutoClick v2
        acv2 := v2.Group("/autoclick")
        {
            autoCtrl := autoclick.NewController(gormDB)
            acv2.GET("/schedules", autoCtrl.ListSchedules)
            acv2.POST("/schedules", autoCtrl.CreateSchedule)
            acv2.GET("/schedules/:id", autoCtrl.GetSchedule)
            acv2.DELETE("/schedules/:id", autoCtrl.DeleteSchedule)
            acv2.PATCH("/schedules/:id/enable", autoCtrl.EnableSchedule)
            acv2.PATCH("/schedules/:id/disable", autoCtrl.DisableSchedule)
            acv2.PUT("/schedules/:id", autoCtrl.UpdateSchedule)
            // 获取当前执行ID（running/pending 优先，按更新时间倒序）
            acv2.GET("/schedules/:id/execution/current", func(c *gin.Context) {
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"message": "unauthorized"}); return }
                sid := c.Param("id"); if sid == "" { c.JSON(400, gin.H{"message":"missing id"}); return }
                var ex autoclick.AutoClickExecution
                if err := gormDB.Where("user_id=? AND schedule_id=? AND status IN ?", userID, sid, []string{"running", "pending"}).Order("updated_at DESC").First(&ex).Error; err != nil {
                    c.JSON(404, gin.H{"message": "no active execution"}); return
                }
                c.JSON(200, gin.H{"id": ex.ID, "status": ex.Status, "progress": ex.Progress, "processed": ex.Success+ex.Fail, "total": ex.Total})
            })
        }

        // AdsCenter v2（模板/执行/解析）
        adv2 := v2.Group("/adscenter")
        {
            adv2.GET("/accounts", func(c *gin.Context) {
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"message":"unauthorized"}); return }
                var rows []adscenter.GoogleAdsConfig
                if err := gormDB.Where("user_id=? AND is_active=1", userID).Order("updated_at DESC").Find(&rows).Error; err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                for i := range rows { rows[i].DeveloperToken = "***"; rows[i].ClientSecret = "***"; rows[i].RefreshToken = "***" }
                c.JSON(200, gin.H{"items": rows})
            })
            adv2.GET("/templates", func(c *gin.Context) {
                row, err := gf.DB().Raw("SELECT config_value FROM system_configs WHERE config_key=? AND is_active=1 LIMIT 1", "adscenter.templates").One()
                if err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                var list interface{}
                if row != nil && strings.TrimSpace(row["config_value"].String()) != "" { _ = json.Unmarshal([]byte(row["config_value"].String()), &list) } else { list = []any{} }
                c.JSON(200, gin.H{"items": list})
            })
            adv2.POST("/templates/:id/dry-run", func(c *gin.Context) {
                templateID := strings.TrimSpace(c.Param("id"))
                account := strings.TrimSpace(c.Query("account"))
                if templateID == "" || account == "" { c.JSON(400, gin.H{"message":"missing template or account"}); return }
                userID := c.GetString("user_id")
                client, err := resolveGoogleAdsClient(c, userID, account)
                if err != nil { c.JSON(400, gin.H{"message": err.Error()}); return }
                ads, err := client.GetAds(); if err != nil { c.JSON(502, gin.H{"message": err.Error()}); return }
                affect := 0
                sample := []adscenter.AdInfo{}
                for _, a := range ads { if strings.ToUpper(a.Status) != "REMOVED" { affect++; if len(sample) < 5 { sample = append(sample, a) } } }
                c.JSON(200, gin.H{"ok": true, "affected": affect, "sample": sample})
            })
            adv2.POST("/templates/:id/execute", func(c *gin.Context) {
                templateID := strings.TrimSpace(c.Param("id"))
                account := strings.TrimSpace(c.Query("account"))
                if templateID == "" || account == "" { c.JSON(400, gin.H{"message":"missing template or account"}); return }
                userID := c.GetString("user_id")
                client, err := resolveGoogleAdsClient(c, userID, account)
                if err != nil { c.JSON(400, gin.H{"message": err.Error()}); return }
                ads, err := client.GetAds(); if err != nil { c.JSON(502, gin.H{"message": err.Error()}); return }
                suffixRow, _ := gf.DB().Raw("SELECT config_value FROM system_configs WHERE config_key=? AND is_active=1 LIMIT 1", "adscenter.template."+templateID+".finalUrlSuffix").One()
                suffix := ""; if suffixRow != nil { suffix = strings.TrimSpace(suffixRow["config_value"].String()) }
                if suffix == "" { suffix = "utm_source=autoads" }
                updates := make([]adscenter.UpdateAdRequest, 0, len(ads))
                results := make([]adscenter.AdUpdateResult, 0, len(ads))
                for _, a := range ads {
                    base := a.FinalURL; if base == "" { continue }
                    newURL := rebuildURLWithSuffix(base, suffix); if newURL == base { continue }
                    updates = append(updates, adscenter.UpdateAdRequest{AdID: a.ID, FinalURL: newURL})
                    results = append(results, adscenter.AdUpdateResult{ AdID: a.ID, AdName: a.Name, OldFinalURL: base, NewFinalURL: newURL, Status: "pending", UpdatedAt: time.Now().Format(time.RFC3339) })
                }
                res, err := client.BatchUpdateAds(updates); if err != nil { c.JSON(502, gin.H{"message": err.Error()}); return }
                // 合并状态
                idx := map[string]int{}; for i, r := range results { idx[r.AdID] = i }
                succ := 0
                for _, r := range res { if i, ok := idx[r.AdID]; ok { if r.Success { results[i].Status = "success"; results[i].ErrorMessage = ""; succ++ } else { results[i].Status = "failed"; results[i].ErrorMessage = r.ErrorMessage } } }
                task := &adscenter.AdsCenterTask{ UserID: userID, Name: "template:"+templateID, Status: adscenter.TaskStatusCompleted, TotalLinks: len(updates), UpdatedCount: succ, FailedCount: len(updates)-succ, UpdateResults: results }
                _ = gormDB.Create(task).Error
                c.JSON(200, gin.H{"ok": true, "results": res, "updated": succ, "failed": len(updates)-succ, "executionId": task.ID })
            })
            // 重试失败项（需提供 account）
            adv2.POST("/executions/:id/retry-failures", func(c *gin.Context) {
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"message":"missing id"}); return }
                account := strings.TrimSpace(c.Query("account")); if account == "" { c.JSON(400, gin.H{"message":"missing account"}); return }
                userID := c.GetString("user_id")
                var task adscenter.AdsCenterTask
                if err := gormDB.Where("id=? AND user_id=?", id, userID).First(&task).Error; err != nil { c.JSON(404, gin.H{"message":"execution not found"}); return }
                failed := []adscenter.UpdateAdRequest{}
                for _, r := range task.UpdateResults { if strings.ToLower(r.Status) == "failed" && r.NewFinalURL != "" { failed = append(failed, adscenter.UpdateAdRequest{ AdID: r.AdID, FinalURL: r.NewFinalURL }) } }
                if len(failed) == 0 { c.JSON(200, gin.H{"ok": true, "message":"no failed items"}); return }
                client, err := resolveGoogleAdsClient(c, userID, account)
                if err != nil { c.JSON(400, gin.H{"message": err.Error()}); return }
                res, err := client.BatchUpdateAds(failed); if err != nil { c.JSON(502, gin.H{"message": err.Error()}); return }
                // 写回到 UpdateResults
                idx := map[string]int{}; for i, r := range task.UpdateResults { idx[r.AdID] = i }
                succ := 0
                for _, r := range res { if i, ok := idx[r.AdID]; ok { if r.Success { task.UpdateResults[i].Status = "success"; task.UpdateResults[i].ErrorMessage = ""; succ++ } else { task.UpdateResults[i].ErrorMessage = r.ErrorMessage } } }
                _ = gormDB.Model(&adscenter.AdsCenterTask{}).Where("id=?", task.ID).Updates(map[string]any{"update_results": task.UpdateResults, "updated_count": task.UpdatedCount + succ, "failed_count": ifZeroInt(task.FailedCount - succ, 0), "updated_at": time.Now()}).Error
                c.JSON(200, gin.H{"ok": true, "updated": succ, "failed": len(res)-succ})
            })
            // 回滚执行（需提供 account）
            adv2.POST("/executions/:id/rollback", func(c *gin.Context) {
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"message":"missing id"}); return }
                account := strings.TrimSpace(c.Query("account")); if account == "" { c.JSON(400, gin.H{"message":"missing account"}); return }
                userID := c.GetString("user_id")
                var task adscenter.AdsCenterTask
                if err := gormDB.Where("id=? AND user_id=?", id, userID).First(&task).Error; err != nil { c.JSON(404, gin.H{"message":"execution not found"}); return }
                reverts := []adscenter.UpdateAdRequest{}
                for _, r := range task.UpdateResults { if strings.ToLower(r.Status) == "success" && r.OldFinalURL != "" { reverts = append(reverts, adscenter.UpdateAdRequest{ AdID: r.AdID, FinalURL: r.OldFinalURL }) } }
                if len(reverts) == 0 { c.JSON(200, gin.H{"ok": true, "message":"nothing to rollback"}); return }
                client, err := resolveGoogleAdsClient(c, userID, account)
                if err != nil { c.JSON(400, gin.H{"message": err.Error()}); return }
                res, err := client.BatchUpdateAds(reverts); if err != nil { c.JSON(502, gin.H{"message": err.Error()}); return }
                c.JSON(200, gin.H{"ok": true, "reverted": countSuccess(res), "failed": len(res)-countSuccess(res) })
            })
            adv2.POST("/offers/resolve", func(c *gin.Context) {
                var body struct { OfferUrl string `json:"offerUrl"`; AccountId string `json:"accountId"` }
                if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.OfferUrl) == "" { c.JSON(400, gin.H{"ok": false, "message":"invalid request"}); return }
                if storeRedis != nil { key := "offer:resolve:" + sha1Hex(strings.TrimSpace(body.OfferUrl)); if v, _ := storeRedis.Get(c, key); v != "" { var m map[string]any; _ = json.Unmarshal([]byte(v), &m); if m != nil { c.JSON(200, m); return } } }
                res := resolveOfferURL(c.Request.Context(), body.OfferUrl)
                if storeRedis != nil && res["ok"] == true { b,_ := json.Marshal(res); _ = storeRedis.Set(c, "offer:resolve:"+sha1Hex(body.OfferUrl), string(b), 24*time.Hour) }
                c.JSON(200, res)
            })

            // Analytics：优先从 ads_metrics_daily 读取；无数据时回退轮换/执行统计
            adv2.GET("/analytics/summary", func(c *gin.Context) {
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"message":"unauthorized"}); return }
                // metrics
                type agg struct{ Clicks, Impressions, CostMicros, Conversions, ConvValueMicros int64 }
                var a agg
                _ = gormDB.Model(&AdsMetricsDaily{}).Select("SUM(clicks) as clicks, SUM(impressions) as impressions, SUM(cost_micros) as cost_micros, SUM(conversions) as conversions, SUM(conv_value_micros) as conv_value_micros").Where("user_id=? AND date>=DATE_SUB(CURDATE(), INTERVAL 30 DAY)", userID).Scan(&a)
                // 回退
                var taskCount int64; _ = gormDB.Model(&adscenter.AdsCenterTask{}).Where("user_id=?", userID).Count(&taskCount).Error
                var rotCount int64; _ = gormDB.Model(&AdsOfferRotation{}).Joins("JOIN ads_offer_bindings b ON b.id=ads_offer_rotations.binding_id").Where("b.user_id=?", userID).Count(&rotCount).Error
                out := gin.H{"tasks": taskCount, "rotations": rotCount}
                if a.Impressions > 0 || a.Clicks > 0 { out["clicks"] = a.Clicks; out["impressions"] = a.Impressions; out["costMicros"] = a.CostMicros; out["conversions"] = a.Conversions; out["convValueMicros"] = a.ConvValueMicros }
                c.JSON(200, out)
            })
            adv2.GET("/analytics/timeseries", func(c *gin.Context) {
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"message":"unauthorized"}); return }
                // 优先 metrics：按日 clicks
                rows, err := gf.DB().Query(c, `SELECT date, SUM(clicks) as v FROM ads_metrics_daily WHERE user_id=? AND date>=DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY date ORDER BY date`, userID)
                if err == nil && len(rows) > 0 {
                    out := make([]map[string]any, 0, len(rows))
                    for _, r := range rows { out = append(out, map[string]any{"date": r["date"].String(), "value": r["v"].Int()}) }
                    c.JSON(200, gin.H{"series": out}); return
                }
                // 回退：近30天轮换计数
                q := `SELECT DATE(rotated_at) as d, COUNT(1) as cnt FROM ads_offer_rotations r JOIN ads_offer_bindings b ON b.id=r.binding_id WHERE b.user_id=? AND rotated_at>=DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY DATE(rotated_at) ORDER BY DATE(rotated_at)`
                rows2, err2 := gf.DB().Query(c, q, userID)
                if err2 != nil { c.JSON(500, gin.H{"message": err2.Error()}); return }
                out := make([]map[string]any, 0, len(rows2))
                for _, r := range rows2 { out = append(out, map[string]any{"date": r["d"].String(), "value": r["cnt"].Int()}) }
                c.JSON(200, gin.H{"series": out})
            })
            adv2.GET("/analytics/breakdown", func(c *gin.Context) {
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"message":"unauthorized"}); return }
                // 优先 metrics：TopN Campaign 按 Clicks
                rows, err := gf.DB().Query(c, `SELECT campaign_id, SUM(clicks) as v FROM ads_metrics_daily WHERE user_id=? AND date>=DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY campaign_id ORDER BY v DESC LIMIT 10`, userID)
                if err == nil && len(rows) > 0 {
                    out := make([]map[string]any, 0, len(rows))
                    for _, r := range rows { out = append(out, map[string]any{"campaignId": r["campaign_id"].String(), "value": r["v"].Int()}) }
                    c.JSON(200, gin.H{"topCampaigns": out}); return
                }
                // 回退：TopN 账户按轮换次数
                q := `SELECT b.account_id, COUNT(1) as cnt FROM ads_offer_rotations r JOIN ads_offer_bindings b ON b.id=r.binding_id WHERE b.user_id=? GROUP BY b.account_id ORDER BY cnt DESC LIMIT 10`
                rows2, err2 := gf.DB().Query(c, q, userID)
                if err2 != nil { c.JSON(500, gin.H{"message": err2.Error()}); return }
                out := make([]map[string]any, 0, len(rows2))
                for _, r := range rows2 { out = append(out, map[string]any{"accountId": r["account_id"].String(), "value": r["cnt"].Int()}) }
                c.JSON(200, gin.H{"topAccounts": out})
            })

            // Offer 绑定管理（最小实现）
            adv2.POST("/offers", func(c *gin.Context) {
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"message":"unauthorized"}); return }
                var body struct{
                    OfferUrl string `json:"offerUrl"`
                    AccountId string `json:"accountId"`
                    RotationFrequency string `json:"rotationFrequency"` // hourly/daily/weekly
                    RotationAt *string `json:"rotationAt"`
                    UniqueWindowDays int `json:"uniqueWindowDays"`
                }
                if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.OfferUrl)=="" || strings.TrimSpace(body.AccountId)=="" { c.JSON(400, gin.H{"message":"invalid request"}); return }
                off := &AdsOffer{ ID: gf.UUID(), UserID: userID, OfferURL: strings.TrimSpace(body.OfferUrl), Status: "active", CreatedAt: time.Now(), UpdatedAt: time.Now() }
                // 复用存在的 offer
                var exist AdsOffer
                if err := gormDB.Where("user_id=? AND offer_url=?", userID, off.OfferURL).First(&exist).Error; err == nil && exist.ID != "" { off = &exist }
                if off.ID == "" || off.CreatedAt.IsZero() { _ = gormDB.Create(off).Error }
                bind := &AdsOfferBinding{ ID: gf.UUID(), OfferID: off.ID, UserID: userID, AccountID: strings.TrimSpace(body.AccountId), RotationFrequency: strings.ToLower(strings.TrimSpace(body.RotationFrequency)), RotationAt: body.RotationAt, UniqueWindowDays: ifZeroInt(body.UniqueWindowDays, 90), Active: true, CreatedAt: time.Now(), UpdatedAt: time.Now() }
                if err := gormDB.Create(bind).Error; err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                c.JSON(200, gin.H{"offer": off, "binding": bind})
            })
            adv2.GET("/offers", func(c *gin.Context) {
                userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"message":"unauthorized"}); return }
                // 左连接 offers + bindings
                type row struct{ AdsOffer; Binding AdsOfferBinding `gorm:"embeddedPrefix:bind_"` }
                var rows []map[string]any
                q := `SELECT o.id as offer_id,o.offer_url,o.status as offer_status,o.created_at as offer_created_at,o.updated_at as offer_updated_at,
                             b.id as binding_id,b.account_id,b.rotation_frequency,b.rotation_at,b.unique_window_days,b.active,b.last_rotation_at,b.next_rotation_at,b.created_at as bind_created_at,b.updated_at as bind_updated_at
                      FROM ads_offers o LEFT JOIN ads_offer_bindings b ON b.offer_id=o.id WHERE o.user_id=? ORDER BY o.updated_at DESC`
                res, err := gf.DB().Query(c, q, userID)
                if err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                for _, r := range res { rows = append(rows, r.Map()) }
                c.JSON(200, gin.H{"items": rows})
            })
            adv2.PATCH("/offers/:id", func(c *gin.Context) {
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"message":"missing id"}); return }
                userID := c.GetString("user_id")
                var body map[string]any
                if err := c.ShouldBindJSON(&body); err != nil { c.JSON(400, gin.H{"message":"invalid request"}); return }
                updates := map[string]any{"updated_at": time.Now()}
                if v, ok := body["rotationFrequency"].(string); ok { updates["rotation_frequency"] = strings.ToLower(strings.TrimSpace(v)) }
                if v, ok := body["rotationAt"].(string); ok { updates["rotation_at"] = strings.TrimSpace(v) }
                if v, ok := body["uniqueWindowDays"].(float64); ok { updates["unique_window_days"] = int(v) }
                if v, ok := body["active"].(bool); ok { updates["active"] = v }
                if err := gormDB.Model(&AdsOfferBinding{}).Where("id=? AND user_id=?", id, userID).Updates(updates).Error; err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                c.JSON(200, gin.H{"ok": true})
            })
            adv2.DELETE("/offers/:id", func(c *gin.Context) {
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"message":"missing id"}); return }
                userID := c.GetString("user_id")
                if err := gormDB.Where("id=? AND user_id=?", id, userID).Delete(&AdsOfferBinding{}).Error; err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                c.JSON(200, gin.H{"ok": true})
            })
            adv2.POST("/offers/:id/rotate", func(c *gin.Context) {
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"message":"missing id"}); return }
                userID := c.GetString("user_id")
                var bind AdsOfferBinding
                if err := gormDB.Where("id=? AND user_id=?", id, userID).First(&bind).Error; err != nil { c.JSON(404, gin.H{"message":"binding not found"}); return }
                var offer AdsOffer
                if err := gormDB.Where("id=?", bind.OfferID).First(&offer).Error; err != nil { c.JSON(404, gin.H{"message":"offer not found"}); return }
                // 解析 Offer URL
                var (
                    finalURL string
                    finalSuf string
                    attempt   = 0
                    st        = "ok"
                    msg       = ""
                )
                for attempt < 3 {
                    attempt++
                    res := resolveOfferURL(c.Request.Context(), offer.OfferURL)
                    if res["ok"] != true { st = "error"; msg = gf.String(res["message"]); break }
                    finalURL = gf.String(res["finalUrl"])
                    finalSuf = gf.String(res["finalUrlSuffix"])
                    if finalURL == "" { st = "error"; msg = "empty final url"; break }
                    // 唯一性窗口校验
                    hash := sha1Hex(strings.ToLower(finalURL+"?"+finalSuf))
                    var cnt int64
                    win := ifZeroInt(bind.UniqueWindowDays, 90)
                    _ = gormDB.Model(&AdsOfferRotation{}).
                        Where("binding_id=? AND final_hash=? AND rotated_at>=?", bind.ID, hash, time.Now().AddDate(0,0,-win)).
                        Count(&cnt).Error
                    if cnt == 0 { break }
                    // 命中唯一性窗口，重试解析
                    if attempt >= 3 { st = "skip"; msg = "duplicate within unique window" }
                }
                rot := &AdsOfferRotation{ ID: gf.UUID(), BindingID: bind.ID, AccountID: bind.AccountID, RotatedAt: time.Now(), FinalURL: finalURL, FinalURLSuffix: finalSuf, FinalHash: sha1Hex(strings.ToLower(finalURL+"?"+finalSuf)), Status: st, Message: msg }
                _ = gormDB.Create(rot).Error
                // 更新时间与下次时间
                now := time.Now()
                next := now.Add(24 * time.Hour)
                switch strings.ToLower(bind.RotationFrequency) { case "hourly": next = now.Add(1*time.Hour); case "weekly": next = now.Add(7*24*time.Hour) }
                _ = gormDB.Model(&AdsOfferBinding{}).Where("id=?", bind.ID).Updates(map[string]any{"last_rotation_at": now, "next_rotation_at": next, "updated_at": now}).Error
                c.JSON(200, gin.H{"ok": st=="ok", "rotation": rot})
            })

            // 轮换历史（按绑定ID）
            adv2.GET("/offers/:id/rotations", func(c *gin.Context) {
                id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"message":"missing id"}); return }
                userID := c.GetString("user_id")
                // 校验绑定归属
                var b AdsOfferBinding
                if err := gormDB.Where("id=? AND user_id=?", id, userID).First(&b).Error; err != nil { c.JSON(404, gin.H{"message":"not found"}); return }
                // 查询历史记录
                var rows []AdsOfferRotation
                if err := gormDB.Where("binding_id=?", id).Order("rotated_at DESC").Limit(100).Find(&rows).Error; err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                c.JSON(200, gin.H{"items": rows})
            })
        }

        // Admin（仅管理员）
        adminV2 := v2.Group("/admin/adscenter")
        adminV2.Use(admin.AdminJWT())
        {
            adminV2.GET("/google-ads/credentials", func(c *gin.Context) {
                userID := strings.TrimSpace(c.Query("userId"))
                customerID := strings.TrimSpace(c.Query("customerId"))
                active := strings.TrimSpace(c.Query("active"))
                updatedFrom := strings.TrimSpace(c.Query("updatedFrom"))
                updatedTo := strings.TrimSpace(c.Query("updatedTo"))
                q := gormDB.Model(&adscenter.GoogleAdsConfig{})
                if userID != "" { q = q.Where("user_id=?", userID) }
                if customerID != "" { q = q.Where("customer_id=?", customerID) }
                if active != "" {
                    if strings.EqualFold(active, "true") || active == "1" { q = q.Where("is_active=1") }
                    if strings.EqualFold(active, "false") || active == "0" { q = q.Where("is_active=0") }
                }
                if updatedFrom != "" { if t, err := time.Parse(time.RFC3339, updatedFrom); err == nil { q = q.Where("updated_at>=?", t) } }
                if updatedTo != "" { if t, err := time.Parse(time.RFC3339, updatedTo); err == nil { q = q.Where("updated_at<=?", t) } }
                var rows []adscenter.GoogleAdsConfig
                if err := q.Order("updated_at DESC").Find(&rows).Error; err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                for i := range rows { rows[i].DeveloperToken = "***"; rows[i].ClientSecret = "***"; rows[i].RefreshToken = "***" }
                c.JSON(200, gin.H{"items": rows})
            })
            adminV2.GET("/google-ads/credentials/export", func(c *gin.Context) {
                userID := strings.TrimSpace(c.Query("userId"))
                q := gormDB.Model(&adscenter.GoogleAdsConfig{})
                if userID != "" { q = q.Where("user_id=?", userID) }
                var rows []adscenter.GoogleAdsConfig
                if err := q.Order("updated_at DESC").Find(&rows).Error; err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                // 简单CSV导出（敏感脱敏）
                var b strings.Builder
                b.WriteString("user_id,customer_id,name,is_active,updated_at\n")
                for _, r := range rows { b.WriteString(fmt.Sprintf("%s,%s,%s,%v,%s\n", r.UserID, r.CustomerID, strings.ReplaceAll(r.Name, ",", " "), r.IsActive, r.UpdatedAt.Format(time.RFC3339))) }
                c.Header("Content-Type", "text/csv; charset=utf-8")
                c.Header("Content-Disposition", "attachment; filename=google_ads_credentials.csv")
                c.String(200, b.String())
                auditLog("admin_export_google_ads_credentials", map[string]interface{}{"admin": c.GetString("admin_username"), "userId": userID})
            })
            // 手动触发指标回填
            adminV2.POST("/metrics/backfill", func(c *gin.Context) {
                uid := strings.TrimSpace(c.Query("userId"))
                acc := strings.TrimSpace(c.Query("account"))
                days, _ := strconv.Atoi(strings.TrimSpace(c.Query("days")))
                if days <= 0 { days = 7 }
                if gormDB == nil { c.JSON(503, gin.H{"message": "db unavailable"}); return }
                var cfgs []adscenter.GoogleAdsConfig
                q := gormDB.Where("is_active=1")
                if uid != "" { q = q.Where("user_id=?", uid) }
                if acc != "" { q = q.Where("customer_id=?", acc) }
                if err := q.Find(&cfgs).Error; err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
                n := 0
                for _, cfg := range cfgs {
                    var client adscenter.GoogleAdsClientInterface
                    if strings.ToLower(cfg.CustomerID) == "mock" { client = adscenter.NewMockGoogleAdsClient() } else { client = adscenter.NewGoogleAdsClient(&cfg) }
                    end := time.Now().UTC()
                    start := end.AddDate(0,0,-days)
                    rows, err := client.GetDailyMetrics(start.Format("2006-01-02"), end.Format("2006-01-02"))
                    if err != nil { continue }
                    dates := map[string]bool{}
                    for _, r := range rows { dates[r.Date] = true }
                    for d := range dates { _ = gormDB.Where("user_id=? AND account_id=? AND date=?", cfg.UserID, cfg.CustomerID, d).Delete(&AdsMetricsDaily{}).Error }
                    now := time.Now()
                    for _, r := range rows {
                        rec := &AdsMetricsDaily{ UserID: cfg.UserID, AccountID: cfg.CustomerID, Date: r.Date, CampaignID: r.CampaignID, AdGroupID: r.AdGroupID, Device: r.Device, Network: r.Network, Clicks: r.Clicks, Impressions: r.Impressions, CostMicros: r.CostMicros, Conversions: r.Conversions, ConvValueMicros: r.ConvValueMicros, VTC: r.VTC, CreatedAt: now, UpdatedAt: now }
                        _ = gormDB.Create(rec).Error; n++
                    }
                }
                auditLog("admin_metrics_backfill", map[string]interface{}{"admin": c.GetString("admin_username"), "userId": uid, "account": acc, "rows": n})
                c.JSON(200, gin.H{"ok": true, "inserted": n})
            })
            // 生成 Google OAuth 授权链接（使用 system_configs 的 client_id，或 body.clientId 覆盖）
            adminV2.POST("/google-ads/oauth/link", func(c *gin.Context) {
                var body struct{ RedirectURI string `json:"redirectUri"`; Scopes []string `json:"scopes"`; ClientID string `json:"clientId"` }
                if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.RedirectURI)=="" { c.JSON(400, gin.H{"message":"invalid request"}); return }
                clientID := strings.TrimSpace(body.ClientID)
                if clientID == "" {
                    if row, err := gf.DB().Raw("SELECT config_value FROM system_configs WHERE config_key=? AND is_active=1 LIMIT 1", "adscenter.oauth.client_id").One(); err == nil && row != nil { clientID = row["config_value"].String() }
                }
                if clientID == "" { c.JSON(400, gin.H{"message":"missing client_id"}); return }
                scopes := body.Scopes
                if len(scopes)==0 { scopes = []string{"https://www.googleapis.com/auth/adwords","openid","email"} }
                state := fmt.Sprintf("%d-%s", time.Now().Unix(), strings.ReplaceAll(c.GetString("admin_username")," ","_"))
                q := url.Values{}
                q.Set("client_id", clientID)
                q.Set("redirect_uri", body.RedirectURI)
                q.Set("response_type", "code")
                q.Set("access_type", "offline")
                q.Set("prompt", "consent")
                q.Set("scope", strings.Join(scopes, " "))
                q.Set("state", state)
                link := "https://accounts.google.com/o/oauth2/v2/auth?" + q.Encode()
                c.JSON(200, gin.H{"authUrl": link, "state": state})
            })
            // OAuth 回调：交换 refresh_token 并保存到 google_ads_configs
            adminV2.POST("/google-ads/oauth/callback", func(c *gin.Context) {
                var body struct{ Code string `json:"code"`; RedirectURI string `json:"redirectUri"`; UserID string `json:"userId"`; CustomerID string `json:"customerId"`; ClientID string `json:"clientId"`; ClientSecret string `json:"clientSecret"` }
                if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Code)=="" || strings.TrimSpace(body.RedirectURI)=="" || strings.TrimSpace(body.UserID)=="" || strings.TrimSpace(body.CustomerID)=="" { c.JSON(400, gin.H{"message":"invalid request"}); return }
                clientID := strings.TrimSpace(body.ClientID)
                clientSecret := strings.TrimSpace(body.ClientSecret)
                devToken := ""
                if clientID == "" { if row, err := gf.DB().Raw("SELECT config_value FROM system_configs WHERE config_key=? AND is_active=1 LIMIT 1", "adscenter.oauth.client_id").One(); err == nil && row != nil { clientID = row["config_value"].String() } }
                if clientSecret == "" { if row, err := gf.DB().Raw("SELECT config_value FROM system_configs WHERE config_key=? AND is_active=1 LIMIT 1", "adscenter.oauth.client_secret").One(); err == nil && row != nil { clientSecret = row["config_value"].String() } }
                if row, err := gf.DB().Raw("SELECT config_value FROM system_configs WHERE config_key=? AND is_active=1 LIMIT 1", "adscenter.oauth.developer_token").One(); err == nil && row != nil { devToken = row["config_value"].String() }
                if clientID == "" || clientSecret == "" { c.JSON(400, gin.H{"message":"missing client credentials"}); return }
                // token exchange
                form := url.Values{}
                form.Set("code", body.Code)
                form.Set("client_id", clientID)
                form.Set("client_secret", clientSecret)
                form.Set("redirect_uri", body.RedirectURI)
                form.Set("grant_type", "authorization_code")
                req, _ := http.NewRequest("POST", "https://oauth2.googleapis.com/token", strings.NewReader(form.Encode()))
                req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
                httpc := &http.Client{ Timeout: 15 * time.Second }
                resp, err := httpc.Do(req)
                if err != nil { c.JSON(502, gin.H{"message": "token exchange failed", "error": err.Error()}); return }
                defer resp.Body.Close()
                var tok struct{ AccessToken string `json:"access_token"`; RefreshToken string `json:"refresh_token"`; ExpiresIn int `json:"expires_in"`; TokenType string `json:"token_type"` }
                if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil || tok.RefreshToken == "" { c.JSON(502, gin.H{"message": "invalid token response"}); return }
                // upsert google_ads_configs
                var cfg adscenter.GoogleAdsConfig
                if err := gormDB.Where("user_id=? AND customer_id=?", body.UserID, body.CustomerID).First(&cfg).Error; err != nil {
                    cfg = adscenter.GoogleAdsConfig{ UserID: body.UserID, CustomerID: body.CustomerID, Name: "Google Ads", DeveloperToken: devToken, ClientID: clientID, ClientSecret: clientSecret, RefreshToken: tok.RefreshToken, IsActive: true, CreatedAt: time.Now(), UpdatedAt: time.Now() }
                    _ = gormDB.Create(&cfg).Error
                } else {
                    _ = gormDB.Model(&adscenter.GoogleAdsConfig{}).Where("id=?", cfg.ID).Updates(map[string]any{"developer_token": devToken, "client_id": clientID, "client_secret": clientSecret, "refresh_token": tok.RefreshToken, "updated_at": time.Now()}).Error
                }
                auditLog("admin_google_oauth_callback", map[string]any{"admin": c.GetString("admin_username"), "userId": body.UserID, "account": body.CustomerID})
                c.JSON(200, gin.H{"ok": true})
            })
            // 设置全局凭据（system_configs upsert）
            adminV2.POST("/google-ads/credentials", func(c *gin.Context) {
                var body struct{ DeveloperToken string `json:"developerToken"`; ClientID string `json:"clientId"`; ClientSecret string `json:"clientSecret"`; RedirectURI string `json:"redirectUri"`; MCC string `json:"mcc"` }
                if err := c.ShouldBindJSON(&body); err != nil { c.JSON(400, gin.H{"message":"invalid request"}); return }
                kv := map[string]string{
                    "adscenter.oauth.developer_token": strings.TrimSpace(body.DeveloperToken),
                    "adscenter.oauth.client_id": strings.TrimSpace(body.ClientID),
                    "adscenter.oauth.client_secret": strings.TrimSpace(body.ClientSecret),
                    "adscenter.oauth.redirect_uri": strings.TrimSpace(body.RedirectURI),
                    "adscenter.oauth.mcc": strings.TrimSpace(body.MCC),
                }
                for k, v := range kv {
                    if v == "" { continue }
                    // upsert system_configs
                    _ = gormDB.Exec("INSERT INTO system_configs(config_key,config_value,is_active,updated_at) VALUES(?,?,1,?) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value), is_active=1, updated_at=VALUES(updated_at)", k, v, time.Now()).Error
                }
                auditLog("admin_upsert_oauth_config", map[string]any{"admin": c.GetString("admin_username")})
                c.JSON(200, gin.H{"ok": true})
            })
            // 旋转某账户 refresh_token
            adminV2.POST("/google-ads/credentials/rotate", func(c *gin.Context) {
                var body struct{ UserID string `json:"userId"`; CustomerID string `json:"customerId"`; RefreshToken string `json:"refreshToken"` }
                if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.UserID)=="" || strings.TrimSpace(body.CustomerID)=="" || strings.TrimSpace(body.RefreshToken)=="" { c.JSON(400, gin.H{"message":"invalid request"}); return }
                if err := gormDB.Model(&adscenter.GoogleAdsConfig{}).Where("user_id=? AND customer_id=?", body.UserID, body.CustomerID).Updates(map[string]any{"refresh_token": strings.TrimSpace(body.RefreshToken), "updated_at": time.Now()}).Error; err != nil {
                    c.JSON(500, gin.H{"message": err.Error()}); return
                }
                auditLog("admin_rotate_refresh_token", map[string]any{"admin": c.GetString("admin_username"), "userId": body.UserID, "account": body.CustomerID})
                c.JSON(200, gin.H{"ok": true})
            })

            // Admin Analytics：summary/timeseries/breakdown（按 userId/account 可选过滤）
            adminV2.GET("/analytics/summary", func(c *gin.Context) {
                uid := strings.TrimSpace(c.Query("userId")); if uid == "" { c.JSON(400, gin.H{"message":"userId required"}); return }
                account := strings.TrimSpace(c.Query("account"))
                // 优先 metrics（近30天）
                type agg struct{ Clicks, Impressions, CostMicros, Conversions, ConvValueMicros int64 }
                q := gormDB.Model(&AdsMetricsDaily{}).Where("user_id=? AND date>=DATE_SUB(CURDATE(), INTERVAL 30 DAY)", uid)
                if account != "" { q = q.Where("account_id=?", account) }
                var a agg; _ = q.Select("SUM(clicks) clicks, SUM(impressions) impressions, SUM(cost_micros) cost_micros, SUM(conversions) conversions, SUM(conv_value_micros) conv_value_micros").Scan(&a)
                // 回退统计
                var taskCount int64; _ = gormDB.Model(&adscenter.AdsCenterTask{}).Where("user_id=?", uid).Count(&taskCount).Error
                var rotCount int64
                rq := gormDB.Model(&AdsOfferRotation{}).Joins("JOIN ads_offer_bindings b ON b.id=ads_offer_rotations.binding_id").Where("b.user_id=?", uid)
                if account != "" { rq = rq.Where("b.account_id=?", account) }
                _ = rq.Count(&rotCount).Error
                out := gin.H{"tasks": taskCount, "rotations": rotCount}
                if a.Impressions > 0 || a.Clicks > 0 { out["clicks"] = a.Clicks; out["impressions"] = a.Impressions; out["costMicros"] = a.CostMicros; out["conversions"] = a.Conversions; out["convValueMicros"] = a.ConvValueMicros }
                c.JSON(200, out)
            })
            adminV2.GET("/analytics/timeseries", func(c *gin.Context) {
                uid := strings.TrimSpace(c.Query("userId")); if uid == "" { c.JSON(400, gin.H{"message":"userId required"}); return }
                account := strings.TrimSpace(c.Query("account"))
                q := `SELECT date, SUM(clicks) as v FROM ads_metrics_daily WHERE user_id=? AND date>=DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
                args := []any{uid}
                if account != "" { q += " AND account_id=?"; args = append(args, account) }
                q += " GROUP BY date ORDER BY date"
                rows, err := gf.DB().Query(c, q, args...)
                if err == nil && len(rows) > 0 {
                    out := make([]map[string]any, 0, len(rows)); for _, r := range rows { out = append(out, map[string]any{"date": r["date"].String(), "value": r["v"].Int()}) }
                    c.JSON(200, gin.H{"series": out}); return
                }
                // 回退：按轮换
                q = `SELECT DATE(rotated_at) as d, COUNT(1) as cnt FROM ads_offer_rotations r JOIN ads_offer_bindings b ON b.id=r.binding_id WHERE b.user_id=? AND rotated_at>=DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
                args = []any{uid}
                if account != "" { q += " AND b.account_id=?"; args = append(args, account) }
                q += " GROUP BY DATE(rotated_at) ORDER BY DATE(rotated_at)"
                rows2, err2 := gf.DB().Query(c, q, args...)
                if err2 != nil { c.JSON(500, gin.H{"message": err2.Error()}); return }
                out := make([]map[string]any, 0, len(rows2)); for _, r := range rows2 { out = append(out, map[string]any{"date": r["d"].String(), "value": r["cnt"].Int()}) }
                c.JSON(200, gin.H{"series": out})
            })
            adminV2.GET("/analytics/breakdown", func(c *gin.Context) {
                uid := strings.TrimSpace(c.Query("userId")); if uid == "" { c.JSON(400, gin.H{"message":"userId required"}); return }
                account := strings.TrimSpace(c.Query("account"))
                q := `SELECT campaign_id, SUM(clicks) as v FROM ads_metrics_daily WHERE user_id=? AND date>=DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
                args := []any{uid}
                if account != "" { q += " AND account_id=?"; args = append(args, account) }
                q += " GROUP BY campaign_id ORDER BY v DESC LIMIT 10"
                rows, err := gf.DB().Query(c, q, args...)
                if err == nil && len(rows) > 0 {
                    out := make([]map[string]any, 0, len(rows)); for _, r := range rows { out = append(out, map[string]any{"campaignId": r["campaign_id"].String(), "value": r["v"].Int()}) }
                    c.JSON(200, gin.H{"topCampaigns": out}); return
                }
                // 回退：Top 账户按轮换
                q = `SELECT b.account_id, COUNT(1) as cnt FROM ads_offer_rotations r JOIN ads_offer_bindings b ON b.id=r.binding_id WHERE b.user_id=?`
                args = []any{uid}
                if account != "" { q += " AND b.account_id=?"; args = append(args, account) }
                q += " GROUP BY b.account_id ORDER BY cnt DESC LIMIT 10"
                rows2, err2 := gf.DB().Query(c, q, args...)
                if err2 != nil { c.JSON(500, gin.H{"message": err2.Error()}); return }
                out := make([]map[string]any, 0, len(rows2)); for _, r := range rows2 { out = append(out, map[string]any{"accountId": r["account_id"].String(), "value": r["cnt"].Int()}) }
                c.JSON(200, gin.H{"topAccounts": out})
            })
        }

        // OPS（只读状态）
        ops := v2.Group("/ops")
        {
            ops.GET("/pool/state", func(c *gin.Context) {
                st := autoclick.GetPoolManager().State()
                c.JSON(200, gin.H{"httpQueue": st.HTTPQueue, "httpWorkers": st.HTTPWorkers, "browserQueue": st.BrowserQueue, "browserWorkers": st.BrowserWorkers, "httpThroughput": st.HTTPThroughput, "httpAvgWaitMs": st.HTTPAvgWaitMs, "browserThroughput": st.BrowserThroughput, "browserAvgWaitMs": st.BrowserAvgWaitMs })
            })
            // 预设：Referer 列表、默认 RPM 等
            ops.GET("/presets", func(c *gin.Context) {
                // referers from system_configs -> batchopen.referers(JSON)
                var referers []map[string]any
                if row, err := gf.DB().Raw("SELECT config_value FROM system_configs WHERE config_key=? AND is_active=1 LIMIT 1", "batchopen.referers").One(); err == nil && row != nil {
                    _ = json.Unmarshal([]byte(row["config_value"].String()), &referers)
                }
                if len(referers) == 0 {
                    referers = []map[string]any{{"id":"facebook","name":"Facebook","url":"https://facebook.com"},{"id":"twitter","name":"Twitter","url":"https://twitter.com"},{"id":"instagram","name":"Instagram","url":"https://instagram.com"}}
                }
                rpm := 0
                if v, ok := system.Get("automation.rpm_per_user"); ok { if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 { rpm = n } }
                c.JSON(200, gin.H{"referers": referers, "rpmPerUser": rpm})
            })
        }
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
            adscenterRG := v1.Group("/adscenter")
            {
                // 注册 v1 minimal 端点与执行创建
                app.RegisterAdsCenterMinimal(v1, authMiddleware(), gormDB)
                app.RegisterAdsCenterExecutions(v1, authMiddleware(), gormDB, adscenterService, tokenSvc, auditSvc)
                // 预检：按 extract_link + update_ads 规则估算总消耗
                adscenterRG.POST("/link:update:check", func(c *gin.Context) {
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
                    _, balance1, requiredExtract, err1 := tokenSvc.CheckTokenSufficiency(userID, "adscenter", "extract_link", len(body.AffiliateLinks))
					if err1 != nil { c.JSON(500, gin.H{"code": 500, "message": err1.Error()}); return }
                    _, _, requiredUpdate, err2 := tokenSvc.CheckTokenSufficiency(userID, "adscenter", "update_ads", len(body.AffiliateLinks))
					if err2 != nil { c.JSON(500, gin.H{"code": 500, "message": err2.Error()}); return }
					required := requiredExtract + requiredUpdate
					sufficient := balance1 >= required
					c.JSON(200, gin.H{"sufficient": sufficient, "balance": balance1, "required": required, "quantity": len(body.AffiliateLinks)})
                })

                // 执行：创建并启动任务（任务内部阶段性扣费），保持原子化在服务内部
                adscenterRG.POST("/link:update:execute", func(c *gin.Context) {
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
                creq := &adscenter.CreateTaskRequest{ Name: body.Name, AffiliateLinks: body.AffiliateLinks, AdsPowerProfile: body.AdsPowerProfile, GoogleAdsAccount: body.GoogleAdsAccount }
                    task, err := adscenterService.CreateTask(userID, creq)
					if err != nil {
                        if auditSvc != nil { _ = auditSvc.LogAdsCenterAction(userID, "create", "", map[string]any{"links": len(body.AffiliateLinks), "error": err.Error()}, c.ClientIP(), c.Request.UserAgent(), false, err.Error(), 0) }
						c.JSON(500, gin.H{"code": 500, "message": err.Error()})
						return
					}
					// 启动任务
                    go func() {
                        if err := adscenterService.StartTask(task.ID); err != nil {
                            if auditSvc != nil { _ = auditSvc.LogAdsCenterAction(userID, "start", task.ID, map[string]any{"links": len(body.AffiliateLinks), "error": err.Error()}, c.ClientIP(), c.Request.UserAgent(), false, err.Error(), 0) }
						} else {
                            if auditSvc != nil { _ = auditSvc.LogAdsCenterAction(userID, "start", task.ID, map[string]any{"links": len(body.AffiliateLinks)}, c.ClientIP(), c.Request.UserAgent(), true, "", 0) }
						}
                    }()
                    if iKey != "" && gormDB != nil { _ = gormDB.Exec("UPDATE idempotency_requests SET status='DONE' WHERE user_id=? AND endpoint=? AND idem_key=?", userID, "adscenter.link.update.execute", iKey).Error }
                    c.JSON(200, gin.H{"taskId": task.ID, "status": string(task.Status)})
                })

                // ===== v1: minimal accounts/configurations/executions =====
                // 已迁移至 internal/app：RegisterAdsCenterMinimal

                // GET /api/v1/adscenter/configurations → moved to internal/app

                // POST /api/v1/adscenter/configurations → moved to internal/app

                // POST /api/v1/adscenter/executions（分阶段扣费：每处理1项先扣1次，失败立即退款；附带审计分类）
                adscenterRG.POST("/executions", func(c *gin.Context) {
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

                // GET /api/v1/adscenter/executions → moved to internal/app

                // GET /api/v1/adscenter/executions/:id → moved to internal/app
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
    // 兼容旧API路径（已迁移至 /api/adscenter/*）
    r.POST("/api/batchopen/silent-start", handleSilentStart)
	r.GET("/api/batchopen/silent-progress", handleSilentProgress)
	r.POST("/api/batchopen/silent-terminate", handleSilentTerminate)
	r.POST("/api/autoclick/tasks", handleAutoClickCreate)
	r.GET("/api/autoclick/tasks/:id/progress", handleAutoClickProgress)
	r.GET("/api/siterank/rank", handleSiteRank)
	r.POST("/api/adscenter/create", handleAdsCenterCreate)
	r.GET("/api/adscenter/tasks", handleAdsCenterTasks)
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
    // Idempotency-Key 支持（按用户+Key 5分钟窗口）
    if storeRedis != nil {
        key := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
        uid := c.GetString("user_id")
        if key != "" && uid != "" {
            rkey := "idem:batch:silent:" + uid + ":" + sha1Hex(key)
            if v, _ := storeRedis.Get(c, rkey); v != "" {
                // 直接返回上次的响应体
                c.Writer.Header().Set("X-Idempotent", "1")
                c.Data(200, "application/json", []byte(v))
                return
            }
            // 包裹响应写回缓存
            rr := &responseRecorder{ResponseWriter: c.Writer, buf: &bytes.Buffer{}}
            c.Writer = rr
            // 审计
            auditLog("batch_silent_start", map[string]interface{}{"user_id": uid, "idempotency": true})
            ctrl := batchgo.NewController(batchService, gormDB)
            ctrl.SilentStart(c)
            if rr.status == 200 && rr.buf.Len() > 0 {
                _ = storeRedis.Set(c, rkey, rr.buf.String(), 5*time.Minute)
            }
            return
        }
    }
    // 审计（非幂等）
    auditLog("batch_silent_start", map[string]interface{}{"user_id": c.GetString("user_id"), "idempotency": false})
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

func handleAdsCenterCreate(c *gin.Context) {
    if adscenterService == nil {
        c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
        return
    }
    userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(200, gin.H{"code": 3001, "message": "用户未认证"})
		return
	}
    var req adscenter.CreateTaskRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(200, gin.H{"code": 1001, "message": "参数错误: " + err.Error()})
        return
    }
    task, err := adscenterService.CreateTask(userID, &req)
    if err != nil {
        c.JSON(200, gin.H{"code": 2001, "message": err.Error()})
        return
    }
    c.JSON(200, gin.H{"code": 0, "message": "任务创建成功", "data": task})
}

func handleAdsCenterTasks(c *gin.Context) {
    if adscenterService == nil {
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
    tasks, total, err := adscenterService.GetUserTasks(userID, page, size)
    if err != nil {
        c.JSON(200, gin.H{"code": 2004, "message": err.Error()})
        return
    }
    c.JSON(200, gin.H{"code": 0, "message": "获取成功", "data": gin.H{"tasks": tasks, "pagination": gin.H{"page": page, "size": size, "total": total, "pages": (total + int64(size) - 1) / int64(size)}}})
}

func handleAdsCenterTask(c *gin.Context) {
    c.JSON(200, gin.H{"message": "AdsCenter task endpoint"})
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

// ===== v2 辅助函数 =====

// buildExecutionUpdateSnapshot 统一生成 ExecutionUpdate 快照
func buildExecutionUpdateSnapshot(c *gin.Context, id string) (map[string]any, bool, error) {
    nowMs := time.Now().UnixMilli()
    // 1) BatchOpen（batch_tasks）
    var bt batchgo.BatchTask
    if err := gormDB.Where("id=?", id).First(&bt).Error; err == nil && bt.ID != "" {
        total := bt.URLCount
        processed := bt.ProcessedCount
        prog := 0
        if total > 0 { prog = int(float64(processed) / float64(total) * 100.0 + 0.5) }
        return map[string]any{
            "type": "execution_update", "id": bt.ID, "feature": "batchopen",
            "status": bt.Status, "progress": prog, "processedItems": processed, "totalItems": total, "ts": nowMs,
        }, true, nil
    }
    // 2) AutoClick（autoclick_executions）
    var ae autoclick.AutoClickExecution
    if err := gormDB.Where("id=?", id).First(&ae).Error; err == nil && ae.ID != "" {
        total := ae.Total
        processed := ae.Success + ae.Fail
        prog := 0
        if total > 0 { prog = int(float64(processed) / float64(total) * 100.0 + 0.5) }
        return map[string]any{
            "type": "execution_update", "id": ae.ID, "feature": "autoclick",
            "status": ae.Status, "progress": prog, "processedItems": processed, "totalItems": total, "ts": nowMs,
        }, true, nil
    }
    // 3) AdsCenter（adscenter_tasks）
    var at adscenter.AdsCenterTask
    if err := gormDB.Where("id=?", id).First(&at).Error; err == nil && at.ID != "" {
        total := at.TotalLinks
        processed := at.ExtractedCount + at.UpdatedCount + at.FailedCount
        prog := 0
        if total > 0 { prog = int(float64(processed) / float64(total) * 100.0 + 0.5) }
        return map[string]any{
            "type": "execution_update", "id": at.ID, "feature": "adscenter",
            "status": at.Status, "progress": prog, "processedItems": processed, "totalItems": total, "ts": nowMs,
        }, true, nil
    }
    return nil, false, nil
}

// resolveGoogleAdsClient 根据 account 参数返回 Mock 或真实客户端
func resolveGoogleAdsClient(c *gin.Context, userID string, account string) (adscenter.GoogleAdsClientInterface, error) {
    if strings.ToLower(account) == "mock" {
        return adscenter.NewMockGoogleAdsClient(), nil
    }
    var cfg adscenter.GoogleAdsConfig
    if err := gormDB.Where("user_id=? AND (customer_id=? OR name=?) AND is_active=1", userID, account, account).First(&cfg).Error; err != nil {
        return nil, fmt.Errorf("account not found")
    }
    return adscenter.NewGoogleAdsClient(&cfg), nil
}

// rebuildURLWithSuffix 将给定 URL 的 query 替换为指定 suffix（保留 origin+path）
func rebuildURLWithSuffix(u string, suffix string) string {
    parsed, err := url.Parse(u)
    if err != nil { return u }
    parsed.RawQuery = strings.TrimPrefix(strings.TrimSpace(suffix), "?")
    // 去除 fragment
    parsed.Fragment = ""
    return parsed.String()
}

func countSuccess(res []adscenter.UpdateAdResponse) int { n:=0; for _, r := range res { if r.Success { n++ } }; return n }

// sha1Hex 计算字符串 SHA1 hex
func sha1Hex(s string) string {
    h := sha1.New()
    _, _ = h.Write([]byte(s))
    return fmt.Sprintf("%x", h.Sum(nil))
}

// resolveOfferURL 简化解析：优先调用浏览器执行器（若配置），否则跟随 HTTP 重定向
func resolveOfferURL(ctx context.Context, offer string) map[string]any {
    // 优先浏览器执行器（AutoClick_Browser_Executor_URL 或 ADSCENTER_EXECUTOR_URL）
    execURL := strings.TrimSpace(os.Getenv("PUPPETEER_EXECUTOR_URL"))
    if execURL == "" {
        if v, ok := system.Get("AutoClick_Browser_Executor_URL"); ok && v != "" { execURL = v }
    }
    if execURL != "" {
        // 约定 /resolve?url=
        req, _ := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s/resolve?url=%s", strings.TrimRight(execURL, "/"), url.QueryEscape(offer)), nil)
        resp, err := http.DefaultClient.Do(req)
        if err == nil && resp.StatusCode == 200 {
            defer resp.Body.Close()
            var m map[string]any
            if err2 := json.NewDecoder(resp.Body).Decode(&m); err2 == nil {
                // 期望包含 finalUrl/ finalUrlSuffix
                if m != nil { return m }
            }
        }
    }
    // 回退：HTTP 客户端跟随 10 次重定向
    client := &http.Client{ CheckRedirect: func(req *http.Request, via []*http.Request) error { if len(via) >= 10 { return http.ErrUseLastResponse }; return nil } }
    req, _ := http.NewRequestWithContext(ctx, "GET", offer, nil)
    resp, err := client.Do(req)
    if err != nil { return map[string]any{"ok": false, "message": err.Error()} }
    defer resp.Body.Close()
    final := resp.Request.URL
    // 标准化
    final.Fragment = ""
    finalURL := fmt.Sprintf("%s://%s%s", final.Scheme, final.Host, final.Path)
    suffix := strings.TrimPrefix(final.RawQuery, "?")
    return map[string]any{"ok": true, "finalUrl": finalURL, "finalUrlSuffix": suffix}
}

func ifZeroInt(v int, def int) int { if v == 0 { return def }; return v }

// responseRecorder 用于捕获响应以支持幂等缓存
type responseRecorder struct {
    gin.ResponseWriter
    buf    *bytes.Buffer
    status int
}
func (r *responseRecorder) WriteHeader(code int) { r.status = code; r.ResponseWriter.WriteHeader(code) }
func (r *responseRecorder) Write(b []byte) (int, error) {
    if r.buf != nil { _, _ = r.buf.Write(b) }
    return r.ResponseWriter.Write(b)
}

// ===== 调度器：AdsCenter 自动轮换 =====
type AdsRotateJob struct{}
func (j *AdsRotateJob) GetName() string        { return "adscenter_auto_rotate" }
func (j *AdsRotateJob) GetDescription() string { return "Auto rotate offers by bindings when due" }
func (j *AdsRotateJob) Run(ctx context.Context) error {
    if gormDB == nil { return nil }
    now := time.Now()
    // 查询到期的绑定（每次最多处理50条）
    type B struct { AdsOfferBinding; OfferURL string }
    rows := []B{}
    // 允许 next_rotation_at 为空时按频率默认计算
    _ = gormDB.Raw(`SELECT b.*, o.offer_url as offer_url FROM ads_offer_bindings b JOIN ads_offers o ON o.id=b.offer_id
        WHERE b.active=1 AND (b.next_rotation_at IS NULL OR b.next_rotation_at<=?) LIMIT 50`, now).Scan(&rows).Error
    for _, r := range rows {
        // 解析 + 唯一性校验
        var (
            finalURL string
            finalSuf string
            st       = "ok"
            msg      = ""
        )
        for attempt:=0; attempt<3; attempt++ {
            res := resolveOfferURL(ctx, r.OfferURL)
            if res["ok"] != true { st = "error"; msg = gf.String(res["message"]); break }
            finalURL = gf.String(res["finalUrl"])
            finalSuf = gf.String(res["finalUrlSuffix"])
            if finalURL == "" { st = "error"; msg = "empty final url"; break }
            hash := sha1Hex(strings.ToLower(finalURL+"?"+finalSuf))
            var cnt int64
            win := ifZeroInt(r.UniqueWindowDays, 90)
            _ = gormDB.Model(&AdsOfferRotation{}).Where("binding_id=? AND final_hash=? AND rotated_at>=?", r.ID, hash, now.AddDate(0,0,-win)).Count(&cnt).Error
            if cnt == 0 { break }
            if attempt == 2 { st = "skip"; msg = "duplicate within unique window" }
        }
        rot := &AdsOfferRotation{ ID: gf.UUID(), BindingID: r.ID, AccountID: r.AccountID, RotatedAt: now, FinalURL: finalURL, FinalURLSuffix: finalSuf, FinalHash: sha1Hex(strings.ToLower(finalURL+"?"+finalSuf)), Status: st, Message: msg }
        _ = gormDB.Create(rot).Error
        // 计算下次时间
        next := now.Add(24 * time.Hour)
        switch strings.ToLower(r.RotationFrequency) { case "hourly": next = now.Add(1*time.Hour); case "weekly": next = now.Add(7*24*time.Hour) }
        _ = gormDB.Model(&AdsOfferBinding{}).Where("id=?", r.ID).Updates(map[string]any{"last_rotation_at": now, "next_rotation_at": next, "updated_at": now}).Error
    }
    return nil
}

// ===== 调度器：AdsCenter 指标采集 =====
type AdsMetricsCollectorJob struct{}
func (j *AdsMetricsCollectorJob) GetName() string        { return "adscenter_metrics_collect" }
func (j *AdsMetricsCollectorJob) GetDescription() string { return "Collect Google Ads daily metrics (backfill + hourly)" }
func (j *AdsMetricsCollectorJob) Run(ctx context.Context) error {
    if gormDB == nil { return nil }
    backfillDays := 7
    perDelay := 300 // ms per account delay
    maxRetry := 3
    backoffMs := 500
    if v, ok := system.Get("adscenter.collect.backfillDays"); ok { if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 { backfillDays = n } }
    if v, ok := system.Get("adscenter.collect.perAccountDelayMs"); ok { if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n >= 0 { perDelay = n } }
    if v, ok := system.Get("adscenter.collect.retryMax"); ok { if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 { maxRetry = n } }
    if v, ok := system.Get("adscenter.collect.retryBackoffMs"); ok { if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 { backoffMs = n } }
    var cfgs []adscenter.GoogleAdsConfig
    if err := gormDB.Where("is_active=1").Find(&cfgs).Error; err != nil { return nil }
    for _, cfg := range cfgs {
        var client adscenter.GoogleAdsClientInterface
        if strings.ToLower(cfg.CustomerID) == "mock" { client = adscenter.NewMockGoogleAdsClient() } else { client = adscenter.NewGoogleAdsClient(&cfg) }
        var last string
        _ = gormDB.Model(&AdsMetricsDaily{}).Select("MAX(date)").Where("user_id=? AND account_id=?", cfg.UserID, cfg.CustomerID).Scan(&last)
        today := time.Now().UTC()
        start := today.AddDate(0,0,-backfillDays)
        if last != "" { if t, err := time.Parse("2006-01-02", last); err == nil { start = t.AddDate(0,0,1) } }
        if start.After(today) { continue }
        // 速率限制：逐账号延时
        if perDelay > 0 { time.Sleep(time.Duration(perDelay) * time.Millisecond) }
        // 带退避的重试
        var rows []adscenter.DailyMetric
        var err error
        for attempt:=0; attempt<maxRetry; attempt++ {
            rows, err = client.GetDailyMetrics(start.Format("2006-01-02"), today.Format("2006-01-02"))
            if err == nil { break }
            msg := strings.ToLower(err.Error())
            if strings.Contains(msg, "resource_exhausted") || strings.Contains(msg, "rate") || strings.Contains(msg, "quota") || strings.Contains(msg, "deadline") || strings.Contains(msg, "unavailable") {
                time.Sleep(time.Duration(backoffMs*(1<<attempt)) * time.Millisecond)
                continue
            }
            break
        }
        if err != nil { continue }
        // 删除重复日期后插入
        dates := map[string]bool{}
        for _, r := range rows { dates[r.Date] = true }
        for d := range dates { _ = gormDB.Where("user_id=? AND account_id=? AND date=?", cfg.UserID, cfg.CustomerID, d).Delete(&AdsMetricsDaily{}).Error }
        now := time.Now()
        for _, r := range rows {
            rec := &AdsMetricsDaily{ UserID: cfg.UserID, AccountID: cfg.CustomerID, Date: r.Date, CampaignID: r.CampaignID, AdGroupID: r.AdGroupID, Device: r.Device, Network: r.Network, Clicks: r.Clicks, Impressions: r.Impressions, CostMicros: r.CostMicros, Conversions: r.Conversions, ConvValueMicros: r.ConvValueMicros, VTC: r.VTC, CreatedAt: now, UpdatedAt: now }
            _ = gormDB.Create(rec).Error
        }
    }
    return nil
}
