package admin

import (
	"time"
)

// OverviewStats 概览统计
type OverviewStats struct {
	// 用户统计
	TotalUsers    int64 `json:"total_users"`
	TodayNewUsers int64 `json:"today_new_users"`
	ActiveUsers   int64 `json:"active_users"`

	// Token统计
	TotalTokensConsumed int64 `json:"total_tokens_consumed"`
	TotalTokensEarned   int64 `json:"total_tokens_earned"`
	TodayTokensConsumed int64 `json:"today_tokens_consumed"`

	// 任务统计
	TotalBatchTasks      int64 `json:"total_batch_tasks"`
	TotalSiteRankQueries int64 `json:"total_siterank_queries"`
	TotalChengeLinkTasks int64 `json:"total_chengelink_tasks"`
	TodayBatchTasks      int64 `json:"today_batch_tasks"`

	// 邀请统计
	TotalInvitations      int64 `json:"total_invitations"`
	SuccessfulInvitations int64 `json:"successful_invitations"`

	// 签到统计
	TotalCheckins int64 `json:"total_checkins"`
	TodayCheckins int64 `json:"today_checkins"`
}

// DailyUserStats 每日用户统计
type DailyUserStats struct {
	Date        string `json:"date"`
	NewUsers    int64  `json:"new_users"`
	ActiveUsers int64  `json:"active_users"`
}

// DailyTokenStats 每日Token统计
type DailyTokenStats struct {
	Date           string `json:"date"`
	TokensEarned   int64  `json:"tokens_earned"`
	TokensConsumed int64  `json:"tokens_consumed"`
}

// DailyTaskStats 每日任务统计
type DailyTaskStats struct {
	Date            string `json:"date"`
	BatchTasks      int64  `json:"batch_tasks"`
	SiteRankQueries int64  `json:"siterank_queries"`
	ChengeLinkTasks int64  `json:"chengelink_tasks"`
}

// UserRanking 用户排行
type UserRanking struct {
	ID              string    `json:"id"`
	Username        string    `json:"username"`
	Email           string    `json:"email"`
	PlanName        string    `json:"plan_name"`
	TokenBalance    int       `json:"token_balance"`
	TokensConsumed  int64     `json:"tokens_consumed"`
	BatchTasks      int64     `json:"batch_tasks"`
	SiteRankQueries int64     `json:"siterank_queries"`
	Invitations     int64     `json:"invitations"`
	CreatedAt       time.Time `json:"created_at"`
}

// RevenueStats 收入统计
type RevenueStats struct {
	TotalRevenue          float64 `json:"total_revenue"`
	MonthlyRevenue        float64 `json:"monthly_revenue"`
	DailyRevenue          float64 `json:"daily_revenue"`
	AverageRevenuePerUser float64 `json:"average_revenue_per_user"`
}

// SystemHealth 系统健康状态
type SystemHealth struct {
	DatabaseStatus string    `json:"database_status"`
	RedisStatus    string    `json:"redis_status"`
	APIStatus      string    `json:"api_status"`
	LastUpdated    time.Time `json:"last_updated"`
}

