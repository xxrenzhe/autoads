package batchgo

import (
    "context"
    "encoding/json"
    "fmt"
    "math/rand"
    "net/http"
    "sync"
    "time"

    "github.com/google/uuid"
    "gorm.io/gorm"
    "gofly-admin-v3/internal/audit"
)

// Service BatchGo服务
type Service struct {
    db           *gorm.DB
    tokenService TokenService // Token服务接口
    wsManager    WSManager    // WebSocket管理器接口
    httpClient   *http.Client
    audit        *audit.AutoAdsAuditService
    // 运行中任务的取消函数（仅 Silent 可中断）
    cancelMu     sync.Mutex
    cancels      map[string]context.CancelFunc
}

// TokenService Token服务接口
type TokenService interface {
	CheckTokenSufficiency(userID, service, action string, quantity int) (bool, int, int, error)
	ConsumeTokensByService(userID, service, action string, quantity int, reference string) error
}

// WSManager WebSocket管理器接口
type WSManager interface {
	SendToUser(userID string, message interface{}) error
	BroadcastToUser(userID string, message interface{}) error
}

// NewService 创建BatchGo服务
func NewService(db *gorm.DB, tokenService TokenService, wsManager WSManager, auditSvc *audit.AutoAdsAuditService) *Service {
    return &Service{
        db:           db,
        tokenService: tokenService,
        wsManager:    wsManager,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
        cancels: make(map[string]context.CancelFunc),
        audit:   auditSvc,
    }
}

// registerCancel 记录任务的取消函数
func (s *Service) registerCancel(taskID string, cancel context.CancelFunc) {
    s.cancelMu.Lock()
    s.cancels[taskID] = cancel
    s.cancelMu.Unlock()
}

// popCancel 取出并删除取消函数
func (s *Service) popCancel(taskID string) (cancel context.CancelFunc) {
    s.cancelMu.Lock()
    cancel, _ = s.cancels[taskID]
    delete(s.cancels, taskID)
    s.cancelMu.Unlock()
    return
}

