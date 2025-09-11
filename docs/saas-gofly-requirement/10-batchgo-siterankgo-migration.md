# 核心功能迁移详细规格：BatchGo & SiteRankGo

**文档版本**: v1.0  
**最后更新**: 2025-09-11  
**文档状态**: 已标准化  
**迁移目标**: GoFly框架 v3

## 1. 功能迁移概述

### 1.1 迁移原则

基于Linus的设计哲学，遵循以下原则：

1. **数据结构优先** - 先理清核心数据模型
2. **消除特殊情况** - 通过合理设计减少if/else分支
3. **保持简洁** - 用最直接的方式实现功能
4. **Never break userspace** - 确保100%向后兼容

### 1.2 迁移范围

| 功能模块 | 现有实现 | 目标实现 | 兼容性要求 |
|---------|---------|---------|-----------|
| BatchOpen | Next.js + TypeScript | Go + GoFly | API 100%兼容 |
| SiteRank | Next.js + TypeScript | Go + GoFly | API 100%兼容 |
| 数据存储 | 内存优先 | MySQL持久化 | 增强可靠性 |
| 认证授权 | NextAuth | JWT + RBAC | 保持用户感知 |

## 2. BatchGo功能规格

### 2.1 核心业务逻辑

BatchOpen的本质是一个**并发控制的URL批量访问系统**，支持三种版本：Basic（基础版）、Silent（静默版）、AutoClick（自动化版）。核心数据是任务状态和执行结果。

#### 2.1.1 BatchGo Basic 版本实现

**功能特点**：
- 最多支持 50 个 URL 批量打开
- 使用 window.open() 在新标签页中打开URL
- 无需浏览器插件，直接在浏览器中执行
- 用户需要手动刷新代理 IP
- 简单的批量打开功能，不包含高级功能

**实现方式**：
```go
// Basic 版本数据结构
type BatchOpenBasicTask struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    TenantID    string    `json:"tenant_id" gorm:"index"`
    UserID      string    `json:"user_id" gorm:"index"`
    Name        string    `json:"name"`
    Status      string    `json:"status"` // pending, running, completed, failed
    URLs        []string  `json:"urls" gorm:"type:json"`
    TotalURLs   int       `json:"total_urls"`
    SuccessCount int      `json:"success_count"`
    FailCount   int       `json:"fail_count"`
    
    // Basic版本特有
    MaxURLs     int       `json:"max_urls"` // 固定50
    OpenMethod  string    `json:"open_method"` // window_open
    
    // 结果数据
    Results     []BasicResult `json:"results" gorm:"type:json"`
    
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

type BasicResult struct {
    URL         string    `json:"url"`
    Status      string    `json:"status"` // success, failed, blocked
    ResponseTime int64    `json:"response_time_ms"`
    Error       string    `json:"error,omitempty"`
    Blocked     bool      `json:"blocked"` // 是否被弹窗拦截
    CreatedAt   time.Time `json:"created_at"`
}

// Basic 版本处理器
type BatchOpenBasicHandler struct {
    service      *BatchOpenService
    tokenService *TokenService
    maxURLs      int
}

func (h *BatchOpenBasicHandler) HandleBasicOpen(ctx context.Context, req *BasicOpenRequest) (*BasicOpenResponse, error) {
    // 1. 验证URL数量
    if len(req.URLs) > h.maxURLs {
        return nil, errors.New("exceeds maximum URLs limit (50)")
    }
    
    // 2. Token消费
    if err := h.tokenService.ConsumeTokens(ctx, user.ID, "batchopen_basic", tokenCost); err != nil {
        return nil, errors.New("insufficient tokens")
    }
    
    // 3. 创建任务记录
    task := &BatchOpenBasicTask{
        ID:        uuid.New().String(),
        TenantID:  tenantID,
        UserID:    userID,
        Name:      "Basic Batch Open",
        Status:    "running",
        URLs:      req.URLs,
        TotalURLs: len(req.URLs),
        MaxURLs:   h.maxURLs,
        OpenMethod: "window_open",
    }
    
    // 4. 执行批量打开（模拟window.open行为）
    results := h.executeBasicBatch(task)
    
    // 5. 更新任务状态
    task.Status = "completed"
    task.SuccessCount = countSuccess(results)
    task.FailCount = len(results) - task.SuccessCount
    task.Results = results
    
    return &BasicOpenResponse{
        TaskID:       task.ID,
        TotalURLs:    task.TotalURLs,
        SuccessCount: task.SuccessCount,
        FailCount:    task.FailCount,
        Results:      results,
    }, nil
}

// 模拟 window.open 的批量打开实现
func (h *BatchOpenBasicHandler) executeBasicBatch(task *BatchOpenBasicTask) []BasicResult {
    results := make([]BasicResult, len(task.URLs))
    
    // 由于Go后端无法直接打开浏览器标签页，
    // 这里返回需要前端执行的指令
    for i, url := range task.URLs {
        start := time.Now()
        
        // 在实际实现中，这里会通过WebSocket通知前端打开URL
        result := BasicResult{
            URL:         url,
            Status:      "pending", // 等待前端执行
            ResponseTime: 0,
        }
        
        results[i] = result
    }
    
    return results
}

// 通过WebSocket通知前端打开URL
func (h *BatchOpenBasicHandler) notifyFrontendOpenURLs(taskID string, urls []string) {
    message := WebSocketMessage{
        Type: "batch_open_basic_execute",
        Data: map[string]interface{}{
            "taskId": taskID,
            "urls":   urls,
        },
    }
    
    // 发送给特定用户
    h.websocketHub.SendToUser(task.UserID, message)
}
```

