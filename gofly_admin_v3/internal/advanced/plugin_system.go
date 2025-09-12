package advanced

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/audit"
	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/tools/glog"
	"gorm.io/gorm"
)

// AdvancedPluginSystem 高级插件系统
type AdvancedPluginSystem struct {
	plugins      map[string]Plugin
	auditService *audit.AuditService
	db           *gorm.DB
	eventBus     *EventBus
	hooks        map[string][]HookFunc
	mu           sync.RWMutex
}

// HookFunc 钩子函数类型
type HookFunc func(ctx context.Context, data interface{}) error

// EventBus 事件总线
type EventBus struct {
	subscribers map[string][]chan Event
	mu          sync.RWMutex
}

// Event 事件
type Event struct {
	Type      string                 `json:"type"`
	Source    string                 `json:"source"`
	Data      map[string]interface{} `json:"data"`
	Timestamp time.Time              `json:"timestamp"`
	UserID    string                 `json:"user_id,omitempty"`
}

// NewAdvancedPluginSystem 创建高级插件系统
func NewAdvancedPluginSystem(db *gorm.DB, auditService *audit.AuditService) *AdvancedPluginSystem {
	return &AdvancedPluginSystem{
		pluginManager: plugins.GetPluginManager(),
		auditService:  auditService,
		db:            db,
		eventBus:      NewEventBus(),
		hooks:         make(map[string][]HookFunc),
	}
}

// NewEventBus 创建事件总线
func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[string][]chan Event),
	}
}

// RegisterHook 注册钩子
func (aps *AdvancedPluginSystem) RegisterHook(event string, hook HookFunc) {
	aps.mu.Lock()
	defer aps.mu.Unlock()

	aps.hooks[event] = append(aps.hooks[event], hook)

	glog.Info(context.Background(), "hook_registered", gf.Map{
		"event":       event,
		"total_hooks": len(aps.hooks[event]),
	})
}

// ExecuteHooks 执行钩子
func (aps *AdvancedPluginSystem) ExecuteHooks(ctx context.Context, event string, data interface{}) error {
	aps.mu.RLock()
	hooks := aps.hooks[event]
	aps.mu.RUnlock()

	for _, hook := range hooks {
		if err := hook(ctx, data); err != nil {
			glog.Error(ctx, "hook_execution_failed", gf.Map{
				"event": event,
				"error": err.Error(),
			})
			return err
		}
	}

	return nil
}

// PublishEvent 发布事件
func (aps *AdvancedPluginSystem) PublishEvent(event Event) {
	// 发布到事件总线
	aps.eventBus.Publish(event.Type, event)

	// 执行钩子
	ctx := context.Background()
	if err := aps.ExecuteHooks(ctx, event.Type, event.Data); err != nil {
		glog.Error(ctx, "event_hook_failed", gf.Map{
			"event_type": event.Type,
			"error":      err.Error(),
		})
	}

	// 记录审计日志
	if aps.auditService != nil && event.UserID != "" {
		aps.auditService.LogUserAction(
			event.UserID,
			"event_triggered",
			"system",
			event.Type,
			event.Data,
			"",
			"",
			true,
			"",
			0,
		)
	}
}

// Subscribe 订阅事件
func (eb *EventBus) Subscribe(eventType string) <-chan Event {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	ch := make(chan Event, 100)
	eb.subscribers[eventType] = append(eb.subscribers[eventType], ch)

	return ch
}

// Publish 发布事件
func (eb *EventBus) Publish(eventType string, event Event) {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	if subscribers, exists := eb.subscribers[eventType]; exists {
		for _, ch := range subscribers {
			select {
			case ch <- event:
			default:
				// Channel full, skip
			}
		}
	}
}

// AutoAdsPlugin AutoAds插件基类
type AutoAdsPlugin struct {
	name        string
	version     string
	description string
	author      string
	config      map[string]interface{}
	status      plugins.PluginStatus
	system      *AdvancedPluginSystem
}

// NewAutoAdsPlugin 创建AutoAds插件
func NewAutoAdsPlugin(name, version, description, author string, system *AdvancedPluginSystem) *AutoAdsPlugin {
	return &AutoAdsPlugin{
		name:        name,
		version:     version,
		description: description,
		author:      author,
		config:      make(map[string]interface{}),
		status:      plugins.StatusDisabled,
		system:      system,
	}
}

// Name 插件名称
func (p *AutoAdsPlugin) Name() string {
	return p.name
}

// Version 插件版本
func (p *AutoAdsPlugin) Version() string {
	return p.version
}

