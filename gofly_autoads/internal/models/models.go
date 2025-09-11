package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID           string         `json:"id" gorm:"primaryKey"`
	TenantID     string         `json:"tenant_id" gorm:"index"`
	Username     string         `json:"username" gorm:"uniqueIndex"`
	Email        string         `json:"email" gorm:"uniqueIndex"`
	Password     string         `json:"-"` // Never expose password
	Role         string         `json:"role" gorm:"default:'user'"`
	Status       string         `json:"status" gorm:"default:'active'"` // active, suspended, deleted
	
	// Subscription info
	Subscription Subscription   `json:"subscription" gorm:"embedded"`
	
	// Tokens
	TokenBalance int64          `json:"token_balance" gorm:"default:0"`
	
	// Timestamps
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// Subscription holds user subscription information
type Subscription struct {
	PlanID         string     `json:"plan_id"`
	Status         string     `json:"status"` // active, cancelled, expired
	StartedAt      time.Time  `json:"started_at"`
	EndsAt         time.Time  `json:"ends_at"`
	RenewsAt       *time.Time `json:"renews_at,omitempty"`
	CancelledAt    *time.Time `json:"cancelled_at,omitempty"`
	Features       []string   `json:"features" gorm:"type:json"`
	Limits         PlanLimits `json:"limits" gorm:"embedded"`
}

// PlanLimits defines subscription limits
type PlanLimits struct {
	MaxBatchURLs        int `json:"max_batch_urls"`
	MaxDailyRequests    int `json:"max_daily_requests"`
	MaxConcurrentTasks  int `json:"max_concurrent_tasks"`
	HasAPIAccess        bool `json:"has_api_access"`
	HasPrioritySupport  bool `json:"has_priority_support"`
}

