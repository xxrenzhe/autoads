package token

import (
    "strconv"
    "strings"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/internal/cache"
    "gofly-admin-v3/utils/gf"
)

func init() {
    // Console Admin APIs
    gf.RegisterRoute("GET", "/console/tokens/balance", adminGetBalance, false, nil)
    gf.RegisterRoute("POST", "/console/tokens/adjust", adminAdjustTokens, false, nil)
    gf.RegisterRoute("POST", "/console/tokens/purchase", adminPurchasePackage, false, nil)
    gf.RegisterRoute("GET", "/console/tokens/transactions", adminListTransactions, false, nil)
    gf.RegisterRoute("GET", "/console/token/rules", listRulesHandler, false, nil)
    gf.RegisterRoute("POST", "/console/token/rules", upsertRuleHandler, false, nil)
    gf.RegisterRoute("PUT", "/console/token/rules/:id", updateRuleHandler, false, nil)
    gf.RegisterRoute("DELETE", "/console/token/rules/:id", deleteRuleHandler, false, nil)

    // User APIs
    gf.RegisterRoute("GET", "/user/token/balance", userGetBalance, false, nil)
    gf.RegisterRoute("GET", "/user/token/transactions", userListTransactions, false, nil)
}

func adminOnly(c *gin.Context, roles ...string) bool {
    if !c.GetBool("is_admin") { c.JSON(403, gin.H{"message":"需要管理员权限"}); c.Abort(); return false }
    role := strings.ToUpper(c.GetString("admin_role"))
    if role != "ADMIN" { c.JSON(403, gin.H{"message":"需要管理员权限"}); c.Abort(); return false }
    return true
}

// Admin: balance
func adminGetBalance(c *gin.Context) {
    if !adminOnly(c) { return }
    userID := c.Query("user_id")
    if userID == "" { gf.Failed().SetMsg("user_id 不能为空").Regin(c); return }
    bal, err := NewService(gf.DB()).GetBalance(userID)
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetData(gf.Map{"user_id": userID, "balance": bal}).Regin(c)
}

func adminAdjustTokens(c *gin.Context) {
    if !adminOnly(c) { return }
    var req struct{ UserID string; Delta int; Reason string }
    if err := c.ShouldBindJSON(&req); err != nil || req.UserID == "" || req.Delta == 0 {
        gf.Failed().SetMsg("参数错误").Regin(c); return
    }
    if err := NewService(gf.DB()).Adjust(req.UserID, req.Delta, req.Reason); err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    _ = cache.GetCache().Delete("user:tokens:" + req.UserID)
    gf.Success().SetMsg("已调整").Regin(c)
}

func adminPurchasePackage(c *gin.Context) {
    if !adminOnly(c) { return }
    var req struct{ UserID, PackageID string }
    if err := c.ShouldBindJSON(&req); err != nil || req.UserID == "" || req.PackageID == "" { gf.Failed().SetMsg("参数错误").Regin(c); return }
    if err := NewService(gf.DB()).PurchasePackage(req.UserID, req.PackageID); err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    _ = cache.GetCache().Delete("user:tokens:" + req.UserID)
    gf.Success().SetMsg("已充值").Regin(c)
}

func adminListTransactions(c *gin.Context) {
    if !adminOnly(c) { return }
    userID := c.Query("user_id")
    page, _ := strconv.Atoi(c.Query("page")); if page <= 0 { page = 1 }
    size, _ := strconv.Atoi(c.Query("pageSize")); if size <= 0 || size > 200 { size = 20 }
    list, total, err := NewService(gf.DB()).ListTransactions(userID, page, size)
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetData(gf.Map{"list": list, "total": total, "page": page, "pageSize": size}).Regin(c)
}

// Rules management
func listRulesHandler(c *gin.Context) {
    if !adminOnly(c) { return }
    service := c.Query("service"); action := c.Query("action")
    q := gf.DB().Model("token_consumption_rules").Where("is_active=1")
    if service != "" { q = q.Where("service=?", strings.ToLower(service)) }
    if action != "" { q = q.Where("action=?", strings.ToLower(action)) }
    list, err := q.Order("service, action").All()
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetData(list).Regin(c)
}

func upsertRuleHandler(c *gin.Context) {
    if !adminOnly(c) { return }
    var req struct{ Service, Action string; TokenCost int }
    if err := c.ShouldBindJSON(&req); err != nil || req.Service == "" || req.Action == "" || req.TokenCost <= 0 {
        gf.Failed().SetMsg("参数错误").Regin(c); return
    }
    req.Service = strings.ToLower(req.Service); req.Action = strings.ToLower(req.Action)
    // UPSERT
    _, err := gf.DB().Exec(gf.Ctx(nil), "INSERT INTO token_consumption_rules(service,action,token_cost,is_active) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE token_cost=VALUES(token_cost), is_active=1", req.Service, req.Action, req.TokenCost)
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    _ = cache.GetCache().Delete("token:rule:" + req.Service + ":" + req.Action)
    gf.Success().SetMsg("规则已更新").Regin(c)
}

func updateRuleHandler(c *gin.Context) {
    if !adminOnly(c) { return }
    id := c.Param("id")
    var req struct{ TokenCost int; IsActive *bool }
    if err := c.ShouldBindJSON(&req); err != nil { gf.Failed().SetMsg("参数错误").Regin(c); return }
    updates := gf.Map{}
    if req.TokenCost > 0 { updates["token_cost"] = req.TokenCost }
    if req.IsActive != nil { updates["is_active"] = *req.IsActive }
    if len(updates) == 0 { gf.Success().SetMsg("无更新").Regin(c); return }
    if _, err := gf.DB().Model("token_consumption_rules").Where("id", id).Update(updates); err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetMsg("规则已更新").Regin(c)
}

func deleteRuleHandler(c *gin.Context) {
    if !adminOnly(c) { return }
    id := c.Param("id")
    if _, err := gf.DB().Model("token_consumption_rules").Where("id", id).Update(gf.Map{"is_active": false}); err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetMsg("规则已禁用").Regin(c)
}

// User
func userGetBalance(c *gin.Context) {
    userID := c.GetString("user_id"); if userID == "" { userID = c.GetString("userID") }
    if userID == "" { gf.Failed().SetMsg("未认证").Regin(c); return }
    bal, err := NewService(gf.DB()).GetBalance(userID)
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetData(gf.Map{"balance": bal}).Regin(c)
}

func userListTransactions(c *gin.Context) {
    userID := c.GetString("user_id"); if userID == "" { userID = c.GetString("userID") }
    if userID == "" { gf.Failed().SetMsg("未认证").Regin(c); return }
    page, _ := strconv.Atoi(c.Query("page")); if page <= 0 { page = 1 }
    size, _ := strconv.Atoi(c.Query("pageSize")); if size <= 0 || size > 200 { size = 20 }
    list, total, err := NewService(gf.DB()).ListTransactions(userID, page, size)
    if err != nil { gf.Failed().SetMsg(err.Error()).Regin(c); return }
    gf.Success().SetData(gf.Map{"list": list, "total": total, "page": page, "pageSize": size}).Regin(c)
}
