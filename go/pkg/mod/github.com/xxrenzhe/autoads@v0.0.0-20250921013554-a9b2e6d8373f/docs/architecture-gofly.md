# AutoAds GoFly 架构设计文档

## 1. 总体架构设计

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端层 (Next.js)                        │
├─────────────────────────────────────────────────────────────┤
│  用户界面 (Web)  │  管理后台 (GoFly Admin) │  API 客户端       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Go 内置 HTTP 层                          │
├─────────────────────────────────────────────────────────────┤
│  路由处理  │  中间件  │  SSL/TLS  │  限流控制               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    GoFly 应用层 (Go)                        │
├─────────────────────────────────────────────────────────────┤
│  BatchGo  │ SiteRankGo │ AdsCenterGo │ Token  │ User        │
│  模块     │ 模块       │ 模块        │ 系统   │ 系统        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      数据层                                 │
├─────────────────────────────────────────────────────────────┤
│   MySQL      │      Redis      │   MinIO      │  Kafka    │
│   (主数据库)     │    (缓存)       │  (文件存储)   │ (消息队列) │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术架构选型

#### 1.2.1 后端技术栈
- **框架**: GoFly Admin V3 (Go 1.21+)
- **ORM**: GORM + GoFly gform
- **缓存**: Redis (多级缓存)
- **消息队列**: Kafka (异步任务)
- **文件存储**: MinIO (对象存储)

#### 1.2.2 API 设计
- **HTTP Server**: Go 内置 net/http
- **RESTful API**: 标准 REST 接口
- **中间件**: 路由、认证、限流、CORS
- **WebSocket**: 实时通信（可选）

## 2. 轻量级网关设计

### 2.1 为什么不用 Nginx？

**Nginx 的问题**：
- 额外的进程和内存开销
- 配置复杂，需要维护两套配置
- 增加了网络延迟（额外一跳）
- 部署和运维复杂度增加

**Go 内置 HTTP Server 的优势**：
- 零开销，直接在应用内处理
- 高性能，单机轻松处理 10万+ QPS
- 更好的错误处理和监控
- 部署简单，单个二进制文件

### 2.2 Go 内置功能实现

