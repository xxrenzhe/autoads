package admin

import (
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

// UserController 管理端-用户管理
type UserController struct{}

// RegisterUserRoutes 注册用户管理路由
func RegisterUserRoutes(r *gin.RouterGroup) {
    uc := &UserController{}
    group := r.Group("/users")
    {
        group.GET("", uc.ListUsers)
        group.GET(":id", uc.GetUser)
        group.PUT(":id/status", uc.UpdateUserStatus)
    }
}

// ListUsers 用户列表
func (c *UserController) ListUsers(ctx *gin.Context) {
    page := gf.Int(ctx.DefaultQuery("page", "1"))
    size := gf.Int(ctx.DefaultQuery("size", "20"))
    if page <= 0 { page = 1 }
    if size <= 0 || size > 200 { size = 20 }
    keyword := strings.TrimSpace(ctx.Query("keyword"))
    status := strings.TrimSpace(ctx.Query("status"))

    where := "1=1"
    args := []interface{}{}
    if keyword != "" {
        where += " AND (LOWER(email) LIKE ? OR LOWER(username) LIKE ?)"
        kw := "%" + strings.ToLower(keyword) + "%"
        args = append(args, kw, kw)
    }
    if status != "" {
        where += " AND status = ?"
        args = append(args, status)
    }

    // count
    cntRows, err := gf.DB().Query(ctx, "SELECT COUNT(*) AS c FROM users WHERE "+where, args...)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    total := 0; if len(cntRows) > 0 { total = gf.Int(cntRows[0]["c"]) }

    // list
    offset := (page-1)*size
    listRows, err := gf.DB().Query(ctx, "SELECT id, email, username, role, status, token_balance, email_verified, last_login_at, created_at FROM users WHERE "+where+" ORDER BY created_at DESC LIMIT ? OFFSET ?", append(args, size, offset)...)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5002, "message": err.Error()}); return }

    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{"items": listRows, "total": total, "page": page, "size": size}})
}

// GetUser 用户详情
func (c *UserController) GetUser(ctx *gin.Context) {
    id := ctx.Param("id")
    row, err := gf.DB().Raw("SELECT id, email, username, avatar_url, role, status, token_balance, email_verified, last_login_at, created_at, updated_at FROM users WHERE id=? LIMIT 1", id).One()
    if err != nil || row == nil { ctx.JSON(http.StatusOK, gin.H{"code":404, "message":"not found"}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": row})
}

// UpdateUserStatus 更新用户状态
func (c *UserController) UpdateUserStatus(ctx *gin.Context) {
    id := ctx.Param("id")
    var body struct{ Status string `json:"status"` }
    if err := ctx.ShouldBindJSON(&body); err != nil || body.Status == "" {
        ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"invalid body"}); return
    }
    if _, err := gf.DB().Exec(ctx, "UPDATE users SET status=? WHERE id=?", body.Status, id); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"updated"})
}

