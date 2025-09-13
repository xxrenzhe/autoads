package app

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/auth"
)

// UserAuth 用户认证中间件
func UserAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    1001,
				"message": "未提供认证令牌",
			})
			c.Abort()
			return
		}

		// 去掉 Bearer 前缀
		token = strings.TrimPrefix(token, "Bearer ")

		// 验证 token
		authService := c.MustGet("authService").(*auth.Service)
		claims, err := authService.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    1001,
				"message": "令牌无效或已过期",
			})
			c.Abort()
			return
		}

		// 设置用户信息到上下文
		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

// ErrorHandler 错误处理中间件
func ErrorHandler() gin.HandlerFunc {
	return gin.ErrorLogger()
}

// Logger 日志中间件
func Logger() gin.HandlerFunc {
	return gin.Logger()
}

// GlobalRateLimit 全局限流中间件
func GlobalRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

// ValidateRequest 请求验证中间件
func ValidateRequest(model interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

// AdminAuth 管理员认证中间件
func AdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		username, _, hasAuth := c.Request.BasicAuth()
		if !hasAuth {
			c.Header("WWW-Authenticate", `Basic realm="Admin Area"`)
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    1001,
				"message": "需要管理员认证",
			})
			c.Abort()
			return
		}

		// TODO: 验证管理员账号
		// admin, err := adminService.Authenticate(username, password)
		// if err != nil {
		//     c.JSON(http.StatusUnauthorized, gin.H{
		//         "code":    1001,
		//         "message": "认证失败",
		//     })
		//     c.Abort()
		//     return
		// }

		// 设置管理员信息到上下文
		c.Set("admin_username", username)
		c.Next()
	}
}

// CORS 跨域中间件
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}


// RateLimiter 限流中间件
func RateLimiter() gin.HandlerFunc {
	// TODO: 实现限流逻辑
	return func(c *gin.Context) {
		c.Next()
	}
}
