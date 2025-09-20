//go:build autoads_advanced

package concurrent

import "time"

// Task represents an advanced BatchGo task mapped to batch_tasks table.
type ExecTask struct {
	ID     string `gorm:"primaryKey;size:36"`
	UserID string `gorm:"size:36;index"`
	Name   string `gorm:"size:255"`
	// URLs as a simple JSON-encoded string column for compatibility.
	URLs          []string `gorm:"-"`
	URLsJSON      string   `gorm:"column:urls;type:text"`
	Type          string   `gorm:"size:50"`
	Status        string   `gorm:"size:50"`
	TokenCost     int      `gorm:"default:0"`
	OpenCount     int
	CycleCount    int
	OpenInterval  int
	ProxyURL      string `gorm:"size:500"`
	RefererOption string `gorm:"size:50"`

	// Progress
	SuccessUrls int
	FailedUrls  int
	Progress    int

	// Timestamps
	StartedAt   *time.Time
	CompletedAt *time.Time
	UpdatedAt   time.Time
	CreatedAt   time.Time
}

func (ExecTask) TableName() string { return "batch_tasks" }

// CanExecute returns whether the task is eligible to run.
func (t *ExecTask) CanExecute() bool {
	switch t.Status {
	case "queued", "pending", "PENDING":
		return true
	default:
		return false
	}
}

// TaskResult represents advanced per-URL execution result.
type ExecTaskResult struct {
	ID           string `gorm:"primaryKey;size:36"`
	TaskID       string `gorm:"size:36;index"`
	URL          string `gorm:"size:1000"`
	Status       string `gorm:"size:50"`
	StatusCode   int
	Error        string `gorm:"type:text"`
	CreatedAt    time.Time
	StartTime    *time.Time
	EndTime      *time.Time
	Duration     int64
	ResponseTime int
}

func (ExecTaskResult) TableName() string { return "batch_task_results" }
