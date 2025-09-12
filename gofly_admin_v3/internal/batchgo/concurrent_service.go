//go:build autoads_advanced

package batchgo

import (
    "context"
    "fmt"
    "sync"
    "time"

    "gofly-admin-v3/internal/store"
    "gofly-admin-v3/pkg/cache"
    "gofly-admin-v3/pkg/concurrent"
    "gofly-admin-v3/utils/gf"
    "gofly-admin-v3/utils/gform"
    "gofly-admin-v3/utils/tools/glog"
)

// ConcurrentBatchService 并发批量服务
type ConcurrentBatchService struct {
    db             *store.DB
    cache          *cache.AdvancedCache
    workerPool     *concurrent.WorkerPool
    rateLimiter    *concurrent.RateLimiter
    circuitBreaker *concurrent.CircuitBreaker
    concurrency    *concurrent.ConcurrencyLimiter
}

// NewConcurrentBatchService 创建并发批量服务
func NewConcurrentBatchService(db *store.DB, cache *cache.AdvancedCache) *ConcurrentBatchService {
	// 创建工作池
	poolOptions := concurrent.PoolOptions{
		WorkerCount:   10,
		QueueSize:     1000,
		RetryCount:    3,
		RetryDelay:    time.Second,
		Timeout:       30 * time.Second,
		EnableMetrics: true,
	}
	workerPool := concurrent.NewWorkerPool(poolOptions)

	// 创建速率限制器（100个请求/秒）
	rateLimiter := concurrent.NewRateLimiter(100, 200)

	// 创建熔断器
	circuitBreaker := concurrent.NewCircuitBreaker("batchgo", 5, 30*time.Second)

	// 创建并发限制器
	concurrency := concurrent.NewConcurrencyLimiter(50)

	service := &ConcurrentBatchService{
		db:             db,
		cache:          cache,
		workerPool:     workerPool,
		rateLimiter:    rateLimiter,
		circuitBreaker: circuitBreaker,
		concurrency:    concurrency,
	}

	// 启动工作池
	workerPool.Start()

	return service
}

// ExecuteBatchTask 并发执行批量任务
func (s *ConcurrentBatchService) ExecuteBatchTask(ctx context.Context, task *BatchTask) error {
	// 获取URL列表
	urls := task.GetURLs()
	if len(urls) == 0 {
		return fmt.Errorf("没有要处理的URL")
	}

	// 创建结果通道
	results := make(chan *BatchTaskResult, len(urls))
	errors := make(chan error, len(urls))

	// 使用WaitGroup等待所有goroutine完成
	var wg sync.WaitGroup

	// 处理每个URL
	for _, url := range urls {
		wg.Add(1)
		go func(url string) {
			defer wg.Done()

			// 创建子任务
			subTask := &BatchSubTask{
            ID:         gf.UUID(),
				TaskID:     task.ID,
				URL:        url,
				Config:     task.GetConfig(),
				RetryCount: 0,
			}

			// 提交到工作池
			workerTask := NewWorkerTask(subTask, s.processURL)
			if err := s.workerPool.Submit(workerTask); err != nil {
				errors <- fmt.Errorf("提交任务失败: %w", err)
				return
			}

			// 等待任务完成
			result, err := s.waitForTaskCompletion(ctx, workerTask)
			if err != nil {
				errors <- err
				return
			}

			results <- result
		}(url)
	}

	// 等待所有任务完成
	go func() {
		wg.Wait()
		close(results)
		close(errors)
	}()

	// 收集结果
	var successCount, failureCount int
	allResults := make([]*BatchTaskResult, 0, len(urls))

	for result := range results {
		allResults = append(allResults, result)
		if result.Status == "SUCCESS" {
			successCount++
		} else {
			failureCount++
		}
	}

	// 收集错误
	var errorList []error
	for err := range errors {
		errorList = append(errorList, err)
		failureCount++
	}

	// 更新任务状态
    task.Status = BatchTaskStatus("COMPLETED")
    task.SuccessCount = successCount
    task.FailedCount = failureCount
    task.UpdatedAt = time.Now()

	// 保存结果
	if err := s.saveTaskResults(ctx, task, allResults); err != nil {
		glog.Error(ctx, "save_task_results_error", gform.Map{
			"task_id": task.ID,
			"error":   err,
		})
	}

	// 如果有错误，返回第一个错误
	if len(errorList) > 0 {
		return errorList[0]
	}

	return nil
}

// processURL 处理单个URL
func (s *ConcurrentBatchService) processURL(ctx context.Context, task *BatchSubTask) (*BatchTaskResult, error) {
	// 应用速率限制
	if err := s.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limit exceeded: %w", err)
	}

	// 应用并发限制
	if err := s.concurrency.Do(ctx, func() error {
		// 使用熔断器执行
		return s.circuitBreaker.Execute(func() error {
			// 检查缓存
			cacheKey := fmt.Sprintf("batchgo:task:%s:url:%s", task.TaskID, task.URL)

			result, err := s.cache.GetOrSet(ctx, cacheKey, time.Hour, func() (interface{}, error) {
				// 执行实际的URL处理
				return s.executeURL(ctx, task)
			})

			if err != nil {
				return err
			}

			taskResult, ok := result.(*BatchTaskResult)
			if !ok {
				return fmt.Errorf("invalid result type")
			}

			// 保存结果到数据库
            if err := s.saveTaskResult(ctx, task, taskResult); err != nil {
                glog.Warning(ctx, "save_task_result_failed", gform.Map{
                    "task_id": task.ID,
                    "url":     task.URL,
                    "error":   err,
                })
            }

			return nil
		})
	}); err != nil {
		return nil, err
	}

	return nil, nil
}

