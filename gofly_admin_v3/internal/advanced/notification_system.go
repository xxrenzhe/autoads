package advanced

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/email"
	"gofly-admin-v3/internal/websocket"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/tools/glog"
	"gorm.io/gorm"
)

// UnifiedNotificationSystem 统一通知系统
type UnifiedNotificationSystem struct {
	db           *gorm.DB
	emailService *email.EmailService
	wsService    *websocket.WebSocketService
	templates    map[string]*NotificationTemplate
	channels     map[string]NotificationChannel
	rules        map[string]*NotificationRule
	queue        chan *NotificationTask
	workers      int
	mu           sync.RWMutex
}

// NotificationChannel 通知渠道接口
type NotificationChannel interface {
	Send(ctx context.Context, notification *Notification) error
	Name() string
	IsEnabled() bool
}

// NotificationTemplate 通知模板
type NotificationTemplate struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Type      string                 `json:"type"` // email, websocket, system
	Subject   string                 `json:"subject"`
	Content   string                 `json:"content"`
	Variables []string               `json:"variables"`
	Metadata  map[string]interface{} `json:"metadata"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

// NotificationRule 通知规则
type NotificationRule struct {
	ID            string                  `json:"id"`
	Name          string                  `json:"name"`
	EventType     string                  `json:"event_type"`
	Conditions    []NotificationCondition `json:"conditions"`
	Actions       []NotificationAction    `json:"actions"`
	Enabled       bool                    `json:"enabled"`
	Priority      int                     `json:"priority"`
	Throttle      time.Duration           `json:"throttle"`
	LastTriggered *time.Time              `json:"last_triggered,omitempty"`
	CreatedAt     time.Time               `json:"created_at"`
	UpdatedAt     time.Time               `json:"updated_at"`
}

// NotificationCondition 通知条件
type NotificationCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"` // eq, ne, gt, lt, gte, lte, in, contains
	Value    interface{} `json:"value"`
}

