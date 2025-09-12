# AutoAds SaaS平台设计文档

## 概述

哥，这个设计完全遵循你的核心哲学：数据结构优先、消除特殊情况、Never break userspace、实用主义。

**设计原则**：
- **数据结构优先**："Bad programmers worry about the code. Good programmers worry about data structures."
- **消除特殊情况**："好代码没有特殊情况" - 通过合理的数据结构设计，减少if/else分支
- **Never break userspace**：保持所有API接口100%兼容，前端零修改
- **实用主义**：直接fork gofly_admin_v3/源码，复用成熟组件，不重复造轮子
- **简洁执念**：单进程部署，一个二进制文件包含所有功能

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    统一入口 (8888端口)                      │
├─────────────────────────────────────────────────────────────┤
│                   扩展的GoFly框架                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   SaaS模块      │  │   Admin模块     │  │  核心框架   │ │
│  │ - 用户认证      │  │ - 用户管理      │  │ - 路由      │ │
│  │ - BatchGo       │  │ - 系统配置      │  │ - 中间件    │ │
│  │ - SiteRankGo    │  │ - 数据统计      │  │ - ORM       │ │
│  │ - Chengelink    │  │ - Token管理     │  │ - 缓存      │ │
│  │ - Token系统     │  │ - 邀请管理      │  │ - 日志      │ │
│  │ - 邀请/签到     │  │                 │  │ - 定时任务  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    基础设施层                               │
│  MySQL 8.0  │  Redis  │  监控  │  日志收集  │  告警系统    │
└─────────────────────────────────────────────────────────────┘
```

### 核心设计决策

#### 1. 数据结构优先的设计

**统一用户模型**：
```go
// 扩展GoFly的User模型，消除所有特殊情况
type User struct {
    gorm.Model               // 复用GORM基础模型
    Email         string    `gorm:"type:varchar(100);unique;not null"`
    Password      string    `json:"-" gorm:"size:255"`                    // 管理员密码
    GoogleID      string    `gorm:"type:varchar(255);unique"`             // Google OAuth
    Role          string    `gorm:"type:varchar(20);default:'user'"`      // 'user' or 'admin'
    TokenBalance  int       `gorm:"default:0"`                            // 直接在用户表，最简单
    Plan          string    `gorm:"type:varchar(20);default:'free'"`      // free, pro
    PlanExpires   *time.Time
    InviteCode    string    `gorm:"type:varchar(20);unique"`              // 注册时自动生成
    InvitedBy     *string   `gorm:"type:varchar(36)"`
    Name          string    `gorm:"type:varchar(100)"`
    Avatar        string    `gorm:"type:varchar(255)"`
    LastLogin     *time.Time
    Status        int       `gorm:"default:1"` // 1: active, 0: inactive
}
```

**业务数据关联**：
```go
// 所有业务表都通过user_id关联，消除租户复杂性
type BatchTask struct {
    gorm.Model
    UserID       uint      `gorm:"not null;index"`  // 直接关联用户ID
    Name         string    `gorm:"type:varchar(100);not null"`
    Type         string    `gorm:"type:varchar(20);not null"`      // silent, autoclick, basic
    Status       string    `gorm:"type:varchar(20);default:'pending'"`
    URLs         []string  `gorm:"type:json"`
    TotalURLs    int       `gorm:"not null;default:0"`
    SuccessCount int       `gorm:"default:0"`
    FailCount    int       `gorm:"default:0"`
    // 其他字段...
}
```

#### 2. 消除特殊情况的认证系统

**统一认证方式**：
- **网站用户**：Google OAuth → JWT Token（无特殊情况）
- **管理员**：邮箱密码 → Session Cookie（复用GoFly现有系统）
- **没有混合认证**：每种用户类型只有一种认证方式

```go
// 认证中间件，消除复杂的权限判断
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 简单直接：从JWT中提取user_id
        userID := extractUserIDFromJWT(c)
        if userID == 0 {
            c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
            return
        }
        c.Set("user_id", userID)
        c.Next()
    }
}
```

#### 3. 实用主义的框架集成

**直接fork GoFly**：
```
gofly_admin_v3/                 # 直接基于本地源码扩展
├── internal/
│   ├── models/                 # 扩展数据模型
│   │   ├── user.go             # 扩展用户模型
│   │   ├── batch_task.go       # BatchGo任务
│   │   ├── siterank_query.go   # SiteRank查询
│   │   └── chengelink_task.go  # Chengelink任务
│   ├── modules/                # 新增业务模块
│   │   ├── batchgo/           # BatchGo功能
│   │   ├── siterankgo/        # SiteRank功能
│   │   ├── chengelink/        # Chengelink功能
│   │   ├── token/             # Token系统
│   │   ├── invitation/        # 邀请系统
│   │   └── checkin/           # 签到系统
│   └── api/                   # API路由
│       ├── v1/saas/           # SaaS API
│       └── admin/             # Admin API
└── cmd/
    └── server.go              # 统一服务入口
