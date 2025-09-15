package admin

import (
    "crypto/sha1"
    "encoding/hex"
    "encoding/json"
    "net/http"
    "os"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/internal/security"
    "gofly-admin-v3/utils/gf"
)

// ApiManagementController API管理控制器（端点与API Key）
type ApiManagementController struct{}

const (
    cfgKeyEndpoints = "api_management:endpoints"
    cfgKeyAPIKeys   = "api_management:keys"
)

// ======== 通用存取(system_configs) ========
// 说明：统一以 config_key/config_value 持久化，避免与表保留字冲突；不依赖 created_by/updated_by 等不存在列。
func (c *ApiManagementController) getConfigJSON(ctx *gin.Context, key string) ([]byte, error) {
    row, err := gf.DB().Get(ctx, "SELECT config_value FROM system_configs WHERE config_key=? AND is_active=1 LIMIT 1", key)
    if err != nil || row == nil { return nil, err }
    val := gf.String(row["config_value"])
    return []byte(val), nil
}

func (c *ApiManagementController) saveConfigJSON(ctx *gin.Context, key string, jsonBytes []byte, _ bool) error {
    // UPSERT 到统一列：config_key/config_value/category/description/is_active
    _, err := gf.DB().Exec(
        ctx,
        "INSERT INTO system_configs(config_key,config_value,category,description,is_active,created_at,updated_at) VALUES(?,?,?,?,TRUE,NOW(),NOW()) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value), category=VALUES(category), description=VALUES(description), is_active=VALUES(is_active), updated_at=NOW()",
        key, string(jsonBytes), "api-management", "API Management Config",
    )
    return err
}

// ======== Endpoints ========
type APIEndpoint struct {
    ID                  string `json:"id"`
    Path                string `json:"path"`
    Method              string `json:"method"`
    Description         string `json:"description"`
    IsActive            bool   `json:"isActive"`
    RateLimitPerMinute  int    `json:"rateLimitPerMinute"`
    RateLimitPerHour    int    `json:"rateLimitPerHour"`
    RequiresAuth        bool   `json:"requiresAuth"`
    RequiredRole        string `json:"requiredRole"`
    ResponseTime        int    `json:"responseTime"`
    SuccessRate         float64 `json:"successRate"`
    TotalRequests       int    `json:"totalRequests"`
    ErrorCount          int    `json:"errorCount"`
    LastAccessed        string `json:"lastAccessed"`
    CreatedAt           string `json:"createdAt"`
    UpdatedAt           string `json:"updatedAt"`
}

func endpointID(method, path string) string {
    h := sha1.Sum([]byte(strings.ToUpper(method) + ":" + path))
    return hex.EncodeToString(h[:])
}

func (c *ApiManagementController) ListEndpoints(ctx *gin.Context) {
    raw, _ := c.getConfigJSON(ctx, cfgKeyEndpoints)
    var list []APIEndpoint
    if len(raw) > 0 { _ = json.Unmarshal(raw, &list) }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": list})
}

func (c *ApiManagementController) CreateEndpoint(ctx *gin.Context) {
    var req APIEndpoint
    if err := ctx.ShouldBindJSON(&req); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"invalid body"}); return }
    if !strings.HasPrefix(req.Path, "/api/") { ctx.JSON(http.StatusOK, gin.H{"code":1002, "message":"path must start with /api/"}); return }
    if req.Method == "" { req.Method = "GET" }
    req.Method = strings.ToUpper(req.Method)

    raw, _ := c.getConfigJSON(ctx, cfgKeyEndpoints)
    var list []APIEndpoint
    if len(raw) > 0 { _ = json.Unmarshal(raw, &list) }

    now := time.Now().UTC().Format(time.RFC3339)
    req.ID = endpointID(req.Method, req.Path)
    req.CreatedAt = now
    req.UpdatedAt = now
    if req.RequiredRole == "" { req.RequiredRole = "USER" }
    // 默认
    if req.RateLimitPerMinute == 0 { req.RateLimitPerMinute = 60 }
    if req.RateLimitPerHour == 0 { req.RateLimitPerHour = 1000 }

    // 去重或新增
    replaced := false
    for i := range list {
        if list[i].ID == req.ID { list[i] = req; replaced = true; break }
    }
    if !replaced { list = append([]APIEndpoint{req}, list...) }

    buf, _ := json.Marshal(list)
    if err := c.saveConfigJSON(ctx, cfgKeyEndpoints, buf, false); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": req})
}

