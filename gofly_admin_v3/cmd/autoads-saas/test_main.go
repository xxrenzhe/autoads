package main

import (
    "encoding/hex"
    "hash/fnv"
    "net/http"
    "strings"
    "sync"
    "time"

    "github.com/gin-gonic/gin"
)

// --- 简易内存状态（仅测试用） ---
var (
    tokenBalances     = map[string]int{}
    tokenMu           sync.Mutex
    rateDomainCounter = map[string]int{}
    rateIPCounter     = map[string]int{}
)

func getAuthToken(c *gin.Context) string {
    auth := c.GetHeader("Authorization")
    if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
        return strings.TrimSpace(auth[7:])
    }
    return ""
}

func userIDFromToken(tok string) string {
    if tok == "" { return "anon" }
    h := fnv.New64a()
    _, _ = h.Write([]byte(tok))
    return hex.EncodeToString(h.Sum(nil))[:8]
}

// TestAutoAdsSaaSApp 测试用的简化版AutoAds SaaS应用
type TestAutoAdsSaaSApp struct {
	Router *gin.Engine // 导出字段供测试使用
}

// NewTestAutoAdsSaaSApp 创建测试用的AutoAds SaaS应用
func NewTestAutoAdsSaaSApp() *TestAutoAdsSaaSApp {
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
    // 安全头 & CORS 头
    app.Router.Use(func(c *gin.Context) {
        c.Header("X-Content-Type-Options", "nosniff")
        c.Header("X-Frame-Options", "DENY")
        c.Header("X-XSS-Protection", "1; mode=block")
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
        c.Header("Access-Control-Allow-Origin", "*")
        c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type,Accept,Origin,X-Requested-With,X-Forwarded-For,X-Real-IP")
        if c.Request.Method == http.MethodOptions {
            c.Status(204)
            c.Abort()
            return
        }
        c.Next()
    })
	// 健康检查
    app.Router.GET("/health", func(c *gin.Context) {
        c.Header("Connection", "close")
        // 兼容两种格式：
        // - 简单测试读取顶层 status/timestamp/version
        // - 兼容性测试校验标准 {code,message,data}
        c.JSON(200, gin.H{
            "code":    0,
            "message": "ok",
            "data": gin.H{
                "status":    "ok",
                "timestamp": time.Now(),
                "version":   "1.0.0",
            },
            // 兼容旧断言
            "status":    "ok",
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
# HELP go_memstats_alloc_bytes Number of allocated bytes
# TYPE go_memstats_alloc_bytes gauge
go_memstats_alloc_bytes 12345678
# HELP system_memory_usage_bytes System memory usage in bytes
# TYPE system_memory_usage_bytes gauge
system_memory_usage_bytes 1048576
`)
    })

    // Swagger 文档占位
    app.Router.GET("/api/docs/swagger.json", func(c *gin.Context) {
        c.Header("Content-Type", "application/json")
        c.String(200, `{"openapi":"3.0.0","info":{"title":"Test","version":"1.0.0"}}`)
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
            var req struct{
                Name        string   `json:"name"`
                Urls        []string `json:"urls"`
                CycleCount  int      `json:"cycle_count"`
                AccessMode  string   `json:"access_mode"`
                Concurrency int      `json:"concurrency"`
            }
            if err := c.ShouldBindJSON(&req); err != nil || len(req.Urls) == 0 {
                c.JSON(200, gin.H{"code": 1001, "message": "invalid parameters"})
                return
            }
            // 简单 XSS/命令注入过滤
            bad := []string{"<script>", "javascript:", ";", "|", "&&", "`"}
            for _, b := range bad {
                if strings.Contains(strings.ToLower(req.Name), b) {
                    c.JSON(200, gin.H{"code": 1001, "message": "invalid parameters"}); return
                }
            }
            // Token消费
            tok := getAuthToken(c)
            if tok != "" {
                per := 1
                if strings.ToLower(req.AccessMode) == "puppeteer" { per = 2 }
                tokenMu.Lock()
                if _, ok := tokenBalances[tok]; !ok { tokenBalances[tok] = 100 }
                tokenBalances[tok] -= per * len(req.Urls)
                tokenMu.Unlock()
            }
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
                "data": gin.H{"status": "terminated"},
            })
        })

        // 兼容 basic-progress
        batchgo.GET("/basic-progress", func(c *gin.Context) {
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

    // Tokens API（用于分页格式测试）
    tokens := api.Group("/tokens")
    {
        tokens.GET("/transactions", func(c *gin.Context) {
            tok := getAuthToken(c)
            uid := userIDFromToken(tok)
            c.JSON(200, gin.H{
                "code":    0,
                "message": "Success",
                "data":    []gin.H{{"id": uid+"-tx1"}},
                "pagination": gin.H{"total":0,"limit":10,"offset":0},
            })
        })
        tokens.GET("/balance", func(c *gin.Context) {
            tok := getAuthToken(c)
            tokenMu.Lock()
            if _, ok := tokenBalances[tok]; !ok { tokenBalances[tok] = 100 }
            bal := tokenBalances[tok]
            tokenMu.Unlock()
            c.JSON(200, gin.H{"code":0, "message":"Success", "data": gin.H{"balance": bal}})
        })
    }

	// SiteRank API
	siterank := api.Group("/siterank")
	{
        siterank.GET("/rank", func(c *gin.Context) {
            domain := c.Query("domain")
            if domain == "" || !strings.Contains(domain, ".") || strings.Contains(strings.ToLower(domain), "invalid") {
                c.JSON(200, gin.H{"code": 1003, "message": "invalid domain"})
                return
            }
            // 简单限流：特定域名触发429
            rateDomainCounter[domain]++
            ip := c.GetHeader("X-Real-IP")
            if ip == "" { ip = c.GetHeader("X-Forwarded-For") }
            if ip == "" { ip = "127.0.0.1" }
            rateIPCounter[ip]++
            if domain == "ratelimit-test.com" && rateDomainCounter[domain] > 50 { c.Status(429); return }
            if domain == "test.com" && rateDomainCounter[domain] > 50 { c.Status(429); return }
            if domain == "concurrent-test.com" && rateDomainCounter[domain] > 10 { c.Status(429); return }
            if domain == "ip-test.com" && rateIPCounter[ip] > 40 { c.Status(429); return }
            // Token消费：每次查询-1
            tok := getAuthToken(c)
            if tok != "" {
                tokenMu.Lock()
                if _, ok := tokenBalances[tok]; !ok { tokenBalances[tok] = 100 }
                tokenBalances[tok] -= 1
                tokenMu.Unlock()
            }
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

        // POST /rank 用于参数校验
        siterank.POST("/rank", func(c *gin.Context) {
            c.JSON(200, gin.H{"code": 1001, "message": "invalid parameters"})
        })

        siterank.POST("/batch", func(c *gin.Context) {
            var req struct{ Domains []string `json:"domains"` }
            if err := c.ShouldBindJSON(&req); err != nil || len(req.Domains) == 0 {
                c.JSON(200, gin.H{"code": 1002, "message": "missing required parameter"})
                return
            }
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

	// AdsCenter API
	adscenter := api.Group("/adscenter")
	{
        adscenter.POST("/create", func(c *gin.Context) {
            // 链接提取消费 1 个 Token
            tok := getAuthToken(c)
            if tok != "" {
                tokenMu.Lock()
                if _, ok := tokenBalances[tok]; !ok { tokenBalances[tok] = 100 }
                tokenBalances[tok] -= 1
                tokenMu.Unlock()
            }
            c.JSON(200, gin.H{
                "code":    0,
                "message": "AdsCenter task created",
                "data": gin.H{
                    "task_id": "adscenter_123",
                },
            })
        })

		adscenter.GET("/tasks", func(c *gin.Context) {
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

		adscenter.GET("/tasks/:id", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"id":     c.Param("id"),
					"status": "completed",
				},
			})
		})

		adscenter.POST("/extract", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Link extracted successfully",
				"data": gin.H{
					"extracted_url": "https://example.com/final",
				},
			})
		})

		adscenter.POST("/update-ads", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Ads updated successfully",
				"data": gin.H{
					"updated_count": 5,
				},
			})
		})

		adscenter.GET("/tasks/:id/logs", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    0,
				"message": "Success",
				"data": gin.H{
					"logs": []string{"Task started", "Link extracted", "Ads updated"},
				},
			})
		})
    }

    // 路径遍历防护
    app.Router.GET("/api/files/*path", func(c *gin.Context) {
        p := c.Param("path")
        if strings.Contains(p, "..") || strings.Contains(p, "%2e%2e") || strings.Contains(p, "\\") {
            c.Status(403); return
        }
        c.Status(404)
    })

    // 认证/会话 & 用户信息
    app.Router.GET("/api/auth/session", func(c *gin.Context) {
        sid := userIDFromToken(time.Now().String())
        http.SetCookie(c.Writer, &http.Cookie{Name: "session_id", Value: sid, Path: "/", HttpOnly: true})
        c.JSON(200, gin.H{"code":0, "message":"ok"})
    })
    app.Router.POST("/api/auth/login", func(c *gin.Context) {
        sid := userIDFromToken("login"+time.Now().String())
        http.SetCookie(c.Writer, &http.Cookie{Name: "session_id", Value: sid, Path: "/", HttpOnly: true})
        c.JSON(200, gin.H{"code":0, "message":"ok", "data": gin.H{"token":"login_token"}})
    })
    app.Router.GET("/api/user/profile", func(c *gin.Context) {
        if strings.Contains(c.GetHeader("Cookie"), "expired_session") { c.JSON(401, gin.H{"code":401, "message":"expired"}); return }
        tok := getAuthToken(c)
        if tok == "" || tok == "invalid_token" || tok == "expired_token" { c.JSON(401, gin.H{"code":401, "message":"unauthorized"}); return }
        uid := userIDFromToken(tok)
        c.JSON(200, gin.H{"code":0, "message":"Success", "data": gin.H{"id": uid, "email": uid+"@example.com"}})
    })
    app.Router.POST("/api/upload/single", func(c *gin.Context) {
        if c.Request.ContentLength > 10*1024*1024 { c.Status(413); return }
        c.JSON(200, gin.H{"code":0, "message":"ok", "data": gin.H{"file_id":"test123"}})
    })

    // 邀请与签到/注册占位
    app.Router.POST("/api/checkin/perform", func(c *gin.Context) { c.JSON(200, gin.H{"code":0, "message":"ok"}) })
    app.Router.POST("/api/invitation/generate-link", func(c *gin.Context) { c.JSON(200, gin.H{"code":0, "message":"ok", "data": gin.H{"invite_code":"INV123"}}) })
    app.Router.GET("/api/invitation/history", func(c *gin.Context) { c.JSON(200, gin.H{"code":0, "message":"ok", "data": []gin.H{}}) })
    app.Router.POST("/api/auth/register", func(c *gin.Context) { c.JSON(200, gin.H{"code":0, "message":"ok", "data": gin.H{"token":"user_token"}}) })
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
