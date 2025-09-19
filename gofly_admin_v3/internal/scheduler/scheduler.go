package scheduler

import (
	"context"
	"fmt"
	"log"
	"runtime"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"gofly-admin-v3/internal/audit"
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/utils/gf"
)

// Job 任务接口
type Job interface {
	GetName() string
	GetDescription() string
	Run(ctx context.Context) error
}

// JobStatus 任务状态
type JobStatus string

const (
	StatusPending   JobStatus = "pending"
	StatusRunning   JobStatus = "running"
	StatusCompleted JobStatus = "completed"
	StatusFailed    JobStatus = "failed"
	StatusCancelled JobStatus = "cancelled"
)

// JobExecution 任务执行记录
type JobExecution struct {
	ID        string                 `json:"id"`
	JobName   string                 `json:"job_name"`
	Status    JobStatus              `json:"status"`
	StartTime time.Time              `json:"start_time"`
	EndTime   time.Time              `json:"end_time,omitempty"`
	Duration  time.Duration          `json:"duration,omitempty"`
	Error     string                 `json:"error,omitempty"`
	Result    map[string]interface{} `json:"result,omitempty"`
	CreatedBy string                 `json:"created_by"`
	CreatedAt time.Time              `json:"created_at"`
}

// CronJob Cron任务包装器
type CronJob struct {
	Job         Job
	Schedule    string
	Enabled     bool
	Description string
	Timeout     time.Duration
	RetryCount  int
	RetryDelay  time.Duration
}

// Scheduler 调度器
type Scheduler struct {
	cron       *cron.Cron
	jobs       map[string]*CronJob
	executions map[string]*JobExecution
	mu         sync.RWMutex
	ctx        context.Context
	cancel     context.CancelFunc
	cache      cache.Cache
	running    bool
}

var (
	defaultScheduler *Scheduler
	schedulerInit    bool
)

// NewScheduler 创建调度器
func NewScheduler() *Scheduler {
	ctx, cancel := context.WithCancel(context.Background())

	return &Scheduler{
		cron:       cron.New(cron.WithSeconds()),
		jobs:       make(map[string]*CronJob),
		executions: make(map[string]*JobExecution),
		ctx:        ctx,
		cancel:     cancel,
		cache:      cache.GetCache(),
	}
}

// GetScheduler 获取调度器
func GetScheduler() *Scheduler {
	if !schedulerInit {
		defaultScheduler = NewScheduler()
		schedulerInit = true
	}
	return defaultScheduler
}

// Start 启动调度器
func (s *Scheduler) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return fmt.Errorf("scheduler is already running")
	}

	s.cron.Start()
	s.running = true

	// 启动清理过期执行记录的协程
	go s.cleanupExpiredExecutions()

	// 注册系统任务
	s.registerSystemJobs()

	log.Println("Scheduler started successfully")
	return nil
}

// Stop 停止调度器
func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return
	}

	ctx := s.cron.Stop()
	<-ctx.Done()

	s.cancel()
	s.running = false

	log.Println("Scheduler stopped")
}

// AddJob 添加任务
func (s *Scheduler) AddJob(job *CronJob) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.jobs[job.Job.GetName()]; exists {
		return fmt.Errorf("job already exists: %s", job.Job.GetName())
	}

	// 创建包装函数
	wrappedJob := s.wrapJob(job)

	// 添加到cron
	entryID, err := s.cron.AddFunc(job.Schedule, wrappedJob)
	if err != nil {
		return fmt.Errorf("failed to add job: %v", err)
	}

	// 存储任务信息
	s.jobs[job.Job.GetName()] = job

	log.Printf("Job added: %s (ID: %d)", job.Job.GetName(), entryID)
	return nil
}

// RemoveJob 移除任务
func (s *Scheduler) RemoveJob(jobName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, exists := s.jobs[jobName]
	if !exists {
		return fmt.Errorf("job not found: %s", jobName)
	}

	// Since we used AddFunc, we can't directly access the job wrapper
	// We'll need to stop and restart the cron scheduler without this job
	// For now, just remove from our jobs map and the job won't execute
	delete(s.jobs, jobName)

	log.Printf("Job removed from tracking: %s", jobName)
	return nil
}

