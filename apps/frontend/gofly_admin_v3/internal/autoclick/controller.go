package autoclick

import (
    "encoding/json"
    "time"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "gorm.io/gorm"
    "gorm.io/datatypes"
    "gofly-admin-v3/internal/system"
)

type Controller struct { DB *gorm.DB }

func NewController(db *gorm.DB) *Controller { return &Controller{DB: db} }

type refererPayload struct {
    Type  string `json:"type"`
    Value string `json:"value"`
}

type schedulePayload struct {
    Name        string         `json:"name"`
    URLs        []string       `json:"urls"`
    Timezone    string         `json:"timezone"`
    TimeWindow  string         `json:"timeWindow"`
    DailyTarget int            `json:"dailyTarget"`
    Referer     *refererPayload `json:"referer"`
    ProxyURL    *string        `json:"proxyUrl"`
}

func (c *Controller) CreateSchedule(ctx *gin.Context) {
    userID := ctx.GetString("user_id"); if userID == "" { ctx.JSON(401, gin.H{"error": "unauthorized"}); return }
    var req schedulePayload
    if err := ctx.ShouldBindJSON(&req); err != nil || len(req.URLs) == 0 || req.DailyTarget <= 0 {
        ctx.JSON(400, gin.H{"error": "invalid request"}); return
    }
    now := time.Now()
    // OPS 默认 Referer 注入（如未提供）
    if req.Referer == nil {
        if v, ok := system.Get("automation.referer.default"); ok && v != "" {
            rv := v
            req.Referer = &refererPayload{ Type: "default", Value: rv }
        }
    }
    s := &AutoClickSchedule{
        ID: uuid.New().String(),
        UserID: userID,
        Name: req.Name,
        URLs: mustJSON(req.URLs),
        Timezone: ifEmpty(req.Timezone, "US"),
        TimeWindow: ifEmpty(req.TimeWindow, "00:00-24:00"),
        DailyTarget: req.DailyTarget,
        RefererType: ifNil(req.Referer, func() string { return "" }, func() string { return req.Referer.Type }),
        RefererValue: ifNil(req.Referer, func() string { return "" }, func() string { return req.Referer.Value }),
        ProxyURL: req.ProxyURL,
        Status: string(StatusDisabled),
        CreatedAt: now,
        UpdatedAt: now,
    }
    if err := c.DB.Create(s).Error; err != nil { ctx.JSON(500, gin.H{"error": err.Error()}); return }
    ctx.JSON(200, gin.H{"data": s})
}

func (c *Controller) ListSchedules(ctx *gin.Context) {
    userID := ctx.GetString("user_id"); if userID == "" { ctx.JSON(401, gin.H{"error": "unauthorized"}); return }
    var rows []AutoClickSchedule
    if err := c.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&rows).Error; err != nil { ctx.JSON(500, gin.H{"error": err.Error()}); return }
    ctx.JSON(200, gin.H{"data": rows})
}

func (c *Controller) GetSchedule(ctx *gin.Context) {
    userID := ctx.GetString("user_id"); if userID == "" { ctx.JSON(401, gin.H{"error": "unauthorized"}); return }
    id := ctx.Param("id"); if id == "" { ctx.JSON(400, gin.H{"error": "missing id"}); return }
    var row AutoClickSchedule
    if err := c.DB.Where("id = ? AND user_id = ?", id, userID).First(&row).Error; err != nil { ctx.JSON(404, gin.H{"error": "not found"}); return }
    ctx.JSON(200, gin.H{"data": row})
}

func (c *Controller) UpdateSchedule(ctx *gin.Context) {
    userID := ctx.GetString("user_id"); if userID == "" { ctx.JSON(401, gin.H{"error": "unauthorized"}); return }
    id := ctx.Param("id"); if id == "" { ctx.JSON(400, gin.H{"error": "missing id"}); return }
    var row AutoClickSchedule
    if err := c.DB.Where("id = ? AND user_id = ?", id, userID).First(&row).Error; err != nil { ctx.JSON(404, gin.H{"error": "not found"}); return }
    var req schedulePayload
    if err := ctx.ShouldBindJSON(&req); err != nil { ctx.JSON(400, gin.H{"error": "invalid request"}); return }
    updates := map[string]interface{}{
        "name": req.Name,
        "timezone": ifEmpty(req.Timezone, row.Timezone),
        "time_window": ifEmpty(req.TimeWindow, row.TimeWindow),
        "daily_target": ifZero(req.DailyTarget, row.DailyTarget),
        "updated_at": time.Now(),
    }
    if len(req.URLs) > 0 { updates["urls"] = mustJSON(req.URLs) }
    if req.Referer != nil { updates["referer_type"], updates["referer_value"] = req.Referer.Type, req.Referer.Value }
    if req.ProxyURL != nil { updates["proxy_url"] = *req.ProxyURL }
    if err := c.DB.Model(&AutoClickSchedule{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates).Error; err != nil { ctx.JSON(500, gin.H{"error": err.Error()}); return }
    ctx.JSON(200, gin.H{"success": true})
}

func (c *Controller) DeleteSchedule(ctx *gin.Context) {
    userID := ctx.GetString("user_id"); if userID == "" { ctx.JSON(401, gin.H{"error": "unauthorized"}); return }
    id := ctx.Param("id"); if id == "" { ctx.JSON(400, gin.H{"error": "missing id"}); return }
    if err := c.DB.Where("id = ? AND user_id = ?", id, userID).Delete(&AutoClickSchedule{}).Error; err != nil { ctx.JSON(500, gin.H{"error": err.Error()}); return }
    ctx.JSON(200, gin.H{"success": true})
}

func (c *Controller) EnableSchedule(ctx *gin.Context) {
    userID := ctx.GetString("user_id"); if userID == "" { ctx.JSON(401, gin.H{"error": "unauthorized"}); return }
    id := ctx.Param("id"); if id == "" { ctx.JSON(400, gin.H{"error": "missing id"}); return }
    if err := c.DB.Model(&AutoClickSchedule{}).Where("id = ? AND user_id = ?", id, userID).Updates(map[string]interface{}{"status": string(StatusEnabled), "updated_at": time.Now()}).Error; err != nil { ctx.JSON(500, gin.H{"error": err.Error()}); return }
    ctx.JSON(200, gin.H{"success": true})
}

func (c *Controller) DisableSchedule(ctx *gin.Context) {
    userID := ctx.GetString("user_id"); if userID == "" { ctx.JSON(401, gin.H{"error": "unauthorized"}); return }
    id := ctx.Param("id"); if id == "" { ctx.JSON(400, gin.H{"error": "missing id"}); return }
    if err := c.DB.Model(&AutoClickSchedule{}).Where("id = ? AND user_id = ?", id, userID).Updates(map[string]interface{}{"status": string(StatusDisabled), "updated_at": time.Now()}).Error; err != nil { ctx.JSON(500, gin.H{"error": err.Error()}); return }
    ctx.JSON(200, gin.H{"success": true})
}

func mustJSON(v any) datatypes.JSON {
    b, _ := json.Marshal(v)
    return datatypes.JSON(b)
}

func ifEmpty(s string, def string) string { if s == "" { return def }; return s }
func ifZero(i int, def int) int { if i == 0 { return def }; return i }
func ifNil[T any](p *T, zero func() string, val func() string) string { if p == nil { return zero() }; return val() }