```

## 数据模型设计

### 核心表结构

#### 用户表（users）
```sql
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255),                    -- 管理员密码
    google_id VARCHAR(255) UNIQUE,            -- Google OAuth ID
    role ENUM('user', 'admin') DEFAULT 'user',
    token_balance INT DEFAULT 0,              -- 直接在用户表，最简单
    plan ENUM('free', 'pro') DEFAULT 'free',
    plan_expires DATETIME,
    invite_code VARCHAR(20) UNIQUE,           -- 注册时自动生成
    invited_by BIGINT UNSIGNED,               -- 邀请人ID
    name VARCHAR(100),
    avatar VARCHAR(255),
    last_login DATETIME,
    status TINYINT DEFAULT 1,                 -- 1: active, 0: inactive
    
    INDEX idx_email (email),
    INDEX idx_google_id (google_id),
    INDEX idx_role (role),
    INDEX idx_plan (plan),
    INDEX idx_invite_code (invite_code)
);
```

#### Token交易记录表（token_transactions）
```sql
CREATE TABLE token_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    user_id BIGINT UNSIGNED NOT NULL,
    amount INT NOT NULL,                      -- 正数增加，负数消费
    balance INT NOT NULL,                     -- 变动后余额
    type ENUM('purchase', 'checkin', 'invite', 'consume') NOT NULL,
    description VARCHAR(100),
    
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_type (type),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### BatchGo任务表（batch_tasks）
```sql
CREATE TABLE batch_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('basic', 'silent', 'autoclick') NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed', 'terminated') DEFAULT 'pending',
    urls JSON NOT NULL,
    total_urls INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    fail_count INT NOT NULL DEFAULT 0,
    
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
    
    INDEX idx_user_status (user_id, status),
    INDEX idx_type_status (type, status),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### SiteRank查询表（siterank_queries）
```sql
CREATE TABLE siterank_queries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    user_id BIGINT UNSIGNED NOT NULL,
    domain VARCHAR(255) NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
    source ENUM('similarweb') NOT NULL,
    
    -- SimilarWeb数据
    global_rank INT,
    category_rank INT,
    category VARCHAR(100),
    country VARCHAR(2),
    visits DECIMAL(10,2),
    bounce_rate DECIMAL(5,2),
    pages_per_visit DECIMAL(5,2),
    avg_duration DECIMAL(8,2),
    priority ENUM('High', 'Medium', 'Low'),
    
    -- 缓存控制
    cache_until DATETIME,
    request_count INT DEFAULT 1,
    
    INDEX idx_user_domain (user_id, domain),
    INDEX idx_cache_until (cache_until),
    UNIQUE KEY uk_user_domain_source (user_id, domain, source),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### Chengelink任务表（chengelink_tasks）
