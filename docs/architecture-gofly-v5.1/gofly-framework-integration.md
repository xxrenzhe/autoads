# GoFly 框架集成方案

## 2.1 GoFly框架核心能力集成

GoFly框架提供了完整的企业级开发能力，本架构充分利用了以下核心特性：

### 2.1.1 ORM层（utils/gform/）
```go
// 使用GoFly ORM进行数据库操作
type UserService struct {
    db *gform.DB
}

func (s *UserService) GetUserList(page, size int) ([]User, int64, error) {
    var users []User
    total, err := s.db.Model(&User{}).
        Where("status = ?", "ACTIVE").
        Page(page, size).
        Order("created_at DESC").
        Select(&users)
    return users, total, err
}
```

### 2.1.2 自动路由系统（utils/router/）
```go
// 基于GoFly的自动路由注册
// controller/user.go
type UserController struct{}

// @Summary 获取用户信息
// @Tags 用户管理
func (c *UserController) GetInfo(ctx *gf.GinCtx) {
    // 自动路由: GET /api/user/info
    userID := ctx.Get("user_id")
    // 业务逻辑
}
```

### 2.1.3 缓存系统（utils/gcache/）
```go
// 多级缓存支持
func (s *Service) GetWithCache(key string) (interface{}, error) {
    // L1: 内存缓存
    if val := gcache.Get(key); val != nil {
        return val, nil
    }
    
    // L2: Redis缓存
    if val, err := gredis.Get(key); err == nil {
        gcache.Set(key, val, time.Minute*5) // 回填内存
        return val, nil
    }
    
    // 从数据库获取
    val, err := s.loadFromDB(key)
    if err == nil {
        gredis.Set(key, val, time.Hour)
        gcache.Set(key, val, time.Minute*5)
    }
    return val, err
}
```

### 2.1.4 验证框架（utils/gvalid/）
```go
// 强大的验证能力
type RegisterRequest struct {
    Email    string `v:"required|email#请输入邮箱|邮箱格式不正确"`
    Password string `v:"required|length:6,20#请输入密码|密码长度6-20位"`
    Phone    string `v:"required|phone#请输入手机号|手机号格式不正确"`
}

func Register(c *gf.GinCtx) {
    var req RegisterRequest
    if err := c.ShouldBind(&req); err != nil {
        // 自动返回验证错误
        return
    }
    // 业务逻辑
}
```

### 2.1.5 日志系统（utils/glog/）
```go
// 结构化日志
gf.Log().Info(ctx, "user_login", gf.Map{
    "user_id":    "123",
    "ip":         c.ClientIP(),
    "user_agent": c.Request.UserAgent(),
    "status":     "success",
})
```

### 2.1.6 工具集合
- **gconv**: 类型转换 `gf.ToInt(), gf.ToString()`
- **gtime**: 时间处理 `gf.Now(), gf.Date()`
- **gstr**: 字符串工具 `gf.Strlen(), gf.Substr()`
- **gjson**: JSON处理 `gf.JsonEncode(), gf.JsonDecode()`
- **gfile**: 文件操作 `gf.Readfile(), gf.Writefile()`

### 2.1.7 事件系统集成

GoFly事件系统采用**领域驱动设计（DDD）**模式，实现完整的事件驱动架构：

