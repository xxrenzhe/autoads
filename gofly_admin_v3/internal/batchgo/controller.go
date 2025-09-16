package batchgo

import (
    "net/http"
    "strconv"
    "strings"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
)

// Controller BatchGo控制器
type Controller struct {
	service *Service
	db      *gorm.DB
}

// NewController 创建BatchGo控制器
func NewController(service *Service, db *gorm.DB) *Controller {
	return &Controller{
		service: service,
		db:      db,
	}
}

// CreateTask 创建批处理任务
// @Summary 创建批处理任务
// @Description 创建新的批处理任务
// @Tags BatchGo
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body CreateTaskRequest true "任务信息"
// @Success 200 {object} gin.H
// @Router /api/v1/batchgo/tasks [post]
func (c *Controller) CreateTask(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	var req CreateTaskRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	task, err := c.service.CreateTask(userID.(string), &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "create_failed",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "任务创建成功",
		"task":    task.ToResponse(),
	})
}

// StartTask 启动任务
// @Summary 启动批处理任务
// @Description 启动指定的批处理任务
// @Tags BatchGo
// @Security ApiKeyAuth
// @Param task_id path string true "任务ID"
// @Success 200 {object} gin.H
// @Router /api/v1/batchgo/tasks/{task_id}/start [post]
func (c *Controller) StartTask(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	taskID := ctx.Param("task_id")
	if taskID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "missing_task_id",
			"message": "任务ID不能为空",
		})
		return
	}

	err := c.service.StartTask(userID.(string), taskID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "start_failed",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "任务启动成功",
	})
}

// GetTask 获取任务详情
// @Summary 获取任务详情
// @Description 获取指定任务的详细信息
// @Tags BatchGo
// @Security ApiKeyAuth
// @Param task_id path string true "任务ID"
// @Success 200 {object} gin.H
// @Router /api/v1/batchgo/tasks/{task_id} [get]
func (c *Controller) GetTask(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	taskID := ctx.Param("task_id")
	if taskID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "missing_task_id",
			"message": "任务ID不能为空",
		})
		return
	}

	task, err := c.service.GetTask(userID.(string), taskID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error":   "task_not_found",
			"message": "任务不存在",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"task": task.ToResponse(),
	})
}

// GetTaskResult 获取任务结果
// @Summary 获取任务结果
// @Description 获取任务的执行结果
// @Tags BatchGo
// @Security ApiKeyAuth
// @Param task_id path string true "任务ID"
// @Success 200 {object} gin.H
// @Router /api/v1/batchgo/tasks/{task_id}/result [get]
func (c *Controller) GetTaskResult(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	taskID := ctx.Param("task_id")
	if taskID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "missing_task_id",
			"message": "任务ID不能为空",
		})
		return
	}

	task, err := c.service.GetTask(userID.(string), taskID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error":   "task_not_found",
			"message": "任务不存在",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"result": task.ToResult(),
	})
}

// GetTasks 获取任务列表
// @Summary 获取任务列表
// @Description 分页获取用户的批处理任务列表
// @Tags BatchGo
// @Security ApiKeyAuth
// @Param page query int false "页码" default(1)
// @Param size query int false "每页数量" default(20)
// @Success 200 {object} gin.H
// @Router /api/v1/batchgo/tasks [get]
func (c *Controller) GetTasks(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	// 获取分页参数
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(ctx.DefaultQuery("size", "20"))

	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}

	tasks, total, err := c.service.GetTasks(userID.(string), page, size)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "query_failed",
			"message": "查询任务列表失败",
		})
		return
	}

	// 转换为响应格式
	taskResponses := make([]*BatchTaskResponse, 0, len(tasks))
	for _, task := range tasks {
		taskResponses = append(taskResponses, task.ToResponse())
	}

	ctx.JSON(http.StatusOK, gin.H{
		"tasks": taskResponses,
		"total": total,
		"page":  page,
		"size":  size,
	})
}

// ===== 兼容旧API接口 =====

// SilentStart 兼容旧的Silent模式启动接口
// @Summary Silent模式启动 (兼容接口)
// @Description 兼容旧版本的Silent模式批处理接口
// @Tags BatchGo兼容
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body LegacySilentRequest true "Silent请求（向后兼容，支持 proxyUrl/Referer 字段）"
// @Success 200 {object} gin.H
// @Router /api/batchopen/silent-start [post]
func (c *Controller) SilentStart(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

    // 扩展载荷：兼容 legacy 字段并支持 proxyUrl/cycleCount/referer*
    type SilentStartPayload struct {
        LegacySilentRequest
        ProxyURL            string            `json:"proxyUrl"`
        CycleCount          int               `json:"cycleCount"`
        RefererOption       string            `json:"refererOption"`
        SelectedSocialMedia string            `json:"selectedSocialMedia"`
        CustomReferer       string            `json:"customReferer"`
        ExtraHeaders        map[string]string `json:"headers"`
    }
    var req SilentStartPayload
    if err := ctx.ShouldBindJSON(&req); err != nil {
        ctx.JSON(http.StatusBadRequest, gin.H{
            "error":   "invalid_request",
            "message": err.Error(),
        })
        return
    }

	// 转换为新的请求格式
    // 生成 Referer 头（可选）
    headers := req.Headers
    if headers == nil { headers = map[string]string{} }
    if req.RefererOption == "custom" && strings.TrimSpace(req.CustomReferer) != "" {
        headers["Referer"] = strings.TrimSpace(req.CustomReferer)
    }
    // TODO: 社媒 referer 可按 selectedSocialMedia 映射预置值，这里保留透传逻辑

    // 处理 Referer：支持社媒与自定义两类
    if req.RefererOption == "social" && strings.TrimSpace(req.SelectedSocialMedia) != "" {
        headers["Referer"] = strings.TrimSpace(req.SelectedSocialMedia)
    }

    // 推断代理开关：如提供 proxyUrl，则默认启用代理与轮训
    useProxy := req.UseProxy || (strings.TrimSpace(req.ProxyURL) != "")
    rotate := req.ProxyRotation || (strings.TrimSpace(req.ProxyURL) != "")

    newReq := &CreateTaskRequest{
        Name: "Silent批处理任务",
        Mode: ModeSilent,
        URLs: req.URLs,
        Config: BatchTaskConfig{
            Silent: &SilentConfig{
                Concurrency:   req.Concurrency,
                Timeout:       req.Timeout,
                RetryCount:    req.RetryCount,
                UseProxy:      useProxy,
                ProxyRotation: rotate,
                UserAgent:     req.UserAgent,
                Headers:       headers,
                ProxyAPI:      strings.TrimSpace(req.ProxyURL),
                RotatePerRound: rotate, // 轮训即按轮处理
            },
        },
    }
    if req.CycleCount > 0 { newReq.CycleCount = req.CycleCount } else { newReq.CycleCount = 1 }

	// 创建并启动任务
	task, err := c.service.CreateTask(userID.(string), newReq)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "create_failed",
			"message": err.Error(),
		})
		return
	}

	// 立即启动任务
	err = c.service.StartTask(userID.(string), task.ID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "start_failed",
			"message": err.Error(),
		})
		return
	}

	// 返回兼容格式的响应
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"task_id": task.ID,
		"message": "Silent任务启动成功",
		"urls":    len(req.URLs),
	})
}

