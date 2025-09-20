//go:build autoads_siterank_advanced

package siterankgo

import (
	"encoding/json"
	"time"

	"gofly-admin-v3/utils/gf"
)

// SiteRankTask 网站排名任务模型
type SiteRankTask struct {
	ID           string     `json:"id" gform:"primary;auto_id"`
	UserID       string     `json:"user_id" gform:"required;index"`
	Name         string     `json:"name" gform:"max_length:255"`
	Domain       string     `json:"domain" gform:"max_length:255;index"`
	Keywords     string     `json:"-" gform:"type:text"`                                  // JSON格式的关键词列表
	SearchEngine string     `json:"search_engine" gform:"max_length:50;default:'google'"` // google, bing, baidu
	Region       string     `json:"region" gform:"max_length:10;default:'us'"`            // us, uk, cn, etc.
	Language     string     `json:"language" gform:"max_length:10;default:'en'"`          // en, zh, etc.
	Status       string     `json:"status" gform:"default:'PENDING';max_length:20"`       // PENDING, RUNNING, COMPLETED, FAILED
	Progress     int        `json:"progress" gform:"default:0"`                           // 0-100
	TotalCount   int        `json:"total_count" gform:"default:0"`
	SuccessCount int        `json:"success_count" gform:"default:0"`
	FailedCount  int        `json:"failed_count" gform:"default:0"`
	Results      string     `json:"-" gform:"type:text"` // JSON格式的结果数据
	Error        string     `json:"error" gform:"type:text"`
	Config       string     `json:"-" gform:"type:text"`                                // JSON格式的配置信息
	ScheduleType string     `json:"schedule_type" gform:"max_length:20;default:'once'"` // once, daily, weekly
	ScheduleTime string     `json:"schedule_time" gform:"max_length:50"`                // cron表达式
	LastRunAt    *time.Time `json:"last_run_at" gform:"comment:'上次运行时间'"`
	NextRunAt    *time.Time `json:"next_run_at" gform:"comment:'下次运行时间'"`
	StartedAt    *time.Time `json:"started_at" gform:"comment:'任务开始时间'"`
	CompletedAt  *time.Time `json:"completed_at" gform:"comment:'任务完成时间'"`
	CreatedAt    time.Time  `json:"created_at" gform:"auto_time"`
	UpdatedAt    time.Time  `json:"updated_at" gform:"auto_update_time"`
	DeletedAt    *time.Time `json:"-" gform:"soft_delete;index"`
}

// TableName 指定表名
func (SiteRankTask) TableName() string {
	return "site_rank_tasks"
}

// SiteRankResult 网站排名结果模型
type SiteRankResult struct {
	ID           string    `json:"id" gform:"primary;auto_id"`
	TaskID       string    `json:"task_id" gform:"required;index"`
	Keyword      string    `json:"keyword" gform:"max_length:255;index"`
	Position     int       `json:"position" gform:"comment:'排名位置'"`
	PreviousPos  int       `json:"previous_pos" gform:"comment:'上次排名位置'"`
	Change       int       `json:"change" gform:"comment:'排名变化'"`
	URL          string    `json:"url" gform:"max_length:1000"`
	Title        string    `json:"title" gform:"max_length:500"`
	Description  string    `json:"description" gform:"type:text"`
	SERPFeatures string    `json:"-" gform:"type:text"` // JSON格式的SERP特性
	CheckTime    time.Time `json:"check_time" gform:"comment:'检查时间'"`
	CreatedAt    time.Time `json:"created_at" gform:"auto_time"`
}

// TableName 指定表名
func (SiteRankResult) TableName() string {
	return "site_rank_results"
}

