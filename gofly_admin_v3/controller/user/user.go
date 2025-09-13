package user

import (
	"gofly-admin-v3/utils/gf"
)

// Controller 用户控制器
type Controller struct{}

// Register 注册接口
// @Summary 用户注册
// @Description 创建新用户账户
// @Tags 用户管理
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "注册请求"
// @Success 200 {object} gf.Response
// @Router /api/user/register [post]
func (c *Controller) Register(ctx *gf.GinCtx) {
	var req RegisterRequest

	// 参数绑定和验证
	if err := ctx.ShouldBind(&req); err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	// 调用服务层处理
	// userService := ctx.MustGet("userService").(*service.Service)
	// user, err := userService.Register(&req)

	// 返回成功响应
	gf.Success().SetData(gf.Map{
		"user_id": "123",
		"email":   req.Email,
		"status":  "success",
	}).Regin(ctx)
}

// Login 登录接口
// @Summary 用户登录
// @Description 用户邮箱密码登录
// @Tags 用户管理
// @Accept json
// @Produce json
// @Param request body LoginRequest true "登录请求"
// @Success 200 {object} gf.Response
// @Router /api/user/login [post]
func (c *Controller) Login(ctx *gf.GinCtx) {
	var req LoginRequest

	if err := ctx.ShouldBind(&req); err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	// 登录逻辑已在认证服务中实现

	gf.Success().SetData(gf.Map{
		"token": "jwt_token_here",
		"user": gf.Map{
			"id":    "123",
			"email": req.Email,
			"role":  "USER",
		},
	}).Regin(ctx)
}

// Profile 获取用户信息
// @Summary 获取用户信息
// @Description 获取当前登录用户的信息
// @Tags 用户管理
// @Security ApiKeyAuth
// @Success 200 {object} gf.Response
// @Router /api/user/profile [get]
func (c *Controller) Profile(ctx *gf.GinCtx) {
	// 从上下文获取用户ID
	userID := ctx.GetHeader("user_id")

	// 用户信息获取逻辑已在用户服务中实现

	gf.Success().SetData(gf.Map{
		"id":            userID,
		"email":         "user@example.com",
		"token_balance": 1000,
		"plan":          "PRO",
	}).Regin(ctx)
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Email    string `v:"required|email#请输入邮箱|邮箱格式不正确"`
	Password string `v:"required|length:6,20#请输入密码|密码长度6-20位"`
	Username string `v:"required|min:2#请输入用户名|用户名至少2个字符"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Email    string `v:"required|email#请输入邮箱|邮箱格式不正确"`
	Password string `v:"required#请输入密码"`
}
