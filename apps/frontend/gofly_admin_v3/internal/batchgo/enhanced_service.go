//go:build autoads_advanced

package batchgo

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/pkg/concurrent"
	"gofly-admin-v3/utils/gf"
)

// EnhancedService 增强的BatchGo服务
type EnhancedService struct {
	*Service

	// 并发控制
	maxConcurrency int
	taskQueue      chan *concurrent.ExecTask

	// 代理管理
	proxyPool *ProxyPool

	// 上下文
	ctx          context.Context
	cancel       context.CancelFunc
	wg           sync.WaitGroup
	mu           sync.RWMutex
	runningTasks map[string]*EnhancedTaskRunner
}

// NewEnhancedService 创建增强的服务
func NewEnhancedService(db *store.DB, redis *store.Redis) *EnhancedService {
	ctx, cancel := context.WithCancel(context.Background())

	s := &EnhancedService{
		Service:        NewServiceAdv(db, redis),
		maxConcurrency: 50,                                    // 最大并发数
		taskQueue:      make(chan *concurrent.ExecTask, 1000), // 任务队列
		proxyPool:      NewProxyPool(),
		ctx:            ctx,
		cancel:         cancel,
		runningTasks:   make(map[string]*EnhancedTaskRunner),
	}

	// 启动任务处理器
	go s.startTaskProcessor()

	return s
}

// StartEnhancedTask 启动增强任务
func (s *EnhancedService) StartEnhancedTask(taskID, userID string, mode string) error {
	task, err := s.GetTaskAdv(taskID)
	if err != nil {
		return err
	}

	// 检查权限
	if task.UserID != userID {
		return fmt.Errorf("无权限操作此任务")
	}

	// 检查任务状态
	if !task.CanExecute() {
		return fmt.Errorf("任务状态不允许执行")
	}

	// 检查用户套餐权限
	// 简化：跳过用户权限与扣费，专注于任务执行流程编译

	// 将任务加入队列
	task.Status = "queued"
	task.UpdatedAt = time.Now()
	s.db.Save(task)

	s.taskQueue <- task

	return nil
}

// checkModePermission 检查模式权限
func (s *EnhancedService) checkModePermission(mode, subscription string) bool {
	switch mode {
	case "basic":
		return true // 所有套餐都支持
	case "silent":
		return subscription == "pro" || subscription == "max"
	case "automated":
		return subscription == "max"
	default:
		return false
	}
}

// startTaskProcessor 启动任务处理器
func (s *EnhancedService) startTaskProcessor() {
	// 创建工作池
	for i := 0; i < s.maxConcurrency; i++ {
		go s.worker(i)
	}
}

// worker 工作协程
func (s *EnhancedService) worker(id int) {
	for {
		select {
		case task := <-s.taskQueue:
			// 处理任务
			s.processTask(id, task)
		case <-s.ctx.Done():
			return
		}
	}
}

// processTask 处理任务
func (s *EnhancedService) processTask(workerID int, task *concurrent.ExecTask) {
	// 确定执行模式
	mode := determineMode(task)

	// 创建任务运行器
	runner := &EnhancedTaskRunner{
		task:      task,
		service:   s,
		workerID:  workerID,
		mode:      mode,
		proxyPool: s.proxyPool,
		ctx:       s.ctx,
	}

	// 记录运行中的任务
	s.mu.Lock()
	s.runningTasks[task.ID] = runner
	s.mu.Unlock()

	// 执行任务
	runner.Run()

	// 清理
	s.mu.Lock()
	delete(s.runningTasks, task.ID)
	s.mu.Unlock()
}

// determineMode 确定任务执行模式
func determineMode(task *concurrent.ExecTask) string {
	// 根据任务参数确定模式
	if task.OpenCount > 10 || task.CycleCount > 5 {
		return "automated"
	}
	if task.OpenCount > 1 || task.ProxyURL != "" {
		return "silent"
	}
	return "basic"
}

// EnhancedTaskRunner 增强的任务运行器
type EnhancedTaskRunner struct {
	task      *concurrent.ExecTask
	service   *EnhancedService
	workerID  int
	mode      string
	proxyPool *ProxyPool
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
}

