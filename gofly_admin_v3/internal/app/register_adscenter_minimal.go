package app

import (
    "encoding/json"
    "fmt"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gorm.io/datatypes"
    "gorm.io/gorm"
)

// 轻量模型（与 main.go 内最小模型等效，表名保持一致）
type adsAccount struct {
    ID          string    `json:"id" gorm:"primaryKey;size:36"`
    UserID      string    `json:"userId" gorm:"index;size:36"`
    AccountID   string    `json:"accountId"`
    AccountName string    `json:"accountName"`
    Status      string    `json:"status"`
    CreatedAt   time.Time `json:"createdAt"`
    UpdatedAt   time.Time `json:"updatedAt"`
}
func (adsAccount) TableName() string { return "ads_accounts" }

type adsConfiguration struct {
    ID          string         `json:"id" gorm:"primaryKey;size:36"`
    UserID      string         `json:"userId" gorm:"index;size:36"`
    Name        string         `json:"name"`
    Description string         `json:"description"`
    Payload     datatypes.JSON `json:"payload" gorm:"type:json"`
    Status      string         `json:"status"`
    CreatedAt   time.Time      `json:"createdAt"`
    UpdatedAt   time.Time      `json:"updatedAt"`
}
func (adsConfiguration) TableName() string { return "ads_configurations" }

type adsExecution struct {
    ID              string     `json:"id" gorm:"primaryKey;size:36"`
    UserID          string     `json:"userId" gorm:"index;size:36"`
    ConfigurationID string     `json:"configurationId"`
    Status          string     `json:"status"`
    Message         string     `json:"message" gorm:"type:text"`
    Progress        int        `json:"progress"`
    TotalItems      int        `json:"totalItems"`
    ProcessedItems  int        `json:"processedItems"`
    StartedAt       *time.Time `json:"startedAt"`
    CompletedAt     *time.Time `json:"completedAt"`
    CreatedAt       time.Time  `json:"createdAt"`
    UpdatedAt       time.Time  `json:"updatedAt"`
}
func (adsExecution) TableName() string { return "ads_executions" }

// RegisterAdsCenterMinimal 注册 v1 minimal 端点（accounts/configurations/executions）
func RegisterAdsCenterMinimal(v1 *gin.RouterGroup, auth gin.HandlerFunc, gormDB *gorm.DB) {
    grp := v1.Group("/adscenter")
    if auth != nil { grp.Use(auth) }

    // GET /api/v1/adscenter/accounts
    grp.GET("/accounts", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
        userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
        var rows []adsAccount
        if err := gormDB.Where("user_id = ?", userID).Order("created_at DESC").Find(&rows).Error; err != nil {
            c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return
        }
        c.JSON(200, gin.H{"accounts": rows, "count": len(rows)})
    })

    // GET /api/v1/adscenter/configurations
    grp.GET("/configurations", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
        userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
        var rows []adsConfiguration
        if err := gormDB.Where("user_id = ?", userID).Order("created_at DESC").Find(&rows).Error; err != nil {
            c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return
        }
        c.JSON(200, gin.H{"configurations": rows, "count": len(rows)})
    })

    // POST /api/v1/adscenter/configurations
    grp.POST("/configurations", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
        userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
        var body struct{ Name string `json:"name"`; Description string `json:"description"`; Payload map[string]any `json:"payload"` }
        if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" {
            c.JSON(400, gin.H{"code": 400, "message": "invalid request: name required"}); return
        }
        b, _ := json.Marshal(body.Payload)
        row := &adsConfiguration{ ID: fmt.Sprintf("%d", time.Now().UnixNano()), UserID: userID, Name: body.Name, Description: body.Description, Payload: datatypes.JSON(b), Status: "active", CreatedAt: time.Now(), UpdatedAt: time.Now() }
        if err := gormDB.Create(row).Error; err != nil { c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return }
        c.JSON(200, gin.H{"configuration": row})
    })

    // GET /api/v1/adscenter/executions
    grp.GET("/executions", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
        userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
        var rows []adsExecution
        if err := gormDB.Where("user_id = ?", userID).Order("created_at DESC").Limit(100).Find(&rows).Error; err != nil {
            c.JSON(500, gin.H{"code": 5000, "message": err.Error()}); return
        }
        c.JSON(200, gin.H{"executions": rows, "count": len(rows)})
    })

    // GET /api/v1/adscenter/executions/:id
    grp.GET("/executions/:id", func(c *gin.Context) {
        if gormDB == nil { c.JSON(503, gin.H{"code": 5000, "message": "db unavailable"}); return }
        userID := c.GetString("user_id"); if userID == "" { c.JSON(401, gin.H{"code": 401, "message": "unauthorized"}); return }
        id := c.Param("id"); if id == "" { c.JSON(400, gin.H{"code": 400, "message": "missing id"}); return }
        var exec adsExecution
        if err := gormDB.Where("id = ? AND user_id = ?", id, userID).First(&exec).Error; err != nil {
            c.JSON(404, gin.H{"code": 404, "message": "execution not found"}); return
        }
        c.JSON(200, gin.H{"execution": exec})
    })
}