```sql
CREATE TABLE chengelink_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
    
    -- 配置信息
    affiliate_link TEXT NOT NULL,
    adspower_env VARCHAR(100),
    google_ads_account VARCHAR(100),
    
    -- 执行结果
    extracted_url TEXT,
    updated_ads_count INT DEFAULT 0,
    execution_log TEXT,
    
    -- 时间信息
    start_time DATETIME,
    end_time DATETIME,
    
    INDEX idx_user_status (user_id, status),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 邀请记录表（invitations）
```sql
CREATE TABLE invitations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    inviter_id BIGINT UNSIGNED NOT NULL,
    invitee_id BIGINT UNSIGNED NOT NULL,
    invite_code VARCHAR(20) NOT NULL,
    status ENUM('pending', 'completed') DEFAULT 'pending',
    
    -- 奖励信息
    inviter_reward_given BOOLEAN DEFAULT FALSE,
    invitee_reward_given BOOLEAN DEFAULT FALSE,
    reward_days INT DEFAULT 30,
    token_reward INT DEFAULT 1000,
    
    INDEX idx_inviter (inviter_id),
    UNIQUE KEY uk_invitee (invitee_id),
    FOREIGN KEY (inviter_id) REFERENCES users(id),
    FOREIGN KEY (invitee_id) REFERENCES users(id)
);
```

#### 签到记录表（checkin_records）
```sql
CREATE TABLE checkin_records (
    user_id BIGINT UNSIGNED NOT NULL,
    checkin_date DATE NOT NULL,
    token_reward INT DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, checkin_date),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## API设计

### API兼容性策略

**Never break userspace**：保持所有现有API路径和响应格式100%兼容

```go
// 完全复刻现有API路径
router.POST("/api/batchopen/silent-start", handlers.SilentStartHandler)
router.GET("/api/batchopen/silent-progress", handlers.SilentProgressHandler)
router.POST("/api/batchopen/silent-terminate", handlers.SilentTerminateHandler)
router.POST("/api/autoclick/tasks", handlers.AutoClickCreateHandler)
router.GET("/api/autoclick/tasks/:id/progress", handlers.AutoClickProgressHandler)
router.GET("/api/siterank/rank", handlers.SiteRankHandler)
router.POST("/api/chengelink/create", handlers.ChengeLinkCreateHandler)
router.GET("/api/chengelink/tasks", handlers.ChengeLinkTasksHandler)

// 统一响应格式，与现有系统完全一致
type APIResponse struct {
    Code       int         `json:"code"`        // 0: 成功, 1000-1999: 参数错误, 2000-2999: 业务错误
    Message    string      `json:"message"`
    Data       interface{} `json:"data"`
    Pagination interface{} `json:"pagination,omitempty"`
}
```

### 新增SaaS API

```go
// 认证相关
router.POST("/api/auth/google", handlers.GoogleOAuthHandler)
router.POST("/api/auth/callback", handlers.GoogleCallbackHandler)

// 用户相关
router.GET("/api/user/profile", handlers.GetUserProfileHandler)
router.PUT("/api/user/profile", handlers.UpdateUserProfileHandler)
router.GET("/api/user/stats", handlers.GetUserStatsHandler)

// Token相关
router.GET("/api/tokens/balance", handlers.GetTokenBalanceHandler)
router.GET("/api/tokens/transactions", handlers.GetTokenTransactionsHandler)
router.POST("/api/tokens/purchase", handlers.PurchaseTokensHandler)

// 邀请相关
router.GET("/api/invitation/info", handlers.GetInvitationInfoHandler)
router.POST("/api/invitation/generate-link", handlers.GenerateInviteLinkHandler)
router.GET("/api/invitation/history", handlers.GetInvitationHistoryHandler)

// 签到相关
router.GET("/api/checkin/info", handlers.GetCheckinInfoHandler)
router.POST("/api/checkin/perform", handlers.PerformCheckinHandler)
router.GET("/api/checkin/history", handlers.GetCheckinHistoryHandler)

// 管理员API
router.GET("/admin/users", handlers.AdminGetUsersHandler)
router.PUT("/admin/users/:id", handlers.AdminUpdateUserHandler)
router.GET("/admin/stats", handlers.AdminGetStatsHandler)
```