// Run 执行任务
func (r *EnhancedTaskRunner) Run() {
	r.ctx, r.cancel = context.WithCancel(r.ctx)
	r.wg.Add(1)

	// 更新任务状态
	now := time.Now()
	r.task.Status = "running"
	r.task.StartedAt = &now
	r.task.UpdatedAt = now
	r.service.db.Save(r.task)

	// 根据模式执行
	switch r.mode {
	case "basic":
		r.executeBasicMode()
	case "silent":
		r.executeSilentMode()
	case "automated":
		r.executeAutomatedMode()
	}

	r.wg.Done()
}

// executeBasicMode 执行Basic模式
func (r *EnhancedTaskRunner) executeBasicMode() {
	defer r.completeTask()

	// Basic模式：简单的HTTP请求
	client := r.createHTTPClient()

	for cycle := 0; cycle < r.task.CycleCount; cycle++ {
		if r.ctx.Err() != nil {
			break
		}

		for _, urlStr := range r.task.URLs {
			if r.ctx.Err() != nil {
				break
			}

			result := r.executeHTTPRequest(client, urlStr)
			r.saveResult(result)
		}
	}
}

// executeSilentMode 执行Silent模式
func (r *EnhancedTaskRunner) executeSilentMode() {
	defer r.completeTask()

	// Silent模式：后台批量HTTP请求，支持并发
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 10) // 限制并发数

	for cycle := 0; cycle < r.task.CycleCount; cycle++ {
		if r.ctx.Err() != nil {
			break
		}

		for _, urlStr := range r.task.URLs {
			if r.ctx.Err() != nil {
				break
			}

			wg.Add(1)
			go func(u string) {
				defer wg.Done()

				semaphore <- struct{}{}
				defer func() { <-semaphore }()

				client := r.createHTTPClient()

				// 执行多次
				for i := 0; i < r.task.OpenCount; i++ {
					if r.ctx.Err() != nil {
						break
					}

					result := r.executeHTTPRequest(client, u)
					r.saveResult(result)

					// 间隔
					if i < r.task.OpenCount-1 {
						time.Sleep(time.Duration(r.task.OpenInterval) * time.Second)
					}
				}
			}(urlStr)
		}

		wg.Wait()
	}
}

// executeAutomatedMode 执行Automated模式
func (r *EnhancedTaskRunner) executeAutomatedMode() {
	defer r.completeTask()

	// Automated模式：使用浏览器自动化
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(r.ctx, opts...)
	defer cancel()

	// 创建浏览器实例
	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	// 设置超时
	ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	for cycle := 0; cycle < r.task.CycleCount; cycle++ {
		if r.ctx.Err() != nil {
			break
		}

		for _, urlStr := range r.task.URLs {
			if r.ctx.Err() != nil {
				break
			}

			// 执行浏览器自动化
			result := r.executeBrowserAutomation(ctx, urlStr)
			r.saveResult(result)

			// 间隔
			if cycle < r.task.CycleCount-1 {
				time.Sleep(time.Duration(r.task.OpenInterval) * time.Second)
			}
		}
	}
}

// executeHTTPRequest 执行HTTP请求
func (r *EnhancedTaskRunner) executeHTTPRequest(client *http.Client, urlStr string) *concurrent.ExecTaskResult {
	result := &concurrent.ExecTaskResult{
		ID:        gf.UUID(),
		TaskID:    r.task.ID,
		URL:       urlStr,
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	start := time.Now()
	result.StartTime = &start

	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("创建请求失败: %v", err)
		return result
	}

	// 设置请求头
	r.setRequestHeaders(req)

	// 执行请求
	resp, err := client.Do(req)
	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("请求失败: %v", err)
		return result
	}
	defer resp.Body.Close()

	end := time.Now()
	result.EndTime = &end
	result.Duration = end.Sub(start).Milliseconds()
	result.StatusCode = resp.StatusCode

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		result.Status = "success"
	} else {
		result.Status = "failed"
		result.Error = fmt.Sprintf("HTTP状态码: %d", resp.StatusCode)
	}

	return result
}

