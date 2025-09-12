package concurrent

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"time"

	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/glog"
)

// WorkerPool 工作池
type WorkerPool struct {
	workers   []*Worker
	taskQueue chan Task
	quit      chan struct{}
	wg        sync.WaitGroup
	metrics   *PoolMetrics
	options   PoolOptions
}

// Task 任务接口
type Task interface {
	Execute(ctx context.Context) error
	GetID() string
	GetPriority() int
	GetRetryCount() int
	IncRetryCount()
}

// PoolMetrics 池统计信息
type PoolMetrics struct {
	mu                sync.RWMutex
	TasksProcessed    int64         `json:"tasks_processed"`
	TasksFailed       int64         `json:"tasks_failed"`
	TasksRetried      int64         `json:"tasks_retried"`
	ActiveWorkers     int32         `json:"active_workers"`
	QueueSize         int32         `json:"queue_size"`
	ProcessingTime    time.Duration `json:"processing_time"`
	LastProcessedTime time.Time     `json:"last_processed_time"`
}

// PoolOptions 池配置选项
type PoolOptions struct {
	WorkerCount   int           `json:"worker_count"`
	QueueSize     int           `json:"queue_size"`
	RetryCount    int           `json:"retry_count"`
	RetryDelay    time.Duration `json:"retry_delay"`
	Timeout       time.Duration `json:"timeout"`
	EnableMetrics bool          `json:"enable_metrics"`
}

// Worker 工作器
type Worker struct {
	id      int
	pool    *WorkerPool
	current Task
	active  bool
	wg      sync.WaitGroup
}

// NewWorkerPool 创建工作池
func NewWorkerPool(options PoolOptions) *WorkerPool {
	// 设置默认值
	if options.WorkerCount <= 0 {
		options.WorkerCount = runtime.NumCPU()
	}
	if options.QueueSize <= 0 {
		options.QueueSize = 1000
	}
	if options.RetryCount <= 0 {
		options.RetryCount = 3
	}
	if options.RetryDelay <= 0 {
		options.RetryDelay = time.Second
	}
	if options.Timeout <= 0 {
		options.Timeout = 30 * time.Second
	}

	pool := &WorkerPool{
		taskQueue: make(chan Task, options.QueueSize),
		quit:      make(chan struct{}),
		metrics:   &PoolMetrics{},
		options:   options,
	}

	// 创建工作器
	pool.workers = make([]*Worker, options.WorkerCount)
	for i := 0; i < options.WorkerCount; i++ {
		worker := &Worker{
			id:   i,
			pool: pool,
		}
		pool.workers = append(pool.workers, worker)
	}

	return pool
}

// Start 启动工作池
func (p *WorkerPool) Start() {
	p.wg.Add(len(p.workers))
	for _, worker := range p.workers {
		go worker.start()
	}

	if p.options.EnableMetrics {
		go p.collectMetrics()
	}
}

// Stop 停止工作池
func (p *WorkerPool) Stop() {
	close(p.quit)
	p.wg.Wait()
}

// Submit 提交任务
func (p *WorkerPool) Submit(task Task) error {
	select {
	case p.taskQueue <- task:
		if p.options.EnableMetrics {
			p.metrics.QueueSize = int32(len(p.taskQueue))
		}
		return nil
	default:
		return fmt.Errorf("task queue is full")
	}
}

// TrySubmit 尝试提交任务（非阻塞）
func (p *WorkerPool) TrySubmit(task Task) bool {
	select {
	case p.taskQueue <- task:
		if p.options.EnableMetrics {
			p.metrics.QueueSize = int32(len(p.taskQueue))
		}
		return true
	default:
		return false
	}
}

// GetMetrics 获取池统计信息
func (p *WorkerPool) GetMetrics() PoolMetrics {
	p.metrics.mu.RLock()
	defer p.metrics.mu.RUnlock()
	return *p.metrics
}

// collectMetrics 收集统计信息
func (p *WorkerPool) collectMetrics() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			p.metrics.mu.Lock()
			p.metrics.QueueSize = int32(len(p.taskQueue))
			p.metrics.mu.Unlock()
		case <-p.quit:
			return
		}
	}
}

// Worker methods

func (w *Worker) start() {
	defer w.wg.Done()

	for {
		select {
		case task := <-w.pool.taskQueue:
			w.processTask(task)
		case <-w.pool.quit:
			return
		}
	}
}

func (w *Worker) processTask(task Task) {
	w.current = task
	w.active = true

	if w.pool.options.EnableMetrics {
		w.pool.metrics.mu.Lock()
		w.pool.metrics.ActiveWorkers++
		w.pool.metrics.mu.Unlock()
	}

	defer func() {
		w.active = false
		w.current = nil

		if w.pool.options.EnableMetrics {
			w.pool.metrics.mu.Lock()
			w.pool.metrics.ActiveWorkers--
			w.pool.metrics.LastProcessedTime = time.Now()
			w.pool.metrics.mu.Unlock()
		}
	}()

	// 执行任务
	ctx, cancel := context.WithTimeout(context.Background(), w.pool.options.Timeout)
	defer cancel()

	err := task.Execute(ctx)
	if err != nil {
		w.handleTaskError(task, err)
	} else {
		if w.pool.options.EnableMetrics {
			w.pool.metrics.mu.Lock()
			w.pool.metrics.TasksProcessed++
			w.pool.metrics.mu.Unlock()
		}
	}
}

