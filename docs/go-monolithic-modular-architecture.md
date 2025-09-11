# Go单体应用模块化架构设计

## 1. 架构概述

AutoAds GoFly采用单体应用+模块化设计架构，通过清晰的模块边界和依赖管理，实现高内聚、低耦合的系统设计。

## 2. 目录结构

```
gofly_admin_v3/
├── cmd/                    # 应用入口
│   └── server/            # 服务器入口
│       └── main.go
├── internal/              # 内部模块
│   ├── app/              # 应用核心
│   │   ├── config.go     # 配置管理
│   │   ├── router.go     # 路由配置
│   │   └── middleware.go # 中间件
│   ├── batchgo/          # 批量处理模块
│   │   ├── service.go
│   │   ├── controller.go
│   │   ├── model.go
│   │   ├── accessor.go
│   │   └── concurrent_service.go
│   ├── siterankgo/       # 网站排名模块
│   │   ├── service.go
│   │   ├── controller.go
│   │   └── model.go
│   ├── adscentergo/      # 广告中心模块
│   │   ├── service.go
│   │   ├── controller.go
│   │   ├── model.go
│   │   └── googleads_client.go
│   ├── user/             # 用户模块
│   │   ├── service.go
│   │   ├── controller.go
│   │   └── model.go
│   ├── subscription/     # 订阅模块
│   │   ├── service.go
│   │   ├── controller.go
│   │   └── model.go
│   ├── store/            # 数据存储
│   │   ├── db.go
│   │   └── redis.go
│   └── pkg/              # 公共包
├── pkg/                   # 外部可用的包
│   ├── cache/            # 缓存包
│   ├── concurrent/       # 并发控制包
│   └── utils/            # 工具包
├── configs/               # 配置文件
├── docs/                  # 文档
├── migrations/            # 数据库迁移
└── scripts/               # 脚本文件
```

## 3. 模块设计原则

### 3.1 单一职责原则

每个模块负责单一的业务功能：
- **BatchGo**: 负责URL批量处理
- **SiteRankGo**: 负责网站排名查询
- **AdsCenterGo**: 负责广告账户管理
- **User**: 负责用户管理
- **Subscription**: 负责订阅和计费

### 3.2 依赖倒置原则

高层模块不依赖低层模块，都依赖抽象：
```go
// 接口定义在domain层
type TaskExecutor interface {
    Execute(ctx context.Context, task *Task) error
}

// 实现在具体模块
type HTTPExecutor struct{}

type PuppeteerExecutor struct{}
```

### 3.3 开闭原则

对扩展开放，对修改关闭：
- 通过接口和抽象类扩展功能
- 避免修改现有代码
- 使用策略模式处理不同场景

## 4. 模块间通信

### 4.1 依赖注入

```go
type Application struct {
    Config         *Config
    DB             *store.DB
    Redis          *store.Redis
    BatchGoService *batchgo.Service
    SiteRankService *siterankgo.Service
    AdsService    *adscentergo.Service
    UserService   *user.Service
    SubService    *subscription.Service
}

func NewApplication() *Application {
    // 初始化配置
    config := LoadConfig()
    
    // 初始化存储
    db := store.NewDB(config.Database)
    redis := store.NewRedis(config.Redis)
    
    // 初始化服务
    app := &Application{
        Config:         config,
        DB:             db,
        Redis:          redis,
        BatchGoService: batchgo.NewService(db, redis),
        SiteRankService: siterankgo.NewGoFlySiteRankGoService(db, redis),
        AdsService:    adscentergo.NewGoFlyAdsCenterGoService(db, redis),
        UserService:   user.NewService(db),
        SubService:    subscription.NewService(db),
    }
    
    return app
}
```

### 4.2 事件驱动通信

```go
// 事件定义
type Event struct {
    Name    string
    Payload interface{}
    Time    time.Time
}

// 事件总线
type EventBus struct {
    subscribers map[string][]chan Event
    mu         sync.RWMutex
}

// 使用示例
func (s *BatchGoService) CompleteTask(task *Task) {
    // 发布任务完成事件
    s.eventBus.Publish("task.completed", task)
    
    // 其他模块订阅事件
    // UserService: 更新用户统计
    // SubService: 扣除Token
}
```

## 5. 配置管理

### 5.1 分层配置