// CreateTask 创建批处理任务
func (s *Service) CreateTask(userID string, req *CreateTaskRequest) (*BatchTask, error) {
	// 1. 验证请求
	if err := s.validateCreateRequest(req); err != nil {
		return nil, err
	}

	// 2. 计算Token消费
	var action string
	switch req.Mode {
	case ModeBasic:
		action = "http" // Basic模式使用HTTP计费
	case ModeSilent:
		action = "http" // Silent模式使用HTTP计费
	case ModeAutoClick:
		action = "puppeteer" // AutoClick模式使用Puppeteer计费
	default:
		return nil, fmt.Errorf("不支持的任务模式: %s", req.Mode)
	}

	// 3. 检查Token是否足够
	sufficient, balance, cost, err := s.tokenService.CheckTokenSufficiency(
		userID, "batchgo", action, len(req.URLs))
	if err != nil {
		return nil, err
	}
	if !sufficient {
		return nil, fmt.Errorf("Token余额不足，需要%d，当前%d", cost, balance)
	}

	// 4. 准备URL数据
	urls := make([]BatchTaskURL, len(req.URLs))
	for i, url := range req.URLs {
		urls[i] = BatchTaskURL{
			URL:    url,
			Status: "pending",
		}
	}
	urlsJSON, _ := json.Marshal(urls)

	// 5. 准备配置数据
	configJSON, _ := json.Marshal(req.Config)

	// 6. 创建任务
	task := &BatchTask{
		ID:        uuid.New().String(),
		UserID:    userID,
		Name:      req.Name,
		Mode:      req.Mode,
		Status:    StatusPending,
		URLs:      urlsJSON,
		URLCount:  len(req.URLs),
		Config:    configJSON,
		TokenCost: cost,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 7. 保存到数据库
	if err := s.db.Create(task).Error; err != nil {
		return nil, fmt.Errorf("创建任务失败: %w", err)
	}

	return task, nil
}

// StartTask 启动任务
func (s *Service) StartTask(userID, taskID string) error {
	// 1. 获取任务
	task, err := s.GetTask(userID, taskID)
	if err != nil {
		return err
	}

	// 2. 检查任务状态
	if task.Status != StatusPending {
		return fmt.Errorf("任务状态不允许启动: %s", task.Status)
	}

    // 3. 不预扣：改为按成功的 item 分段扣费（Silent/AutoClick 在执行流程中逐步扣费）

	// 4. 更新任务状态
	now := time.Now()
	task.Status = StatusRunning
	task.StartTime = &now
	task.TokenConsumed = task.TokenCost

	if err := s.db.Save(task).Error; err != nil {
		return err
	}

    // 5. 根据模式启动任务
	switch task.Mode {
	case ModeBasic:
		return s.startBasicTask(task)
	case ModeSilent:
		go s.startSilentTask(task)
	case ModeAutoClick:
		return s.scheduleAutoClickTask(task)
	default:
		return fmt.Errorf("不支持的任务模式: %s", task.Mode)
	}

	return nil
}

// startBasicTask 启动Basic模式任务
func (s *Service) startBasicTask(task *BatchTask) error {
	// 解析URL列表
	var urls []BatchTaskURL
	if err := json.Unmarshal(task.URLs, &urls); err != nil {
		return err
	}

	// 解析配置
	var config BatchTaskConfig
	if err := json.Unmarshal(task.Config, &config); err != nil {
		return err
	}

	// 转换为字符串URL列表
	strURLs := make([]string, 0, len(urls))
	for _, u := range urls {
		if u.URL != "" {
			strURLs = append(strURLs, u.URL)
		}
	}
	delay := 0
	if config.Basic != nil {
		delay = config.Basic.Delay
	}
	// 通过WebSocket发送给前端（Basic模式window.open指令）
	message := map[string]interface{}{
		"type": "batchgo_open_url",
		"data": map[string]interface{}{
			"task_id": task.ID,
			"urls":    strURLs,
			"delay":   delay,
		},
		"timestamp": time.Now().Unix(),
	}
	return s.wsManager.SendToUser(task.UserID, message)
}

// startSilentTask 启动Silent模式任务
func (s *Service) startSilentTask(task *BatchTask) {
	defer func() {
		if r := recover(); r != nil {
			s.updateTaskError(task.ID, fmt.Sprintf("任务执行异常: %v", r))
		}
	}()

	// 解析URL列表
	var urls []BatchTaskURL
	if err := json.Unmarshal(task.URLs, &urls); err != nil {
		s.updateTaskError(task.ID, fmt.Sprintf("解析URL失败: %v", err))
		return
	}

	// 解析配置
	var config BatchTaskConfig
	if err := json.Unmarshal(task.Config, &config); err != nil {
		s.updateTaskError(task.ID, fmt.Sprintf("解析配置失败: %v", err))
		return
	}

	silentConfig := config.Silent
	if silentConfig == nil {
		silentConfig = &SilentConfig{
			Concurrency: 5,
			Timeout:     30,
			RetryCount:  3,
		}
	}

    // 并发处理URL（注册可取消上下文）
    ctx, cancel := context.WithCancel(context.Background())
    s.registerCancel(task.ID, cancel)
    defer s.popCancel(task.ID)
    s.processSilentTask(ctx, task, urls, silentConfig)
}

// processSilentTask 处理Silent模式任务（由调用者提供ctx，以支持取消）
func (s *Service) processSilentTask(ctx context.Context, task *BatchTask, urls []BatchTaskURL, config *SilentConfig) {

	// 创建工作池
	urlChan := make(chan int, len(urls))
	resultChan := make(chan BatchTaskURL, len(urls))

	// 启动工作协程
	var wg sync.WaitGroup
	for i := 0; i < config.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s.silentWorker(ctx, task.ID, urls, urlChan, resultChan, config)
		}()
	}

	// 发送任务
	for i := range urls {
		urlChan <- i
	}
	close(urlChan)

	// 等待完成
	go func() {
		wg.Wait()
		close(resultChan)
	}()

    // 收集结果
    processedCount := 0
    successCount := 0
    failedCount := 0
    fallbackTriggered := false

    for result := range resultChan {
        urls[result.Retries] = result // 使用Retries字段临时存储索引
        processedCount++

        if result.Status == "success" {
            successCount++
            // 成功即扣费（按最终执行方式：Silent 计为 HTTP）
            _ = s.tokenService.ConsumeTokensByService(task.UserID, "batchgo", "http", 1, task.ID)
        } else {
            failedCount++
        }

        // 更新进度
        s.updateTaskProgress(task.ID, processedCount, successCount, failedCount)

        // 判定失败占比阈值 - 仅当设置了阈值且仍有未处理项时触发
        if !fallbackTriggered && config.FailRateThreshold > 0 && processedCount > 0 {
            failRate := float64(failedCount) / float64(processedCount) * 100.0
            if failRate >= float64(config.FailRateThreshold) && processedCount < len(urls) {
                // 取消剩余处理
                if cancel := s.popCancel(task.ID); cancel != nil { cancel() }
                fallbackTriggered = true
            }
        }

        // 发送进度通知
        s.sendProgressNotification(task.UserID, task.ID, processedCount, len(urls))
    }
    // 完成任务
    s.completeTask(task.ID, urls, successCount, failedCount)

    // 如果触发了回退：创建 AutoClick 任务处理剩余URL并调度
    if fallbackTriggered {
        remaining := make([]string, 0)
        for _, u := range urls {
            if u.Status != "success" && u.Status != "failed" {
                if u.URL != "" { remaining = append(remaining, u.URL) }
            }
        }
        if len(remaining) > 0 {
            cfg := BatchTaskConfig{ AutoClick: &AutoClickConfig{ StartTime: time.Now().Add(1 * time.Minute).Format("15:04"), EndTime: time.Now().Add(61 * time.Minute).Format("15:04"), Interval: 10, RandomDelay: true, MaxRandomDelay: 5 } }
            req := &CreateTaskRequest{ Name: task.Name + " (fallback)", Mode: ModeAutoClick, URLs: remaining, Config: cfg }
            if newTask, err := s.CreateTask(task.UserID, req); err == nil {
                _ = s.scheduleAutoClickTask(newTask)
                if s.audit != nil {
                    _ = s.audit.LogBatchTaskAction(task.UserID, "fallback_to_puppeteer", task.ID, map[string]interface{}{
                        "threshold": config.FailRateThreshold,
                        "processed": processedCount,
                        "failed": failedCount,
                        "new_task_id": newTask.ID,
                    }, "", "", true, "", 0)
                }
                s.updateTaskError(task.ID, fmt.Sprintf("fallback_to_puppeteer_spawned:%s", newTask.ID))
            } else {
                s.updateTaskError(task.ID, fmt.Sprintf("fallback_spawn_failed:%v", err))
            }
        }
    }
}

