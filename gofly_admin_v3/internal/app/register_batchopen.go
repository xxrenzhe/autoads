package app

import (
    "fmt"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/internal/audit"
    "gofly-admin-v3/internal/batchgo"
    "gofly-admin-v3/internal/store"
    "gofly-admin-v3/internal/user"
    "gorm.io/gorm"
)

// RegisterBatchOpenAtomic 注册 BatchOpen Silent 原子端点（silent:check / silent:execute）
// 说明：依赖 tokenSvc/batchService/gormDB/storeRedis，与 main.go 逻辑保持一致。
func RegisterBatchOpenAtomic(
    v1 *gin.RouterGroup,
    planLimiter gin.HandlerFunc,
    auth gin.HandlerFunc,
    tokenSvc *user.TokenService,
    batchService *batchgo.Service,
    gormDB *gorm.DB,
    storeRedis *store.Redis,
    auditSvc *audit.AutoAdsAuditService,
) {
    grp := v1.Group("/batchopen")
    if planLimiter != nil { grp.Use(planLimiter) }
    if auth != nil { grp.Use(auth) }

    // POST /api/v1/batchopen/silent:check
    grp.POST("/silent:check", func(c *gin.Context) {
        var body struct {
            URLs       []string `json:"urls"`
            CycleCount int      `json:"cycleCount"`
            AccessMode string   `json:"accessMode"` // http | puppeteer
        }
        if err := c.ShouldBindJSON(&body); err != nil || len(body.URLs) == 0 {
            c.JSON(400, gin.H{"code": 400, "message": "invalid request: urls required"})
            return
        }
        userID := c.GetString("user_id")
        if userID == "" { c.JSON(401, gin.H{"code":401, "message":"unauthorized"}); return }
        if tokenSvc == nil { c.JSON(503, gin.H{"code":5000, "message":"service unavailable"}); return }
        if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }
        cycle := body.CycleCount; if cycle <= 0 { cycle = 1 }
        action := "http"; if body.AccessMode == "puppeteer" { action = "puppeteer" }
        totalQty := len(body.URLs) * cycle
        sufficient, balance, required, err := tokenSvc.CheckTokenSufficiency(userID, "batchgo", action, totalQty)
        if err != nil { c.JSON(500, gin.H{"code": 500, "message": err.Error()}); return }
        c.JSON(200, gin.H{"sufficient": sufficient, "balance": balance, "required": required, "quantity": totalQty})
    })

    // POST /api/v1/batchopen/silent:execute
    grp.POST("/silent:execute", func(c *gin.Context) {
        var body struct {
            TaskName   string         `json:"taskName"`
            URLs       []string       `json:"urls"`
            CycleCount int            `json:"cycleCount"`
            AccessMode string         `json:"accessMode"` // http | puppeteer
            Silent     map[string]any `json:"silent"`
        }
        if err := c.ShouldBindJSON(&body); err != nil || len(body.URLs) == 0 {
            c.JSON(400, gin.H{"code": 400, "message": "invalid request: urls required"}); return
        }
        userID := c.GetString("user_id")
        if userID == "" { c.JSON(401, gin.H{"code":401, "message":"unauthorized"}); return }
        if tokenSvc == nil || batchService == nil { c.JSON(503, gin.H{"code":5000, "message":"service unavailable"}); return }
        if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }

        // 幂等性（DB + Redis）
        iKey := c.GetHeader("Idempotency-Key")
        if iKey != "" {
            if gormDB != nil {
                res := gormDB.Exec("INSERT IGNORE INTO idempotency_requests(user_id, endpoint, idem_key, status) VALUES (?,?,?,?)", userID, "batchopen.silent.execute", iKey, "PENDING")
                if res.Error == nil && res.RowsAffected == 0 { c.JSON(200, gin.H{"code":200, "duplicate": true, "message":"duplicate request"}); return }
            }
            if storeRedis != nil {
                ctx := c.Request.Context()
                key := "autoads:idem_batch:" + userID + ":" + iKey
                ok, _ := storeRedis.GetClient().SetNX(ctx, key, "locked", 10*time.Minute).Result()
                if !ok { c.JSON(200, gin.H{"code":200, "duplicate": true, "message":"duplicate request"}); return }
                _ = storeRedis.Expire(ctx, key, 10*time.Minute)
            }
        }

        cycle := body.CycleCount; if cycle <= 0 { cycle = 1 }
        action := "http"; if body.AccessMode == "puppeteer" { action = "puppeteer" }
        totalQty := len(body.URLs) * cycle
        sufficient, balance, required, err := tokenSvc.CheckTokenSufficiency(userID, "batchgo", action, totalQty)
        if err != nil { c.JSON(500, gin.H{"code":500, "message": err.Error()}); return }
        if !sufficient { c.JSON(402, gin.H{"code":402, "message":"INSUFFICIENT_TOKENS", "required": required, "balance": balance}); return }
        // 扣费（原子）
        if err := tokenSvc.ConsumeTokensByService(userID, "batchgo", action, totalQty, "batchopen.silent"); err != nil {
            c.JSON(402, gin.H{"code": 402, "message": err.Error(), "required": required, "balance": balance}); return
        }

        // 统一创建 Silent 任务（按原逻辑，后端侧管理循环/并发/扣费分段）
        cfg := batchgo.BatchTaskConfig{ Silent: &batchgo.SilentConfig{ Concurrency: 5, Timeout: 30, RetryCount: 3 } }
        if body.Silent != nil {
            if v, ok := body.Silent["concurrency"].(float64); ok { cfg.Silent.Concurrency = int(v) }
            if v, ok := body.Silent["timeout"].(float64); ok { cfg.Silent.Timeout = int(v) }
            if v, ok := body.Silent["retry_count"].(float64); ok { cfg.Silent.RetryCount = int(v) }
        }
        createReq := &batchgo.CreateTaskRequest{ Name: body.TaskName, Mode: batchgo.ModeSilent, URLs: body.URLs, Config: cfg }
        task, err := batchService.CreateTask(userID, createReq)
        if err != nil {
            _ = tokenSvc.AddTokens(userID, required, "refund", "batchopen create failed", "")
            if auditSvc != nil { _ = auditSvc.LogBatchTaskAction(userID, "create", "", map[string]any{"urls": len(body.URLs), "mode": "silent", "error": err.Error()}, c.ClientIP(), c.Request.UserAgent(), false, err.Error(), 0) }
            c.JSON(500, gin.H{"code": 500, "message": err.Error()}); return
        }
        go func() {
            if err := batchService.StartTask(userID, task.ID); err != nil {
                _ = tokenSvc.AddTokens(userID, required, "refund", "batchopen start failed", task.ID)
                if auditSvc != nil { _ = auditSvc.LogBatchTaskAction(userID, "start", task.ID, map[string]any{"urls": len(body.URLs), "mode": "silent", "error": err.Error()}, c.ClientIP(), c.Request.UserAgent(), false, err.Error(), 0) }
            } else {
                if auditSvc != nil { _ = auditSvc.LogBatchTaskAction(userID, "start", task.ID, map[string]any{"urls": len(body.URLs), "mode": "silent"}, c.ClientIP(), c.Request.UserAgent(), true, "", 0) }
            }
        }()
        newBalance, _ := tokenSvc.GetTokenBalance(userID)
        c.Header("X-Tokens-Consumed", fmt.Sprintf("%d", required))
        c.Header("X-Tokens-Balance", fmt.Sprintf("%d", newBalance))
        if iKey != "" && gormDB != nil { _ = gormDB.Exec("UPDATE idempotency_requests SET status='DONE' WHERE user_id=? AND endpoint=? AND idem_key=?", userID, "batchopen.silent.execute", iKey).Error }
        c.JSON(200, gin.H{"code": 0, "taskId": task.ID, "status": string(task.Status), "consumed": required, "balance": newBalance})
    })
}