```go
// main.go - 轻量级网关实现
package main

import (
    "context"
    "crypto/tls"
    "net/http"
    "time"
    
    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
)

func main() {
    // 创建路由器
    r := chi.NewRouter()
    
    // 中间件
    r.Use(middleware.RequestID)
    r.Use(middleware.RealIP)
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.Timeout(60 * time.Second))
    
    // 限流中间件
    r.Use(rateLimiter(1000)) // 每秒1000请求
    
    // CORS
    r.Use(cors.Handler(cors.Options{
        AllowedOrigins:   []string{"https://autoads.dev", "http://localhost:3000"},
        AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
        ExposedHeaders:   []string{"Link"},
        AllowCredentials: true,
        MaxAge:           300,
    }))
    
    // API 路由
    r.Route("/api/v1", func(r chi.Router) {
        // 公开路由
        r.Group(func(r chi.Router) {
            r.Post("/auth/login", authHandler)
            r.Post("/auth/register", registerHandler)
        })
        
        // 需要认证的路由
        r.Group(func(r chi.Router) {
            r.Use(authMiddleware)
            
            // 用户相关
            r.Route("/user", func(r chi.Router) {
                r.Get("/profile", getUserProfile)
                r.Put("/profile", updateUserProfile)
            })
            
            // BatchGo
            r.Route("/batchgo", func(r chi.Router) {
                r.Get("/tasks", listTasks)
                r.Post("/tasks", createTask)
            })
        })
    })
    
    // 静态文件
    fileServer(r, "/web", http.Dir("./web"))
    
    // 配置服务器
    server := &http.Server{
        Addr:         ":8080",
        Handler:      r,
        ReadTimeout:  5 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout:  120 * time.Second,
    }
    
    // 如果需要 HTTPS
    if *useHTTPS {
        server.TLSConfig = &tls.Config{
            MinVersion: tls.VersionTLS12,
            CurvePreferences: []tls.CurveID{
                tls.CurveP521,
                tls.CurveP384,
                tls.CurveP256,
            },
        }
        
        // 使用 Let's Encrypt 自动证书
        m := autocert.Manager{
            Prompt:     autocert.AcceptTOS,
            HostPolicy: autocert.HostWhitelist("autoads.dev", "www.autoads.dev"),
            Cache:      autocert.DirCache("certs"),
        }
        
        server.TLSConfig.GetCertificate = m.GetCertificate
        
        log.Println("Starting HTTPS server on :443")
        server.ListenAndServeTLS("", "")
    } else {
        log.Println("Starting HTTP server on :8080")
        server.ListenAndServe()
    }
}

// 简单的限流器
func rateLimiter(rps int) func(next http.Handler) http.Handler {
    limiter := rate.NewLimiter(rate.Limit(rps), rps*2)
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if !limiter.Allow() {
                http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

### 2.3 性能对比

| 特性 | Nginx + Go | Go 内置 |
|------|------------|---------|
| QPS | ~50,000 | ~100,000 |
| 延迟 | ~2ms | ~0.5ms |
| 内存 | ~50MB | ~30MB |
| 部署复杂度 | 高 | 低 |
| 配置复杂度 | 高 | 低 |

### 2.4 什么时候需要 Nginx？

只有在以下情况才考虑使用 Nginx：
- 需要多个后端服务负载均衡
- 静态文件服务需求极大
- 需要复杂的缓存策略
- 已有的 Nginx 基础设施

## 3. Go风格模块化架构

### 3.1 设计原则

#### 3.1.1 Go 哲学
- **简洁优于复杂**：用最简单的方式解决问题
- **组合优于继承**：通过组合实现功能复用
- **显式优于隐式**：代码行为应该清晰可见
- **并发是基本特性**：充分利用 goroutine 和 channel

#### 3.1.2 模块化设计原则
- **高内聚**：相关功能聚集在一起
- **松耦合**：模块间通过简单接口通信
- **边界清晰**：每个模块职责单一
- **依赖简单**：避免复杂的依赖图

### 3.2 基于包的模块化

```
gofly_admin_v3/
├── cmd/                        # 应用入口
│   └── server/
│       └── main.go            # 主程序入口
├── internal/                   # 内部应用代码（不对外暴露）
│   ├── app/                   # 应用核心
│   │   ├── app.go            # 应用启动和配置
│   │   └── middleware.go      # 公共中间件
│   ├── auth/                  # 认证模块
│   │   ├── auth.go           # JWT 认证逻辑
│   │   └── middleware.go     # 认证中间件
│   ├── user/                  # 用户模块
│   │   ├── service.go        # 用户服务
│   │   ├── handler.go        # HTTP 处理器
│   │   └── model.go          # 用户模型
│   ├── batchgo/              # BatchGo 模块
│   │   ├── service.go        # 批量任务服务
│   │   ├── handler.go        # HTTP 处理器
│   │   ├── model.go          # 任务模型
│   │   └── worker.go         # 任务执行器
│   ├── siterankgo/           # SiteRankGo 模块
│   │   ├── service.go        # 网站排名服务
│   │   ├── handler.go        # HTTP 处理器
│   │   └── client.go         # API 客户端
│   ├── adscentergo/          # AdsCenterGo 模块
│   │   ├── service.go        # 广告中心服务
│   │   ├── handler.go        # HTTP 处理器
│   │   └── automation.go      # 浏览器自动化
│   ├── token/                 # Token 模块
│   │   ├── service.go        # Token 服务
│   │   ├── handler.go        # HTTP 处理器
│   │   └── model.go          # Token 模型
│   ├── store/                 # 数据存储
│   │   ├── db.go             # 数据库连接
│   │   ├── redis.go          # Redis 客户端
│   │   └── migrate.go        # 数据迁移
│   └── pkg/                   # 内部共享包
│       ├── httputil/         # HTTP 工具
│       ├── errors/           # 错误处理
│       └── validator/        # 数据验证
├── web/                        # 静态资源
│   ├── static/                # 静态文件
│   └── templates/             # 模板文件
├── config/                     # 配置文件（可以提交到版本控制）
│   └── config.example.yaml    # 配置示例
├── deployments/                # 部署相关
│   ├── docker/
│   │   └── Dockerfile
│   └── k8s/
│       └── deployment.yaml
├── go.mod                      # Go 模块定义
├── go.sum                      # 依赖校验和
├── Makefile                    # 构建脚本
└── README.md                   # 项目说明
```

### 3.3 模块间通信设计

#### 3.3.1 通过包导入通信
```go
// internal/user/handler.go
package user

import (
    "gofly_admin_v3/internal/auth"
    "gofly_admin_v3/internal/token"
    "gofly_admin_v3/internal/store"
)

type Handler struct {
    userService  *Service
    tokenService *token.Service
    authService  *auth.Service
}

func NewHandler(db *store.DB, redis *store.Redis) *Handler {
    return &Handler{
        userService:  NewService(db),
        tokenService: token.NewService(db, redis),
        authService:  auth.NewService(),
    }
}
```

#### 3.3.2 通过接口定义契约
```go
// internal/token/service.go
package token

// Service 定义 Token 服务接口
type Service interface {
    GetBalance(userID string) (int64, error)
    Consume(userID string, amount int64, reason string) error
    Refund(userID string, amount int64, reason string) error
}

// service 实现
type service struct {
    db    *store.DB
    redis *store.Redis
}

func NewService(db *store.DB, redis *store.Redis) Service {
    return &service{db: db, redis: redis}
}
```

### 3.4 错误处理策略

#### 3.4.1 错误包装
```go
// internal/pkg/errors/errors.go
package errors