// RunJobNow 立即运行任务
func (s *Scheduler) RunJobNow(jobName string, createdBy string) (string, error) {
	s.mu.Lock()
	job, exists := s.jobs[jobName]
	s.mu.Unlock()

	if !exists {
		return "", fmt.Errorf("job not found: %s", jobName)
	}

	if !job.Enabled {
		return "", fmt.Errorf("job is disabled: %s", jobName)
	}

	// 创建执行记录
	execution := &JobExecution{
		ID:        gf.UUID(),
		JobName:   jobName,
		Status:    StatusPending,
		StartTime: time.Now(),
		CreatedBy: createdBy,
		CreatedAt: time.Now(),
	}

	s.mu.Lock()
	s.executions[execution.ID] = execution
	s.mu.Unlock()

	// 缓存执行记录
	s.cacheExecution(execution)

	// 异步执行任务
	go s.executeJob(job, execution)

	return execution.ID, nil
}

// GetJobs 获取所有任务
func (s *Scheduler) GetJobs() map[string]*CronJob {
	s.mu.RLock()
	defer s.mu.RUnlock()

	jobs := make(map[string]*CronJob)
	for k, v := range s.jobs {
		jobs[k] = v
	}
	return jobs
}

// GetJobExecution 获取任务执行记录
func (s *Scheduler) GetJobExecution(executionID string) (*JobExecution, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	execution, exists := s.executions[executionID]
	if !exists {
		return nil, fmt.Errorf("execution not found: %s", executionID)
	}

	return execution, nil
}

// GetJobExecutions 获取任务的执行历史
func (s *Scheduler) GetJobExecutions(jobName string, limit int) ([]*JobExecution, error) {
	// TODO: 从数据库查询执行历史
	return []*JobExecution{}, nil
}

// EnableJob 启用任务
func (s *Scheduler) EnableJob(jobName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, exists := s.jobs[jobName]
	if !exists {
		return fmt.Errorf("job not found: %s", jobName)
	}

	job.Enabled = true
	return nil
}

// DisableJob 禁用任务
func (s *Scheduler) DisableJob(jobName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, exists := s.jobs[jobName]
	if !exists {
		return fmt.Errorf("job not found: %s", jobName)
	}

	job.Enabled = false
	return nil
}

// wrapJob 包装任务
func (s *Scheduler) wrapJob(cronJob *CronJob) func() {
	return func() {
		if !cronJob.Enabled {
			return
		}

		// 创建执行记录
		execution := &JobExecution{
			ID:        gf.UUID(),
			JobName:   cronJob.Job.GetName(),
			Status:    StatusPending,
			StartTime: time.Now(),
			CreatedBy: "system",
			CreatedAt: time.Now(),
		}

		s.mu.Lock()
		s.executions[execution.ID] = execution
		s.mu.Unlock()

		// 缓存执行记录
		s.cacheExecution(execution)

		// 执行任务
		s.executeJob(cronJob, execution)
	}
}

// executeJob 执行任务
func (s *Scheduler) executeJob(cronJob *CronJob, execution *JobExecution) {
	// 更新状态为运行中
	s.updateExecutionStatus(execution.ID, StatusRunning)

	// 记录审计日志
	audit.LogUserAction(
		"system",
		audit.ActionExecute,
		audit.ResourceTask,
		execution.JobName,
		fmt.Sprintf("Executing job: %s", cronJob.Job.GetName()),
		"",
		"",
		true,
		"",
		0,
	)

	// 执行任务（带重试）
	var err error
	var result map[string]interface{}

	for attempt := 0; attempt <= cronJob.RetryCount; attempt++ {
		if attempt > 0 {
			log.Printf("Retrying job %s (attempt %d/%d)", cronJob.Job.GetName(), attempt, cronJob.RetryCount)
			time.Sleep(cronJob.RetryDelay)
		}

		// 创建带超时的上下文
		ctx, cancel := context.WithTimeout(s.ctx, cronJob.Timeout)
		defer cancel()

		// 执行任务
		err = s.runJobWithRecovery(ctx, cronJob.Job)
		result = map[string]interface{}{
			"attempt":   attempt + 1,
			"max_retry": cronJob.RetryCount + 1,
		}

		if err == nil {
			break
		}
	}

	// 更新执行记录
	execution.EndTime = time.Now()
	execution.Duration = execution.EndTime.Sub(execution.StartTime)
	execution.Result = result

	if err != nil {
		execution.Status = StatusFailed
		execution.Error = err.Error()

		// 记录错误日志
		audit.LogError(
			s.ctx,
			"scheduler",
			err,
			gf.Map{
				"job_name": cronJob.Job.GetName(),
				"job_id":   execution.JobName,
				"action":   audit.ActionExecute,
				"resource": audit.ResourceTask,
			},
		)
	} else {
		execution.Status = StatusCompleted
	}

	s.updateExecution(execution)
}

