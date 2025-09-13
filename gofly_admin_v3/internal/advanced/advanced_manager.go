package advanced

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/audit"
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/internal/captcha"
	"gofly-admin-v3/internal/dictionary"
	"gofly-admin-v3/internal/email"
	"gofly-admin-v3/internal/export"
	"gofly-admin-v3/internal/i18n"
	"gofly-admin-v3/internal/ratelimit"
	"gofly-admin-v3/internal/security"
	"gofly-admin-v3/internal/upload"
	"gofly-admin-v3/internal/websocket"
	"gofly-admin-v3/service/user"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/tools/glog"
	"gorm.io/gorm"
)

// AdvancedFeaturesManager 高级功能管理器
type AdvancedFeaturesManager struct {
	db    *gorm.DB
	cache *cache.Cache

	// 核心系统
	pluginSystem       *AdvancedPluginSystem
	enhancedRateLimit  *EnhancedRateLimitManager
	notificationSystem *UnifiedNotificationSystem
	securitySystem     *AdvancedSecuritySystem
	toolsIntegration   *AdvancedToolsIntegration

	// 服务依赖
	auditService      *audit.AuditService
	encryptionService *security.EncryptionService
	userService       *user.Service

	// 状态管理
	initialized bool
	mu          sync.RWMutex
}

// AdvancedFeaturesConfig 高级功能配置
type AdvancedFeaturesConfig struct {
	EnablePluginSystem       bool `json:"enable_plugin_system"`
	EnableEnhancedRateLimit  bool `json:"enable_enhanced_rate_limit"`
	EnableNotificationSystem bool `json:"enable_notification_system"`
	EnableSecuritySystem     bool `json:"enable_security_system"`
	EnableToolsIntegration   bool `json:"enable_tools_integration"`
}

// NewAdvancedFeaturesManager 创建高级功能管理器
func NewAdvancedFeaturesManager(
	db *gorm.DB,
	cache *cache.Cache,
	auditService *audit.AuditService,
	encryptionService *security.EncryptionService,
	userService *user.Service,
	baseMgr *ratelimit.RateLimitManager,
	emailService *email.EmailService,
	wsService *websocket.Service,
	exportService *export.ExcelService,
	i18nService *i18n.I18nService,
	captchaService *captcha.CaptchaService,
	dictService *dictionary.DictionaryService,
	uploadService *upload.UploadService,
) *AdvancedFeaturesManager {

	manager := &AdvancedFeaturesManager{
		db:                db,
		cache:             cache,
		auditService:      auditService,
		encryptionService: encryptionService,
		userService:       userService,
		initialized:       false,
	}

	// 初始化高级功能系统
	manager.initializeAdvancedSystems(
		baseMgr,
		emailService,
		wsService,
		exportService,
		i18nService,
		captchaService,
		dictService,
		uploadService,
	)

	return manager
}

// initializeAdvancedSystems 初始化高级系统
func (afm *AdvancedFeaturesManager) initializeAdvancedSystems(
	baseMgr *ratelimit.RateLimitManager,
	emailService *email.EmailService,
	wsService *websocket.Service,
	exportService *export.ExcelService,
	i18nService *i18n.I18nService,
	captchaService *captcha.CaptchaService,
	dictService *dictionary.DictionaryService,
	uploadService *upload.UploadService,
) {
	ctx := context.Background()

	glog.Info(ctx, "initializing_advanced_features", gf.Map{
		"systems": []string{"plugin", "rate_limit", "notification", "security", "tools"},
	})

	// 1. 初始化插件系统
	afm.pluginSystem = InitializeAdvancedPlugins(afm.db, afm.auditService)
	glog.Info(ctx, "plugin_system_initialized", gf.Map{})

	// 2. 初始化增强速率限制系统
	afm.enhancedRateLimit = NewEnhancedRateLimitManager(
		baseMgr,
		afm.db,
		*afm.cache,
	)
	glog.Info(ctx, "enhanced_rate_limit_initialized", gf.Map{})

	// 3. 初始化统一通知系统
	afm.notificationSystem = NewUnifiedNotificationSystem(
		afm.db,
		emailService,
		wsService,
	)
	glog.Info(ctx, "notification_system_initialized", gf.Map{})

	// 4. 初始化高级安全系统
	afm.securitySystem = NewAdvancedSecuritySystem(
		afm.db,
		afm.cache,
		afm.auditService,
		afm.encryptionService,
	)
	glog.Info(ctx, "security_system_initialized", gf.Map{})

	// 5. 初始化工具集成系统
	afm.toolsIntegration = NewAdvancedToolsIntegration(
		afm.db,
		exportService,
		emailService,
		i18nService,
		captchaService,
		dictService,
		uploadService,
	)
	glog.Info(ctx, "tools_integration_initialized", gf.Map{})

	// 设置系统间集成
	afm.setupSystemIntegration()

	afm.mu.Lock()
	afm.initialized = true
	afm.mu.Unlock()

	glog.Info(ctx, "advanced_features_manager_initialized", gf.Map{
		"status": "ready",
	})
}

