package admin

import (
    "net/http"
    "strings"

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
        group.GET("/stats", c.GetRateLimitStats)
        group.POST("/reload", c.BroadcastReload)
        group.GET("/series", c.GetRateLimitSeries)
    }
}

// ListPlanConfigs 列出所有套餐的限速配置
func (c *RateLimitController) ListPlanConfigs(ctx *gin.Context) {
    rows, err := gf.DB().Query(ctx, `SELECT plan, feature, per_minute, per_hour, concurrent, is_active, updated_at FROM rate_limit_configs WHERE is_active=1 ORDER BY plan, feature`)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code": 5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code": 0, "data": rows})
}

// UpdatePlanConfig 更新指定套餐的限速配置（并触发热刷新）
func (c *RateLimitController) UpdatePlanConfig(ctx *gin.Context) {
    type Req struct {
        APIRequestsPerMinute      int `json:"api_per_minute"`
        APIRequestsPerHour        int `json:"api_per_hour"`
        SiteRankRequestsPerMinute int `json:"siterank_per_minute"`
        SiteRankRequestsPerHour   int `json:"siterank_per_hour"`
        BatchConcurrentTasks      int `json:"batch_concurrent"`
        BatchTasksPerMinute       int `json:"batch_tasks_per_minute"`
    }
    var req Req
    if err := ctx.ShouldBindJSON(&req); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code": 1001, "message": "invalid body"}); return
    }
    plan := strings.ToUpper(ctx.Param("plan"))
    if plan == "" { ctx.JSON(http.StatusOK, gin.H{"code":1002, "message":"plan required"}); return }

    // 构建配置并更新到内存+数据库
    limit := &ratelimit.PlanRateLimit{
        Plan:                      plan,
        APIRequestsPerMinute:      req.APIRequestsPerMinute,
        APIRequestsPerHour:        req.APIRequestsPerHour,
        SiteRankRequestsPerMinute: req.SiteRankRequestsPerMinute,
        SiteRankRequestsPerHour:   req.SiteRankRequestsPerHour,
        BatchConcurrentTasks:      req.BatchConcurrentTasks,
        BatchTasksPerMinute:       req.BatchTasksPerMinute,
    }
    if err := c.manager.UpdatePlanLimit(plan, limit); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code": 5002, "message": err.Error()}); return
    }

    // 广播Redis事件，路由订阅后即时刷新
    if gf.Redis() != nil {
        _ = gf.Redis().GroupPubSub().Publish(ctx, "ratelimit:plans:update", "1")
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

// BroadcastReload 主动广播一次刷新事件
func (c *RateLimitController) BroadcastReload(ctx *gin.Context) {
    if gf.Redis() != nil {
        _ = gf.Redis().GroupPubSub().Publish(ctx, "ratelimit:plans:update", "1")
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
