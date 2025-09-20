package admin

import (
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

// CheckinAdminController 管理端-签到管理（记录/统计/榜单）
type CheckinAdminController struct{}

func RegisterCheckinAdminRoutes(r *gin.RouterGroup) {
    cc := &CheckinAdminController{}
    g := r.Group("/checkins")
    {
        g.GET("/records", cc.ListRecords)
        g.GET("/stats", cc.GetStats)
        g.GET("/leaderboard", cc.GetLeaderboard)
    }
}

// ListRecords 签到记录列表（可按用户/日期范围）
// GET /api/v1/console/checkins/records?userId=&start=YYYY-MM-DD&end=YYYY-MM-DD&page=1&size=20
func (c *CheckinAdminController) ListRecords(ctx *gin.Context) {
    page := gf.Int(ctx.DefaultQuery("page", "1"))
    size := gf.Int(ctx.DefaultQuery("size", "20"))
    if page <= 0 { page = 1 }
    if size <= 0 || size > 200 { size = 20 }
    userID := strings.TrimSpace(ctx.Query("userId"))
    start := strings.TrimSpace(ctx.Query("start"))
    end := strings.TrimSpace(ctx.Query("end"))

    where := "1=1"; args := []interface{}{}
    if userID != "" { where += " AND c.user_id=?"; args = append(args, userID) }
    if start != "" { where += " AND c.checkin_date >= ?"; args = append(args, start) }
    if end != "" { where += " AND c.checkin_date <= ?"; args = append(args, end) }

    cntRows, err := gf.DB().Query(ctx, "SELECT COUNT(*) AS c FROM checkin_records c WHERE "+where, args...)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    total := 0; if len(cntRows) > 0 { total = gf.Int(cntRows[0]["c"]) }

    offset := (page-1)*size
    listRows, err := gf.DB().Query(ctx, `SELECT c.user_id, u.email, c.checkin_date, c.token_reward, c.created_at
        FROM checkin_records c LEFT JOIN users u ON u.id=c.user_id
        WHERE `+where+` ORDER BY c.checkin_date DESC LIMIT ? OFFSET ?`, append(args, size, offset)...)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5002, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{"items": listRows, "total": total, "page": page, "size": size}})
}

// GetStats 签到统计（全局或按用户）
// GET /api/v1/console/checkins/stats?userId=
func (c *CheckinAdminController) GetStats(ctx *gin.Context) {
    userID := strings.TrimSpace(ctx.Query("userId"))
    today := time.Now().Format("2006-01-02")
    monthStart := time.Date(time.Now().Year(), time.Now().Month(), 1, 0,0,0,0, time.Local).Format("2006-01-02")

    if userID != "" {
        rows, err := gf.DB().Query(ctx, `SELECT 
            (SELECT COUNT(*) FROM checkin_records WHERE user_id=?) AS total_days,
            (SELECT COALESCE(SUM(token_reward),0) FROM checkin_records WHERE user_id=?) AS total_tokens,
            (SELECT COUNT(*) FROM checkin_records WHERE user_id=? AND checkin_date=?) AS today_days,
            (SELECT COALESCE(SUM(token_reward),0) FROM checkin_records WHERE user_id=? AND checkin_date=?) AS today_tokens,
            (SELECT COUNT(*) FROM checkin_records WHERE user_id=? AND checkin_date>=?) AS month_days,
            (SELECT COALESCE(SUM(token_reward),0) FROM checkin_records WHERE user_id=? AND checkin_date>=?) AS month_tokens
        `, userID, userID, userID, today, userID, today, userID, monthStart, userID, monthStart)
        if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
        data := gin.H{"totalCheckIns":0, "todayCheckIns":0, "monthCheckIns":0, "uniqueUsers":1, "todayTokensAwarded":0, "monthTokensAwarded":0, "averageStreak":0, "activeStreaks":0}
        if len(rows) > 0 {
            data["totalCheckIns"] = gf.Int(rows[0]["total_days"]) 
            data["todayCheckIns"] = gf.Int(rows[0]["today_days"]) 
            data["monthCheckIns"] = gf.Int(rows[0]["month_days"]) 
            data["todayTokensAwarded"] = gf.Int(rows[0]["today_tokens"]) 
            data["monthTokensAwarded"] = gf.Int(rows[0]["month_tokens"]) 
        }
        ctx.JSON(http.StatusOK, gin.H{"code":0, "data": data}); return
    }

    // 全局统计
    rows, err := gf.DB().Query(ctx, `SELECT 
        (SELECT COUNT(*) FROM checkin_records) AS total_days,
        (SELECT COUNT(DISTINCT user_id) FROM checkin_records) AS unique_users,
        (SELECT COALESCE(SUM(token_reward),0) FROM checkin_records) AS total_tokens,
        (SELECT COUNT(*) FROM checkin_records WHERE checkin_date = ?) AS today_days,
        (SELECT COALESCE(SUM(token_reward),0) FROM checkin_records WHERE checkin_date = ?) AS today_tokens,
        (SELECT COUNT(*) FROM checkin_records WHERE checkin_date >= ?) AS month_days,
        (SELECT COALESCE(SUM(token_reward),0) FROM checkin_records WHERE checkin_date >= ?) AS month_tokens
    `, today, today, monthStart, monthStart)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    data := gin.H{"totalCheckIns":0, "uniqueUsers":0, "todayCheckIns":0, "monthCheckIns":0, "todayTokensAwarded":0, "monthTokensAwarded":0, "averageStreak":0, "activeStreaks":0}
    if len(rows) > 0 {
        data["totalCheckIns"] = gf.Int(rows[0]["total_days"]) 
        data["uniqueUsers"] = gf.Int(rows[0]["unique_users"]) 
        data["todayCheckIns"] = gf.Int(rows[0]["today_days"]) 
        data["monthCheckIns"] = gf.Int(rows[0]["month_days"]) 
        data["todayTokensAwarded"] = gf.Int(rows[0]["today_tokens"]) 
        data["monthTokensAwarded"] = gf.Int(rows[0]["month_tokens"]) 
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": data})
}

// GetLeaderboard 签到榜单
// GET /api/v1/console/checkins/leaderboard?limit=50
func (c *CheckinAdminController) GetLeaderboard(ctx *gin.Context) {
    limit := 50
    if v := strings.TrimSpace(ctx.Query("limit")); v != "" { if x, e := strconv.Atoi(v); e==nil && x>0 && x<=100 { limit = x } }
    rows, err := gf.DB().Query(ctx, `SELECT u.id AS user_id, u.email, COUNT(*) AS total_days, COALESCE(SUM(c.token_reward),0) AS total_tokens
        FROM checkin_records c LEFT JOIN users u ON u.id=c.user_id
        GROUP BY u.id, u.email
        HAVING total_days > 0
        ORDER BY total_days DESC, total_tokens DESC
        LIMIT ?`, limit)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": rows})
}
