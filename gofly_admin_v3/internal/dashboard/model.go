package dashboard

import (
	"time"
)

// User 用户模型（简化版，用于个人中心）
type User struct {
	ID            string     `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Username      string     `json:"username" gorm:"type:varchar(100);uniqueIndex"`
	Email         string     `json:"email" gorm:"type:varchar(255);uniqueIndex"`
	Name          string     `json:"name" gorm:"type:varchar(100)"`
	Company       string     `json:"company" gorm:"type:varchar(200)"`
	AvatarURL     string     `json:"avatar_url" gorm:"type:varchar(500)"`
	Timezone      string     `json:"timezone" gorm:"type:varchar(50);default:'Asia/Shanghai'"`
	Language      string     `json:"language" gorm:"type:varchar(10);default:'zh-CN'"`
	PlanName      string     `json:"plan_name" gorm:"type:varchar(20);default:'free'"`
	PlanExpiresAt *time.Time `json:"plan_expires_at"`
	TokenBalance  int        `json:"token_balance" gorm:"default:0"`
	LastLoginAt   *time.Time `json:"last_login_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}

// UserOverview 用户概览
type UserOverview struct {
	UserInfo     UserInfo     `json:"user_info"`
	PlanInfo     PlanInfo     `json:"plan_info"`
	TokenBalance int          `json:"token_balance"`
	TodayStats   DailyStats   `json:"today_stats"`
	MonthlyStats MonthlyStats `json:"monthly_stats"`
}

// UserInfo 用户基本信息
type UserInfo struct {
	ID          string     `json:"id"`
	Username    string     `json:"username"`
	Email       string     `json:"email"`
	Name        string     `json:"name"`
	Company     string     `json:"company"`
	AvatarURL   string     `json:"avatar_url"`
	Timezone    string     `json:"timezone"`
	Language    string     `json:"language"`
	CreatedAt   time.Time  `json:"created_at"`
	LastLoginAt *time.Time `json:"last_login_at"`
}

// PlanInfo 套餐信息
type PlanInfo struct {
	PlanName  string        `json:"plan_name"`
	IsActive  bool          `json:"is_active"`
	DaysLeft  int           `json:"days_left"`
	ExpiresAt *time.Time    `json:"expires_at"`
	Features  []PlanFeature `json:"features"`
}

// PlanFeature 套餐功能
type PlanFeature struct {
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
	Limit   string `json:"limit"`
}

// DailyStats 每日统计
type DailyStats struct {
	Date            string `json:"date"`
	TokensConsumed  int    `json:"tokens_consumed"`
	BatchTasks      int    `json:"batch_tasks"`
	SiteRankQueries int    `json:"siterank_queries"`
	ChengeLinkTasks int    `json:"chengelink_tasks"`
	CheckedIn       bool   `json:"checked_in"`
}

// MonthlyStats 月度统计
type MonthlyStats struct {
	Year            int `json:"year"`
	Month           int `json:"month"`
	TokensConsumed  int `json:"tokens_consumed"`
	BatchTasks      int `json:"batch_tasks"`
	SiteRankQueries int `json:"siterank_queries"`
	ChengeLinkTasks int `json:"chengelink_tasks"`
	CheckinDays     int `json:"checkin_days"`
}

// UpdateProfileRequest 更新用户资料请求
type UpdateProfileRequest struct {
	Name      *string `json:"name"`
	Company   *string `json:"company"`
	AvatarURL *string `json:"avatar_url"`
	Timezone  *string `json:"timezone"`
	Language  *string `json:"language"`
}

// SubscriptionRecord 订阅记录
type SubscriptionRecord struct {
	ID        string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
	UserID    string    `json:"user_id" gorm:"type:varchar(36);index"`
	PlanName  string    `json:"plan_name" gorm:"type:varchar(20)"`
	Source    string    `json:"source" gorm:"type:varchar(50)"` // trial, invitation, purchase
	Days      int       `json:"days"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

func (SubscriptionRecord) TableName() string {
	return "subscription_records"
}

// UsageStats 使用统计
type UsageStats struct {
	Period     string            `json:"period"`
	StartDate  string            `json:"start_date"`
	EndDate    string            `json:"end_date"`
	TokenTrend []DailyTokenUsage `json:"token_trend"`
	TaskTrend  []DailyTaskUsage  `json:"task_trend"`
}

// DailyTokenUsage 每日Token使用情况
type DailyTokenUsage struct {
	Date           string `json:"date"`
	TokensEarned   int    `json:"tokens_earned"`
	TokensConsumed int    `json:"tokens_consumed"`
}

// DailyTaskUsage 每日任务使用情况
type DailyTaskUsage struct {
	Date            string `json:"date"`
	BatchTasks      int    `json:"batch_tasks"`
	SiteRankQueries int    `json:"siterank_queries"`
	ChengeLinkTasks int    `json:"chengelink_tasks"`
}

// ActivityRecord 活动记录
type ActivityRecord struct {
	Type        string    `json:"type"` // token, task, system
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// TokenTransaction Token交易记录（引用）
type TokenTransaction struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Amount      int       `json:"amount"`
	Balance     int       `json:"balance"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	Reference   string    `json:"reference"`
	CreatedAt   time.Time `json:"created_at"`
}

func (TokenTransaction) TableName() string {
	return "token_transactions"
}

// TokenStats Token统计（引用）
type TokenStats struct {
	TotalEarned    int `json:"total_earned"`
	TotalConsumed  int `json:"total_consumed"`
	CurrentBalance int `json:"current_balance"`
}

// BatchTask 批量任务（引用）
type BatchTask struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (BatchTask) TableName() string {
	return "batch_tasks"
}

// SiteRankQuery 网站排名查询（引用）
type SiteRankQuery struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (SiteRankQuery) TableName() string {
	return "siterank_queries"
}

// ChengeLinkTask 链接更新任务（引用）
type ChengeLinkTask struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (ChengeLinkTask) TableName() string {
	return "chengelink_tasks"
}

// CheckinRecord 签到记录（引用）
type CheckinRecord struct {
	UserID      string    `json:"user_id"`
	CheckinDate string    `json:"checkin_date"`
	CreatedAt   time.Time `json:"created_at"`
}

func (CheckinRecord) TableName() string {
	return "checkin_records"
}

// DashboardTab 个人中心标签页
type DashboardTab struct {
	Key         string `json:"key"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Enabled     bool   `json:"enabled"`
}

// GetDashboardTabs 获取个人中心标签页配置
func GetDashboardTabs() []DashboardTab {
	return []DashboardTab{
		{
			Key:         "overview",
			Title:       "概览",
			Description: "查看账户概览和使用统计",
			Icon:        "dashboard",
			Enabled:     true,
		},
		{
			Key:         "profile",
			Title:       "个人信息",
			Description: "管理个人资料和账户设置",
			Icon:        "user",
			Enabled:     true,
		},
		{
			Key:         "subscription",
			Title:       "套餐管理",
			Description: "查看当前套餐和订阅历史",
			Icon:        "crown",
			Enabled:     true,
		},
		{
			Key:         "tokens",
			Title:       "Token明细",
			Description: "查看Token余额和交易记录",
			Icon:        "coin",
			Enabled:     true,
		},
		{
			Key:         "invitation",
			Title:       "邀请好友",
			Description: "邀请好友获得奖励",
			Icon:        "user-plus",
			Enabled:     true,
		},
		{
			Key:         "checkin",
			Title:       "每日签到",
			Description: "每日签到获得Token奖励",
			Icon:        "calendar-check",
			Enabled:     true,
		},
	}
}
