package user

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/utils/gf"
)

// RegisterRequest 注册请求
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Username string `json:"username"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// UpdateProfileRequest 更新资料请求
type UpdateProfileRequest struct {
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// Controller 用户控制器
type Controller struct {
	service *Service
}

// NewController 创建用户控制器
func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

// Register 用户注册
func (c *Controller) Register(ctx *gin.Context) {
	var req RegisterRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		gf.Failed().SetMsg("参数错误").Regin(ctx)
		return
	}

	user, err := c.service.Register(&req)
	if err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetData(user).Regin(ctx)
}

// Login 用户登录
func (c *Controller) Login(ctx *gin.Context) {
	var req LoginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		gf.Failed().SetMsg("参数错误").Regin(ctx)
		return
	}

	user, token, err := c.service.Login(req.Email, req.Password)
	if err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetData(gf.Map{
		"user":  user,
		"token": token,
	}).Regin(ctx)
}

// Profile 获取用户信息
func (c *Controller) Profile(ctx *gin.Context) {
	userID := ctx.GetHeader("X-User-ID")
	if userID == "" {
		gf.Failed().SetMsg("用户ID不能为空").Regin(ctx)
		return
	}

	user, err := c.service.GetUserByID(userID)
	if err != nil {
		gf.Failed().SetMsg("用户不存在").Regin(ctx)
		return
	}

	gf.Success().SetData(user).Regin(ctx)
}

// UpdateProfile 更新用户资料
func (c *Controller) UpdateProfile(ctx *gin.Context) {
	userID := ctx.GetHeader("X-User-ID")
	if userID == "" {
		gf.Failed().SetMsg("用户ID不能为空").Regin(ctx)
		return
	}

	var req UpdateProfileRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		gf.Failed().SetMsg("参数错误").Regin(ctx)
		return
	}

	user, err := c.service.UpdateProfile(userID, &req)
	if err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetData(user).Regin(ctx)
}

// ChangePassword 修改密码
func (c *Controller) ChangePassword(ctx *gin.Context) {
	userID := ctx.GetHeader("X-User-ID")
	if userID == "" {
		gf.Failed().SetMsg("用户ID不能为空").Regin(ctx)
		return
	}

	var req ChangePasswordRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		gf.Failed().SetMsg("参数错误").Regin(ctx)
		return
	}

	err := c.service.ChangePassword(userID, req.OldPassword, req.NewPassword)
	if err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetMsg("密码修改成功").Regin(ctx)
}

// StartTrial 开始试用
func (c *Controller) StartTrial(ctx *gin.Context) {
	userID := ctx.GetHeader("X-User-ID")
	if userID == "" {
		gf.Failed().SetMsg("用户ID不能为空").Regin(ctx)
		return
	}

	err := c.service.StartTrial(userID)
	if err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetMsg("试用已开始").Regin(ctx)
}

// RefreshToken 刷新令牌
func (c *Controller) RefreshToken(ctx *gin.Context) {
	userID := ctx.GetHeader("X-User-ID")
	if userID == "" {
		gf.Failed().SetMsg("用户ID不能为空").Regin(ctx)
		return
	}

	token, err := c.service.RefreshToken(userID)
	if err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetData(gf.Map{"token": token}).Regin(ctx)
}

// Logout 登出
func (c *Controller) Logout(ctx *gin.Context) {
	userID := ctx.GetHeader("X-User-ID")
	if userID == "" {
		gf.Failed().SetMsg("用户ID不能为空").Regin(ctx)
		return
	}

	err := c.service.Logout(userID)
	if err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetMsg("登出成功").Regin(ctx)
}

// GoogleLogin Google登录
func (c *Controller) GoogleLogin(ctx *gin.Context) {
	// TODO: 实现Google OAuth登录
	ctx.JSON(http.StatusOK, gin.H{
		"message": "Google登录功能待实现",
	})
}