```go
// 基于GoFly的事件系统架构
package event

import (
    "context"
    "time"
    
    "gofly/utils/gevent"
    "gofly/utils/gredis"
    "gofly/utils/gjson"
)

// DomainEvent 领域事件接口
type DomainEvent interface {
    GetAggregateID() string
    GetEventType() string
    GetTimestamp() time.Time
    GetVersion() int
    GetData() interface{}
}

// EventBus 事件总线（基于GoFly扩展）
type EventBus struct {
    localBus    *gevent.EventBus    // 本地事件总线
    redis       *gredis.Client      // Redis支持
    nodeID      string              // 节点ID
    eventStore  EventStore         // 事件存储
    asyncQueue  chan *EventWrapper  // 异步队列
}

// EventWrapper 事件包装器
type EventWrapper struct {
    Event      DomainEvent         `json:"event"`
    Metadata   map[string]interface{} `json:"metadata"`
    RetryCount int                 `json:"retry_count"`
}

// NewEventBus 创建事件总线
func NewEventBus(redis *gredis.Client) *EventBus {
    bus := &EventBus{
        localBus:   gevent.New(),
        redis:      redis,
        nodeID:     generateNodeID(),
        asyncQueue: make(chan *EventWrapper, 1000),
        eventStore: NewRedisEventStore(redis),
    }
    
    // 启动异步处理器
    go bus.startAsyncProcessor()
    
    // 启动分布式订阅
    go bus.subscribeDistributedEvents()
    
    return bus
}

// Publish 发布事件（支持本地和分布式）
func (bus *EventBus) Publish(ctx context.Context, event DomainEvent) error {
    // 1. 持久化事件
    if err := bus.eventStore.Append(event); err != nil {
        return err
    }
    
    // 2. 本地发布
    bus.localBus.Emit(event.GetEventType(), event)
    
    // 3. 分布式发布
    eventData := &EventWrapper{
        Event: event,
        Metadata: map[string]interface{}{
            "node_id":    bus.nodeID,
            "timestamp":  time.Now(),
            "event_id":   gform.UUID(),
        },
    }
    
    data := gjson.Encode(eventData)
    bus.redis.Publish("events:"+event.GetEventType(), data)
    
    // 4. 异步处理
    bus.asyncQueue <- eventData
    
    return nil
}

// Subscribe 订阅事件（支持重试和错误处理）
func (bus *EventBus) Subscribe(eventType string, handler EventHandler) {
    bus.localBus.On(eventType, func(data interface{}) {
        event := data.(DomainEvent)
        
        // 执行处理器，支持重试
        for i := 0; i < 3; i++ {
            err := handler.Handle(ctx, event)
            if err == nil {
                // 处理成功，发布处理完成事件
                bus.Publish(ctx, NewEventHandled(event, eventType))
                return
            }
            
            // 记录错误
            glog.Error(ctx, "event_handler_failed", gform.Map{
                "event_type": eventType,
                "error":      err.Error(),
                "attempt":    i + 1,
            })
            
            // 指数退避
            time.Sleep(time.Second * time.Duration(i+1))
        }
        
        // 重试失败，进入死信队列
        bus.eventStore.SaveToDeadLetter(event, eventType)
    })
}

// EventHandler 事件处理器接口
type EventHandler interface {
    Handle(ctx context.Context, event DomainEvent) error
    GetSubscribedEvents() []string
}

// 具体事件处理器实现

// UserEventHandler 用户相关事件处理器
type UserEventHandler struct {
    userService    *UserService
    emailService   *EmailService
    analyticsSvc   *AnalyticsService
}

func (h *UserEventHandler) Handle(ctx context.Context, event DomainEvent) error {
    switch e := event.(type) {
    case *UserRegisteredEvent:
        return h.handleUserRegistered(ctx, e)
    case *UserLoggedInEvent:
        return h.handleUserLoggedIn(ctx, e)
    case *TokenConsumedEvent:
        return h.handleTokenConsumed(ctx, e)
    default:
        return fmt.Errorf("unknown event type: %s", event.GetEventType())
    }
}

func (h *UserEventHandler) handleUserRegistered(ctx context.Context, e *UserRegisteredEvent) error {
    // 使用GoFly的并发工具并行处理多个任务
    var wg sync.WaitGroup
    errChan := make(chan error, 3)
    
    // 1. 发送欢迎邮件
    wg.Add(1)
    go func() {
        defer wg.Done()
        if err := h.emailService.SendWelcomeEmail(e.Email); err != nil {
            errChan <- err
        }
    }()
    
    // 2. 赠送注册Token
    wg.Add(1)
    go func() {
        defer wg.Done()
        if err := h.userService.GrantSignupBonus(e.UserID); err != nil {
            errChan <- err
        }
    }()
    
    // 3. 记录用户行为分析
    wg.Add(1)
    go func() {
        defer wg.Done()
        h.analyticsSvc.TrackSignup(e.UserID, e.Source)
    }()
    
    // 等待所有任务完成
    wg.Wait()
    close(errChan)
    
    // 返回第一个错误（如果有）
    for err := range errChan {
        if err != nil {
            return err
        }
    }
    
    return nil
}

// 事件存储接口
type EventStore interface {
    Append(event DomainEvent) error
    GetEvents(aggregateID string) ([]DomainEvent, error)
    SaveToDeadLetter(event DomainEvent, eventType string) error
}

// RedisEventStore Redis实现的事件存储
type RedisEventStore struct {
    redis *gredis.Client
}

func (s *RedisEventStore) Append(event DomainEvent) error {
    data := gjson.Encode(event)
    
    // 使用GoFly的Redis操作
    key := fmt.Sprintf("event:%s:%s", event.GetAggregateID(), event.GetEventType())
    return s.redis.Set(key, data, time.Hour*24).Err()
}

// 事件溯源支持
type EventSourcedAggregate struct {
    ID      string
    version int
    events  []DomainEvent
}

func (agg *EventSourcedAggregate) ApplyEvent(event DomainEvent) {
    agg.events = append(agg.events, event)
    agg.version++
    
    // 更新聚合状态
    switch e := event.(type) {
    case *UserRegisteredEvent:
        agg.ID = e.UserID
        // 更新其他状态...
    }
}

// CQRS模式支持
type UserReadModel struct {
    UserID      string    `json:"user_id"`
    Email       string    `json:"email"`
    Status      string    `json:"status"`
    TokenBalance int64     `json:"token_balance"`
    LastLoginAt time.Time `json:"last_login_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

