package ratelimit

import (
	"time"

	"gorm.io/gorm"
)

// RateLimitConfig 速率限制配置数据库模型
type RateLimitConfig struct {
	ID      string `json:"id" gorm:"primaryKey"`
	Plan    string `json:"plan" gorm:"index;not null;unique"`
	Feature string `json:"feature" gorm:"index;not null"` // API, SITE_RANK, BATCH

	// 速率限制配置
	PerMinute int `json:"per_minute"`
	PerHour   int `json:"per_hour"`

	// 批量任务专用
	Concurrent int `json:"concurrent"` // 并发数限制

	// 状态
	IsActive bool `json:"is_active" gorm:"default:true"`

	// 时间戳
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// GORM 字段
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

// TableName 指定表名
func (RateLimitConfig) TableName() string {
	return "rate_limit_configs"
}

// BeforeCreate 创建前的钩子
func (c *RateLimitConfig) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = "rlc_" + c.Plan + "_" + c.Feature
	}
	return nil
}

// ToConfig 转换为 PlanRateLimit 的部分配置
func (c *RateLimitConfig) ToConfig() *PlanRateLimitFeature {
	return &PlanRateLimitFeature{
		PerMinute:  c.PerMinute,
		PerHour:    c.PerHour,
		Concurrent: c.Concurrent,
	}
}

// PlanRateLimitFeature 套餐速率限制特性配置
type PlanRateLimitFeature struct {
	PerMinute  int `json:"per_minute"`
	PerHour    int `json:"per_hour"`
	Concurrent int `json:"concurrent"`
}

// PlanRateLimitDB 数据库中的套餐速率限制配置
type PlanRateLimitDB struct {
	Plan      string
	API       *PlanRateLimitFeature
	SiteRank  *PlanRateLimitFeature
	Batch     *PlanRateLimitFeature
	IsActive  bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ToConfig 转换为内存中的配置
func (p *PlanRateLimitDB) ToConfig() *PlanRateLimit {
	config := &PlanRateLimit{
		Plan: p.Plan,
	}

	if p.API != nil {
		config.APIRequestsPerMinute = p.API.PerMinute
		config.APIRequestsPerHour = p.API.PerHour
	}

	if p.SiteRank != nil {
		config.SiteRankRequestsPerMinute = p.SiteRank.PerMinute
		config.SiteRankRequestsPerHour = p.SiteRank.PerHour
	}

	if p.Batch != nil {
		config.BatchConcurrentTasks = p.Batch.Concurrent
		config.BatchTasksPerMinute = p.Batch.PerMinute
	}

	return config
}

type RateLimitUsage struct {
	ID         string    `json:"id" gorm:"primaryKey;size:64"`
	UserID     string    `json:"user_id" gorm:"size:64;index"`
	Plan       string    `json:"plan" gorm:"size:32"`
	Feature    string    `json:"feature" gorm:"size:32"`
	UsedCount  int       `json:"used_count"`
	LimitCount int       `json:"limit_count"`
	Period     string    `json:"period" gorm:"size:16"` // MINUTE/HOUR
	RecordedAt time.Time `json:"recorded_at"`
	CreatedAt  time.Time `json:"created_at"`
	Status     string    `json:"status" gorm:"size:32"`
}

func (RateLimitUsage) TableName() string { return "rate_limit_usages" }
