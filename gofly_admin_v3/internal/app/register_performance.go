package app

import (
    "math"
    "time"
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
    "gofly-admin-v3/internal/autoclick"
)

// percentile from sorted slice
func percentile(sorted []int64, p float64) int64 {
    if len(sorted) == 0 { return 0 }
    if p <= 0 { return sorted[0] }
    if p >= 1 { return sorted[len(sorted)-1] }
    idx := int(math.Ceil(float64(len(sorted))*p)) - 1
    if idx < 0 { idx = 0 }
    if idx >= len(sorted) { idx = len(sorted)-1 }
    return sorted[idx]
}

// RegisterPerformance 注册性能与分布相关指标端点
// - GET /api/v1/batchopen/metrics
// - GET /api/v1/adscenter/metrics
// - GET /api/v1/siterank/cache-insights 见 register_stats.go 中 SiteRank stats 的补充
func RegisterPerformance(v1 *gin.RouterGroup, gormDB *gorm.DB) {
    // BatchOpen 任务分布与耗时（最近200条）
    v1.GET("/batchopen/metrics", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code":5000, "message":"db unavailable"}); return }
        type row struct{ Status string; Start *time.Time; End *time.Time }
        var rows []row
        _ = gormDB.Table("batch_tasks").Select("status, start_time as start, end_time as end").Order("created_at DESC").Limit(200).Find(&rows).Error
        counts := map[string]int{"pending":0,"running":0,"completed":0,"failed":0,"cancelled":0,"paused":0}
        var durations []int64
        for _, r := range rows {
            s := r.Status
            if _, ok := counts[s]; ok { counts[s]++ } else { counts[s] = 1 }
            if r.Start != nil && r.End != nil {
                d := r.End.Sub(*r.Start).Milliseconds()
                if d > 0 { durations = append(durations, d) }
            }
        }
        // sort durations
        for i := 1; i < len(durations); i++ {
            key := durations[i]
            j := i-1
            for j >=0 && durations[j] > key { durations[j+1] = durations[j]; j-- }
            durations[j+1] = key
        }
        avg := int64(0)
        if len(durations) > 0 {
            var sum int64
            for _, d := range durations { sum += d }
            avg = sum / int64(len(durations))
        }
        c.JSON(200, gin.H{
            "counts": counts,
            "duration_ms": gin.H{
                "avg": avg,
                "p50": percentile(durations, 0.50),
                "p90": percentile(durations, 0.90),
                "p99": percentile(durations, 0.99),
            },
        })
    })

    // AdsCenter 执行分布与耗时（最近200条）
    v1.GET("/adscenter/metrics", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code":5000, "message":"db unavailable"}); return }
        type row struct{ Status string; CreatedAt time.Time; CompletedAt *time.Time }
        var rows []row
        _ = gormDB.Table("ads_executions").Select("status, created_at, completed_at").Order("created_at DESC").Limit(200).Find(&rows).Error
        counts := map[string]int{"created":0,"pending":0,"running":0,"completed":0,"failed":0}
        var durations []int64
        for _, r := range rows {
            s := r.Status
            if _, ok := counts[s]; ok { counts[s]++ } else { counts[s] = 1 }
            if r.CompletedAt != nil {
                d := r.CompletedAt.Sub(r.CreatedAt).Milliseconds()
                if d > 0 { durations = append(durations, d) }
            }
        }
        // simple sort
        for i := 1; i < len(durations); i++ {
            key := durations[i]
            j := i-1
            for j >=0 && durations[j] > key { durations[j+1] = durations[j]; j-- }
            durations[j+1] = key
        }
        avg := int64(0)
        if len(durations) > 0 {
            var sum int64
            for _, d := range durations { sum += d }
            avg = sum / int64(len(durations))
        }
        c.JSON(200, gin.H{
            "counts": counts,
            "duration_ms": gin.H{
                "avg": avg,
                "p50": percentile(durations, 0.50),
                "p90": percentile(durations, 0.90),
                "p99": percentile(durations, 0.99),
            },
        })
    })

    // AutoClick 队列与池状态（简化）
    v1.GET("/autoclick/queue/metrics", func(c *gin.Context) {
        st := autoclick.GetPoolManager().State()
        // 近100条执行状态分布
        type row struct{ Status string }
        var rows []row
        _ = gormDB.Table("autoclick_executions").Select("status").Order("updated_at DESC").Limit(100).Find(&rows).Error
        counts := map[string]int{}
        for _, r := range rows { counts[r.Status]++ }
        c.JSON(200, gin.H{"pool": st, "recent": counts})
    })
}
