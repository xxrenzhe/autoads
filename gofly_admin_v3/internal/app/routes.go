package app

import (
    // "fmt"
    // "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/internal/admin"
    "gofly-admin-v3/internal/system"
    "gofly-admin-v3/internal/upload"
    "gofly-admin-v3/utils/gf"
    "strings"
    "path/filepath"
    "gofly-admin-v3/internal/middleware"
    "gofly-admin-v3/internal/subscription"
    "gofly-admin-v3/internal/invitation"
    "gofly-admin-v3/internal/checkin"
    internaluser "gofly-admin-v3/internal/user"
    "encoding/json"
    "sync"
	// "gofly-admin-v3/internal/adscentergo"
	// "gofly-admin-v3/internal/auth"
	// "gofly-admin-v3/internal/batchgo"
	// "gofly-admin-v3/internal/chengelink"
	// "gofly-admin-v3/internal/checkin"  // 暂时禁用
	// "gofly-admin-v3/internal/invitation"  // 暂时禁用
	"gofly-admin-v3/internal/metrics"
	// "gofly-admin-v3/internal/models"
	// "gofly-admin-v3/internal/personalcenter"  // 暂时禁用
	// "gofly-admin-v3/internal/ratelimit"
	// "gofly-admin-v3/internal/siterankgo"
	// "gofly-admin-v3/internal/token"  // 暂时禁用
)

