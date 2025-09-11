# 高并发控制优化

### 4.1 BatchGo并发执行

```go
// BatchGoExecutor 高并发任务执行器
type BatchGoExecutor struct {
    pool         *WorkerPool      // 工作池
    rateLimiter  *RateLimiter     // 限流器
    semaphore    chan struct{}    // 信号量控制并发
    ctx          context.Context   // 上下文控制
    cancel       context.CancelFunc
}

// ExecuteTasks 并发执行任务
func (e *BatchGoExecutor) ExecuteTasks(tasks []*BatchGoTask) error {
    e.ctx, e.cancel = context.WithCancel(context.Background())
    
    var wg sync.WaitGroup
    
    for _, task := range tasks {
        // 检查上下文是否已取消
        if e.ctx.Err() != nil {
            break
        }
        
        wg.Add(1)
        go func(task *BatchGoTask) {
            defer wg.Done()
            
            // 信号量控制
            e.semaphore <- struct{}{}
            defer func() { <-e.semaphore }()
            
            // 限流控制
            if err := e.rateLimiter.Wait(e.ctx); err != nil {
                return
            }
            
            // 执行任务
            e.executeTask(task)
        }(task)
    }
    
    wg.Wait()
    return nil
}
```

### 4.2 连接池优化

```go
// 数据库连接池配置
func InitDBPool(config DatabaseConfig) (*gform.DB, error) {
    db, err := gform.NewDB(config)
    if err != nil {
        return nil, err
    }
    
    // 设置连接池参数
    sqlDB, err := db.DB()
    if err != nil {
        return nil, err
    }
    
    // 根据并发需求调整连接池
    sqlDB.SetMaxIdleConns(20)      // 空闲连接数
    sqlDB.SetMaxOpenConns(200)     // 最大连接数（支持200并发）
    sqlDB.SetConnMaxLifetime(time.Hour * 2)
    
    return db, nil
}

// HTTP客户端连接池
var httpClient = &http.Client{
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 10,
        IdleConnTimeout:     90 * time.Second,
        // 启用HTTP/2
        ForceAttemptHTTP2: true,
    },
    Timeout: 30 * time.Second,
}
```