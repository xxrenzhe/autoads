package app

import (
    "context"
    "fmt"
    "time"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"

    "gofly-admin-v3/internal/audit"
    "gofly-admin-v3/internal/siterankgo"
    "gofly-admin-v3/internal/store"
    "gofly-admin-v3/internal/user"
)

// RegisterSiteRankAtomic 注册 SiteRank 原子端点（batch:check / batch:execute）
// 说明：
// - 为了逐步收敛 main.go 的路由注册，将批量原子端点迁移至此；
// - 其余兼容端点（/rank、/batch）仍保留在 main.go，避免一次性大改；
// - 需要外部传入依赖（tokenSvc、swebClient、gormDB、storeRedis、auditSvc、auth），保持可测试与解耦。
func RegisterSiteRankAtomic(
    v1 *gin.RouterGroup,
    planLimiter gin.HandlerFunc,
    auth gin.HandlerFunc,
    swebClient *siterankgo.SimilarWebClient,
    tokenSvc *user.TokenService,
    gormDB *gorm.DB,
    storeRedis *store.Redis,
    auditSvc *audit.AutoAdsAuditService,
) {
    grp := v1.Group("/siterank")
    if planLimiter != nil { grp.Use(planLimiter) }
    if auth != nil { grp.Use(auth) }

    // POST /api/v1/siterank/batch:check
    grp.POST("/batch:check", func(c *gin.Context) {
        if tokenSvc == nil {
            c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
            return
        }
        var body struct { Domains []string `json:"domains"` }
        if err := c.ShouldBindJSON(&body); err != nil || len(body.Domains) == 0 {
            c.JSON(400, gin.H{"code": 400, "message": "invalid request: domains required"})
            return
        }
        uid := c.GetString("user_id")
        if uid == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
        if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }
        sufficient, balance, total, err := tokenSvc.CheckTokenSufficiency(uid, "siterank", "query", len(body.Domains))
        if err != nil {
            c.JSON(500, gin.H{"code": 500, "message": err.Error()}); return
        }
        c.JSON(200, gin.H{"sufficient": sufficient, "balance": balance, "required": total, "quantity": len(body.Domains)})
    })

    // POST /api/v1/siterank/batch:execute
    grp.POST("/batch:execute", func(c *gin.Context) {
        if tokenSvc == nil || swebClient == nil {
            c.JSON(503, gin.H{"code": 5000, "message": "service unavailable"})
            return
        }
        var body struct { Domains []string `json:"domains"` }
        if err := c.ShouldBindJSON(&body); err != nil || len(body.Domains) == 0 {
            c.JSON(400, gin.H{"code": 400, "message": "invalid request: domains required"})
            return
        }
        uid := c.GetString("user_id")
        if uid == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
        if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }

        // 幂等（DB + Redis）
        idemKey := c.GetHeader("Idempotency-Key")
        if idemKey != "" {
            if gormDB != nil {
                res := gormDB.Exec("INSERT IGNORE INTO idempotency_requests(user_id, endpoint, idem_key, status) VALUES (?,?,?,?)", uid, "siterank.batch.execute", idemKey, "PENDING")
                if res.Error == nil && res.RowsAffected == 0 {
                    c.JSON(200, gin.H{"code": 200, "duplicate": true, "message": "duplicate request"}); return
                }
            }
            if storeRedis != nil {
                ctx := c.Request.Context()
                key := "autoads:idem:" + uid + ":" + idemKey
                ok, _ := storeRedis.GetClient().SetNX(ctx, key, "locked", 10*time.Minute).Result()
                if !ok { c.JSON(200, gin.H{"code": 200, "duplicate": true, "message": "duplicate request"}); return }
                _ = storeRedis.Expire(ctx, key, 10*time.Minute)
            }
        }

        // 二次校验 + 扣费
        sufficient, balance, total, err := tokenSvc.CheckTokenSufficiency(uid, "siterank", "query", len(body.Domains))
        if err != nil { c.JSON(500, gin.H{"code":500,"message":err.Error()}); return }
        if !sufficient { c.JSON(402, gin.H{"code":402, "message":"INSUFFICIENT_TOKENS", "required": total, "balance": balance}); return }
        if err := tokenSvc.ConsumeTokensByService(uid, "siterank", "query", len(body.Domains), "siterank.batch"); err != nil {
            c.JSON(402, gin.H{"code":402, "message": err.Error(), "required": total, "balance": balance}); return
        }

        // 执行批量查询
        ctx := c.Request.Context()
        data, execErr := swebClient.BatchGetWebsiteData(ctx, uid, body.Domains)
        if execErr != nil {
            _ = tokenSvc.AddTokens(uid, total, "refund", "siterank batch failed", "")
            if auditSvc != nil { _ = auditSvc.LogSiteRankQuery(uid, "batch", map[string]any{"domains": len(body.Domains), "error": execErr.Error()}, c.ClientIP(), c.Request.UserAgent(), false, execErr.Error(), 0) }
            c.JSON(502, gin.H{"code": 502, "message": execErr.Error()}); return
        }
        newBalance, _ := tokenSvc.GetTokenBalance(uid)
        c.Header("X-Tokens-Consumed", fmt.Sprintf("%d", total))
        c.Header("X-Tokens-Balance", fmt.Sprintf("%d", newBalance))
        if idemKey != "" {
            if gormDB != nil { _ = gormDB.Exec("UPDATE idempotency_requests SET status='DONE' WHERE user_id=? AND endpoint=? AND idem_key=?", uid, "siterank.batch.execute", idemKey).Error }
            if storeRedis != nil { _ = storeRedis.Set(context.Background(), "autoads:idem:"+uid+":"+idemKey, "done", 24*time.Hour) }
        }
        if auditSvc != nil { _ = auditSvc.LogSiteRankQuery(uid, "batch", map[string]any{"domains": len(body.Domains)}, c.ClientIP(), c.Request.UserAgent(), true, "", 0) }
        c.JSON(200, gin.H{"consumed": total, "balance": newBalance, "quantity": len(body.Domains), "results": data})
    })
}

