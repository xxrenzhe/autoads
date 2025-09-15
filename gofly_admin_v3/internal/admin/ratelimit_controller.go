package admin

import (
    "net/http"
    "strings"
    "time"
    "sort"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/internal/ratelimit"
    "gofly-admin-v3/utils/gf"
)

// RateLimitController 管理速率限制的控制器
type RateLimitController struct {
    manager *ratelimit.RateLimitManager
}

// NewRateLimitController 创建控制器实例
func NewRateLimitController(manager *ratelimit.RateLimitManager) *RateLimitController {
    return &RateLimitController{manager: manager}
}

// RegisterRoutes 注册路由
func (c *RateLimitController) RegisterRoutes(r *gin.RouterGroup) {
    group := r.Group("/rate-limit")
    {
        group.GET("/plans", c.ListPlanConfigs)
        group.PUT("/plans/:plan", c.UpdatePlanConfig)

        // 用户与系统统计
        group.GET("/stats", c.GetRateLimitStats)                 // 兼容：?user_id=
        group.GET("/user/:userId/stats", c.GetUserUsageStats)    // 推荐：用户使用统计+当前限制
        group.GET("/system/stats", c.GetSystemStats)
        group.GET("/series", c.GetRateLimitSeries)

        // 活跃限流器与复位
        group.GET("/active", c.GetActiveLimiters)
        group.POST("/user/:userId/reset", c.ResetUserLimiter)

        // 报表
        group.GET("/report/usage", c.GetUsageReport)
        group.GET("/report/top-users/:feature", c.GetTopUsers)

        // 热刷新
        group.POST("/reload", c.BroadcastReload)
    }
}

// ListPlanConfigs 列出所有套餐的限速配置
func (c *RateLimitController) ListPlanConfigs(ctx *gin.Context) {
    // 返回前端期望结构：{ PLAN: { api_requests_per_minute, api_requests_per_hour, site_rank_requests_per_minute, site_rank_requests_per_hour, batch_concurrent_tasks, batch_tasks_per_minute } }
    limits := c.manager.GetPlanLimits()
    out := make(map[string]map[string]int)
    for plan, l := range limits {
        out[plan] = map[string]int{
            "api_requests_per_minute":      l.APIRequestsPerMinute,
            "api_requests_per_hour":        l.APIRequestsPerHour,
            "site_rank_requests_per_minute": l.SiteRankRequestsPerMinute,
            "site_rank_requests_per_hour":   l.SiteRankRequestsPerHour,
            "batch_concurrent_tasks":        l.BatchConcurrentTasks,
            "batch_tasks_per_minute":        l.BatchTasksPerMinute,
        }
    }
    ctx.JSON(http.StatusOK, gin.H{"code": 0, "data": out})
}

// UpdatePlanConfig 更新指定套餐的限速配置（并触发热刷新）
func (c *RateLimitController) UpdatePlanConfig(ctx *gin.Context) {
    var body map[string]interface{}
    if err := ctx.ShouldBindJSON(&body); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"invalid body"}); return }
    plan := strings.ToUpper(ctx.Param("plan"))
    if plan == "" { ctx.JSON(http.StatusOK, gin.H{"code":1002, "message":"plan required"}); return }

    // 构建配置并更新到内存+数据库
    pick := func(keys ...string) int { for _, k := range keys { if v, ok := body[k]; ok { return gf.Int(v) } } ; return 0 }
    limit := &ratelimit.PlanRateLimit{ Plan: plan }
    limit.APIRequestsPerMinute =      pick("api_per_minute", "api_requests_per_minute")
    limit.APIRequestsPerHour =        pick("api_per_hour", "api_requests_per_hour")
    limit.SiteRankRequestsPerMinute = pick("siterank_per_minute", "site_rank_requests_per_minute")
    limit.SiteRankRequestsPerHour =   pick("siterank_per_hour", "site_rank_requests_per_hour")
    limit.BatchConcurrentTasks =      pick("batch_concurrent", "batch_concurrent_tasks")
    limit.BatchTasksPerMinute =       pick("batch_tasks_per_minute")
    if err := c.manager.UpdatePlanLimit(plan, limit); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code": 5002, "message": err.Error()}); return
    }

    // 广播Redis事件，路由订阅后即时刷新
    if gf.Redis() != nil {
        _, _ = gf.Redis().GroupPubSub().Publish(ctx, "ratelimit:plans:update", "1")
    }

    ctx.JSON(http.StatusOK, gin.H{"code": 0, "message": "updated"})
}

