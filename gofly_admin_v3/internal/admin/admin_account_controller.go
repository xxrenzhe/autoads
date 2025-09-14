package admin

import (
    "net/http"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "golang.org/x/crypto/bcrypt"
    "gofly-admin-v3/utils/gf"
)

// AdminAccountController 管理员与角色（简化：基于 admin_users.role 字段）
type AdminAccountController struct{}

func RegisterAdminAccountRoutes(r *gin.RouterGroup) {
    ac := &AdminAccountController{}
    g := r.Group("/admins")
    {
        g.GET("", ac.ListAdmins)
        g.POST("", ac.CreateAdmin)
        g.PUT(":id", ac.UpdateAdmin)
        g.DELETE(":id", ac.DeleteAdmin)
        g.PUT(":id/password", ac.ResetPassword)
    }

    r.GET("/roles", ac.ListRoles)
}

func (c *AdminAccountController) ListAdmins(ctx *gin.Context) {
    rows, err := gf.DB().Query(ctx, `SELECT id, username, email, role, is_active, last_login_at, created_at FROM admin_users ORDER BY created_at DESC`)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": rows})
}

func (c *AdminAccountController) CreateAdmin(ctx *gin.Context) {
    var body struct{ Username, Email, Password, Role string }
    if err := ctx.ShouldBindJSON(&body); err != nil || body.Username=="" || body.Email=="" || body.Password=="" {
        ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"username/email/password required"}); return }
    hashed, _ := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
    _, err := gf.DB().Exec(ctx, `INSERT INTO admin_users (username,email,password,role,is_active,created_at,updated_at) VALUES (?,?,?,?,TRUE,NOW(),NOW())`,
        strings.ToLower(strings.TrimSpace(body.Username)), strings.ToLower(strings.TrimSpace(body.Email)), string(hashed), ifEmpty(body.Role, "admin"))
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"created"})
}

func (c *AdminAccountController) UpdateAdmin(ctx *gin.Context) {
    id := ctx.Param("id")
    var body struct{ Email, Username, Role string; IsActive *bool }
    if err := ctx.ShouldBindJSON(&body); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"invalid body"}); return }
    _, err := gf.DB().Exec(ctx, `UPDATE admin_users SET email=COALESCE(NULLIF(?,''),email), username=COALESCE(NULLIF(?,''),username), role=COALESCE(NULLIF(?,''),role), is_active=COALESCE(?,is_active), updated_at=? WHERE id=?`,
        strings.ToLower(strings.TrimSpace(body.Email)), strings.ToLower(strings.TrimSpace(body.Username)), ifEmpty(body.Role, ""), body.IsActive, time.Now(), id)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"updated"})
}

func (c *AdminAccountController) DeleteAdmin(ctx *gin.Context) {
    id := ctx.Param("id")
    if _, err := gf.DB().Exec(ctx, `DELETE FROM admin_users WHERE id=?`, id); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"deleted"})
}

func (c *AdminAccountController) ResetPassword(ctx *gin.Context) {
    id := ctx.Param("id")
    var body struct{ Password string }
    if err := ctx.ShouldBindJSON(&body); err != nil || body.Password=="" { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"password required"}); return }
    hashed, _ := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
    if _, err := gf.DB().Exec(ctx, `UPDATE admin_users SET password=?, updated_at=NOW() WHERE id=?`, string(hashed), id); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"updated"})
}

func (c *AdminAccountController) ListRoles(ctx *gin.Context) {
    // 简化：固定内置角色
    roles := []map[string]string{{"value":"super_admin","label":"超级管理员"},{"value":"admin","label":"管理员"},{"value":"operator","label":"运营"},{"value":"viewer","label":"只读"}}
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": roles})
}

func ifEmpty(s, def string) string { if strings.TrimSpace(s)=="" { return def }; return s }

