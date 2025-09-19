package user

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
    appctx "gofly-admin-v3/internal/common/idempotency"
)

// TokenController Token控制器
type TokenController struct {
	tokenService *TokenService
	db           *gorm.DB
}

// NewTokenController 创建Token控制器
func NewTokenController(db *gorm.DB) *TokenController {
	return &TokenController{
		tokenService: NewTokenService(db),
		db:           db,
	}
}

// GetBalance 获取Token余额
// @Summary 获取Token余额
// @Description 获取当前用户的Token余额
// @Tags Token管理
// @Security ApiKeyAuth
// @Success 200 {object} gin.H
// @Router /api/v1/tokens/balance [get]
func (c *TokenController) GetBalance(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	balance, err := c.tokenService.GetTokenBalance(userID.(string))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "query_failed",
			"message": "查询余额失败",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"balance": balance,
	})
}

// GetTransactions 获取Token交易记录
// @Summary 获取Token交易记录
// @Description 分页获取用户的Token交易记录
// @Tags Token管理
// @Security ApiKeyAuth
// @Param page query int false "页码" default(1)
// @Param size query int false "每页数量" default(20)
// @Success 200 {object} gin.H
// @Router /api/v1/tokens/transactions [get]
func (c *TokenController) GetTransactions(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	// 获取分页参数
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(ctx.DefaultQuery("size", "20"))

	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}

	transactions, total, err := c.tokenService.GetTokenTransactions(userID.(string), page, size)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "query_failed",
			"message": "查询交易记录失败",
		})
		return
	}

	// 转换为响应格式
	transactionResponses := make([]*TokenTransactionResponse, 0, len(transactions))
	for _, tx := range transactions {
		transactionResponses = append(transactionResponses, tx.ToResponse())
	}

	ctx.JSON(http.StatusOK, gin.H{
		"transactions": transactionResponses,
		"total":        total,
		"page":         page,
		"size":         size,
	})
}

// ConsumeRequest Token消费请求
type ConsumeRequest struct {
	Service   string `json:"service" binding:"required"` // 服务名称
	Action    string `json:"action" binding:"required"`  // 操作类型
	Quantity  int    `json:"quantity" binding:"min=1"`   // 数量
	Reference string `json:"reference"`                  // 关联引用
}

// ConsumeExactRequest 精确消费请求
type ConsumeExactRequest struct {
    Amount      int    `json:"amount" binding:"min=1"`
    Description string `json:"description"`
    Reference   string `json:"reference"`
}

// ConsumeTokens 消费Token
// @Summary 消费Token
// @Description 根据服务规则消费Token
// @Tags Token管理
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body ConsumeRequest true "消费请求"
// @Success 200 {object} gin.H
// @Router /api/v1/tokens/consume [post]
func (c *TokenController) ConsumeTokens(ctx *gin.Context) {
    userID, exists := ctx.Get("user_id")
    if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

    var req ConsumeRequest
    if err := ctx.ShouldBindJSON(&req); err != nil {
        ctx.JSON(http.StatusBadRequest, gin.H{
            "error":   "invalid_request",
            "message": err.Error(),
        })
        return
    }
    if !appctx.WithIdempotency(ctx, "tokens.consume") { return }

	// 检查Token是否足够
	sufficient, balance, cost, err := c.tokenService.CheckTokenSufficiency(
		userID.(string), req.Service, req.Action, req.Quantity)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_service",
			"message": err.Error(),
		})
		return
	}

	if !sufficient {
		ctx.JSON(http.StatusPaymentRequired, gin.H{
			"error":           "insufficient_tokens",
			"message":         "Token余额不足",
			"current_balance": balance,
			"required_tokens": cost,
		})
		return
	}

	// 执行消费
	err = c.tokenService.ConsumeTokensByService(
		userID.(string), req.Service, req.Action, req.Quantity, req.Reference)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "consume_failed",
			"message": err.Error(),
		})
		return
	}

    // 获取消费后的余额
    newBalance, _ := c.tokenService.GetTokenBalance(userID.(string))

    resp := gin.H{"message": "Token消费成功", "consumed_tokens": cost, "new_balance": newBalance}
    appctx.MarkIdempotentDoneWithResponse(ctx, "tokens.consume", http.StatusOK, resp)
    ctx.JSON(http.StatusOK, resp)
}

