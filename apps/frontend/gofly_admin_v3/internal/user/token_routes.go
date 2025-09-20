package user

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupTokenRoutes 设置Token路由
func SetupTokenRoutes(router *gin.Engine, db *gorm.DB, authMiddleware interface{}) {
	// 创建Token控制器
	tokenController := NewTokenController(db)

	// 需要认证的Token路由
	tokenGroup := router.Group("/api/v1/tokens")

	// 如果有认证中间件，使用它
	if middleware, ok := authMiddleware.(gin.HandlerFunc); ok {
		tokenGroup.Use(middleware)
	}

	{
		// Token余额管理
		tokenGroup.GET("/balance", tokenController.GetBalance)
		tokenGroup.GET("/stats", tokenController.GetStats)

		// Token交易记录
		tokenGroup.GET("/transactions", tokenController.GetTransactions)

		// Token消费
		tokenGroup.POST("/consume", tokenController.ConsumeTokens)
		tokenGroup.POST("/consume-exact", tokenController.ConsumeExact)
		tokenGroup.GET("/check", tokenController.CheckSufficiency)

		// Token购买
		tokenGroup.POST("/purchase", tokenController.PurchaseTokens)

		// 配置信息（公开）
		tokenGroup.GET("/rules", tokenController.GetConsumptionRules)
		tokenGroup.GET("/packages", tokenController.GetRechargePackages)
	}
}

// SetupPublicTokenRoutes 设置公开的Token路由
func SetupPublicTokenRoutes(router *gin.Engine, db *gorm.DB) {
	// 创建Token控制器
	tokenController := NewTokenController(db)

	// 公开的Token路由（无需认证）
	publicGroup := router.Group("/api/v1/public/tokens")
	{
		// 消费规则和充值包（公开信息）
		publicGroup.GET("/rules", tokenController.GetConsumptionRules)
		publicGroup.GET("/packages", tokenController.GetRechargePackages)
	}
}
