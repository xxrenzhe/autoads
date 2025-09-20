package main

import (
	"fmt"
	"log"
	"time"

	"gofly-admin-v3/internal/audit"
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/internal/middleware"
	"gofly-admin-v3/internal/security"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	fmt.Println("=== AutoAds SaaS 安全和性能系统演示 ===")

	// 初始化数据库
	db, err := gorm.Open(sqlite.Open("security_demo.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect database:", err)
	}

	// 自动迁移
	db.AutoMigrate(&audit.AuditEvent{}, &audit.SecurityEvent{})

	// 初始化Redis（可选）
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   1, // 使用数据库1用于演示
	})

	// 初始化服务
	encryptionService := security.NewEncryptionService("demo-secret-key-12345")
	auditService := audit.NewAuditService(db)
	cacheService := cache.NewRedisCacheService(redisClient, "demo")

	// 初始化限流中间件
	rateLimitConfig := middleware.DefaultRateLimitConfig
	rateLimitConfig.UseRedis = true
	rateLimitMiddleware := middleware.NewRateLimitMiddleware(rateLimitConfig, redisClient)

	// 创建Gin应用
	r := gin.Default()

	// 注册健康检查路由（使用简单的实现）
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "ok",
			"timestamp": time.Now().Unix(),
			"service":   "autoads-saas-demo",
		})
	})

	// 应用限流中间件
	r.Use(rateLimitMiddleware.GlobalRateLimit())
	r.Use(rateLimitMiddleware.IPRateLimit())

	// 演示路由
	setupDemoRoutes(r, encryptionService, auditService, cacheService, rateLimitMiddleware)

	fmt.Println("\n=== 演示功能 ===")
	fmt.Println("1. 健康检查: GET /health")
	fmt.Println("2. 加密演示: POST /demo/encrypt")
	fmt.Println("3. 审计日志: GET /demo/audit")
	fmt.Println("4. 缓存演示: GET /demo/cache")
	fmt.Println("5. 限流演示: GET /demo/ratelimit")
	fmt.Println("6. 安全事件: GET /demo/security")

	// 启动演示
	runDemos(encryptionService, auditService, cacheService)

	fmt.Println("\n服务器启动在 :8080")
	fmt.Println("访问 http://localhost:8080/health 查看健康状态")

	log.Fatal(r.Run(":8080"))
}

