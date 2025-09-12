package admin

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// AdminController 管理后台控制器
type AdminController struct {
	dashboardService *DashboardService
	userService      *UserService
	planService      *PlanService
	tokenService     *TokenService
}

// NewAdminController 创建管理后台控制器
func NewAdminController(
	dashboardService *DashboardService,
	userService *UserService,
	planService *PlanService,
	tokenService *TokenService,
) *AdminController {
	return &AdminController{
		dashboardService: dashboardService,
		userService:      userService,
		planService:      planService,
		tokenService:     tokenService,
	}
}

// APIResponse 统一API响应格式
type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// === 数据面板接口 ===

// GetOverviewStats 获取概览统计
// GET /api/admin/dashboard/overview
func (c *AdminController) GetOverviewStats(ctx *gin.Context) {
	stats, err := c.dashboardService.GetOverviewStats()
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
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

// GetUserTrend 获取用户增长趋势
// GET /api/admin/dashboard/user-trend?days=30
func (c *AdminController) GetUserTrend(ctx *gin.Context) {
	days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
	if days <= 0 || days > 365 {
		days = 30
	}

	trend, err := c.dashboardService.GetUserTrend(days)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2002,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    trend,
	})
}

// GetTokenTrend 获取Token使用趋势
// GET /api/admin/dashboard/token-trend?days=30
func (c *AdminController) GetTokenTrend(ctx *gin.Context) {
	days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
	if days <= 0 || days > 365 {
		days = 30
	}

	trend, err := c.dashboardService.GetTokenTrend(days)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2003,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    trend,
	})
}

// GetTaskTrend 获取任务使用趋势
// GET /api/admin/dashboard/task-trend?days=30
func (c *AdminController) GetTaskTrend(ctx *gin.Context) {
	days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
	if days <= 0 || days > 365 {
		days = 30
	}

	trend, err := c.dashboardService.GetTaskTrend(days)
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
		Data:    trend,
	})
}

// GetTopUsers 获取用户排行榜
// GET /api/admin/dashboard/top-users?limit=10
func (c *AdminController) GetTopUsers(ctx *gin.Context) {
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "10"))
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	users, err := c.dashboardService.GetTopUsers(limit)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2005,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    users,
	})
}

// GetSystemHealth 获取系统健康状态
// GET /api/admin/dashboard/system-health
func (c *AdminController) GetSystemHealth(ctx *gin.Context) {
	health, err := c.dashboardService.GetSystemHealth()
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
		Data:    health,
	})
}

// === 用户管理接口 ===

// GetUsers 获取用户列表
// GET /api/admin/users?page=1&size=20&search=keyword
func (c *AdminController) GetUsers(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(ctx.DefaultQuery("size", "20"))
	search := ctx.Query("search")

	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}

	users, total, err := c.userService.GetUsers(page, size, search)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2007,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data: gin.H{
			"users": users,
			"pagination": gin.H{
				"page":  page,
				"size":  size,
				"total": total,
				"pages": (total + int64(size) - 1) / int64(size),
			},
		},
	})
}

// GetUserDetail 获取用户详情
// GET /api/admin/users/:id
func (c *AdminController) GetUserDetail(ctx *gin.Context) {
	userID := ctx.Param("id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "用户ID不能为空",
		})
		return
	}

	detail, err := c.userService.GetUserDetail(userID)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2008,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    detail,
	})
}

// UpdateUserStatus 更新用户状态
// POST /api/admin/users/:id/status
func (c *AdminController) UpdateUserStatus(ctx *gin.Context) {
	userID := ctx.Param("id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "用户ID不能为空",
		})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	// 获取管理员ID（从JWT中获取）
	adminID := uint(1) // 这里应该从JWT中获取实际的管理员ID

	if err := c.userService.UpdateUserStatus(adminID, userID, req.Status); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2009,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "状态更新成功",
	})
}

// RechargeTokens 手动充值Token
// POST /api/admin/users/:id/recharge
func (c *AdminController) RechargeTokens(ctx *gin.Context) {
	userID := ctx.Param("id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "用户ID不能为空",
		})
		return
	}

	var req struct {
		Amount int    `json:"amount" binding:"required,min=1"`
		Reason string `json:"reason" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	// 获取管理员ID（从JWT中获取）
	adminID := uint(1) // 这里应该从JWT中获取实际的管理员ID

	if err := c.userService.RechargeTokens(adminID, userID, req.Amount, req.Reason); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2010,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "充值成功",
	})
}

// ChangePlan 更改用户套餐
// POST /api/admin/users/:id/plan
func (c *AdminController) ChangePlan(ctx *gin.Context) {
	userID := ctx.Param("id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "用户ID不能为空",
		})
		return
	}

	var req struct {
		PlanName string `json:"plan_name" binding:"required"`
		Duration int    `json:"duration" binding:"required,min=1"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	// 获取管理员ID（从JWT中获取）
	adminID := uint(1) // 这里应该从JWT中获取实际的管理员ID

	if err := c.userService.ChangePlan(adminID, userID, req.PlanName, req.Duration); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2011,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "套餐更改成功",
	})
}

// === 套餐管理接口 ===