import (
    "errors"
    "fmt"
)

// 包装错误信息
func Wrap(err error, message string) error {
    return fmt.Errorf("%s: %w", message, err)
}

// 业务错误
type BizError struct {
    Code    string
    Message string
    Err     error
}

func (e *BizError) Error() string {
    if e.Err != nil {
        return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Err)
    }
    return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *BizError) Unwrap() error {
    return e.Err
}

// 常用错误定义
var (
    ErrUserNotFound = &BizError{Code: "USER_NOT_FOUND", Message: "用户不存在"}
    ErrTokenInsufficient = &BizError{Code: "TOKEN_INSUFFICIENT", Message: "Token 余额不足"}
)
```

### 3.5 配置管理

#### 3.5.1 结构化配置
```go
// internal/app/config.go
package app

import (
    "os"
    "strconv"
)

type Config struct {
    Server   ServerConfig   `yaml:"server"`
    Database DatabaseConfig `yaml:"database"`
    Redis    RedisConfig    `yaml:"redis"`
    Features FeatureFlags   `yaml:"features"`
}

type ServerConfig struct {
    Host         string `yaml:"host" env:"SERVER_HOST"`
    Port         int    `yaml:"port" env:"SERVER_PORT"`
    ReadTimeout  int    `yaml:"read_timeout" env:"READ_TIMEOUT"`
    WriteTimeout int    `yaml:"write_timeout" env:"WRITE_TIMEOUT"`
}

type FeatureFlags struct {
    BatchGo     bool `yaml:"batchgo" env:"ENABLE_BATCHGO"`
    SiteRankGo  bool `yaml:"siterankgo" env:"ENABLE_SITERANKGO"`
    AdsCenterGo bool `yaml:"adscentergo" env:"ENABLE_ADSCENTERGO"`
}

// LoadConfig 加载配置
func LoadConfig() *Config {
    cfg := &Config{
        Server: ServerConfig{
            Host: getEnv("SERVER_HOST", "0.0.0.0"),
            Port: getEnvInt("SERVER_PORT", 8080),
        },
        Features: FeatureFlags{
            BatchGo:     getEnvBool("ENABLE_BATCHGO", true),
            SiteRankGo:  getEnvBool("ENABLE_SITERANKGO", true),
            AdsCenterGo: getEnvBool("ENABLE_ADSCENTERGO", false),
        },
    }
    
    // 如果有配置文件，从文件加载
    if configPath := os.Getenv("CONFIG_PATH"); configPath != "" {
        loadFromFile(cfg, configPath)
    }
    
    return cfg
}
```

### 3.6 依赖注入简化版

#### 3.6.1 应用上下文
```go
// internal/app/context.go
package app

import (
    "gofly_admin_v3/internal/auth"
    "gofly_admin_v3/internal/batchgo"
    "gofly_admin_v3/internal/siterankgo"
    "gofly_admin_v3/internal/adscentergo"
    "gofly_admin_v3/internal/token"
    "gofly_admin_v3/internal/user"
    "gofly_admin_v3/internal/store"
)

// Context 应用上下文，包含所有依赖
type Context struct {
    Config *Config
    
    // 基础设施
    DB    *store.DB
    Redis *store.Redis
    
    // 服务
    AuthService      *auth.Service
    UserService      *user.Service
    TokenService     *token.Service
    BatchGoService   *batchgo.Service
    SiteRankGoService *siterankgo.Service
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
    
    // 创建所有服务
    ctx := &Context{
        Config: cfg,
        DB:     db,
        Redis:  redis,
        
        AuthService:      auth.NewService(),
        UserService:      user.NewService(db),
        TokenService:     token.NewService(db, redis),
    }
    
    // 根据功能开关创建服务
    if cfg.Features.BatchGo {
        ctx.BatchGoService = batchgo.NewService(db)
    }
    
    if cfg.Features.SiteRankGo {
        ctx.SiteRankGoService = siterankgo.NewService(db, redis)
    }
    
    if cfg.Features.AdsCenterGo {
        ctx.AdsCenterGoService = adscentergo.NewService(db)
    }
    
    return ctx, nil
}
```

### 3.7 路由组织

#### 3.7.1 模块化路由
```go
// internal/app/routes.go
package app

import (
    "gofly_admin_v3/internal/auth"
    "gofly_admin_v3/internal/user"
    "gofly_admin_v3/internal/token"
    "gofly_admin_v3/internal/batchgo"
    "gofly_admin_v3/internal/siterankgo"
    "gofly_admin_v3/internal/adscentergo"
)

