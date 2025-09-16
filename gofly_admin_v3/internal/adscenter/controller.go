package adscenter

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// AdsCenterController 自动化广告控制器
type AdsCenterController struct {
    service *AdsCenterService
}

// NewAdsCenterController 创建控制器
func NewAdsCenterController(service *AdsCenterService) *AdsCenterController {
    return &AdsCenterController{
        service: service,
    }
}

// APIResponse 统一API响应格式
type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// CreateTask 创建链接更新任务
// POST /api/adscenter/create-task
func (c *AdsCenterController) CreateTask(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	var req CreateTaskRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	task, err := c.service.CreateTask(userID, &req)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "任务创建成功",
		Data:    task,
	})
}

// StartTask 启动任务执行
// POST /api/adscenter/start-task
func (c *AdsCenterController) StartTask(ctx *gin.Context) {
	var req struct {
		TaskID string `json:"task_id" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	if err := c.service.StartTask(req.TaskID); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2002,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "任务启动成功",
	})
}

// GetTask 获取任务详情
// GET /api/adscenter/task/:id
func (c *AdsCenterController) GetTask(ctx *gin.Context) {
	taskID := ctx.Param("id")
	if taskID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "任务ID不能为空",
		})
		return
	}

	task, err := c.service.GetTask(taskID)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2003,
			Message: "任务不存在",
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    task,
	})
}

// GetTaskList 获取任务列表
// GET /api/adscenter/tasks
func (c *AdsCenterController) GetTaskList(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	// 解析分页参数
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(ctx.DefaultQuery("size", "20"))

	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}

	tasks, total, err := c.service.GetUserTasks(userID, page, size)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2004,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data: gin.H{
			"tasks": tasks,
			"pagination": gin.H{
				"page":  page,
				"size":  size,
				"total": total,
				"pages": (total + int64(size) - 1) / int64(size),
			},
		},
	})
}

// CancelTask 取消任务
// POST /api/adscenter/cancel-task
func (c *AdsCenterController) CancelTask(ctx *gin.Context) {
	var req struct {
		TaskID string `json:"task_id" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	if err := c.service.CancelTask(req.TaskID); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2005,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "任务取消成功",
	})
}

// GetStats 获取统计信息
// GET /api/adscenter/stats
func (c *AdsCenterController) GetStats(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	stats, err := c.service.GetStats(userID)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2006,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    stats,
	})
}

// === 配置管理接口 ===

// CreateAdsPowerConfig 创建AdsPower配置
// POST /api/adscenter/adspower-config
func (c *AdsCenterController) CreateAdsPowerConfig(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	var req struct {
		Name        string `json:"name" binding:"required"`
		ProfileID   string `json:"profile_id" binding:"required"`
		APIEndpoint string `json:"api_endpoint" binding:"required"`
		APIKey      string `json:"api_key"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	config := &AdsPowerConfig{
		UserID:      userID,
		Name:        req.Name,
		ProfileID:   req.ProfileID,
		APIEndpoint: req.APIEndpoint,
		APIKey:      req.APIKey,
		IsActive:    true,
	}

	if err := c.service.db.Create(config).Error; err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2007,
			Message: "创建配置失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "配置创建成功",
		Data:    config,
	})
}

// CreateGoogleAdsConfig 创建Google Ads配置
// POST /api/adscenter/google-ads-config
func (c *AdsCenterController) CreateGoogleAdsConfig(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	var req struct {
		Name           string `json:"name" binding:"required"`
		CustomerID     string `json:"customer_id" binding:"required"`
		DeveloperToken string `json:"developer_token" binding:"required"`
		ClientID       string `json:"client_id" binding:"required"`
		ClientSecret   string `json:"client_secret" binding:"required"`
		RefreshToken   string `json:"refresh_token" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	config := &GoogleAdsConfig{
		UserID:         userID,
		Name:           req.Name,
		CustomerID:     req.CustomerID,
		DeveloperToken: req.DeveloperToken,
		ClientID:       req.ClientID,
		ClientSecret:   req.ClientSecret,
		RefreshToken:   req.RefreshToken,
		IsActive:       true,
	}

	if err := c.service.db.Create(config).Error; err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2008,
			Message: "创建配置失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "配置创建成功",
		Data:    config,
	})
}

