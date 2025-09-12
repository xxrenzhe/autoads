package invitation

import (
	"time"
)

// User 用户模型（简化版，用于邀请系统）
type User struct {
	ID            string     `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Username      string     `json:"username" gorm:"type:varchar(100);uniqueIndex"`
	Email         string     `json:"email" gorm:"type:varchar(255);uniqueIndex"`
	InviteCode    string     `json:"invite_code" gorm:"type:varchar(20);uniqueIndex"`
	InvitedBy     *string    `json:"invited_by" gorm:"type:varchar(36)"`
	InvitedAt     *time.Time `json:"invited_at"`
	PlanName      string     `json:"plan_name" gorm:"type:varchar(20);default:'free'"`
	PlanExpiresAt *time.Time `json:"plan_expires_at"`
	TokenBalance  int        `json:"token_balance" gorm:"default:0"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}

// Invitation 邀请记录
type Invitation struct {
	ID                 string           `json:"id" gorm:"primaryKey;type:varchar(36)"`
	InviterID          string           `json:"inviter_id" gorm:"type:varchar(36);index;not null"`
	InviteeID          string           `json:"invitee_id" gorm:"type:varchar(36);uniqueIndex;not null"`
	InviteCode         string           `json:"invite_code" gorm:"type:varchar(20);not null"`
	Status             InvitationStatus `json:"status" gorm:"type:varchar(20);default:'pending'"`
	InviterRewardGiven bool             `json:"inviter_reward_given" gorm:"default:false"`
	InviteeRewardGiven bool             `json:"invitee_reward_given" gorm:"default:false"`
	RewardDays         int              `json:"reward_days" gorm:"default:30"`
	TokenReward        int              `json:"token_reward" gorm:"default:100"`
	CreatedAt          time.Time        `json:"created_at"`
}

func (Invitation) TableName() string {
	return "invitations"
}

// InvitationStatus 邀请状态
type InvitationStatus string

const (
	InvitationStatusPending   InvitationStatus = "pending"   // 等待中
	InvitationStatusCompleted InvitationStatus = "completed" // 已完成
	InvitationStatusExpired   InvitationStatus = "expired"   // 已过期
)

// InvitationStats 邀请统计
type InvitationStats struct {
	TotalInvitations      int64   `json:"total_invitations"`      // 邀请总数
	SuccessfulInvitations int64   `json:"successful_invitations"` // 成功邀请数
	SuccessRate           float64 `json:"success_rate"`           // 成功率
	TotalProDays          int     `json:"total_pro_days"`         // 获得Pro套餐天数
	TotalTokenReward      int     `json:"total_token_reward"`     // 获得Token奖励
}

// InvitationRecord 邀请记录（用于历史查询）
type InvitationRecord struct {
	ID                 string           `json:"id"`
	InviterID          string           `json:"inviter_id"`
	InviteeID          string           `json:"invitee_id"`
	InviteeUsername    string           `json:"invitee_username"`
	InviteeEmail       string           `json:"invitee_email"`
	InviteCode         string           `json:"invite_code"`
	Status             InvitationStatus `json:"status"`
	InviterRewardGiven bool             `json:"inviter_reward_given"`
	InviteeRewardGiven bool             `json:"invitee_reward_given"`
	RewardDays         int              `json:"reward_days"`
	TokenReward        int              `json:"token_reward"`
	CreatedAt          time.Time        `json:"created_at"`
}

// InvitationLeaderboardEntry 邀请排行榜条目
type InvitationLeaderboardEntry struct {
	ID               string `json:"id"`
	Username         string `json:"username"`
	Email            string `json:"email"`
	InvitationCount  int    `json:"invitation_count"`
	SuccessfulCount  int    `json:"successful_count"`
	TotalTokenReward int    `json:"total_token_reward"`
}

// CreateInvitationRequest 创建邀请请求
type CreateInvitationRequest struct {
	BaseURL string `json:"base_url" binding:"required"`
}

// InvitationResponse 邀请响应
type InvitationResponse struct {
	InviteCode string `json:"invite_code"`
	InviteLink string `json:"invite_link"`
	Message    string `json:"message"`
}

// ValidateInviteRequest 验证邀请码请求
type ValidateInviteRequest struct {
	InviteCode string `json:"invite_code" binding:"required"`
}

// ValidateInviteResponse 验证邀请码响应
type ValidateInviteResponse struct {
	Valid        bool   `json:"valid"`
	InviterName  string `json:"inviter_name,omitempty"`
	InviterEmail string `json:"inviter_email,omitempty"`
	Message      string `json:"message"`
}