// SetupRoutes 设置路由
func (ctx *Context) SetupRoutes() http.Handler {
    r := chi.NewRouter()
    
    // 公共中间件
    r.Use(middleware.RequestID)
    r.Use(middleware.RealIP)
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.Timeout(60 * time.Second))
    
    // API 路由
    r.Route("/api/v1", func(r chi.Router) {
        // 认证路由
        auth.SetupRoutes(r, ctx.AuthService)
        
        // 需要认证的路由组
        r.Group(func(r chi.Router) {
            r.Use(ctx.AuthService.Authenticate)
            
            // 用户模块
            user.SetupRoutes(r, ctx.UserService)
            
            // Token 模块
            token.SetupRoutes(r, ctx.TokenService)
            
            // BatchGo 模块（如果启用）
            if ctx.Config.Features.BatchGo {
                batchgo.SetupRoutes(r, ctx.BatchGoService)
            }
            
            // SiteRankGo 模块（如果启用）
            if ctx.Config.Features.SiteRankGo {
                siterankgo.SetupRoutes(r, ctx.SiteRankGoService)
            }
            
            // AdsCenterGo 模块（如果启用）
            if ctx.Config.Features.AdsCenterGo {
                adscentergo.SetupRoutes(r, ctx.AdsCenterGoService)
            }
        })
    })
    
    return r
}
```

## 4. 数据库设计

```
gofly_admin_v3/
├── app/
│   ├── autoads/                 # AutoAds 业务模块
│   │   ├── batchgo/             # BatchGo 模块
│   │   │   ├── controller/     # 控制器层
│   │   │   ├── service/        # 服务层
│   │   │   ├── model/          # 数据模型
│   │   │   ├── repository/     # 数据访问层
│   │   │   └── middleware/     # 中间件
│   │   ├── siterankgo/          # SiteRankGo 模块
│   │   │   ├── controller/
│   │   │   ├── service/
│   │   │   ├── model/
│   │   │   ├── repository/
│   │   │   └── middleware/
│   │   ├── adscentergo/         # AdsCenterGo 模块
│   │   │   ├── controller/
│   │   │   ├── service/
│   │   │   ├── model/
│   │   │   ├── repository/
│   │   │   └── middleware/
│   │   ├── token/               # Token 系统
│   │   ├── user/                # 用户系统
│   │   ├── subscription/        # 订阅系统
│   │   └── payment/             # 支付系统
│   ├── admin/                   # GoFly Admin 后台
│   ├── common/                  # 公共模块
│   │   ├── middleware/         # 中间件
│   │   ├── utils/              # 工具类
│   │   ├── constants/          # 常量
│   │   └── errors/             # 错误处理
│   └── infrastructure/          # 基础设施
│       ├── cache/              # 缓存
│       ├── queue/              # 消息队列
│       ├── storage/            # 文件存储
├── config/                      # 配置文件
│   ├── app.yaml                # 应用配置
│   ├── database.yaml           # 数据库配置
│   ├── redis.yaml              # Redis 配置
│   └── kafka.yaml              # Kafka 配置
├── docs/                        # 文档
├── scripts/                     # 脚本
├── tests/                       # 测试
├── main.go                      # 入口文件
└── go.mod                       # 依赖管理
```

### 2.2 核心模块设计

#### 2.2.1 BatchGo 模块

**功能架构**:
```
┌─────────────────────────────────────────────────────────────┐
│                     BatchGo 模块                            │
├─────────────────────────────────────────────────────────────┤
│  控制器层  │  服务层  │  引擎层  │  执行器  │               │
└─────────────────────────────────────────────────────────────┘
```

**关键技术点**:
- 并发控制：使用 Go 的 goroutine 和 channel
- 资源池化：浏览器实例池、代理池
- 任务调度：优先级队列 + 时间轮
- 断点续传：任务状态持久化

#### 2.2.2 SiteRankGo 模块

**功能架构**:
```
┌─────────────────────────────────────────────────────────────┐
│                   SiteRankGo 模块                          │
├─────────────────────────────────────────────────────────────┤
│  API 集成  │  缓存层  │  队列层  │  处理器  │  存储层        │
└─────────────────────────────────────────────────────────────┘
```

**关键技术点**:
- API 限流：令牌桶算法
- 缓存策略：Redis + 本地缓存
- 批处理：流式处理 + 批量提交
- 数据聚合：预计算 + 实时计算

#### 2.2.3 AdsCenterGo 模块

**功能架构**:
```
┌─────────────────────────────────────────────────────────────┐
│                  AdsCenterGo 模块                          │
├─────────────────────────────────────────────────────────────┤
│  OAuth    │  API 调用  │  浏览器自动化  │  任务管理  │          │
└─────────────────────────────────────────────────────────────┘
```

**关键技术点**:
- OAuth 2.0：完整授权流程
- 浏览器自动化：Puppeteer Go 版本
- 任务追踪：分布式追踪
- 错误恢复：自动重试 + 降级

## 3. 数据库设计

### 3.1 数据迁移策略

#### 3.1.1 表结构映射

| Next.js (Prisma) | GoFly (GORM) | 说明 |
|-----------------|--------------|------|
| users | users | 用户表 |
| accounts | accounts | 第三方账户 |
| subscriptions | subscriptions | 订阅表 |
| token_transactions | token_transactions | 令牌交易 |
| user_activities | user_activities | 用户活动 |
| autoclick_tasks | batchgo_tasks | 批量任务 |
| check_ins | check_ins | 签到记录 |
| invitations | invitations | 邀请记录 |

#### 3.1.2 迁移步骤

1. **保留现有数据库**：不进行数据迁移
2. **创建新数据库**：用于 GoFly 应用
3. **数据同步**：通过 API 同步必要数据
4. **双写过渡**：同时写入两个数据库

### 3.2 数据库优化

#### 3.2.1 索引优化

```sql
-- 用户表索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- 任务表索引
CREATE INDEX idx_batchgo_tasks_user_id ON batchgo_tasks(user_id);
CREATE INDEX idx_batchgo_tasks_status ON batchgo_tasks(status);
CREATE INDEX idx_batchgo_tasks_created_at ON batchgo_tasks(created_at);
CREATE INDEX idx_batchgo_tasks_mode ON batchgo_tasks(mode);

