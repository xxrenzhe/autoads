package subscription

import (
    "context"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
    gform "gofly-admin-v3/utils/gform"
    appctx "gofly-admin-v3/internal/common/idempotency"
)

// RegisterUserWriteRoutes 注册用户态订阅写路由
func RegisterUserWriteRoutes(r *gin.RouterGroup) {
    r.POST("/subscribe", subscribeHandler)
    r.POST("/change", changePlanHandler)
}

// subscribeHandler 订阅计划（简化）
// POST /api/v1/user/subscription/subscribe { plan_id: string, billing_cycle?: 'monthly'|'yearly' }
func subscribeHandler(c *gin.Context) {
    userID := c.GetString("user_id")
    if userID == "" { c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"}); return }
    if !appctx.WithIdempotency(c, "subscriptions.subscribe") { return }
    var req struct { PlanID string `json:"plan_id"`; Billing string `json:"billing_cycle"` }
    if err := c.ShouldBindJSON(&req); err != nil || req.PlanID == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"}); return }
    // 结束时间：使用 plans.duration（天），若无则按月/年
    plan, err := gf.DB().Model("plans").Where("id", req.PlanID).One()
    if err != nil || plan == nil { c.JSON(http.StatusNotFound, gin.H{"error": "plan_not_found"}); return }
    now := time.Now()
    end := now
    if d := plan["duration"].Int(); d > 0 { end = now.AddDate(0, 0, d) } else if req.Billing == "yearly" { end = now.AddDate(1, 0, 0) } else { end = now.AddDate(0, 1, 0) }
    id := gf.UUID()
    _, err = gf.DB().Model("subscriptions").Insert(gf.Map{
        "id": id, "user_id": userID, "plan_id": req.PlanID, "status": "ACTIVE",
        "started_at": now, "ended_at": end, "provider": "system", "created_at": now, "updated_at": now,
    })
    if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": "create_failed", "message": err.Error()}); return }
    // 失效缓存
    if gf.Redis() != nil { _, _ = gf.Redis().GroupPubSub().Publish(c, "user:plan:invalidate", userID) }
    resp := gin.H{"subscription_id": id, "status": "ACTIVE", "current_period_end": end}
    appctx.MarkIdempotentDoneWithResponse(c, "subscriptions.subscribe", http.StatusOK, resp)
    c.JSON(http.StatusOK, resp)
}

// changePlanHandler 订阅变更（取消当前，启用新）
// POST /api/v1/user/subscription/change { new_plan_id: string, billing_cycle?: 'monthly'|'yearly' }
func changePlanHandler(c *gin.Context) {
    userID := c.GetString("user_id")
    if userID == "" { c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"}); return }
    if !appctx.WithIdempotency(c, "subscriptions.change") { return }
    var req struct { NewPlanID string `json:"new_plan_id"`; Billing string `json:"billing_cycle"` }
    if err := c.ShouldBindJSON(&req); err != nil || req.NewPlanID == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"}); return }
    now := time.Now()
    err := gf.DB().Transaction(c, func(ctx context.Context, tx gform.TX) error {
        // 取消当前活动订阅
        _, _ = tx.Model("subscriptions").Where("user_id=? AND status='ACTIVE'", userID).Update(gf.Map{"status": "CANCELLED", "updated_at": now})
        // 新订阅
        plan, e := tx.Model("plans").Where("id", req.NewPlanID).One(); if e != nil || plan == nil { return e }
        end := now
        if d := plan["duration"].Int(); d > 0 { end = now.AddDate(0, 0, d) } else if req.Billing == "yearly" { end = now.AddDate(1, 0, 0) } else { end = now.AddDate(0, 1, 0) }
        _, e = tx.Model("subscriptions").Insert(gf.Map{
            "id": gf.UUID(), "user_id": userID, "plan_id": req.NewPlanID, "status": "ACTIVE",
            "started_at": now, "ended_at": end, "provider": "system", "created_at": now, "updated_at": now,
        })
        return e
    })
    if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": "change_failed", "message": err.Error()}); return }
    if gf.Redis() != nil { _, _ = gf.Redis().GroupPubSub().Publish(c, "user:plan:invalidate", userID) }
    resp := gin.H{"success": true}
    appctx.MarkIdempotentDoneWithResponse(c, "subscriptions.change", http.StatusOK, resp)
    c.JSON(http.StatusOK, resp)
}