// BatchTask represents a batch task (Silent or AutoClick)
type BatchTask struct {
	ID              string         `json:"id" gorm:"primaryKey"`
	TenantID        string         `json:"tenant_id" gorm:"index"`
	UserID          string         `json:"user_id" gorm:"index"`
	Name            string         `json:"name"`
	Type            string         `json:"type" gorm:"index"` // "silent" or "autoclick"
	Status          string         `json:"status" gorm:"index"` // pending, running, completed, failed, terminated
	URLs            []string       `json:"urls" gorm:"type:json"`
	TotalURLs       int            `json:"total_urls"`
	SuccessCount    int            `json:"success_count"`
	FailCount       int            `json:"fail_count"`
	PendingCount    int            `json:"pending_count"`
	
	// Execution config
	CycleCount      int            `json:"cycle_count" gorm:"default:1"`
	ProxyURL        string         `json:"proxy_url"`
	AccessMode      string         `json:"access_mode" gorm:"default:'http'"` // http, puppeteer
	ConcurrencyLimit int           `json:"concurrency_limit" gorm:"default:3"`
	OpenInterval    int            `json:"open_interval" gorm:"default:1"`
	OpenCount       int            `json:"open_count" gorm:"default:1"`
	
	// AutoClick specific
	Schedule        string         `json:"schedule,omitempty"` // cron expression
	DailyTarget     int            `json:"daily_target,omitempty"`
	CurrentProgress int           `json:"current_progress,omitempty"`
	
	// Token info
	TokenCost       int64          `json:"token_cost"`
	
	// Timestamps
	StartTime       time.Time      `json:"start_time"`
	EndTime         *time.Time     `json:"end_time,omitempty"`
	Duration        int64          `json:"duration_ms"` // milliseconds
	
	// Results
	Results         []TaskResult   `json:"results" gorm:"type:json"`
	ErrorSummary    *ErrorSummary  `json:"error_summary" gorm:"type:json"`
	ProxyStats      *ProxyStats    `json:"proxy_stats" gorm:"type:json"`
	
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

// TaskResult represents the result of processing a single URL
type TaskResult struct {
	URL           string    `json:"url"`
	Status        string    `json:"status"` // success, failed, timeout
	StatusCode    int       `json:"status_code"`
	ResponseTime  int64     `json:"response_time_ms"`
	Error         string    `json:"error,omitempty"`
	ProxyUsed     string    `json:"proxy_used,omitempty"`
	Attempts      int       `json:"attempts"`
	CycleIndex    int       `json:"cycle_index"`
	CreatedAt     time.Time `json:"created_at"`
}

// ErrorSummary summarizes task errors
type ErrorSummary struct {
	TotalErrors    int                    `json:"total_errors"`
	ErrorTypes     map[string]int         `json:"error_types"`
	LastErrors     []string               `json:"last_errors"`
}

// ProxyStats summarizes proxy usage
type ProxyStats struct {
	TotalProxies     int                    `json:"total_proxies"`
	SuccessProxies   int                    `json:"success_proxies"`
	FailedProxies    int                    `json:"failed_proxies"`
	AvgResponseTime  int64                  `json:"avg_response_time_ms"`
	ProxyStats       map[string]interface{} `json:"proxy_stats"`
}

// SiteRankQuery represents a site rank query result
type SiteRankQuery struct {
	ID             string         `json:"id" gorm:"primaryKey"`
	TenantID       string         `json:"tenant_id" gorm:"index"`
	UserID         string         `json:"user_id" gorm:"index"`
	Domain         string         `json:"domain" gorm:"index"`
	Status         string         `json:"status" gorm:"index"` // pending, running, completed, failed
	Source         string         `json:"source" gorm:"default:'similarweb'"`
	
	// SimilarWeb data
	GlobalRank     *int           `json:"global_rank"`
	CategoryRank   *int           `json:"category_rank"`
	Category       string         `json:"category"`
	Country        string         `json:"country"`
	Visits         *float64       `json:"visits"` // monthly visits (millions)
	BounceRate     *float64       `json:"bounce_rate"`
	PagesPerVisit  *float64       `json:"pages_per_visit"`
	AvgDuration    *float64       `json:"avg_duration"`
	
	// API info
	APIResponse    string         `json:"api_response" gorm:"type:text"`
	APIError       string         `json:"api_error,omitempty"`
	CacheUntil     *time.Time     `json:"cache_until"`
	
	// Stats
	RequestCount   int            `json:"request_count" gorm:"default:1"`
	LastQueried    *time.Time     `json:"last_queried"`
	
	// Token info
	TokenCost      int64          `json:"token_cost" gorm:"default:100"`
	
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	
	// Indexes
	UniqueIndex    struct         `gorm:"uniqueIndex:domain_source;unique"`
}

// SiteRankBatch represents a batch site rank query
type SiteRankBatch struct {
	ID             string           `json:"id" gorm:"primaryKey"`
	TenantID       string           `json:"tenant_id" gorm:"index"`
	UserID         string           `json:"user_id" gorm:"index"`
	Name           string           `json:"name"`
	Status         string           `json:"status" gorm:"index"` // pending, running, completed, failed
	Domains        []string         `json:"domains" gorm:"type:json"`
	TotalDomains   int              `json:"total_domains"`
	SuccessCount   int              `json:"success_count"`
	FailCount      int              `json:"fail_count"`
	
	// Results
	Results        []SiteRankResult `json:"results" gorm:"type:json"`
	Priorities     map[string]string `json:"priorities" gorm:"type:json"` // domain -> priority
	
	// Token info
	TokenCost      int64            `json:"token_cost"`
	
	CreatedAt      time.Time        `json:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at"`
}

// SiteRankResult represents the result for a single domain in a batch
type SiteRankResult struct {
	Domain        string    `json:"domain"`
	Status        string    `json:"status"` // success, failed
	GlobalRank    *int      `json:"global_rank"`
	Category      string    `json:"category"`
	Visits        *float64  `json:"visits"`
	Priority      string    `json:"priority"` // High, Medium, Low
	QueryTime     int64     `json:"query_time_ms"`
	Error         string    `json:"error,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// TokenTransaction represents a token transaction
type TokenTransaction struct {
	ID          string         `json:"id" gorm:"primaryKey"`
	UserID      string         `json:"user_id" gorm:"index"`
	TenantID    string         `json:"tenant_id" gorm:"index"`
	Type        string         `json:"type" gorm:"index"` // consume, earn, refund, bonus
	Amount      int64          `json:"amount"`
	Balance     int64          `json:"balance"`
	Description string         `json:"description"`
	ReferenceID string         `json:"reference_id,omitempty"` // Task ID or other reference
	
	CreatedAt   time.Time      `json:"created_at"`
}

// APIKey represents an API key for external access
type APIKey struct {
	ID          string         `json:"id" gorm:"primaryKey"`
	UserID      string         `json:"user_id" gorm:"index"`
	TenantID    string         `json:"tenant_id" gorm:"index"`
	Key         string         `json:"key" gorm:"uniqueIndex"`
	Name        string         `json:"name"`
	Permissions []string       `json:"permissions" gorm:"type:json"`
	LastUsedAt  *time.Time     `json:"last_used_at,omitempty"`
	ExpiresAt   *time.Time     `json:"expires_at,omitempty"`
	Status      string         `json:"status" gorm:"default:'active'"` // active, revoked, expired
	
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}