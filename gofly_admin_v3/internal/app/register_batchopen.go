package app

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"
    "strings"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/internal/audit"
    "gofly-admin-v3/internal/autoclick"
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

    // 统一入口：POST /api/v1/batchopen/start?type=silent|basic|autoclick
    grp.POST("/start", func(c *gin.Context) {
        mode := strings.ToLower(strings.TrimSpace(c.DefaultQuery("type", "silent")))
        // 复用 silent:execute 的请求体
        var body struct {
            TaskName   string         `json:"taskName"`
            URLs       []string       `json:"urls"`
            CycleCount int            `json:"cycleCount"`
            AccessMode string         `json:"accessMode"` // http | puppeteer
            Silent     map[string]any `json:"silent"`
            Basic      map[string]any `json:"basic"`
            AutoClick  map[string]any `json:"autoclick"`
        }
        if err := c.ShouldBindJSON(&body); err != nil || len(body.URLs) == 0 {
            c.JSON(400, gin.H{"code": 400, "message": "invalid request: urls required"}); return
        }
        userID := c.GetString("user_id")
        if userID == "" { c.JSON(401, gin.H{"code":401, "message":"unauthorized"}); return }
        if tokenSvc == nil || batchService == nil { c.JSON(503, gin.H{"code":5000, "message":"service unavailable"}); return }

        cycle := body.CycleCount; if cycle <= 0 { cycle = 1 }

        // 幂等性（DB + Redis）
        iKey := c.GetHeader("Idempotency-Key")
        if iKey != "" {
            if gormDB != nil {
                res := gormDB.Exec("INSERT IGNORE INTO idempotency_requests(user_id, endpoint, idem_key, status) VALUES (?,?,?,?)", userID, "batchopen.start:"+mode, iKey, "PENDING")
                if res.Error == nil && res.RowsAffected == 0 { c.JSON(200, gin.H{"code":200, "duplicate": true, "message":"duplicate request"}); return }
            }
            if storeRedis != nil {
                ctx := c.Request.Context()
                key := "autoads:idem_batch_start:" + mode + ":" + userID + ":" + iKey
                ok, _ := storeRedis.GetClient().SetNX(ctx, key, "locked", 10*time.Minute).Result()
                if !ok { c.JSON(200, gin.H{"code":200, "duplicate": true, "message":"duplicate request"}); return }
                _ = storeRedis.Expire(ctx, key, 10*time.Minute)
            }
        }

        var action string
        var cfg batchgo.BatchTaskConfig
        var taskMode batchgo.BatchTaskMode
        switch mode {
        case "silent":
            action = "http"
            if strings.ToLower(body.AccessMode) == "puppeteer" { action = "puppeteer" }
            cfg.Silent = &batchgo.SilentConfig{ Concurrency: 5, Timeout: 30, RetryCount: 3 }
            if body.Silent != nil {
                if v, ok := body.Silent["concurrency"].(float64); ok { cfg.Silent.Concurrency = int(v) }
                if v, ok := body.Silent["timeout"].(float64); ok { cfg.Silent.Timeout = int(v) }
                if v, ok := body.Silent["retry_count"].(float64); ok { cfg.Silent.RetryCount = int(v) }
            }
            taskMode = batchgo.ModeSilent
        case "basic":
            action = "http"
            cfg.Basic = &batchgo.BasicConfig{ Delay: 0, NewWindow: false, Sequential: false }
            if body.Basic != nil {
                if v, ok := body.Basic["delay"].(float64); ok { cfg.Basic.Delay = int(v) }
                if v, ok := body.Basic["new_window"].(bool); ok { cfg.Basic.NewWindow = v }
                if v, ok := body.Basic["sequential"].(bool); ok { cfg.Basic.Sequential = v }
            }
            taskMode = batchgo.ModeBasic
        case "autoclick":
            action = "puppeteer"
            cfg.AutoClick = &batchgo.AutoClickConfig{ Interval: 60, RandomDelay: true, MaxRandomDelay: 10 }
            taskMode = batchgo.ModeAutoClick
        default:
            c.JSON(400, gin.H{"code": 400, "message": "unsupported type"}); return
        }

        totalQty := len(body.URLs) * cycle
        // 预检 + 原子扣费
        sufficient, balance, required, err := tokenSvc.CheckTokenSufficiency(userID, "batchgo", action, totalQty)
        if err != nil { c.JSON(500, gin.H{"code": 500, "message": err.Error()}); return }
        if !sufficient { c.JSON(402, gin.H{"code": 402, "message": "INSUFFICIENT_TOKENS", "required": required, "balance": balance}); return }
        if err := tokenSvc.ConsumeTokensByService(userID, "batchgo", action, totalQty, "batchopen.start"+":"+mode); err != nil {
            c.JSON(402, gin.H{"code": 402, "message": err.Error(), "required": required, "balance": balance}); return
        }

        // 创建并启动任务
        req := &batchgo.CreateTaskRequest{ Name: body.TaskName, Mode: taskMode, URLs: body.URLs, CycleCount: cycle, Config: cfg }
        task, err := batchService.CreateTask(userID, req)
        if err != nil { _ = tokenSvc.AddTokens(userID, required, "refund", "batchopen start create failed", ""); c.JSON(500, gin.H{"code":500, "message": err.Error()}); return }
        go func() { _ = batchService.StartTask(userID, task.ID) }()

        newBalance, _ := tokenSvc.GetTokenBalance(userID)
        c.Header("X-Tokens-Consumed", fmt.Sprintf("%d", required))
        c.Header("X-Tokens-Balance", fmt.Sprintf("%d", newBalance))
        if iKey != "" && gormDB != nil { _ = gormDB.Exec("UPDATE idempotency_requests SET status='DONE' WHERE user_id=? AND endpoint=? AND idem_key=?", userID, "batchopen.start:"+mode, iKey).Error }
        c.JSON(200, gin.H{"code": 0, "taskId": task.ID, "status": string(task.Status), "consumed": required, "balance": newBalance, "mode": mode})
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

    // GET /api/v1/batchopen/tasks/:id （统一进度聚合：优先 batch_tasks，回退新三表）
    grp.GET("/tasks/:id", func(c *gin.Context) {
        userID := c.GetString("user_id")
        if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
        if rid := c.GetHeader("X-Request-Id"); rid != "" { c.Header("X-Request-Id", rid) }
        taskID := c.Param("id"); if taskID == "" { c.JSON(400, gin.H{"code": 400, "message": "missing id"}); return }
        if batchService != nil {
            if task, err := batchService.GetTask(userID, taskID); err == nil && task != nil {
                processed := task.ProcessedCount
                total := task.URLCount
                percent := 0
                if total > 0 { percent = int(float64(processed) / float64(total) * 100.0) }
                pending := total - processed
                message := task.ErrorMessage
                if message == "" {
                    switch task.Status {
                    case batchgo.StatusPending:
                        message = "任务等待中"
                    case batchgo.StatusRunning:
                        message = "任务运行中"
                    case batchgo.StatusCompleted:
                        message = "任务已完成"
                    case batchgo.StatusFailed:
                        message = "任务失败"
                    case batchgo.StatusCancelled:
                        message = "任务已取消"
                    case batchgo.StatusPaused:
                        message = "任务已暂停"
                    }
                }
                c.JSON(200, gin.H{"success": true, "status": string(task.Status), "progress": percent, "successCount": task.SuccessCount, "failCount": task.FailedCount, "total": total, "pendingCount": pending, "message": message, "timestamp": time.Now().UnixMilli(), "serverTime": time.Now().Format(time.RFC3339)})
                return
            }
        }
        c.JSON(404, gin.H{"success": false, "message": "TASK_NOT_FOUND"})
    })

    // SSE: /api/v1/batchopen/tasks/:id/live （最小实现：轮询DB推送）
    grp.GET("/tasks/:id/live", func(c *gin.Context) {
        id := c.Param("id"); if id == "" { c.String(400, "missing id"); return }
        c.Writer.Header().Set("Content-Type", "text/event-stream")
        c.Writer.Header().Set("Cache-Control", "no-cache")
        c.Writer.Header().Set("Connection", "keep-alive")
        f, ok := c.Writer.(http.Flusher)
        if !ok { c.String(500, "stream unsupported"); return }
        ticker := time.NewTicker(1 * time.Second)
        defer ticker.Stop()
        for i := 0; i < 300; i++ { // 最多5分钟
            select {
            case <-c.Request.Context().Done():
                return
            case <-ticker.C:
                var exec autoclick.AutoClickExecution
                if err := gormDB.Where("id = ?", id).First(&exec).Error; err != nil {
                    fmt.Fprintf(c.Writer, "data: %s\n\n", `{"type":"not_found"}`)
                    f.Flush();
                    return
                }
                payload := map[string]any{
                    "type": "execution_update", "id": exec.ID, "status": exec.Status, "progress": exec.Progress,
                    "processedItems": exec.Success + exec.Fail, "totalItems": exec.Total,
                }
                b, _ := json.Marshal(payload)
                fmt.Fprintf(c.Writer, "data: %s\n\n", string(b))
                f.Flush()
            }
        }
    })
}
