package invitation

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// InvitationController 邀请控制器
type InvitationController struct {
	service *InvitationService
}

// NewInvitationController 创建邀请控制器
func NewInvitationController(service *InvitationService) *InvitationController {
	return &InvitationController{
		service: service,
	}
}

// APIResponse 统一API响应格式
type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// GenerateInviteLink 生成邀请链接
// POST /api/invitation/generate-link
func (c *InvitationController) GenerateInviteLink(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	var req CreateInvitationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	// 生成邀请链接
	inviteLink, err := c.service.GetInviteLink(userID, req.BaseURL)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: err.Error(),
		})
		return
	}

	// 获取邀请码
	inviteCode, err := c.service.GenerateInviteCode(userID)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2002,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "邀请链接生成成功",
		Data: InvitationResponse{
			InviteCode: inviteCode,
			InviteLink: inviteLink,
			Message:    "分享此链接邀请好友注册，双方都可获得30天Pro套餐和Token奖励",
		},
	})
}

// ValidateInviteCode 验证邀请码
// POST /api/invitation/validate
func (c *InvitationController) ValidateInviteCode(ctx *gin.Context) {
	var req ValidateInviteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	inviter, err := c.service.ValidateInviteCode(req.InviteCode)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    0,
			Message: "验证完成",
			Data: ValidateInviteResponse{
				Valid:   false,
				Message: err.Error(),
			},
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "验证完成",
		Data: ValidateInviteResponse{
			Valid:        true,
			InviterName:  inviter.Username,
			InviterEmail: inviter.Email,
			Message:      "邀请码有效，注册后可获得30天Pro套餐",
		},
	})
}

// GetInvitationInfo 获取邀请信息
// GET /api/invitation/info
func (c *InvitationController) GetInvitationInfo(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	// 获取邀请码
	inviteCode, err := c.service.GenerateInviteCode(userID)
	if err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: err.Error(),
		})
		return
	}

	// 获取邀请统计
	stats, err := c.service.GetInvitationStats(userID)
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
		Data: gin.H{
			"invite_code": inviteCode,
			"stats":       stats,
		},
	})
}

// GetInvitationHistory 获取邀请历史
// GET /api/invitation/history
func (c *InvitationController) GetInvitationHistory(ctx *gin.Context) {
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

	records, total, err := c.service.GetInvitationHistory(userID, page, size)
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

// GetInvitationStats 获取邀请统计
// GET /api/invitation/stats
func (c *InvitationController) GetInvitationStats(ctx *gin.Context) {
	userID := ctx.GetString("user_id")
	if userID == "" {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    3001,
			Message: "用户未认证",
		})
		return
	}

	stats, err := c.service.GetInvitationStats(userID)
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

// ProcessInvitation 处理邀请注册（内部接口，由注册流程调用）
// POST /api/invitation/process
func (c *InvitationController) ProcessInvitation(ctx *gin.Context) {
	var req struct {
		InviteCode string `json:"invite_code"`
		NewUserID  string `json:"new_user_id" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    1001,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	if err := c.service.ProcessInvitation(req.InviteCode, req.NewUserID); err != nil {
		ctx.JSON(http.StatusOK, APIResponse{
			Code:    2001,
			Message: err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "邀请处理成功",
	})
}

// GetInvitationLeaderboard 获取邀请排行榜（管理员接口）
// GET /api/invitation/leaderboard
func (c *InvitationController) GetInvitationLeaderboard(ctx *gin.Context) {
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "50"))
	if limit < 1 || limit > 100 {
		limit = 50
	}

	entries, err := c.service.GetInvitationLeaderboard(limit)
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
func (c *InvitationController) RegisterRoutes(r *gin.RouterGroup) {
	r.POST("/generate-link", c.GenerateInviteLink)
	r.POST("/validate", c.ValidateInviteCode)
	r.GET("/info", c.GetInvitationInfo)
	r.GET("/history", c.GetInvitationHistory)
	r.GET("/stats", c.GetInvitationStats)
	r.POST("/process", c.ProcessInvitation)
	r.GET("/leaderboard", c.GetInvitationLeaderboard)
}