// CreateTaskRequest 创建任务请求
type CreateTaskRequest struct {
	Name         string      `json:"name" v:"required|min:1#请输入任务名称"`
	Domain       string      `json:"domain" v:"required|url#请输入有效的域名"`
	Keywords     []string    `json:"keywords" v:"required|min:1#请输入关键词列表"`
	SearchEngine string      `json:"search_engine" v:"in:google,bing,baidu#请选择搜索引擎"`
	Region       string      `json:"region" v:"max_length:10"`
	Language     string      `json:"language" v:"max_length:10"`
	ScheduleType string      `json:"schedule_type" v:"in:once,daily,weekly#请选择调度类型"`
	ScheduleTime string      `json:"schedule_time"`
	Config       *TaskConfig `json:"config"`
}

// UpdateTaskRequest 更新任务请求
type UpdateTaskRequest struct {
	Name         string      `json:"name"`
	Status       string      `json:"status" v:"in:PENDING,RUNNING,COMPLETED,FAILED"`
	Keywords     []string    `json:"keywords"`
	SearchEngine string      `json:"search_engine" v:"in:google,bing,baidu"`
	Region       string      `json:"region"`
	Language     string      `json:"language"`
	ScheduleType string      `json:"schedule_type" v:"in:once,daily,weekly"`
	ScheduleTime string      `json:"schedule_time"`
	Config       *TaskConfig `json:"config"`
}

// TaskConfig 任务配置
type TaskConfig struct {
	Depth            int    `json:"depth" v:"min:1|max:10"`            // 搜索深度
	ProxyURL         string `json:"proxy_url"`                         // 代理URL
	UseMobile        bool   `json:"use_mobile"`                        // 是否使用移动端User-Agent
	IncludeFeatures  bool   `json:"include_features"`                  // 是否包含SERP特性分析
	CheckCompetitors bool   `json:"check_competitors"`                 // 是否检查竞争对手
	CompetitorCount  int    `json:"competitor_count" v:"min:1|max:20"` // 竞争对手数量
	AlertThreshold   int    `json:"alert_threshold" v:"min:1|max:100"` // 排名变化告警阈值
	EnableAlerts     bool   `json:"enable_alerts"`                     // 是否启用告警
}

// SiteRankTaskResponse 任务响应
type SiteRankTaskResponse struct {
	ID           string      `json:"id"`
	UserID       string      `json:"user_id"`
	Name         string      `json:"name"`
	Domain       string      `json:"domain"`
	Keywords     []string    `json:"keywords"`
	SearchEngine string      `json:"search_engine"`
	Region       string      `json:"region"`
	Language     string      `json:"language"`
	Status       string      `json:"status"`
	Progress     int         `json:"progress"`
	TotalCount   int         `json:"total_count"`
	SuccessCount int         `json:"success_count"`
	FailedCount  int         `json:"failed_count"`
	Error        string      `json:"error"`
	Config       *TaskConfig `json:"config"`
	ScheduleType string      `json:"schedule_type"`
	ScheduleTime string      `json:"schedule_time"`
	LastRunAt    *time.Time  `json:"last_run_at"`
	NextRunAt    *time.Time  `json:"next_run_at"`
	StartedAt    *time.Time  `json:"started_at"`
	CompletedAt  *time.Time  `json:"completed_at"`
	CreatedAt    time.Time   `json:"created_at"`
}

// SiteRankResultResponse 结果响应
type SiteRankResultResponse struct {
	*SiteRankResult
	SERPFeatures []string `json:"serp_features"`
}

// ToResponse 转换为响应格式
func (t *SiteRankTask) ToResponse() *SiteRankTaskResponse {
	return &SiteRankTaskResponse{
		ID:           t.ID,
		UserID:       t.UserID,
		Name:         t.Name,
		Domain:       t.Domain,
		Keywords:     parseKeywords(t.Keywords),
		SearchEngine: t.SearchEngine,
		Region:       t.Region,
		Language:     t.Language,
		Status:       t.Status,
		Progress:     t.Progress,
		TotalCount:   t.TotalCount,
		SuccessCount: t.SuccessCount,
		FailedCount:  t.FailedCount,
		Error:        t.Error,
		Config:       parseConfig(t.Config),
		ScheduleType: t.ScheduleType,
		ScheduleTime: t.ScheduleTime,
		LastRunAt:    t.LastRunAt,
		NextRunAt:    t.NextRunAt,
		StartedAt:    t.StartedAt,
		CompletedAt:  t.CompletedAt,
		CreatedAt:    t.CreatedAt,
	}
}