```go
type Config struct {
    App      AppConfig      `yaml:"app"`
    Server   ServerConfig   `yaml:"server"`
    Database DatabaseConfig `yaml:"database"`
    Redis    RedisConfig    `yaml:"redis"`
    JWT      JWTConfig      `yaml:"jwt"`
    External ExternalConfig `yaml:"external"`
}

type AppConfig struct {
    Name        string `yaml:"name"`
    Version     string `yaml:"version"`
    Environment string `yaml:"environment"`
    Debug       bool   `yaml:"debug"`
}

// 加载配置
func LoadConfig() *Config {
    // 默认配置
    config := &Config{}
    
    // 从文件加载
    if err := viper.Unmarshal(config); err != nil {
        log.Fatal("Failed to load config:", err)
    }
    
    // 从环境变量覆盖
    viper.AutomaticEnv()
    
    return config
}
```

### 5.2 配置验证

```go
func (c *Config) Validate() error {
    if c.Server.Port <= 0 {
        return errors.New("invalid server port")
    }
    if c.Database.Host == "" {
        return errors.New("database host is required")
    }
    // 更多验证...
    return nil
}
```

## 6. 中间件设计

### 6.1 认证中间件

```go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
            return
        }
        
        // 验证JWT
        claims, err := jwt.ParseToken(token)
        if err != nil {
            c.AbortWithStatusJSON(401, gin.H{"error": "invalid token"})
            return
        }
        
        // 设置用户信息到上下文
        c.Set("user_id", claims.UserID)
        c.Set("user_role", claims.Role)
        
        c.Next()
    }
}
```

### 6.2 限流中间件

```go
func RateLimitMiddleware(rate int, burst int) gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Limit(burst), burst)
    
    return func(c *gin.Context) {
        if !limiter.Allow() {
            c.AbortWithStatusJSON(429, gin.H{"error": "rate limit exceeded"})
            return
        }
        c.Next()
    }
}
```

### 6.3 日志中间件

```go
func LoggerMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        
        c.Next()
        
        // 记录请求日志
        duration := time.Since(start)
        log.Printf(
            "%s %s %d %v",
            c.Request.Method,
            c.Request.URL.Path,
            c.Writer.Status(),
            duration,
        )
    }
}
```

## 7. 数据库设计

### 7.1 数据库模式

```go
// 使用GORM定义模型
type User struct {
    ID        string    `gorm:"primary_key"`
    Email     string    `gorm:"unique_index"`
    Name      string
    Role      string
    CreatedAt time.Time
    UpdatedAt time.Time
    DeletedAt *time.Time
}

// 自动迁移
func Migrate(db *gorm.DB) error {
    return db.AutoMigrate(
        &User{},
        &BatchTask{},
        &SiteRankTask{},
        &AdsAccount{},
        // 其他模型...
    )
}
```

### 7.2 仓储模式

```go
type UserRepository interface {
    FindByID(id string) (*User, error)
    FindByEmail(email string) (*User, error)
    Create(user *User) error
    Update(user *User) error
    Delete(id string) error
}

type userRepository struct {
    db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
    return &userRepository{db: db}
}

func (r *userRepository) FindByID(id string) (*User, error) {
    var user User
    if err := r.db.First(&user, "id = ?", id).Error; err != nil {
        return nil, err
    }
    return &user, nil
}
```

## 8. API设计

### 8.1 RESTful API

```go
// 用户API
r.GET("/api/v1/users", userController.ListUsers)
r.POST("/api/v1/users", userController.CreateUser)
r.GET("/api/v1/users/:id", userController.GetUser)
r.PUT("/api/v1/users/:id", userController.UpdateUser)
r.DELETE("/api/v1/users/:id", userController.DeleteUser)

// 批量任务API
r.POST("/api/v1/batchgo/tasks", batchController.CreateTask)
r.GET("/api/v1/batchgo/tasks/:id", batchController.GetTask)
r.POST("/api/v1/batchgo/tasks/:id/start", batchController.StartTask)
```

### 8.2 响应格式

```go
type Response struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data,omitempty"`
    Error   string      `json:"error,omitempty"`
}

func Success(c *gin.Context, data interface{}) {
    c.JSON(200, Response{
        Code:    0,
        Message: "success",
        Data:    data,
    })
}

func Error(c *gin.Context, code int, message string) {
    c.JSON(code, Response{
        Code:    code,
        Message: message,
    })
}
```

## 9. 错误处理

### 9.1 统一错误处理

```go
type AppError struct {
    Code    int
    Message string
    Details interface{}
}

