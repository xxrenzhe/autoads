package app

import (
    "time"
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
)

// RegisterCacheInsights 提供 SiteRank 缓存洞察（命中率估计与TTL建议）
// GET /api/v1/siterank/cache-insights
func RegisterCacheInsights(v1 *gin.RouterGroup, gormDB *gorm.DB) {
    v1.GET("/siterank/cache-insights", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
        now := time.Now()
        type kv struct{ V int64 }
        var totalRows kv
        _ = gormDB.Raw("SELECT COUNT(*) AS v FROM siterank_queries").Scan(&totalRows).Error
        var totalReq kv
        _ = gormDB.Raw("SELECT COALESCE(SUM(request_count),0) AS v FROM siterank_queries").Scan(&totalReq).Error
        var activeCache kv
        _ = gormDB.Raw("SELECT COUNT(*) AS v FROM siterank_queries WHERE status='completed' AND cache_until > NOW()").Scan(&activeCache).Error
        // 最近7天失败
        var failed7 kv
        _ = gormDB.Raw("SELECT COUNT(*) AS v FROM siterank_queries WHERE status='failed' AND updated_at>=DATE_SUB(NOW(), INTERVAL 7 DAY)").Scan(&failed7).Error
        // 采样TTL（小时）
        type pair struct{ U time.Time; C time.Time }
        var pairs []pair
        _ = gormDB.Raw("SELECT updated_at as u, cache_until as c FROM siterank_queries WHERE status='completed' AND cache_until>updated_at ORDER BY updated_at DESC LIMIT 1000").Scan(&pairs).Error
        ttlHours := []int64{}
        for _, p := range pairs {
            d := p.C.Sub(p.U)
            if d > 0 { ttlHours = append(ttlHours, int64(d.Hours())) }
        }
        // 简单平均与P50
        var avg int64
        if len(ttlHours) > 0 {
            var sum int64
            for _, v := range ttlHours { sum += v }
            avg = sum / int64(len(ttlHours))
        }
        // 估算命中率： (总请求-唯一记录)/总请求（粗略）
        estHit := 0.0
        if totalReq.V > 0 {
            est := float64(totalReq.V - totalRows.V) / float64(totalReq.V)
            if est < 0 { est = 0 }
            if est > 1 { est = 1 }
            estHit = est
        }
        // 简单TTL建议：夹在24~168小时之间，向最近平均靠拢
        suggested := avg
        if suggested < 24 { suggested = 24 }
        if suggested > 168 { suggested = 168 }

        c.JSON(200, gin.H{
            "totalRows": totalRows.V,
            "totalRequests": totalReq.V,
            "estimatedHitRate": estHit,
            "activeCacheRows": activeCache.V,
            "failed7d": failed7.V,
            "sampledTTLHoursAvg": avg,
            "suggestedTTLHours": suggested,
            "ts": now.Unix(),
        })
    })
}