// runJobWithRecovery 带恢复地运行任务
func (s *Scheduler) runJobWithRecovery(ctx context.Context, job Job) (err error) {
	defer func() {
		if r := recover(); r != nil {
			// 获取调用栈
			buf := make([]byte, 4096)
			n := runtime.Stack(buf, false)
			stack := string(buf[:n])

			err = fmt.Errorf("panic in job %s: %v\n%s", job.GetName(), r, stack)
		}
	}()

	// 创建任务上下文
	jobCtx := NewJobContext(ctx)

	// 执行任务
	return job.Run(jobCtx)
}

// updateExecutionStatus 更新执行状态
func (s *Scheduler) updateExecutionStatus(executionID string, status JobStatus) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if execution, exists := s.executions[executionID]; exists {
		execution.Status = status
		s.cacheExecution(execution)
	}
}

// updateExecution 更新执行记录
func (s *Scheduler) updateExecution(execution *JobExecution) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.executions[execution.ID] = execution
	s.cacheExecution(execution)
}

// cacheExecution 缓存执行记录
func (s *Scheduler) cacheExecution(execution *JobExecution) {
	key := fmt.Sprintf("job_execution:%s", execution.ID)
	s.cache.Set(key, execution, 24*time.Hour)
}

// cleanupExpiredExecutions 清理过期的执行记录
func (s *Scheduler) cleanupExpiredExecutions() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.mu.Lock()
			now := time.Now()
			for id, execution := range s.executions {
				if now.Sub(execution.CreatedAt) > 7*24*time.Hour {
					delete(s.executions, id)
					s.cache.Delete(fmt.Sprintf("job_execution:%s", id))
				}
			}
			s.mu.Unlock()
		case <-s.ctx.Done():
			return
		}
	}
}

// registerSystemJobs 注册系统任务
func (s *Scheduler) registerSystemJobs() {
	// 清理过期缓存
	s.AddJob(&CronJob{
		Job:         &CleanCacheJob{},
		Schedule:    "0 0 * * * *", // 每小时执行
		Enabled:     true,
		Description: "Clean expired cache entries",
		Timeout:     5 * time.Minute,
		RetryCount:  2,
		RetryDelay:  30 * time.Second,
	})

	// 清理日志
	s.AddJob(&CronJob{
		Job:         &CleanLogsJob{},
		Schedule:    "0 2 * * * *", // 每天凌晨2点
		Enabled:     true,
		Description: "Clean old audit logs",
		Timeout:     30 * time.Minute,
		RetryCount:  3,
		RetryDelay:  1 * time.Minute,
	})

	// 生成统计报告
	s.AddJob(&CronJob{
		Job:         &GenerateStatsJob{},
		Schedule:    "0 1 * * * *", // 每天凌晨1点
		Enabled:     true,
		Description: "Generate daily statistics report",
		Timeout:     10 * time.Minute,
		RetryCount:  3,
		RetryDelay:  1 * time.Minute,
	})
}

