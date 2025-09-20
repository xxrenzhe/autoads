package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware 认证中间件
type AuthMiddleware struct {
	jwtService *JWTService
}

// NewAuthMiddleware 创建认证中间件
func NewAuthMiddleware(jwtService *JWTService) *AuthMiddleware {
	return &AuthMiddleware{
		jwtService: jwtService,
	}
}

// RequireAuth 需要认证的中间件
func (m *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Authorization header is required",
			})
			c.Abort()
			return
		}

		// 提取令牌
		if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		tokenString := authHeader[7:]

		// 验证令牌
		claims, err := m.jwtService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// 将用户信息存储到上下文
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		c.Set("user_plan", claims.PlanName)
		c.Set("claims", claims)

		c.Next()
	}
}

// RequireRole 需要特定角色的中间件
func (m *AuthMiddleware) RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 先执行认证
		m.RequireAuth()(c)
		if c.IsAborted() {
			return
		}

		// 检查角色
		userRole, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User role not found",
			})
			c.Abort()
			return
		}

		// 检查是否有权限
		userRoleStr := userRole.(string)
		for _, role := range roles {
			if userRoleStr == role {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error":   "forbidden",
			"message": "Insufficient permissions",
		})
		c.Abort()
	}
}

// RequirePlan 需要特定套餐的中间件
func (m *AuthMiddleware) RequirePlan(plans ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 先执行认证
		m.RequireAuth()(c)
		if c.IsAborted() {
			return
		}

		// 检查套餐
		userPlan, exists := c.Get("user_plan")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User plan not found",
			})
			c.Abort()
			return
		}

		// 检查套餐权限
		userPlanStr := userPlan.(string)
		for _, plan := range plans {
			if userPlanStr == plan {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusPaymentRequired, gin.H{
			"error":   "plan_required",
			"message": "This feature requires a higher plan",
		})
		c.Abort()
	}
}

// DataIsolation 数据隔离中间件
func (m *AuthMiddleware) DataIsolation() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 先执行认证
		m.RequireAuth()(c)
		if c.IsAborted() {
			return
		}

		// 获取用户ID
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User ID not found",
			})
			c.Abort()
			return
		}

		// 管理员可以访问所有数据
		if userRole, exists := c.Get("user_role"); exists && userRole.(string) == "admin" {
			c.Next()
			return
		}

		// 检查URL参数中的user_id是否匹配
		if paramUserID := c.Param("user_id"); paramUserID != "" {
			if paramUserID != userID.(string) {
				c.JSON(http.StatusForbidden, gin.H{
					"error":   "forbidden",
					"message": "Access denied: data isolation violation",
				})
				c.Abort()
				return
			}
		}

		// 在查询参数中添加user_id过滤
		c.Set("filter_user_id", userID.(string))

		c.Next()
	}
}

// OptionalAuth 可选认证中间件
func (m *AuthMiddleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		// 尝试验证令牌
		if len(authHeader) >= 7 && authHeader[:7] == "Bearer " {
			tokenString := authHeader[7:]
			claims, err := m.jwtService.ValidateToken(tokenString)
			if err == nil {
				// 令牌有效，设置用户信息
				c.Set("user_id", claims.UserID)
				c.Set("user_email", claims.Email)
				c.Set("user_role", claims.Role)
				c.Set("user_plan", claims.PlanName)
				c.Set("claims", claims)
			}
		}

		c.Next()
	}
}

// RateLimitByUser 按用户限流中间件
func (m *AuthMiddleware) RateLimitByUser(requestsPerMinute int) gin.HandlerFunc {
	// 简化的限流实现
	// 在生产环境中应该使用Redis等外部存储
	return func(c *gin.Context) {
		_, exists := c.Get("user_id")
		if !exists {
			// 未认证用户使用IP限流
			c.Next()
			return
		}

		// 这里应该实现基于用户的限流逻辑
		// 暂时跳过实现
		c.Next()
	}
}
