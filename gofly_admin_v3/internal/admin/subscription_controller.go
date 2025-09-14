package admin

import (
    "net/http"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

// SubscriptionController 订阅与计划（手动分配）
type SubscriptionController struct{}

func RegisterSubscriptionRoutes(r *gin.RouterGroup) {
    sc := &SubscriptionController{}
    // plans
    r.GET("/plans", sc.ListPlans)
    r.POST("/plans", sc.CreatePlan)
    r.PUT("/plans/:id", sc.UpdatePlan)
    r.DELETE("/plans/:id", sc.DeletePlan)

    // user subscriptions
    r.GET("/users/:id/subscriptions", sc.ListUserSubscriptions)
    r.POST("/users/:id/subscriptions/assign", sc.AssignSubscription)
    r.POST("/users/:id/subscriptions/:subId/cancel", sc.CancelSubscription)
}

// Plans
func (c *SubscriptionController) ListPlans(ctx *gin.Context) {
    status := ctx.DefaultQuery("status", "")
    where := "1=1"; args := []interface{}{}
    if status != "" { where += " AND status=?"; args = append(args, status) }
    rows, err := gf.DB().Query(ctx, "SELECT id, name, description, price, duration, features, status, created_at, updated_at FROM plans WHERE "+where+" ORDER BY created_at DESC", args...)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": rows})
}

func (c *SubscriptionController) CreatePlan(ctx *gin.Context) {
    var body map[string]interface{}
    if err := ctx.ShouldBindJSON(&body); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"invalid body"}); return }
    id := gf.UUID()
    name := strings.TrimSpace(gf.String(body["name"]))
    if name == "" { ctx.JSON(http.StatusOK, gin.H{"code":1002, "message":"name required"}); return }
    _, err := gf.DB().Exec(ctx, `INSERT INTO plans (id,name,description,price,duration,features,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,NOW(),NOW())`,
        id, name, gf.String(body["description"]), gf.Float64(body["price"]), gf.Int(body["duration"]), gf.String(body["features"]), ifnz(gf.String(body["status"]), "ACTIVE"))
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{"id": id}})
}

func (c *SubscriptionController) UpdatePlan(ctx *gin.Context) {
    id := ctx.Param("id")
    var body map[string]interface{}
    if err := ctx.ShouldBindJSON(&body); err != nil { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"invalid body"}); return }
    _, err := gf.DB().Exec(ctx, `UPDATE plans SET name=COALESCE(NULLIF(?,''),name), description=COALESCE(?,description), price=COALESCE(?,price), duration=COALESCE(?,duration), features=COALESCE(?,features), status=COALESCE(NULLIF(?,''),status), updated_at=NOW() WHERE id=?`,
        gf.String(body["name"]), gf.String(body["description"]), gf.Float64(body["price"]), gf.Int(body["duration"]), gf.String(body["features"]), gf.String(body["status"]), id)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"updated"})
}

func (c *SubscriptionController) DeletePlan(ctx *gin.Context) {
    id := ctx.Param("id")
    if _, err := gf.DB().Exec(ctx, "DELETE FROM plans WHERE id=?", id); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"deleted"})
}

// User subscriptions
func (c *SubscriptionController) ListUserSubscriptions(ctx *gin.Context) {
    userID := ctx.Param("id")
    rows, err := gf.DB().Query(ctx, `SELECT s.id, s.user_id, s.plan_id, p.name AS plan_name, s.status, s.started_at, s.ended_at, s.created_at, s.updated_at FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? ORDER BY s.updated_at DESC`, userID)
    if err != nil { ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": rows})
}

func (c *SubscriptionController) AssignSubscription(ctx *gin.Context) {
    userID := ctx.Param("id")
    var body struct {
        PlanID string `json:"plan_id"`
        Days   int    `json:"days"`
        Start  string `json:"start"`
        End    string `json:"end"`
    }
    if err := ctx.ShouldBindJSON(&body); err != nil || body.PlanID == "" { ctx.JSON(http.StatusOK, gin.H{"code":1001, "message":"plan_id required"}); return }
    // 计算起止时间
    now := time.Now()
    started := now
    if body.Start != "" { if t, e := time.Parse(time.RFC3339, body.Start); e==nil { started = t } }
    var ended time.Time
    if body.End != "" { if t, e := time.Parse(time.RFC3339, body.End); e==nil { ended = t } }
    if ended.IsZero() {
        // 使用 plan.duration 或 days
        dur := 30
        if body.Days > 0 { dur = body.Days } else {
            row, _ := gf.DB().Raw("SELECT duration FROM plans WHERE id=?", body.PlanID).One()
            if row != nil { dur = gf.Int(row["duration"]) }
        }
        ended = started.AddDate(0, 0, dur)
    }
    id := gf.UUID()
    if _, err := gf.DB().Exec(ctx, `INSERT INTO subscriptions (id, user_id, plan_id, status, started_at, ended_at, created_at, updated_at) VALUES (?,?,?,?,?,?,NOW(),NOW())`, id, userID, body.PlanID, "ACTIVE", started, ended); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "data": gin.H{"id": id, "started_at": started, "ended_at": ended}})
}

func (c *SubscriptionController) CancelSubscription(ctx *gin.Context) {
    userID := ctx.Param("id")
    subID := ctx.Param("subId")
    if _, err := gf.DB().Exec(ctx, `UPDATE subscriptions SET status='CANCELLED', updated_at=NOW() WHERE id=? AND user_id=?`, subID, userID); err != nil {
        ctx.JSON(http.StatusOK, gin.H{"code":5001, "message": err.Error()}); return
    }
    ctx.JSON(http.StatusOK, gin.H{"code":0, "message":"cancelled"})
}

func ifnz(s, def string) string { if strings.TrimSpace(s)=="" { return def }; return s }