#### 2.1.2 Silent & AutoClick 模式执行架构

```go
// 核心数据结构
type BatchTask struct {
    ID              string    `json:"id" gorm:"primaryKey"`
    TenantID        string    `json:"tenant_id" gorm:"index"`
    UserID          string    `json:"user_id" gorm:"index"`
    Name            string    `json:"name"`
    Type            string    `json:"type" gorm:"index"` // "silent" or "autoclick"
    Status          string    `json:"status" gorm:"index"` // pending, running, completed, failed, terminated
    URLs            []string  `json:"urls" gorm:"type:json"`
    TotalURLs       int       `json:"total_urls"`
    SuccessCount    int       `json:"success_count"`
    FailCount       int       `json:"fail_count"`
    PendingCount    int       `json:"pending_count"`
    
    // 执行配置
    CycleCount      int       `json:"cycle_count"`
    ProxyURL        string    `json:"proxy_url"`
    AccessMode      string    `json:"access_mode"` // http, puppeteer
    ConcurrencyLimit int      `json:"concurrency_limit"`
    
    // AutoClick特有
    Schedule        string    `json:"schedule,omitempty"` // cron expression
    DailyTarget     int       `json:"daily_target,omitempty"`
    CurrentProgress int       `json:"current_progress,omitempty"`
    
    // 统计信息
    StartTime       time.Time `json:"start_time"`
    EndTime         *time.Time `json:"end_time,omitempty"`
    Duration        int64     `json:"duration_ms"` // 毫秒
    
    // 结果数据
    Results         []TaskResult `json:"results" gorm:"type:json"`
    ErrorSummary    *ErrorSummary `json:"error_summary" gorm:"type:json"`
    ProxyStats      *ProxyStats  `json:"proxy_stats" gorm:"type:json"`
    
    CreatedAt       time.Time  `json:"created_at"`
    UpdatedAt       time.Time  `json:"updated_at"`
}

type TaskResult struct {
    URL         string    `json:"url"`
    Status      string    `json:"status"` // success, failed, timeout
    StatusCode  int       `json:"status_code"`
    ResponseTime int64    `json:"response_time_ms"`
    Error       string    `json:"error,omitempty"`
    ProxyUsed   string    `json:"proxy_used,omitempty"`
    Attempts    int       `json:"attempts"`
    CycleIndex  int       `json:"cycle_index"`
    CreatedAt   time.Time `json:"created_at"`
}
```

#### 2.1.2 Silent Mode实现要点

Silent模式就是一个**带并发控制的URL批量处理器**。

```go
// Silent模式处理逻辑
func (s *SilentTaskService) ExecuteTask(task *BatchTask) {
    // 1. 验证和初始化
    s.validateTask(task)
    s.initializeTask(task)
    
    // 2. 智能并发控制
    concurrency := s.calculateOptimalConcurrency(task)
    
    // 3. SimpleConcurrentExecutor模式
    executor := NewSimpleConcurrentExecutor(concurrency, func(url string, cycle int) TaskResult {
        return s.processURL(url, cycle, task)
    })
    
    // 4. 执行所有URL的所有循环
    for cycle := 0; cycle < task.CycleCount; cycle++ {
        results := executor.Execute(task.URLs)
        s.updateTaskResults(task, results, cycle)
    }
    
    // 5. 清理和总结
    s.finalizeTask(task)
}

// 核心URL处理逻辑
func (s *SilentTaskService) processURL(url string, cycle int, task *BatchTask) TaskResult {
    start := time.Now()
    
    // 代理轮询
    proxy := s.proxyManager.GetNextProxy(task.ProxyURL)
    
    // 重试逻辑
    for attempt := 0; attempt <= s.maxRetries; attempt++ {
        result := s.executeWithProxy(url, proxy)
        if result.Status == "success" {
            return result
        }
        time.Sleep(time.Duration(attempt*attempt) * time.Second) // 指数退避
    }
    
    return TaskResult{
        URL:        url,
        Status:     "failed",
        Error:      "Max retries exceeded",
        Attempts:   s.maxRetries + 1,
        CycleIndex: cycle,
    }
}
```

#### 2.1.3 AutoClick Mode实现要点

AutoClick就是一个**定时任务调度器 + 时间智能分配器**。

