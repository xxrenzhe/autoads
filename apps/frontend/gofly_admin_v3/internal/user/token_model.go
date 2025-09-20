package user

import (
	"time"
)

// TokenTransaction Token交易记录模型
type TokenTransaction struct {
	ID          string    `json:"id" gform:"primary;auto_id"`
	UserID      string    `json:"user_id" gform:"required;index"`
	Amount      int       `json:"amount" gform:"required;comment:'正数增加，负数消费'"`
	Balance     int       `json:"balance" gform:"required;comment:'变动后余额'"`
	Type        string    `json:"type" gform:"required;max_length:20;comment:'类型:purchase,checkin,invite,consume'"`
	Description string    `json:"description" gform:"max_length:200;comment:'描述'"`
	Reference   string    `json:"reference" gform:"max_length:100;comment:'关联ID(任务ID等)'"`
	CreatedAt   time.Time `json:"created_at" gform:"auto_time"`
}

// TableName 指定表名
func (TokenTransaction) TableName() string {
	return "token_transactions"
}

// TokenTransactionResponse Token交易记录响应
type TokenTransactionResponse struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Amount      int       `json:"amount"`
	Balance     int       `json:"balance"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	Reference   string    `json:"reference"`
	CreatedAt   time.Time `json:"created_at"`
}

// ToResponse 转换为响应格式
func (t *TokenTransaction) ToResponse() *TokenTransactionResponse {
	return &TokenTransactionResponse{
		ID:          t.ID,
		UserID:      t.UserID,
		Amount:      t.Amount,
		Balance:     t.Balance,
		Type:        t.Type,
		Description: t.Description,
		Reference:   t.Reference,
		CreatedAt:   t.CreatedAt,
	}
}

// Invitation 邀请记录模型
type Invitation struct {
	ID                 string    `json:"id" gform:"primary;auto_id"`
	InviterID          string    `json:"inviter_id" gform:"required;index"`
	InviteeID          string    `json:"invitee_id" gform:"required;unique"`
	InviteCode         string    `json:"invite_code" gform:"required;max_length:20"`
	Status             string    `json:"status" gform:"default:'pending';max_length:20;comment:'pending,completed'"`
	InviterRewardGiven bool      `json:"inviter_reward_given" gform:"default:false"`
	InviteeRewardGiven bool      `json:"invitee_reward_given" gform:"default:false"`
	RewardDays         int       `json:"reward_days" gform:"default:30"`
	TokenReward        int       `json:"token_reward" gform:"default:1000"`
	CreatedAt          time.Time `json:"created_at" gform:"auto_time"`
}

// TableName 指定表名
func (Invitation) TableName() string {
	return "invitations"
}

// CheckinRecord 签到记录模型
type CheckinRecord struct {
	UserID      string    `json:"user_id" gform:"primary"`
	CheckinDate time.Time `json:"checkin_date" gform:"primary;type:date"`
	TokenReward int       `json:"token_reward" gform:"default:10"`
	CreatedAt   time.Time `json:"created_at" gform:"auto_time"`
}

// TableName 指定表名
func (CheckinRecord) TableName() string {
	return "checkin_records"
}

// CheckinRecordResponse 签到记录响应
type CheckinRecordResponse struct {
	UserID      string    `json:"user_id"`
	CheckinDate time.Time `json:"checkin_date"`
	TokenReward int       `json:"token_reward"`
	CreatedAt   time.Time `json:"created_at"`
}

// ToResponse 转换为响应格式
func (c *CheckinRecord) ToResponse() *CheckinRecordResponse {
	return &CheckinRecordResponse{
		UserID:      c.UserID,
		CheckinDate: c.CheckinDate,
		TokenReward: c.TokenReward,
		CreatedAt:   c.CreatedAt,
	}
}