// NotificationAction 通知动作
type NotificationAction struct {
	Type       string                 `json:"type"` // email, websocket, system
	Template   string                 `json:"template"`
	Recipients []string               `json:"recipients"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// Notification 通知
type Notification struct {
	ID          string                 `json:"id"`
	UserID      string                 `json:"user_id"`
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Content     string                 `json:"content"`
	Data        map[string]interface{} `json:"data"`
	Channels    []string               `json:"channels"`
	Priority    int                    `json:"priority"`
	Status      string                 `json:"status"` // pending, sent, failed
	ScheduledAt *time.Time             `json:"scheduled_at,omitempty"`
	SentAt      *time.Time             `json:"sent_at,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// NotificationTask 通知任务
type NotificationTask struct {
	Notification *Notification
	Retry        int
	MaxRetry     int
}

// EmailChannel 邮件通知渠道
type EmailChannel struct {
	service *email.EmailService
	enabled bool
}

// WebSocketChannel WebSocket通知渠道
type WebSocketChannel struct {
	service *websocket.WebSocketService
	enabled bool
}

// SystemChannel 系统消息渠道
type SystemChannel struct {
	db      *gorm.DB
	enabled bool
}

// NewUnifiedNotificationSystem 创建统一通知系统
func NewUnifiedNotificationSystem(
	db *gorm.DB,
	emailService *email.EmailService,
	wsService *websocket.WebSocketService,
) *UnifiedNotificationSystem {

	system := &UnifiedNotificationSystem{
		db:           db,
		emailService: emailService,
		wsService:    wsService,
		templates:    make(map[string]*NotificationTemplate),
		channels:     make(map[string]NotificationChannel),
		rules:        make(map[string]*NotificationRule),
		queue:        make(chan *NotificationTask, 1000),
		workers:      5,
	}

	// 注册通知渠道
	system.registerChannels()

	// 加载模板和规则
	system.loadTemplates()
	system.loadRules()

	// 启动工作器
	system.startWorkers()

	return system
}

// registerChannels 注册通知渠道
func (uns *UnifiedNotificationSystem) registerChannels() {
	// 邮件渠道
	uns.channels["email"] = &EmailChannel{
		service: uns.emailService,
		enabled: true,
	}

	// WebSocket渠道
	uns.channels["websocket"] = &WebSocketChannel{
		service: uns.wsService,
		enabled: true,
	}

	// 系统消息渠道
	uns.channels["system"] = &SystemChannel{
		db:      uns.db,
		enabled: true,
	}
}

// SendNotification 发送通知
func (uns *UnifiedNotificationSystem) SendNotification(notification *Notification) error {
	// 设置默认值
	if notification.ID == "" {
        notification.ID = gf.UUID()
	}
	if notification.CreatedAt.IsZero() {
		notification.CreatedAt = time.Now()
	}
	notification.UpdatedAt = time.Now()
	notification.Status = "pending"

	// 创建任务
	task := &NotificationTask{
		Notification: notification,
		Retry:        0,
		MaxRetry:     3,
	}

	// 加入队列
	select {
	case uns.queue <- task:
		return nil
	default:
		return fmt.Errorf("notification queue is full")
	}
}

// SendTemplateNotification 发送模板通知
func (uns *UnifiedNotificationSystem) SendTemplateNotification(
	templateID, userID string,
	data map[string]interface{},
	channels []string,
) error {

	uns.mu.RLock()
	template, exists := uns.templates[templateID]
	uns.mu.RUnlock()

	if !exists {
		return fmt.Errorf("template not found: %s", templateID)
	}

	// 渲染模板
	title, content, err := uns.renderTemplate(template, data)
	if err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	notification := &Notification{
		UserID:   userID,
		Type:     template.Type,
		Title:    title,
		Content:  content,
		Data:     data,
		Channels: channels,
		Priority: 1,
	}

	return uns.SendNotification(notification)
}

// ProcessEvent 处理事件并触发通知规则
func (uns *UnifiedNotificationSystem) ProcessEvent(eventType string, eventData map[string]interface{}) error {
	uns.mu.RLock()
	defer uns.mu.RUnlock()

	for _, rule := range uns.rules {
		if !rule.Enabled || rule.EventType != eventType {
			continue
		}

		// 检查节流
		if rule.LastTriggered != nil && time.Since(*rule.LastTriggered) < rule.Throttle {
			continue
		}

		// 检查条件
		if !uns.evaluateConditions(rule.Conditions, eventData) {
			continue
		}

		// 执行动作
		for _, action := range rule.Actions {
			if err := uns.executeAction(action, eventData); err != nil {
				glog.Error(context.Background(), "notification_action_failed", gf.Map{
					"rule_id": rule.ID,
					"action":  action.Type,
					"error":   err.Error(),
				})
			}
		}

		// 更新最后触发时间
		now := time.Now()
		rule.LastTriggered = &now
	}

	return nil
}

// evaluateConditions 评估条件
func (uns *UnifiedNotificationSystem) evaluateConditions(conditions []NotificationCondition, data map[string]interface{}) bool {
	for _, condition := range conditions {
		value, exists := data[condition.Field]
		if !exists {
			return false
		}

		if !uns.evaluateCondition(condition, value) {
			return false
		}
	}
	return true
}

// evaluateCondition 评估单个条件
func (uns *UnifiedNotificationSystem) evaluateCondition(condition NotificationCondition, value interface{}) bool {
	switch condition.Operator {
	case "eq":
		return value == condition.Value
	case "ne":
		return value != condition.Value
	case "gt":
		if v1, ok := value.(float64); ok {
			if v2, ok := condition.Value.(float64); ok {
				return v1 > v2
			}
		}
	case "lt":
		if v1, ok := value.(float64); ok {
			if v2, ok := condition.Value.(float64); ok {
				return v1 < v2
			}
		}
	case "gte":
		if v1, ok := value.(float64); ok {
			if v2, ok := condition.Value.(float64); ok {
				return v1 >= v2
			}
		}
	case "lte":
		if v1, ok := value.(float64); ok {
			if v2, ok := condition.Value.(float64); ok {
				return v1 <= v2
			}
		}
	case "contains":
		if v1, ok := value.(string); ok {
			if v2, ok := condition.Value.(string); ok {
				return fmt.Sprintf("%v", v1) == v2
			}
		}
	}
	return false
}

// executeAction 执行动作
func (uns *UnifiedNotificationSystem) executeAction(action NotificationAction, eventData map[string]interface{}) error {
	// 获取用户ID
	userID, _ := eventData["user_id"].(string)

	// 发送模板通知
	return uns.SendTemplateNotification(
		action.Template,
		userID,
		eventData,
		[]string{action.Type},
	)
}

// renderTemplate 渲染模板
func (uns *UnifiedNotificationSystem) renderTemplate(template *NotificationTemplate, data map[string]interface{}) (string, string, error) {
	// 简化的模板渲染，实际应该使用模板引擎
	title := template.Subject
	content := template.Content

	for key, value := range data {
		placeholder := fmt.Sprintf("{{.%s}}", key)
		valueStr := fmt.Sprintf("%v", value)
		title = fmt.Sprintf(title, valueStr)
		content = fmt.Sprintf(content, valueStr)
	}

	return title, content, nil
}

// startWorkers 启动工作器
func (uns *UnifiedNotificationSystem) startWorkers() {
	for i := 0; i < uns.workers; i++ {
		go uns.worker()
	}
}

// worker 工作器
func (uns *UnifiedNotificationSystem) worker() {
	for task := range uns.queue {
		uns.processTask(task)
	}
}

// processTask 处理任务
func (uns *UnifiedNotificationSystem) processTask(task *NotificationTask) {
	ctx := context.Background()
	notification := task.Notification

	// 记录开始处理
	glog.Info(ctx, "notification_processing", gf.Map{
		"notification_id": notification.ID,
		"type":            notification.Type,
		"user_id":         notification.UserID,
		"retry":           task.Retry,
	})

	success := true

	// 通过各个渠道发送
	for _, channelName := range notification.Channels {
		channel, exists := uns.channels[channelName]
		if !exists || !channel.IsEnabled() {
			continue
		}

		if err := channel.Send(ctx, notification); err != nil {
			glog.Error(ctx, "notification_channel_failed", gf.Map{
				"notification_id": notification.ID,
				"channel":         channelName,
				"error":           err.Error(),
			})
			success = false
		}
	}

	// 更新状态
	if success {
		notification.Status = "sent"
		now := time.Now()
		notification.SentAt = &now
	} else {
		notification.Status = "failed"

		// 重试
		if task.Retry < task.MaxRetry {
			task.Retry++
			time.AfterFunc(time.Duration(task.Retry)*time.Minute, func() {
				uns.queue <- task
			})
			return
		}
	}

	notification.UpdatedAt = time.Now()

	// 保存到数据库
	uns.saveNotification(notification)
}

// saveNotification 保存通知
func (uns *UnifiedNotificationSystem) saveNotification(notification *Notification) {
	// 这里应该保存到数据库
	// 简化处理
}

// loadTemplates 加载模板
func (uns *UnifiedNotificationSystem) loadTemplates() {
	// 内置模板
	templates := map[string]*NotificationTemplate{
		"token_low": {
			ID:        "token_low",
			Name:      "Token余额不足",
			Type:      "warning",
			Subject:   "Token余额不足提醒",
			Content:   "您的Token余额已不足%d个，请及时充值以免影响使用。",
			Variables: []string{"balance"},
			CreatedAt: time.Now(),
		},
		"task_completed": {
			ID:        "task_completed",
			Name:      "任务完成通知",
			Type:      "info",
			Subject:   "任务执行完成",
			Content:   "您的%s任务已执行完成，成功处理%d个项目。",
			Variables: []string{"task_type", "success_count"},
			CreatedAt: time.Now(),
		},
		"task_failed": {
			ID:        "task_failed",
			Name:      "任务失败通知",
			Type:      "error",
			Subject:   "任务执行失败",
			Content:   "您的%s任务执行失败，错误信息：%s",
			Variables: []string{"task_type", "error_message"},
			CreatedAt: time.Now(),
		},
		"plan_expired": {
			ID:        "plan_expired",
			Name:      "套餐到期提醒",
			Type:      "warning",
			Subject:   "套餐即将到期",
			Content:   "您的%s套餐将在%s到期，请及时续费。",
			Variables: []string{"plan_name", "expire_date"},
			CreatedAt: time.Now(),
		},
	}

	uns.mu.Lock()
	uns.templates = templates
	uns.mu.Unlock()
}

// loadRules 加载规则
func (uns *UnifiedNotificationSystem) loadRules() {
	// 内置规则
	rules := map[string]*NotificationRule{
		"token_low_warning": {
			ID:        "token_low_warning",
			Name:      "Token余额不足警告",
			EventType: "token.balance_low",
			Conditions: []NotificationCondition{
				{Field: "balance", Operator: "lt", Value: 100.0},
			},
			Actions: []NotificationAction{
				{
					Type:     "email",
					Template: "token_low",
				},
				{
					Type:     "websocket",
					Template: "token_low",
				},
			},
			Enabled:   true,
			Priority:  1,
			Throttle:  1 * time.Hour,
			CreatedAt: time.Now(),
		},
		"task_completion": {
			ID:         "task_completion",
			Name:       "任务完成通知",
			EventType:  "task.completed",
			Conditions: []NotificationCondition{},
			Actions: []NotificationAction{
				{
					Type:     "websocket",
					Template: "task_completed",
				},
			},
			Enabled:   true,
			Priority:  2,
			Throttle:  0,
			CreatedAt: time.Now(),
		},
	}

	uns.mu.Lock()
	uns.rules = rules
	uns.mu.Unlock()
}

// EmailChannel 实现
func (ec *EmailChannel) Send(ctx context.Context, notification *Notification) error {
	if !ec.enabled {
		return fmt.Errorf("email channel is disabled")
	}

	// 获取用户邮箱
	// 这里简化处理，实际应该从数据库获取
	userEmail := fmt.Sprintf("user_%s@example.com", notification.UserID)

	return ec.service.SendHTML(
		[]string{userEmail},
		notification.Title,
		notification.Content,
	)
}

func (ec *EmailChannel) Name() string {
	return "email"
}

func (ec *EmailChannel) IsEnabled() bool {
	return ec.enabled
}

// WebSocketChannel 实现
func (wc *WebSocketChannel) Send(ctx context.Context, notification *Notification) error {
	if !wc.enabled {
		return fmt.Errorf("websocket channel is disabled")
	}

	message := map[string]interface{}{
		"type": "notification",
		"data": map[string]interface{}{
			"id":      notification.ID,
			"title":   notification.Title,
			"content": notification.Content,
			"type":    notification.Type,
			"data":    notification.Data,
		},
	}

	return wc.service.SendToUser(notification.UserID, message)
}

func (wc *WebSocketChannel) Name() string {
	return "websocket"
}

func (wc *WebSocketChannel) IsEnabled() bool {
	return wc.enabled
}

// SystemChannel 实现
func (sc *SystemChannel) Send(ctx context.Context, notification *Notification) error {
	if !sc.enabled {
		return fmt.Errorf("system channel is disabled")
	}

	// 保存系统消息到数据库
	// 这里简化处理
	glog.Info(ctx, "system_notification_sent", gf.Map{
		"notification_id": notification.ID,
		"user_id":         notification.UserID,
		"title":           notification.Title,
	})

	return nil
}

func (sc *SystemChannel) Name() string {
	return "system"
}

func (sc *SystemChannel) IsEnabled() bool {
	return sc.enabled
}

// RegisterNotificationRoutes 注册通知系统路由
func RegisterNotificationRoutes(r *gin.RouterGroup, system *UnifiedNotificationSystem) {
	notifications := r.Group("/notifications")
	{
		// 发送通知
		notifications.POST("/send", func(c *gin.Context) {
			var notification Notification
			if err := c.ShouldBindJSON(&notification); err != nil {
				c.JSON(200, gin.H{
					"code":    1001,
					"message": "Invalid request body",
				})
				return
			}

			if err := system.SendNotification(&notification); err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code":    0,
				"message": "Notification sent successfully",
				"data":    gin.H{"id": notification.ID},
			})
		})

		// 发送模板通知
		notifications.POST("/send-template", func(c *gin.Context) {
			var req struct {
				TemplateID string                 `json:"template_id"`
				UserID     string                 `json:"user_id"`
				Data       map[string]interface{} `json:"data"`
				Channels   []string               `json:"channels"`
			}

			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(200, gin.H{
					"code":    1001,
					"message": "Invalid request body",
				})
				return
			}

			if err := system.SendTemplateNotification(req.TemplateID, req.UserID, req.Data, req.Channels); err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code":    0,
				"message": "Template notification sent successfully",
			})
		})

		// 获取模板列表
		notifications.GET("/templates", func(c *gin.Context) {
			system.mu.RLock()
			templates := make([]NotificationTemplate, 0, len(system.templates))
			for _, template := range system.templates {
				templates = append(templates, *template)
			}
			system.mu.RUnlock()

			c.JSON(200, gin.H{
				"code": 0,
				"data": templates,
			})
		})

		// 获取规则列表
		notifications.GET("/rules", func(c *gin.Context) {
			system.mu.RLock()
			rules := make([]NotificationRule, 0, len(system.rules))
			for _, rule := range system.rules {
				rules = append(rules, *rule)
			}
			system.mu.RUnlock()

			c.JSON(200, gin.H{
				"code": 0,
				"data": rules,
			})
		})

		// 处理事件
		notifications.POST("/events", func(c *gin.Context) {
			var req struct {
				EventType string                 `json:"event_type"`
				Data      map[string]interface{} `json:"data"`
			}

			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(200, gin.H{
					"code":    1001,
					"message": "Invalid request body",
				})
				return
			}

			if err := system.ProcessEvent(req.EventType, req.Data); err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code":    0,
				"message": "Event processed successfully",
			})
		})
	}
}