func (w *Worker) handleTaskError(task Task, err error) {
	glog.Error(context.Background(), "worker_task_error", gform.Map{
		"worker_id":   w.id,
		"task_id":     task.GetID(),
		"error":       err,
		"retry_count": task.GetRetryCount(),
	})

	// 重试逻辑
	if task.GetRetryCount() < w.pool.options.RetryCount {
		task.IncRetryCount()
		time.AfterFunc(w.pool.options.RetryDelay, func() {
			w.pool.Submit(task)
		})

		if w.pool.options.EnableMetrics {
			w.pool.metrics.mu.Lock()
			w.pool.metrics.TasksRetried++
			w.pool.metrics.mu.Unlock()
		}
	} else {
		if w.pool.options.EnableMetrics {
			w.pool.metrics.mu.Lock()
			w.pool.metrics.TasksFailed++
			w.pool.metrics.mu.Unlock()
		}
	}
}

// RateLimiter 速率限制器
type RateLimiter struct {
	rate     int        // 速率（请求/秒）
	bucket   int        // 令牌桶大小
	tokens   int        // 当前令牌数
	lastTime time.Time  // 上次更新时间
	mu       sync.Mutex // 互斥锁
	stopChan chan struct{}
}

// NewRateLimiter 创建速率限制器
func NewRateLimiter(rate, bucket int) *RateLimiter {
	return &RateLimiter{
		rate:     rate,
		bucket:   bucket,
		tokens:   bucket,
		lastTime: time.Now(),
		stopChan: make(chan struct{}),
	}
}

// Allow 判断是否允许通过
func (rl *RateLimiter) Allow() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(rl.lastTime).Seconds()

	// 添加新令牌
	tokensToAdd := int(elapsed * float64(rl.rate))
	if tokensToAdd > 0 {
		rl.tokens = min(rl.bucket, rl.tokens+tokensToAdd)
		rl.lastTime = now
	}

	if rl.tokens > 0 {
		rl.tokens--
		return true
	}

	return false
}

// Wait 等待直到允许通过
func (rl *RateLimiter) Wait(ctx context.Context) error {
	for {
		if rl.Allow() {
			return nil
		}

		select {
		case <-time.After(time.Second / time.Duration(rl.rate)):
			continue
		case <-ctx.Done():
			return ctx.Err()
		case <-rl.stopChan:
			return fmt.Errorf("rate limiter stopped")
		}
	}
}

// Stop 停止速率限制器
func (rl *RateLimiter) Stop() {
	close(rl.stopChan)
}

// CircuitBreaker 熔断器
type CircuitBreaker struct {
	name        string
	maxFailures int
	resetTime   time.Duration

	failures    int
	lastFailure time.Time
	state       CircuitState
	mu          sync.RWMutex

	onStateChange func(oldState, newState CircuitState)
}

// CircuitState 熔断器状态
type CircuitState int

const (
	StateClosed CircuitState = iota
	StateOpen
	StateHalfOpen
)

// NewCircuitBreaker 创建熔断器
func NewCircuitBreaker(name string, maxFailures int, resetTime time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		name:        name,
		maxFailures: maxFailures,
		resetTime:   resetTime,
		state:       StateClosed,
	}
}

// Execute 执行函数
func (cb *CircuitBreaker) Execute(fn func() error) error {
	if !cb.Allow() {
		return fmt.Errorf("circuit breaker is open")
	}

	err := fn()
	if err != nil {
		cb.RecordFailure()
		return err
	}

	cb.RecordSuccess()
	return nil
}

// Allow 判断是否允许执行
func (cb *CircuitBreaker) Allow() bool {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	switch cb.state {
	case StateClosed:
		return true
	case StateOpen:
		return time.Since(cb.lastFailure) > cb.resetTime
	case StateHalfOpen:
		return true
	default:
		return false
	}
}

// RecordFailure 记录失败
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures++
	cb.lastFailure = time.Now()

	if cb.failures >= cb.maxFailures {
		oldState := cb.state
		cb.state = StateOpen

		if cb.onStateChange != nil {
			cb.onStateChange(oldState, cb.state)
		}
	}
}

// RecordSuccess 记录成功
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.state == StateOpen || cb.state == StateHalfOpen {
		oldState := cb.state
		cb.state = StateClosed
		cb.failures = 0

		if cb.onStateChange != nil {
			cb.onStateChange(oldState, cb.state)
		}
	}
}

// GetState 获取当前状态
func (cb *CircuitBreaker) GetState() CircuitState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// SetStateChangeCallback 设置状态变化回调
func (cb *CircuitBreaker) SetStateChangeCallback(fn func(oldState, newState CircuitState)) {
	cb.onStateChange = fn
}

// ConcurrencyLimiter 并发限制器
type ConcurrencyLimiter struct {
	semaphore chan struct{}
}

// NewConcurrencyLimiter 创建并发限制器
func NewConcurrencyLimiter(maxConcurrency int) *ConcurrencyLimiter {
	return &ConcurrencyLimiter{
		semaphore: make(chan struct{}, maxConcurrency),
	}
}

// Acquire 获取许可
func (cl *ConcurrencyLimiter) Acquire(ctx context.Context) error {
	select {
	case cl.semaphore <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Release 释放许可
func (cl *ConcurrencyLimiter) Release() {
	select {
	case <-cl.semaphore:
	default:
	}
}

// Do 执行带并发限制的操作
func (cl *ConcurrencyLimiter) Do(ctx context.Context, fn func() error) error {
	if err := cl.Acquire(ctx); err != nil {
		return err
	}
	defer cl.Release()

	return fn()
}

// utils

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