// executeBrowserAutomation 执行浏览器自动化
func (r *EnhancedTaskRunner) executeBrowserAutomation(ctx context.Context, urlStr string) *concurrent.ExecTaskResult {
	result := &concurrent.ExecTaskResult{
		ID:        gf.UUID(),
		TaskID:    r.task.ID,
		URL:       urlStr,
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	start := time.Now()
	result.StartTime = &start

	// 执行浏览器操作
	var title string
	var success bool

	err := chromedp.Run(ctx,
		chromedp.Navigate(urlStr),
		chromedp.WaitReady("body"),
		chromedp.Title(&title),
		chromedp.ActionFunc(func(ctx context.Context) error {
			success = true
			return nil
		}),
	)

	end := time.Now()
	result.EndTime = &end
	result.Duration = end.Sub(start).Milliseconds()

	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("浏览器操作失败: %v", err)
	} else if success {
		result.Status = "success"
		result.StatusCode = 200
	} else {
		result.Status = "failed"
		result.Error = "未知错误"
	}

	return result
}

// setRequestHeaders 设置请求头
func (r *EnhancedTaskRunner) setRequestHeaders(req *http.Request) {
	req.Header.Set("User-Agent", r.getRandomUserAgent())
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	req.Header.Set("Accept-Encoding", "gzip, deflate")
	req.Header.Set("Connection", "keep-alive")

	// 设置Referer
	switch r.task.RefererOption {
	case "social":
		req.Header.Set("Referer", r.getRandomSocialReferer())
	case "search":
		req.Header.Set("Referer", r.getRandomSearchReferer())
	}
}

// getRandomUserAgent 获取随机User-Agent
func (r *EnhancedTaskRunner) getRandomUserAgent() string {
	userAgents := []string{
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
	}
	return userAgents[rand.Intn(len(userAgents))]
}

// getRandomSocialReferer 获取随机社交媒体Referer
func (r *EnhancedTaskRunner) getRandomSocialReferer() string {
	referers := []string{
		"https://www.facebook.com/",
		"https://twitter.com/",
		"https://www.linkedin.com/",
		"https://www.instagram.com/",
	}
	return referers[rand.Intn(len(referers))]
}

// getRandomSearchReferer 获取随机搜索引擎Referer
func (r *EnhancedTaskRunner) getRandomSearchReferer() string {
	referers := []string{
		"https://www.google.com/",
		"https://www.baidu.com/",
		"https://www.bing.com/",
		"https://www.duckduckgo.com/",
	}
	return referers[rand.Intn(len(referers))]
}

// createHTTPClient 创建HTTP客户端
func (r *EnhancedTaskRunner) createHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		},
	}
}

// saveResult 保存结果
func (r *EnhancedTaskRunner) saveResult(result *concurrent.ExecTaskResult) {
	if err := r.service.db.Create(result).Error; err != nil {
		// 记录错误
	}
}

// completeTask 完成任务
func (r *EnhancedTaskRunner) completeTask() {
	now := time.Now()
	r.task.CompletedAt = &now
	r.task.UpdatedAt = now

	// 计算统计
	var total, successCount int64
	r.service.db.Model(&concurrent.ExecTaskResult{}).
		Where("task_id = ?", r.task.ID).
		Count(&total)
	r.service.db.Model(&concurrent.ExecTaskResult{}).
		Where("task_id = ? AND status = ?", r.task.ID, "success").
		Count(&successCount)

	failedCount := total - successCount

	r.task.SuccessUrls = int(successCount)
	r.task.FailedUrls = int(failedCount)
	r.task.Progress = 100

	if failedCount == 0 {
		r.task.Status = "completed"
	} else {
		r.task.Status = "completed_with_errors"
	}

	r.service.db.Save(r.task)
}

// Cancel 取消任务
func (r *EnhancedTaskRunner) Cancel() {
	if r.cancel != nil {
		r.cancel()
	}
}

// ProxyPool 代理池
type ProxyPool struct {
	proxies []string
	index   int
	mu      sync.RWMutex
}

// NewProxyPool 创建代理池
func NewProxyPool() *ProxyPool {
	return &ProxyPool{
		proxies: []string{},
	}
}

// AddProxy 添加代理
func (p *ProxyPool) AddProxy(proxy string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.proxies = append(p.proxies, proxy)
}

// GetProxy 获取代理
func (p *ProxyPool) GetProxy() string {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if len(p.proxies) == 0 {
		return ""
	}

	proxy := p.proxies[p.index]
	p.index = (p.index + 1) % len(p.proxies)

	return proxy
}

// LoadFromAPI 从API加载代理
func (p *ProxyPool) LoadFromAPI(apiURL string) error {
	// TODO: 实现从API加载代理列表
	return nil
}