```go
// AutoClick调度逻辑
func (a *AutoClickService) ScheduleTask(task *BatchTask) error {
    // 1. 验证每日目标
    if task.DailyTarget <= 0 || task.DailyTarget > 1000 {
        return errors.New("daily target must be between 1 and 1000")
    }
    
    // 2. 计算时间分布 - 24小时智能分配
    hourlyTargets := a.calculateHourlyDistribution(task.DailyTarget)
    
    // 3. 创建cron任务
    cronExpr := "0 * * * *" // 每小时执行
    entryID, err := a.cron.AddFunc(cronExpr, func() {
        a.executeHourlyTask(task, hourlyTargets[time.Now().Hour()])
    })
    
    if err != nil {
        return err
    }
    
    // 4. 保存调度信息
    task.Schedule = cronExpr
    task.Status = "scheduled"
    
    return nil
}

// 智能时间分配算法
func (a *AutoClickService) calculateHourlyDistribution(total int) [24]int {
    // 基础分布：工作时间更多，夜间较少
    baseWeights := [24]float64{
        0.5, 0.3, 0.2, 0.2, // 0-3点
        0.3, 0.5, 1.2, 2.0, // 4-7点
        2.5, 3.0, 3.0, 2.8, // 8-11点
        2.5, 2.3, 2.5, 2.8, // 12-15点
        3.0, 3.2, 2.8, 2.0, // 16-19点
        1.8, 1.2, 0.8, 0.5, // 20-23点
    }
    
    var sum float64
    for _, w := range baseWeights {
        sum += w
    }
    
    distribution := [24]int{}
    remaining := total
    
    for i, weight := range baseWeights {
        allocated := int(float64(total) * weight / sum)
        if allocated > remaining {
            allocated = remaining
        }
        distribution[i] = allocated
        remaining -= allocated
    }
    
    // 分配余数到权重最大的时段
    if remaining > 0 {
        maxIdx := 0
        for i, w := range baseWeights {
            if w > baseWeights[maxIdx] {
                maxIdx = i
            }
        }
        distribution[maxIdx] += remaining
    }
    
    return distribution
}
```

### 2.2 API接口规格（100%兼容）

#### 2.2.1 Silent Mode APIs

```go
// 1. 启动任务 - 对应 /api/batchopen/silent-start
func (h *BatchGoHandler) SilentStart(c *gin.Context) {
    var req struct {
        TaskID          string   `json:"taskId" binding:"required"`
        URLs            []string `json:"urls" binding:"required"`
        CycleCount      int      `json:"cycleCount" binding:"required,min=1,max=100"`
        OpenCount       int      `json:"openCount" binding:"required,min=1,max=100"`
        OpenInterval    int      `json:"openInterval" binding:"required,min=1,max=60"`
        ProxyUrl        string   `json:"proxyUrl"`
        EnableConcurrentExecution bool `json:"enableConcurrentExecution"`
        EnableRandomization    bool   `json:"enableRandomization"`
        RandomVariation       float64 `json:"randomVariation"`
        RefererOption         string   `json:"refererOption"`
        AccessMethod          string   `json:"accessMethod"` // http, puppeteer
        ProxyValidated        bool     `json:"proxyValidated"`
    }
    
    // 1. Token验证
    user := h.getCurrentUser(c)
    if !h.tokenService.CanAfford(user.ID, len(req.URLs)*req.CycleCount) {
        c.JSON(403, gin.H{"error": "Insufficient tokens"})
        return
    }
    
    // 2. 创建任务
    task := &BatchTask{
        ID:         req.TaskID,
        UserID:     user.ID,
        TenantID:   user.TenantID,
        Type:       "silent",
        Name:       fmt.Sprintf("Silent Task %s", req.TaskID),
        URLs:       req.URLs,
        TotalURLs:  len(req.URLs),
        CycleCount: req.CycleCount,
        Status:     "pending",
    }
    
    // 3. 应用配置
    h.applyTaskConfig(task, &req)
    
    // 4. 保存到数据库
    if err := h.db.Create(task).Error; err != nil {
        c.JSON(500, gin.H{"error": "Failed to create task"})
        return
    }
    
    // 5. 消费Token
    if err := h.tokenService.ConsumeTokens(ctx, user.ID, "batchgo_silent", len(req.URLs)*req.CycleCount); err != nil {
        c.JSON(400, gin.H{"error": "Failed to consume tokens"})
        return
    }
    
    // 6. 异步执行
    go h.silentService.ExecuteTask(task)
    
    c.JSON(200, gin.H{
        "taskId":     task.ID,
        "message":    "Task started successfully",
        "totalUrls":  task.TotalURLs,
        "cycleCount": task.CycleCount,
    })
}

// 2. 查询进度 - 对应 /api/batchopen/silent-progress
func (h *BatchGoHandler) SilentProgress(c *gin.Context) {
    taskID := c.Query("taskId")
    
    var task BatchTask
    if err := h.db.Where("id = ?", taskID).First(&task).Error; err != nil {
        c.JSON(404, gin.H{"error": "Task not found"})
        return
    }
    
    // 计算进度
    progress := float64(task.SuccessCount+task.FailCount) / float64(task.TotalURLs*task.CycleCount) * 100
    
    c.JSON(200, gin.H{
        "taskId":        task.ID,
        "status":        task.Status,
        "progress":      progress,
        "total":         task.TotalURLs * task.CycleCount,
        "successCount":  task.SuccessCount,
        "failCount":     task.FailCount,
        "pendingCount":  task.PendingCount,
        "message":       h.getTaskMessage(task),
        "proxyStats":    task.ProxyStats,
        "errorSummary":  task.ErrorSummary,
        "startTime":     task.StartTime,
        "endTime":       task.EndTime,
    })
}

// 3. 终止任务 - 对应 /api/batchopen/silent-terminate
func (h *BatchGoHandler) SilentTerminate(c *gin.Context) {
    taskID := c.Query("taskId")
    
    // 1. 查找任务
    var task BatchTask
    if err := h.db.Where("id = ?", taskID).First(&task).Error; err != nil {
        c.JSON(404, gin.H{"error": "Task not found"})
        return
    }
    
    // 2. 验证权限
    user := h.getCurrentUser(c)
    if task.UserID != user.ID && !user.IsAdmin() {
        c.JSON(403, gin.H{"error": "Access denied"})
        return
    }
    
    // 3. 终止任务
    task.Status = "terminated"
    now := time.Now()
    task.EndTime = &now
    h.db.Save(&task)
    
    // 4. 发送终止信号
    h.taskManager.TerminateTask(task.ID)
    
    c.JSON(200, gin.H{
        "taskId":  task.ID,
        "status":  "terminated",
        "message": "Task terminated successfully",
    })
}
```

