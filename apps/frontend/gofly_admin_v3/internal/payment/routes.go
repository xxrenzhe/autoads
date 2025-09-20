package payment

import (
    "context"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
    gform "gofly-admin-v3/utils/gform"
    "strings"
    appctx "gofly-admin-v3/internal/common/idempotency"
)

// RegisterPaymentRoutes 注册支付相关路由
func RegisterPaymentRoutes(r *gin.RouterGroup) {
    r.POST("/create", createPaymentHandler)
    r.POST("/token-purchase/verify", verifyTokenPurchaseHandler)
}

// createPaymentHandler 创建支付记录（简化版本）
// POST /api/v1/payments/create
// body: { subscription_id?: string, amount: number, currency?: string, provider?: string }
func createPaymentHandler(c *gin.Context) {
    userID := c.GetString("user_id")
    if userID == "" { c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"}); return }
    if !appctx.WithIdempotency(c, "payments.create") { return }
    var req struct { SubscriptionID string `json:"subscription_id"`; Amount float64 `json:"amount"`; Currency string `json:"currency"`; Provider string `json:"provider"` }
    if err := c.ShouldBindJSON(&req); err != nil || req.Amount <= 0 { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"}); return }
    if req.Currency == "" { req.Currency = "USD" }
    if req.Provider == "" { req.Provider = "system" }
    id := gf.UUID()
    _, err := gf.DB().Model("payments").Insert(gf.Map{
        "id": id, "user_id": userID, "subscription_id": req.SubscriptionID,
        "amount": req.Amount, "currency": req.Currency, "status": "PENDING",
        "provider": req.Provider, "created_at": time.Now(), "updated_at": time.Now(),
    })
    if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": "create_failed", "message": err.Error()}); return }
    // 模拟跳转URL
    resp := gin.H{"payment_id": id, "redirect_url": "https://pay.example.com/" + id, "status": "pending"}
    appctx.MarkIdempotentDoneWithResponse(c, "payments.create", http.StatusOK, resp)
    c.JSON(http.StatusOK, resp)
}

// verifyTokenPurchaseHandler 验证Token购买（将 token_purchases 标记为 COMPLETED 并给用户加 Token）
// POST /api/v1/payments/token-purchase/verify
// body: { purchase_id: string, payment_method?: string }
func verifyTokenPurchaseHandler(c *gin.Context) {
    userID := c.GetString("user_id")
    if userID == "" { c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"}); return }
    if !appctx.WithIdempotency(c, "payments.token_purchase.verify") { return }
    var req struct { PurchaseID string `json:"purchase_id"`; PaymentMethod string `json:"payment_method"` }
    if err := c.ShouldBindJSON(&req); err != nil || req.PurchaseID == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"}); return }
    // 查询购买记录
    row, err := gf.DB().Model("token_purchases").Where("id=? AND user_id=?", req.PurchaseID, userID).One()
    if err != nil || row == nil { c.JSON(http.StatusNotFound, gin.H{"error": "not_found"}); return }
    if strings.ToUpper(row["status"].String()) == "COMPLETED" { c.JSON(http.StatusBadRequest, gin.H{"error": "already_processed"}); return }
    tokens := row["tokens"].Int()
    // 事务：更新购买状态 + 增加余额 + 记录流水
    err = gf.DB().Transaction(c, func(ctx context.Context, tx gform.TX) error {
        if _, e := tx.Model("token_purchases").Where("id", req.PurchaseID).Update(gf.Map{"status": "COMPLETED", "updated_at": time.Now()}); e != nil { return e }
        if _, e := gf.DB().Exec(ctx, "UPDATE users SET token_balance=token_balance+? WHERE id=?", tokens, userID); e != nil { return e }
        if _, e := tx.Model("token_transactions").Insert(gf.Map{
            "id": gf.UUID(), "user_id": userID, "amount": tokens, "type": "purchase",
            "description": "Token purchase verified", "created_at": time.Now(),
        }); e != nil { return e }
        return nil
    })
    if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": "verify_failed", "message": err.Error()}); return }
    resp := gin.H{"success": true, "tokens_credited": tokens, "purchase_id": req.PurchaseID}
    appctx.MarkIdempotentDoneWithResponse(c, "payments.token_purchase.verify", http.StatusOK, resp)
    c.JSON(http.StatusOK, resp)
}
