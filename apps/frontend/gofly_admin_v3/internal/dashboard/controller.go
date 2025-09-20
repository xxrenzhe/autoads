package dashboard

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// DashboardController 个人中心控制器
type DashboardController struct {
	service *DashboardService
}

// NewDashboardController 创建个人中心控制器
func NewDashboardController(service *DashboardService) *DashboardController {
	return &DashboardController{
		service: service,
	}
}

// APIResponse 统一API响应格式
type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// GetOverview 获取用户概览
// GET /api/dashboard/overview
func (c *DashboardController) GetOverview(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	overview, err := c.service.GetUserOverview(userID)
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
		Data:    overview,
	})
}

// GetTabs 获取标签页配置
// GET /api/dashboard/tabs
func (c *DashboardController) GetTabs(ctx *gin.Context) {
	tabs := GetDashboardTabs()

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "获取成功",
		Data:    tabs,
	})
}

// UpdateProfile 更新用户资料
// PUT /api/dashboard/profile
func (c *DashboardController) UpdateProfile(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	var req UpdateProfileRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	if err := c.service.UpdateUserProfile(userID, &req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2002,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "更新成功",
	})
}

// GetSubscriptionHistory 获取订阅历史
// GET /api/dashboard/subscription/history
func (c *DashboardController) GetSubscriptionHistory(ctx *gin.Context) {
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

	records, total, err := c.service.GetSubscriptionHistory(userID, page, size)
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
		Data: gin.H{
			"records": records,
			"pagination": gin.H{
				"page":  page,
				"size":  size,
				"total": total,
				"pages": (total + int64(size) - 1) / int64(size),
			},
		},
	})
}

// GetUsageStats 获取使用统计
// GET /api/dashboard/usage/stats
func (c *DashboardController) GetUsageStats(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	// 解析天数参数
	days, _ := strconv.Atoi(ctx.DefaultQuery("days", "30"))
	if days < 1 || days > 365 {
		days = 30
	}

	stats, err := c.service.GetUsageStats(userID, days)
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
		Data:    stats,
	})
}

// GetRecentActivities 获取最近活动
// GET /api/dashboard/activities
func (c *DashboardController) GetRecentActivities(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	// 解析限制参数
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "20"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	activities, err := c.service.GetRecentActivities(userID, limit)
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
		Data:    activities,
	})
}

// GetUserInfo 获取用户基本信息
// GET /api/dashboard/user/info
func (c *DashboardController) GetUserInfo(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	overview, err := c.service.GetUserOverview(userID)
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
		Data:    overview.UserInfo,
	})
}

// GetPlanInfo 获取套餐信息
// GET /api/dashboard/plan/info
func (c *DashboardController) GetPlanInfo(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	overview, err := c.service.GetUserOverview(userID)
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
		Data:    overview.PlanInfo,
	})
}

// GetDailyStats 获取今日统计
// GET /api/dashboard/stats/daily
func (c *DashboardController) GetDailyStats(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	overview, err := c.service.GetUserOverview(userID)
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
		Data:    overview.TodayStats,
	})
}

// GetMonthlyStats 获取月度统计
// GET /api/dashboard/stats/monthly
func (c *DashboardController) GetMonthlyStats(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	overview, err := c.service.GetUserOverview(userID)
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
		Data:    overview.MonthlyStats,
	})
}

// RegisterRoutes 注册路由
func (c *DashboardController) RegisterRoutes(r *gin.RouterGroup) {
	// 概览相关
	r.GET("/overview", c.GetOverview)
	r.GET("/tabs", c.GetTabs)

	// 用户信息相关
	r.GET("/user/info", c.GetUserInfo)
	r.PUT("/profile", c.UpdateProfile)

	// 套餐相关
	r.GET("/plan/info", c.GetPlanInfo)
	r.GET("/subscription/history", c.GetSubscriptionHistory)

	// 统计相关
	r.GET("/stats/daily", c.GetDailyStats)
	r.GET("/stats/monthly", c.GetMonthlyStats)
	r.GET("/usage/stats", c.GetUsageStats)

	// 活动相关
	r.GET("/activities", c.GetRecentActivities)
}
