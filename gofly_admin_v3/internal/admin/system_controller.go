package admin

import (
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
    "time"
)

// GetSystemConfig 获取系统配置（环境变量/系统参数）
// 支持按分类过滤：/api/v1/admin/system/config?category=upload
func (c *AdminController) GetSystemConfig(ctx *gin.Context) {
    category := ctx.Query("category")
    q := gf.DB().Model("system_configs").Where("is_active=1")
    if category != "" { q = q.Where("category=?", category) }
    rows, err := q.Order("category, config_key").All()
    if err != nil {
        ctx.JSON(http.StatusOK, APIResponse{Code: 5001, Message: err.Error()})
        return
    }
    ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "获取成功", Data: rows})
}

// UpsertSystemConfig 新增/更新系统配置
// POST /api/v1/admin/system/config
func (c *AdminController) UpsertSystemConfig(ctx *gin.Context) {
    var req struct {
        Key         string `json:"key" binding:"required"
        Value       string `json:"value"`
        Description string `json:"description"`
        Category    string `json:"category"`
        IsActive    *bool  `json:"is_active"`
    }
    if err := ctx.ShouldBindJSON(&req); err != nil {
        ctx.JSON(http.StatusOK, APIResponse{Code: 1001, Message: "参数错误"}); return
    }
    // 保护只读/敏感项
    if isProtectedSystemKey(strings.ToLower(req.Key)) {
        ctx.JSON(http.StatusOK, APIResponse{Code: 1003, Message: "该配置为只读/敏感项，禁止修改"}); return
    }
    if req.Category == "" { req.Category = "general" }
    updates := gf.Map{"config_value": req.Value, "description": req.Description, "category": req.Category}
    if req.IsActive != nil { updates["is_active"] = *req.IsActive }
    // UPSERT
    _, err := gf.DB().Exec(ctx, "INSERT INTO system_configs(config_key,config_value,description,category,is_active) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value), description=VALUES(description), category=VALUES(category), is_active=VALUES(is_active)", req.Key, req.Value, req.Description, req.Category, true)
    if err != nil {
        ctx.JSON(http.StatusOK, APIResponse{Code: 5002, Message: err.Error()}); return
    }
    // 发布Redis事件，触发系统内订阅者即时刷新
    if gf.Redis() != nil {
        _, _ = gf.Redis().GroupPubSub().Publish(ctx, "system:config:updated", req.Key)
    }
    // 记录变更到用户操作日志（作为变更历史）
    adminID := ctx.GetString("admin_id")
    _, _ = gf.Model("user_operation_logs").Insert(gf.Map{
        "admin_id":      adminID,
        "target_user_id": "system",
        "operation":     "system_config_upsert",
        "details":       gf.ToJSON(gf.Map{"key": req.Key, "value": req.Value, "category": req.Category, "description": req.Description}),
        "ip_address":    ctx.ClientIP(),
        "created_at":    time.Now(),
    })
    ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "保存成功"})
}

// DeleteSystemConfig 逻辑删除配置
// DELETE /api/v1/admin/system/config/:key
func (c *AdminController) DeleteSystemConfig(ctx *gin.Context) {
    key := ctx.Param("key")
    if key == "" { ctx.JSON(http.StatusOK, APIResponse{Code:1002, Message:"key required"}); return }
    if isProtectedSystemKey(strings.ToLower(key)) {
        ctx.JSON(http.StatusOK, APIResponse{Code:1004, Message:"该配置为只读/敏感项，禁止删除"}); return
    }
    if _, err := gf.DB().Model("system_configs").Where("config_key", key).Update(gf.Map{"is_active": false}); err != nil {
        ctx.JSON(http.StatusOK, APIResponse{Code:5003, Message: err.Error()}); return
    }
    if gf.Redis() != nil {
        _, _ = gf.Redis().GroupPubSub().Publish(ctx, "system:config:updated", key)
    }
    // 记录删除到历史
    adminID := ctx.GetString("admin_id")
    _, _ = gf.Model("user_operation_logs").Insert(gf.Map{
        "admin_id":      adminID,
        "target_user_id": "system",
        "operation":     "system_config_delete",
        "details":       gf.ToJSON(gf.Map{"key": key}),
        "ip_address":    ctx.ClientIP(),
        "created_at":    time.Now(),
    })
    ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "已删除"})
}

// GetSystemConfigHistory 获取系统配置变更历史
// GET /api/v1/admin/system/config/history?key=xxx
func (c *AdminController) GetSystemConfigHistory(ctx *gin.Context) {
    key := ctx.Query("key")
    q := gf.DB().Model("user_operation_logs").Where("operation IN (?,?)", "system_config_upsert", "system_config_delete")
    if key != "" {
        like := "%\"key\":\"" + key + "\"%"
        q = q.Where("details LIKE ?", like)
    }
    rows, err := q.Order("created_at DESC").Limit(200).All()
    if err != nil {
        ctx.JSON(http.StatusOK, APIResponse{Code: 5004, Message: err.Error()}); return
    }
    ctx.JSON(http.StatusOK, APIResponse{Code: 0, Message: "获取成功", Data: rows})
}

// BatchSystemConfig 批量变更系统配置（set/unset）
// PATCH /api/v1/console/system/config/batch
func (c *AdminController) BatchSystemConfig(ctx *gin.Context) {
    var ops []struct {
        Op        string `json:"op"`
        Key       string `json:"key"`
        Value     string `json:"value"`
        Category  string `json:"category"`
        IsActive  *bool  `json:"is_active"`
        Desc      string `json:"description"`
    }
    if err := ctx.ShouldBindJSON(&ops); err != nil || len(ops) == 0 {
        ctx.JSON(http.StatusOK, APIResponse{Code:1001, Message:"invalid batch body"}); return
    }

    adminID := ctx.GetString("admin_id")
    for _, it := range ops {
        key := strings.ToLower(strings.TrimSpace(it.Key))
        if key == "" { continue }
        if isProtectedSystemKey(key) { continue }
        switch strings.ToLower(strings.TrimSpace(it.Op)) {
        case "set":
            cat := it.Category; if cat == "" { cat = "general" }
            _, _ = gf.DB().Exec(ctx, "INSERT INTO system_configs(config_key,config_value,description,category,is_active) VALUES(?,?,?,?,1) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value), description=VALUES(description), category=VALUES(category), is_active=1", key, it.Value, it.Desc, cat)
            if gf.Redis() != nil { _, _ = gf.Redis().GroupPubSub().Publish(ctx, "system:config:updated", key) }
            _, _ = gf.Model("user_operation_logs").Insert(gf.Map{"admin_id":adminID, "target_user_id":"system", "operation":"system_config_upsert", "details": gf.ToJSON(gf.Map{"key":key, "value":it.Value, "category":cat}), "ip_address": ctx.ClientIP(), "created_at": time.Now()})
        case "unset":
            _, _ = gf.DB().Model("system_configs").Where("config_key", key).Update(gf.Map{"is_active": false})
            if gf.Redis() != nil { _, _ = gf.Redis().GroupPubSub().Publish(ctx, "system:config:updated", key) }
            _, _ = gf.Model("user_operation_logs").Insert(gf.Map{"admin_id":adminID, "target_user_id":"system", "operation":"system_config_delete", "details": gf.ToJSON(gf.Map{"key":key}), "ip_address": ctx.ClientIP(), "created_at": time.Now()})
        }
    }
    ctx.JSON(http.StatusOK, APIResponse{Code:0, Message:"ok"})
}

// isProtectedSystemKey 判断是否为受保护的系统配置键
func isProtectedSystemKey(key string) bool {
    // 只读项或高风险敏感项
    protected := map[string]bool{
        // 鉴权相关
        "tokensecret": true,
        "auth_secret": true,
        "jwt_secret":  true,
        // 数据库/缓存链接敏感
        "database_url":       true,
        "database_password":  true,
        "redis_password":     true,
        // 第三方秘钥
        "smtp_password":       true,
        "oauth_client_secret": true,
    }
    if protected[key] { return true }
    // 前缀保护
    prefixes := []string{"db_", "redis_", "jwt_", "secret_"}
    for _, p := range prefixes {
        if strings.HasPrefix(key, p) { return true }
    }
    return false
}
