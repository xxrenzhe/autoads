package audit

import (
    "context"
    "encoding/json"
    "net/http"
    "os"
    "strconv"
    "sync"
    "time"

    "github.com/gin-gonic/gin"
    cfg "gofly-admin-v3/internal/config"
    "gofly-admin-v3/internal/store"
)

// APIResponse 统一响应
type APIResponse struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data,omitempty"`
}

// Controller 审计控制器
type Controller struct {
    service *AutoAdsAuditService
}

func NewController(s *AutoAdsAuditService) *Controller { return &Controller{service: s} }

// GetUserActivitySummaryHandler GET /api/v1/audit/user/activity-summary
func (c *Controller) GetUserActivitySummaryHandler(ctx *gin.Context) {
    // 简单内存缓存：key=path+user+days，TTL 60s
    key := "user_activity_summary:" + ctx.Query("user_id") + ":" + ctx.DefaultQuery("days", "30")
    if data, ok := cacheGet(key); ok {
        ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "ok", Data: data})
        return
    }
    userID := ctx.GetString("user_id")
    if q := ctx.Query("user_id"); q != "" {
        userID = q
    }
    if userID == "" {
        ctx.JSON(http.StatusOK, APIResponse{Code: 3001, Message: "用户未认证"})
        return
    }
    days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
    if days <= 0 { days = 30 }
    summary, err := c.service.GetUserActivitySummary(userID, days)
    if err != nil {
        ctx.JSON(http.StatusOK, APIResponse{Code: 2001, Message: err.Error()})
        return
    }
    cacheSet(key, summary, 60*time.Second)
    ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "ok", Data: summary})
}

// GetSecurityOverviewHandler GET /api/v1/audit/security/overview
func (c *Controller) GetSecurityOverviewHandler(ctx *gin.Context) {
    days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
    if days <= 0 { days = 30 }
    // 内存缓存 TTL 120s
    key := "security_overview:" + strconv.Itoa(days)
    if data, ok := cacheGet(key); ok {
        ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "ok", Data: data})
        return
    }
    stats, err := c.service.GetSecurityStats(days)
    if err != nil {
        ctx.JSON(http.StatusOK, APIResponse{Code: 2001, Message: err.Error()})
        return
    }
    since := time.Now().AddDate(0, 0, -days)
    apiAbuse := c.service.getAPIAbuseStats(since)
    suspicious := c.service.getSuspiciousUsers(since)
    payload := gin.H{
        "security_stats":   stats,
        "api_abuse_stats":  apiAbuse,
        "suspicious_users": suspicious,
    }
    cacheSet(key, payload, 120*time.Second)
    ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "ok", Data: payload})
}

// GetDataAccessEventsHandler GET /api/v1/audit/events/data-access
func (c *Controller) GetDataAccessEventsHandler(ctx *gin.Context) {
    start, end := parseTimeRange(ctx)
    data := c.service.getDataAccessEvents(start, end)
    ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "ok", Data: data})
}

// GetPermissionChangesHandler GET /api/v1/audit/events/permission-changes
func (c *Controller) GetPermissionChangesHandler(ctx *gin.Context) {
    start, end := parseTimeRange(ctx)
    data := c.service.getPermissionChanges(start, end)
    ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "ok", Data: data})
}

// GetDataExportEventsHandler GET /api/v1/audit/events/data-exports
func (c *Controller) GetDataExportEventsHandler(ctx *gin.Context) {
    start, end := parseTimeRange(ctx)
    data := c.service.getDataExportEvents(start, end)
    ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "ok", Data: data})
}

// GetAdminActionsHandler GET /api/v1/audit/events/admin-actions (需要管理员)
func (c *Controller) GetAdminActionsHandler(ctx *gin.Context) {
    role := ctx.GetString("user_role")
    if role != "admin" && role != "SUPER_ADMIN" && role != "ADMIN" {
        ctx.JSON(http.StatusForbidden, APIResponse{Code: 403, Message: "需要管理员权限"})
        return
    }
    start, end := parseTimeRange(ctx)
    data := c.service.getAdminActions(start, end)
    ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "ok", Data: data})
}

func parseTimeRange(ctx *gin.Context) (time.Time, time.Time) {
    startStr := ctx.Query("start")
    endStr := ctx.Query("end")
    var start, end time.Time
    var err error
    if startStr == "" {
        start = time.Now().AddDate(0, 0, -30)
    } else {
        start, err = time.Parse(time.RFC3339, startStr)
        if err != nil { start = time.Now().AddDate(0, 0, -30) }
    }
    if endStr == "" {
        end = time.Now()
    } else {
        end, err = time.Parse(time.RFC3339, endStr)
        if err != nil { end = time.Now() }
    }
    return start, end
}

// 轻量内存缓存（进程内），避免重复大聚合
type cacheEntry struct {
    data interface{}
    exp  time.Time
}

var cacheStore sync.Map

func cacheGet(key string) (interface{}, bool) {
    // Redis first
    if rc := redisClient(); rc != nil {
        ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
        defer cancel()
        v, err := rc.Get(ctx, redisKey(key))
        if err == nil && v != "" {
            var out interface{}
            if json.Unmarshal([]byte(v), &out) == nil {
                return out, true
            }
        }
    }
    if v, ok := cacheStore.Load(key); ok {
        ce := v.(cacheEntry)
        if time.Now().Before(ce.exp) {
            return ce.data, true
        }
        cacheStore.Delete(key)
    }
    return nil, false
}

func cacheSet(key string, data interface{}, ttl time.Duration) {
    cacheStore.Store(key, cacheEntry{data: data, exp: time.Now().Add(ttl)})
    if rc := redisClient(); rc != nil {
        b, err := json.Marshal(data)
        if err == nil {
            ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
            defer cancel()
            _ = rc.Set(ctx, redisKey(key), string(b), ttl)
        }
    }
}

// -------- Redis cache helpers (best-effort, optional) --------
var (
    redisOnce sync.Once
    redisCli  *store.Redis
)

func redisClient() *store.Redis {
    redisOnce.Do(func() {
        // Prefer config manager
        cm := cfg.GetConfigManager()
        if cm != nil {
            c := cm.GetConfig()
            if c != nil && c.Redis.Enable {
                if r, err := store.NewRedis(&c.Redis); err == nil {
                    redisCli = r
                    return
                }
            }
        }
        // Fallback to ENV
        if os.Getenv("REDIS_ENABLE") == "true" || os.Getenv("REDIS_HOST") != "" {
            host := os.Getenv("REDIS_HOST")
            if host == "" { host = "127.0.0.1" }
            portStr := os.Getenv("REDIS_PORT")
            if portStr == "" { portStr = "6379" }
            port, _ := strconv.Atoi(portStr)
            pass := os.Getenv("REDIS_PASSWORD")
            dbStr := os.Getenv("REDIS_DB")
            db, _ := strconv.Atoi(dbStr)
            poolStr := os.Getenv("REDIS_POOLSIZE")
            pool, _ := strconv.Atoi(poolStr)
            rc := &cfg.RedisConfig{Enable: true, Host: host, Port: port, Password: pass, DB: db, PoolSize: pool}
            if r, err := store.NewRedis(rc); err == nil {
                redisCli = r
                return
            }
        }
        redisCli = nil
    })
    return redisCli
}

func redisKey(k string) string { return "audit:cache:" + k }
