package batchgo

import (
	"encoding/json"
	"time"
)

// BatchConfig 任务配置（用于并发服务）
type BatchConfig struct {
	AccessMethod string                 `json:"access_method"`
	Timeout      int                    `json:"timeout"`
	RetryCount   int                    `json:"retry_count"`
	Headers      map[string]string      `json:"headers"`
	Options      map[string]interface{} `json:"options"`
}

// BatchTaskMode 批处理任务模式
type BatchTaskMode string

const (
	ModeBasic     BatchTaskMode = "basic"     // Basic模式：WebSocket通知前端
	ModeSilent    BatchTaskMode = "silent"    // Silent模式：后端并发处理
	ModeAutoClick BatchTaskMode = "autoclick" // AutoClick模式：定时任务调度
)

// BatchTaskStatus 批处理任务状态
type BatchTaskStatus string

const (
	StatusPending   BatchTaskStatus = "pending"   // 等待中
	StatusRunning   BatchTaskStatus = "running"   // 运行中
	StatusCompleted BatchTaskStatus = "completed" // 已完成
	StatusFailed    BatchTaskStatus = "failed"    // 失败
	StatusCancelled BatchTaskStatus = "cancelled" // 已取消
	StatusPaused    BatchTaskStatus = "paused"    // 已暂停
)