// GetRateLimitStats 获取某用户当前的限速统计
func (c *RateLimitController) GetRateLimitStats(ctx *gin.Context) {
    userID := ctx.Query("user_id")
    if userID == "" { ctx.JSON(http.StatusOK, gin.H{"code":1003, "message":"user_id required"}); return }
    data := c.manager.GetRateLimitStats(userID)
    ctx.JSON(http.StatusOK, gin.H{"code": 0, "data": data})
}

// GetUserUsageStats 获取用户使用统计（包含当前限制），支持 days 参数
func (c *RateLimitController) GetUserUsageStats(ctx *gin.Context) {
    userID := ctx.Param("userId")
    if userID == "" { ctx.JSON(http.StatusOK, gin.H{"code":1003, "message":"userId required"}); return }
    days := gf.Int(ctx.DefaultQuery("days", "7"))

    // 计算时间范围
    endTime := time.Now()
    startTime := endTime.AddDate(0, 0, -days)

    // 聚合使用数据
    rows, err := gf.DB().Query(ctx,
        `SELECT feature, period, SUM(used_count) AS total_used
         FROM rate_limit_usages
         WHERE user_id=? AND recorded_at >= ? AND recorded_at <= ?
         GROUP BY feature, period`, userID, startTime, endTime,
    )
    if err != nil {
        // 无数据表或查询失败时，降级返回空使用数据
        rows = []map[string]interface{}{}
    }

    usage := map[string]map[string]int{"API": {"MINUTE":0, "HOUR":0}, "SITE_RANK": {"MINUTE":0, "HOUR":0}, "BATCH": {"MINUTE":0}}
    for _, r := range rows {
        feature := strings.ToUpper(gf.String(r["feature"]))
        period := strings.ToUpper(gf.String(r["period"]))
        total := gf.Int(gf.String(r["total_used"]))
        if _, ok := usage[feature]; ok {
            if _, ok2 := usage[feature][period]; ok2 { usage[feature][period] = total }
        }
    }

    // 当前限制
    limitsRaw := c.manager.GetRateLimitStats(userID)
    limits := map[string]interface{}{
        "api_per_minute":      limitsRaw["api_limit_per_minute"],
        "api_per_hour":        limitsRaw["api_limit_per_hour"],
        "siterank_per_minute": limitsRaw["siterank_limit_per_minute"],
        "siterank_per_hour":   limitsRaw["siterank_limit_per_hour"],
        "batch_per_minute":    limitsRaw["batch_tasks_per_minute"],
        "batch_concurrent":    limitsRaw["batch_concurrent_limit"],
    }

    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{
        "user_id": userID,
        "plan":    limitsRaw["plan"],
        "usage":   usage,
        "limits":  limits,
        "period":  gin.H{"start_time": startTime, "end_time": endTime, "days": days},
    }})
}

// BroadcastReload 主动广播一次刷新事件
func (c *RateLimitController) BroadcastReload(ctx *gin.Context) {
    if gf.Redis() != nil {
        _, _ = gf.Redis().GroupPubSub().Publish(ctx, "ratelimit:plans:update", "1")
    }
    ctx.JSON(http.StatusOK, gin.H{"code": 0, "message": "broadcasted"})
}

// GetRateLimitSeries 返回时间序列的速率限制使用情况
func (c *RateLimitController) GetRateLimitSeries(ctx *gin.Context) {
    userID := ctx.Query("user_id")
    if userID == "" { ctx.JSON(http.StatusOK, gin.H{"code":1003, "message":"user_id required"}); return }
    granularity := ctx.DefaultQuery("granularity", "hour")
    hoursStr := ctx.DefaultQuery("hours", "24")
    minutesStr := ctx.DefaultQuery("minutes", "60")
    hours := gf.Int(hoursStr)
    minutes := gf.Int(minutesStr)
    series, err := c.manager.GetUsageSeries(userID, granularity, hours, minutes)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code": 0, "data": series})
}

// GetSystemStats 系统限流总体统计
func (c *RateLimitController) GetSystemStats(ctx *gin.Context) {
    data := c.manager.GetSystemStats()
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": data})
}

