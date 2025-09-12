package siterank

import (
	"encoding/json"
	"time"
)

// QueryStatus 查询状态
type QueryStatus string

const (
	StatusPending    QueryStatus = "pending"    // 等待中
	StatusRunning    QueryStatus = "running"    // 查询中
	StatusCompleted  QueryStatus = "completed"  // 已完成
	StatusFailed     QueryStatus = "failed"     // 失败
	StatusCached     QueryStatus = "cached"     // 缓存命中
)

// Priority 优先级
type Priority string

const (
	PriorityHigh   Priority = "High"   // 高优先级
	PriorityMedium Priority = "Medium" // 中优先级
	PriorityLow    Priority = "Low"    // 低优先级
)

// DataSource 数据源
type DataSource string

const (
	SourceSimilarWeb DataSource = "similarweb" // SimilarWeb
	SourceCache      DataSource = "cache"      // 缓存
)

// SiteRankQuery 网站排名查询模型
type SiteRankQuery struct {
	ID       string      `json:"id" gorm:"primaryKey;size:36"`
	UserID   string      `json:"user_id" gorm:"not null;index;size:36"`
	Domain   string      `json:"domain" gorm:"not null;index;size:255"`
	Status   QueryStatus `json:"status" gorm:"size:20;default:pending"`
	Source   DataSource  `json:"source" gorm:"size:20;default:similarweb"`
	
	// 查询结果
	GlobalRank     *int     `json:"global_rank"`                    // 全球排名
	CategoryRank   *int     `json:"category_rank"`                  // 分类排名
	Category       string   `json:"category" gorm:"size:100"`       // 分类
	Country        string   `json:"country" gorm:"size:2"`          // 国家代码
	Visits         *float64 `json:"visits"`                         // 访问量
	BounceRate     *float64 `json:"bounce_rate"`                    // 跳出率
	PagesPerVisit  *float64 `json:"pages_per_visit"`                // 每次访问页面数
	AvgDuration    *float64 `json:"avg_duration"`                   // 平均访问时长
	Priority       Priority `json:"priority" gorm:"size:10"`        // 优先级
	
	// 缓存控制
	CacheUntil    *time.Time `json:"cache_until"`                   // 缓存过期时间
	RequestCount  int        `json:"request_count" gorm:"default:1"` // 请求次数
	
	// 错误信息
	ErrorMessage  string `json:"error_message" gorm:"type:text"`    // 错误信息
	
	// 审计字段
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TableName 指定表名
func (SiteRankQuery) TableName() string {
	return "siterank_queries"
}

// SiteRankData SimilarWeb响应数据
type SiteRankData struct {
	GlobalRank    *int                   `json:"global_rank"`
	CategoryRank  *int                   `json:"category_rank"`
	Category      string                 `json:"category"`
	Country       string                 `json:"country"`
	Visits        *float64               `json:"visits"`
	BounceRate    *float64               `json:"bounce_rate"`
	PagesPerVisit *float64               `json:"pages_per_visit"`
	AvgDuration   *float64               `json:"avg_duration"`
	TrafficSources map[string]interface{} `json:"traffic_sources"`
	Demographics   map[string]interface{} `json:"demographics"`
	Competitors    []string               `json:"competitors"`
}

// BatchQuery 批量查询请求
type BatchQuery struct {
	ID       string   `json:"id"`
	UserID   string   `json:"user_id"`
	Domains  []string `json:"domains"`
	Status   string   `json:"status"`
	Progress int      `json:"progress"`
	Total    int      `json:"total"`
	Results  []string `json:"results"` // 查询ID列表
	
	// 批量配置
	BatchSize    int `json:"batch_size"`    // 批次大小
	RateLimit    int `json:"rate_limit"`    // 速率限制（请求/分钟）
	
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// SiteRankResponse 查询响应
type SiteRankResponse struct {
	ID            string      `json:"id"`
	Domain        string      `json:"domain"`
	Status        QueryStatus `json:"status"`
	Source        DataSource  `json:"source"`
	GlobalRank    *int        `json:"global_rank"`
	CategoryRank  *int        `json:"category_rank"`
	Category      string      `json:"category"`
	Country       string      `json:"country"`
	Visits        *float64    `json:"visits"`
	BounceRate    *float64    `json:"bounce_rate"`
	PagesPerVisit *float64    `json:"pages_per_visit"`
	AvgDuration   *float64    `json:"avg_duration"`
	Priority      Priority    `json:"priority"`
	CacheUntil    *time.Time  `json:"cache_until"`
	RequestCount  int         `json:"request_count"`
	ErrorMessage  string      `json:"error_message"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

// ToResponse 转换为响应格式
func (q *SiteRankQuery) ToResponse() *SiteRankResponse {
	return &SiteRankResponse{
		ID:            q.ID,
		Domain:        q.Domain,
		Status:        q.Status,
		Source:        q.Source,
		GlobalRank:    q.GlobalRank,
		CategoryRank:  q.CategoryRank,
		Category:      q.Category,
		Country:       q.Country,
		Visits:        q.Visits,
		BounceRate:    q.BounceRate,
		PagesPerVisit: q.PagesPerVisit,
		AvgDuration:   q.AvgDuration,
		Priority:      q.Priority,
		CacheUntil:    q.CacheUntil,
		RequestCount:  q.RequestCount,
		ErrorMessage:  q.ErrorMessage,
		CreatedAt:     q.CreatedAt,
		UpdatedAt:     q.UpdatedAt,
	}
}

// IsExpired 检查缓存是否过期
func (q *SiteRankQuery) IsExpired() bool {
	if q.CacheUntil == nil {
		return true
	}
	return time.Now().After(*q.CacheUntil)
}

// CalculatePriority 根据排名数据计算优先级
func (q *SiteRankQuery) CalculatePriority() Priority {
	// 如果没有全球排名数据，返回低优先级
	if q.GlobalRank == nil {
		return PriorityLow
	}
	
	rank := *q.GlobalRank
	
	// 根据全球排名计算优先级
	switch {
	case rank <= 10000:
		return PriorityHigh   // 前1万名：高优先级
	case rank <= 100000:
		return PriorityMedium // 前10万名：中优先级
	default:
		return PriorityLow    // 其他：低优先级
	}
}

// UpdateFromSimilarWebData 从SimilarWeb数据更新查询结果
func (q *SiteRankQuery) UpdateFromSimilarWebData(data *SiteRankData) {
	q.GlobalRank = data.GlobalRank
	q.CategoryRank = data.CategoryRank
	q.Category = data.Category
	q.Country = data.Country
	q.Visits = data.Visits
	q.BounceRate = data.BounceRate
	q.PagesPerVisit = data.PagesPerVisit
	q.AvgDuration = data.AvgDuration
	
	// 计算优先级
	q.Priority = q.CalculatePriority()
	
	// 设置缓存时间
	if q.Status == StatusCompleted {
		// 成功查询缓存7天
		cacheUntil := time.Now().AddDate(0, 0, 7)
		q.CacheUntil = &cacheUntil
	} else {
		// 失败查询缓存1小时
		cacheUntil := time.Now().Add(1 * time.Hour)
		q.CacheUntil = &cacheUntil
	}
	
	q.UpdatedAt = time.Now()
}

// SimilarWebConfig SimilarWeb API配置
type SimilarWebConfig struct {
	APIKey      string `json:"api_key"`
	BaseURL     string `json:"base_url"`
	RateLimit   int    `json:"rate_limit"`   // 每小时请求数
	Timeout     int    `json:"timeout"`     // 超时时间（秒）
	RetryCount  int    `json:"retry_count"` // 重试次数
}

// DefaultSimilarWebConfig 默认SimilarWeb配置
func DefaultSimilarWebConfig() *SimilarWebConfig {
	return &SimilarWebConfig{
		APIKey:     "your-similarweb-api-key",
		BaseURL:    "https://api.similarweb.com/v1",
		RateLimit:  1000, // 每小时1000次请求
		Timeout:    30,   // 30秒超时
		RetryCount: 3,    // 重试3次
	}
}

// QueryRequest 查询请求
type QueryRequest struct {
	Domain  string `json:"domain" binding:"required"`
	Country string `json:"country"`
	Force   bool   `json:"force"` // 强制刷新缓存
}

// BatchQueryRequest 批量查询请求
type BatchQueryRequest struct {
	Domains   []string `json:"domains" binding:"required"`
	Country   string   `json:"country"`
	BatchSize int      `json:"batch_size"` // 批次大小
	Force     bool     `json:"force"`      // 强制刷新缓存
}

// QueryStats 查询统计
type QueryStats struct {
	TotalQueries    int64 `json:"total_queries"`
	CachedQueries   int64 `json:"cached_queries"`
	SuccessQueries  int64 `json:"success_queries"`
	FailedQueries   int64 `json:"failed_queries"`
	HighPriority    int64 `json:"high_priority"`
	MediumPriority  int64 `json:"medium_priority"`
	LowPriority     int64 `json:"low_priority"`
	CacheHitRate    float64 `json:"cache_hit_rate"`
}