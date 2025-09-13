//go:build autoads_batchgo_advanced

package batchgo

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/utils/gf"
)

// EnhancedController 增强的BatchGo控制器
type EnhancedController struct {
	service *EnhancedService
}

// NewEnhancedController 创建增强控制器
func NewEnhancedController(db *store.DB, redis *store.Redis) *EnhancedController {
	return &EnhancedController{
		service: NewEnhancedService(db, redis),
	}
}

// StartEnhancedTask 启动增强任务
// @Summary 启动增强BatchGo任务
// @Description 支持Basic/Silent/Automated三种模式
// @Tags BatchGo
// @Security ApiKeyAuth
// @Param id path string true "任务ID"
// @Param mode query string true "执行模式(basic/silent/automated)"
// @Success 200 {object} gf.Response
// @Router /api/v1/batchgo/tasks/{id}/start-enhanced [post]
func (c *EnhancedController) StartEnhancedTask(ctx *gin.Context) {
	taskID := ctx.Param("id")
	userID := ctx.MustGet("user_id").(string)
	mode := ctx.DefaultQuery("mode", "basic")

	// 验证模式
	if mode != "basic" && mode != "silent" && mode != "automated" {
		gf.Failed().SetMsg("无效的执行模式").Regin(ctx)
		return
	}

	// 启动增强任务
	if err := c.service.StartEnhancedTask(taskID, userID, mode); err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetData(gf.Map{
		"message": "任务已开始执行",
		"mode":    mode,
	}).Regin(ctx)
}

// AddProxy 添加代理
// @Summary 添加代理
// @Description 添加代理到代理池
// @Tags BatchGo
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body ProxyRequest true "代理请求"
// @Success 200 {object} gf.Response
// @Router /api/v1/batchgo/proxies [post]
func (c *EnhancedController) AddProxy(ctx *gin.Context) {
	var req ProxyRequest
	if err := ctx.ShouldBind(&req); err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	// 添加代理
	c.service.proxyPool.AddProxy(req.Proxy)

	gf.Success().SetData(gf.Map{
		"message": "代理添加成功",
	}).Regin(ctx)
}

// ListProxies 获取代理列表
// @Summary 获取代理列表
// @Description 获取当前代理池中的代理列表
// @Tags BatchGo
// @Security ApiKeyAuth
// @Success 200 {object} gf.Response
// @Router /api/v1/batchgo/proxies [get]
func (c *EnhancedController) ListProxies(ctx *gin.Context) {
	proxies := c.service.proxyPool.proxies

	gf.Success().SetData(gf.Map{
		"proxies": proxies,
		"count":   len(proxies),
	}).Regin(ctx)
}

// GetModePermissions 获取模式权限
// @Summary 获取模式权限
// @Description 获取当前用户支持的执行模式
// @Tags BatchGo
// @Security ApiKeyAuth
// @Success 200 {object} gf.Response
// @Router /api/v1/batchgo/permissions [get]
func (c *EnhancedController) GetModePermissions(ctx *gin.Context) {
	_ = ctx.MustGet("user_id").(string)
	// 简化：默认仅支持 basic，其他根据实际付费策略再开放
	permissions := map[string]bool{
		"basic":     true,
		"silent":    false,
		"automated": false,
	}

	gf.Success().SetData(gf.Map{
		"subscription": "free",
		"permissions":  permissions,
	}).Regin(ctx)
}

// GetRunningTasks 获取运行中的任务
// @Summary 获取运行中的任务
// @Description 获取当前正在运行的任务列表
// @Tags BatchGo
// @Security ApiKeyAuth
// @Success 200 {object} gf.Response
// @Router /api/v1/batchgo/running-tasks [get]
func (c *EnhancedController) GetRunningTasks(ctx *gin.Context) {
	userID := ctx.MustGet("user_id").(string)

	// 获取运行中的任务
	c.service.mu.RLock()
	resp := make([]gf.Map, 0)
	for _, runner := range c.service.runningTasks {
		if runner.task.UserID == userID {
			resp = append(resp, gf.Map{
				"id":         runner.task.ID,
				"name":       runner.task.Name,
				"status":     runner.task.Status,
				"created_at": runner.task.CreatedAt,
				"updated_at": runner.task.UpdatedAt,
			})
		}
	}
	c.service.mu.RUnlock()

	gf.Success().SetData(gf.Map{
		"running_tasks": resp,
		"count":         len(resp),
	}).Regin(ctx)
}