// UserManagement 用户管理
type UserManagement struct {
	ID           string     `json:"id"`
	Username     string     `json:"username"`
	Email        string     `json:"email"`
	PlanName     string     `json:"plan_name"`
	TokenBalance int        `json:"token_balance"`
	Status       string     `json:"status"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// PlanConfig 套餐配置
type PlanConfig struct {
	ID          uint    `json:"id" gorm:"primaryKey"`
	Name        string  `json:"name" gorm:"type:varchar(50);not null;unique"`
	DisplayName string  `json:"display_name" gorm:"type:varchar(100);not null"`
	Description string  `json:"description" gorm:"type:text"`
	Price       float64 `json:"price" gorm:"type:decimal(10,2);default:0"`
	Duration    int     `json:"duration" gorm:"default:30"` // 天数

	// 功能权限
    BatchGoEnabled    bool `json:"batchgo_enabled" gorm:"default:true"`
    SiteRankEnabled   bool `json:"siterank_enabled" gorm:"default:true"`
    AdsCenterEnabled  bool `json:"adscenter_enabled" gorm:"column:adscenter_enabled;default:false"`

	// 参数限制
	MaxBatchSize       int `json:"max_batch_size" gorm:"default:10"`
	MaxConcurrency     int `json:"max_concurrency" gorm:"default:3"`
    MaxSiteRankQueries   int `json:"max_siterank_queries" gorm:"default:100"`
    MaxAdsCenterAccounts int `json:"max_adscenter_accounts" gorm:"column:max_adscenter_accounts;default:0"`

	// Token相关
	InitialTokens int `json:"initial_tokens" gorm:"default:100"`
	DailyTokens   int `json:"daily_tokens" gorm:"default:10"`

	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TokenPackage Token充值包配置
type TokenPackage struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"type:varchar(100);not null"`
	TokenAmount int       `json:"token_amount" gorm:"not null"`
	Price       float64   `json:"price" gorm:"type:decimal(10,2);not null"`
	BonusTokens int       `json:"bonus_tokens" gorm:"default:0"`
	Description string    `json:"description" gorm:"type:text"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	SortOrder   int       `json:"sort_order" gorm:"default:0"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TokenConsumptionRule Token消费规则
type TokenConsumptionRule struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
    Service     string    `json:"service" gorm:"type:varchar(50);not null"` // batchgo, siterank, adscenter
	Action      string    `json:"action" gorm:"type:varchar(50);not null"`  // 具体操作
	TokenCost   int       `json:"token_cost" gorm:"not null"`
	Description string    `json:"description" gorm:"type:text"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// AdminUser 管理员用户
type AdminUser struct {
	ID          uint       `json:"id" gorm:"primaryKey"`
	Username    string     `json:"username" gorm:"type:varchar(50);not null;unique"`
	Email       string     `json:"email" gorm:"type:varchar(100);not null;unique"`
	Password    string     `json:"-" gorm:"type:varchar(255);not null"`
	Role        string     `json:"role" gorm:"type:varchar(20);default:'admin'"`
	IsActive    bool       `json:"is_active" gorm:"default:true"`
	LastLoginAt *time.Time `json:"last_login_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// SystemConfig 系统配置
type SystemConfig struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Key         string    `json:"key" gorm:"type:varchar(100);not null;unique"`
	Value       string    `json:"value" gorm:"type:text"`
	Description string    `json:"description" gorm:"type:text"`
	Category    string    `json:"category" gorm:"type:varchar(50);default:'general'"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// InvitationRanking 邀请排行榜
type InvitationRanking struct {
	UserID          string `json:"user_id"`
	Username        string `json:"username"`
	Email           string `json:"email"`
	InvitationCount int64  `json:"invitation_count"`
	SuccessfulCount int64  `json:"successful_count"`
	RewardTokens    int64  `json:"reward_tokens"`
	RewardProDays   int64  `json:"reward_pro_days"`
}

// UserOperationLog 用户操作日志
type UserOperationLog struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	AdminID      uint      `json:"admin_id" gorm:"not null"`
	TargetUserID string    `json:"target_user_id" gorm:"type:varchar(36);not null"`
	Operation    string    `json:"operation" gorm:"type:varchar(100);not null"`
	Details      string    `json:"details" gorm:"type:text"`
	IPAddress    string    `json:"ip_address" gorm:"type:varchar(45)"`
	CreatedAt    time.Time `json:"created_at"`
}

// TableName 指定表名
func (PlanConfig) TableName() string {
	return "plan_configs"
}

func (TokenPackage) TableName() string {
	return "token_packages"
}

func (TokenConsumptionRule) TableName() string {
	return "token_consumption_rules"
}

func (AdminUser) TableName() string {
	return "admin_users"
}

func (SystemConfig) TableName() string {
	return "system_configs"
}

func (UserOperationLog) TableName() string {
	return "user_operation_logs"
}

// 引用的外部模型（简化定义）
type User struct {
	ID           string     `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Username     string     `json:"username"`
	Email        string     `json:"email"`
	PlanName     string     `json:"plan_name"`
	TokenBalance int        `json:"token_balance"`
	Status       string     `json:"status"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type TokenTransaction struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"user_id"`
	Amount      int       `json:"amount"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type BatchTask struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

type SiteRankQuery struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

type AdsCenterTask struct {
    ID        string    `json:"id" gorm:"primaryKey"`
    UserID    string    `json:"user_id"`
    CreatedAt time.Time `json:"created_at"`
}

type Invitation struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	InviterID string    `json:"inviter_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type CheckinRecord struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"user_id"`
	CheckinDate string    `json:"checkin_date"`
	CreatedAt   time.Time `json:"created_at"`
}
