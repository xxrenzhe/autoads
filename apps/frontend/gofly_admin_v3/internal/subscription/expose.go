package subscription

import (
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

// GetCurrentUserSubscription 导出：获取当前用户的有效订阅（只读）
// 路径：GET /api/v1/user/subscription/current
// 身份：
//  - 优先从上下文 c.GetString("user_id")（InternalJWT 解析）获取；
//  - 若为空则返回空数据（不报错），以便前端渐进式切换（fallback 到本地实现）。
func GetCurrentUserSubscription(c *gin.Context) {
    userID := c.GetString("user_id")
    if userID == "" {
        // 渐进兼容：返回 null，不报错
        c.JSON(http.StatusOK, gin.H{"code": 0, "data": nil})
        return
    }
    rec, err := gf.DB().Raw(`SELECT s.*, p.name as plan_name, p.duration FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? AND s.status='ACTIVE' ORDER BY s.updated_at DESC LIMIT 1`, userID).One()
    if err != nil {
        c.JSON(http.StatusOK, gin.H{"code": 5001, "message": err.Error()})
        return
    }
    if rec == nil {
        c.JSON(http.StatusOK, gin.H{"code": 0, "data": nil})
        return
    }
    // 只读对象：时间字段统一 ISO 字符串
    out := gin.H{}
    for k, v := range rec {
        out[k] = v.Val()
    }
    // 兼容 started_at/ended_at
    if t := rec["started_at"].Time(); !t.IsZero() { out["started_at"] = t.UTC().Format(time.RFC3339) }
    if t := rec["ended_at"].Time(); !t.IsZero() { out["ended_at"] = t.UTC().Format(time.RFC3339) }
    c.JSON(http.StatusOK, gin.H{"code": 0, "data": out})
}