-- 复合索引
CREATE INDEX idx_batchgo_tasks_user_status ON batchgo_tasks(user_id, status);
CREATE INDEX idx_token_transactions_user_created ON token_transactions(user_id, created_at);
```

#### 3.2.2 分区策略

```sql
-- 按时间分区的表
CREATE TABLE token_transactions (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    -- 其他字段...
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PARTITION BY RANGE (TO_DAYS(created_at)) (
        PARTITION p202501 VALUES LESS THAN (TO_DAYS('2025-02-01')),
        PARTITION p202502 VALUES LESS THAN (TO_DAYS('2025-03-01')),
        PARTITION p202503 VALUES LESS THAN (TO_DAYS('2025-04-01')),
        PARTITION pmax VALUES LESS THAN MAXVALUE
    )
);
```

## 4. API 设计

### 4.1 API 路由设计

#### 4.1.1 用户 API

```go
// 路由组
api := router.Group("/api/v1")
{
    // 认证相关
    auth := api.Group("/auth")
    {
        auth.POST("/register", authController.Register)
        auth.POST("/login", authController.Login)
        auth.POST("/logout", authController.Logout)
        auth.POST("/refresh", authController.RefreshToken)
        auth.GET("/me", middleware.Auth(), authController.GetProfile)
    }
    
    // 用户相关
    user := api.Group("/user").Use(middleware.Auth())
    {
        user.GET("/profile", userController.GetProfile)
        user.PUT("/profile", userController.UpdateProfile)
        user.GET("/tokens", userController.GetTokenBalance)
        user.GET("/transactions", userController.GetTokenTransactions)
    }
    
    // BatchGo 相关
    batchgo := api.Group("/batchgo").Use(middleware.Auth())
    {
        batchgo.GET("/tasks", batchgoController.ListTasks)
        batchgo.POST("/tasks", batchgoController.CreateTask)
        batchgo.GET("/tasks/:id", batchgoController.GetTask)
        batchgo.PUT("/tasks/:id", batchgoController.UpdateTask)
        batchgo.DELETE("/tasks/:id", batchgoController.DeleteTask)
        batchgo.POST("/tasks/:id/start", batchgoController.StartTask)
        batchgo.POST("/tasks/:id/stop", batchgoController.StopTask)
        batchgo.GET("/tasks/:id/results", batchgoController.GetTaskResults)
    }
    
    // SiteRankGo 相关
    siterankgo := api.Group("/siterankgo").Use(middleware.Auth())
    {
        siterankgo.POST("/queries", siterankgoController.CreateQuery)
        siterankgo.GET("/queries/:id", siterankgoController.GetQuery)
        siterankgo.GET("/domains/:domain/history", siterankgoController.GetDomainHistory)
    }
    
    // AdsCenterGo 相关
    adscentergo := api.Group("/adscentergo").Use(middleware.Auth())
    {
        adscentergo.GET("/accounts", adscentergoController.ListAccounts)
        adscentergo.POST("/accounts", adscentergoController.CreateAccount)
        adscentergo.POST("/tasks", adscentergoController.CreateTask)
        adscentergo.GET("/tasks/:id", adscentergoController.GetTask)
    }
}
```

#### 4.1.2 管理员 API

```go
// 管理员路由组
admin := router.Group("/admin/api").Use(middleware.AdminAuth())
{
    // 用户管理
    adminUsers := admin.Group("/users")
    {
        adminUsers.GET("", adminController.ListUsers)
        adminUsers.GET("/:id", adminController.GetUser)
        adminUsers.PUT("/:id", adminController.UpdateUser)
        adminUsers.DELETE("/:id", adminController.DeleteUser)
        adminUsers.POST("/:id/ban", adminController.BanUser)
        adminUsers.POST("/:id/unban", adminController.UnbanUser)
    }
    
}
```

### 4.2 统一响应格式

```go
// 响应结构
type Response struct {
    Code    int         `json:"code"`     // 0 表示成功
    Message string      `json:"message"`  // 响应消息
    Data    interface{} `json:"data"`     // 响应数据
    Meta    interface{} `json:"meta"`     // 元数据
}

