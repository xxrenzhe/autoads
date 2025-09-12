package user

import (
	"time"
)

// InvitationRecord 邀请记录模型
type InvitationRecord struct {
	ID           string `json:"id" gform:"primary;auto_id"`
	InviterID    string `json:"inviter_id" gform:"required;index;comment:'邀请人ID'"`
	InviterEmail string `json:"inviter_email" gform:"required;max_length:255;comment:'邀请人邮箱'"`
	InviteeID    string `json:"invitee_id" gform:"required;index;comment:'被邀请人ID'"`
	InviteeEmail string `json:"invitee_email" gform:"required;max_length:255;comment:'被邀请人邮箱'"`
	InviteCode   string `json:"invite_code" gform:"required;max_length:20;comment:'使用的邀请码'"`

	// 奖励信息
	InviterReward int64 `json:"inviter_reward" gform:"default:0;comment:'邀请人获得Token奖励'"`
	InviteeReward int64 `json:"invitee_reward" gform:"default:0;comment:'被邀请人获得Token奖励'"`
	InviterDays   int   `json:"inviter_days" gform:"default:0;comment:'邀请人获得Pro天数'"`
	InviteeDays   int   `json:"invitee_days" gform:"default:0;comment:'被邀请人获得Pro天数'"`

	// 状态
	Status string `json:"status" gform:"default:'PENDING';max_length:20;comment:'状态(PENDING/SUCCESS/FAILED)'"`

	// 时间戳
	CreatedAt time.Time `json:"created_at" gform:"auto_time"`
	UpdatedAt time.Time `json:"updated_at" gform:"auto_update_time"`
}

// TableName 指定表名
func (InvitationRecord) TableName() string {
	return "invitation_records"
}
