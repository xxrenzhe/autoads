package adscenter

import (
	"gorm.io/gorm"
	"time"
)

// AdsCenterTask 自动化广告任务
type AdsCenterTask struct {
	ID               string              `json:"id" gorm:"primaryKey;type:varchar(36)"`
	UserID           string              `json:"user_id" gorm:"type:varchar(36);index;not null"`
	Name             string              `json:"name" gorm:"type:varchar(255);not null"`
	Status           TaskStatus          `json:"status" gorm:"type:varchar(20);default:'pending'"`
	AffiliateLinks   []string            `json:"affiliate_links" gorm:"serializer:json"`
	AdsPowerProfile  string              `json:"adspower_profile" gorm:"type:varchar(255)"`
	GoogleAdsAccount string              `json:"google_ads_account" gorm:"type:varchar(255)"`
	ExtractedLinks   []ExtractedLink     `json:"extracted_links" gorm:"serializer:json"`
	UpdateResults    []AdUpdateResult    `json:"update_results" gorm:"serializer:json"`
	TotalLinks       int                 `json:"total_links" gorm:"default:0"`
	ExtractedCount   int                 `json:"extracted_count" gorm:"default:0"`
	UpdatedCount     int                 `json:"updated_count" gorm:"default:0"`
	FailedCount      int                 `json:"failed_count" gorm:"default:0"`
	TokensConsumed   int                 `json:"tokens_consumed" gorm:"default:0"`
	ExecutionLog     []ExecutionLogEntry `json:"execution_log" gorm:"serializer:json"`
	ErrorMessage     string              `json:"error_message" gorm:"type:text"`
	StartedAt        *time.Time          `json:"started_at"`
	CompletedAt      *time.Time          `json:"completed_at"`
	CreatedAt        time.Time           `json:"created_at"`
	UpdatedAt        time.Time           `json:"updated_at"`
}

// TaskStatus 任务状态
type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"    // 等待中
	TaskStatusExtracting TaskStatus = "extracting" // 链接提取中
	TaskStatusUpdating   TaskStatus = "updating"   // 广告更新中
	TaskStatusCompleted  TaskStatus = "completed"  // 已完成
	TaskStatusFailed     TaskStatus = "failed"     // 失败
	TaskStatusCancelled  TaskStatus = "cancelled"  // 已取消
)

// ExtractedLink 提取的链接信息
type ExtractedLink struct {
	AffiliateURL string `json:"affiliate_url"`
	FinalURL     string `json:"final_url"`
	Status       string `json:"status"` // success, failed
	ErrorMessage string `json:"error_message,omitempty"`
	ExtractedAt  string `json:"extracted_at"`
}

// AdUpdateResult 广告更新结果
type AdUpdateResult struct {
	AdID         string `json:"ad_id"`
	AdName       string `json:"ad_name"`
	OldFinalURL  string `json:"old_final_url"`
	NewFinalURL  string `json:"new_final_url"`
	Status       string `json:"status"` // success, failed, skipped
	ErrorMessage string `json:"error_message,omitempty"`
	UpdatedAt    string `json:"updated_at"`
}

// ExecutionLogEntry 执行日志条目
type ExecutionLogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"` // info, warning, error
	Message   string `json:"message"`
	Details   string `json:"details,omitempty"`
}

// AdsPowerConfig AdsPower浏览器配置
type AdsPowerConfig struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"user_id" gorm:"type:varchar(36);index;not null"`
	Name        string    `json:"name" gorm:"type:varchar(255);not null"`
	ProfileID   string    `json:"profile_id" gorm:"type:varchar(255);not null"`
	APIEndpoint string    `json:"api_endpoint" gorm:"type:varchar(500);not null"`
	APIKey      string    `json:"api_key" gorm:"type:varchar(255)"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// GoogleAdsConfig Google Ads配置
type GoogleAdsConfig struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	UserID         string    `json:"user_id" gorm:"type:varchar(36);index;not null"`
	Name           string    `json:"name" gorm:"type:varchar(255);not null"`
	CustomerID     string    `json:"customer_id" gorm:"type:varchar(50);not null"`
	DeveloperToken string    `json:"developer_token" gorm:"type:varchar(255)"`
	ClientID       string    `json:"client_id" gorm:"type:varchar(255)"`
	ClientSecret   string    `json:"client_secret" gorm:"type:varchar(255)"`
	RefreshToken   string    `json:"refresh_token" gorm:"type:text"`
	IsActive       bool      `json:"is_active" gorm:"default:true"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// AdsCenterStats 统计信息
type AdsCenterStats struct {
	TotalTasks          int     `json:"total_tasks"`
	CompletedTasks      int     `json:"completed_tasks"`
	FailedTasks         int     `json:"failed_tasks"`
	TotalLinksExtracted int     `json:"total_links_extracted"`
	TotalAdsUpdated     int     `json:"total_ads_updated"`
	SuccessRate         float64 `json:"success_rate"`
	TokensConsumed      int     `json:"tokens_consumed"`
}

// TableName 指定表名
func (AdsCenterTask) TableName() string {
    return "adscenter_tasks"
}

func (AdsPowerConfig) TableName() string {
	return "adspower_configs"
}

func (GoogleAdsConfig) TableName() string {
	return "google_ads_configs"
}

// AddLog 添加执行日志
func (t *AdsCenterTask) AddLog(level, message, details string) {
	entry := ExecutionLogEntry{
		Timestamp: time.Now().Format("2006-01-02 15:04:05"),
		Level:     level,
		Message:   message,
		Details:   details,
	}
	t.ExecutionLog = append(t.ExecutionLog, entry)
}

// UpdateProgress 更新任务进度
func (t *AdsCenterTask) UpdateProgress(db *gorm.DB) error {
	return db.Model(t).Updates(map[string]interface{}{
		"extracted_count": t.ExtractedCount,
		"updated_count":   t.UpdatedCount,
		"failed_count":    t.FailedCount,
		"tokens_consumed": t.TokensConsumed,
		"execution_log":   t.ExecutionLog,
		"updated_at":      time.Now(),
	}).Error
}

// CalculateTokenCost 计算Token消费
func (t *AdsCenterTask) CalculateTokenCost() int {
	// 链接提取: 1 Token per link
	extractCost := len(t.AffiliateLinks)

	// 广告更新: 3 Token per ad (估算，实际根据更新的广告数量)
	// 这里先按提取的链接数量估算，实际执行时会根据真实广告数量计算
	updateCost := len(t.AffiliateLinks) * 3

	return extractCost + updateCost
}

// IsCompleted 检查任务是否完成
func (t *AdsCenterTask) IsCompleted() bool {
	return t.Status == TaskStatusCompleted || t.Status == TaskStatusFailed || t.Status == TaskStatusCancelled
}

// GetSuccessRate 获取成功率
func (t *AdsCenterTask) GetSuccessRate() float64 {
	if t.TotalLinks == 0 {
		return 0
	}
	return float64(t.ExtractedCount+t.UpdatedCount) / float64(t.TotalLinks*2) * 100
}