// Description 插件描述
func (p *AutoAdsPlugin) Description() string {
	return p.description
}

// Author 插件作者
func (p *AutoAdsPlugin) Author() string {
	return p.author
}

// Status 插件状态
func (p *AutoAdsPlugin) Status() plugins.PluginStatus {
	return p.status
}

// GetConfig 获取配置
func (p *AutoAdsPlugin) GetConfig() interface{} {
	return p.config
}

// SetConfig 设置配置
func (p *AutoAdsPlugin) SetConfig(config interface{}) error {
	if cfg, ok := config.(map[string]interface{}); ok {
		p.config = cfg
		return nil
	}
	return fmt.Errorf("invalid config type")
}

// Dependencies 依赖
func (p *AutoAdsPlugin) Dependencies() []string {
	return []string{}
}

// Initialize 初始化
func (p *AutoAdsPlugin) Initialize() error {
	p.status = plugins.StatusEnabled
	return nil
}

// Start 启动
func (p *AutoAdsPlugin) Start() error {
	p.status = plugins.StatusRunning
	return nil
}

// Stop 停止
func (p *AutoAdsPlugin) Stop() error {
	p.status = plugins.StatusStopped
	return nil
}

// RegisterRoutes 注册路由
func (p *AutoAdsPlugin) RegisterRoutes() error {
	return nil
}

// RegisterMiddleware 注册中间件
func (p *AutoAdsPlugin) RegisterMiddleware() error {
	return nil
}

// TokenConsumptionPlugin Token消费监控插件
type TokenConsumptionPlugin struct {
	*AutoAdsPlugin
}

// NewTokenConsumptionPlugin 创建Token消费监控插件
func NewTokenConsumptionPlugin(system *AdvancedPluginSystem) *TokenConsumptionPlugin {
	base := NewAutoAdsPlugin(
		"token_consumption_monitor",
		"1.0.0",
		"Token消费监控和分析插件",
		"AutoAds Team",
		system,
	)

	plugin := &TokenConsumptionPlugin{
		AutoAdsPlugin: base,
	}

	// 注册Token消费事件钩子
	system.RegisterHook("token.consumed", plugin.onTokenConsumed)
	system.RegisterHook("token.recharged", plugin.onTokenRecharged)

	return plugin
}

// onTokenConsumed Token消费事件处理
func (p *TokenConsumptionPlugin) onTokenConsumed(ctx context.Context, data interface{}) error {
	eventData, ok := data.(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid event data")
	}

	userID := eventData["user_id"].(string)
	amount := eventData["amount"].(int)
	service := eventData["service"].(string)

	// 检查异常消费
	if amount > 1000 {
		// 发布异常消费事件
		p.system.PublishEvent(Event{
			Type:   "token.abnormal_consumption",
			Source: "token_consumption_plugin",
			Data: map[string]interface{}{
				"user_id": userID,
				"amount":  amount,
				"service": service,
				"reason":  "large_consumption",
			},
			Timestamp: time.Now(),
			UserID:    userID,
		})
	}

	glog.Info(ctx, "token_consumed_monitored", gf.Map{
		"user_id": userID,
		"amount":  amount,
		"service": service,
	})

	return nil
}

// onTokenRecharged Token充值事件处理
func (p *TokenConsumptionPlugin) onTokenRecharged(ctx context.Context, data interface{}) error {
	eventData, ok := data.(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid event data")
	}

	userID := eventData["user_id"].(string)
	amount := eventData["amount"].(int)

	glog.Info(ctx, "token_recharged_monitored", gf.Map{
		"user_id": userID,
		"amount":  amount,
	})

	return nil
}

// TaskMonitorPlugin 任务监控插件
type TaskMonitorPlugin struct {
	*AutoAdsPlugin
}

// NewTaskMonitorPlugin 创建任务监控插件
func NewTaskMonitorPlugin(system *AdvancedPluginSystem) *TaskMonitorPlugin {
	base := NewAutoAdsPlugin(
		"task_monitor",
		"1.0.0",
		"任务执行监控和性能分析插件",
		"AutoAds Team",
		system,
	)

	plugin := &TaskMonitorPlugin{
		AutoAdsPlugin: base,
	}

	// 注册任务事件钩子
	system.RegisterHook("task.started", plugin.onTaskStarted)
	system.RegisterHook("task.completed", plugin.onTaskCompleted)
	system.RegisterHook("task.failed", plugin.onTaskFailed)

	return plugin
}

