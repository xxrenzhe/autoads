package websocket

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Controller WebSocket控制器
type Controller struct {
	manager *Manager
}

// NewController 创建WebSocket控制器
func NewController(manager *Manager) *Controller {
	return &Controller{
		manager: manager,
	}
}

// APIResponse 统一API响应格式
type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// HandleWebSocket 处理WebSocket连接
// GET /ws
func (c *Controller) HandleWebSocket(ctx *gin.Context) {
	c.manager.HandleWebSocket(ctx)
}

// SendNotification 发送通知（管理员接口）
// POST /api/websocket/notification
func (c *Controller) SendNotification(ctx *gin.Context) {
	var req struct {
		UserID  string `json:"user_id" binding:"required"`
		Title   string `json:"title" binding:"required"`
		Message string `json:"message" binding:"required"`
		Level   string `json:"level"` // info, warning, error, success
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	if req.Level == "" {
		req.Level = "info"
	}

	if err := c.manager.SendSystemNotification(req.UserID, req.Title, req.Message, req.Level); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: "发送通知失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "通知发送成功",
	})
}

// SendBatchGoOpenURL 发送BatchGo打开URL指令
// POST /api/websocket/batchgo/open-url
func (c *Controller) SendBatchGoOpenURL(ctx *gin.Context) {
	var req struct {
		UserID string   `json:"user_id" binding:"required"`
		TaskID string   `json:"task_id" binding:"required"`
		URLs   []string `json:"urls" binding:"required"`
		Delay  int      `json:"delay"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	if req.Delay <= 0 {
		req.Delay = 1000 // 默认1秒延迟
	}

	if err := c.manager.SendBatchGoOpenURL(req.UserID, req.TaskID, req.URLs, req.Delay); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: "发送指令失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "指令发送成功",
	})
}

// SendTaskProgress 发送任务进度更新
// POST /api/websocket/task/progress
func (c *Controller) SendTaskProgress(ctx *gin.Context) {
	var req struct {
		UserID    string  `json:"user_id" binding:"required"`
		TaskID    string  `json:"task_id" binding:"required"`
		TaskType  string  `json:"task_type" binding:"required"`
		Status    string  `json:"status" binding:"required"`
		Progress  float64 `json:"progress"`
		Total     int     `json:"total"`
		Completed int     `json:"completed"`
		Failed    int     `json:"failed"`
		Message   string  `json:"message"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	if err := c.manager.SendTaskProgress(
		req.UserID, req.TaskID, req.TaskType, req.Status,
		req.Progress, req.Total, req.Completed, req.Failed, req.Message,
	); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: "发送进度失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "进度发送成功",
	})
}

// SendTokenInsufficient 发送Token不足通知
// POST /api/websocket/token/insufficient
func (c *Controller) SendTokenInsufficient(ctx *gin.Context) {
	var req struct {
		UserID         string `json:"user_id" binding:"required"`
		CurrentBalance int    `json:"current_balance"`
		RequiredTokens int    `json:"required_tokens" binding:"required"`
		TaskType       string `json:"task_type" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	if err := c.manager.SendTokenInsufficientNotification(
		req.UserID, req.CurrentBalance, req.RequiredTokens, req.TaskType,
	); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: "发送通知失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "通知发送成功",
	})
}

// SendPlanExpiring 发送套餐过期通知
// POST /api/websocket/plan/expiring
func (c *Controller) SendPlanExpiring(ctx *gin.Context) {
	var req struct {
		UserID    string `json:"user_id" binding:"required"`
		PlanName  string `json:"plan_name" binding:"required"`
		DaysLeft  int    `json:"days_left"`
		ExpiresAt int64  `json:"expires_at"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	if err := c.manager.SendPlanExpiringNotification(
		req.UserID, req.PlanName, req.DaysLeft, req.ExpiresAt,
	); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: "发送通知失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "通知发送成功",
	})
}

// GetConnectionStats 获取连接统计
// GET /api/websocket/stats
func (c *Controller) GetConnectionStats(ctx *gin.Context) {
	stats := map[string]interface{}{
		"total_connections": c.manager.GetConnectionCount(),
		"connected_users":   c.manager.GetConnectedUsers(),
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    stats,
	})
}

// CheckUserOnline 检查用户是否在线
// GET /api/websocket/user/:user_id/online
func (c *Controller) CheckUserOnline(ctx *gin.Context) {
	userID := ctx.Param("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "用户ID不能为空",
		})
		return
	}

	isOnline := c.manager.IsUserOnline(userID)

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "检查完成",
		Data: map[string]interface{}{
			"user_id":   userID,
			"is_online": isOnline,
		},
	})
}

// BroadcastNotification 广播通知给所有用户
// POST /api/websocket/broadcast
func (c *Controller) BroadcastNotification(ctx *gin.Context) {
	var req struct {
		Title   string `json:"title" binding:"required"`
		Message string `json:"message" binding:"required"`
		Level   string `json:"level"` // info, warning, error, success
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	if req.Level == "" {
		req.Level = "info"
	}

	notification := SystemNotificationData{
		Title:   req.Title,
		Message: req.Message,
		Level:   req.Level,
	}

	message := Message{
		Type:      MessageTypeSystemNotification,
		Data:      notification,
		Timestamp: time.Now().Unix(),
	}

	if err := c.manager.Broadcast(message); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: "广播失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "广播成功",
	})
}

// TestConnection 测试WebSocket连接
// GET /api/websocket/test
func (c *Controller) TestConnection(ctx *gin.Context) {
	userID := ctx.Query("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "用户ID不能为空",
		})
		return
	}

	// 发送测试消息
	testMessage := "这是一条测试消息，时间: " + time.Now().Format("2006-01-02 15:04:05")
	if err := c.manager.SendSystemNotification(userID, "连接测试", testMessage, "info"); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: "发送测试消息失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "测试消息发送成功",
	})
}

// RegisterRoutes 注册路由
func (c *Controller) RegisterRoutes(r *gin.RouterGroup) {
	// WebSocket连接
	r.GET("/ws", c.HandleWebSocket)

	// 通知相关
	r.POST("/notification", c.SendNotification)
	r.POST("/broadcast", c.BroadcastNotification)

	// BatchGo相关
	r.POST("/batchgo/open-url", c.SendBatchGoOpenURL)

	// 任务相关
	r.POST("/task/progress", c.SendTaskProgress)

	// Token相关
	r.POST("/token/insufficient", c.SendTokenInsufficient)

	// 套餐相关
	r.POST("/plan/expiring", c.SendPlanExpiring)

	// 连接管理
	r.GET("/stats", c.GetConnectionStats)
	r.GET("/user/:user_id/online", c.CheckUserOnline)
	r.GET("/test", c.TestConnection)
}
