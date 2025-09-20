package admin

import (
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

// InvitationController 管理端-邀请管理（列表/统计/榜单）
type InvitationController struct{}

func RegisterInvitationRoutes(r *gin.RouterGroup) {
    ic := &InvitationController{}
    g := r.Group("/invitations")
    {
        g.GET("", ic.ListInvitations)
        g.GET("/stats", ic.GetStats)
        g.GET("/ranking", ic.GetRanking)
        g.POST(":id/revoke", ic.Revoke)
    }
}

// ListInvitations 邀请记录列表（支持筛选）
// GET /api/v1/console/invitations?inviterId=&inviteeId=&status=&page=1&size=20
func (c *InvitationController) ListInvitations(ctx *gin.Context) {
    page := gf.Int(ctx.DefaultQuery("page", "1"))
    size := gf.Int(ctx.DefaultQuery("size", "20"))
    if page <= 0 { page = 1 }
    if size <= 0 || size > 200 { size = 20 }
    inviter := strings.TrimSpace(ctx.Query("inviterId"))
    invitee := strings.TrimSpace(ctx.Query("inviteeId"))
    status := strings.TrimSpace(ctx.Query("status"))

    where := "1=1"; args := []interface{}{}
    if inviter != "" { where += " AND inviter_id = ?"; args = append(args, inviter) }
    if invitee != "" { where += " AND invitee_id = ?"; args = append(args, invitee) }
    if status != "" { where += " AND status = ?"; args = append(args, status) }

    cntRows, err := gf.DB().Query(ctx, "SELECT COUNT(*) AS c FROM invitations WHERE "+where, args...)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    total := 0; if len(cntRows) > 0 { total = gf.Int(cntRows[0]["c"]) }

    offset := (page-1)*size
    listRows, err := gf.DB().Query(ctx, `SELECT i.id, i.inviter_id, inv.email AS inviter_email, i.invitee_id, ie.email AS invitee_email, i.invite_code, i.status, i.reward_days, i.token_reward, i.created_at
        FROM invitations i
        LEFT JOIN users inv ON inv.id = i.inviter_id
        LEFT JOIN users ie ON ie.id = i.invitee_id
        WHERE `+where+` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`, append(args, size, offset)...)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5002, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{"items": listRows, "total": total, "page": page, "size": size}})
}

// GetStats 邀请统计（全局或按用户）
// GET /api/v1/console/invitations/stats?userId=
func (c *InvitationController) GetStats(ctx *gin.Context) {
    userID := strings.TrimSpace(ctx.Query("userId"))
    var (
        total, success, pending, expired int
        todayInv, monthInv int
        totalTokens int
    )
    // 时间边界
    today := time.Now().Format("2006-01-02")
    monthStart := time.Date(time.Now().Year(), time.Now().Month(), 1, 0,0,0,0, time.Local).Format("2006-01-02")

    where := "1=1"; args := []interface{}{}
    if userID != "" { where += " AND inviter_id = ?"; args = append(args, userID) }

    // 汇总计数
    rows, e := gf.DB().Query(ctx, `SELECT 
        (SELECT COUNT(*) FROM invitations WHERE `+where+`) AS total,
        (SELECT COUNT(*) FROM invitations WHERE `+where+` AND status='completed') AS success,
        (SELECT COUNT(*) FROM invitations WHERE `+where+` AND status='pending') AS pending,
        (SELECT COUNT(*) FROM invitations WHERE `+where+` AND status='expired') AS expired,
        (SELECT COUNT(*) FROM invitations WHERE `+where+` AND DATE(created_at)=?) AS today_cnt,
        (SELECT COUNT(*) FROM invitations WHERE `+where+` AND DATE(created_at)>=?) AS month_cnt
    `, append(args, today, monthStart)...)
    if e != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": e.Error()}); return }
    if len(rows) > 0 {
        total = gf.Int(rows[0]["total"]) 
        success = gf.Int(rows[0]["success"]) 
        pending = gf.Int(rows[0]["pending"]) 
        expired = gf.Int(rows[0]["expired"]) 
        todayInv = gf.Int(rows[0]["today_cnt"]) 
        monthInv = gf.Int(rows[0]["month_cnt"]) 
    }

    // Token奖励（以描述包含“邀请”为准）
    tokRows, e2 := gf.DB().Query(ctx, `SELECT COALESCE(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END),0) AS total_tokens FROM token_transactions WHERE details LIKE '%邀请%'`)
    if e2 == nil && len(tokRows) > 0 { totalTokens = gf.Int(tokRows[0]["total_tokens"]) }

    rate := 0.0; if total>0 { rate = float64(success)*100.0/float64(total) }
    // 输出使用前端期望的字段名
    out := gin.H{
        "totalInvitations": total,
        "acceptedInvitations": success,
        "pendingInvitations": pending,
        "expiredInvitations": expired,
        "todayInvitations": todayInv,
        "monthInvitations": monthInv,
        "totalTokensReward": totalTokens,
        "acceptanceRate": rate,
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": out})
}

// GetRanking 邀请排行榜（使用 admin.TokenService 实现）
// GET /api/v1/console/invitations/ranking?limit=10
func (c *InvitationController) GetRanking(ctx *gin.Context) {
    limit := 10
    if v := strings.TrimSpace(ctx.Query("limit")); v != "" { if x, e := strconv.Atoi(v); e==nil && x>0 && x<=100 { limit = x } }
    // 直接查询排行榜（与 admin.TokenService.GetInvitationRanking 逻辑一致）
    rows, err := gf.DB().Query(ctx, `
        SELECT 
            u.id as user_id,
            u.username,
            u.email,
            COALESCE(inv.invitation_count, 0) as invitation_count,
            COALESCE(inv.successful_count, 0) as successful_count,
            COALESCE(tokens.reward_tokens, 0) as reward_tokens,
            COALESCE(inv.successful_count * 30, 0) as reward_pro_days
        FROM users u
        LEFT JOIN (
            SELECT inviter_id, COUNT(*) as invitation_count,
                   COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_count
            FROM invitations GROUP BY inviter_id
        ) inv ON u.id = inv.inviter_id
        LEFT JOIN (
            SELECT user_id, SUM(CASE WHEN description LIKE '%邀请奖励%' THEN amount ELSE 0 END) as reward_tokens
            FROM token_transactions GROUP BY user_id
        ) tokens ON u.id = tokens.user_id
        WHERE inv.invitation_count > 0
        ORDER BY inv.successful_count DESC, inv.invitation_count DESC
        LIMIT ?
    `, limit)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": rows})
}

// Revoke 撤销未使用的邀请码（将状态置为 expired）
// POST /api/v1/console/invitations/:id/revoke
func (c *InvitationController) Revoke(ctx *gin.Context) {
    id := ctx.Param("id")
    if id == "" { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"id required"}); return }
    // 仅允许对 pending 状态进行过期处理
    row, err := gf.DB().Raw("SELECT status FROM invitations WHERE id=?", id).One()
    if err != nil || row == nil { ctx.JSON(http.StatusOK, gin.H{"code":404, "message":"not found"}); return }
    status := strings.ToLower(gf.String(row["status"]))
    if status != "pending" { ctx.JSON(http.StatusOK, gin.H{"code":409, "message":"cannot revoke in current status"}); return }
    if _, err := gf.DB().Exec(ctx, "UPDATE invitations SET status='expired' WHERE id=?", id); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"revoked"})
}