// StopAllTasks 停止所有任务
// @Summary 停止所有任务
// @Description 停止当前用户的所有运行中的任务
// @Tags BatchGo
// @Security ApiKeyAuth
// @Success 200 {object} gf.Response
// @Router /api/v1/batchgo/stop-all [post]
func (c *EnhancedController) StopAllTasks(ctx *gin.Context) {
	userID := ctx.MustGet("user_id").(string)

	// 停止所有任务
	c.service.mu.RLock()
	stoppedCount := 0
	for _, runner := range c.service.runningTasks {
		if runner.task.UserID == userID {
			runner.Cancel()
			stoppedCount++
		}
	}
	c.service.mu.RUnlock()

	gf.Success().SetData(gf.Map{
		"message":      "所有任务已停止",
		"stoppedCount": stoppedCount,
	}).Regin(ctx)
}

// ClearCompletedTasks 清理已完成的任务
// @Summary 清理已完成的任务
// @Description 清理已完成的任务（保留最近30天）
// @Tags BatchGo
// @Security ApiKeyAuth
// @Success 200 {object} gf.Response
// @Router /api/v1/batchgo/clear-completed [post]
func (c *EnhancedController) ClearCompletedTasks(ctx *gin.Context) {
	userID := ctx.MustGet("user_id").(string)

	// 删除30天前的已完成任务
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	result := c.service.db.Where("user_id = ? AND status IN (?, ?) AND completed_at < ?",
		userID, "completed", "completed_with_errors", thirtyDaysAgo).
		Delete(&BatchTask{})

	if result.Error != nil {
		gf.Failed().SetMsg("清理任务失败").Regin(ctx)
		return
	}

	gf.Success().SetData(gf.Map{
		"message": "任务清理成功",
		"count":   result.RowsAffected,
	}).Regin(ctx)
}

// GetTaskProgress 获取任务进度
// @Summary 获取任务进度
// @Description 获取任务的实时执行进度
// @Tags BatchGo
// @Security ApiKeyAuth
// @Param id path string true "任务ID"
// @Success 200 {object} gf.Response
// @Router /api/v1/batchgo/tasks/{id}/progress [get]
func (c *EnhancedController) GetTaskProgress(ctx *gin.Context) {
	taskID := ctx.Param("id")
	userID := ctx.MustGet("user_id").(string)

	// 获取任务
	task, err := c.service.GetTask(userID, taskID)
	if err != nil {
		gf.Failed().SetMsg("任务不存在").Regin(ctx)
		return
	}

	// 检查权限
	if task.UserID != userID {
		gf.Failed().SetCode(http.StatusForbidden).SetMsg("无权限访问此任务").Regin(ctx)
		return
	}

	// 获取最新的进度信息
	progress := map[string]interface{}{
		"task_id":      task.ID,
		"status":       string(task.Status),
		"processed":    task.ProcessedCount,
		"success_urls": task.SuccessCount,
		"failed_urls":  task.FailedCount,
		"total_urls":   task.URLCount,
		"started_at":   task.StartTime,
		"completed_at": task.EndTime,
		"error":        task.ErrorMessage,
	}

	// 如果任务正在运行，获取更多详细信息
	if string(task.Status) == "running" || string(task.Status) == "RUNNING" {
		c.service.mu.RLock()
		if runner, exists := c.service.runningTasks[taskID]; exists {
			progress["worker_id"] = runner.workerID
			progress["mode"] = runner.mode
		}
		c.service.mu.RUnlock()
	}

	gf.Success().SetData(gf.Map{
		"progress": progress,
	}).Regin(ctx)
}

// ProxyRequest 代理请求
type ProxyRequest struct {
	Proxy string `json:"proxy" binding:"required" validate:"url"`
}