// 分页响应
type PaginatedResponse struct {
    Code       int         `json:"code"`
    Message    string      `json:"message"`
    Data       interface{} `json:"data"`
    Pagination Pagination  `json:"pagination"`
}

type Pagination struct {
    Page       int `json:"page"`
    PageSize   int `json:"page_size"`
    Total      int `json:"total"`
    TotalPages int `json:"total_pages"`
}
```

## 5. 安全设计

### 5.1 认证授权

#### 5.1.1 JWT 认证

```go
// JWT 中间件
func JWTAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(http.StatusUnauthorized, gin.H{
                "code":    1001,
                "message": "未提供认证令牌",
            })
            c.Abort()
            return
        }
        
        // 去掉 Bearer 前缀
        token = strings.TrimPrefix(token, "Bearer ")
        
        // 解析 token
        claims, err := jwt.ParseToken(token)
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{
                "code":    1001,
                "message": "令牌无效或已过期",
            })
            c.Abort()
            return
        }
        
        // 检查用户状态
        user, err := userService.GetUserByID(claims.UserID)
        if err != nil || user.Status != "ACTIVE" {
            c.JSON(http.StatusForbidden, gin.H{
                "code":    1003,
                "message": "用户已被禁用",
            })
            c.Abort()
            return
        }
        
        // 设置用户信息到上下文
        c.Set("user_id", claims.UserID)
        c.Set("user_role", claims.Role)
        c.Next()
    }
}
```

#### 5.1.2 权限控制

```go
// 权限中间件
func RequirePermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString("user_id")
        role := c.GetString("user_role")
        
        // 使用 GoFly RBAC 系统检查权限
        hasPermission := gofly.RBAC.CheckPermission(userID, role, permission)
        if !hasPermission {
            c.JSON(http.StatusForbidden, gin.H{
                "code":    1002,
                "message": "权限不足",
            })
            c.Abort()
            return
        }
        c.Next()
    }
}
```

### 5.2 数据安全

#### 5.2.1 敏感数据加密

```go
// 加密工具
type CryptoService struct {
    key []byte
}

func (cs *CryptoService) Encrypt(plaintext string) (string, error) {
    block, err := aes.NewCipher(cs.key)
    if err != nil {
        return "", err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    
    nonce := make([]byte, gcm.NonceSize())
    if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }
    
    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (cs *CryptoService) Decrypt(ciphertext string) (string, error) {
    data, err := base64.StdEncoding.DecodeString(ciphertext)
    if err != nil {
        return "", err
    }
    
    block, err := aes.NewCipher(cs.key)
    if err != nil {
        return "", err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    
    nonceSize := gcm.NonceSize()
    if len(data) < nonceSize {
        return "", errors.New("ciphertext too short")
    }
    
    nonce, ciphertext := data[:nonceSize], data[nonceSize:]
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", err
    }
    
    return string(plaintext), nil
}
```

#### 5.2.2 输入验证

```go
// 验证中间件
func ValidateRequest(dto interface{}) gin.HandlerFunc {
    return func(c *gin.Context) {
        if err := c.ShouldBindJSON(dto); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{
                "code":    1000,
                "message": "请求参数错误",
                "error":   err.Error(),
            })
            c.Abort()
            return
        }
        c.Set("validated_request", dto)
        c.Next()
    }
}
```

## 6. 简单的服务组织

### 6.1 服务结构

```go
// app/services/services.go
package services

import (
    "database/sql"
    "github.com/go-redis/redis/v8"
)

// 服务集合 - 简单的依赖管理
type Services struct {
    DB     *sql.DB
    Redis  *redis.Client
    
    // 业务服务
    UserService        *UserService
    TokenService       *TokenService
    BatchGoService     *BatchGoService
    SiteRankGoService  *SiteRankGoService
    AdsCenterGoService *AdsCenterGoService
}

// 初始化所有服务
func InitServices(db *sql.DB, rdb *redis.Client) *Services {
    return &Services{
        DB:     db,
        Redis:  rdb,
        
        // 初始化业务服务
        UserService:        NewUserService(db),
        TokenService:       NewTokenService(db, rdb),
        BatchGoService:     NewBatchGoService(db),
        SiteRankGoService:  NewSiteRankGoService(db, rdb),
        AdsCenterGoService: NewAdsCenterGoService(db),
    }
}
```

### 6.2 配置管理

```go
// app/config/config.go
package config

