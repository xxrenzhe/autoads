package autoclick

import (
    "context"
    "encoding/json"
    "fmt"
    "math"
    "math/rand"
    "os"
    "strings"
    "time"

    "github.com/google/uuid"
    "gofly-admin-v3/internal/scheduler"
    "gofly-admin-v3/internal/store"
    "gofly-admin-v3/internal/system"
    "gofly-admin-v3/utils/gf"
    "gorm.io/datatypes"
    "sync"
)

// AutoClickTickJob 每分钟扫描启用的计划并推进当前小时的执行进度（最小实现）
type AutoClickTickJob struct{}

func (j *AutoClickTickJob) GetName() string        { return "autoclick_tick" }
func (j *AutoClickTickJob) GetDescription() string { return "Tick enabled AutoClick schedules and advance hourly executions" }

// env helpers
func getVariance() float64 {
    // 优先从系统配置缓存读取，可热更新；回退环境变量
    if sv, ok := system.Get("AutoClick_Count_Variance_Hour"); ok {
        sv = strings.TrimSpace(sv)
        if sv != "" { if f := gf.Float64(sv); f > 0 { if f > 0.9 { return 0.9 } ; return f } }
    }
    v := strings.TrimSpace(os.Getenv("AutoClick_Count_Variance_Hour"))
    if v == "" { return 0.3 }
    f := gf.Float64(v)
    if f <= 0 { f = 0.3 }
    if f > 0.9 { f = 0.9 }
    return f
}

// tz offset (hours) for simplified mapping
func tzOffset(code string) int {
    switch strings.ToUpper(strings.TrimSpace(code)) {
    case "US":
        return -8
    case "CN":
        return 8
    case "UK":
        return 0
    case "JP":
        return 9
    default:
        return 0
    }
}

func localDateTime(t time.Time, tz string) (date string, hour int) {
    off := tzOffset(tz)
    tt := t.UTC().Add(time.Duration(off) * time.Hour)
    return tt.Format("2006-01-02"), tt.Hour()
}