type UserReadModelRepository struct {
    db *gform.DB
}

func (r *UserReadModelRepository) UpdateFromEvent(event DomainEvent) error {
    switch e := event.(type) {
    case *UserRegisteredEvent:
        model := &UserReadModel{
            UserID:    e.UserID,
            Email:     e.Email,
            Status:    "ACTIVE",
            UpdatedAt: time.Now(),
        }
        return r.db.Create(model).Error
        
    case *TokenConsumedEvent:
        return r.db.Model(&UserReadModel{}).
            Where("user_id = ?", e.UserID).
            Update("token_balance", gform.Raw("token_balance - ?", e.Amount)).Error
    }
    return nil
}
```

**事件系统特性总结：**

1. **领域驱动设计**：强类型的事件定义
2. **异步处理**：不阻塞主业务流程
3. **事件持久化**：Redis存储，保证不丢失
4. **分布式支持**：多实例事件同步
5. **重试机制**：自动重试失败事件
6. **错误隔离**：死信队列处理失败事件
7. **CQRS支持**：读写分离的查询模型
8. **事件溯源**：完整的事件历史

### 2.1.8 性能监控和追踪
```go
// API性能监控中间件
func PerformanceMonitor() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        path := c.Request.URL.Path
        method := c.Request.Method
        
        c.Next()
        
        duration := time.Since(start)
        status := c.Writer.Status()
        
        // 记录结构化日志
        glog.Info(c, "api_request", gform.Map{
            "path":       path,
            "method":     method,
            "duration":   duration,
            "status":     status,
            "ip":         c.ClientIP(),
            "user_agent": c.Request.UserAgent(),
            "user_id":    c.Get("user_id"),
        })
        
        // 性能指标收集
        metrics.RecordAPIRequest(path, method, duration, status)
    }
}

