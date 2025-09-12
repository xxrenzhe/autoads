package checkin

import (
	"time"
)

// CheckinRecord 签到记录
type CheckinRecord struct {
	UserID      string    `json:"user_id" gorm:"type:varchar(36);primaryKey"`
	CheckinDate string    `json:"checkin_date" gorm:"type:date;primaryKey"` // 格式: 2006-01-02
	TokenReward int       `json:"token_reward" gorm:"default:10"`
	CreatedAt   time.Time `json:"created_at"`
}

func (CheckinRecord) TableName() string {
	return "checkin_records"
}

// CheckinResult 签到结果
type CheckinResult struct {
	Success     bool   `json:"success"`
	Message     string `json:"message"`
	TokenReward int    `json:"token_reward"`
	CheckinDate string `json:"checkin_date"`
	AlreadyDone bool   `json:"already_done"`
}

// CheckinStatus 签到状态
type CheckinStatus struct {
	TodayChecked    bool `json:"today_checked"`    // 今天是否已签到
	ConsecutiveDays int  `json:"consecutive_days"` // 连续签到天数
	MonthlyDays     int  `json:"monthly_days"`     // 本月签到天数
	TotalDays       int  `json:"total_days"`       // 总签到天数
	NextReward      int  `json:"next_reward"`      // 下次签到奖励
}

// CheckinCalendar 签到日历
type CheckinCalendar struct {
	Year        int   `json:"year"`
	Month       int   `json:"month"`
	CheckinDays []int `json:"checkin_days"` // 已签到的日期
	TotalDays   int   `json:"total_days"`   // 本月签到总天数
}

// CheckinStats 签到统计
type CheckinStats struct {
	TotalDays       int `json:"total_days"`       // 总签到天数
	ConsecutiveDays int `json:"consecutive_days"` // 当前连续签到天数
	MonthlyDays     int `json:"monthly_days"`     // 本月签到天数
	TotalTokens     int `json:"total_tokens"`     // 总获得Token数
	MaxConsecutive  int `json:"max_consecutive"`  // 最长连续签到天数
}

// CheckinLeaderboardEntry 签到排行榜条目
type CheckinLeaderboardEntry struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	Email       string `json:"email"`
	TotalDays   int    `json:"total_days"`
	TotalTokens int    `json:"total_tokens"`
}

// PerformCheckinRequest 执行签到请求
type PerformCheckinRequest struct {
	// 无需额外参数，从JWT中获取用户ID
}

// GetCalendarRequest 获取日历请求
type GetCalendarRequest struct {
	Year  int `form:"year" binding:"required,min=2020,max=2030"`
	Month int `form:"month" binding:"required,min=1,max=12"`
}