// silentWorker Silent模式工作协程
func (s *Service) silentWorker(ctx context.Context, taskID string, urls []BatchTaskURL,
    urlChan <-chan int, resultChan chan<- BatchTaskURL, config *SilentConfig) {

	client := &http.Client{
		Timeout: time.Duration(config.Timeout) * time.Second,
	}

	for {
		select {
		case <-ctx.Done():
			return
		case index, ok := <-urlChan:
			if !ok {
				return
			}

			url := urls[index]
			result := s.processURL(client, url, config)
			result.Retries = index // 临时存储索引
			resultChan <- result
		}
	}
}

// StopTask 暂停任务（仅对 running 的 silent 模式生效）
func (s *Service) StopTask(userID, taskID string) error {
    task, err := s.GetTask(userID, taskID)
    if err != nil {
        return err
    }
    if task.Status != StatusRunning {
        return fmt.Errorf("任务非运行态: %s", task.Status)
    }
    if task.Mode != ModeSilent {
        return fmt.Errorf("仅 Silent 模式支持停止")
    }
    if cancel := s.popCancel(taskID); cancel != nil {
        cancel()
    }
    now := time.Now()
    return s.db.Model(&BatchTask{}).Where("id = ?", taskID).Updates(map[string]interface{}{
        "status":     StatusPaused,
        "updated_at": now,
    }).Error
}

// TerminateTask 终止任务（运行中则取消，非运行直接标记取消）
func (s *Service) TerminateTask(userID, taskID string) error {
    _, err := s.GetTask(userID, taskID)
    if err != nil {
        return err
    }
    if cancel := s.popCancel(taskID); cancel != nil {
        cancel()
    }
    now := time.Now()
    return s.db.Model(&BatchTask{}).Where("id = ?", taskID).Updates(map[string]interface{}{
        "status":     StatusCancelled,
        "end_time":   now,
        "updated_at": now,
    }).Error
}

// processURL 处理单个URL
func (s *Service) processURL(client *http.Client, url BatchTaskURL, config *SilentConfig) BatchTaskURL {
	startTime := time.Now()
	url.StartTime = &startTime
	url.Status = "processing"

	var lastErr error

	// 重试逻辑
	for retry := 0; retry <= config.RetryCount; retry++ {
		req, err := http.NewRequest("GET", url.URL, nil)
		if err != nil {
			lastErr = err
			continue
		}

		// 设置User-Agent
		if config.UserAgent != "" {
			req.Header.Set("User-Agent", config.UserAgent)
		}

		// 设置自定义头部
		for key, value := range config.Headers {
			req.Header.Set(key, value)
		}

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(retry+1) * time.Second) // 递增延迟
			continue
		}

		resp.Body.Close()

        // 成功
        endTime := time.Now()
        url.EndTime = &endTime
        url.Status = "success"
        url.Response = map[string]interface{}{
            "status_code": resp.StatusCode,
            "headers":     resp.Header,
            "duration":    endTime.Sub(startTime).Milliseconds(),
        }
        url.Retries = retry

        return url
    }

	// 失败
	endTime := time.Now()
	url.EndTime = &endTime
	url.Status = "failed"
	url.Error = lastErr.Error()
	url.Retries = config.RetryCount

    return url
}