#### 2.2.2 AutoClick Mode APIs

```go
// 1. 创建AutoClick任务 - 对应 /api/autoclick/tasks
func (h *BatchGoHandler) CreateAutoClickTask(c *gin.Context) {
    var req struct {
        TaskID        string `json:"taskId" binding:"required"`
        TargetUrl     string `json:"targetUrl" binding:"required"`
        DailyClicks   int    `json:"dailyClicks" binding:"required,min=1,max=1000"`
        AccessMethod  string `json:"accessMethod" binding:"required,oneof=http puppeteer"`
        ProxyUrl      string `json:"proxyUrl"`
        RefererOption string `json:"refererOption"`
    }
    
    // 1. 验证用户权限
    user := h.getCurrentUser(c)
    if !user.Subscription.HasFeature("autoclick") {
        c.JSON(403, gin.H{"error": "AutoClick feature not available in your plan"})
        return
    }
    
    // 2. 创建任务
    task := &BatchTask{
        ID:           req.TaskID,
        UserID:       user.ID,
        TenantID:     user.TenantID,
        Type:         "autoclick",
        Name:         fmt.Sprintf("AutoClick Task %s", req.TaskID),
        URLs:         []string{req.TargetUrl},
        TotalURLs:    1,
        DailyTarget:  req.DailyClicks,
        AccessMode:   req.AccessMethod,
        ProxyURL:     req.ProxyUrl,
        Status:       "pending",
    }
    
    // 3. 调度任务
    if err := h.autoclickService.ScheduleTask(task); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 4. 保存任务
    h.db.Create(task)
    
    c.JSON(200, gin.H{
        "taskId":       task.ID,
        "targetUrl":    req.TargetUrl,
        "dailyClicks":  req.DailyClicks,
        "status":       task.Status,
        "schedule":     task.Schedule,
        "message":      "AutoClick task created successfully",
    })
}

// 2. AutoClick任务操作 - 对应 /api/autoclick/tasks/[id]/[action]
func (h *BatchGoHandler) AutoClickTaskAction(c *gin.Context) {
    taskID := c.Param("id")
    action := c.Param("action")
    
    var task BatchTask
    if err := h.db.Where("id = ? AND type = ?", taskID, "autoclick").First(&task).Error; err != nil {
        c.JSON(404, gin.H{"error": "Task not found"})
        return
    }
    
    switch action {
    case "start":
        if err := h.autoclickService.StartTask(&task); err != nil {
            c.JSON(500, gin.H{"error": err.Error()})
            return
        }
        c.JSON(200, gin.H{"message": "Task started"})
        
    case "pause":
        h.autoclickService.PauseTask(&task)
        c.JSON(200, gin.H{"message": "Task paused"})
        
    case "resume":
        h.autoclickService.ResumeTask(&task)
        c.JSON(200, gin.H{"message": "Task resumed"})
        
    case "delete":
        h.autoclickService.DeleteTask(&task)
        h.db.Delete(&task)
        c.JSON(200, gin.H{"message": "Task deleted"})
        
    default:
        c.JSON(400, gin.H{"error": "Invalid action"})
    }
}

// 3. AutoClick进度查询 - 对应 /api/autoclick/tasks/[id]/progress
func (h *BatchGoHandler) AutoClickProgress(c *gin.Context) {
    taskID := c.Param("id")
    
    var task BatchTask
    if err := h.db.Where("id = ? AND type = ?", taskID, "autoclick").First(&task).Error; err != nil {
        c.JSON(404, gin.H{"error": "Task not found"})
        return
    }
    
    // 计算今日进度
    today := time.Now().Truncate(24 * time.Hour)
    todayProgress := h.autoclickService.GetTodayProgress(task.ID, today)
    
    c.JSON(200, gin.H{
        "taskId":           task.ID,
        "status":           task.Status,
        "dailyTarget":      task.DailyTarget,
        "currentProgress":  todayProgress,
        "completionRate":   float64(todayProgress) / float64(task.DailyTarget) * 100,
        "lastExecuteTime":  task.UpdatedAt,
        "nextExecuteTime":  h.autoclickService.GetNextExecuteTime(task.Schedule),
    })
}
```