// GetPlans 获取套餐列表
// GET /api/admin/plans
func (c *AdminController) GetPlans(ctx *gin.Context) {
	plans, err := c.planService.GetPlans()
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2012,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    plans,
	})
}

// CreatePlan 创建套餐
// POST /api/admin/plans
func (c *AdminController) CreatePlan(ctx *gin.Context) {
	var req CreatePlanRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	plan, err := c.planService.CreatePlan(&req)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2013,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "创建成功",
		Data:    plan,
	})
}

// UpdatePlan 更新套餐
// PUT /api/admin/plans/:id
func (c *AdminController) UpdatePlan(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "无效的套餐ID",
		})
		return
	}

	var req UpdatePlanRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	plan, err := c.planService.UpdatePlan(uint(id), &req)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2014,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "更新成功",
		Data:    plan,
	})
}

// TogglePlanStatus 切换套餐状态
// POST /api/admin/plans/:id/toggle
func (c *AdminController) TogglePlanStatus(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "无效的套餐ID",
		})
		return
	}

	if err := c.planService.TogglePlanStatus(uint(id)); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2015,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "状态切换成功",
	})
}

// === Token管理接口 ===

// GetTokenPackages 获取Token充值包列表
// GET /api/admin/token-packages
func (c *AdminController) GetTokenPackages(ctx *gin.Context) {
	packages, err := c.tokenService.GetTokenPackages()
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2016,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    packages,
	})
}

// CreateTokenPackage 创建Token充值包
// POST /api/admin/token-packages
func (c *AdminController) CreateTokenPackage(ctx *gin.Context) {
	var req CreateTokenPackageRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	pkg, err := c.tokenService.CreateTokenPackage(&req)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2017,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "创建成功",
		Data:    pkg,
	})
}

// GetTokenConsumptionRules 获取Token消费规则
// GET /api/admin/token-rules
func (c *AdminController) GetTokenConsumptionRules(ctx *gin.Context) {
	rules, err := c.tokenService.GetTokenConsumptionRules()
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2018,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    rules,
	})
}

// CreateTokenConsumptionRule 创建Token消费规则
// POST /api/admin/token-rules
func (c *AdminController) CreateTokenConsumptionRule(ctx *gin.Context) {
	var req CreateTokenRuleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	rule, err := c.tokenService.CreateTokenConsumptionRule(&req)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2019,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "创建成功",
		Data:    rule,
	})
}

// UpdateTokenConsumptionRule 更新Token消费规则
// PUT /api/admin/token-rules/:id
func (c *AdminController) UpdateTokenConsumptionRule(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "无效的规则ID",
		})
		return
	}

	var req UpdateTokenRuleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	rule, err := c.tokenService.UpdateTokenConsumptionRule(uint(id), &req)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2020,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "更新成功",
		Data:    rule,
	})
}

// GetInvitationRanking 获取邀请排行榜
// GET /api/admin/invitation-ranking?limit=10
func (c *AdminController) GetInvitationRanking(ctx *gin.Context) {
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "10"))
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	ranking, err := c.tokenService.GetInvitationRanking(limit)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2021,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    ranking,
	})
}

// GetTokenStats 获取Token统计信息
// GET /api/admin/token-stats
func (c *AdminController) GetTokenStats(ctx *gin.Context) {
	stats, err := c.tokenService.GetTokenStats()
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2022,
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

// RegisterRoutes 注册路由
func (c *AdminController) RegisterRoutes(r *gin.RouterGroup) {
	// 数据面板
	dashboard := r.Group("/dashboard")
	{
		dashboard.GET("/overview", c.GetOverviewStats)
		dashboard.GET("/user-trend", c.GetUserTrend)
		dashboard.GET("/token-trend", c.GetTokenTrend)
		dashboard.GET("/task-trend", c.GetTaskTrend)
		dashboard.GET("/top-users", c.GetTopUsers)
		dashboard.GET("/system-health", c.GetSystemHealth)
	}

	// 用户管理
	users := r.Group("/users")
	{
		users.GET("", c.GetUsers)
		users.GET("/:id", c.GetUserDetail)
		users.POST("/:id/status", c.UpdateUserStatus)
		users.POST("/:id/recharge", c.RechargeTokens)
		users.POST("/:id/plan", c.ChangePlan)
	}

	// 套餐管理
	plans := r.Group("/plans")
	{
		plans.GET("", c.GetPlans)
		plans.POST("", c.CreatePlan)
		plans.PUT("/:id", c.UpdatePlan)
		plans.POST("/:id/toggle", c.TogglePlanStatus)
	}

	// Token管理
	tokens := r.Group("/tokens")
	{
		tokens.GET("/packages", c.GetTokenPackages)
		tokens.POST("/packages", c.CreateTokenPackage)
		tokens.GET("/rules", c.GetTokenConsumptionRules)
		tokens.POST("/rules", c.CreateTokenConsumptionRule)
		tokens.PUT("/rules/:id", c.UpdateTokenConsumptionRule)
		tokens.GET("/stats", c.GetTokenStats)
	}

	// 邀请排行榜
	r.GET("/invitation-ranking", c.GetInvitationRanking)
}
