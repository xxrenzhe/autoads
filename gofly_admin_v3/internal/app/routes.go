package app

import (
	// "fmt"
	// "net/http"
	// "time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/admin"
	"gofly-admin-v3/internal/system"
	"gofly-admin-v3/internal/upload"
	"gofly-admin-v3/utils/gf"
	"strings"
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
	router.Use(GlobalRateLimit())
	router.Use(metrics.GetMetrics().HTTPMiddleware())

	// API版本分组
	v1 := router.Group("/api/v1")
	{
        // 管理员登录（JWT）
        v1.POST("/admin/login", admin.AdminLoginHandler)
        // 管理员受保护路由（JWT）
        adminGroup := v1.Group("/admin")
        adminGroup.Use(admin.AdminJWT())
        {
            controller := admin.NewAdminController(nil, nil, nil, nil)
            adminGroup.GET("/system/config", controller.GetSystemConfig)
            adminGroup.POST("/system/config", controller.UpsertSystemConfig)
            adminGroup.DELETE("/system/config/:key", controller.DeleteSystemConfig)
            adminGroup.GET("/system/config/history", controller.GetSystemConfigHistory)

            rateLimitController := admin.NewRateLimitController(ctx.RateLimitManager)
            rateLimitController.RegisterRoutes(adminGroup)
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