// GetActiveLimiters 活跃限流器列表（支持简单过滤）
func (c *RateLimitController) GetActiveLimiters(ctx *gin.Context) {
    page := gf.Int(ctx.DefaultQuery("page", "1"))
    size := gf.Int(ctx.DefaultQuery("size", "20"))
    if page <= 0 { page = 1 }
    if size <= 0 || size > 200 { size = 20 }
    plan := strings.ToUpper(strings.TrimSpace(ctx.Query("plan")))
    search := strings.TrimSpace(ctx.Query("search"))

    // 直接取全部再过滤，规模大时可优化为管理器侧过滤
    itemsAll, _ := c.manager.ListActiveLimiters(1, 100000)
    filtered := make([]map[string]interface{}, 0, len(itemsAll))
    for _, it := range itemsAll {
        if plan != "" && strings.ToUpper(gf.String(it["plan"])) != plan { continue }
        if search != "" && !strings.Contains(gf.String(it["user_id"]), search) { continue }
        filtered = append(filtered, it)
    }

    // 排序：最近活跃优先
    sort.Slice(filtered, func(i, j int) bool {
        ti, _ := filtered[i]["last_active"].(time.Time)
        tj, _ := filtered[j]["last_active"].(time.Time)
        return ti.After(tj)
    })

    total := len(filtered)
    start := (page-1)*size
    if start > total { start = total }
    end := start + size
    if end > total { end = total }
    pageItems := filtered[start:end]

    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{
        "items": pageItems,
        "total": total,
        "page":  page,
        "size":  size,
    }})
}

// ResetUserLimiter 重置用户限流器
func (c *RateLimitController) ResetUserLimiter(ctx *gin.Context) {
    userID := ctx.Param("userId")
    if userID == "" { ctx.JSON(http.StatusOK, gin.H{"code":1003, "message":"userId required"}); return }
    if err := c.manager.ResetUserLimiter(userID); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code":5002, "message": err.Error()}); return
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"ok"})
}

// GetUsageReport 系统使用统计报告（按套餐/功能聚合）
func (c *RateLimitController) GetUsageReport(ctx *gin.Context) {
    days := gf.Int(ctx.DefaultQuery("days", "7"))
    endTime := time.Now()
    startTime := endTime.AddDate(0, 0, -days)

    rows, err := gf.DB().Query(ctx,
        `SELECT plan, feature, period, SUM(used_count) AS total_used
         FROM rate_limit_usages
         WHERE recorded_at >= ? AND recorded_at <= ?
         GROUP BY plan, feature, period`, startTime, endTime,
    )
    if err != nil { rows = []map[string]interface{}{} }

    planUsage := map[string]map[string]map[string]int{}
    for _, r := range rows {
        plan := gf.String(r["plan"])
        feature := strings.ToUpper(gf.String(r["feature"]))
        period := strings.ToUpper(gf.String(r["period"]))
        total := gf.Int(gf.String(r["total_used"]))
        if _, ok := planUsage[plan]; !ok { planUsage[plan] = map[string]map[string]int{"API":{"MINUTE":0,"HOUR":0},"SITE_RANK":{"MINUTE":0,"HOUR":0},"BATCH":{"MINUTE":0}} }
        if _, ok := planUsage[plan][feature]; ok { if _, ok2 := planUsage[plan][feature][period]; ok2 { planUsage[plan][feature][period] = total } }
    }

    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{
        "plan_usage": planUsage,
        "period": gin.H{"start_time": startTime, "end_time": endTime, "days": days},
    }})
}

// GetTopUsers 获取使用量Top用户
func (c *RateLimitController) GetTopUsers(ctx *gin.Context) {
    feature := strings.ToUpper(ctx.Param("feature"))
    if feature == "" { ctx.JSON(http.StatusOK, gin.H{"code":1003, "message":"feature required"}); return }
    days := gf.Int(ctx.DefaultQuery("days", "7"))
    limit := gf.Int(ctx.DefaultQuery("limit", "20"))
    if limit <= 0 || limit > 100 { limit = 20 }

    endTime := time.Now()
    startTime := endTime.AddDate(0,0,-days)
    rows, err := gf.DB().Query(ctx,
        `SELECT user_id, plan, SUM(used_count) AS total_used
         FROM rate_limit_usages
         WHERE feature = ? AND recorded_at >= ? AND recorded_at <= ?
         GROUP BY user_id, plan
         ORDER BY total_used DESC
         LIMIT ?`, feature, startTime, endTime, limit,
    )
    if err != nil { rows = []map[string]interface{}{} }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": rows})
}