func (j *AutoClickTickJob) Run(ctx context.Context) error {
    // 依赖全局 DB/Redis
    gdb := store.GetGormDB()
    if gdb == nil { return nil }
    storeRedis := store.GetRedis()

    var schedules []AutoClickSchedule
    if err := gdb.Where("status = ?", string(StatusEnabled)).Find(&schedules).Error; err != nil { return nil }
    variance := getVariance()

    for _, s := range schedules {
        now := time.Now()
        dateStr, hour := localDateTime(now, s.Timezone)
        // 1) daily plan
        var plan AutoClickDailyPlan
        if err := gdb.Where("schedule_id = ? AND date = ?", s.ID, dateStr).First(&plan).Error; err != nil {
            // create
            dist := make([]int, 24)
            // derive active hours by timeWindow
            start, end := 0, 24
            if s.TimeWindow == "06:00-24:00" { start, end = 6, 24 }
            h := end - start
            if h <= 0 { h = 24; start = 0; end = 24 }
            base := float64(s.DailyTarget) / float64(h)
            remain := s.DailyTarget
            // simple weight: peak 9-22 +20%
            for i := start; i < end; i++ {
                w := 1.0
                if i >= 9 && i <= 22 { w = 1.2 }
                jitter := 1.0 + (rand.Float64()*2*variance - variance)
                v := int(math.Max(0, math.Round(base*w*jitter)))
                dist[i] = v
                remain -= v
            }
            // fix sum by distributing remainder
            for remain > 0 {
                i := start + rand.Intn(h)
                dist[i]++
                remain--
            }
            // trim negative if any
            for i := range dist { if dist[i] < 0 { dist[i] = 0 } }
            b, _ := json.Marshal(dist)
            plan = AutoClickDailyPlan{ ID: uuid.New().String(), ScheduleID: s.ID, UserID: s.UserID, Date: dateStr, Distribution: datatypes.JSON(b), Variance: variance, WeightProfile: "default", CreatedAt: now }
            _ = gdb.Create(&plan).Error
        }

        // 2) execution row
        var exec AutoClickExecution
        if err := gdb.Where("schedule_id = ? AND date = ?", s.ID, dateStr).First(&exec).Error; err != nil {
            exec = AutoClickExecution{ ID: uuid.New().String(), ScheduleID: s.ID, UserID: s.UserID, Date: dateStr, Status: "running", Total: s.DailyTarget, CreatedAt: now, UpdatedAt: now }
            _ = gdb.Create(&exec).Error
        }
        if exec.Status == "completed" || exec.Total <= 0 { continue }

        // 3) parse distribution
        var arr []int
        _ = json.Unmarshal([]byte(plan.Distribution), &arr)
        target := 0
        if hour >= 0 && hour < len(arr) { target = arr[hour] }
        if target <= 0 { continue }

        // 4) snapshot for current hour (aggregate from snapshots)
        var snap AutoClickExecutionSnapshot
        if err := gdb.Where("execution_id = ? AND hour = ?", exec.ID, hour).First(&snap).Error; err != nil {
            snap = AutoClickExecutionSnapshot{ ID: uuid.New().String(), ExecutionID: exec.ID, Hour: hour, CreatedAt: now }
            _ = gdb.Create(&snap).Error
        }

        due := target - snap.Total
        if due <= 0 { continue }
        // 限制每次tick推进步长，避免一次性打满
        step := due
        // 通过系统配置限制每次推进步长（热更新）
        if v, ok := system.Get("AutoClick_MaxStepPerTick"); ok {
            if n := gf.Int(v); n > 0 && step > n { step = n }
        } else if step > 3 { step = 3 }

        // 基于每用户RPM限制当分钟最大推进（热更新）
        if storeRedis != nil {
            // 从系统配置或外部提供者获取 RPM
            rpm := 0
            if v, ok := system.Get("AutoClick_User_RPM"); ok { rpm = gf.Int(v) }
            if rpm <= 0 && rateLimitProvider != nil {
                if r, _ := rateLimitProvider(s.UserID); r > 0 { rpm = r }
            }
            if rpm > 0 {
                    // 计算本地时区分钟键
                    off := tzOffset(s.Timezone)
                    nowLocal := time.Now().UTC().Add(time.Duration(off) * time.Hour)
                    minuteKey := nowLocal.Format("2006-01-02:15:04")
                    key := fmt.Sprintf("autoads:ac:usage:minute:%s:%s", s.UserID, minuteKey)
                    usedStr, _ := storeRedis.Get(ctx, key)
                    used := gf.Int(usedStr)
                    remain := rpm - used
                    if remain <= 0 { continue }
                    if step > remain { step = remain }
            }
        }

        // 5) 执行 step 次：选择 URL、per-URL 决策、Token 扣费/退款
        //    - 优先 HTTP，若存在 prefer_browser 标记则用浏览器
        //    - 失败计数：autoads:ac:fail:http|browser:{user}:{hash}，TTL=24h
        //    - 标记：autoads:ac:prefer_browser:{user}:{hash}，TTL=7d
        success := 0
        fail := 0
        // 解析URL数组
        var urlArr []string
        _ = json.Unmarshal([]byte(s.URLs), &urlArr)
        httpExec := &HTTPExecutor{}
        brExec := &BrowserExecutor{}
        // 并发度（热更新）：HTTP / Browser（通过长期池管理）
        httpConc := 10
        if v, ok := system.Get("AutoClick_HTTP_Concurrency"); ok { if n := gf.Int(v); n > 0 { httpConc = n } }
        brConc := 3
        if v, ok := system.Get("AutoClick_Browser_Concurrency"); ok { if n := gf.Int(v); n > 0 { brConc = n } }
        // 确保池已初始化
        pm := GetPoolManager()
        pm.Ensure(httpConc, brConc)
        var mu sync.Mutex
        var wg sync.WaitGroup

        for i := 0; i < step; i++ {
            if len(urlArr) == 0 { break }
            u := urlArr[rand.Intn(len(urlArr))]
            uh := hashURL(u)
            preferKey := fmt.Sprintf("autoads:ac:prefer_browser:%s:%s", s.UserID, uh)
            httpFailKey := fmt.Sprintf("autoads:ac:fail:http:%s:%s", s.UserID, uh)
            brFailKey := fmt.Sprintf("autoads:ac:fail:browser:%s:%s", s.UserID, uh)
            useBrowser := getFlag(preferKey)

            // 组装执行参数（代理/Referer/超时）
            opt := &ExecOptions{ Timeout: 20 * time.Second }
            if s.ProxyURL != nil && *s.ProxyURL != "" { opt.Proxy = *s.ProxyURL } else {
                key := "Proxy_URL_" + strings.ToUpper(s.Timezone)
                if val, ok := system.Get(key); ok && strings.TrimSpace(val) != "" { opt.Proxy = strings.TrimSpace(val) } else if v := os.Getenv(key); v != "" { opt.Proxy = v }
            }
            if s.RefererValue != "" { opt.Referer = s.RefererValue }

            wg.Add(1)
            go func(u, uh string, useBrowser bool) {
                defer wg.Done()
                // 构造任务
                t := Task{
                    Run: func() bool {
                        // Token 预扣（不足则跳过并标记失败）
                        if tokenSvc != nil {
                            if err := tokenSvc.ConsumeTokensByService(s.UserID, "batchopen", "autoclick", 1, exec.ID); err != nil {
                                _ = gdb.Model(&AutoClickExecution{}).Where("id = ?", exec.ID).Updates(map[string]interface{}{"status": "failed", "message": "INSUFFICIENT_TOKENS", "updated_at": time.Now()}).Error
                                return false
                            }
                        }
                        if !useBrowser {
                            ok, _, _ := httpExec.Do(u, opt)
                            if !ok { n := incrFail(httpFailKey, 24*time.Hour); if n >= 3 { setFlag(preferKey, 7*24*time.Hour) } }
                            return ok
                        } else {
                            ok, _, _ := brExec.Do(u, opt)
                            if !ok { n := incrFail(brFailKey, 24*time.Hour); if n >= 3 { t := time.Now(); _ = gdb.Create(&AutoClickURLFailure{ ID: uuid.New().String(), UserID: s.UserID, URLHash: uh, URL: u, BrowserFailConsecutive: n, LastFailAt: &t, CreatedAt: t, UpdatedAt: t }).Error } }
                            return ok
                        }
                    },
                    Done: func(ok bool) {
                        mu.Lock()
                        if ok { success++ } else { fail++; if tokenSvc != nil { _ = tokenSvc.AddTokens(s.UserID, 1, "refund", "autoclick item failed", exec.ID) } }
                        mu.Unlock()
                        // RPM 记录
                        if storeRedis != nil {
                            off := tzOffset(s.Timezone)
                            nowLocal := time.Now().UTC().Add(time.Duration(off) * time.Hour)
                            minuteKey := nowLocal.Format("2006-01-02:15:04")
                            key := fmt.Sprintf("autoads:ac:usage:minute:%s:%s", s.UserID, minuteKey)
                            _, _ = storeRedis.Incr(ctx, key)
                            next := nowLocal.Truncate(time.Minute).Add(time.Minute)
                            ttl := time.Until(next)
                            if ttl < 10*time.Second { ttl = 10 * time.Second }
                            _ = storeRedis.Expire(ctx, key, ttl)
                        }
                    },
                }
                // 提交到池
                if !useBrowser { pm.SubmitHTTP(t) } else { pm.SubmitBrowser(t) }
            }(u, uh, useBrowser)
        }
        wg.Wait()

        // 6) 更新 snapshot 与 execution
        snap.Success += success
        snap.Fail += fail
        snap.Total += step
        _ = gdb.Model(&AutoClickExecutionSnapshot{}).Where("id = ?", snap.ID).Updates(map[string]interface{}{
            "success": snap.Success, "fail": snap.Fail, "total": snap.Total,
        }).Error

        exec.Success += success
        exec.Fail += fail
        done := exec.Success + exec.Fail
        if exec.Total > 0 { exec.Progress = int(math.Round(float64(done) / float64(exec.Total) * 100.0)) }
        exec.UpdatedAt = time.Now()
        if done >= exec.Total { exec.Status = "completed"; t := time.Now(); exec.CompletedAt = &t }
        _ = gdb.Model(&AutoClickExecution{}).Where("id = ?", exec.ID).Updates(map[string]interface{}{
            "success": exec.Success, "fail": exec.Fail, "progress": exec.Progress, "status": exec.Status, "updated_at": exec.UpdatedAt, "completed_at": exec.CompletedAt,
        }).Error

        // 7) SSE 推送（简化为 Redis Pub/Sub）
        if storeRedis != nil {
            payload := map[string]interface{}{
                "type": "execution_update", "id": exec.ID, "scheduleId": s.ID, "status": exec.Status, "progress": exec.Progress,
                "processedItems": done, "totalItems": exec.Total, "timestamp": time.Now().UnixMilli(),
            }
            b, _ := json.Marshal(payload)
            ctxPub := context.Background()
            _ = storeRedis.Publish(ctxPub, "autoclick:executions:updates", string(b))
            _ = storeRedis.Publish(ctxPub, "autoclick:exec:"+exec.ID, string(b))
            _ = storeRedis.Publish(ctxPub, "autoclick:schedule:"+s.ID, string(b))
        }
    }
    return nil
}

// RegisterAutoClickJob 注册 AutoClickTickJob 到调度器（每分钟）
func RegisterAutoClickJob() {
    _ = scheduler.AddJob(&scheduler.CronJob{ Job: &AutoClickTickJob{}, Schedule: "0 * * * * *", Enabled: true, Description: "AutoClick scheduler tick", Timeout: 20 * time.Second })
}