### 2.3 代理管理系统

```go
// 代理服务 - 核心实现
type ProxyService struct {
    validators map[string]ProxyValidator
    cache      *ProxyCache
    stats      *ProxyStats
}

func (p *ProxyService) GetNextProxy(customProxy string) string {
    // 优先使用自定义代理
    if customProxy != "" {
        if p.validator.IsValid(customProxy) {
            return customProxy
        }
    }
    
    // 使用代理池
    return p.cache.GetNext()
}

func (p *ProxyService) TestProxy(proxyURL string) bool {
    client := &http.Client{Timeout: 10 * time.Second}
    req, _ := http.NewRequest("GET", "http://httpbin.org/ip", nil)
    req.Header.Set("Proxy-Url", proxyURL)
    
    resp, err := client.Do(req)
    if err != nil {
        p.stats.RecordFailure(proxyURL, err.Error())
        return false
    }
    defer resp.Body.Close()
    
    if resp.StatusCode == 200 {
        p.stats.RecordSuccess(proxyURL)
        return true
    }
    
    p.stats.RecordFailure(proxyURL, fmt.Sprintf("HTTP %d", resp.StatusCode))
    return false
}
```

## 3. SiteRankGo功能规格

### 3.1 核心业务逻辑

SiteRank的本质是一个**带缓存的SimilarWeb API服务**（仅使用SimilarWeb数据源）。

```go
// 核心数据结构
type SiteRankQuery struct {
    ID           string     `json:"id" gorm:"primaryKey"`
    TenantID     string     `json:"tenant_id" gorm:"index"`
    UserID       string     `json:"user_id" gorm:"index"`
    Domain       string     `json:"domain" gorm:"index"`
    Status       string     `json:"status" gorm:"index"` // pending, running, completed, failed
    Source       string     `json:"source"` // similarweb
    
    // SimilarWeb数据
    GlobalRank   *int       `json:"global_rank"`
    CategoryRank *int       `json:"category_rank"`
    Category     string     `json:"category"`
    Country      string     `json:"country"`
    Visits       *float64   `json:"visits"` // 月访问量(百万)
    BounceRate   *float64   `json:"bounce_rate"`
    PagesPerVisit *float64  `json:"pages_per_visit"`
    AvgDuration  *float64   `json:"avg_duration"`
    
    // API相关
    APIResponse  string     `json:"api_response" gorm:"type:text"`
    APIError     string     `json:"api_error,omitempty"`
    CacheUntil   *time.Time `json:"cache_until"`
    
    // 统计
    RequestCount int        `json:"request_count"`
    LastQueried  *time.Time `json:"last_queried"`
    
    CreatedAt    time.Time  `json:"created_at"`
    UpdatedAt    time.Time  `json:"updated_at"`
}

type SiteRankBatch struct {
    ID           string             `json:"id" gorm:"primaryKey"`
    TenantID     string             `json:"tenant_id" gorm:"index"`
    UserID       string             `json:"user_id" gorm:"index"`
    Name         string             `json:"name"`
    Status       string             `json:"status" gorm:"index"`
    Domains      []string           `json:"domains" gorm:"type:json"`
    TotalDomains int                `json:"total_domains"`
    SuccessCount int                `json:"success_count"`
    FailCount    int                `json:"fail_count"`
    
    // 结果汇总
    Results      []SiteRankResult   `json:"results" gorm:"type:json"`
    Priorities   map[string]string  `json:"priorities" gorm:"type:json"` // domain -> priority
    
    CreatedAt    time.Time          `json:"created_at"`
    UpdatedAt    time.Time          `json:"updated_at"`
}

type SiteRankResult struct {
    Domain       string    `json:"domain"`
    Status       string    `json:"status"`
    GlobalRank   *int      `json:"global_rank"`
    Category     string    `json:"category"`
    Visits       *float64  `json:"visits"`
    Priority     string    `json:"priority"` // High, Medium, Low
    QueryTime    int64     `json:"query_time_ms"`
    Error        string    `json:"error,omitempty"`
    CreatedAt    time.Time `json:"created_at"`
}
```

### 3.2 API集成实现