// setupSystemIntegration 设置系统间集成
func (afm *AdvancedFeaturesManager) setupSystemIntegration() {
	ctx := context.Background()

	// 插件系统与通知系统集成
	afm.pluginSystem.RegisterHook("token.consumed", func(ctx context.Context, data interface{}) error {
		eventData, ok := data.(map[string]interface{})
		if !ok {
			return nil
		}

		// 检查Token余额是否过低
		if balance, ok := eventData["balance"].(int); ok && balance < 100 {
			return afm.notificationSystem.ProcessEvent("token.balance_low", eventData)
		}

		return nil
	})

	// 插件系统与安全系统集成
	afm.pluginSystem.RegisterHook("security.threat_detected", func(ctx context.Context, data interface{}) error {
		eventData, ok := data.(map[string]interface{})
		if !ok {
			return nil
		}

		// 发送安全警报通知
		return afm.notificationSystem.ProcessEvent("security.alert", eventData)
	})

	// 速率限制与安全系统集成
	afm.enhancedRateLimit.RegisterConfigChangeCallback("*", "*", func(oldConfig, newConfig *DynamicRateLimit) error {
		// 记录配置变更事件
		afm.pluginSystem.PublishEvent(Event{
			Type:   "rate_limit.config_changed",
			Source: "enhanced_rate_limit",
			Data: map[string]interface{}{
				"plan":      newConfig.Plan,
				"feature":   newConfig.Feature,
				"old_limit": oldConfig.BaseLimit,
				"new_limit": newConfig.BaseLimit,
			},
			Timestamp: newConfig.LastUpdated,
		})
		return nil
	})

	glog.Info(ctx, "system_integration_setup_completed", gf.Map{})
}

// GetPluginSystem 获取插件系统
func (afm *AdvancedFeaturesManager) GetPluginSystem() *AdvancedPluginSystem {
	return afm.pluginSystem
}

// GetEnhancedRateLimit 获取增强速率限制系统
func (afm *AdvancedFeaturesManager) GetEnhancedRateLimit() *EnhancedRateLimitManager {
	return afm.enhancedRateLimit
}

// GetNotificationSystem 获取通知系统
func (afm *AdvancedFeaturesManager) GetNotificationSystem() *UnifiedNotificationSystem {
	return afm.notificationSystem
}

// GetSecuritySystem 获取安全系统
func (afm *AdvancedFeaturesManager) GetSecuritySystem() *AdvancedSecuritySystem {
	return afm.securitySystem
}

// GetToolsIntegration 获取工具集成系统
func (afm *AdvancedFeaturesManager) GetToolsIntegration() *AdvancedToolsIntegration {
	return afm.toolsIntegration
}

// IsInitialized 检查是否已初始化
func (afm *AdvancedFeaturesManager) IsInitialized() bool {
	afm.mu.RLock()
	defer afm.mu.RUnlock()
	return afm.initialized
}

// ProcessUserRequest 处理用户请求（集成所有高级功能）
func (afm *AdvancedFeaturesManager) ProcessUserRequest(ctx context.Context, userID, ipAddress, userAgent string, requestData map[string]interface{}) error {
	if !afm.IsInitialized() {
		return fmt.Errorf("advanced features not initialized")
	}

	// 1. 安全分析
	securityResult, err := afm.securitySystem.AnalyzeRequest(ctx, userID, ipAddress, userAgent, requestData)
	if err != nil {
		glog.Error(ctx, "security_analysis_failed", gf.Map{
			"user_id": userID,
			"error":   err.Error(),
		})
	}

	// 2. 检查安全风险
	if securityResult != nil && securityResult.RiskScore > 0.7 {
		// 发布安全事件
		afm.pluginSystem.PublishEvent(Event{
			Type:   "security.high_risk_detected",
			Source: "advanced_features_manager",
			Data: map[string]interface{}{
				"user_id":    userID,
				"ip_address": ipAddress,
				"risk_score": securityResult.RiskScore,
				"threats":    securityResult.Threats,
			},
			UserID: userID,
		})

		// 如果风险过高，拒绝请求
		if securityResult.RiskScore > 0.9 {
			return fmt.Errorf("request blocked due to high security risk")
		}
	}

	// 3. 自适应速率限制检查
	feature := "API"
	if f, ok := requestData["feature"].(string); ok {
		feature = f
	}

	if err := afm.enhancedRateLimit.CheckAdaptiveRateLimit(ctx, userID, feature); err != nil {
		// 发布速率限制事件
		afm.pluginSystem.PublishEvent(Event{
			Type:   "rate_limit.exceeded",
			Source: "advanced_features_manager",
			Data: map[string]interface{}{
				"user_id": userID,
				"feature": feature,
				"error":   err.Error(),
			},
			UserID: userID,
		})

		return fmt.Errorf("rate limit exceeded: %w", err)
	}

	// 4. 记录请求处理成功
	afm.pluginSystem.PublishEvent(Event{
		Type:   "request.processed",
		Source: "advanced_features_manager",
		Data: map[string]interface{}{
			"user_id":    userID,
			"ip_address": ipAddress,
			"feature":    feature,
			"success":    true,
		},
		UserID: userID,
	})

	return nil
}