## 组件设计

### 认证组件

```go
// JWT认证中间件，消除复杂的权限判断
type JWTMiddleware struct {
    secretKey []byte
}

func (m *JWTMiddleware) Authenticate() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.AbortWithStatusJSON(401, APIResponse{
                Code:    3001,
                Message: "Missing authorization token",
            })
            return
        }
        
        // 简单直接：解析JWT获取user_id
        userID, err := m.parseJWT(token)
        if err != nil {
            c.AbortWithStatusJSON(401, APIResponse{
                Code:    3002,
                Message: "Invalid token",
            })
            return
        }
        
        c.Set("user_id", userID)
        c.Next()
    }
}
```

### Token系统组件

```go
// Token服务，消除复杂的钱包概念
type TokenService struct {
    db *gorm.DB
}

// 消费Token，简单直接
func (s *TokenService) ConsumeTokens(userID uint, amount int, description string) error {
    return s.db.Transaction(func(tx *gorm.DB) error {
        // 1. 检查余额
        var user User
        if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
            return err
        }
        
        if user.TokenBalance < amount {
            return errors.New("insufficient token balance")
        }
        
        // 2. 扣减余额
        newBalance := user.TokenBalance - amount
        if err := tx.Model(&user).Update("token_balance", newBalance).Error; err != nil {
            return err
        }
        
        // 3. 记录交易
        transaction := TokenTransaction{
            UserID:      userID,
            Amount:      -amount,
            Balance:     newBalance,
            Type:        "consume",
            Description: description,
        }
        return tx.Create(&transaction).Error
    })
}
```

### BatchGo组件

```go
// BatchGo服务，保持API完全兼容
type BatchGoService struct {
    db    *gorm.DB
    token *TokenService
}

// Silent模式启动，API路径和响应格式完全兼容
func (s *BatchGoService) SilentStart(c *gin.Context) {
    userID := c.GetUint("user_id")
    
    var req struct {
        Name         string   `json:"name" binding:"required"`
        URLs         []string `json:"urls" binding:"required"`
        CycleCount   int      `json:"cycle_count"`
        ProxyURL     string   `json:"proxy_url"`
        AccessMode   string   `json:"access_mode"`
        Concurrency  int      `json:"concurrency"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(200, APIResponse{
            Code:    1001,
            Message: "Invalid parameters",
        })
        return
    }
    
    // 计算Token消费
    tokenCost := len(req.URLs)
    if req.AccessMode == "puppeteer" {
        tokenCost *= 2
    }
    
    // 消费Token
    if err := s.token.ConsumeTokens(userID, tokenCost, "BatchGo Silent task"); err != nil {
        c.JSON(200, APIResponse{
            Code:    2001,
            Message: "Insufficient tokens",
        })
        return
    }
    
    // 创建任务
    task := BatchTask{
        UserID:           userID,
        Name:             req.Name,
        Type:             "silent",
        Status:           "pending",
        URLs:             req.URLs,
        TotalURLs:        len(req.URLs),
        CycleCount:       req.CycleCount,
        ProxyURL:         req.ProxyURL,
        AccessMode:       req.AccessMode,
        ConcurrencyLimit: req.Concurrency,
    }
    
    if err := s.db.Create(&task).Error; err != nil {
        c.JSON(200, APIResponse{
            Code:    5001,
            Message: "Failed to create task",
        })
        return
    }
    
    // 启动异步执行
    go s.executeSilentTask(&task)
    
    c.JSON(200, APIResponse{
        Code:    0,
        Message: "Task started successfully",
        Data: map[string]interface{}{
            "task_id": task.ID,
            "status":  task.Status,
        },
    })
}
```

## 性能设计

### 缓存策略

```go
// 缓存服务，消除复杂的缓存逻辑
type CacheService struct {
    redis *redis.Client
}