```go
// SimilarWeb API客户端
type SimilarWebClient struct {
    apiURL     string
    apiKey     string
    httpClient *http.Client
    rateLimit  *RateLimiter
}

func (c *SimilarWebClient) GetDomainData(domain string) (*SimilarWebResponse, error) {
    // 1. 检查缓存
    if cached := c.cache.Get(domain); cached != nil {
        return cached.(*SimilarWebResponse), nil
    }
    
    // 2. 速率限制
    if err := c.rateLimit.Wait(context.Background()); err != nil {
        return nil, err
    }
    
    // 3. 构建请求
    url := fmt.Sprintf("%s?domain=%s&api_key=%s", c.apiURL, domain, c.apiKey)
    
    // 4. 执行请求
    resp, err := c.httpClient.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    // 5. 解析响应
    if resp.StatusCode != 200 {
        return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
    }
    
    var result SimilarWebResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    
    // 6. 缓存结果
    c.cache.Set(domain, result, 24*time.Hour)
    
    return &result, nil
}

// 智能重试机制
func (c *SimilarWebClient) GetDomainDataWithRetry(domain string, maxRetries int) (*SimilarWebResponse, error) {
    var lastErr error
    
    for attempt := 0; attempt <= maxRetries; attempt++ {
        result, err := c.GetDomainData(domain)
        if err == nil {
            return result, nil
        }
        
        lastErr = err
        
        // 指数退避
        delay := time.Duration(math.Pow(2, float64(attempt))) * time.Second
        time.Sleep(delay)
    }
    
    return nil, fmt.Errorf("after %d attempts: %v", maxRetries, lastErr)
}
```

### 3.3 智能批处理系统

```go
// 批处理服务
type BatchProcessor struct {
    queue         chan *SiteRankBatch
    activeJobs    map[string]*BatchJob
    rateLimit     *RateLimiter
    stats         *ProcessorStats
}

func (p *BatchProcessor) ProcessBatch(batch *SiteRankBatch) error {
    // 1. 验证Token
    user := p.getUser(batch.UserID)
    cost := len(batch.Domains) * 100 // 每个域名100 Token
    
    if !p.tokenService.CanAfford(user.ID, cost) {
        return errors.New("insufficient tokens")
    }
    
    // 2. 创建处理任务
    job := &BatchJob{
        Batch:    batch,
        User:     user,
        TokenCost: cost,
        Status:   "queued",
    }
    
    // 3. 加入队列
    p.queue <- job
    
    // 4. 消费Token
    if err := p.tokenService.ConsumeTokens(ctx, user.ID, "siterank_batch", cost); err != nil {
        return errors.New("insufficient tokens")
    }
    
    return nil
}

func (p *BatchProcessor) Start() {
    go p.processQueue()
}

func (p *BatchProcessor) processQueue() {
    for job := range p.queue {
        p.activeJobs[job.Batch.ID] = job
        go p.executeBatch(job)
    }
}

func (p *BatchProcessor) executeBatch(job *BatchJob) {
    job.Status = "running"
    job.StartTime = time.Now()
    
    // 智能分批处理
    batchSize := p.calculateOptimalBatchSize()
    
    for i := 0; i < len(job.Batch.Domains); i += batchSize {
        end := i + batchSize
        if end > len(job.Batch.Domains) {
            end = len(job.Batch.Domains)
        }
        
        batch := job.Batch.Domains[i:end]
        results := p.processDomainBatch(batch)
        
        // 更新进度
        job.Batch.SuccessCount += len(results)
        job.Batch.Results = append(job.Batch.Results, results...)
        
        // 更新数据库
        p.db.Model(job.Batch).Updates(map[string]interface{}{
            "success_count": job.Batch.SuccessCount,
            "results":       job.Batch.Results,
        })
    }
    
    // 计算优先级
    p.calculatePriorities(job.Batch)
    
    // 完成任务
    job.Status = "completed"
    job.EndTime = time.Now()
    delete(p.activeJobs, job.Batch.ID)
}

// 动态批次大小调整
func (p *BatchProcessor) calculateOptimalBatchSize() int {
    // 基于错误率动态调整
    errorRate := p.stats.GetRecentErrorRate()
    
    if errorRate > 0.5 {
        return 5  // 高错误率，小批次
    } else if errorRate > 0.2 {
        return 10 // 中等错误率
    } else {
        return 20 // 低错误率，大批次
    }
}
```

### 3.4 API接口规格

