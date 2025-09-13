package subscription

import (
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/internal/cache"
    "gofly-admin-v3/utils/gf"
)

func init() {
    // Admin Plans
    gf.RegisterRoute("GET", "/admin/plans", listPlansHandler, false, nil)
    gf.RegisterRoute("POST", "/admin/plans", createPlanHandler, false, nil)
    gf.RegisterRoute("PUT", "/admin/plans/:id", updatePlanHandler, false, nil)
    gf.RegisterRoute("DELETE", "/admin/plans/:id", deletePlanHandler, false, nil)

    // Admin Subscriptions
    gf.RegisterRoute("GET", "/admin/subscriptions", listSubscriptionsHandler, false, nil)
    gf.RegisterRoute("POST", "/admin/subscriptions", assignSubscriptionHandler, false, nil)
    gf.RegisterRoute("POST", "/admin/subscriptions/:id/cancel", cancelSubscriptionHandler, false, nil)
    gf.RegisterRoute("POST", "/admin/subscriptions/:id/renew", renewSubscriptionHandler, false, nil)
    gf.RegisterRoute("POST", "/admin/subscriptions/:id/change_plan", changeSubscriptionPlanHandler, false, nil)

    // User Subscriptions
    gf.RegisterRoute("GET", "/user/subscription", getMySubscriptionHandler, false, nil)
}

// Admin: Plans
func listPlansHandler(c *gin.Context) {
    if !adminOnly(c) { return }
    status := strings.TrimSpace(c.Query("status"))
    page, _ := strconv.Atoi(c.Query("page")); if page <= 0 { page = 1 }
    size, _ := strconv.Atoi(c.Query("pageSize")); if size <= 0 || size > 200 { size = 20 }
    q := gf.DB().Model("plans")
    if status != "" { q = q.Where("status = ?", strings.ToUpper(status)) }
    total, _ := q.Count()
    list, err := q.Offset((page-1)*size).Limit(size).Order("created_at DESC").All()
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetData(gf.Map{"list": list, "total": total, "page": page, "pageSize": size}).Regin(c)
}

func createPlanHandler(c *gin.Context) {
    if !adminOnly(c, "super_admin", "admin") { return }
    var req struct{ ID, Name, Description, Features, Status string; Price float64; Duration int }
    if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" || req.Duration <= 0 {
        gf.Failed().SetMsg("参数错误").Regin(c); return
    }
    if req.ID == "" { req.ID = gf.UUID() }
    if req.Status == "" { req.Status = "ACTIVE" }
    _, err := gf.DB().Model("plans").Insert(gf.Map{
        "id": req.ID, "name": strings.ToLower(req.Name), "description": req.Description,
        "price": req.Price, "duration": req.Duration, "features": req.Features, "status": req.Status,
    })
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetMsg("创建成功").SetData(gf.Map{"id": req.ID}).Regin(c)
}

func updatePlanHandler(c *gin.Context) {
    if !adminOnly(c, "super_admin", "admin") { return }
    id := c.Param("id")
    var req struct{ Name, Description, Features, Status string; Price *float64; Duration *int }
    if err := c.ShouldBindJSON(&req); err != nil { gf.Failed().SetMsg("参数错误").Regin(c); return }
    updates := gf.Map{}
    if req.Name != "" { updates["name"] = strings.ToLower(req.Name) }
    if req.Description != "" { updates["description"] = req.Description }
    if req.Features != "" { updates["features"] = req.Features }
    if req.Status != "" { updates["status"] = strings.ToUpper(req.Status) }
    if req.Price != nil { updates["price"] = *req.Price }
    if req.Duration != nil && *req.Duration > 0 { updates["duration"] = *req.Duration }
    if len(updates) == 0 { gf.Success().SetMsg("无更新").Regin(c); return }
    _, err := gf.DB().Model("plans").Where("id", id).Update(updates)
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetMsg("更新成功").Regin(c)
}

func deletePlanHandler(c *gin.Context) {
    if !adminOnly(c, "super_admin") { return }
    id := c.Param("id")
    _, err := gf.DB().Model("plans").Where("id", id).Delete()
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetMsg("已删除").Regin(c)
}

// Admin: Subscriptions
func listSubscriptionsHandler(c *gin.Context) {
    if !adminOnly(c) { return }
    userID := strings.TrimSpace(c.Query("user_id"))
    status := strings.TrimSpace(c.Query("status"))
    page, _ := strconv.Atoi(c.Query("page")); if page <= 0 { page = 1 }
    size, _ := strconv.Atoi(c.Query("pageSize")); if size <= 0 || size > 200 { size = 20 }
    q := gf.DB().Model("subscriptions")
    if userID != "" { q = q.Where("user_id = ?", userID) }
    if status != "" { q = q.Where("status = ?", strings.ToUpper(status)) }
    total, _ := q.Count()
    list, err := q.Offset((page-1)*size).Limit(size).Order("updated_at DESC").All()
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetData(gf.Map{"list": list, "total": total, "page": page, "pageSize": size}).Regin(c)
}

