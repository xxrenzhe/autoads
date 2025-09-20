//go:build autoads_siterank_advanced

package siterankgo

import (
	"strconv"

	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/internal/user"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/gjson"
	"gofly-admin-v3/utils/tools/gstr"
)

// SiteRankGoController SiteRankGo控制器（基于GoFly框架）
type SiteRankGoController struct {
	Service *Service
}

// NewGoFlySiteRankGoService 创建GoFly版本的SiteRankGo服务
func NewGoFlySiteRankGoService(db *store.DB, redis *store.Redis) *Service {
	return NewService(db)
}

// CreateTask 创建排名任务
// @Summary 创建排名任务
// @Description 创建新的网站排名监控任务
// @Tags SiteRankGo
// @Accept json
// @Produce json
// @Param request body CreateTaskRequest true "任务信息"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/tasks [post]
func (c *SiteRankGoController) CreateTask(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	var req CreateTaskRequest
	if err := ctx.ShouldBind(&req); err != nil {
		ctx.Error(err)
		return
	}

	// 创建任务
	task, err := c.Service.CreateTask(userID, &req)
	if err != nil {
		ctx.Error(err)
		return
	}

	ctx.Success(task.ToResponse())
}

// GetTask 获取任务详情
// @Summary 获取任务详情
// @Description 根据任务ID获取任务详细信息
// @Tags SiteRankGo
// @Produce json
// @Param task_id path string true "任务ID"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/tasks/{task_id} [get]
func (c *SiteRankGoController) GetTask(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	taskID := ctx.Param("task_id")
	if taskID == "" {
		ctx.Error(gf.ErrBadRequest)
		return
	}

	// 获取任务
	task, err := c.Service.GetTaskByID(taskID)
	if err != nil {
		ctx.Error(gf.ErrNotFound)
		return
	}

	// 检查权限
	if task.UserID != userID {
		ctx.Error(gf.ErrForbidden)
		return
	}

	ctx.Success(task.ToResponse())
}

// GetTaskList 获取任务列表
// @Summary 获取任务列表
// @Description 分页获取当前用户的任务列表
// @Tags SiteRankGo
// @Produce json
// @Param page query int false "页码" default(1)
// @Param size query int false "每页数量" default(20)
// @Param status query string false "状态过滤"
// @Param search_engine query string false "搜索引擎过滤"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/tasks [get]
func (c *SiteRankGoController) GetTaskList(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	// 获取分页参数
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(ctx.DefaultQuery("size", "20"))

	// 构建过滤条件
	filters := make(map[string]interface{})
	if status := ctx.Query("status"); status != "" {
		filters["status"] = status
	}
	if searchEngine := ctx.Query("search_engine"); searchEngine != "" {
		filters["search_engine"] = searchEngine
	}

	// 获取任务列表
	tasks, total, err := c.Service.GetTaskList(userID, page, size, filters)
	if err != nil {
		ctx.Error(err)
		return
	}

	// 转换为响应格式
	taskResponses := make([]*SiteRankTaskResponse, 0, len(tasks))
	for _, task := range tasks {
		taskResponses = append(taskResponses, task.ToResponse())
	}

	ctx.Success(gf.Map{
		"tasks": taskResponses,
		"total": total,
		"page":  page,
		"size":  size,
	})
}

// UpdateTask 更新任务
// @Summary 更新任务
// @Description 更新任务配置或状态
// @Tags SiteRankGo
// @Accept json
// @Produce json
// @Param task_id path string true "任务ID"
// @Param request body UpdateTaskRequest true "更新信息"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/tasks/{task_id} [put]
func (c *SiteRankGoController) UpdateTask(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	taskID := ctx.Param("task_id")
	if taskID == "" {
		ctx.Error(gf.ErrBadRequest)
		return
	}

	var req UpdateTaskRequest
	if err := ctx.ShouldBind(&req); err != nil {
		ctx.Error(err)
		return
	}

	// 更新任务
	task, err := c.Service.UpdateTask(taskID, &req)
	if err != nil {
		ctx.Error(err)
		return
	}

	// 检查权限
	if task.UserID != userID {
		ctx.Error(gf.ErrForbidden)
		return
	}

	ctx.Success(task.ToResponse())
}