```go
// 1. 单域名查询 - 对应 /api/siterank/rank
func (h *SiteRankHandler) GetDomainRank(c *gin.Context) {
    domain := c.Query("domain")
    // source := c.Query("type") // 仅支持similarweb
    
    // 验证域名
    if !h.isValidDomain(domain) {
        c.JSON(400, gin.H{"error": "Invalid domain format"})
        return
    }
    
    // 检查缓存
    var query SiteRankQuery
    if err := h.db.Where("domain = ? AND source = ? AND cache_until > NOW()", 
        domain, source).First(&query).Error; err == nil {
        c.JSON(200, gin.H{
            "domain":      query.Domain,
            "globalRank":  query.GlobalRank,
            "category":    query.Category,
            "country":     query.Country,
            "visits":      query.Visits,
            "bounceRate":  query.BounceRate,
            "pagesPerVisit": query.PagesPerVisit,
            "avgDuration": query.AvgDuration,
            "cached":      true,
        })
        return
    }
    
    // 验证Token
    user := h.getCurrentUser(c)
    if !h.tokenService.CanAfford(user.ID, 100) {
        c.JSON(403, gin.H{"error": "Insufficient tokens"})
        return
    }
    
    // 获取数据
    var data interface{}
    var err error
    
    switch source {
    case "similarweb":
        data, err = h.similarWeb.GetDomainDataWithRetry(domain, 3)
    // 不再支持alexa
    /* case "alexa":
        data, err = h.alexa.GetDomainData(domain) */
    default:
        c.JSON(400, gin.H{"error": "Invalid source type"})
        return
    }
    
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 保存到数据库
    query = SiteRankQuery{
        ID:          uuid.New().String(),
        TenantID:    user.TenantID,
        UserID:      user.ID,
        Domain:      domain,
        Source:      source,
        Status:      "completed",
        CacheUntil:  time.Now().Add(24 * time.Hour),
    }
    
    // 填充数据
    if swData, ok := data.(*SimilarWebResponse); ok {
        query.GlobalRank = swData.GlobalRank
        query.Category = swData.Category
        query.Country = swData.Country
        query.Visits = swData.Visits
    }
    
    h.db.Create(&query)
    
    // 消费Token
    if err := h.tokenService.ConsumeTokens(ctx, user.ID, "siterank_query", 100); err != nil {
        c.JSON(400, gin.H{"error": "Failed to consume tokens"})
        return
    }
    
    c.JSON(200, gin.H{
        "domain":      query.Domain,
        "globalRank":  query.GlobalRank,
        "category":    query.Category,
        "country":     query.Country,
        "visits":      query.Visits,
        "cached":      false,
    })
}

// 2. 批量查询 - 对应 /api/v1/siterankgo/traffic/batch
func (h *SiteRankHandler) BatchQuery(c *gin.Context) {
    var req struct {
        Domains []string `json:"domains" binding:"required"`
        Source  string   `json:"source" binding:"required,oneof=similarweb"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 去重
    domains := h.deduplicate(req.Domains)
    
    // 创建批次任务
    batch := &SiteRankBatch{
        ID:           uuid.New().String(),
        TenantID:     h.getCurrentUser(c).TenantID,
        UserID:       h.getCurrentUser(c).ID,
        Name:         fmt.Sprintf("Batch Query %s", time.Now().Format("20060102-150405")),
        Status:       "pending",
        Domains:      domains,
        TotalDomains: len(domains),
    }
    
    // 处理批次
    if err := h.batchProcessor.ProcessBatch(batch); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "batchId":      batch.ID,
        "totalDomains": len(domains),
        "status":       "processing",
    })
}

