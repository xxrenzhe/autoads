package autoclick

import (
    "time"
    "gorm.io/datatypes"
)

type ScheduleStatus string

const (
    StatusEnabled  ScheduleStatus = "ENABLED"
    StatusDisabled ScheduleStatus = "DISABLED"
)

type AutoClickSchedule struct {
    ID           string         `json:"id" gorm:"primaryKey;size:36"`
    UserID       string         `json:"userId" gorm:"index;size:36"`
    Name         string         `json:"name"`
    URLs         datatypes.JSON `json:"urls" gorm:"type:json"`
    Timezone     string         `json:"timezone"`
    TimeWindow   string         `json:"timeWindow"` // 00:00-24:00 / 06:00-24:00
    DailyTarget  int            `json:"dailyTarget"`
    RefererType  string         `json:"refererType"`
    RefererValue string         `json:"refererValue"`
    ProxyURL     *string        `json:"proxyUrl"`
    Status       string         `json:"status" gorm:"index"`
    LastRunAt    *time.Time     `json:"lastRunAt"`
    NextRunAt    *time.Time     `json:"nextRunAt"`
    CreatedAt    time.Time      `json:"createdAt"`
    UpdatedAt    time.Time      `json:"updatedAt"`
}

func (AutoClickSchedule) TableName() string { return "autoclick_schedules" }

type AutoClickDailyPlan struct {
    ID          string         `json:"id" gorm:"primaryKey;size:36"`
    ScheduleID  string         `json:"scheduleId" gorm:"index;size:36"`
    UserID      string         `json:"userId" gorm:"index;size:36"`
    Date        string         `json:"date" gorm:"index;size:10"` // yyyy-mm-dd (local timezone of schedule)
    Distribution datatypes.JSON `json:"distribution" gorm:"type:json"` // [24]int
    Variance    float64        `json:"variance"`
    WeightProfile string       `json:"weightProfile"`
    CreatedAt   time.Time      `json:"createdAt"`
}

func (AutoClickDailyPlan) TableName() string { return "autoclick_daily_plans" }

type AutoClickExecution struct {
    ID         string     `json:"id" gorm:"primaryKey;size:36"`
    ScheduleID string     `json:"scheduleId" gorm:"index;size:36"`
    UserID     string     `json:"userId" gorm:"index;size:36"`
    Date       string     `json:"date" gorm:"index;size:10"`
    Status     string     `json:"status"`
    Message    string     `json:"message" gorm:"type:text"`
    Progress   int        `json:"progress"`
    Success    int        `json:"success"`
    Fail       int        `json:"fail"`
    Total      int        `json:"total"`
    StartedAt  *time.Time `json:"startedAt"`
    CompletedAt *time.Time `json:"completedAt"`
    CreatedAt  time.Time  `json:"createdAt"`
    UpdatedAt  time.Time  `json:"updatedAt"`
}

func (AutoClickExecution) TableName() string { return "autoclick_executions" }

type AutoClickExecutionSnapshot struct {
    ID          string    `json:"id" gorm:"primaryKey;size:36"`
    ExecutionID string    `json:"executionId" gorm:"index;size:36"`
    Hour        int       `json:"hour"`
    Success     int       `json:"success"`
    Fail        int       `json:"fail"`
    Total       int       `json:"total"`
    FailedURLs  datatypes.JSON `json:"failedUrls" gorm:"type:json"`
    CreatedAt   time.Time `json:"createdAt"`
}

func (AutoClickExecutionSnapshot) TableName() string { return "autoclick_execution_snapshots" }

type AutoClickURLFailure struct {
    ID                     string    `json:"id" gorm:"primaryKey;size:36"`
    UserID                 string    `json:"userId" gorm:"index;size:36"`
    URLHash                string    `json:"urlHash" gorm:"index;size:64"`
    URL                    string    `json:"url" gorm:"type:text"`
    HTTPFailConsecutive    int       `json:"httpFailConsecutive"`
    BrowserFailConsecutive int       `json:"browserFailConsecutive"`
    LastFailAt             *time.Time `json:"lastFailAt"`
    PreferBrowserUntil     *time.Time `json:"preferBrowserUntil"`
    Notes                  string    `json:"notes" gorm:"type:text"`
    CreatedAt              time.Time `json:"createdAt"`
    UpdatedAt              time.Time `json:"updatedAt"`
}

func (AutoClickURLFailure) TableName() string { return "autoclick_url_failures" }