// GetKeywords 获取关键词列表
func (t *SiteRankTask) GetKeywords() []string {
	return parseKeywords(t.Keywords)
}

// SetKeywords 设置关键词列表
func (t *SiteRankTask) SetKeywords(keywords []string) {
	data, _ := json.Marshal(keywords)
	t.Keywords = string(data)
	t.TotalCount = len(keywords)
}

// GetConfig 获取配置
func (t *SiteRankTask) GetConfig() *TaskConfig {
	return parseConfig(t.Config)
}

// SetConfig 设置配置
func (t *SiteRankTask) SetConfig(config *TaskConfig) {
	data, _ := json.Marshal(config)
	t.Config = string(data)
}

// CalculateTokenCost 计算Token消耗
func (t *SiteRankTask) CalculateTokenCost() int64 {
	// 基础费用：每个关键词每次检查消耗0.5 Token
	baseCost := int64(t.TotalCount) * 50

	// 搜索引擎加成
	seMultiplier := 1.0
	switch t.SearchEngine {
	case "google":
		seMultiplier = 1.5
	case "bing":
		seMultiplier = 1.2
	case "baidu":
		seMultiplier = 1.3
	}

	// 功能加成
	if t.GetConfig().IncludeFeatures {
		seMultiplier *= 1.3
	}

	if t.GetConfig().CheckCompetitors {
		seMultiplier *= 1.5
	}

	// 调度类型加成
	if t.ScheduleType == "daily" {
		seMultiplier *= 2.0
	} else if t.ScheduleType == "weekly" {
		seMultiplier *= 1.5
	}

	return int64(float64(baseCost) * seMultiplier)
}

// CanExecute 检查是否可以执行
func (t *SiteRankTask) CanExecute() bool {
	return t.Status == "PENDING" || t.Status == "FAILED"
}

// CanCancel 检查是否可以取消
func (t *SiteRankTask) CanCancel() bool {
	return t.Status == "PENDING" || t.Status == "RUNNING"
}

// Validate 验证任务配置
func (t *SiteRankTask) Validate() error {
	keywords := t.GetKeywords()
	if len(keywords) == 0 {
		return gf.Error("关键词不能为空")
	}

	if len(keywords) > 100 {
		return gf.Error("关键词数量不能超过100个")
	}

	if t.SearchEngine != "google" && t.SearchEngine != "bing" && t.SearchEngine != "baidu" {
		return gf.Error("搜索引擎必须是google、bing或baidu")
	}

	config := t.GetConfig()
	if config.Depth < 1 || config.Depth > 10 {
		return gf.Error("搜索深度必须在1-10之间")
	}

	return nil
}

// ToResponse 转换结果为响应格式
func (r *SiteRankResult) ToResponse() *SiteRankResultResponse {
	return &SiteRankResultResponse{
		SiteRankResult: r,
		SERPFeatures:   parseSERPFeatures(r.SERPFeatures),
	}
}

// Helper functions
func parseKeywords(keywords string) []string {
	if keywords == "" {
		return []string{}
	}

	var result []string
	if err := json.Unmarshal([]byte(keywords), &result); err != nil {
		return []string{}
	}
	return result
}

func parseConfig(config string) *TaskConfig {
	if config == "" {
		return &TaskConfig{}
	}

	var result TaskConfig
	if err := json.Unmarshal([]byte(config), &result); err != nil {
		return &TaskConfig{}
	}
	return &result
}

func parseSERPFeatures(features string) []string {
	if features == "" {
		return []string{}
	}

	var result []string
	if err := json.Unmarshal([]byte(features), &result); err != nil {
		return []string{}
	}
	return result
}