// executeURL 执行URL处理
func (s *ConcurrentBatchService) executeURL(ctx context.Context, task *BatchSubTask) (*BatchTaskResult, error) {
    // start := time.Now()

	// 根据访问方式选择处理器
	var accessor TaskAccessor
	switch task.Config.AccessMethod {
	case "http":
		accessor = NewHTTPAccessor()
	case "puppeteer":
		accessor = NewPuppeteerAccessor()
	default:
		accessor = NewHTTPAccessor()
	}

	// 执行访问
	result, err := accessor.Execute(ctx, task.ParentTask, task.URL)
	if err != nil {
		return nil, fmt.Errorf("execute failed: %w", err)
	}

	// 记录处理时间
    // result processing time not persisted in current model; skip storing

	// 更新统计信息
	s.updateMetrics(ctx, result)

	return result, nil
}

// waitForTaskCompletion 等待任务完成
func (s *ConcurrentBatchService) waitForTaskCompletion(ctx context.Context, task *WorkerTask) (*BatchTaskResult, error) {
	select {
	case result := <-task.Result:
		return result, nil
	case err := <-task.Error:
		return nil, err
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(30 * time.Second):
		return nil, fmt.Errorf("task timeout")
	}
}

// saveTaskResults 保存任务结果
func (s *ConcurrentBatchService) saveTaskResults(ctx context.Context, task *BatchTask, results []*BatchTaskResult) error {
	// 使用事务保存结果
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 批量插入结果
	for _, result := range results {
		dbResult := &BatchTaskResult{
			TaskID:       task.ID,
			URL:          result.URL,
			Status:       result.Status,
			StatusCode:   result.StatusCode,
			ResponseTime: result.ResponseTime,
			Data:         result.Data,
			Error:        result.Error,
			CreatedAt:    time.Now(),
		}

		if err := tx.Create(dbResult).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("save result failed: %w", err)
		}
	}

	return tx.Commit().Error
}

// saveTaskResult 保存单个任务结果
func (s *ConcurrentBatchService) saveTaskResult(ctx context.Context, task *BatchSubTask, result *BatchTaskResult) error {
	dbResult := &BatchTaskResult{
		TaskID:       task.ID,
		URL:          task.URL,
		Status:       result.Status,
		StatusCode:   result.StatusCode,
		ResponseTime: result.ResponseTime,
		Data:         result.Data,
		Error:        result.Error,
		CreatedAt:    time.Now(),
	}

	return s.db.Create(dbResult).Error
}

// updateMetrics 更新统计信息
func (s *ConcurrentBatchService) updateMetrics(ctx context.Context, result *BatchTaskResult) {
	// 更新缓存统计
	cacheKey := fmt.Sprintf("batchgo:metrics:daily:%s", time.Now().Format("2006-01-02"))

	_, err := s.cache.Increment(ctx, cacheKey, 1)
    if err != nil { glog.Warning(ctx, "update_metrics_failed", gform.Map{"error": err}) }

	// 记录到日志
    glog.Info(ctx, "batchgo_url_processed", gform.Map{
        "status":        result.Status,
        "response_time": result.ResponseTime,
        "cache_hit":     false,
    })
}

// GetMetrics 获取服务统计信息
func (s *ConcurrentBatchService) GetMetrics(ctx context.Context) (map[string]interface{}, error) {
	metrics := make(map[string]interface{})

	// 工作池统计
	poolMetrics := s.workerPool.GetMetrics()
	metrics["worker_pool"] = poolMetrics

	// 今日处理统计
	cacheKey := fmt.Sprintf("batchgo:metrics:daily:%s", time.Now().Format("2006-01-02"))
	todayCount, err := s.cache.Get(ctx, cacheKey)
	if err == nil {
		if count, ok := todayCount.(int64); ok {
			metrics["today_processed"] = count
		}
	}

	// 熔断器状态
	metrics["circuit_breaker_state"] = s.circuitBreaker.GetState()

	return metrics, nil
}

// Close 关闭服务
func (s *ConcurrentBatchService) Close() {
	s.workerPool.Stop()
	s.rateLimiter.Stop()
}

// BatchSubTask 子任务
type BatchSubTask struct {
	ID         string
	TaskID     string
	URL        string
	Config     *BatchConfig
	RetryCount int
	ParentTask *BatchTask
}

// WorkerTask 工作池任务
type WorkerTask struct {
    ID     string
    Task   *BatchSubTask
    Result chan *BatchTaskResult
    Error  chan error
    processor func(context.Context, *BatchSubTask) (*BatchTaskResult, error)
}

// NewWorkerTask 创建工作池任务
func NewWorkerTask(task *BatchSubTask, processor func(context.Context, *BatchSubTask) (*BatchTaskResult, error)) *WorkerTask {
    workerTask := &WorkerTask{
        ID:     gf.UUID(),
        Task:   task,
        Result: make(chan *BatchTaskResult, 1),
        Error:  make(chan error, 1),
    }

    // 设置执行函数
    workerTask.processor = processor

	return workerTask
}

// Execute 实现Task接口
func (wt *WorkerTask) Execute(ctx context.Context) error {
    result, err := wt.processor(ctx, wt.Task)
    if err != nil {
        wt.Error <- err
        return err
    }

	wt.Result <- result
	return nil
}

// GetID 实现Task接口
func (wt *WorkerTask) GetID() string {
	return wt.ID
}

// GetPriority 实现Task接口
func (wt *WorkerTask) GetPriority() int {
	return 1
}

// GetRetryCount 实现Task接口
func (wt *WorkerTask) GetRetryCount() int {
	return wt.Task.RetryCount
}

// IncRetryCount 实现Task接口
func (wt *WorkerTask) IncRetryCount() {
	wt.Task.RetryCount++
}
