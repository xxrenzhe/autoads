package app

import (
    "time"
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
)

// RegisterStats 注册只读统计端点（简化版）
// - GET /api/v1/siterank/stats
// - GET /api/v1/batchopen/stats
func RegisterStats(v1 *gin.RouterGroup, gormDB *gorm.DB) {
    // SiteRank 统计：总记录、请求次数、7天失败数、7天退款次数
    v1.GET("/siterank/stats", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
        // 总记录
        var total int64
        _ = gormDB.Table("siterank_queries").Count(&total).Error
        // 请求次数（request_count 累加）
        var reqCount int64
        _ = gormDB.Table("siterank_queries").Select("COALESCE(SUM(request_count),0)").Scan(&reqCount).Error
        // 7天失败数
        seven := time.Now().AddDate(0,0,-7)
        var failed7 int64
        _ = gormDB.Table("siterank_queries").Where("status=? AND updated_at>=?", "failed", seven).Count(&failed7).Error
        // 7天退款次数（按描述模糊）
        var refunds7 int64
        _ = gormDB.Table("token_transactions").Where("type=? AND description LIKE ? AND created_at>=?", "refund", "siterank%", seven).Count(&refunds7).Error
        c.JSON(200, gin.H{"total": total, "requestCount": reqCount, "failed7d": failed7, "refunds7d": refunds7})
    })

    // BatchOpen 统计：7天消费与退款次数
    v1.GET("/batchopen/stats", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
        seven := time.Now().AddDate(0,0,-7)
        var consumes7 int64
        _ = gormDB.Table("token_transactions").Where("type=? AND description LIKE ? AND created_at>=?", "consume", "batch%", seven).Count(&consumes7).Error
        var refunds7 int64
        _ = gormDB.Table("token_transactions").Where("type=? AND description LIKE ? AND created_at>=?", "refund", "batch%", seven).Count(&refunds7).Error
        c.JSON(200, gin.H{"consumes7d": consumes7, "refunds7d": refunds7})
    })
}

