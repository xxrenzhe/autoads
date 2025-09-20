package user

import (
	"time"
)

// User 用户模型（基于GoFly ORM）- 扩展SaaS功能
type User struct {
	ID           string `json:"id" gform:"primary;auto_id"`
	Email        string `json:"email" gform:"unique;required;index"`
	Username     string `json:"username" gform:"max_length:100"` // 增加长度限制
	PasswordHash string `json:"-" gform:"max_length:255"`
	AvatarURL    string `json:"avatar_url" gform:"max_length:500"`
	Role         string `json:"role" gform:"default:'user';max_length:20"`     // 改为小写
	Status       string `json:"status" gform:"default:'active';max_length:20"` // 改为小写
	TokenBalance int    `json:"token_balance" gform:"default:0"`               // 改为int类型

	// 套餐相关字段
	PlanID        *string    `json:"plan_id" gform:"max_length:50;comment:'当前套餐ID'"`
	PlanName      string     `json:"plan_name" gform:"default:'free';max_length:20;comment:'套餐名称(free/pro/max)'"`
	PlanExpiresAt *time.Time `json:"plan_expires_at" gform:"comment:'套餐过期时间'"`

	// 试用相关字段
	TrialStartAt *time.Time `json:"trial_start_at" gform:"comment:'试用开始时间'"`
	TrialEndAt   *time.Time `json:"trial_end_at" gform:"comment:'试用结束时间'"`
	TrialSource  string     `json:"trial_source" gform:"max_length:50;comment:'试用来源'"`
	TrialUsed    bool       `json:"trial_used" gform:"default:false;comment:'是否已使用过试用'"`

	// OAuth相关字段
	GoogleID    string `json:"google_id" gform:"max_length:100;unique;comment:'Google用户ID'"`
	GoogleEmail string `json:"google_email" gform:"max_length:255;comment:'Google邮箱'"`

	// 邀请系统
	InviteCode string     `json:"invite_code" gform:"max_length:20;unique;comment:'邀请码'"`
	InvitedBy  *string    `json:"invited_by" gform:"max_length:36;comment:'邀请人ID'"`
	InvitedAt  *time.Time `json:"invited_at" gform:"comment:'被邀请时间'"`

	// 邮箱验证
	EmailVerified bool `json:"email_verified" gform:"default:false"`

	// 登录相关
	LastLoginAt *time.Time `json:"last_login_at" gform:"comment:'最后登录时间'"`
	LastLoginIP string     `json:"last_login_ip" gform:"max_length:45;comment:'最后登录IP'"`

	// 个人信息扩展
	Name     string `json:"name" gform:"max_length:100;comment:'真实姓名'"`
	Company  string `json:"company" gform:"max_length:200;comment:'公司名称'"`
	Timezone string `json:"timezone" gform:"max_length:50;default:'Asia/Shanghai';comment:'时区'"`
	Language string `json:"language" gform:"max_length:10;default:'zh-CN';comment:'语言'"`

	// 时间戳
	CreatedAt time.Time  `json:"created_at" gform:"auto_time"`
	UpdatedAt time.Time  `json:"updated_at" gform:"auto_update_time"`
	DeletedAt *time.Time `json:"-" gform:"soft_delete;index"`
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Email    string `json:"email" v:"required|email#请输入邮箱|邮箱格式不正确"`
	Password string `json:"password" v:"required|length:6,20#请输入密码|密码长度6-20位"`
	Username string `json:"username" v:"required|min:2#请输入用户名|用户名至少2个字符"`
	Source   string `json:"source" v:"in:email,google#注册来源"` // email 或 google
}

// LoginRequest 登录请求
type LoginRequest struct {
	Email    string `json:"email" v:"required|email#请输入邮箱|邮箱格式不正确"`
	Password string `json:"password" v:"required#请输入密码"`
}

// GoogleLoginRequest Google登录请求
type GoogleLoginRequest struct {
	IDToken string `json:"id_token" v:"required#Google ID Token不能为空"`
}

// UpdateProfileRequest 更新个人信息
type UpdateProfileRequest struct {
	Username  string `json:"username" v:"required|min:2#请输入用户名|用户名至少2个字符"`
	AvatarURL string `json:"avatar_url"`
}

// ChangePasswordRequest 修改密码
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" v:"required#请输入原密码"`
	NewPassword string `json:"new_password" v:"required|length:6,20#请输入新密码|密码长度6-20位"`
}

// UserResponse 用户信息响应
type UserResponse struct {
	ID            string     `json:"id"`
	Email         string     `json:"email"`
	Username      string     `json:"username"`
	AvatarURL     string     `json:"avatar_url"`
	Role          string     `json:"role"`
	Status        string     `json:"status"`
	TokenBalance  int        `json:"token_balance"`
	PlanID        *string    `json:"plan_id"`
	PlanName      string     `json:"plan_name"`
	PlanExpiresAt *time.Time `json:"plan_expires_at"`
	EmailVerified bool       `json:"email_verified"`
	CreatedAt     time.Time  `json:"created_at"`
}

// ToResponse 转换为响应格式
func (u *User) ToResponse() *UserResponse {
	return &UserResponse{
		ID:            u.ID,
		Email:         u.Email,
		Username:      u.Username,
		AvatarURL:     u.AvatarURL,
		Role:          u.Role,
		Status:        u.Status,
		TokenBalance:  u.TokenBalance,
		PlanID:        u.PlanID,
		PlanName:      u.PlanName,
		PlanExpiresAt: u.PlanExpiresAt,
		EmailVerified: u.EmailVerified,
		CreatedAt:     u.CreatedAt,
	}
}

// IsExpired 检查用户是否过期（试用或套餐）
func (u *User) IsExpired() bool {
	if u.PlanExpiresAt == nil {
		return false
	}
	return time.Now().After(*u.PlanExpiresAt)
}

// HasActiveTrial 检查是否有有效的试用期
func (u *User) HasActiveTrial() bool {
	if u.TrialEndAt == nil {
		return false
	}
	return time.Now().Before(*u.TrialEndAt)
}

// CanUseFeature 检查用户是否可以使用某个功能
func (u *User) CanUseFeature(feature string) bool {
	// 管理员可以使用所有功能
	if u.Role == "ADMIN" {
		return true
	}

	// 根据套餐和功能权限判断
	switch u.PlanName {
	case "FREE":
		return feature == "BATCHGO_BASIC" || feature == "SITERANKGO_BASIC"
	case "PRO":
		return feature != "BATCHGO_ADVANCED"
	case "MAX":
		return true
	default:
		return false
	}
}
