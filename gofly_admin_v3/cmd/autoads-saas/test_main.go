package main

import (
	"time"

	"github.com/gin-gonic/gin"
)

// TestAutoAdsSaaSApp 测试用的简化版AutoAds SaaS应用
type TestAutoAdsSaaSApp struct {
	Router *gin.Engine // 导出字段供测试使用
}

// NewAutoAdsSaaSApp 创建测试用的AutoAds SaaS应用
func NewAutoAdsSaaSApp() *TestAutoAdsSaaSApp {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	app := &TestAutoAdsSaaSApp{
		Router: router,
	}

	app.setupTestRoutes()
	return app
}

// setupTestRoutes 设置测试路由
func (app *TestAutoAdsSaaSApp) setupTestRoutes() {
	// 健康检查
	app.Router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "ok",
			"message":   "AutoAds SaaS Server is running",
			"timestamp": time.Now(),
			"version":   "1.0.0",
		})
	})

	// 详细健康检查
	app.Router.GET("/health/detail", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "ok",
			"message":   "Detailed health check",
			"timestamp": time.Now(),
			"services": gin.H{
				"database": "ok",
				"redis":    "ok",
				"email":    "ok",
			},
		})
	})

	// 准备就绪检查
	app.Router.GET("/ready", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ready",
		})
	})

	// 存活检查
	app.Router.GET("/live", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "alive",
		})
	})

	// Prometheus指标
	app.Router.GET("/metrics", func(c *gin.Context) {
		c.Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		c.String(200, `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 100
# HELP system_memory_usage_bytes System memory usage in bytes
# TYPE system_memory_usage_bytes gauge
system_memory_usage_bytes 1048576
`)
	})

	// API路由组
	api := app.Router.Group("/api")
	app.setupAPIRoutes(api)

	// 管理员路由组
	admin := app.Router.Group("/admin")
	app.setupAdminRoutes(admin)
}

// setupAPIRoutes 设置API路由
func (app *TestAutoAdsSaaSApp) setupAPIRoutes(api *gin.RouterGroup) {
	// BatchGo API
	batchgo := api.Group("/batchopen")
	{
		batchgo.POST("/silent-start", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Task started successfully",
				"data": gin.H{
					"task_id": "test_task_123",
					"status":  "pending",
				},
			})
		})

		batchgo.GET("/silent-progress", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"task_id":       c.Query("task_id"),
					"status":        "running",
					"progress":      50,
					"total_urls":    10,
					"success_count": 5,
					"fail_count":    0,
				},
			})
		})

		batchgo.POST("/silent-terminate", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Task terminated successfully",
			})
		})

		batchgo.POST("/basic-start", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Basic task started",
				"data": gin.H{
					"task_id": "basic_task_123",
				},
			})
		})

		batchgo.GET("/tasks", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data":    []gin.H{},
				"pagination": gin.H{
					"total":  0,
					"limit":  10,
					"offset": 0,
				},
			})
		})

		batchgo.GET("/tasks/:id", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"id":     c.Param("id"),
					"name":   "Test Task",
					"status": "completed",
				},
			})
		})
	}

	// AutoClick API
	autoclick := api.Group("/autoclick")
	{
		autoclick.POST("/tasks", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "AutoClick task created",
				"data": gin.H{
					"task_id": "autoclick_123",
				},
			})
		})

		autoclick.GET("/tasks/:id/progress", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"task_id":  c.Param("id"),
					"progress": 75,
				},
			})
		})
	}

	// SiteRank API
	siterank := api.Group("/siterank")
	{
		siterank.GET("/rank", func(c *gin.Context) {
			domain := c.Query("domain")
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"domain":      domain,
					"global_rank": 1000,
					"category":    "Technology",
					"visits":      1000000,
					"priority":    "Medium",
				},
			})
		})

		siterank.POST("/batch", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Batch query started",
				"data": gin.H{
					"batch_id": "batch_123",
				},
			})
		})

		siterank.GET("/priority", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"domain":   c.Query("domain"),
					"priority": "High",
				},
			})
		})

		siterank.GET("/history", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data":    []gin.H{},
			})
		})

		siterank.GET("/cache-status", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"cached":     true,
					"expires_at": time.Now().Add(24 * time.Hour),
				},
			})
		})
	}

	// Chengelink API
	chengelink := api.Group("/chengelink")
	{
		chengelink.POST("/create", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Chengelink task created",
				"data": gin.H{
					"task_id": "chengelink_123",
				},
			})
		})

		chengelink.GET("/tasks", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data":    []gin.H{},
				"pagination": gin.H{
					"total":  0,
					"limit":  10,
					"offset": 0,
				},
			})
		})

		chengelink.GET("/tasks/:id", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"id":     c.Param("id"),
					"status": "completed",
				},
			})
		})

		chengelink.POST("/extract", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Link extracted successfully",
				"data": gin.H{
					"extracted_url": "https://example.com/final",
				},
			})
		})

		chengelink.POST("/update-ads", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Ads updated successfully",
				"data": gin.H{
					"updated_count": 5,
				},
			})
		})

		chengelink.GET("/tasks/:id/logs", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"logs": []string{"Task started", "Link extracted", "Ads updated"},
				},
			})
		})
	}
}

// setupAdminRoutes 设置管理员路由
func (app *TestAutoAdsSaaSApp) setupAdminRoutes(admin *gin.RouterGroup) {
	// 管理员审计日志
	audit := admin.Group("/audit")
	{
		audit.GET("/security-events", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data":    []gin.H{},
				"pagination": gin.H{
					"total":  0,
					"limit":  50,
					"offset": 0,
				},
			})
		})

		audit.GET("/security-stats", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"total_events": 0,
					"high_risk":    0,
					"medium_risk":  0,
					"low_risk":     0,
				},
			})
		})

		audit.GET("/risky-ips", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data":    []gin.H{},
			})
		})
	}

	// 管理员邮件管理
	email := admin.Group("/email")
	{
		email.GET("/templates", func(c *gin.Context) {
			templates := []gin.H{
				{
					"name":        "welcome",
					"subject":     "欢迎加入 AutoAds",
					"description": "用户注册欢迎邮件",
					"variables":   []string{"AppName", "Username", "LoginURL"},
				},
				{
					"name":        "trial_expired",
					"subject":     "您的试用已到期",
					"description": "试用到期提醒邮件",
					"variables":   []string{"Username", "AppName", "UpgradeURL"},
				},
				{
					"name":        "low_tokens",
					"subject":     "Token余额不足提醒",
					"description": "Token不足通知邮件",
					"variables":   []string{"Username", "TokenBalance", "TopupURL"},
				},
			}

			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data":    templates,
			})
		})

		email.POST("/test", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Test email sent successfully",
			})
		})
	}

	// 管理员文件管理
	upload := admin.Group("/upload")
	{
		upload.GET("/stats", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"total_files":    1000,
					"total_size":     "2.5GB",
					"image_files":    800,
					"document_files": 200,
					"today_uploads":  50,
				},
			})
		})

		upload.POST("/cleanup", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Cleanup completed successfully",
			})
		})
	}
}