func (c *ApiManagementController) UpdateEndpoint(ctx *gin.Context) {
    id := ctx.Param("id")
    var body map[string]interface{}
    if err := ctx.ShouldBindJSON(&body); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"invalid body"}); return }

    raw, _ := c.getConfigJSON(ctx, cfgKeyEndpoints)
    var list []APIEndpoint
    if len(raw) > 0 { _ = json.Unmarshal(raw, &list) }
    found := false
    now := time.Now().UTC().Format(time.RFC3339)
    for i := range list {
        if list[i].ID == id {
            if v, ok := body["path"]; ok { list[i].Path = gf.String(v) }
            if v, ok := body["method"]; ok { list[i].Method = strings.ToUpper(gf.String(v)) }
            if v, ok := body["description"]; ok { list[i].Description = gf.String(v) }
            if v, ok := body["isActive"]; ok { list[i].IsActive = gf.Bool(v) }
            if v, ok := body["rateLimitPerMinute"]; ok { list[i].RateLimitPerMinute = gf.Int(v) }
            if v, ok := body["rateLimitPerHour"]; ok { list[i].RateLimitPerHour = gf.Int(v) }
            if v, ok := body["requiresAuth"]; ok { list[i].RequiresAuth = gf.Bool(v) }
            if v, ok := body["requiredRole"]; ok { list[i].RequiredRole = gf.String(v) }
            list[i].UpdatedAt = now
            found = true
            break
        }
    }
    if !found { ctx.JSON(http.StatusOK, gin.H{"code":404, "message":"not found"}); return }
    buf, _ := json.Marshal(list)
    if err := c.saveConfigJSON(ctx, cfgKeyEndpoints, buf, false); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"updated"})
}

func (c *ApiManagementController) DeleteEndpoint(ctx *gin.Context) {
    id := ctx.Param("id")
    raw, _ := c.getConfigJSON(ctx, cfgKeyEndpoints)
    var list []APIEndpoint
    if len(raw) > 0 { _ = json.Unmarshal(raw, &list) }
    next := make([]APIEndpoint, 0, len(list))
    for _, e := range list { if e.ID != id { next = append(next, e) } }
    if len(next) == len(list) { ctx.JSON(http.StatusOK, gin.H{"code":404, "message":"not found"}); return }
    buf, _ := json.Marshal(next)
    if err := c.saveConfigJSON(ctx, cfgKeyEndpoints, buf, false); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"deleted"})
}

func (c *ApiManagementController) ToggleEndpoint(ctx *gin.Context) {
    id := ctx.Param("id")
    raw, _ := c.getConfigJSON(ctx, cfgKeyEndpoints)
    var list []APIEndpoint
    if len(raw) > 0 { _ = json.Unmarshal(raw, &list) }
    found := false
    for i := range list {
        if list[i].ID == id { list[i].IsActive = !list[i].IsActive; list[i].UpdatedAt = time.Now().UTC().Format(time.RFC3339); found = true; break }
    }
    if !found { ctx.JSON(http.StatusOK, gin.H{"code":404, "message":"not found"}); return }
    buf, _ := json.Marshal(list)
    if err := c.saveConfigJSON(ctx, cfgKeyEndpoints, buf, false); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"ok"})
}

