# 性能优化策略

### 10.1 数据库优化

```go
// internal/store/db.go
func InitDB(config DatabaseConfig) (*gorm.DB, error) {
    dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
        config.Username,
        config.Password,
        config.Host,
        config.Port,
        config.Database,
    )
    
    db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
        Logger: logger.Default.LogMode(logger.Silent),
        PrepareStmt: true,
    })
    
    if err != nil {
        return nil, err
    }
    
    sqlDB, err := db.DB()
    if err != nil {
        return nil, err
    }
    
    // 连接池配置
    sqlDB.SetMaxIdleConns(10)
    sqlDB.SetMaxOpenConns(100)
    sqlDB.SetConnMaxLifetime(time.Hour)
    
    return db, nil
}
```

### 10.2 并发控制

```go
// internal/pkg/concurrent/limiter.go
type ConcurrencyLimiter struct {
    maxConcurrent int
    current      int32
    semaphore    chan struct{}
}

func NewConcurrencyLimiter(max int) *ConcurrencyLimiter {
    return &ConcurrencyLimiter{
        maxConcurrent: max,
        semaphore:    make(chan struct{}, max),
    }
}

func (cl *ConcurrencyLimiter) Acquire() {
    cl.semaphore <- struct{}{}
    atomic.AddInt32(&cl.current, 1)
}

func (cl *ConcurrencyLimiter) Release() {
    <-cl.semaphore
    atomic.AddInt32(&cl.current, -1)
}
```