import (
    "os"
    "strconv"
)

// 应用配置 - 简单的结构体
type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    Redis    RedisConfig
    Modules  ModuleConfig
}

type ServerConfig struct {
    Port int
    Host string
}

type DatabaseConfig struct {
    Host     string
    Port     int
    User     string
    Password string
    Database string
}

type RedisConfig struct {
    Host     string
    Port     int
    Password string
    DB       int
}

type ModuleConfig struct {
    BatchGo     BatchGoConfig
    SiteRankGo  SiteRankGoConfig
    AdsCenterGo AdsCenterGoConfig
}

type BatchGoConfig struct {
    MaxConcurrency int
    TaskTimeout    int
}

type SiteRankGoConfig struct {
    APIKey      string
    CacheExpire int
}

type AdsCenterGoConfig struct {
    MaxAccounts int
    Timeout     int
}

// 加载配置 - 从环境变量
func Load() *Config {
    return &Config{
        Server: ServerConfig{
            Port: getEnvInt("SERVER_PORT", 8080),
            Host: getEnv("SERVER_HOST", "0.0.0.0"),
        },
        Database: DatabaseConfig{
            Host:     getEnv("DB_HOST", "localhost"),
            Port:     getEnvInt("DB_PORT", 3306),
            User:     getEnv("DB_USER", "root"),
            Password: getEnv("DB_PASSWORD", ""),
            Database: getEnv("DB_NAME", "autoads"),
        },
        Redis: RedisConfig{
            Host:     getEnv("REDIS_HOST", "localhost"),
            Port:     getEnvInt("REDIS_PORT", 6379),
            Password: getEnv("REDIS_PASSWORD", ""),
            DB:       getEnvInt("REDIS_DB", 0),
        },
        Modules: ModuleConfig{
            BatchGo: BatchGoConfig{
                MaxConcurrency: getEnvInt("BATCHGO_MAX_CONCURRENCY", 10),
                TaskTimeout:    getEnvInt("BATCHGO_TIMEOUT", 300),
            },
            SiteRankGo: SiteRankGoConfig{
                APIKey:      getEnv("SITERANKGO_API_KEY", ""),
                CacheExpire: getEnvInt("SITERANKGO_CACHE_EXPIRE", 3600),
            },
            AdsCenterGo: AdsCenterGoConfig{
                MaxAccounts: getEnvInt("ADSCENTERGO_MAX_ACCOUNTS", 5),
                Timeout:     getEnvInt("ADSCENTERGO_TIMEOUT", 600),
            },
        },
    }
}

// 辅助函数
func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
    if value := os.Getenv(key); value != "" {
        if intVal, err := strconv.Atoi(value); err == nil {
            return intVal
        }
    }
    return defaultValue
}
```

## 7. 性能优化

### 7.1 缓存策略

#### 7.1.1 多级缓存实现

```go
// 缓存服务
type CacheService struct {
    l1Cache *lru.Cache      // 内存缓存
    l2Cache *redis.Client   // Redis 缓存
    stats   *CacheStats
}

type CacheStats struct {
    Hits   int64
    Misses int64
}

func (cs *CacheService) Get(key string) (interface{}, bool) {
    // L1 缓存
    if val, ok := cs.l1Cache.Get(key); ok {
        atomic.AddInt64(&cs.stats.Hits, 1)
        return val, true
    }
    
    // L2 缓存
    val, err := cs.l2Cache.Get(context.Background(), key).Result()
    if err == nil {
        // 回填 L1 缓存
        cs.l1Cache.Add(key, val)
        atomic.AddInt64(&cs.stats.Hits, 1)
        return val, true
    }
    
    atomic.AddInt64(&cs.stats.Misses, 1)
    return nil, false
}

func (cs *CacheService) Set(key string, value interface{}, ttl time.Duration) {
    // 设置 L1 缓存
    cs.l1Cache.Add(key, value)
    
    // 设置 L2 缓存
    cs.l2Cache.Set(context.Background(), key, value, ttl)
}
```

#### 7.1.2 缓存策略配置

```yaml
# config/cache.yaml
cache:
  l1:
    type: "lru"
    size: 1000
    ttl: 300s
  l2:
    type: "redis"
    ttl: 3600s
    nodes:
      - host: "localhost"
        port: 6379
        db: 0
  policies:
    user_session: 
      ttl: 7200s
      level: "l1,l2"
    api_response:
      ttl: 600s
      level: "l2"
    user_permissions:
      ttl: 300s
      level: "l1,l2"
```

### 7.2 并发优化

#### 7.2.1 任务池管理

```go
// 任务池
type TaskPool struct {
    workers    int
    taskQueue  chan *Task
    workerPool chan chan *Task
    quit       chan bool
}