func (c *ApiManagementController) GetEndpointMetrics(ctx *gin.Context) {
    // 目前使用占位统计（后续可对接 api_access_logs + 聚合）
    data := gin.H{
        "totalRequests": 0,
        "totalErrors":   0,
        "averageResponseTime": 0,
        "p95ResponseTime": 0,
        "p99ResponseTime": 0,
        "successRate": 100,
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": data})
}

// ======== API Keys ========
type APIKey struct {
    ID                string   `json:"id"`
    Name              string   `json:"name"`
    KeyPrefix         string   `json:"keyPrefix"`
    UserID            string   `json:"userId"`
    Permissions       []string `json:"permissions"`
    RateLimitOverride *int     `json:"rateLimitOverride,omitempty"`
    IsActive          bool     `json:"isActive"`
    ExpiresAt         *string  `json:"expiresAt,omitempty"`
    LastUsed          *string  `json:"lastUsed,omitempty"`
    TotalRequests     int      `json:"totalRequests"`
    CreatedAt         string   `json:"createdAt"`
    EncryptedKey      string   `json:"-"`
}

func (c *ApiManagementController) ListKeys(ctx *gin.Context) {
    raw, _ := c.getConfigJSON(ctx, cfgKeyAPIKeys)
    var list []APIKey
    if len(raw) > 0 { _ = json.Unmarshal(raw, &list) }
    // 去掉密文字段
    for i := range list { list[i].EncryptedKey = "" }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": list})
}

func (c *ApiManagementController) CreateKey(ctx *gin.Context) {
    var body map[string]interface{}
    if err := ctx.ShouldBindJSON(&body); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"invalid body"}); return }

    // 生成API Key
    // ak_<base36_timestamp>_<randomhex>
    ts := time.Now().UnixNano()
    rand := gf.UUID()[0:16]
    full := "ak_" + strings.ToLower(strconvBase(int64(ts), 36)) + "_" + rand
    prefix := full[0:16]

    // 加密保存
    key := os.Getenv("ENCRYPTION_KEY")
    if key == "" { key = gf.String(gf.GetConfig("tokensecret")) }
    enc := security.NewEncryptionService(key)
    encKey, err := enc.Encrypt(full)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }

    now := time.Now().UTC().Format(time.RFC3339)
    var rateOverride *int
    if v, ok := body["rateLimitOverride"]; ok { x := gf.Int(v); rateOverride = &x }
    var expires *string
    if v, ok := body["expiresAt"]; ok { s := gf.String(v); if s != "" { expires = &s } }

    item := APIKey{
        ID:            gf.UUID(),
        Name:          gf.String(body["name"]),
        KeyPrefix:     prefix,
        UserID:        gf.String(body["userId"]),
        Permissions:   func() []string { if v, ok := body["permissions"].([]interface{}); ok { arr := make([]string,0,len(v)); for _, it := range v { arr = append(arr, gf.String(it)) }; return arr }; return []string{"*"} }(),
        RateLimitOverride: rateOverride,
        IsActive:      gf.Bool(body["isActive"]),
        ExpiresAt:     expires,
        LastUsed:      nil,
        TotalRequests: 0,
        CreatedAt:     now,
        EncryptedKey:  encKey,
    }

    raw, _ := c.getConfigJSON(ctx, cfgKeyAPIKeys)
    var list []APIKey
    if len(raw) > 0 { _ = json.Unmarshal(raw, &list) }
    list = append([]APIKey{item}, list...)
    buf, _ := json.Marshal(list)
    if err := c.saveConfigJSON(ctx, cfgKeyAPIKeys, buf, true); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }

    // 仅创建时返回 fullKey
    safe := item; safe.EncryptedKey = ""
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{"fullKey": full, "key": safe}})
}

func (c *ApiManagementController) UpdateKey(ctx *gin.Context) {
    id := ctx.Param("id")
    var body map[string]interface{}
    if err := ctx.ShouldBindJSON(&body); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"invalid body"}); return }
    raw, _ := c.getConfigJSON(ctx, cfgKeyAPIKeys)
    var list []APIKey
    if len(raw) > 0 { _ = json.Unmarshal(raw, &list) }
    found := false
    for i := range list {
        if list[i].ID == id {
            if v, ok := body["name"]; ok { list[i].Name = gf.String(v) }
            if v, ok := body["userId"]; ok { list[i].UserID = gf.String(v) }
            if v, ok := body["permissions"]; ok {
                if arr, ok2 := v.([]interface{}); ok2 { out := make([]string,0,len(arr)); for _, it := range arr { out = append(out, gf.String(it)) }; list[i].Permissions = out }
            }
            if v, ok := body["rateLimitOverride"]; ok { x := gf.Int(v); list[i].RateLimitOverride = &x }
            if v, ok := body["isActive"]; ok { list[i].IsActive = gf.Bool(v) }
            found = true
            break
        }
    }
    if !found { ctx.JSON(http.StatusOK, gin.H{"code":404, "message":"not found"}); return }
    buf, _ := json.Marshal(list)
    if err := c.saveConfigJSON(ctx, cfgKeyAPIKeys, buf, true); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"updated"})
}