// GetSystemStatus 获取系统状态
func (afm *AdvancedFeaturesManager) GetSystemStatus() map[string]interface{} {
	status := map[string]interface{}{
		"initialized": afm.IsInitialized(),
		"systems":     map[string]interface{}{},
	}

	if afm.IsInitialized() {
		// 插件系统状态
		// TODO: Fix plugin system - pluginList := afm.pluginSystem.ListPlugins()
		pluginList := []map[string]interface{}{}
		status["systems"].(map[string]interface{})["plugins"] = map[string]interface{}{
			"total_plugins": len(pluginList),
			// "active_plugins": countActivePlugins(pluginList),
			"active_plugins": 0, // TODO: Fix plugins package
			"plugin_list":    pluginList,
		}

		// 速率限制系统状态
		rateLimitStats := afm.enhancedRateLimit.GetSystemStats()
		status["systems"].(map[string]interface{})["rate_limit"] = rateLimitStats

		// 通知系统状态
		status["systems"].(map[string]interface{})["notification"] = map[string]interface{}{
			"channels":  len(afm.notificationSystem.channels),
			"templates": len(afm.notificationSystem.templates),
			"rules":     len(afm.notificationSystem.rules),
		}

		// 工具集成状态
		toolsList := afm.toolsIntegration.ListTools()
		status["systems"].(map[string]interface{})["tools"] = map[string]interface{}{
			"total_tools": len(toolsList),
			"tools_list":  toolsList,
		}
	}

	return status
}

// countActivePlugins 统计活跃插件数量 - TODO: Fix plugins package
/*
func countActivePlugins(plugins []plugins.PluginMetadata) int {
	count := 0
	for _, plugin := range plugins {
		if plugin.Status == plugins.StatusRunning {
			count++
		}
	}
	return count
}
*/

// RegisterAdvancedRoutes 注册高级功能路由
func RegisterAdvancedRoutes(r *gin.RouterGroup, manager *AdvancedFeaturesManager) {
	advanced := r.Group("/advanced")
	{
		// 系统状态
		advanced.GET("/status", func(c *gin.Context) {
			status := manager.GetSystemStatus()
			c.JSON(200, gin.H{
				"code": 0,
				"data": status,
			})
		})

		// 处理用户请求（演示接口）
		advanced.POST("/process-request", func(c *gin.Context) {
			var req struct {
				UserID      string                 `json:"user_id"`
				IPAddress   string                 `json:"ip_address"`
				UserAgent   string                 `json:"user_agent"`
				RequestData map[string]interface{} `json:"request_data"`
			}

			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(200, gin.H{
					"code":    1001,
					"message": "Invalid request body",
				})
				return
			}

			if err := manager.ProcessUserRequest(
				c.Request.Context(),
				req.UserID,
				req.IPAddress,
				req.UserAgent,
				req.RequestData,
			); err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code":    0,
				"message": "Request processed successfully",
			})
		})
	}

	// 注册各子系统路由
	if manager.IsInitialized() {
		RegisterPluginRoutes(advanced, manager.GetPluginSystem())
		RegisterEnhancedRateLimitRoutes(advanced, manager.GetEnhancedRateLimit())
		RegisterNotificationRoutes(advanced, manager.GetNotificationSystem())
		RegisterSecurityRoutes(advanced, manager.GetSecuritySystem())
		RegisterToolsRoutes(advanced, manager.GetToolsIntegration())
	}
}

// AdvancedMiddleware 高级功能中间件
func AdvancedMiddleware(manager *AdvancedFeaturesManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !manager.IsInitialized() {
			c.Next()
			return
		}

		// 获取用户信息
		userID := c.GetString("user_id")
		if userID == "" {
			c.Next()
			return
		}

		// 构建请求数据
		requestData := map[string]interface{}{
			"method":    c.Request.Method,
			"path":      c.Request.URL.Path,
			"feature":   "API",
			"timestamp": time.Now(),
		}

		// 处理请求
		if err := manager.ProcessUserRequest(
			c.Request.Context(),
			userID,
			c.ClientIP(),
			c.Request.UserAgent(),
			requestData,
		); err != nil {
			c.JSON(200, gin.H{
				"code":    4003,
				"message": err.Error(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