func NewTaskPool(workers int) *TaskPool {
    return &TaskPool{
        workers:    workers,
        taskQueue:  make(chan *Task, 1000),
        workerPool: make(chan chan *Task, workers),
        quit:       make(chan bool),
    }
}

func (tp *TaskPool) Start() {
    // 启动 worker
    for i := 0; i < tp.workers; i++ {
        worker := NewWorker(i+1, tp.workerPool)
        worker.Start()
    }
    
    // 调度器
    go tp.dispatch()
}

func (tp *TaskPool) dispatch() {
    for {
        select {
        case task := <-tp.taskQueue:
            // 获取可用的 worker
            workerChannel := <-tp.workerPool
            workerChannel <- task
        case <-tp.quit:
            // 停止所有 worker
            for i := 0; i < tp.workers; i++ {
                workerChannel := <-tp.workerPool
                close(workerChannel)
            }
            return
        }
    }
}
```

#### 7.2.2 连接池优化

```go
// 数据库连接池
func InitDB(config *DatabaseConfig) (*gorm.DB, error) {
    dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
        config.Username,
        config.Password,
        config.Host,
        config.Port,
        config.Database,
    )
    
    db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
        Logger: logger.Default.LogMode(logger.Info),
    })
    
    if err != nil {
        return nil, err
    }
    
    sqlDB, err := db.DB()
    if err != nil {
        return nil, err
    }
    
    // 设置连接池参数
    sqlDB.SetMaxIdleConns(config.MaxIdleConns)
    sqlDB.SetMaxOpenConns(config.MaxOpenConns)
    sqlDB.SetConnMaxLifetime(time.Hour)
    sqlDB.SetConnMaxIdleTime(30 * time.Minute)
    
    return db, nil
}
```

## 8. 部署方案

### 8.1 Docker 容器化

#### 8.1.1 Dockerfile

```dockerfile
# 多阶段构建
FROM golang:1.21-alpine AS builder

WORKDIR /app

# 安装依赖
RUN apk add --no-cache git

# 复制 go mod 文件
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# 最终镜像
FROM alpine:latest

# 安装必要的包
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# 从构建阶段复制二进制文件
COPY --from=builder /app/main .
COPY --from=builder /app/config ./config

# 创建非 root 用户
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -s /bin/sh -D appuser
RUN chown -R appuser:appgroup /root
USER appuser

# 暴露端口
EXPOSE 8080

# 启动应用
CMD ["./main"]
```

#### 8.1.2 Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:8080"
      - "443:8443"
    environment:
      - APP_ENV=production
      - DATABASE_URL=mysql://user:pass@db:3306/autoads
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    networks:
      - autoads-net
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: autoads
      MYSQL_USER: user
      MYSQL_PASSWORD: pass
      MYSQL_ROOT_PASSWORD: rootpass
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - autoads-net
    restart: unless-stopped
    command: --default-authentication-plugin=mysql_native_password

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - autoads-net
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:

networks:
  autoads-net:
    driver: bridge
```

### 8.2 Kubernetes 部署

#### 8.2.1 部署文件

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: autoads-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: autoads-api
  template:
    metadata:
      labels:
        app: autoads-api
    spec:
      containers:
      - name: autoads-api
        image: autoads/api:latest
        ports:
        - containerPort: 8080
        env:
        - name: APP_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: autoads-secret
              key: database-url
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 9. 迁移计划

### 9.1 迁移阶段

#### 阶段一：基础架构（2 周）
- [ ] 搭建 GoFly 开发环境
- [ ] 设计数据库模型
- [ ] 实现基础中间件
- [ ] 配置 CI/CD 流程

#### 阶段二：核心服务（4 周）
- [ ] 用户认证系统
- [ ] Token 经济系统
- [ ] 订阅管理系统
- [ ] 基础 API 框架

#### 阶段三：功能迁移（6 周）
- [ ] BatchGo 模块
- [ ] SiteRankGo 模块
- [ ] AdsCenterGo 模块
- [ ] 性能优化

#### 阶段四：测试优化（2 周）
- [ ] 功能测试
- [ ] 性能测试
- [ ] 安全测试
- [ ] 上线准备

### 9.2 风险控制

#### 9.2.1 回滚方案
- 保留原有 Next.js 服务
- 使用流量开关控制
- 数据同步机制
- 快速回滚脚本


## 10. 总结

本架构设计文档详细描述了 AutoAds 从 Next.js 迁移到 GoFly 的完整方案。通过合理的模块划分、优化的数据库设计、完善的安全措施和性能优化，系统将获得：

1. **性能提升**：Go 的并发特性带来 4900% 的性能提升
2. **可扩展性**：微服务架构支持水平扩展
3. **可维护性**：清晰的代码结构和完善的文档
4. **可靠性**：完善的错误处理机制

下一步将开始搭建 GoFly 开发环境，逐步实现架构设计中的各个模块。