// 用户信息缓存
func (s *CacheService) GetUserInfo(userID uint) (*User, error) {
    key := fmt.Sprintf("user:%d:info", userID)
    
    // 先从缓存获取
    var user User
    if err := s.redis.Get(key).Scan(&user); err == nil {
        return &user, nil
    }
    
    // 缓存未命中，从数据库获取
    if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
        return nil, err
    }
    
    // 写入缓存
    s.redis.Set(key, user, 30*time.Minute)
    return &user, nil
}

// SiteRank结果缓存
func (s *CacheService) GetSiteRankResult(domain string) (*SiteRankQuery, error) {
    key := fmt.Sprintf("siterank:%s", domain)
    
    var result SiteRankQuery
    if err := s.redis.Get(key).Scan(&result); err == nil {
        // 检查缓存是否过期
        if time.Now().Before(result.CacheUntil) {
            return &result, nil
        }
    }
    
    return nil, errors.New("cache miss")
}
```

### 并发控制

```go
// 并发控制，简单直接
type ConcurrencyController struct {
    semaphore chan struct{}
}

func NewConcurrencyController(limit int) *ConcurrencyController {
    return &ConcurrencyController{
        semaphore: make(chan struct{}, limit),
    }
}

func (c *ConcurrencyController) Acquire() {
    c.semaphore <- struct{}{}
}

func (c *ConcurrencyController) Release() {
    <-c.semaphore
}
```

## 安全设计

### 数据隔离

```go
// 用户数据隔离中间件，确保用户只能访问自己的数据
func UserDataIsolationMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("user_id")
        if userID == 0 {
            c.AbortWithStatusJSON(401, APIResponse{
                Code:    3001,
                Message: "User not authenticated",
            })
            return
        }
        
        // 在所有数据库查询中自动添加user_id条件
        c.Set("user_id", userID)
        c.Next()
    }
}
```

### 请求限流

```go
// 简单的令牌桶限流
type RateLimiter struct {
    tokens   chan struct{}
    interval time.Duration
}

func NewRateLimiter(rate int, interval time.Duration) *RateLimiter {
    limiter := &RateLimiter{
        tokens:   make(chan struct{}, rate),
        interval: interval,
    }
    
    // 定期补充令牌
    go func() {
        ticker := time.NewTicker(interval)
        for range ticker.C {
            select {
            case limiter.tokens <- struct{}{}:
            default:
            }
        }
    }()
    
    return limiter
}

func (r *RateLimiter) Allow() bool {
    select {
    case <-r.tokens:
        return true
    default:
        return false
    }
}
```

## WebSocket实时通信

### WebSocket服务

```go
// WebSocket服务，支持BatchGo Basic模式和实时通知
type WebSocketService struct {
    clients map[uint]*websocket.Conn
    mutex   sync.RWMutex
}

// 用户连接
func (s *WebSocketService) HandleConnection(c *gin.Context) {
    userID := c.GetUint("user_id")
    
    conn, err := websocket.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        return
    }
    
    s.mutex.Lock()
    s.clients[userID] = conn
    s.mutex.Unlock()
    
    defer func() {
        s.mutex.Lock()
        delete(s.clients, userID)
        s.mutex.Unlock()
        conn.Close()
    }()
    
    // 保持连接
    for {
        _, _, err := conn.ReadMessage()
        if err != nil {
            break
        }
    }
}

// 发送BatchGo Basic模式指令
func (s *WebSocketService) SendBasicCommand(userID uint, urls []string) error {
    s.mutex.RLock()
    conn, exists := s.clients[userID]
    s.mutex.RUnlock()
    
    if !exists {
        return errors.New("user not connected")
    }
    
    message := map[string]interface{}{
        "type": "batch_basic",
        "data": map[string]interface{}{
            "action": "open_urls",
            "urls":   urls,
        },
    }
    
    return conn.WriteJSON(message)
}