// GetAdsPowerConfigs 获取AdsPower配置列表
// GET /api/chengelink/adspower-configs
func (c *AdsCenterController) GetAdsPowerConfigs(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	var configs []AdsPowerConfig
	if err := c.service.db.Where("user_id = ?", userID).Find(&configs).Error; err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2009,
			Message: "获取配置失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    configs,
	})
}

// GetGoogleAdsConfigs 获取Google Ads配置列表
// GET /api/chengelink/google-ads-configs
func (c *AdsCenterController) GetGoogleAdsConfigs(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	var configs []GoogleAdsConfig
	if err := c.service.db.Where("user_id = ?", userID).Find(&configs).Error; err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2010,
			Message: "获取配置失败: " + err.Error(),
		})
		return
	}

	// 隐藏敏感信息
	for i := range configs {
		configs[i].DeveloperToken = "***"
		configs[i].ClientSecret = "***"
		configs[i].RefreshToken = "***"
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    configs,
	})
}

// TestAdsPowerConnection 测试AdsPower连接
// POST /api/adscenter/test-adspower
func (c *AdsCenterController) TestAdsPowerConnection(ctx *gin.Context) {
	var req struct {
		APIEndpoint string `json:"api_endpoint" binding:"required"`
		APIKey      string `json:"api_key"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	var client AdsPowerClientInterface
	if req.APIEndpoint == "mock" {
		client = NewMockAdsPowerClient()
	} else {
		client = NewAdsPowerClient(req.APIEndpoint, req.APIKey)
	}

	if err := client.TestConnection(); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2011,
			Message: "连接测试失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "连接测试成功",
	})
}

// TestGoogleAdsConnection 测试Google Ads连接
// POST /api/adscenter/test-google-ads
func (c *AdsCenterController) TestGoogleAdsConnection(ctx *gin.Context) {
	var req struct {
		CustomerID     string `json:"customer_id" binding:"required"`
		DeveloperToken string `json:"developer_token" binding:"required"`
		ClientID       string `json:"client_id" binding:"required"`
		ClientSecret   string `json:"client_secret" binding:"required"`
		RefreshToken   string `json:"refresh_token" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	config := &GoogleAdsConfig{
		CustomerID:     req.CustomerID,
		DeveloperToken: req.DeveloperToken,
		ClientID:       req.ClientID,
		ClientSecret:   req.ClientSecret,
		RefreshToken:   req.RefreshToken,
	}

	var client GoogleAdsClientInterface
	if req.CustomerID == "mock" {
		client = NewMockGoogleAdsClient()
	} else {
		client = NewGoogleAdsClient(config)
	}

	if err := client.TestConnection(); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2012,
			Message: "连接测试失败: " + err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "连接测试成功",
	})
}

// RegisterRoutes 注册路由
func (c *AdsCenterController) RegisterRoutes(r *gin.RouterGroup) {
	// 任务管理
	r.POST("/create-task", c.CreateTask)
	r.POST("/start-task", c.StartTask)
	r.GET("/task/:id", c.GetTask)
	r.GET("/tasks", c.GetTaskList)
	r.POST("/cancel-task", c.CancelTask)
	r.GET("/stats", c.GetStats)

	// 配置管理
	r.POST("/adspower-config", c.CreateAdsPowerConfig)
	r.POST("/google-ads-config", c.CreateGoogleAdsConfig)
	r.GET("/adspower-configs", c.GetAdsPowerConfigs)
	r.GET("/google-ads-configs", c.GetGoogleAdsConfigs)

	// 连接测试
	r.POST("/test-adspower", c.TestAdsPowerConnection)
	r.POST("/test-google-ads", c.TestGoogleAdsConnection)
}