// BasicStart 兼容旧的Basic模式启动接口
// @Summary Basic模式启动 (兼容接口)
// @Description 兼容旧版本的Basic模式批处理接口
// @Tags BatchGo兼容
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body LegacyBasicRequest true "Basic请求"
// @Success 200 {object} gin.H
// @Router /api/batchopen/basic-start [post]
func (c *Controller) BasicStart(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	var req LegacyBasicRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// 转换为新的请求格式
	newReq := &CreateTaskRequest{
		Name: "Basic批处理任务",
		Mode: ModeBasic,
		URLs: req.URLs,
		Config: BatchTaskConfig{
			Basic: &BasicConfig{
				Delay:      req.Delay,
				NewWindow:  req.NewWindow,
				Sequential: req.Sequential,
			},
		},
	}

	// 创建并启动任务
	task, err := c.service.CreateTask(userID.(string), newReq)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "create_failed",
			"message": err.Error(),
		})
		return
	}

	// 立即启动任务
	err = c.service.StartTask(userID.(string), task.ID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "start_failed",
			"message": err.Error(),
		})
		return
	}

	// 返回兼容格式的响应
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"task_id": task.ID,
		"message": "Basic任务启动成功",
		"urls":    len(req.URLs),
	})
}

// AutoClickStart 兼容旧的AutoClick模式启动接口
// @Summary AutoClick模式启动 (兼容接口)
// @Description 兼容旧版本的AutoClick模式批处理接口
// @Tags BatchGo兼容
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body LegacyAutoClickRequest true "AutoClick请求"
// @Success 200 {object} gin.H
// @Router /api/batchopen/autoclick-start [post]
func (c *Controller) AutoClickStart(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	var req LegacyAutoClickRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// 转换为新的请求格式
	newReq := &CreateTaskRequest{
		Name: "AutoClick批处理任务",
		Mode: ModeAutoClick,
		URLs: req.URLs,
		Config: BatchTaskConfig{
			AutoClick: &AutoClickConfig{
				StartTime:      req.StartTime,
				EndTime:        req.EndTime,
				Interval:       req.Interval,
				RandomDelay:    req.RandomDelay,
				MaxRandomDelay: req.MaxRandomDelay,
				WorkDays:       req.WorkDays,
			},
		},
	}

	// 创建并调度任务
	task, err := c.service.CreateTask(userID.(string), newReq)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "create_failed",
			"message": err.Error(),
		})
		return
	}

	// 调度任务
	err = c.service.StartTask(userID.(string), task.ID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "schedule_failed",
			"message": err.Error(),
		})
		return
	}

	// 返回兼容格式的响应
	ctx.JSON(http.StatusOK, gin.H{
		"success":        true,
		"task_id":        task.ID,
		"message":        "AutoClick任务调度成功",
		"urls":           len(req.URLs),
		"scheduled_time": task.ScheduledTime,
	})
}

// ===== 兼容请求结构 =====

// LegacySilentRequest 兼容的Silent请求
type LegacySilentRequest struct {
	URLs          []string          `json:"urls" binding:"required"`
	Concurrency   int               `json:"concurrency"`
	Timeout       int               `json:"timeout"`
	RetryCount    int               `json:"retry_count"`
	UseProxy      bool              `json:"use_proxy"`
	ProxyRotation bool              `json:"proxy_rotation"`
	UserAgent     string            `json:"user_agent"`
	Headers       map[string]string `json:"headers"`
}

// LegacyBasicRequest 兼容的Basic请求
type LegacyBasicRequest struct {
	URLs       []string `json:"urls" binding:"required"`
	Delay      int      `json:"delay"`
	NewWindow  bool     `json:"new_window"`
	Sequential bool     `json:"sequential"`
}

// LegacyAutoClickRequest 兼容的AutoClick请求
type LegacyAutoClickRequest struct {
	URLs           []string `json:"urls" binding:"required"`
	StartTime      string   `json:"start_time"`
	EndTime        string   `json:"end_time"`
	Interval       int      `json:"interval"`
	RandomDelay    bool     `json:"random_delay"`
	MaxRandomDelay int      `json:"max_random_delay"`
	WorkDays       []int    `json:"work_days"`
}