// scheduleAutoClickTask 调度AutoClick模式任务
func (s *Service) scheduleAutoClickTask(task *BatchTask) error {
	// 解析配置
	var config BatchTaskConfig
	if err := json.Unmarshal(task.Config, &config); err != nil {
		return err
	}

	autoClickConfig := config.AutoClick
	if autoClickConfig == nil {
		return fmt.Errorf("AutoClick配置不能为空")
	}

	// 计算下次执行时间
	nextTime, err := s.calculateNextExecutionTime(autoClickConfig)
	if err != nil {
		return err
	}

	// 更新任务调度时间
	task.ScheduledTime = &nextTime
	task.Status = StatusPending

	if err := s.db.Save(task).Error; err != nil {
		return err
	}

    // 简化调度：在计划时间到达后启动执行
    go func(t *BatchTask) {
        now := time.Now()
        start := now
        if t.ScheduledTime != nil && t.ScheduledTime.After(now) {
            start = *t.ScheduledTime
        }
        delay := time.Until(start)
        if delay > 0 { time.Sleep(delay) }
        _ = s.runAutoClickTask(t)
    }(task)
    return nil
}

// calculateNextExecutionTime 计算下次执行时间
func (s *Service) calculateNextExecutionTime(config *AutoClickConfig) (time.Time, error) {
	now := time.Now()

	// 解析开始时间
	startTime, err := time.Parse("15:04", config.StartTime)
	if err != nil {
		return time.Time{}, fmt.Errorf("开始时间格式错误: %v", err)
	}

	// 解析结束时间（仅校验格式）
	_, err = time.Parse("15:04", config.EndTime)
	if err != nil {
		return time.Time{}, fmt.Errorf("结束时间格式错误: %v", err)
	}

	// 计算今天的开始时间
	todayStart := time.Date(now.Year(), now.Month(), now.Day(),
		startTime.Hour(), startTime.Minute(), 0, 0, now.Location())

	// 如果今天已经过了开始时间，计算明天的时间
	if now.After(todayStart) {
		todayStart = todayStart.AddDate(0, 0, 1)
	}

	// 检查是否在工作日
	if len(config.WorkDays) > 0 {
		weekday := int(todayStart.Weekday())
		isWorkDay := false
		for _, day := range config.WorkDays {
			if day == weekday {
				isWorkDay = true
				break
			}
		}

		// 如果不是工作日，找下一个工作日
		if !isWorkDay {
			for i := 1; i <= 7; i++ {
				nextDay := todayStart.AddDate(0, 0, i)
				nextWeekday := int(nextDay.Weekday())
				for _, day := range config.WorkDays {
					if day == nextWeekday {
						todayStart = nextDay
						isWorkDay = true
						break
					}
				}
				if isWorkDay {
					break
				}
			}
		}
	}

	// 添加随机延迟
	if config.RandomDelay && config.MaxRandomDelay > 0 {
		randomMinutes := rand.Intn(config.MaxRandomDelay)
		todayStart = todayStart.Add(time.Duration(randomMinutes) * time.Minute)
	}

	return todayStart, nil
}