func (c *ApiManagementController) DeleteKey(ctx *gin.Context) {
    id := ctx.Param("id")
    raw, _ := c.getConfigJSON(ctx, cfgKeyAPIKeys)
    var list []APIKey
    if len(raw) > 0 { _ = json.Unmarshal(raw, &list) }
    next := make([]APIKey, 0, len(list))
    for _, k := range list { if k.ID != id { next = append(next, k) } }
    if len(next) == len(list) { ctx.JSON(http.StatusOK, gin.H{"code":404, "message":"not found"}); return }
    buf, _ := json.Marshal(next)
    if err := c.saveConfigJSON(ctx, cfgKeyAPIKeys, buf, true); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"deleted"})
}

func (c *ApiManagementController) RevokeKey(ctx *gin.Context) {
    id := ctx.Param("id")
    raw, _ := c.getConfigJSON(ctx, cfgKeyAPIKeys)
    var list []APIKey
    if len(raw) > 0 { _ = json.Unmarshal(raw, &list) }
    found := false
    for i := range list { if list[i].ID == id { list[i].IsActive = false; found = true; break } }
    if !found { ctx.JSON(http.StatusOK, gin.H{"code":404, "message":"not found"}); return }
    buf, _ := json.Marshal(list)
    if err := c.saveConfigJSON(ctx, cfgKeyAPIKeys, buf, true); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"ok"})
}

// ======== Helper ========
func strconvBase(n int64, base int) string {
    const digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    if base < 2 || base > 36 { base = 10 }
    if n == 0 { return "0" }
    neg := n < 0
    if neg { n = -n }
    var out []byte
    for n > 0 {
        rem := n % int64(base)
        out = append([]byte{digits[rem]}, out...)
        n /= int64(base)
    }
    if neg { out = append([]byte{'-'}, out...) }
    return string(out)
}

