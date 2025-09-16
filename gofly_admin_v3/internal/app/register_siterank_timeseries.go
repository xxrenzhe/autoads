package app

import (
    "math"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
)

// RegisterSiteRankTimeSeries 注册 SiteRank 缓存命中率时间序列端点
// GET /api/v1/siterank/cache-timeseries?window=24h&bucket=1h&group_by=user
func RegisterSiteRankTimeSeries(v1 *gin.RouterGroup, gormDB *gorm.DB) {
    v1.GET("/siterank/cache-timeseries", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code":5000, "message":"db unavailable"}); return }
        window := strings.TrimSpace(c.DefaultQuery("window", "24h"))
        bucket := strings.TrimSpace(c.DefaultQuery("bucket", "1h"))
        groupBy := strings.TrimSpace(c.DefaultQuery("group_by", "none"))

        // parse window
        dur, err := time.ParseDuration(window)
        if err != nil || dur <= 0 { dur = 24 * time.Hour }
        // parse bucket in hours/minutes suffix
        bd, err := time.ParseDuration(bucket)
        if err != nil || bd <= 0 { bd = time.Hour }
        from := time.Now().Add(-dur)
        bucketSec := int64(bd.Seconds())
        if bucketSec <= 0 { bucketSec = 3600 }

        // Build base query
        // Using UNIX_TIMESTAMP(created_at) DIV bucket * bucket as ts
        base := gormDB.Table("siterank_cache_events").
            Where("created_at >= ?", from)

        // time series overall
        type row struct{ Ts int64; Hits int64; Total int64 }
        var rows []row
        _ = base.Select("(UNIX_TIMESTAMP(created_at) DIV ?) * ? as ts, SUM(CASE WHEN hit THEN 1 ELSE 0 END) as hits, COUNT(*) as total", bucketSec, bucketSec).
            Group("ts").Order("ts").Scan(&rows).Error

        series := make([]gin.H, 0, len(rows))
        for _, r := range rows {
            rate := 0.0
            if r.Total > 0 { rate = float64(r.Hits) / float64(r.Total) }
            series = append(series, gin.H{"ts": r.Ts, "hits": r.Hits, "total": r.Total, "hitRate": math.Round(rate*1000)/1000})
        }

        out := gin.H{"series": series, "bucketSec": bucketSec, "from": from.Unix()}

        if groupBy == "user" {
            type ur struct{ UserID string; Hits int64; Total int64 }
            var urows []ur
            _ = base.Select("user_id, SUM(CASE WHEN hit THEN 1 ELSE 0 END) as hits, COUNT(*) as total").Group("user_id").Order("total DESC").Limit(50).Scan(&urows).Error
            top := []gin.H{}
            for _, r := range urows {
                rate := 0.0
                if r.Total > 0 { rate = float64(r.Hits)/float64(r.Total) }
                top = append(top, gin.H{"userId": r.UserID, "hits": r.Hits, "total": r.Total, "hitRate": math.Round(rate*1000)/1000})
            }
            out["byUser"] = top
        }

        // optional: limit points
        if n := c.DefaultQuery("limit", ""); n != "" {
            if lim, err := strconv.Atoi(n); err == nil && lim > 0 && len(series) > lim {
                out["series"] = series[len(series)-lim:]
            }
        }

        c.JSON(http.StatusOK, out)
    })
}

