package admin

import (
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

// MonitoringController 监控与告警（简化实现）
type MonitoringController struct{}

func RegisterMonitoringRoutes(r *gin.RouterGroup) {
    mc := &MonitoringController{}
    g := r.Group("/monitoring")
    {
        g.GET("/health", mc.Health)
        g.GET("/alerts", mc.ListAlerts)
        g.POST("/alerts", mc.SaveAlerts)
    }
}

// Health 返回基础健康信息（DB/Redis/进程）
func (c *MonitoringController) Health(ctx *gin.Context) {
    // DB ping
    dbOK := true
    if _, err := gf.DB().Query(ctx, "SELECT 1"); err != nil { dbOK = false }
    // Redis ping
    redisOK := true
    if gf.Redis() != nil {
        if _, err := gf.Redis().Do(ctx, "PING"); err != nil { redisOK = false }
    }
    data := gf.Map{
        "time": time.Now(),
        "db_ok": dbOK,
        "redis_ok": redisOK,
        "goroutines": gf.GetGoroutineCount(),
        "memory": gf.GetMemoryUsage(),
        "uptime": gf.GetUptime().String(),
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": data})
}

// 告警规则存在 system_configs: monitoring:alerts
const alertsKey = "monitoring:alerts"

func (c *MonitoringController) ListAlerts(ctx *gin.Context) {
    row, err := gf.DB().Raw("SELECT config_value FROM system_configs WHERE config_key=?", alertsKey).One()
    if err != nil || row == nil { ctx.JSON(http.StatusOK, gin.H{"code":0, "data": []interface{}{} }); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": row["config_value"].String()})
}

func (c *MonitoringController) SaveAlerts(ctx *gin.Context) {
    var body interface{}
    if err := ctx.ShouldBindJSON(&body); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"invalid body"}); return }
    // 保存JSON字符串
    val := gf.JSONToString(body)
    _, err := gf.DB().Exec(ctx, `INSERT INTO system_configs (config_key,config_value,description,category,is_active,created_at,updated_at) VALUES (?,?,?,?,TRUE,NOW(),NOW()) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value), updated_at=NOW()`, alertsKey, val, "告警规则", "monitoring")
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"saved"})
}

