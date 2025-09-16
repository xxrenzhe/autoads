package app

import (
    "math"
    "time"
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
    "gofly-admin-v3/internal/autoclick"
    ads "gofly-admin-v3/internal/adscenter"
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
        // 同时聚合 adscenter_tasks 的分布、阶段耗时与分类
        var tasks []ads.AdsCenterTask
        _ = gormDB.Order("created_at DESC").Limit(200).Find(&tasks).Error
        tcounts := map[string]int{"pending":0,"extracting":0,"updating":0,"completed":0,"failed":0,"cancelled":0}
        var tdur []int64
        var tdurExtract []int64
        var tdurUpdate []int64
        classifications := map[string]int{}
        // 按用户分布
        byUserCounts := map[string]map[string]int{}
        byUserDur := map[string][]int64{}
        // helper to parse time from log timestamp (format: 2006-01-02 15:04:05)
        parseTS := func(s string) (time.Time, bool) {
            t, err := time.Parse("2006-01-02 15:04:05", s)
            if err != nil { return time.Time{}, false }
            return t, true
        }
        for _, t := range tasks {
            if _, ok := tcounts[string(t.Status)]; ok { tcounts[string(t.Status)]++ } else { tcounts[string(t.Status)] = 1 }
            if t.CompletedAt != nil {
                d := t.CompletedAt.Sub(t.CreatedAt).Milliseconds()
                if d > 0 { tdur = append(tdur, d) }
                if t.UserID != "" { byUserDur[t.UserID] = append(byUserDur[t.UserID], d) }
            }
            if t.UserID != "" {
                if _, ok := byUserCounts[t.UserID]; !ok { byUserCounts[t.UserID] = map[string]int{} }
                byUserCounts[t.UserID][string(t.Status)]++
            }
            // 阶段耗时：根据日志时间点估算
            var tsStart, tsExtractDone, tsUpdateStart, tsUpdateDone time.Time
            for _, le := range t.ExecutionLog {
                switch {
                case le.Message == "开始执行任务":
                    if v, ok := parseTS(le.Timestamp); ok { tsStart = v }
                case le.Message == "链接提取完成":
                    if v, ok := parseTS(le.Timestamp); ok { tsExtractDone = v }
                case le.Message == "开始更新Google Ads":
                    if v, ok := parseTS(le.Timestamp); ok { tsUpdateStart = v }
                case le.Message == "广告更新完成":
                    if v, ok := parseTS(le.Timestamp); ok { tsUpdateDone = v }
                }
            }
            if !tsStart.IsZero() && !tsExtractDone.IsZero() {
                d := tsExtractDone.Sub(tsStart).Milliseconds()
                if d > 0 { tdurExtract = append(tdurExtract, d) }
            }
            if !tsUpdateStart.IsZero() && !tsUpdateDone.IsZero() {
                d := tsUpdateDone.Sub(tsUpdateStart).Milliseconds()
                if d > 0 { tdurUpdate = append(tdurUpdate, d) }
            }
            // 分类统计（提取/更新）
            for _, el := range t.ExtractedLinks {
                cls := el.Classification
                if cls == "" {
                    if el.Status == "success" { cls = "success" } else { cls = "upstream_error" }
                }
                classifications["extraction."+cls]++
            }
            for _, ur := range t.UpdateResults {
                cls := ur.Classification
                if cls == "" {
                    if ur.Status == "success" { cls = "success" } else { cls = "upstream_error" }
                }
                classifications["update."+cls]++
            }
        }
        // sort helpers already present
        sortInts := func(a []int64) []int64 {
            for i := 1; i < len(a); i++ { key := a[i]; j := i-1; for j >= 0 && a[j] > key { a[j+1] = a[j]; j-- }; a[j+1] = key }
            return a
        }
        sortInts(tdur); sortInts(tdurExtract); sortInts(tdurUpdate)
        // 汇总按用户平均耗时
        byUser := []gin.H{}
        for uid, arr := range byUserDur {
            avgU := int64(0)
            if len(arr) > 0 { var s int64; for _, d := range arr { s += d }; avgU = s / int64(len(arr)) }
            byUser = append(byUser, gin.H{"userId": uid, "avgDurationMs": avgU, "counts": byUserCounts[uid]})
        }

        c.JSON(200, gin.H{
            "counts": counts,
            "duration_ms": gin.H{
                "avg": avg,
                "p50": percentile(durations, 0.50),
                "p90": percentile(durations, 0.90),
                "p99": percentile(durations, 0.99),
            },
            "tasks": gin.H{
                "counts": tcounts,
                "duration_ms": gin.H{
                    "avg": func() int64 { if len(tdur)==0 {return 0}; var s int64; for _,d:= range tdur { s+=d }; return s/int64(len(tdur)) }(),
                    "p50": percentile(tdur, 0.50),
                    "p90": percentile(tdur, 0.90),
                    "p99": percentile(tdur, 0.99),
                },
                "phase_duration_ms": gin.H{
                    "extract": gin.H{"p50": percentile(tdurExtract, 0.50), "p90": percentile(tdurExtract, 0.90), "p99": percentile(tdurExtract, 0.99)},
                    "update":  gin.H{"p50": percentile(tdurUpdate, 0.50), "p90": percentile(tdurUpdate, 0.90), "p99": percentile(tdurUpdate, 0.99)},
                },
                "classifications": classifications,
                "byUser": byUser,
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