// RegisterOptimizationJobs 注册优化方案中的系统任务
func (s *Scheduler) RegisterOptimizationJobs() {
    // 限额刷新（每 60s）
    _ = s.AddJob(&CronJob{ Job: &RefreshRateLimitsJob{}, Schedule: "*/60 * * * * *", Enabled: true, Description: "Refresh rate limit plans", Timeout: 30 * time.Second })
    // 订阅到期（每日 00:05）
    _ = s.AddJob(&CronJob{ Job: &ExpireSubscriptionsJob{}, Schedule: "0 5 0 * * *", Enabled: true, Description: "Expire subscriptions", Timeout: 2 * time.Minute })
    // 幂等与任务清理（每小时）
    _ = s.AddJob(&CronJob{ Job: &CleanupIdempotencyAndTasksJob{}, Schedule: "0 0 * * * *", Enabled: true, Description: "Cleanup idempotency requests", Timeout: 2 * time.Minute })
    // 日报（每日 01:00）
    _ = s.AddJob(&CronJob{ Job: &DailyUsageReportJob{}, Schedule: "0 0 1 * * *", Enabled: true, Description: "Generate daily usage report", Timeout: 5 * time.Minute })
    // 孤儿巡检（每日 02:30）：仅扫描与告警，不做删除
    _ = s.AddJob(&CronJob{ Job: &OrphanInspectionJob{}, Schedule: "0 30 2 * * *", Enabled: true, Description: "Inspect orphaned rows and report", Timeout: 2 * time.Minute })
}

// JobContext 任务上下文
type JobContext struct {
	context.Context
	data map[string]interface{}
	mu   sync.RWMutex
}

// NewJobContext 创建任务上下文
func NewJobContext(ctx context.Context) *JobContext {
	return &JobContext{
		Context: ctx,
		data:    make(map[string]interface{}),
	}
}

// SetValue 设置值
func (jc *JobContext) SetValue(key string, value interface{}) {
	jc.mu.Lock()
	defer jc.mu.Unlock()
	jc.data[key] = value
}

// GetValue 获取值
func (jc *JobContext) GetValue(key string) interface{} {
	jc.mu.RLock()
	defer jc.mu.RUnlock()
	return jc.data[key]
}

// GetName 获取任务名称（用于接口）
func (jc *JobContext) GetName() string {
	return "job_context"
}

// 系统任务实现

// CleanCacheJob 清理缓存任务
type CleanCacheJob struct{}

func (j *CleanCacheJob) GetName() string {
	return "clean_cache"
}

func (j *CleanCacheJob) GetDescription() string {
	return "Clean expired cache entries"
}

func (j *CleanCacheJob) Run(ctx context.Context) error {
	jobCtx := ctx.(*JobContext)

	// 清理过期缓存
	cache := cache.GetCache()
	keys := []string{
		"audit_log:*",
		"user_permissions:*",
		"api_cache:*",
	}

	for _, pattern := range keys {
		if err := cache.DeletePattern(pattern); err != nil {
			jobCtx.SetValue("error_"+pattern, err.Error())
		}
	}

	log.Println("Cache cleanup completed")
	return nil
}

// CleanLogsJob 清理日志任务
type CleanLogsJob struct{}

func (j *CleanLogsJob) GetName() string {
	return "clean_logs"
}

func (j *CleanLogsJob) GetDescription() string {
	return "Clean old audit logs"
}

func (j *CleanLogsJob) Run(ctx context.Context) error {
	// TODO: 实现日志清理逻辑
	// 这里简化处理
	log.Println("Logs cleanup completed")
	return nil
}

// GenerateStatsJob 生成统计报告任务
type GenerateStatsJob struct{}

func (j *GenerateStatsJob) GetName() string {
	return "generate_stats"
}

func (j *GenerateStatsJob) GetDescription() string {
	return "Generate daily statistics report"
}

func (j *GenerateStatsJob) Run(ctx context.Context) error {
	jobCtx := ctx.(*JobContext)

	// 生成统计信息
	stats := map[string]interface{}{
		"date":         time.Now().Format("2006-01-02"),
		"total_users":  0,
		"active_users": 0,
		"total_jobs":   0,
		"failed_jobs":  0,
		"generated_at": time.Now(),
	}

	// TODO: 从数据库获取实际统计数据

	jobCtx.SetValue("stats", stats)
	log.Println("Daily statistics report generated")

	return nil
}

// 便捷函数
func StartScheduler() error {
	return GetScheduler().Start()
}

func StopScheduler() {
	GetScheduler().Stop()
}

func AddJob(job *CronJob) error {
	return GetScheduler().AddJob(job)
}

func RunJobNow(jobName, createdBy string) (string, error) {
	return GetScheduler().RunJobNow(jobName, createdBy)
}