// 错误追踪中间件
func ErrorTracker() gin.HandlerFunc {
    return func(c *gin.Context) {
        defer func() {
            if err := recover(); err != nil {
                glog.Error(c, "panic_recovery", gform.Map{
                    "error": fmt.Sprintf("%v", err),
                    "stack": string(debug.Stack()),
                    "path":  c.Request.URL.Path,
                })
                gf.Error().SetMsg("服务器内部错误").Regin(c)
            }
        }()
        
        c.Next()
        
        // 记录业务错误
        if len(c.Errors) > 0 {
            for _, e := range c.Errors {
                glog.Error(c, "business_error", gform.Map{
                    "error": e.Error(),
                    "path":  c.Request.URL.Path,
                })
            }
        }
    }
}
```

## 2.2 项目结构

```
gofly_admin_v3/
├── cmd/server/
│   └── main.go                   # 应用入口
├── internal/
│   ├── app/                      # 应用核心
│   │   ├── config.go            # 配置管理（GoFly配置）
│   │   ├── context.go           # 应用上下文
│   │   ├── middleware.go         # GoFly中间件
│   │   └── routes.go            # 路由注册
│   ├── auth/                    # 认证模块
│   │   ├── service.go           # JWT服务（GoFly JWT）
│   │   └── middleware.go        # 认证中间件
│   ├── user/                    # 用户模块
│   │   ├── service.go           # 用户服务（GoFly Model）
│   │   └── model.go             # 用户模型（GoFly ORM）
│   ├── admin/                   # 管理员模块
│   │   ├── service.go           # 管理员服务
│   │   └── model.go             # 管理员模型
│   ├── batchgo/                 # BatchGo 模块
│   │   ├── service.go           # 任务服务
│   │   ├── model.go             # 任务模型（GoFly ORM）
│   │   └── worker.go            # 任务执行器（GoFly并发）
│   ├── siterankgo/              # SiteRankGo 模块
│   │   ├── service.go           # 查询服务
│   │   ├── client.go            # API客户端（GoFly HTTP）
│   │   └── cache.go             # 缓存管理（GoFly Cache）
│   ├── adscentergo/             # AdsCenterGo 模块
│   │   ├── service.go           # 广告服务
│   │   └── model.go             # OAuth模型（GoFly ORM）
│   ├── token/                   # Token系统
│   │   ├── service.go           # Token服务
│   │   ├── model.go             # Token模型（GoFly ORM）
│   │   └── rules.go             # 消费规则
│   ├── subscription/            # 订阅系统
│   │   ├── service.go           # 订阅服务
│   │   └── model.go             # 订阅模型（GoFly ORM）
│   └── store/                    # 数据存储层
│       ├── db.go                # 数据库（GoFly ORM）
│       └── cache.go             # 缓存（GoFly Redis）
├── utils/                       # GoFly框架核心
│   ├── gform/                   # ORM框架
│   ├── gcache/                  # 缓存系统
│   ├── gvalid/                  # 验证框架
│   ├── gconv/                   # 类型转换
│   ├── glog/                    # 日志系统
│   ├── ghttp/                   # HTTP客户端
│   ├── gredis/                  # Redis客户端
│   ├── gvar/                    # 通用变量
│   ├── gtime/                   # 时间工具
│   ├── gstr/                    # 字符串工具
│   ├── gjson/                   # JSON处理
│   ├── gfile/                   # 文件操作
│   ├── gcfg/                    # 配置管理
│   ├── tools/                   # 工具集合
│   ├── gf/                      # 框架封装
│   └── router/                  # 路由系统
├── resource/                    # 资源文件
│   └── config.yaml              # 配置文件
├── scripts/                     # 脚本文件
│   └── start.sh                 # 启动脚本
└── go.mod                       # Go模块定义
```

### 2.2 依赖注入简化设计

```go
// internal/app/context.go
package app

import (
    "gofly_admin_v3/internal/auth"
    "gofly_admin_v3/internal/user"
    "gofly_admin_v3/internal/admin"
    "gofly_admin_v3/internal/batchgo"
    "gofly_admin_v3/internal/siterankgo"
    "gofly_admin_v3/internal/adscentergo"
    "gofly_admin_v3/internal/token"
    "gofly_admin_v3/internal/subscription"
    "gofly_admin_v3/internal/store"
)

// Context 应用上下文
type Context struct {
    Config *Config
    
    // 基础设施
    DB    *store.DB
    Redis *store.Redis
    
    // 核心服务
    AuthService      *auth.Service
    UserService      *user.Service
    AdminService     *admin.Service
    TokenService     *token.Service
    SubService      *subscription.Service
    
    // 业务模块
    BatchGoService     *batchgo.Service
    SiteRankGoService  *siterankgo.Service
    AdsCenterGoService *adscentergo.Service
}

// NewContext 创建应用上下文
func NewContext(cfg *Config) (*Context, error) {
    // 初始化数据库
    db, err := store.NewDB(cfg.Database)
    if err != nil {
        return nil, err
    }
    
    // 初始化 Redis
    redis, err := store.NewRedis(cfg.Redis)
    if err != nil {
        return nil, err
    }
    
    // 创建服务实例
    ctx := &Context{
        Config: cfg,
        DB:     db,
        Redis:  redis,
        
        AuthService:  auth.NewService(cfg.JWT),
        UserService:  user.NewService(db),
        AdminService: admin.NewService(db),
        TokenService: token.NewService(db, redis),
        SubService:  subscription.NewService(db),
        
        BatchGoService:     batchgo.NewService(db, redis),
        SiteRankGoService:  siterankgo.NewService(db, redis),
        AdsCenterGoService: adscentergo.NewService(db, redis),
    }
    
    return ctx, nil
}
```