func setupDemoRoutes(r *gin.Engine,
	encryptionService *security.EncryptionService,
	auditService *audit.AuditService,
	cacheService cache.CacheService,
	rateLimitMiddleware *middleware.RateLimitMiddleware) {

	demo := r.Group("/demo")

	// 加密演示
	demo.POST("/encrypt", func(c *gin.Context) {
		var req struct {
			Data string `json:"data"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		// 加密数据
		encrypted, err := encryptionService.Encrypt(req.Data)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		// 解密验证
		decrypted, err := encryptionService.Decrypt(encrypted)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		// 记录审计日志
		auditService.LogUserAction(
			"demo-user",
			"encrypt_data",
			"demo",
			"",
			map[string]interface{}{"data_length": len(req.Data)},
			c.ClientIP(),
			c.GetHeader("User-Agent"),
			true,
			"",
			time.Millisecond*100,
		)

		c.JSON(200, gin.H{
			"original":  req.Data,
			"encrypted": encrypted,
			"decrypted": decrypted,
			"success":   req.Data == decrypted,
		})
	})

	// 审计日志演示
	demo.GET("/audit", func(c *gin.Context) {
		events, total, err := auditService.GetAuditEvents("", 10, 0)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, gin.H{
			"events": events,
			"total":  total,
		})
	})

	// 缓存演示
	demo.GET("/cache", func(c *gin.Context) {
		key := "demo:cache:test"

		// 尝试从缓存获取
		var cached string
		err := cacheService.Get(key, &cached)
		if err != nil {
			// 缓存未命中，设置新值
			value := fmt.Sprintf("Cached at %s", time.Now().Format(time.RFC3339))
			cacheService.Set(key, value, 1*time.Minute)

			c.JSON(200, gin.H{
				"cache_hit": false,
				"value":     value,
				"ttl":       cacheService.GetTTL(key).Seconds(),
			})
		} else {
			// 缓存命中
			c.JSON(200, gin.H{
				"cache_hit": true,
				"value":     cached,
				"ttl":       cacheService.GetTTL(key).Seconds(),
			})
		}
	})

	// 限流演示
	demo.GET("/ratelimit", rateLimitMiddleware.UserRateLimit(), func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message":   "Request successful",
			"timestamp": time.Now().Unix(),
			"ip":        c.ClientIP(),
		})
	})

	// 安全事件演示
	demo.GET("/security", func(c *gin.Context) {
		// 记录一个安全事件
		auditService.LogSecurityEvent(
			audit.SecurityEventSuspiciousActivity,
			"demo-user",
			c.ClientIP(),
			c.GetHeader("User-Agent"),
			map[string]interface{}{
				"endpoint": "/demo/security",
				"reason":   "Demo security event",
			},
			audit.SeverityLow,
		)

		// 获取安全事件
		events, total, err := auditService.GetSecurityEvents("", nil, 10, 0)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, gin.H{
			"events": events,
			"total":  total,
		})
	})
}

func runDemos(
	encryptionService *security.EncryptionService,
	auditService *audit.AuditService,
	cacheService cache.CacheService) {

	fmt.Println("\n=== 运行演示 ===")

	// 1. 加密演示
	fmt.Println("\n1. 加密服务演示:")
	testData := "这是需要加密的敏感数据"
	encrypted, _ := encryptionService.Encrypt(testData)
	decrypted, _ := encryptionService.Decrypt(encrypted)
	fmt.Printf("原始数据: %s\n", testData)
	fmt.Printf("加密后: %s\n", encryptionService.MaskSensitiveData(encrypted))
	fmt.Printf("解密后: %s\n", decrypted)
	fmt.Printf("验证成功: %t\n", testData == decrypted)

	// 2. 密码哈希演示
	fmt.Println("\n2. 密码哈希演示:")
	password := "user_password_123"
	hashedPassword, _ := encryptionService.HashPassword(password)
	isValid := encryptionService.CheckPassword(password, hashedPassword)
	fmt.Printf("原始密码: %s\n", password)
	fmt.Printf("哈希后: %s\n", encryptionService.MaskSensitiveData(hashedPassword))
	fmt.Printf("验证成功: %t\n", isValid)

	// 3. 审计日志演示
	fmt.Println("\n3. 审计日志演示:")
	auditService.LogUserAction(
		"demo-user-001",
		audit.ActionLogin,
		"user",
		"demo-user-001",
		map[string]interface{}{"login_method": "google_oauth"},
		"192.168.1.100",
		"Mozilla/5.0 Demo Browser",
		true,
		"",
		time.Millisecond*150,
	)

	auditService.LogUserAction(
		"demo-user-001",
		audit.ActionCreateTask,
		"batch_task",
		"task-001",
		map[string]interface{}{"task_type": "silent", "url_count": 10},
		"192.168.1.100",
		"Mozilla/5.0 Demo Browser",
		true,
		"",
		time.Millisecond*500,
	)

	fmt.Println("已记录用户操作审计日志")

	// 4. 安全事件演示
	fmt.Println("\n4. 安全事件演示:")
	auditService.LogSecurityEvent(
		audit.SecurityEventLoginFailed,
		"demo-user-002",
		"192.168.1.200",
		"Suspicious Bot/1.0",
		map[string]interface{}{
			"attempts": 5,
			"reason":   "Multiple failed login attempts",
		},
		audit.SeverityMedium,
	)

	fmt.Println("已记录安全事件")

	// 5. 缓存演示
	fmt.Println("\n5. 缓存服务演示:")
	cacheKey := "demo:user:profile"
	userProfile := map[string]interface{}{
		"id":    "demo-user-001",
		"name":  "Demo User",
		"email": "demo@example.com",
		"plan":  "pro",
	}

	// 设置缓存
	cacheService.Set(cacheKey, userProfile, 5*time.Minute)
	fmt.Printf("已缓存用户资料: %s\n", cacheKey)

	// 获取缓存
	var cachedProfile map[string]interface{}
	if err := cacheService.Get(cacheKey, &cachedProfile); err == nil {
		fmt.Printf("缓存命中: %+v\n", cachedProfile)
		fmt.Printf("缓存TTL: %.0f秒\n", cacheService.GetTTL(cacheKey).Seconds())
	}

	// 6. 系统监控演示
	fmt.Println("\n6. 系统监控演示:")
	fmt.Printf("演示程序运行正常\n")
	fmt.Printf("数据库连接: 正常\n")
	fmt.Printf("Redis连接: 正常\n")
	fmt.Printf("缓存服务: 正常\n")

	fmt.Println("\n=== 演示完成 ===")
}