// ConsumeExact 精确消费指定数量 Token（不走规则）
// @Summary 精确消费Token
// @Description 直接按数量消费，不按规则，适用于内部精确扣费
// @Tags Token管理
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body ConsumeExactRequest true "精确消费请求"
// @Success 200 {object} gin.H
// @Router /api/v1/tokens/consume-exact [post]
func (c *TokenController) ConsumeExact(ctx *gin.Context) {
    userID, exists := ctx.Get("user_id")
    if !exists {
        ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "用户未认证"}); return
    }
    var req ConsumeExactRequest
    if err := ctx.ShouldBindJSON(&req); err != nil || req.Amount <= 0 {
        ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "message": "amount 必须为正整数"}); return
    }
    if !appctx.WithIdempotency(ctx, "tokens.consume_exact") { return }
    // 执行精确消费
    if err := c.tokenService.ConsumeExact(userID.(string), req.Amount, "api", "exact", req.Reference, map[string]interface{}{"desc": req.Description}); err != nil {
        ctx.JSON(http.StatusBadRequest, gin.H{"error": "consume_failed", "message": err.Error()}); return
    }
    // 返回新余额
    newBalance, _ := c.tokenService.GetTokenBalance(userID.(string))
    resp := gin.H{"message": "Token消费成功", "consumed_tokens": req.Amount, "new_balance": newBalance}
    appctx.MarkIdempotentDoneWithResponse(ctx, "tokens.consume_exact", http.StatusOK, resp)
    ctx.JSON(http.StatusOK, resp)
}

// CheckSufficiency 检查Token是否足够
// @Summary 检查Token是否足够
// @Description 检查指定操作是否有足够的Token
// @Tags Token管理
// @Security ApiKeyAuth
// @Param service query string true "服务名称"
// @Param action query string true "操作类型"
// @Param quantity query int true "数量"
// @Success 200 {object} gin.H
// @Router /api/v1/tokens/check [get]
func (c *TokenController) CheckSufficiency(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	service := ctx.Query("service")
	action := ctx.Query("action")
	quantityStr := ctx.Query("quantity")

	if service == "" || action == "" || quantityStr == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "missing_parameters",
			"message": "缺少必要参数",
		})
		return
	}

	quantity, err := strconv.Atoi(quantityStr)
	if err != nil || quantity < 1 {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_quantity",
			"message": "数量必须是正整数",
		})
		return
	}

	sufficient, balance, cost, err := c.tokenService.CheckTokenSufficiency(
		userID.(string), service, action, quantity)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_service",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"sufficient":      sufficient,
		"current_balance": balance,
		"required_tokens": cost,
		"shortage":        cost - balance,
	})
}

// GetConsumptionRules 获取消费规则
// @Summary 获取消费规则
// @Description 获取所有Token消费规则
// @Tags Token管理
// @Success 200 {object} gin.H
// @Router /api/v1/tokens/rules [get]
func (c *TokenController) GetConsumptionRules(ctx *gin.Context) {
	rules := c.tokenService.GetConsumptionRules()
	ctx.JSON(http.StatusOK, gin.H{
		"rules": rules,
	})
}

// GetRechargePackages 获取充值包
// @Summary 获取充值包
// @Description 获取所有充值包配置
// @Tags Token管理
// @Success 200 {object} gin.H
// @Router /api/v1/tokens/packages [get]
func (c *TokenController) GetRechargePackages(ctx *gin.Context) {
	packages := c.tokenService.GetRechargePackages()
	ctx.JSON(http.StatusOK, gin.H{
		"packages": packages,
	})
}

// PurchaseRequest 购买请求
type PurchaseRequest struct {
	PackageID string `json:"package_id" binding:"required"` // 充值包ID
	OrderID   string `json:"order_id" binding:"required"`   // 订单ID
}

// PurchaseTokens 购买Token
// @Summary 购买Token
// @Description 购买指定充值包的Token
// @Tags Token管理
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body PurchaseRequest true "购买请求"
// @Success 200 {object} gin.H
// @Router /api/v1/tokens/purchase [post]
func (c *TokenController) PurchaseTokens(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	var req PurchaseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// 执行购买
	err := c.tokenService.PurchaseTokens(userID.(string), req.PackageID, req.OrderID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "purchase_failed",
			"message": err.Error(),
		})
		return
	}

	// 获取购买后的余额
	newBalance, _ := c.tokenService.GetTokenBalance(userID.(string))

	ctx.JSON(http.StatusOK, gin.H{
		"message":     "Token购买成功",
		"new_balance": newBalance,
	})
}

// GetStats 获取Token统计
// @Summary 获取Token统计
// @Description 获取用户的Token使用统计信息
// @Tags Token管理
// @Security ApiKeyAuth
// @Success 200 {object} gin.H
// @Router /api/v1/tokens/stats [get]
func (c *TokenController) GetStats(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	stats, err := c.tokenService.GetTokenStats(userID.(string))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "query_failed",
			"message": "查询统计信息失败",
		})
		return
	}

	ctx.JSON(http.StatusOK, stats)
}