// BatchTask 批处理任务模型
type BatchTask struct {
	ID     string          `json:"id" gorm:"primaryKey;size:36"`
	UserID string          `json:"user_id" gorm:"not null;index;size:36"`
	Name   string          `json:"name" gorm:"size:255"`
	Mode   BatchTaskMode   `json:"mode" gorm:"size:20;not null"`
	Status BatchTaskStatus `json:"status" gorm:"size:20;default:pending"`

	// URL配置
	URLs     json.RawMessage `json:"urls" gorm:"type:json"`      // URL列表
	URLCount int             `json:"url_count" gorm:"default:0"` // URL总数

	// 执行配置
	Config json.RawMessage `json:"config" gorm:"type:json"` // 任务配置

	// 进度信息
	ProcessedCount int `json:"processed_count" gorm:"default:0"` // 已处理数量
	SuccessCount   int `json:"success_count" gorm:"default:0"`   // 成功数量
	FailedCount    int `json:"failed_count" gorm:"default:0"`    // 失败数量

	// Token消费
	TokenCost     int `json:"token_cost" gorm:"default:0"`     // Token消费
	TokenConsumed int `json:"token_consumed" gorm:"default:0"` // 已消费Token

	// 时间信息
	StartTime     *time.Time `json:"start_time"`     // 开始时间
	EndTime       *time.Time `json:"end_time"`       // 结束时间
	ScheduledTime *time.Time `json:"scheduled_time"` // 计划执行时间

	// 错误信息
	ErrorMessage string `json:"error_message" gorm:"type:text"` // 错误信息

	// 审计字段
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName 指定表名
func (BatchTask) TableName() string {
	return "batch_tasks"
}

// BatchTaskConfig 任务配置
type BatchTaskConfig struct {
	// Basic模式配置
	Basic *BasicConfig `json:"basic,omitempty"`

	// Silent模式配置
	Silent *SilentConfig `json:"silent,omitempty"`

	// AutoClick模式配置
	AutoClick *AutoClickConfig `json:"autoclick,omitempty"`
}

// BasicConfig Basic模式配置
type BasicConfig struct {
	Delay      int  `json:"delay"`      // 延迟时间（毫秒）
	NewWindow  bool `json:"new_window"` // 是否新窗口打开
	Sequential bool `json:"sequential"` // 是否顺序执行
}

// SilentConfig Silent模式配置
type SilentConfig struct {
	Concurrency   int               `json:"concurrency"`    // 并发数
	Timeout       int               `json:"timeout"`        // 超时时间（秒）
	RetryCount    int               `json:"retry_count"`    // 重试次数
	UseProxy      bool              `json:"use_proxy"`      // 是否使用代理
	ProxyRotation bool              `json:"proxy_rotation"` // 代理轮询
	UserAgent     string            `json:"user_agent"`     // User Agent
	Headers       map[string]string `json:"headers"`        // 自定义头部
}

// AutoClickConfig AutoClick模式配置
type AutoClickConfig struct {
	StartTime      string `json:"start_time"`       // 开始时间 (HH:MM)
	EndTime        string `json:"end_time"`         // 结束时间 (HH:MM)
	Interval       int    `json:"interval"`         // 间隔时间（分钟）
	RandomDelay    bool   `json:"random_delay"`     // 随机延迟
	MaxRandomDelay int    `json:"max_random_delay"` // 最大随机延迟（分钟）
	WorkDays       []int  `json:"work_days"`        // 工作日（0-6，0为周日）
}

// BatchTaskURL URL项目
type BatchTaskURL struct {
	URL       string                 `json:"url"`
	Status    string                 `json:"status"`   // pending, processing, success, failed
	Response  map[string]interface{} `json:"response"` // 响应数据
	Error     string                 `json:"error"`    // 错误信息
	StartTime *time.Time             `json:"start_time"`
	EndTime   *time.Time             `json:"end_time"`
	Retries   int                    `json:"retries"` // 重试次数
}

// BatchTaskResult 任务结果
type BatchTaskResult struct {
	TaskID         string          `json:"task_id"`
	Status         BatchTaskStatus `json:"status"`
	ProcessedCount int             `json:"processed_count"`
	SuccessCount   int             `json:"success_count"`
	FailedCount    int             `json:"failed_count"`
	URLs           []BatchTaskURL  `json:"urls"`
	StartTime      *time.Time      `json:"start_time"`
	EndTime        *time.Time      `json:"end_time"`
	Duration       int64           `json:"duration"` // 执行时长（秒）
	ErrorMessage   string          `json:"error_message"`
	// Advanced fields
	URL          string    `json:"url" gorm:"-"`
	StatusCode   int       `json:"status_code" gorm:"-"`
	ResponseTime int       `json:"response_time" gorm:"-"`
	Error        string    `json:"error" gorm:"-"`
	Data         string    `json:"data" gorm:"-"`
	CreatedAt    time.Time `json:"created_at" gorm:"-"`
}

// ToResult 转换为结果格式
func (t *BatchTask) ToResult() *BatchTaskResult {
	var urls []BatchTaskURL
	if len(t.URLs) > 0 {
		json.Unmarshal(t.URLs, &urls)
	}

	var duration int64
	if t.StartTime != nil && t.EndTime != nil {
		duration = t.EndTime.Sub(*t.StartTime).Milliseconds() / 1000
	}

	return &BatchTaskResult{
		TaskID:         t.ID,
		Status:         t.Status,
		ProcessedCount: t.ProcessedCount,
		SuccessCount:   t.SuccessCount,
		FailedCount:    t.FailedCount,
		URLs:           urls,
		StartTime:      t.StartTime,
		EndTime:        t.EndTime,
		Duration:       duration,
		ErrorMessage:   t.ErrorMessage,
	}
}

// BatchTaskResponse 任务响应
type BatchTaskResponse struct {
	ID             string          `json:"id"`
	UserID         string          `json:"user_id"`
	Name           string          `json:"name"`
	Mode           BatchTaskMode   `json:"mode"`
	Status         BatchTaskStatus `json:"status"`
	URLCount       int             `json:"url_count"`
	ProcessedCount int             `json:"processed_count"`
	SuccessCount   int             `json:"success_count"`
	FailedCount    int             `json:"failed_count"`
	TokenCost      int             `json:"token_cost"`
	TokenConsumed  int             `json:"token_consumed"`
	StartTime      *time.Time      `json:"start_time"`
	EndTime        *time.Time      `json:"end_time"`
	ScheduledTime  *time.Time      `json:"scheduled_time"`
	ErrorMessage   string          `json:"error_message"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// ToResponse 转换为响应格式
func (t *BatchTask) ToResponse() *BatchTaskResponse {
	return &BatchTaskResponse{
		ID:             t.ID,
		UserID:         t.UserID,
		Name:           t.Name,
		Mode:           t.Mode,
		Status:         t.Status,
		URLCount:       t.URLCount,
		ProcessedCount: t.ProcessedCount,
		SuccessCount:   t.SuccessCount,
		FailedCount:    t.FailedCount,
		TokenCost:      t.TokenCost,
		TokenConsumed:  t.TokenConsumed,
		StartTime:      t.StartTime,
		EndTime:        t.EndTime,
		ScheduledTime:  t.ScheduledTime,
		ErrorMessage:   t.ErrorMessage,
		CreatedAt:      t.CreatedAt,
		UpdatedAt:      t.UpdatedAt,
	}
}

// GetURLs 获取URL列表
func (t *BatchTask) GetURLs() []string {
	var urls []BatchTaskURL
	if len(t.URLs) > 0 {
		json.Unmarshal(t.URLs, &urls)
	}

	result := make([]string, len(urls))
	for i, url := range urls {
		result[i] = url.URL
	}
	return result
}

// GetConfig 获取任务配置
func (t *BatchTask) GetConfig() *BatchConfig {
	var taskConfig struct {
		Basic     *BasicConfig     `json:"basic"`
		Silent    *SilentConfig    `json:"silent"`
		AutoClick *AutoClickConfig `json:"autoclick"`
	}

	if len(t.Config) > 0 {
		json.Unmarshal(t.Config, &taskConfig)
	}

	// 根据任务模式返回对应的配置
	switch t.Mode {
	case ModeBasic:
		if taskConfig.Basic != nil {
			return &BatchConfig{
				AccessMethod: "basic",
				Timeout:      30,
				RetryCount:   3,
				Headers:      nil,
			}
		}
	case ModeSilent:
		if taskConfig.Silent != nil {
			return &BatchConfig{
				AccessMethod: "silent",
				Timeout:      taskConfig.Silent.Timeout,
				RetryCount:   taskConfig.Silent.RetryCount,
				Headers:      taskConfig.Silent.Headers,
			}
		}
	case ModeAutoClick:
		if taskConfig.AutoClick != nil {
			return &BatchConfig{
				AccessMethod: "autoclick",
				Timeout:      30,
				RetryCount:   3,
			}
		}
	}

	// 默认配置
	return &BatchConfig{
		AccessMethod: string(t.Mode),
		Timeout:      30,
		RetryCount:   3,
	}
}
