// 主应用初始化 - 速率限制集成示例

package main

import (
	"context"
	"log"
	"time"

	"gofly-admin-v3/internal/admin"
	"gofly-admin-v3/internal/batchgo"
	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/internal/ratelimit"
	"gofly-admin-v3/internal/siterankgo"
	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/internal/user"
)

func main() {
	// 1. 初始化配置
	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 2. 初始化数据库连接
	db, err := store.NewDB(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}
	defer db.Close()

	// 3. 初始化Redis连接
	redis, err := store.NewRedis(&cfg.Redis)
	if err != nil {
		log.Printf("Warning: Failed to connect Redis: %v", err)
	}
	defer redis.Close()

	// 4. 初始化用户服务
	userService := user.NewService(db)

	// 5. 初始化速率限制管理器
	rateLimitManager := ratelimit.NewRateLimitManager(cfg, db, userService)

	// 6. 初始化统计收集器
	statsCollector := ratelimit.NewStatsCollector(db, rateLimitManager, 30*time.Second)
	defer statsCollector.Stop()

	// 7. 初始化数据库配置加载器
	configLoader := ratelimit.NewDatabaseConfigLoader(db)

	// 8. 创建默认配置
	if err := configLoader.CreateDefaultConfigs(); err != nil {
		log.Printf("Warning: Failed to create default rate limit configs: %v", err)
	}

	// 9. 初始化热更新配置
	hotReloadConfig, err := config.NewHotReloadConfig("config.yaml", rateLimitManager)
	if err != nil {
		log.Printf("Warning: Failed to initialize hot reload: %v", err)
	} else {
		defer hotReloadConfig.Close()
	}

	// 10. 初始化业务服务
	// SiteRankGo服务
	siterankService := siterankgo.NewGoFlySiteRankGoService(db, redis, rateLimitManager)

	// BatchGo服务
	batchService := batchgo.NewGoFlyBatchGoService(db, redis, rateLimitManager)

	// 11. 初始化后台管理服务
	adminController := admin.NewRateLimitController(rateLimitManager)

	// 12. 注册路由（示例）
	// router := gin.Default()
	// adminGroup := router.Group("/api/v1/admin")
	// adminController.RegisterRoutes(adminGroup)

	// 13. 演示限流功能
	demoRateLimiting(context.Background(), userService, siterankService, batchService)

	log.Println("Application started successfully")
}

// demoRateLimiting 演示限流功能
func demoRateLimiting(ctx context.Context, userService *user.Service,
	siterankService *siterankgo.Service, batchService *batchgo.Service) {

	// 创建测试用户
	testUsers := []string{"user-free-001", "user-pro-001", "user-max-001"}

	for _, userID := range testUsers {
		// 模拟API请求限流
		for i := 0; i < 5; i++ {
			// 检查API限流
			// err := rateLimitManager.CheckAPIRateLimit(ctx, userID)
			// if err != nil {
			//     log.Printf("User %s API rate limited: %v", userID, err)
			//     break
			// }

			// 模拟SiteRank请求
			req := &siterankgo.SimilarWebRequest{
				Domain:      "example.com",
				Country:     "global",
				Granularity: "monthly",
			}

			_, err := siterankService.GetWebsiteTrafficData(ctx, userID, "example.com")
			if err != nil {
				log.Printf("User %s SiteRank request failed: %v", userID, err)
			} else {
				log.Printf("User %s SiteRank request success", userID)
			}

			time.Sleep(100 * time.Millisecond)
		}

		// 模拟Batch任务创建
		batchReq := &batchgo.CreateTaskRequest{
			Name: "Demo Batch Task",
			Type: "batch_open",
			Urls: []string{"https://example.com", "https://google.com"},
			Config: &batchgo.BatchTaskConfig{
				CycleCount:   2,
				OpenCount:    3,
				OpenInterval: 5,
				AccessMethod: "chrome",
			},
		}

		_, err := batchService.CreateTask(userID, batchReq)
		if err != nil {
			log.Printf("User %s Batch task creation failed: %v", userID, err)
		} else {
			log.Printf("User %s Batch task created successfully", userID)
		}
	}
}