// 发送任务进度更新
func (s *WebSocketService) SendTaskProgress(userID uint, taskID uint, progress map[string]interface{}) error {
    s.mutex.RLock()
    conn, exists := s.clients[userID]
    s.mutex.RUnlock()
    
    if !exists {
        return nil // 用户未连接，忽略
    }
    
    message := map[string]interface{}{
        "type": "task_progress",
        "data": map[string]interface{}{
            "task_id":  taskID,
            "progress": progress,
        },
    }
    
    return conn.WriteJSON(message)
}
```

## 部署设计

### 单进程部署

```go
// 主服务入口，单进程包含所有功能
func main() {
    // 初始化GoFly应用
    app := gofly.NewApp()
    
    // 配置数据库
    db := initDatabase()
    app.SetDB(db)
    
    // 配置Redis
    redis := initRedis()
    app.SetCache(redis)
    
    // 注册SaaS模块
    app.RegisterModule(&modules.AuthModule{})
    app.RegisterModule(&modules.BatchGoModule{})
    app.RegisterModule(&modules.SiteRankGoModule{})
    app.RegisterModule(&modules.ChengeLinkModule{})
    app.RegisterModule(&modules.TokenModule{})
    app.RegisterModule(&modules.InvitationModule{})
    app.RegisterModule(&modules.CheckinModule{})
    
    // 嵌入Next.js静态文件
    app.Static("/", "./web/dist")
    
    // 启动服务
    log.Println("AutoAds SaaS Server starting on :8888")
    app.Run(":8888")
}
```

### Docker部署

```dockerfile
# 单阶段构建，简单直接
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY . .
RUN go mod download
RUN go build -o autoads-server cmd/server.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/autoads-server .
COPY --from=builder /app/web/dist ./web/dist

EXPOSE 8888
CMD ["./autoads-server"]
```

## 错误处理设计

### 统一错误处理

```go
// 错误处理中间件
func ErrorHandlerMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()
        
        if len(c.Errors) > 0 {
            err := c.Errors.Last()
            
            // 记录错误日志
            log.Printf("API Error: %s, Path: %s, User: %v", 
                err.Error(), c.Request.URL.Path, c.Get("user_id"))
            
            // 返回统一错误格式
            c.JSON(200, APIResponse{
                Code:    5000,
                Message: "Internal server error",
            })
        }
    }
}
```

## 监控设计

### 健康检查

```go
// 健康检查接口
func HealthCheckHandler(c *gin.Context) {
    // 检查数据库
    if err := db.Exec("SELECT 1").Error; err != nil {
        c.JSON(500, gin.H{
            "status": "unhealthy",
            "reason": "database connection failed",
        })
        return
    }
    
    // 检查Redis
    if err := redis.Ping().Err(); err != nil {
        c.JSON(500, gin.H{
            "status": "unhealthy", 
            "reason": "redis connection failed",
        })
        return
    }
    
    c.JSON(200, gin.H{
        "status":    "healthy",
        "timestamp": time.Now(),
        "version":   "1.0.0",
    })
}
```

## 总结

这个设计完全遵循了你的核心哲学：

1. **数据结构优先**：先设计清晰的用户和业务数据模型，通过user_id实现简单的多用户隔离
2. **消除特殊情况**：统一的认证方式、简化的Token系统、直接的数据关联
3. **Never break userspace**：保持所有API路径和响应格式100%兼容
4. **实用主义**：直接fork GoFly源码，复用成熟组件，单进程部署
5. **简洁执念**：每个组件都只做一件事并做好，避免过度设计

整个系统架构简洁明了，没有不必要的抽象层，直接解决实际问题。