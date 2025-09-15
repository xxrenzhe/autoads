package batchgo

import (
    "time"
)

// BatchJob 统一批处理任务（basic/silent/autoclick）
type BatchJob struct {
    ID        string    `json:"id" gorm:"primaryKey;size:36"`
    UserID    string    `json:"userId" gorm:"index;size:36"`
    Type      string    `json:"type" gorm:"size:20"` // BASIC|SILENT|AUTOCLICK
    Status    string    `json:"status" gorm:"size:20"`
    Options   string    `json:"options" gorm:"type:json"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}

func (BatchJob) TableName() string { return "batch_jobs" }

// BatchJobItem 任务明细项
type BatchJobItem struct {
    ID        string    `json:"id" gorm:"primaryKey;size:36"`
    JobID     string    `json:"jobId" gorm:"index;size:36"`
    URL       string    `json:"url" gorm:"type:text"`
    Status    string    `json:"status" gorm:"size:20"` // pending|success|failed
    Result    string    `json:"result" gorm:"type:json"`
    Retries   int       `json:"retries"`
    LastError string    `json:"lastError" gorm:"type:text"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}

func (BatchJobItem) TableName() string { return "batch_job_items" }

// BatchJobProgress 聚合进度（可选）
type BatchJobProgress struct {
    JobID     string    `json:"jobId" gorm:"primaryKey;size:36"`
    Total     int       `json:"total"`
    Success   int       `json:"success"`
    Fail      int       `json:"fail"`
    Running   int       `json:"running"`
    StartedAt *time.Time `json:"startedAt"`
    FinishedAt *time.Time `json:"finishedAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}

func (BatchJobProgress) TableName() string { return "batch_job_progress" }