// SetupRoutes 设置路由
func SetupRoutes(router *gin.Engine, ctx *Context) {
	// 注入服务到上下文
	router.Use(func(c *gin.Context) {
		c.Set("userService", ctx.UserService)
		c.Set("authService", ctx.AuthService)
		// c.Set("adminService", ctx.AdminService)
		c.Set("oauthService", ctx.OAuthService)
		// c.Set("tokenService", ctx.TokenService)
		c.Set("batchGoService", ctx.BatchGoService)
		// c.Set("siteRankGoService", ctx.SiteRankGoService)
		// c.Set("adsCenterGoService", ctx.AdsCenterGoService)
		// c.Set("chengelinkService", ctx.ChengelinkService)
		// c.Set("invitationService", ctx.InvitationService)
		// c.Set("checkinService", ctx.CheckinService)
		// c.Set("personalCenterService", ctx.PersonalCenterService)
		c.Set("rateLimitManager", ctx.RateLimitManager)
		c.Next()
	})

	// 设置监控和指标路由
	metrics.SetupMetrics(router)

	// 初始化系统配置缓存并注册示例回调（可按需替换为具体模块刷新逻辑）
system.Init()
// 配置变更回调示例：上传模块
system.On("max_file_size", func(key, value string) {
        // 动态调整上传大小限制
        if us := upload.GetUploadService(); us != nil {
            if v := gf.Int(value); v > 0 { us.Config().MaxFileSize = int64(v) }
        }
    })
system.On("allowed_file_types", func(key, value string) {
        // 允许类型，例如："image,document"
        if us := upload.GetUploadService(); us != nil {
            m := map[string]bool{}
            for _, p := range strings.Split(value, ",") { p = strings.TrimSpace(p); if p != "" { m[strings.ToLower(p)] = true } }
            // 映射到 FileType
            us.Config().AllowedTypes = map[upload.FileType]bool{
                upload.FileTypeImage: m["image"],
                upload.FileTypeDoc:   m["document"],
                upload.FileTypeVideo: m["video"],
                upload.FileTypeAudio: m["audio"],
            }
        }
    })

	// 全局中间件
    router.Use(ErrorHandler())
    router.Use(Logger())
    router.Use(RequestContext())
    // 统一限流中间件（默认内存实现；如需 Redis 可在初始化处注入）
    rl := middleware.NewRateLimitMiddleware(middleware.DefaultRateLimitConfig, nil)
    router.Use(rl.GlobalRateLimit())
    router.Use(rl.IPRateLimit())
    router.Use(rl.APIRateLimit())
    // 套餐限流（可选，通过 Header: X-User-Plan 或其他上下文解析），并支持热更新
    // 简易用户套餐缓存（TTL 60s）
    type cacheItem struct{ v string; exp time.Time }
    var (
        planCache = struct {
            mu sync.RWMutex
            m  map[string]cacheItem
        }{m: map[string]cacheItem{}}
        cacheTTL = 60 * time.Second
    )
    resolvePlan := func(c *gin.Context) string {
        // 1) Header 显式指定优先（便于调试）
        if p := strings.ToUpper(strings.TrimSpace(c.GetHeader("X-User-Plan"))); p != "" {
            return p
        }
        // 2) 根据 user_id 查询当前订阅的套餐名，并做短期缓存
        uid := c.GetString("user_id")
        if uid == "" { return "" }
        now := time.Now()
        // 2.1 Redis 缓存（多实例一致）
        if r := gf.Redis(); r != nil {
            if v, err := r.Do(c, "GET", "user:plan:"+uid); err == nil && v != nil {
                if s := strings.ToUpper(strings.TrimSpace(gf.String(v))); s != "" {
                    return s
                }
            }
        }
        planCache.mu.RLock()
        if it, ok := planCache.m[uid]; ok && it.exp.After(now) {
            planCache.mu.RUnlock()
            return it.v
        }
        planCache.mu.RUnlock()
        // 读取数据库
        rec, err := gf.DB().Raw(`SELECT p.name FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? AND s.status='ACTIVE' ORDER BY s.updated_at DESC LIMIT 1`, uid).One()
        if err != nil || rec == nil { return "" }
        name := strings.ToUpper(strings.TrimSpace(rec["name"].String()))
        planCache.mu.Lock()
        planCache.m[uid] = cacheItem{ v: name, exp: now.Add(cacheTTL) }
        planCache.mu.Unlock()
        if r := gf.Redis(); r != nil && name != "" {
            _, _ = r.Do(c, "SETEX", "user:plan:"+uid, int(cacheTTL.Seconds()), name)
        }
        return name
    }
    router.Use(rl.PlanAPIRateLimit(resolvePlan))

    // 从 system_configs 加载套餐限流规则（JSON），并订阅 Redis 通知刷新
    loadPlanRates := func() {
        row, err := gf.DB().Raw("SELECT config_value FROM system_configs WHERE config_key=? AND is_active=1 LIMIT 1", "rate_limit_plans").One()
        if err != nil || row == nil { return }
        val := row["config_value"].String()
        if strings.TrimSpace(val) == "" { return }
        // 期望 JSON 形如：{"FREE":{"rps":5,"burst":10},"PRO":{"rps":50,"burst":100}}
        type planItem struct { Rps float64 `json:"rps"`; Burst int `json:"burst"` }
        var raw map[string]planItem
        if err := json.Unmarshal([]byte(val), &raw); err != nil { return }
        rates := map[string]middleware.PlanRateConfig{}
        for k, v := range raw {
            rates[strings.ToUpper(strings.TrimSpace(k))] = middleware.PlanRateConfig{ RPS: v.Rps, Burst: v.Burst }
        }
        rl.SetPlanRates(rates, nil)
    }
    loadPlanRates()
    go func() {
        r := gf.Redis(); if r == nil { return }
        conn, _, err := r.GroupPubSub().Subscribe(nil, "ratelimit:plans:update")
        if err != nil { return }
        for {
            _, err := conn.ReceiveMessage(nil)
            if err == nil { loadPlanRates() }
            time.Sleep(50 * time.Millisecond)
        }
    }()

    // 订阅变更 -> 计划缓存失效
    go func() {
        r := gf.Redis(); if r == nil { return }
        conn, _, err := r.GroupPubSub().Subscribe(nil, "user:plan:invalidate")
        if err != nil { return }
        for {
            msg, err := conn.ReceiveMessage(nil)
            if err != nil || msg == nil { time.Sleep(100 * time.Millisecond); continue }
            uid := strings.TrimSpace(msg.Payload)
            if uid == "" { continue }
            planCache.mu.Lock()
            delete(planCache.m, uid)
            planCache.mu.Unlock()
        }
    }()
	// API访问日志（用于Analytics/Performance）
	router.Use(ApiAccessLogger())
	router.Use(metrics.GetMetrics().HTTPMiddleware())

    // 静态托管管理前端（Vite构建产物） /console
    distDir := filepath.Join("web", "dist")
    router.Static("/console/assets", filepath.Join(distDir, "assets"))
    router.StaticFile("/console", filepath.Join(distDir, "index.html"))
    // 配置聚合只读快照（供 Next 读取）：/ops/console/config/v1
    router.GET("/ops/console/config/v1", system.GetEffectiveConfig)
    router.NoRoute(func(c *gin.Context) {
        p := c.Request.URL.Path
        if strings.HasPrefix(p, "/console") {
            c.File(filepath.Join(distDir, "index.html"))
            return
        }
        c.JSON(404, gin.H{"message": "not found"})
    })

	// API版本分组
	v1 := router.Group("/api/v1")
	{
        // 解析内部JWT（非强制），用于用户态只读接口
        v1.Use(middleware.InternalJWTAuth(false))
        // 管理员登录（JWT）
        v1.POST("/console/login", admin.AdminLoginHandler)
        // 管理员受保护路由（JWT）
			adminGroup := v1.Group("/console")
			adminGroup.Use(admin.AdminJWT())
		{
			controller := admin.NewAdminController(nil, nil, nil, nil)
			adminGroup.GET("/system/config", controller.GetSystemConfig)
			adminGroup.POST("/system/config", controller.UpsertSystemConfig)
			adminGroup.DELETE("/system/config/:key", controller.DeleteSystemConfig)
			adminGroup.GET("/system/config/history", controller.GetSystemConfigHistory)

            rateLimitController := admin.NewRateLimitController(ctx.RateLimitManager)
            rateLimitController.RegisterRoutes(adminGroup)

            // API管理（端点与API Key）
            apiMgmt := &admin.ApiManagementController{}
            apiGroup := adminGroup.Group("/api-management")
            {
                // Endpoints
                apiGroup.GET("/endpoints", apiMgmt.ListEndpoints)
                apiGroup.POST("/endpoints", apiMgmt.CreateEndpoint)
                apiGroup.PUT("/endpoints/:id", apiMgmt.UpdateEndpoint)
                apiGroup.DELETE("/endpoints/:id", apiMgmt.DeleteEndpoint)
                apiGroup.POST("/endpoints/:id/toggle", apiMgmt.ToggleEndpoint)
                apiGroup.GET("/endpoints/:id/metrics", apiMgmt.GetEndpointMetrics)

                // API Keys
                apiGroup.GET("/keys", apiMgmt.ListKeys)
                apiGroup.POST("/keys", apiMgmt.CreateKey)
                apiGroup.PUT("/keys/:id", apiMgmt.UpdateKey)
                apiGroup.DELETE("/keys/:id", apiMgmt.DeleteKey)
                apiGroup.POST("/keys/:id/revoke", apiMgmt.RevokeKey)

                // Analytics & Performance（迁移自Next.js管理台）
                apiGroup.GET("/analytics", apiMgmt.GetAnalytics)
                apiGroup.GET("/performance", apiMgmt.GetPerformance)
            }

            // 用户管理
            admin.RegisterUserRoutes(adminGroup)

            // 订阅与计划（手动分配）
            admin.RegisterSubscriptionRoutes(adminGroup)

            // Token 管理
            admin.RegisterTokenRoutes(adminGroup)

            // 监控与告警
            admin.RegisterMonitoringRoutes(adminGroup)

            // 管理员与角色
            admin.RegisterAdminAccountRoutes(adminGroup)
		}

        // 用户只读接口（依赖 InternalJWTAuth 提供的 user_id）
        userGroup := v1.Group("/user")
        {
            userGroup.GET("/subscription/current", subscription.GetCurrentUserSubscription)
        }

		// 用户相关路由 - TODO: Fix user service initialization
		/*
			userGroup := v1.Group("/user")
			{
				// 注册 - 使用请求验证
				userGroup.POST("/register", ValidateRequest(&models.RegisterRequest{}), func(c *gin.Context) {
					userService := c.MustGet("userService").(*user.Service)
					authService := c.MustGet("authService").(*auth.Service)
					controller := user.NewController(authService, userService)
					controller.Register(c)
				})
				// 登录 - 使用请求验证
				userGroup.POST("/login", ValidateRequest(&models.LoginRequest{}), func(c *gin.Context) {
					userService := c.MustGet("userService").(*user.Service)
					authService := c.MustGet("authService").(*auth.Service)
					controller := user.NewController(authService, userService)
					controller.Login(c)
				})
				userGroup.POST("/google-login", func(c *gin.Context) {
					userService := c.MustGet("userService").(*user.Service)
					authService := c.MustGet("authService").(*auth.Service)
					controller := user.NewController(authService, userService)
					controller.GoogleLogin(c)
				})
				userGroup.GET("/profile", UserAuth(), func(c *gin.Context) {
					userService := c.MustGet("userService").(*user.Service)
					authService := c.MustGet("authService").(*auth.Service)
					controller := user.NewController(authService, userService)
					controller.Profile(c)
				})
				// 更新资料 - 使用请求验证
				userGroup.PUT("/profile", UserAuth(), ValidateRequest(&models.UpdateProfileRequest{}), func(c *gin.Context) {
					userService := c.MustGet("userService").(*user.Service)
					authService := c.MustGet("authService").(*auth.Service)
					controller := user.NewController(authService, userService)
					controller.UpdateProfile(c)
				})
			}
		*/
		/*
			// 修改密码 - 使用请求验证
			userGroup.POST("/change-password", UserAuth(), ValidateRequest(&models.UpdatePasswordRequest{}), func(c *gin.Context) {
				userService := c.MustGet("userService").(*user.Service)
				authService := c.MustGet("authService").(*auth.Service)
				controller := user.NewController(authService, userService)
				controller.ChangePassword(c)
			})
			userGroup.POST("/start-trial", UserAuth(), func(c *gin.Context) {
				userService := c.MustGet("userService").(*user.Service)
				authService := c.MustGet("authService").(*auth.Service)
				controller := user.NewController(authService, userService)
				controller.StartTrial(c)
			})
			userGroup.POST("/refresh-token", UserAuth(), func(c *gin.Context) {
				userService := c.MustGet("userService").(*user.Service)
				authService := c.MustGet("authService").(*auth.Service)
				controller := user.NewController(authService, userService)
				controller.RefreshToken(c)
			})
			userGroup.POST("/logout", UserAuth(), func(c *gin.Context) {
				userService := c.MustGet("userService").(*user.Service)
				authService := c.MustGet("authService").(*auth.Service)
				controller := user.NewController(authService, userService)
				controller.Logout(c)
			})
			// Google OAuth回调
			userGroup.GET("/google/callback", func(c *gin.Context) {
				userService := c.MustGet("userService").(*user.Service)
				authService := c.MustGet("authService").(*auth.Service)
				controller := user.NewController(authService, userService)
				controller.GoogleOAuthCallback(c)
			})
			}
		*/

		// 管理员路由 - 登录相关（无需认证）
		_ = v1.Group("/admin")
		{
			// adminGroup.POST("/login", AdminLogin) // TODO: Fix admin service
		}

		// 管理员路由 - 需要认证 - TODO: Fix admin service initialization
		/*
				adminAuthGroup := v1.Group("/admin")
				adminAuthGroup.Use(AdminAuth())
				{
					// 仪表板
					adminAuthGroup.GET("/dashboard", func(c *gin.Context) {
						adminService := c.MustGet("adminService").(*admin.Service)
						tokenService := c.MustGet("tokenService").(*token.Service)
						batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						rateLimitManager := c.MustGet("rateLimitManager").(*ratelimit.RateLimitManager)

						controller := admin.NewAdminController(
							adminService.UserService,
							tokenService,
							batchGoService,
							siteRankGoService,
							adsCenterGoService,
							rateLimitManager,
						)
						controller.Dashboard(c)
					})

					// 用户管理
					adminAuthGroup.GET("/users", func(c *gin.Context) {
						adminService := c.MustGet("adminService").(*admin.Service)
						tokenService := c.MustGet("tokenService").(*token.Service)
						batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						rateLimitManager := c.MustGet("rateLimitManager").(*ratelimit.RateLimitManager)

						controller := admin.NewAdminController(
							adminService.UserService,
							tokenService,
							batchGoService,
							siteRankGoService,
							adsCenterGoService,
							rateLimitManager,
						)
						controller.ListUsers(c)
					})
					adminAuthGroup.GET("/users/:id", func(c *gin.Context) {
						adminService := c.MustGet("adminService").(*admin.Service)
						tokenService := c.MustGet("tokenService").(*token.Service)
						batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						rateLimitManager := c.MustGet("rateLimitManager").(*ratelimit.RateLimitManager)

						controller := admin.NewAdminController(
							adminService.UserService,
							tokenService,
							batchGoService,
							siteRankGoService,
							adsCenterGoService,
							rateLimitManager,
						)
						controller.GetUserDetail(c)
					})
					adminAuthGroup.PUT("/users/:id/status", func(c *gin.Context) {
						adminService := c.MustGet("adminService").(*admin.Service)
						tokenService := c.MustGet("tokenService").(*token.Service)
						batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						rateLimitManager := c.MustGet("rateLimitManager").(*ratelimit.RateLimitManager)

						controller := admin.NewAdminController(
							adminService.UserService,
							tokenService,
							batchGoService,
							siteRankGoService,
							adsCenterGoService,
							rateLimitManager,
						)
						controller.UpdateUserStatus(c)
					})
					adminAuthGroup.POST("/users/:id/adjust-token", func(c *gin.Context) {
						adminService := c.MustGet("adminService").(*admin.Service)
						tokenService := c.MustGet("tokenService").(*token.Service)
						batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						rateLimitManager := c.MustGet("rateLimitManager").(*ratelimit.RateLimitManager)

						controller := admin.NewAdminController(
							adminService.UserService,
							tokenService,
							batchGoService,
							siteRankGoService,
							adsCenterGoService,
							rateLimitManager,
						)
						controller.AdjustTokenBalance(c)
					})

					// 系统统计
					adminAuthGroup.GET("/system/stats", func(c *gin.Context) {
						adminService := c.MustGet("adminService").(*admin.Service)
						tokenService := c.MustGet("tokenService").(*token.Service)
						batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						rateLimitManager := c.MustGet("rateLimitManager").(*ratelimit.RateLimitManager)

						controller := admin.NewAdminController(
							adminService.UserService,
							tokenService,
							batchGoService,
							siteRankGoService,
							adsCenterGoService,
							rateLimitManager,
						)
						controller.GetSystemStats(c)
					})

					// 系统配置
					adminAuthGroup.GET("/system/config", func(c *gin.Context) {
						adminService := c.MustGet("adminService").(*admin.Service)
						tokenService := c.MustGet("tokenService").(*token.Service)
						batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						rateLimitManager := c.MustGet("rateLimitManager").(*ratelimit.RateLimitManager)

						controller := admin.NewAdminController(
							adminService.UserService,
							tokenService,
							batchGoService,
							siteRankGoService,
							adsCenterGoService,
							rateLimitManager,
						)
                    controller.GetSystemConfig(c)
                })
                // 系统配置管理（完善：增删改）
                adminAuthGroup.POST("/system/config", func(c *gin.Context) {
                    controller := admin.NewAdminController(
                        nil, nil, nil, nil,
                    )
                    controller.UpsertSystemConfig(c)
                })
                adminAuthGroup.DELETE("/system/config/:key", func(c *gin.Context) {
                    controller := admin.NewAdminController(
                        nil, nil, nil, nil,
                    )
                    controller.DeleteSystemConfig(c)
                })

					// 管理员自身管理
					adminAuthGroup.GET("/profile", func(c *gin.Context) {
						adminService := c.MustGet("adminService").(*admin.Service)
						controller := admin.NewAdminController(
							nil, nil, nil, nil, nil, nil,
						)
						controller.GetProfile(c)
					})
					adminAuthGroup.PUT("/profile", func(c *gin.Context) {
						adminService := c.MustGet("adminService").(*admin.Service)
						controller := admin.NewAdminController(
							nil, nil, nil, nil, nil, nil,
						)
						controller.UpdateProfile(c)
					})
					adminAuthGroup.POST("/change-password", func(c *gin.Context) {
						adminService := c.MustGet("adminService").(*admin.Service)
						controller := admin.NewAdminController(
							nil, nil, nil, nil, nil, nil,
						)
						controller.ChangePassword(c)
					})

					// 速率限制管理
					rateLimitController := admin.NewRateLimitController(ctx.RateLimitManager)
					rateLimitController.RegisterRoutes(adminAuthGroup)

					// 管理员管理（仅超级管理员）
					adminAuthGroup.Use(admin.SuperAdminAuth())
					{
						adminAuthGroup.GET("/admins", func(c *gin.Context) {
							adminService := c.MustGet("adminService").(*admin.Service)
							controller := admin.NewAdminController(
								nil, nil, nil, nil, nil, nil,
							)
							controller.ListAdmins(c)
						})
						adminAuthGroup.POST("/admins", func(c *gin.Context) {
							adminService := c.MustGet("adminService").(*admin.Service)
							controller := admin.NewAdminController(
								nil, nil, nil, nil, nil, nil,
							)
							controller.CreateAdmin(c)
						})
						adminAuthGroup.PUT("/admins/:id", func(c *gin.Context) {
							adminService := c.MustGet("adminService").(*admin.Service)
							controller := admin.NewAdminController(
								nil, nil, nil, nil, nil, nil,
							)
							controller.UpdateAdmin(c)
						})
						adminAuthGroup.DELETE("/admins/:id", func(c *gin.Context) {
							adminService := c.MustGet("adminService").(*admin.Service)
							controller := admin.NewAdminController(
								nil, nil, nil, nil, nil, nil,
							)
							controller.DeleteAdmin(c)
						})
					}
				}

				// 业务模块路由
				batchGroup := v1.Group("/batchgo")
				batchGroup.Use(UserAuth())
				{
					batchGroup.POST("/tasks", CreateBatchGoTask)
					batchGroup.GET("/tasks", ListBatchGoTasks)
					batchGroup.GET("/tasks/:id", GetBatchGoTask)
					batchGroup.PUT("/tasks/:id", UpdateBatchGoTask)
					batchGroup.DELETE("/tasks/:id", DeleteBatchGoTask)
					batchGroup.POST("/tasks/:id/start", func(c *gin.Context) {
						batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
						controller := batchgo.NewController(batchGoService)
						controller.StartTask(c)
					})
					batchGroup.POST("/tasks/:id/stop", func(c *gin.Context) {
						batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
						controller := batchgo.NewController(batchGoService)
						controller.StopTask(c)
					})
					batchGroup.GET("/stats", func(c *gin.Context) {
						batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
						controller := batchgo.NewController(batchGoService)
						controller.GetTaskStats(c)
					})

					// 增强功能路由
					batchGroup.POST("/tasks/:id/start-enhanced", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := batchgo.NewEnhancedController(db, redis)
						controller.StartEnhancedTask(c)
					})
					batchGroup.GET("/tasks/:id/progress", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := batchgo.NewEnhancedController(db, redis)
						controller.GetTaskProgress(c)
					})
					batchGroup.GET("/permissions", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := batchgo.NewEnhancedController(db, redis)
						controller.GetModePermissions(c)
					})
					batchGroup.GET("/running-tasks", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := batchgo.NewEnhancedController(db, redis)
						controller.GetRunningTasks(c)
					})
					batchGroup.POST("/stop-all", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := batchgo.NewEnhancedController(db, redis)
						controller.StopAllTasks(c)
					})
					batchGroup.POST("/clear-completed", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := batchgo.NewEnhancedController(db, redis)
						controller.ClearCompletedTasks(c)
					})

					// 代理管理
					batchGroup.POST("/proxies", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := batchgo.NewEnhancedController(db, redis)
						controller.AddProxy(c)
					})
					batchGroup.GET("/proxies", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := batchgo.NewEnhancedController(db, redis)
						controller.ListProxies(c)
					})
				}

				siterankGroup := v1.Group("/siterank")
				siterankGroup.Use(UserAuth())
				{
					siterankGroup.POST("/queries", func(c *gin.Context) {
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						controller := siterankgo.NewController(siteRankGoService)
						controller.CreateQuery(c)
					})
					siterankGroup.GET("/queries", func(c *gin.Context) {
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						controller := siterankgo.NewController(siteRankGoService)
						controller.ListQueries(c)
					})
					siterankGroup.GET("/queries/:id", func(c *gin.Context) {
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						controller := siterankgo.NewController(siteRankGoService)
						controller.GetQuery(c)
					})
					siterankGroup.PUT("/queries/:id", func(c *gin.Context) {
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						controller := siterankgo.NewController(siteRankGoService)
						controller.UpdateQuery(c)
					})
					siterankGroup.DELETE("/queries/:id", func(c *gin.Context) {
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						controller := siterankgo.NewController(siteRankGoService)
						controller.DeleteQuery(c)
					})
					siterankGroup.POST("/queries/:id/start", func(c *gin.Context) {
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						controller := siterankgo.NewController(siteRankGoService)
						controller.StartQuery(c)
					})
					siterankGroup.POST("/queries/:id/stop", func(c *gin.Context) {
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						controller := siterankgo.NewController(siteRankGoService)
						controller.StopQuery(c)
					})
					siterankGroup.GET("/stats", func(c *gin.Context) {
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						controller := siterankgo.NewController(siteRankGoService)
						controller.GetQueryStats(c)
					})
					siterankGroup.POST("/batch-query", func(c *gin.Context) {
						siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
						controller := siterankgo.NewController(siteRankGoService)
						controller.BatchQuery(c)
					})

					// 增强功能路由
					siterankGroup.POST("/enhanced-queries", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := siterankgo.NewEnhancedController(db, redis)
						controller.CreateEnhancedQuery(c)
					})
					siterankGroup.POST("/enhanced-queries/:id/start", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := siterankgo.NewEnhancedController(db, redis)
						controller.StartEnhancedQuery(c)
					})
					siterankGroup.GET("/enhanced-queries/:id/results", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := siterankgo.NewEnhancedController(db, redis)
						controller.GetQueryEnhancedResults(c)
					})
					siterankGroup.GET("/enhanced-stats", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := siterankgo.NewEnhancedController(db, redis)
						controller.GetEnhancedStats(c)
					})

					// SimilarWeb集成路由
					siterankGroup.GET("/similarweb", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := siterankgo.NewEnhancedController(db, redis)
						controller.GetSimilarWebData(c)
					})
					siterankGroup.POST("/similarweb/batch", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := siterankgo.NewEnhancedController(db, redis)
						controller.BatchGetSimilarWebData(c)
					})

					// 导出功能路由
					siterankGroup.GET("/queries/:id/export", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := siterankgo.NewEnhancedController(db, redis)
						controller.ExportResults(c)
					})
				}

				adsGroup := v1.Group("/adscenter")
				adsGroup.Use(UserAuth())
				{
					// 账户管理
					adsGroup.POST("/accounts", func(c *gin.Context) {
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						controller := adscentergo.NewController(adsCenterGoService)
						controller.CreateAccount(c)
					})
					adsGroup.GET("/accounts", func(c *gin.Context) {
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						controller := adscentergo.NewController(adsCenterGoService)
						controller.ListAccounts(c)
					})
					adsGroup.GET("/accounts/:id", func(c *gin.Context) {
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						controller := adscentergo.NewController(adsCenterGoService)
						controller.GetAccount(c)
					})
					adsGroup.PUT("/accounts/:id", func(c *gin.Context) {
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						controller := adscentergo.NewController(adsCenterGoService)
						controller.UpdateAccount(c)
					})
					adsGroup.DELETE("/accounts/:id", func(c *gin.Context) {
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						controller := adscentergo.NewController(adsCenterGoService)
						controller.DeleteAccount(c)
					})

					// 同步任务管理
					adsGroup.POST("/accounts/:id/sync", func(c *gin.Context) {
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						controller := adscentergo.NewController(adsCenterGoService)
						controller.CreateSyncTask(c)
					})
					adsGroup.GET("/accounts/:id/sync-tasks", func(c *gin.Context) {
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						controller := adscentergo.NewController(adsCenterGoService)
						controller.ListSyncTasks(c)
					})
					adsGroup.POST("/sync-tasks/:id/start", func(c *gin.Context) {
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						controller := adscentergo.NewController(adsCenterGoService)
						controller.StartSync(c)
					})
					adsGroup.POST("/sync-tasks/:id/stop", func(c *gin.Context) {
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						controller := adscentergo.NewController(adsCenterGoService)
						controller.StopSync(c)
					})

					// 统计信息
					adsGroup.GET("/stats", func(c *gin.Context) {
						adsCenterGoService := c.MustGet("adsCenterGoService").(*adscentergo.Service)
						controller := adscentergo.NewController(adsCenterGoService)
						controller.GetSyncTaskStats(c)
					})

					// 增强功能路由
					adsGroup.POST("/accounts/:id/connect-google", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := adscentergo.NewEnhancedController(db, redis)
						controller.ConnectGoogleAds(c)
					})
					adsGroup.POST("/batch-replace-links", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := adscentergo.NewEnhancedController(db, redis)
						controller.BatchReplaceLinks(c)
					})
					adsGroup.GET("/replace-status/:task_id", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := adscentergo.NewEnhancedController(db, redis)
						controller.GetReplaceStatus(c)
					})
					adsGroup.GET("/accounts/:id/performance", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := adscentergo.NewEnhancedController(db, redis)
						controller.GetAdPerformance(c)
					})
					adsGroup.GET("/accounts/:id/keywords", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := adscentergo.NewEnhancedController(db, redis)
						controller.GetKeywordPerformance(c)
					})
					adsGroup.GET("/accounts/:id/recommendations", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := adscentergo.NewEnhancedController(db, redis)
						controller.GetRecommendations(c)
					})
					adsGroup.GET("/accounts/:id/export", func(c *gin.Context) {
						db := c.MustGet("db").(*store.DB)
						redis := c.MustGet("redis").(*store.Redis)
						controller := adscentergo.NewEnhancedController(db, redis)
						controller.ExportAdData(c)
					})
				}

				// Token相关路由
				tokenGroup := v1.Group("/token")
				tokenGroup.Use(UserAuth())
				{
					tokenGroup.GET("/balance", func(c *gin.Context) {
						tokenService := c.MustGet("tokenService").(*token.Service)
						controller := token.NewController(tokenService)
						controller.GetBalance(c)
					})
					tokenGroup.GET("/stats", func(c *gin.Context) {
						tokenService := c.MustGet("tokenService").(*token.Service)
						controller := token.NewController(tokenService)
						controller.GetStats(c)
					})
					tokenGroup.GET("/transactions", func(c *gin.Context) {
						tokenService := c.MustGet("tokenService").(*token.Service)
						controller := token.NewController(tokenService)
						controller.GetTransactions(c)
					})
					tokenGroup.GET("/packages", func(c *gin.Context) {
						tokenService := c.MustGet("tokenService").(*token.Service)
						controller := token.NewController(tokenService)
						controller.GetPackages(c)
					})
					tokenGroup.POST("/orders", func(c *gin.Context) {
						tokenService := c.MustGet("tokenService").(*token.Service)
						controller := token.NewController(tokenService)
						controller.CreateOrder(c)
					})
					tokenGroup.GET("/orders", func(c *gin.Context) {
						tokenService := c.MustGet("tokenService").(*token.Service)
						controller := token.NewController(tokenService)
						controller.GetOrders(c)
					})
					tokenGroup.GET("/orders/:id", func(c *gin.Context) {
						tokenService := c.MustGet("tokenService").(*token.Service)
						controller := token.NewController(tokenService)
						controller.GetOrder(c)
					})
					tokenGroup.POST("/orders/:id/cancel", func(c *gin.Context) {
						tokenService := c.MustGet("tokenService").(*token.Service)
						controller := token.NewController(tokenService)
						controller.CancelOrder(c)
					})
					tokenGroup.POST("/calculate-cost", func(c *gin.Context) {
						tokenService := c.MustGet("tokenService").(*token.Service)
						controller := token.NewController(tokenService)
						controller.CalculateCost(c)
					})
				}

				// Chengelink相关路由
				chengelinkGroup := v1.Group("/chengelink")
				chengelinkGroup.Use(UserAuth())
				{
					// 配置管理
					chengelinkGroup.POST("/configs", func(c *gin.Context) {
						chengelinkService := c.MustGet("chengelinkService").(*chengelink.Service)
						controller := chengelink.NewController(chengelinkService)
						controller.CreateConfig(c)
					})
					chengelinkGroup.GET("/configs", func(c *gin.Context) {
						chengelinkService := c.MustGet("chengelinkService").(*chengelink.Service)
						controller := chengelink.NewController(chengelinkService)
						controller.GetConfigList(c)
					})
					chengelinkGroup.GET("/configs/:id", func(c *gin.Context) {
						chengelinkService := c.MustGet("chengelinkService").(*chengelink.Service)
						controller := chengelink.NewController(chengelinkService)
						controller.GetConfig(c)
					})
					chengelinkGroup.PUT("/configs/:id", func(c *gin.Context) {
						chengelinkService := c.MustGet("chengelinkService").(*chengelink.Service)
						controller := chengelink.NewController(chengelinkService)
						controller.UpdateConfig(c)
					})
					chengelinkGroup.DELETE("/configs/:id", func(c *gin.Context) {
						chengelinkService := c.MustGet("chengelinkService").(*chengelink.Service)
						controller := chengelink.NewController(chengelinkService)
						controller.DeleteConfig(c)
					})

					// 执行操作
					chengelinkGroup.POST("/configs/:id/execute", func(c *gin.Context) {
						chengelinkService := c.MustGet("chengelinkService").(*chengelink.Service)
						controller := chengelink.NewController(chengelinkService)
						controller.ExecuteExecution(c)
					})
					chengelinkGroup.GET("/configs/:id/history", func(c *gin.Context) {
						chengelinkService := c.MustGet("chengelinkService").(*chengelink.Service)
						controller := chengelink.NewController(chengelinkService)
						controller.GetExecutionHistory(c)
					})
					chengelinkGroup.GET("/configs/:id/mappings", func(c *gin.Context) {
						chengelinkService := c.MustGet("chengelinkService").(*chengelink.Service)
						controller := chengelink.NewController(chengelinkService)
						controller.GetLinkMappings(c)
					})

					// 测试功能
					chengelinkGroup.POST("/test", func(c *gin.Context) {
						chengelinkService := c.MustGet("chengelinkService").(*chengelink.Service)
						controller := chengelink.NewController(chengelinkService)
						controller.TestConfig(c)
					})
				}

				// 邀请系统路由
				invitationGroup := v1.Group("/invitation")
				invitationGroup.Use(UserAuth())
				{
					// 获取邀请码
					invitationGroup.GET("/code", func(c *gin.Context) {
						invitationService := c.MustGet("invitationService").(*invitation.Service)
						controller := invitation.NewController(invitationService)
						controller.GetInviteCode(c)
					})
					// 创建邀请码
					invitationGroup.POST("/create", func(c *gin.Context) {
						invitationService := c.MustGet("invitationService").(*invitation.Service)
						controller := invitation.NewController(invitationService)
						controller.CreateInvitation(c)
					})
					// 获取邀请列表
					invitationGroup.GET("/list", func(c *gin.Context) {
						invitationService := c.MustGet("invitationService").(*invitation.Service)
						controller := invitation.NewController(invitationService)
						controller.GetInvitationList(c)
					})
					// 获取邀请统计
					invitationGroup.GET("/stats", func(c *gin.Context) {
						invitationService := c.MustGet("invitationService").(*invitation.Service)
						controller := invitation.NewController(invitationService)
						controller.GetInvitationStats(c)
					})
					// 接受邀请
					invitationGroup.POST("/accept", func(c *gin.Context) {
						invitationService := c.MustGet("invitationService").(*invitation.Service)
						controller := invitation.NewController(invitationService)
						controller.AcceptInvitation(c)
					})
				}

				// 公开路由 - 验证邀请码（无需认证）
				v1.GET("/invitation/validate", func(c *gin.Context) {
					invitationService := ctx.InvitationService
					controller := invitation.NewController(invitationService)
					controller.ValidateInviteCode(c)
				})

				// 签到系统路由
				checkinGroup := v1.Group("/checkin")
				checkinGroup.Use(UserAuth())
				{
					// 签到
					checkinGroup.POST("/today", func(c *gin.Context) {
						checkinService := c.MustGet("checkinService").(*checkin.Service)
						controller := checkin.NewController(checkinService)
						controller.Checkin(c)
					})
					// 获取今日签到状态
					checkinGroup.GET("/today/status", func(c *gin.Context) {
						checkinService := c.MustGet("checkinService").(*checkin.Service)
						controller := checkin.NewController(checkinService)
						controller.GetTodayStatus(c)
					})
					// 获取签到记录
					checkinGroup.GET("/records", func(c *gin.Context) {
						checkinService := c.MustGet("checkinService").(*checkin.Service)
						controller := checkin.NewController(checkinService)
						controller.GetCheckinRecords(c)
					})
					// 获取签到统计
					checkinGroup.GET("/stats", func(c *gin.Context) {
						checkinService := c.MustGet("checkinService").(*checkin.Service)
						controller := checkin.NewController(checkinService)
						controller.GetCheckinStats(c)
					})
					// 获取签到日历
					checkinGroup.GET("/calendar", func(c *gin.Context) {
						checkinService := c.MustGet("checkinService").(*checkin.Service)
						controller := checkin.NewController(checkinService)
						controller.GetCheckinCalendar(c)
					})
				}

				// 公开路由 - 签到排行榜（无需认证）
				v1.GET("/checkin/ranking", func(c *gin.Context) {
					checkinService := ctx.CheckinService
					controller := checkin.NewController(checkinService)
					controller.GetCheckinRanking(c)
				})

				// 个人中心路由
				personalCenterGroup := v1.Group("/personal-center")
				personalCenterGroup.Use(UserAuth())
				{
					// 仪表板
					personalCenterGroup.GET("/dashboard", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetDashboard(c)
					})

					// 用户档案
					personalCenterGroup.GET("/profile", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetProfile(c)
					})
					personalCenterGroup.PUT("/profile", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.UpdateProfile(c)
					})

					// 偏好设置
					personalCenterGroup.GET("/preferences", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetPreferences(c)
					})
					personalCenterGroup.PUT("/preferences", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.UpdatePreferences(c)
					})

					// 通知管理
					personalCenterGroup.GET("/notifications", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetNotifications(c)
					})
					personalCenterGroup.PUT("/notifications/:id/read", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.MarkNotificationRead(c)
					})
					personalCenterGroup.DELETE("/notifications/:id", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.DeleteNotification(c)
					})
					personalCenterGroup.PUT("/notifications/read-all", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.MarkAllNotificationsRead(c)
					})

					// 活动日志
					personalCenterGroup.GET("/activity-logs", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetActivityLogs(c)
					})

					// 各类统计
					personalCenterGroup.GET("/stats/token", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetTokenStats(c)
					})
					personalCenterGroup.GET("/stats/invitation", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetInvitationStats(c)
					})
					personalCenterGroup.GET("/stats/checkin", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetCheckinStats(c)
					})
					personalCenterGroup.GET("/stats/activity", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetActivityOverview(c)
					})
					personalCenterGroup.GET("/stats/usage", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetSystemUsageStats(c)
					})

					// 最近活动
					personalCenterGroup.GET("/activities/recent", func(c *gin.Context) {
						personalCenterService := c.MustGet("personalCenterService").(*personalcenter.Service)
						controller := personalcenter.NewController(personalCenterService)
						controller.GetRecentActivities(c)
					})
				}
			}
    */
	}

    // ========= 用户态写接口（统一由 Go 提供） =========
    // 强认证：用户登录态写操作
    authRequired := middleware.InternalJWTAuth(true)

    // 1) Tokens（余额、消费、交易、购买等）
    internaluser.SetupTokenRoutes(router, ctx.DB.DB, authRequired)

    // 2) 邀请系统 /api/invitation/*
    {
        tokenSvc := internaluser.NewTokenService(ctx.DB.DB)
        invSvc := invitation.NewInvitationService(ctx.DB.DB, tokenSvc)
        invCtrl := invitation.NewInvitationController(invSvc)
        g := router.Group("/api/invitation")
        g.Use(authRequired)
        invCtrl.RegisterRoutes(g)
    }

    // 3) 签到系统 /api/checkin/*
    {
        adapter := tokenAdapter{ svc: internaluser.NewTokenService(ctx.DB.DB) }
        chkSvc := checkin.NewCheckinService(ctx.DB.DB, adapter)
        chkCtrl := checkin.NewCheckinController(chkSvc)
        g := router.Group("/api/checkin")
        g.Use(authRequired)
        chkCtrl.RegisterRoutes(g)
    }

    // 4) 支付写接口 /api/v1/payments/*
    {
        g := router.Group("/api/v1/payments")
        g.Use(authRequired)
        payment.RegisterPaymentRoutes(g)
    }

    // 5) 订阅写接口 /api/v1/user/subscription/*
    {
        g := router.Group("/api/v1/user/subscription")
        g.Use(authRequired)
        subscription.RegisterUserWriteRoutes(g)
    }

	// AdminLogin 管理员登录 - TODO: Fix admin service initialization
	/*
	   func AdminLogin(c *gin.Context) {
	   	adminService := c.MustGet("adminService").(*admin.Service)

	   	var req admin.LoginRequest
	   	if err := c.ShouldBind(&req); err != nil {
	   		gf.Error().SetMsg(err.Error()).Regin(c)
	   		return
	   	}

	   	// 登录验证
	   	adminAccount, err := adminService.Login(&req)
	   	if err != nil {
	   		gf.Error().SetMsg(err.Error()).Regin(c)
	   		return
	   	}

	   	// 生成管理员会话令牌（简单实现，实际应该使用JWT）
	   	// 这里暂时使用固定格式：admin_{username}_{timestamp}
	   	token := fmt.Sprintf("admin_%s_%d", adminAccount.Username, time.Now().Unix())

	   	gf.Success().SetData(gf.Map{
	   		"token": token,
	   		"admin": gf.Map{
	   			"id":       adminAccount.ID,
	   			"username": adminAccount.Username,
	   			"email":    adminAccount.Email,
	   			"role":     adminAccount.Role,
	   		},
	   	}).Regin(c)
	   }
	*/
}
