package admin

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

// TokenController 管理端-Token管理
type TokenController struct{}

func RegisterTokenRoutes(r *gin.RouterGroup) {
    tc := &TokenController{}
    group := r.Group("/tokens")
    {
        group.GET("/balance/:userId", tc.GetBalance)
        group.POST("/adjust/:userId", tc.AdjustBalance)
        group.GET("/transactions", tc.ListTransactions)
    }
}

// GetBalance 查询用户余额
func (c *TokenController) GetBalance(ctx *gin.Context) {
    userID := ctx.Param("userId")
    row, err := gf.DB().Raw("SELECT token_balance FROM users WHERE id=?", userID).One()
    if err != nil || row == nil { ctx.JSON(http.StatusOK, gin.H{"code":404, "message":"user not found"}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{"user_id": userID, "balance": row["token_balance"].Int64()}})
}

// AdjustBalance 调整余额（正为增加，负为扣减）
func (c *TokenController) AdjustBalance(ctx *gin.Context) {
    userID := ctx.Param("userId")
    var body struct {
        Amount  int    `json:"amount"`
        Reason  string `json:"reason"`
        Service string `json:"service"`
        Action  string `json:"action"`
        RefID   string `json:"ref_id"`
    }
    if err := ctx.ShouldBindJSON(&body); err != nil || body.Amount == 0 || body.Reason == "" {
        ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"amount and reason required"}); return
    }
    // 事务：更新余额 + 插入流水
    tx, err := gf.DB().Begin(ctx)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5000, "message": err.Error()}); return }
    _, err = tx.Exec(ctx, "UPDATE users SET token_balance = token_balance + ? WHERE id=?", body.Amount, userID)
    if err != nil { tx.Rollback(ctx); ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    _, err = tx.Exec(ctx, `INSERT INTO token_transactions (user_id, amount, type, service, action, ref_id, details, created_at) VALUES (?,?,?,?,?,?,?,NOW())`,
        userID, body.Amount, ifEmptyType(body.Action), body.Service, body.Action, body.RefID, body.Reason,
    )
    if err != nil { tx.Rollback(ctx); ctx.JSON(http.StatusOK, gin.H{"code":5002, "message": err.Error()}); return }
    if err := tx.Commit(ctx); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5003, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"ok"})
}

// ListTransactions 分页流水
func (c *TokenController) ListTransactions(ctx *gin.Context) {
    page := gf.Int(ctx.DefaultQuery("page", "1"))
    size := gf.Int(ctx.DefaultQuery("size", "20"))
    if page <= 0 { page = 1 }
    if size <= 0 || size > 200 { size = 20 }
    userID := ctx.Query("userId")
    typ := ctx.Query("type")
    service := ctx.Query("service")
    action := ctx.Query("action")

    where := "1=1"; args := []interface{}{}
    if userID != "" { where += " AND user_id=?"; args = append(args, userID) }
    if typ != "" { where += " AND type=?"; args = append(args, typ) }
    if service != "" { where += " AND service=?"; args = append(args, service) }
    if action != "" { where += " AND action=?"; args = append(args, action) }

    cntRows, err := gf.DB().Query(ctx, "SELECT COUNT(*) AS c FROM token_transactions WHERE "+where, args...)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    total := 0; if len(cntRows) > 0 { total = gf.Int(cntRows[0]["c"]) }

    offset := (page-1)*size
    listRows, err := gf.DB().Query(ctx, "SELECT id, created_at, user_id, amount, type, service, action, ref_id, details FROM token_transactions WHERE "+where+" ORDER BY created_at DESC LIMIT ? OFFSET ?", append(args, size, offset)...)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5002, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{"items": listRows, "total": total, "page": page, "size": size}})
}

func ifEmptyType(action string) string { if action=="" { return "adjust" }; return "adjust" }