// 赋予/更新订阅
func assignSubscriptionHandler(c *gin.Context) {
    if !adminOnly(c, "super_admin", "admin") { return }
    var req struct{ UserID, PlanID, PlanName string; Days int }
    if err := c.ShouldBindJSON(&req); err != nil || req.UserID == "" || (req.PlanID == "" && req.PlanName == "") {
        gf.Failed().SetMsg("参数错误").Regin(c); return
    }
    // 查找PlanID
    planID := req.PlanID
    if planID == "" {
        rec, err := gf.DB().Model("plans").Where("name = ?", strings.ToLower(req.PlanName)).One()
        if err != nil || rec == nil { gf.Failed().SetMsg("套餐不存在").Regin(c); return }
        planID = rec["id"].String()
        if req.Days == 0 { req.Days = rec["duration"].Int() }
    }
    if req.Days <= 0 { req.Days = 30 }
    now := time.Now()
    ended := now.AddDate(0, 0, req.Days)
    // 插入/更新
    existing, _ := gf.DB().Model("subscriptions").Where("user_id = ? AND status='ACTIVE'", req.UserID).One()
    if existing != nil {
        _, err := gf.DB().Model("subscriptions").Where("id", existing["id"].String()).Update(gf.Map{
            "plan_id": planID, "updated_at": now, "ended_at": ended,
        })
        if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    } else {
        _, err := gf.DB().Model("subscriptions").Insert(gf.Map{
            "id": gf.UUID(), "user_id": req.UserID, "plan_id": planID, "status": "ACTIVE",
            "started_at": now, "ended_at": ended,
        })
        if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    }
    // 审计与失效缓存
    _ = logSubscriptionAudit("assign_or_update", req.UserID, planID)
    _ = cache.GetCache().Delete("user:plan:" + req.UserID)
    gf.Success().SetMsg("订阅已更新").Regin(c)
}

func cancelSubscriptionHandler(c *gin.Context) {
    if !adminOnly(c, "super_admin", "admin") { return }
    id := c.Param("id")
    sub, err := gf.DB().Model("subscriptions").Where("id", id).One()
    if err != nil || sub == nil { gf.Failed().SetMsg("订阅不存在").Regin(c); return }
    _, err = gf.DB().Model("subscriptions").Where("id", id).Update(gf.Map{"status": "CANCELLED", "updated_at": time.Now()})
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    userID := sub["user_id"].String()
    _ = logSubscriptionAudit("cancel", userID, sub["plan_id"].String())
    _ = cache.GetCache().Delete("user:plan:" + userID)
    gf.Success().SetMsg("已取消").Regin(c)
}

func renewSubscriptionHandler(c *gin.Context) {
    if !adminOnly(c, "super_admin", "admin") { return }
    id := c.Param("id")
    var req struct{ Days int }
    if err := c.ShouldBindJSON(&req); err != nil || req.Days <= 0 { gf.Failed().SetMsg("参数错误").Regin(c); return }
    sub, err := gf.DB().Model("subscriptions").Where("id", id).One()
    if err != nil || sub == nil { gf.Failed().SetMsg("订阅不存在").Regin(c); return }
    ended := time.Now().AddDate(0, 0, req.Days)
    _, err = gf.DB().Model("subscriptions").Where("id", id).Update(gf.Map{"ended_at": ended, "updated_at": time.Now(), "status": "ACTIVE"})
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    userID := sub["user_id"].String()
    _ = logSubscriptionAudit("renew", userID, sub["plan_id"].String())
    _ = cache.GetCache().Delete("user:plan:" + userID)
    gf.Success().SetMsg("已续期").Regin(c)
}

func changeSubscriptionPlanHandler(c *gin.Context) {
    if !adminOnly(c, "super_admin", "admin") { return }
    id := c.Param("id")
    var req struct{ PlanID, PlanName string }
    if err := c.ShouldBindJSON(&req); err != nil || (req.PlanID == "" && req.PlanName == "") { gf.Failed().SetMsg("参数错误").Regin(c); return }
    sub, err := gf.DB().Model("subscriptions").Where("id", id).One()
    if err != nil || sub == nil { gf.Failed().SetMsg("订阅不存在").Regin(c); return }
    planID := req.PlanID
    if planID == "" {
        rec, err := gf.DB().Model("plans").Where("name = ?", strings.ToLower(req.PlanName)).One()
        if err != nil || rec == nil { gf.Failed().SetMsg("套餐不存在").Regin(c); return }
        planID = rec["id"].String()
    }
    _, err = gf.DB().Model("subscriptions").Where("id", id).Update(gf.Map{"plan_id": planID, "updated_at": time.Now()})
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    userID := sub["user_id"].String()
    _ = logSubscriptionAudit("change_plan", userID, planID)
    _ = cache.GetCache().Delete("user:plan:" + userID)
    gf.Success().SetMsg("已更换套餐").Regin(c)
}

// User: 当前订阅
func getMySubscriptionHandler(c *gin.Context) {
    userID := c.GetString("user_id")
    if userID == "" { userID = c.GetString("userID") }
    if userID == "" { gf.Failed().SetMsg("未认证").Regin(c); return }
    rec, err := gf.DB().Raw(`SELECT s.*, p.name as plan_name, p.duration FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? AND s.status='ACTIVE' ORDER BY s.updated_at DESC LIMIT 1`, userID).One()
    if err != nil || rec == nil { gf.Success().SetData(nil).Regin(c); return }
    gf.Success().SetData(rec).Regin(c)
}

// 权限：仅管理员或特定角色
func adminOnly(c *gin.Context, roles ...string) bool {
    if !c.GetBool("is_admin") {
        c.JSON(403, gin.H{"message":"需要管理员权限"}); c.Abort(); return false
    }
    if len(roles) == 0 { return true }
    role := c.GetString("admin_role")
    for _, r := range roles {
        if strings.EqualFold(r, role) { return true }
    }
    c.JSON(403, gin.H{"message":"角色权限不足"}); c.Abort(); return false
}

// 审计订阅操作（best-effort）
func logSubscriptionAudit(action, userID, planID string) error {
    _, err := gf.Model("audit_events").Insert(gf.Map{
        "user_id": userID,
        "action":  action,
        "resource": "subscription",
        "resource_id": planID,
        "details": gf.Map{"plan_id": planID},
        "success": true,
        "created_at": time.Now(),
    })
    return err
}