// ======== Analytics & Performance ========
// GET /api/v1/admin/api-management/analytics
func (c *ApiManagementController) GetAnalytics(ctx *gin.Context) {
    timeRange := strings.ToLower(strings.TrimSpace(ctx.DefaultQuery("timeRange", "24h")))
    endpointFilter := ctx.Query("endpoint")
    methodFilter := strings.ToUpper(strings.TrimSpace(ctx.Query("method")))
    userFilter := strings.TrimSpace(ctx.Query("userId"))
    reqIdFilter := strings.TrimSpace(ctx.Query("requestId"))
    limit := gf.Int(ctx.DefaultQuery("limit", "100"))
    offset := gf.Int(ctx.DefaultQuery("offset", "0"))
    if limit <= 0 || limit > 1000 { limit = 100 }
    if offset < 0 { offset = 0 }

    start, end := resolveTimeRange(timeRange)

    // where 子句
    where := "created_at >= ? AND created_at <= ?"
    args := []interface{}{start, end}
    if endpointFilter != "" && endpointFilter != "all" {
        where += " AND endpoint = ?"
        args = append(args, endpointFilter)
    }
    if methodFilter != "" && methodFilter != "ALL" {
        where += " AND method = ?"
        args = append(args, methodFilter)
    }
    if userFilter != "" {
        where += " AND user_id = ?"
        args = append(args, userFilter)
    }
    if reqIdFilter != "" {
        where += " AND id = ?"
        args = append(args, reqIdFilter)
    }

    // 汇总统计
    summaryRows, _ := gf.DB().Query(ctx, "SELECT COUNT(*) AS total, SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors, AVG(duration_ms) AS avg_rt FROM api_access_logs WHERE "+where, args...)
    var total, errors int
    var avgRt float64
    if len(summaryRows) > 0 {
        total = gf.Int(summaryRows[0]["total"])
        errors = gf.Int(summaryRows[0]["errors"])
        avgRt = gf.Float64(summaryRows[0]["avg_rt"])
    }

    // 唯一用户数
    uniqRows, _ := gf.DB().Query(ctx, "SELECT COUNT(DISTINCT user_id) AS u FROM api_access_logs WHERE "+where+" AND user_id IS NOT NULL AND user_id <> ''", args...)
    uniq := 0; if len(uniqRows) > 0 { uniq = gf.Int(uniqRows[0]["u"]) }

    // Top端点
    topRows, _ := gf.DB().Query(ctx, "SELECT endpoint, COUNT(*) AS reqs, SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors, AVG(duration_ms) AS avg_rt FROM api_access_logs WHERE "+where+" GROUP BY endpoint ORDER BY reqs DESC LIMIT 20", args...)

    // 错误类型分布（2xx/3xx/4xx/5xx）
    errRows, _ := gf.DB().Query(ctx, "SELECT FLOOR(status_code/100)*100 AS cat, COUNT(*) AS cnt FROM api_access_logs WHERE "+where+" AND status_code >= 400 GROUP BY cat ORDER BY cnt DESC", args...)
    errorsByType := gf.MapStrInt{}
    for _, r := range errRows { errorsByType[gf.String(r["cat"])] = gf.Int(r["cnt"]) }

    // 每小时请求分布（0-23）
    hourlyRows, _ := gf.DB().Query(ctx, "SELECT DATE_FORMAT(created_at, '%H') AS h, COUNT(*) AS reqs, SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors, AVG(duration_ms) AS avg_rt FROM api_access_logs WHERE "+where+" GROUP BY h ORDER BY h", args...)
    requestsByHour := make([]map[string]interface{}, 0, 24)
    for i := 0; i < 24; i++ {
        hourStr := func() string { if i < 10 { return "0" + gf.String(i) } ; return gf.String(i) }()
        var found map[string]interface{}
        for _, r := range hourlyRows { if gf.String(r["h"]) == hourStr { found = r; break } }
        requestsByHour = append(requestsByHour, gf.Map{
            "hour": hourStr + ":00",
            "requests": gf.Int(found["reqs"]),
            "errors": gf.Int(found["errors"]),
            "responseTime": gf.Int(found["avg_rt"]),
        })
    }

    // UA分布Top10
    uaRows, _ := gf.DB().Query(ctx, "SELECT user_agent, COUNT(*) AS reqs FROM api_access_logs WHERE "+where+" AND user_agent IS NOT NULL AND user_agent <> '' GROUP BY user_agent ORDER BY reqs DESC LIMIT 10", args...)
    // 分页记录（最近）
    listRows, _ := gf.DB().Query(ctx, "SELECT id, user_id, endpoint, method, status_code, duration_ms, user_agent, created_at FROM api_access_logs WHERE "+where+" ORDER BY created_at DESC LIMIT ? OFFSET ?", append(args, limit, offset)...)
    countRows, _ := gf.DB().Query(ctx, "SELECT COUNT(*) AS c FROM api_access_logs WHERE "+where, args...)
    totalCount := 0; if len(countRows) > 0 { totalCount = gf.Int(countRows[0]["c"]) }

    // RPS（以时间窗为分母）
    seconds := end.Sub(start).Seconds()
    rps := 0.0; if seconds > 0 { rps = float64(total)/seconds }
    successRate := 100.0; if total > 0 { successRate = float64(total-errors) * 100.0 / float64(total) }

    data := gf.Map{
        "totalRequests": total,
        "totalErrors": errors,
        "averageResponseTime": int(avgRt + 0.5),
        "successRate": successRate,
        "requestsPerSecond": rps,
        "uniqueUsers": uniq,
        "topEndpoints": func() []gf.Map { out := []gf.Map{}; for _, r := range topRows { reqs := gf.Int(r["reqs"]); errs := gf.Int(r["errors"]); sr := 100.0; if reqs>0 { sr = float64(reqs-errs)*100.0/float64(reqs) }; out = append(out, gf.Map{"endpoint": gf.String(r["endpoint"]), "requests": reqs, "errors": errs, "avgResponseTime": gf.Int(r["avg_rt"]), "successRate": sr }); }; return out }(),
        "errorsByType": errorsByType,
        "requestsByHour": requestsByHour,
        "userAgents": func() []gf.Map { out := []gf.Map{}; totalUA := 0; for _, r := range uaRows { totalUA += gf.Int(r["reqs"]) } ; for _, r := range uaRows { reqs := gf.Int(r["reqs"]); pct := 0.0; if totalUA>0 { pct = float64(reqs)*100.0/float64(totalUA) } ; out = append(out, gf.Map{"userAgent": gf.String(r["user_agent"]), "requests": reqs, "percentage": pct}) } ; return out }(),
        "list": listRows,
        "pagination": gf.Map{"total": totalCount, "limit": limit, "offset": offset, "hasMore": offset+limit < totalCount},
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": data})
}

// GET /api/v1/admin/api-management/performance
func (c *ApiManagementController) GetPerformance(ctx *gin.Context) {
    timeRange := strings.ToLower(strings.TrimSpace(ctx.DefaultQuery("timeRange", "24h")))
    endpointFilter := ctx.Query("endpoint")
    methodFilter := strings.ToUpper(strings.TrimSpace(ctx.Query("method")))
    userFilter := strings.TrimSpace(ctx.Query("userId"))
    reqIdFilter := strings.TrimSpace(ctx.Query("requestId"))
    start, end := resolveTimeRange(timeRange)

    where := "created_at >= ? AND created_at <= ?"
    args := []interface{}{start, end}
    if endpointFilter != "" && endpointFilter != "all" {
        where += " AND endpoint = ?"
        args = append(args, endpointFilter)
    }
    if methodFilter != "" && methodFilter != "ALL" {
        where += " AND method = ?"
        args = append(args, methodFilter)
    }
    if userFilter != "" {
        where += " AND user_id = ?"
        args = append(args, userFilter)
    }
    if reqIdFilter != "" {
        where += " AND id = ?"
        args = append(args, reqIdFilter)
    }

    totalRows, _ := gf.DB().Query(ctx, "SELECT COUNT(*) AS c FROM api_access_logs WHERE "+where, args...)
    errRows, _ := gf.DB().Query(ctx, "SELECT COUNT(*) AS c FROM api_access_logs WHERE "+where+" AND status_code >= 400", args...)
    total := 0; if len(totalRows) > 0 { total = gf.Int(totalRows[0]["c"]) }
    errors := 0; if len(errRows) > 0 { errors = gf.Int(errRows[0]["c"]) }

    // throughput
    seconds := end.Sub(start).Seconds()
    throughput := 0.0; if seconds > 0 { throughput = float64(total)/seconds }

    // 百分位：取样本计算（限制最多2万条以避免压力）
    sampleRows, _ := gf.DB().Query(ctx, "SELECT duration_ms FROM api_access_logs WHERE "+where+" ORDER BY created_at DESC LIMIT 20000", args...)
    durations := make([]int, 0, len(sampleRows))
    for _, r := range sampleRows { durations = append(durations, gf.Int(r["duration_ms"])) }
    p50, p95, p99 := percentileInts(durations, 50), percentileInts(durations, 95), percentileInts(durations, 99)

    errorRate := 0.0; if total > 0 { errorRate = float64(errors) * 100.0 / float64(total) }
    availability := 100.0 - errorRate

    data := gf.Map{
        "p50ResponseTime": p50,
        "p95ResponseTime": p95,
        "p99ResponseTime": p99,
        "errorRate": errorRate,
        "throughput": throughput,
        "availability": availability,
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": data})
}

// GET /api/v1/admin/api-management/request/:id
// 返回单条 api_access_logs 记录，便于根据 Request ID 追踪链路
func (c *ApiManagementController) GetRequestById(ctx *gin.Context) {
    id := strings.TrimSpace(ctx.Param("id"))
    if id == "" {
        ctx.JSON(http.StatusOK, gin.H{"code": 1001, "message": "id required"})
        return
    }
    row, err := gf.DB().Query(ctx, "SELECT id, user_id, endpoint, method, status_code, duration_ms, ip_address, user_agent, created_at FROM api_access_logs WHERE id=? LIMIT 1", id)
    if err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code": 5001, "message": err.Error()})
        return
    }
    if len(row) == 0 {
        ctx.JSON(http.StatusOK, gin.H{"code": 404, "message": "not found"})
        return
    }
    ctx.JSON(http.StatusOK, gin.H{"code": 0, "data": row[0]})
}

// 时间范围解析
func resolveTimeRange(tr string) (time.Time, time.Time) {
    now := time.Now()
    switch tr {
    case "1h": return now.Add(-1*time.Hour), now
    case "7d": return now.AddDate(0,0,-7), now
    case "30d": return now.AddDate(0,0,-30), now
    default: return now.Add(-24*time.Hour), now
    }
}

// 计算整数数组百分位（简单实现）
func percentileInts(arr []int, pct int) int {
    n := len(arr)
    if n == 0 { return 0 }
    // 简单排序
    for i:=1; i<n; i++ {
        j := i; for j>0 && arr[j-1] > arr[j] { arr[j-1], arr[j] = arr[j], arr[j-1]; j-- }
    }
    if pct <= 0 { return arr[0] }
    if pct >= 100 { return arr[n-1] }
    idx := int(float64(pct)/100.0*float64(n-1) + 0.5)
    if idx < 0 { idx = 0 }; if idx >= n { idx = n-1 }
    return arr[idx]
}