// onTaskStarted 任务开始事件处理
func (p *TaskMonitorPlugin) onTaskStarted(ctx context.Context, data interface{}) error {
	eventData, ok := data.(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid event data")
	}

	taskID := eventData["task_id"].(string)
	taskType := eventData["task_type"].(string)
	userID := eventData["user_id"].(string)

	glog.Info(ctx, "task_started_monitored", gf.Map{
		"task_id":   taskID,
		"task_type": taskType,
		"user_id":   userID,
	})

	return nil
}

// onTaskCompleted 任务完成事件处理
func (p *TaskMonitorPlugin) onTaskCompleted(ctx context.Context, data interface{}) error {
	eventData, ok := data.(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid event data")
	}

	taskID := eventData["task_id"].(string)
	taskType := eventData["task_type"].(string)
	userID := eventData["user_id"].(string)
	duration := eventData["duration"].(time.Duration)

	// 检查任务执行时间异常
	if duration > 30*time.Minute {
		p.system.PublishEvent(Event{
			Type:   "task.long_running",
			Source: "task_monitor_plugin",
			Data: map[string]interface{}{
				"task_id":   taskID,
				"task_type": taskType,
				"user_id":   userID,
				"duration":  duration.String(),
			},
			Timestamp: time.Now(),
			UserID:    userID,
		})
	}

	glog.Info(ctx, "task_completed_monitored", gf.Map{
		"task_id":   taskID,
		"task_type": taskType,
		"user_id":   userID,
		"duration":  duration.String(),
	})

	return nil
}

// onTaskFailed 任务失败事件处理
func (p *TaskMonitorPlugin) onTaskFailed(ctx context.Context, data interface{}) error {
	eventData, ok := data.(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid event data")
	}

	taskID := eventData["task_id"].(string)
	taskType := eventData["task_type"].(string)
	userID := eventData["user_id"].(string)
	errorMsg := eventData["error"].(string)

	// 发布任务失败事件
	p.system.PublishEvent(Event{
		Type:   "task.failure_analysis",
		Source: "task_monitor_plugin",
		Data: map[string]interface{}{
			"task_id":   taskID,
			"task_type": taskType,
			"user_id":   userID,
			"error":     errorMsg,
		},
		Timestamp: time.Now(),
		UserID:    userID,
	})

	glog.Error(ctx, "task_failed_monitored", gf.Map{
		"task_id":   taskID,
		"task_type": taskType,
		"user_id":   userID,
		"error":     errorMsg,
	})

	return nil
}

// InitializeAdvancedPlugins 初始化高级插件
func InitializeAdvancedPlugins(db *gorm.DB, auditService *audit.AuditService) *AdvancedPluginSystem {
	system := NewAdvancedPluginSystem(db, auditService)

	// 注册内置插件
	tokenPlugin := NewTokenConsumptionPlugin(system)
	taskPlugin := NewTaskMonitorPlugin(system)

	// 注册到插件管理器
	system.pluginManager.RegisterPlugin(tokenPlugin)
	system.pluginManager.RegisterPlugin(taskPlugin)

	// 启用插件
	system.pluginManager.EnablePlugin("token_consumption_monitor")
	system.pluginManager.EnablePlugin("task_monitor")

	glog.Info(context.Background(), "advanced_plugins_initialized", gf.Map{
		"plugins": []string{"token_consumption_monitor", "task_monitor"},
	})

	return system
}

// RegisterPluginRoutes 注册插件管理路由
func RegisterPluginRoutes(r *gin.RouterGroup, system *AdvancedPluginSystem) {
	plugins := r.Group("/plugins")
	{
		plugins.GET("/list", func(c *gin.Context) {
			pluginList := system.pluginManager.ListPlugins()
			c.JSON(200, gin.H{
				"code": 0,
				"data": pluginList,
			})
		})

		plugins.POST("/:name/enable", func(c *gin.Context) {
			name := c.Param("name")
			if err := system.pluginManager.EnablePlugin(name); err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code":    0,
				"message": "Plugin enabled successfully",
			})
		})

		plugins.POST("/:name/disable", func(c *gin.Context) {
			name := c.Param("name")
			if err := system.pluginManager.DisablePlugin(name); err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code":    0,
				"message": "Plugin disabled successfully",
			})
		})

		plugins.GET("/:name/status", func(c *gin.Context) {
			name := c.Param("name")
			status, err := system.pluginManager.GetPluginStatus(name)
			if err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code": 0,
				"data": gin.H{
					"name":   name,
					"status": status,
				},
			})
		})
	}
}