// runAutoClickTask 执行 AutoClick（按 Puppeteer 计费）
func (s *Service) runAutoClickTask(task *BatchTask) error {
    // 解析URL列表
    var urls []BatchTaskURL
    if err := json.Unmarshal(task.URLs, &urls); err != nil {
        s.updateTaskError(task.ID, fmt.Sprintf("解析URL失败: %v", err))
        return err
    }
    // 解析配置
    var cfg BatchTaskConfig
    if err := json.Unmarshal(task.Config, &cfg); err != nil {
        s.updateTaskError(task.ID, fmt.Sprintf("解析配置失败: %v", err))
        return err
    }
    // 标记运行
    now := time.Now()
    _ = s.db.Model(&BatchTask{}).Where("id=?", task.ID).Updates(map[string]any{"status": StatusRunning, "start_time": now, "updated_at": now}).Error
    // 并行度：使用 Silent 的配置或默认 3
    sc := &SilentConfig{Concurrency: 3, Timeout: 30, RetryCount: 2}
    // 处理
    ctx, cancel := context.WithCancel(context.Background())
    s.registerCancel(task.ID, cancel)
    defer s.popCancel(task.ID)

    urlChan := make(chan int, len(urls))
    resultChan := make(chan BatchTaskURL, len(urls))
    var wg sync.WaitGroup
    for i := 0; i < sc.Concurrency; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            s.silentWorker(ctx, task.ID, urls, urlChan, resultChan, sc)
        }()
    }
    for i := range urls { urlChan <- i }
    close(urlChan)
    go func(){ wg.Wait(); close(resultChan) }()
    processed, success, failed := 0,0,0
    for r := range resultChan {
        urls[r.Retries] = r
        processed++
        if r.Status == "success" {
            success++
            _ = s.tokenService.ConsumeTokensByService(task.UserID, "batchgo", "puppeteer", 1, task.ID)
        } else { failed++ }
        s.updateTaskProgress(task.ID, processed, success, failed)
        s.sendProgressNotification(task.UserID, task.ID, processed, len(urls))
    }
    s.completeTask(task.ID, urls, success, failed)
    if s.audit != nil {
        _ = s.audit.LogBatchTaskAction(task.UserID, "autoclick_execute", task.ID, map[string]interface{}{"success": success, "failed": failed}, "", "", true, "", 0)
    }
    return nil
}

// GetTask 获取任务
func (s *Service) GetTask(userID, taskID string) (*BatchTask, error) {
	var task BatchTask
	err := s.db.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// GetTasks 获取任务列表
func (s *Service) GetTasks(userID string, page, pageSize int) ([]*BatchTask, int64, error) {
	var tasks []*BatchTask
	var total int64

	offset := (page - 1) * pageSize

	// 获取总数
	if err := s.db.Model(&BatchTask{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	if err := s.db.Where("user_id = ?", userID).
		Offset(offset).Limit(pageSize).
		Order("created_at DESC").
		Find(&tasks).Error; err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}

// updateTaskProgress 更新任务进度
func (s *Service) updateTaskProgress(taskID string, processed, success, failed int) {
	s.db.Model(&BatchTask{}).Where("id = ?", taskID).Updates(map[string]interface{}{
		"processed_count": processed,
		"success_count":   success,
		"failed_count":    failed,
		"updated_at":      time.Now(),
	})
}

// updateTaskError 更新任务错误
func (s *Service) updateTaskError(taskID, errorMsg string) {
	now := time.Now()
	s.db.Model(&BatchTask{}).Where("id = ?", taskID).Updates(map[string]interface{}{
		"status":        StatusFailed,
		"error_message": errorMsg,
		"end_time":      now,
		"updated_at":    now,
	})
}

// completeTask 完成任务
func (s *Service) completeTask(taskID string, urls []BatchTaskURL, success, failed int) {
	urlsJSON, _ := json.Marshal(urls)
	now := time.Now()

	s.db.Model(&BatchTask{}).Where("id = ?", taskID).Updates(map[string]interface{}{
		"status":          StatusCompleted,
		"urls":            urlsJSON,
		"success_count":   success,
		"failed_count":    failed,
		"processed_count": success + failed,
		"end_time":        now,
		"updated_at":      now,
	})
}

// sendProgressNotification 发送进度通知
func (s *Service) sendProgressNotification(userID, taskID string, processed, total int) {
	message := map[string]interface{}{
		"type":       "batch_progress",
		"task_id":    taskID,
		"processed":  processed,
		"total":      total,
		"percentage": float64(processed) / float64(total) * 100,
	}

	s.wsManager.SendToUser(userID, message)
}

// validateCreateRequest 验证创建请求
func (s *Service) validateCreateRequest(req *CreateTaskRequest) error {
	if req.Name == "" {
		return fmt.Errorf("任务名称不能为空")
	}

	if len(req.URLs) == 0 {
		return fmt.Errorf("URL列表不能为空")
	}

	if len(req.URLs) > 1000 {
		return fmt.Errorf("URL数量不能超过1000个")
	}

	switch req.Mode {
	case ModeBasic, ModeSilent, ModeAutoClick:
		// 有效模式
	default:
		return fmt.Errorf("无效的任务模式: %s", req.Mode)
	}

	return nil
}

// CreateTaskRequest 创建任务请求
type CreateTaskRequest struct {
	Name   string          `json:"name" binding:"required"`
	Mode   BatchTaskMode   `json:"mode" binding:"required"`
	URLs   []string        `json:"urls" binding:"required"`
	Config BatchTaskConfig `json:"config"`
}