// DeleteTask 删除任务
// @Summary 删除任务
// @Description 删除指定的任务
// @Tags SiteRankGo
// @Produce json
// @Param task_id path string true "任务ID"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/tasks/{task_id} [delete]
func (c *SiteRankGoController) DeleteTask(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	taskID := ctx.Param("task_id")
	if taskID == "" {
		ctx.Error(gf.ErrBadRequest)
		return
	}

	// 获取任务以验证权限
	task, err := c.Service.GetTaskByID(taskID)
	if err != nil {
		ctx.Error(gf.ErrNotFound)
		return
	}

	// 检查权限
	if task.UserID != userID {
		ctx.Error(gf.ErrForbidden)
		return
	}

	// 删除任务
	if err := c.Service.DeleteTask(taskID); err != nil {
		ctx.Error(err)
		return
	}

	ctx.Success(gf.Map{
		"message": "任务删除成功",
	})
}

// StartTask 启动任务
// @Summary 启动任务
// @Description 启动指定的任务
// @Tags SiteRankGo
// @Produce json
// @Param task_id path string true "任务ID"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/tasks/{task_id}/start [post]
func (c *SiteRankGoController) StartTask(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	taskID := ctx.Param("task_id")
	if taskID == "" {
		ctx.Error(gf.ErrBadRequest)
		return
	}

	// 获取任务以验证权限
	task, err := c.Service.GetTaskByID(taskID)
	if err != nil {
		ctx.Error(gf.ErrNotFound)
		return
	}

	// 检查权限
	if task.UserID != userID {
		ctx.Error(gf.ErrForbidden)
		return
	}

	// 启动任务
	if err := c.Service.StartTask(taskID); err != nil {
		ctx.Error(err)
		return
	}

	ctx.Success(gf.Map{
		"message": "任务启动成功",
	})
}

// StopTask 停止任务
// @Summary 停止任务
// @Description 停止正在运行的任务
// @Tags SiteRankGo
// @Produce json
// @Param task_id path string true "任务ID"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/tasks/{task_id}/stop [post]
func (c *SiteRankGoController) StopTask(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	taskID := ctx.Param("task_id")
	if taskID == "" {
		ctx.Error(gf.ErrBadRequest)
		return
	}

	// 获取任务以验证权限
	task, err := c.Service.GetTaskByID(taskID)
	if err != nil {
		ctx.Error(gf.ErrNotFound)
		return
	}

	// 检查权限
	if task.UserID != userID {
		ctx.Error(gf.ErrForbidden)
		return
	}

	// 停止任务
	if err := c.Service.StopTask(taskID); err != nil {
		ctx.Error(err)
		return
	}

	ctx.Success(gf.Map{
		"message": "任务停止成功",
	})
}

// GetTaskResults 获取任务结果
// @Summary 获取任务结果
// @Description 获取任务的执行结果详情
// @Tags SiteRankGo
// @Produce json
// @Param task_id path string true "任务ID"
// @Param page query int false "页码" default(1)
// @Param size query int false "每页数量" default(50)
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/tasks/{task_id}/results [get]
func (c *SiteRankGoController) GetTaskResults(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	taskID := ctx.Param("task_id")
	if taskID == "" {
		ctx.Error(gf.ErrBadRequest)
		return
	}

	// 获取任务以验证权限
	task, err := c.Service.GetTaskByID(taskID)
	if err != nil {
		ctx.Error(gf.ErrNotFound)
		return
	}

	// 检查权限
	if task.UserID != userID {
		ctx.Error(gf.ErrForbidden)
		return
	}

	// 获取分页参数
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(ctx.DefaultQuery("size", "50"))

	// 获取任务结果
	results, total, err := c.Service.GetTaskResults(taskID, page, size)
	if err != nil {
		ctx.Error(err)
		return
	}

	ctx.Success(gf.Map{
		"results": results,
		"total":   total,
		"page":    page,
		"size":    size,
	})
}

// GetRankingHistory 获取排名历史
// @Summary 获取排名历史
// @Description 获取指定关键词的排名历史数据
// @Tags SiteRankGo
// @Produce json
// @Param task_id path string true "任务ID"
// @Param keyword query string true "关键词"
// @Param days query int false "天数" default(30)
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/tasks/{task_id}/history [get]
func (c *SiteRankGoController) GetRankingHistory(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	taskID := ctx.Param("task_id")
	if taskID == "" {
		ctx.Error(gf.ErrBadRequest)
		return
	}

	keyword := ctx.Query("keyword")
	if keyword == "" {
		ctx.Error(gf.ErrBadRequest)
		return
	}

	// 获取任务以验证权限
	task, err := c.Service.GetTaskByID(taskID)
	if err != nil {
		ctx.Error(gf.ErrNotFound)
		return
	}

	// 检查权限
	if task.UserID != userID {
		ctx.Error(gf.ErrForbidden)
		return
	}

	// 获取天数参数
	days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
	if days <= 0 {
		days = 30
	}

	// 获取排名历史
	history, err := c.Service.GetRankingHistory(taskID, keyword, days)
	if err != nil {
		ctx.Error(err)
		return
	}

	ctx.Success(gf.Map{
		"history": history,
		"keyword": keyword,
		"days":    days,
	})
}