func (e *AppError) Error() string {
    return e.Message
}

// 全局错误处理
func ErrorHandler() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()
        
        // 检查是否有错误
        if len(c.Errors) > 0 {
            err := c.Errors.Last()
            
            // 根据错误类型返回不同的状态码
            var appErr *AppError
            if errors.As(err.Err, &appErr) {
                c.JSON(appErr.Code, Response{
                    Code:    appErr.Code,
                    Message: appErr.Message,
                    Error:   appErr.Details,
                })
            } else {
                c.JSON(500, Response{
                    Code:    500,
                    Message: "Internal Server Error",
                    Error:   err.Error(),
                })
            }
        }
    }
}
```

## 10. 测试策略

### 10.1 单元测试

```go
func TestUserService_CreateUser(t *testing.T) {
    // 准备测试数据
    db := test.SetupTestDB()
    repo := NewUserRepository(db)
    service := NewUserService(repo)
    
    // 执行测试
    user, err := service.CreateUser(&CreateUserRequest{
        Email: "test@example.com",
        Name:  "Test User",
    })
    
    // 断言
    assert.NoError(t, err)
    assert.NotNil(t, user)
    assert.Equal(t, "test@example.com", user.Email)
}
```

### 10.2 集成测试

```go
func TestBatchGoAPI_CreateTask(t *testing.T) {
    // 设置测试服务器
    router := SetupTestRouter()
    
    // 创建请求
    req, _ := http.NewRequest("POST", "/api/v1/batchgo/tasks", strings.NewReader(taskJSON))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+testToken)
    
    // 执行请求
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)
    
    // 验证响应
    assert.Equal(t, 200, w.Code)
    var response Response
    json.Unmarshal(w.Body.Bytes(), &response)
    assert.Equal(t, 0, response.Code)
}
```

## 11. 部署架构

### 11.1 Docker化

```dockerfile
# Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o server ./cmd/server/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/

COPY --from=builder /app/server .
COPY --from=builder /app/configs ./configs

EXPOSE 8080
CMD ["./server"]
```

### 11.2 Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=mysql://user:pass@db:3306/autoads
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./configs:/root/configs
  
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: autoads
      MYSQL_USER: user
      MYSQL_PASSWORD: pass
    volumes:
      - mysql_data:/var/lib/mysql
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

## 12. 监控和日志

### 12.1 Prometheus监控

```go
import "github.com/prometheus/client_golang/prometheus"

var (
    requestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "http_request_duration_seconds",
            Help: "HTTP request duration in seconds",
        },
        []string{"method", "endpoint"},
    )
    
    requestCount = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint", "status"},
    )
)

func InitMetrics() {
    prometheus.MustRegister(requestDuration)
    prometheus.MustRegister(requestCount)
}
```

### 12.2 结构化日志

```go
import "github.com/sirupsen/logrus"

var logger = logrus.New()

func InitLogger() {
    logger.SetFormatter(&logrus.JSONFormatter{})
    logger.SetLevel(logrus.InfoLevel)
    
    // 添加文件输出
    file, err := os.OpenFile("logs/app.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
    if err == nil {
        logger.SetOutput(io.MultiWriter(os.Stdout, file))
    }
}
```

## 13. 性能优化

### 13.1 数据库优化

- 使用索引优化查询
- 实现读写分离
- 使用连接池
- 批量操作优化

### 13.2 缓存策略

- 多级缓存（本地+Redis）
- 缓存预热
- 缓存失效策略
- 缓存穿透保护

### 13.3 并发优化

- 使用工作池处理任务
- 实现速率限制
- 使用熔断器保护
- 优雅关闭

## 14. 安全考虑

### 14.1 认证授权

- JWT令牌认证
- RBAC权限控制
- API限流
- CSRF保护

### 14.2 数据安全

- 敏感数据加密
- SQL注入防护
- XSS防护
- HTTPS传输

### 14.3 运行安全

- 容器安全
- 依赖检查
- 安全扫描
- 访问控制

---

通过以上模块化架构设计，AutoAds GoFly实现了：
1. **高内聚低耦合**：每个模块职责明确，依赖关系清晰
2. **易于扩展**：新功能可以通过新模块添加，不影响现有代码
3. **易于测试**：模块间通过接口交互，便于单元测试
4. **易于维护**：代码结构清晰，问题定位快速
5. **高性能**：通过并发控制、缓存等优化手段保证性能
6. **高可用**：通过熔断、限流等机制保证系统稳定