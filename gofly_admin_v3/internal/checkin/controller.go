package checkin

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// CheckinController 签到控制器
type CheckinController struct {
	service *CheckinService
}

// NewCheckinController 创建签到控制器
func NewCheckinController(service *CheckinService) *CheckinController {
	return &CheckinController{
		service: service,
	}
}

// APIResponse 统一API响应格式
type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// PerformCheckin 执行签到
// POST /api/checkin/perform
func (c *CheckinController) PerformCheckin(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	result, err := c.service.PerformCheckin(userID)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: result.Message,
		Data:    result,
	})
}

// GetCheckinInfo 获取签到信息
// GET /api/checkin/info
func (c *CheckinController) GetCheckinInfo(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	status, err := c.service.GetCheckinStatus(userID)
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
		Data:    status,
	})
}

// GetCheckinCalendar 获取签到日历
// GET /api/checkin/calendar
func (c *CheckinController) GetCheckinCalendar(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	var req GetCalendarRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		// 如果没有提供年月参数，使用当前年月
		now := time.Now()
		req.Year = now.Year()
		req.Month = int(now.Month())
	}

	calendar, err := c.service.GetCheckinCalendar(userID, req.Year, req.Month)
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
		Data:    calendar,
	})
}

// GetCheckinHistory 获取签到历史
// GET /api/checkin/history
func (c *CheckinController) GetCheckinHistory(ctx *gin.Context) {
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

	records, total, err := c.service.GetCheckinHistory(userID, page, size)
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

// GetCheckinStats 获取签到统计
// GET /api/checkin/stats
func (c *CheckinController) GetCheckinStats(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	stats, err := c.service.GetCheckinStats(userID)
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

// GetCheckinLeaderboard 获取签到排行榜（管理员接口）
// GET /api/checkin/leaderboard
func (c *CheckinController) GetCheckinLeaderboard(ctx *gin.Context) {
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "50"))
	if limit < 1 || limit > 100 {
		limit = 50
	}

	entries, err := c.service.GetCheckinLeaderboard(limit)
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
		Data:    entries,
	})
}

// RegisterRoutes 注册路由
func (c *CheckinController) RegisterRoutes(r *gin.RouterGroup) {
	r.POST("/perform", c.PerformCheckin)
	r.GET("/info", c.GetCheckinInfo)
	r.GET("/calendar", c.GetCheckinCalendar)
	r.GET("/history", c.GetCheckinHistory)
	r.GET("/stats", c.GetCheckinStats)
	r.GET("/leaderboard", c.GetCheckinLeaderboard)
}