// 3. 获取优先级 - 新增功能
func (h *SiteRankHandler) CalculatePriorities(c *gin.Context) {
    var req struct {
        Domains []string `json:"domains" binding:"required"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 获取所有域名的排名数据
    var queries []SiteRankQuery
    h.db.Where("domain IN ?", req.Domains).Find(&queries)
    
    // 计算优先级
    priorities := make(map[string]string)
    for _, domain := range req.Domains {
        var query *SiteRankQuery
        for _, q := range queries {
            if q.Domain == domain {
                query = &q
                break
            }
        }
        
        if query != nil && query.GlobalRank != nil {
            priority := h.calculatePriority(*query.GlobalRank, query.Visits)
            priorities[domain] = priority
        } else {
            priorities[domain] = "Unknown"
        }
    }
    
    c.JSON(200, gin.H{
        "priorities": priorities,
    })
}

// 优先级计算算法
func (h *SiteRankHandler) calculatePriority(rank int, visits *float64) string {
    if visits == nil {
        visits = new(float64)
    }
    
    // 基于排名和访问量的优先级逻辑
    if rank <= 10000 && *visits > 10 {
        return "High"
    } else if rank <= 100000 && *visits > 1 {
        return "Medium"
    } else {
        return "Low"
    }
}
```

## 4. 数据库迁移方案

### 4.1 BatchGo表结构

```sql
-- Batch任务主表
CREATE TABLE batch_tasks (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('silent', 'autoclick') NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed', 'terminated') NOT NULL DEFAULT 'pending',
    urls JSON NOT NULL,
    total_urls INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    fail_count INT NOT NULL DEFAULT 0,
    pending_count INT NOT NULL DEFAULT 0,
    
    -- 执行配置
    cycle_count INT DEFAULT 1,
    proxy_url TEXT,
    access_mode ENUM('http', 'puppeteer') DEFAULT 'http',
    concurrency_limit INT DEFAULT 3,
    
    -- AutoClick特有
    schedule VARCHAR(100),
    daily_target INT,
    current_progress INT DEFAULT 0,
    
    -- 时间信息
    start_time DATETIME,
    end_time DATETIME,
    duration_ms BIGINT,
    
    -- 结果数据
    results JSON,
    error_summary JSON,
    proxy_stats JSON,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_tenant_user (tenant_id, user_id),
    INDEX idx_type_status (type, status),
    INDEX idx_created_at (created_at)
);

-- 任务结果详情表（可选，用于详细查询）
CREATE TABLE batch_task_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    status ENUM('success', 'failed', 'timeout') NOT NULL,
    status_code INT,
    response_time_ms BIGINT,
    error_message TEXT,
    proxy_used TEXT,
    attempts INT DEFAULT 1,
    cycle_index INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_task_id (task_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);
```

### 4.2 SiteRankGo表结构

```sql
-- 站点排名查询记录
CREATE TABLE site_rank_queries (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    source ENUM('similarweb') NOT NULL,
    
    -- SimilarWeb数据
    global_rank INT,
    category_rank INT,
    category VARCHAR(100),
    country VARCHAR(2),
    visits DECIMAL(10,2), -- 月访问量(百万)
    bounce_rate DECIMAL(5,2),
    pages_per_visit DECIMAL(5,2),
    avg_duration DECIMAL(8,2),
    
    -- API相关
    api_response TEXT,
    api_error TEXT,
    cache_until DATETIME,
    
    -- 统计
    request_count INT DEFAULT 1,
    last_queried DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_domain_source (domain, source),
    INDEX idx_tenant_user (tenant_id, user_id),
    INDEX idx_domain (domain),
    INDEX idx_cache_until (cache_until)
);

-- 批量查询任务
CREATE TABLE site_rank_batches (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    domains JSON NOT NULL,
    total_domains INT NOT NULL DEFAULT 0,
    success_count INT DEFAULT 0,
    fail_count INT DEFAULT 0,
    
    -- 结果汇总
    results JSON,
    priorities JSON,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_tenant_user (tenant_id, user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);
```

## 5. 兼容性保证

### 5.1 API路径映射

| 原有路径 | 新路径 | 兼容性处理 |
|---------|-------|-----------|
| `/api/batchopen/silent-start` | `/api/v1/batchgo/tasks/silent/start` | 代理转发 |
| `/api/batchopen/silent-progress` | `/api/v1/batchgo/tasks/silent/progress` | 代理转发 |
| `/api/batchopen/silent-terminate` | `/api/v1/batchgo/tasks/silent/terminate` | 代理转发 |
| `/api/autoclick/tasks` | `/api/v1/batchgo/tasks/autoclick` | 代理转发 |
| `/api/siterank/rank` | `/api/v1/siterankgo/traffic` | 代理转发 |
| `/api/v1/siterank/tasks` | `/api/v1/siterankgo/tasks` | 直接映射 |

### 5.2 数据格式兼容

**解决方案**：使用适配器模式，确保新旧数据格式100%兼容。

```go
// BatchOpen响应适配器
func AdaptBatchOpenResponse(task *BatchTask) gin.H {
    return gin.H{
        "taskId":        task.ID,
        "status":        task.Status,
        "progress":      float64(task.SuccessCount+task.FailCount) / float64(task.TotalURLs*task.CycleCount) * 100,
        "total":         task.TotalURLs * task.CycleCount,
        "successCount":  task.SuccessCount,
        "failCount":     task.FailCount,
        "pendingCount":  task.PendingCount,
        "message":       adaptTaskMessage(task),
        "proxyStats":    adaptProxyStats(task.ProxyStats),
        "errorSummary":  adaptErrorSummary(task.ErrorSummary),
        "startTime":     task.StartTime,
        "endTime":       task.EndTime,
    }
}

// SiteRank响应适配器
func AdaptSiteRankResponse(query *SiteRankQuery) gin.H {
    return gin.H{
        "domain":      query.Domain,
        "globalRank":  query.GlobalRank,
        "category":    query.Category,
        "country":     query.Country,
        "visits":      query.Visits,
        "bounceRate":  query.BounceRate,
        "pagesPerVisit": query.PagesPerVisit,
        "avgDuration": query.AvgDuration,
        "status":      query.Status,
    }
}
```

## 6. 测试策略

### 6.1 功能测试清单

**BatchGo测试用例**：
- [ ] Silent模式基本功能
- [ ] 并发控制逻辑
- [ ] 代理轮询机制
- [ ] 任务终止功能
- [ ] 错误重试机制
- [ ] Token消费准确性
- [ ] AutoClick调度功能
- [ ] 进度查询准确性

**SiteRankGo测试用例**：
- [ ] 单域名查询功能
- [ ] 批量查询功能
- [ ] 缓存机制
- [ ] 速率限制
- [ ] 优先级计算
- [ ] 错误处理
- [ ] API集成稳定性

### 6.2 性能测试目标

- BatchGo：支持100个URL并发处理，P95 < 2s
- SiteRankGo：支持1000个域名批量查询，错误率 < 5%
- 内存使用：稳定在1GB以下
- 数据库连接池：最大100连接

通过以上详细规格，Go版本的BatchGo和SiteRankGo将100%实现现有功能，同时提供更好的性能和可靠性。所有API接口保持向后兼容，前端无需任何修改。