// GetTaskStats 获取任务统计
// @Summary 获取任务统计
// @Description 获取当前用户的任务统计信息
// @Tags SiteRankGo
// @Produce json
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/stats [get]
func (c *SiteRankGoController) GetTaskStats(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	// TODO: 实现任务统计
	stats := gf.Map{
		"total_tasks":     0,
		"pending_tasks":   0,
		"running_tasks":   0,
		"completed_tasks": 0,
		"failed_tasks":    0,
		"total_keywords":  0,
		"avg_position":    0,
		"improved_count":  0,
		"declined_count":  0,
		"total_tokens":    0,
	}

	ctx.Success(stats)
}

// GetWebsiteTrafficData 获取网站流量数据
// @Summary 获取网站流量数据
// @Description 通过SimilarWeb API获取网站的流量和排名数据
// @Tags SiteRankGo
// @Produce json
// @Param domain query string true "域名"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/traffic [get]
func (c *SiteRankGoController) GetWebsiteTrafficData(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	domain := ctx.Query("domain")
	if domain == "" {
		ctx.Error(gf.ErrBadRequest)
		return
	}

	// 获取流量数据
	data, err := c.Service.GetWebsiteTrafficData(ctx, userID, domain)
	if err != nil {
		ctx.Error(err)
		return
	}

	ctx.Success(data)
}

// BatchGetTrafficData 批量获取网站流量数据
// @Summary 批量获取网站流量数据
// @Description 批量查询多个域名的流量数据
// @Tags SiteRankGo
// @Accept json
// @Produce json
// @Param request body BatchTrafficRequest true "批量查询请求"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/traffic/batch [post]
func (c *SiteRankGoController) BatchGetTrafficData(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	var req BatchTrafficRequest
	if err := ctx.ShouldBind(&req); err != nil {
		ctx.Error(err)
		return
	}

	// 验证域名数量
	if len(req.Domains) > 10 {
		ctx.Error(gform.Errorf("批量查询最多支持10个域名"))
		return
	}

	// 检查用户权限和Token余额
	userSvc := user.NewService(c.Service.db)
	userInfo, err := userSvc.GetUserByID(userID)
	if err != nil {
		ctx.Error(gf.ErrNotFound)
		return
	}

	tokenCost := int64(len(req.Domains) * 100) // 每个域名100 Token
	if userInfo.TokenBalance < tokenCost {
		ctx.Error(gform.Errorf("Token余额不足，需要%d个Token", tokenCost))
		return
	}

	// 批量获取数据
	results := make(map[string]interface{})
	for _, domain := range req.Domains {
		data, err := c.Service.GetWebsiteTrafficData(ctx, userID, domain)
		if err != nil {
			results[domain] = gform.Map{
				"error": err.Error(),
			}
		} else {
			results[domain] = data
		}
	}

	ctx.Success(gf.Map{
		"results": results,
		"count":   len(req.Domains),
	})
}

// GetTrafficHistory 获取流量查询历史
// @Summary 获取流量查询历史
// @Description 获取指定域名的流量查询历史记录
// @Tags SiteRankGo
// @Produce json
// @Param domain query string true "域名"
// @Param days query int false "天数" default(30)
// @Success 200 {object} gf.Response
// @Router /api/v1/siterankgo/traffic/history [get]
func (c *SiteRankGoController) GetTrafficHistory(ctx *gf.GinCtx) {
	userID := ctx.Get("user_id")
	if userID == "" {
		ctx.Error(gf.ErrUnauthorized)
		return
	}

	domain := ctx.Query("domain")
	if domain == "" {
		ctx.Error(gf.ErrBadRequest)
		return
	}

	days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
	if days > 90 {
		days = 90
	}

	// 获取历史记录
	history, err := c.Service.GetTrafficHistory(userID, domain, days)
	if err != nil {
		ctx.Error(err)
		return
	}

	ctx.Success(gf.Map{
		"history": history,
		"domain":  domain,
		"days":    days,
	})
}

// BatchTrafficRequest 批量流量查询请求
type BatchTrafficRequest struct {
	Domains []string `json:"domains" v:"required|min:1|max:10#请输入域名列表(最多10个)"`
}
