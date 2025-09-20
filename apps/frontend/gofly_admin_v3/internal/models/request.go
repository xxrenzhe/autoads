package models

// LoginRequest 登录请求
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email" example:"user@example.com"`
	Password string `json:"password" binding:"required,min=6,max=20" example:"password123"`
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50" example:"testuser"`
	Email    string `json:"email" binding:"required,email" example:"user@example.com"`
	Password string `json:"password" binding:"required,min=6,max=20" example:"password123"`
}

// UpdatePasswordRequest 更新密码请求
type UpdatePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required,min=6,max=20" example:"oldpass123"`
	NewPassword string `json:"new_password" binding:"required,min=6,max=20" example:"newpass123"`
}

// UpdateProfileRequest 更新用户资料请求
type UpdateProfileRequest struct {
	Username string `json:"username,omitempty" binding:"omitempty,min=3,max=50"`
	Avatar   string `json:"avatar,omitempty" binding:"url"`
	Phone    string `json:"phone,omitempty" binding:"e164_phone"`
}

// CreateManagerRequest 创建管理员请求
type CreateManagerRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50" example:"admin"`
	Password string `json:"password" binding:"required,min=6,max=20" example:"admin123"`
	Email    string `json:"email" binding:"required,email" example:"admin@example.com"`
	Role     string `json:"role" binding:"required,oneof=admin user manager" example:"admin"`
	Status   int    `json:"status" binding:"required,oneof=0 1" example:"1"`
}

// UpdateManagerRequest 更新管理员请求
type UpdateManagerRequest struct {
	Username string `json:"username,omitempty" binding:"omitempty,min=3,max=50"`
	Email    string `json:"email,omitempty" binding:"omitempty,email"`
	Role     string `json:"role,omitempty" binding:"omitempty,oneof=admin user manager"`
	Status   *int   `json:"status,omitempty" binding:"omitempty,oneof=0 1"`
}

// ResetPasswordRequest 重置密码请求
type ResetPasswordRequest struct {
	Email    string `json:"email" binding:"required,email" example:"user@example.com"`
	Code     string `json:"code" binding:"required,len=6" example:"123456"`
	Password string `json:"password" binding:"required,min=6,max=20" example:"newpass123"`
}

// SendVerificationCodeRequest 发送验证码请求
type SendVerificationCodeRequest struct {
	Email  string `json:"email" binding:"required,email" example:"user@example.com"`
	Action string `json:"action" binding:"required,oneof=register reset_password" example:"register"`
}

// QueryParams 查询参数结构
type QueryParams struct {
	Page     int    `form:"page" binding:"min=1" example:"1"`
	PageSize int    `form:"page_size" binding:"min=1,max=100" example:"10"`
	Keyword  string `form:"keyword" example:"搜索关键词"`
	Sort     string `form:"sort" example:"created_at desc"`
	Status   string `form:"status" example:"active"`
}

// IDRequest ID参数请求
type IDRequest struct {
	ID string `uri:"id" binding:"required,uuid" example:"123e4567-e89b-12d3-a456-426614174000"`
}
