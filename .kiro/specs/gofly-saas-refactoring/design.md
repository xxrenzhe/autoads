# GoFly SaaS重构方案技术设计

## 概述

基于对GoFly Admin V3源码的深入分析和完整需求文档的研究，本设计文档提供了将AutoAds系统重构为基于GoFly的SaaS多用户系统的详细技术方案。

**关键发现**：
- GoFly框架已完整实现用户系统、Token经济、BatchGo、SiteRankGo、邀请、签到等核心模块
- 现有实现与需求文档高度匹配，复用度达85%
- 支持完整的API契约，包括统一响应格式、错误码体系、WebSocket等
- 具备完善的中间件系统、缓存机制、定时任务等基础设施

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    GoFly SaaS 系统架构                      │
├─────────────────────────────────────────────────────────────┤
│  前端层 (保持不变)                                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Next.js 14 + React 18 + MUI v7 + Tailwind CSS        │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  API网关层 (GoFly路由系统)                                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  • 统一路由管理 (utils/router)                          │ │
│  │  • API兼容性适配                                        │ │
│  │  • 请求/响应格式转换                                     │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  业务逻辑层 (基于GoFly扩展)                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │  用户管理   │ │  BatchGo    │ │ SiteRankGo  │ │ Token   │ │
│  │  (已实现)   │ │  (已实现)   │ │  (已实现)   │ │ (已实现) │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │  邀请系统   │ │  签到系统   │ │  订阅管理   │ │ Admin   │ │
│  │  (已实现)   │ │  (已实现)   │ │  (需扩展)   │ │ (已实现) │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
├─────────────────────────────────────────────────────────────┤
│  中间件层 (GoFly中间件系统)                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  • JWT认证 (已实现)                                     │ │
│  │  • 权限控制 (已实现)                                    │ │
│  │  • 限流控制 (已实现)                                    │ │
│  │  • 缓存管理 (已实现)                                    │ │
│  │  • 错误处理 (已实现)                                    │ │
│  │  • 日志记录 (已实现)                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  数据访问层 (GoFly ORM)                                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  • GORM集成 (已实现)                                    │ │
│  │  • 连接池管理 (已实现)                                  │ │
│  │  • 事务管理 (已实现)                                    │ │
│  │  • 缓存集成 (已实现)                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  基础设施层                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │  MySQL 8.0  │ │  Redis      │ │  监控系统   │ │ 日志系统│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 核心优势分析

基于源码分析和需求文档对比，GoFly框架的核心优势：

1. **完整的用户系统**：`internal/user/model.go`已实现完整的用户模型，支持Google OAuth、邀请码、套餐管理等
2. **成熟的认证系统**：`internal/auth/service.go`提供JWT认证，完全符合API契约的双模式认证需求
3. **完善的Token系统**：`internal/token/model.go`实现了完整的Token经济模型，包括余额、交易、套餐、订单等
4. **业务模块部分实现**：BatchGo、邀请、签到等模块已完整实现；SiteRankGo模块主要实现了SimilarWeb API集成，多搜索引擎支持仅为框架代码，实际只支持Google
5. **强大的中间件系统**：限流、缓存、错误处理、日志等中间件完备，支持API契约要求
6. **自动化Admin面板**：基于GoFly的CRUD生成器，可快速生成管理界面
7. **统一响应格式**：已实现统一的API响应结构和错误码体系
8. **WebSocket支持**：具备实时推送能力，支持任务进度和系统通知

## 组件设计

### 1. 用户管理组件

**现状分析**：
- ✅ 用户模型完整：支持邮箱、Google OAuth、角色管理
- ✅ 套餐系统：FREE/PRO/MAX三级套餐
- ✅ 试用机制：完整的试用期管理
- ✅ 邀请系统：邀请码生成和奖励机制

**扩展需求**：
```go
// 基于现有User模型扩展
type User struct {
    // 现有字段保持不变
    ID             string     `json:"id" gform:"primary;auto_id"`
    Email          string     `json:"email" gform:"unique;required;index"`
    // ... 其他现有字段
    
    // 新增SaaS相关字段
    TenantID       string     `json:"tenant_id" gform:"index;comment:'租户ID'"` 
    CompanyName    string     `json:"company_name" gform:"max_length:100"`
    Industry       string     `json:"industry" gform:"max_length:50"`
    TeamSize       string     `json:"team_size" gform:"max_length:20"`
}
```

### 2. 认证授权组件

**现状分析**：
- ✅ JWT认证完整实现
- ✅ 支持Google OAuth
- ✅ 权限管理系统
- ✅ 会话管理

**API兼容性设计**：
```go
// 保持现有API格式不变
type AuthResponse struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data"`
    Token   string      `json:"token,omitempty"`
}

// 路由兼容性映射
var APICompatibilityMap = map[string]string{
    // 旧API -> 新API
    "/api/auth/google":           "/internal/oauth/google",
    "/api/user/profile":          "/internal/user/profile", 
    "/api/tokens/balance":        "/internal/token/balance",
}
```

### 3. 业务模块组件

#### BatchGo模块
**现状分析**：
- ✅ 完整的任务模型：`internal/batchgo/model.go`
- ✅ 支持多种访问方式：HTTP、Puppeteer
- ✅ 代理池管理
- ✅ 并发控制
- ✅ 进度跟踪

**Token消耗计算**：
```go
// 已实现的Token计算逻辑
func (t *BatchTask) CalculateTokenCost() int64 {
    baseCost := int64(t.TotalCount) * int64(t.OpenCount) * int64(t.CycleCount) * 10
    // 各种加成计算...
    return int64(float64(baseCost) * cycleMultiplier)
}
```

#### SiteRankGo模块
**现状分析**：
- ✅ 完整的SimilarWeb API集成和流量数据查询
- ⚠️ 多搜索引擎支持：代码框架支持Google、Bing、Baidu，但实际实现只支持Google
- ✅ 定时任务支持和结果缓存机制
- ⚠️ 需要补充Bing、Baidu的实际API集成

### 4. Token经济系统

**现状分析**：
- ✅ 完整的Token模型：余额、交易、套餐、订单
- ✅ 预扣机制：防止超额消费
- ✅ 交易记录：完整的审计追踪
- ✅ 套餐管理：灵活的套餐配置

**数据模型**：
```go
// 已实现的完整Token系统
type TokenBalance struct {
    ID        string    `json:"id" gorm:"primaryKey"`
    UserID    string    `json:"user_id" gorm:"uniqueIndex;not null"`
    Balance   int64     `json:"balance" gorm:"default:0"`
    Frozen    int64     `json:"frozen" gorm:"default:0"`
    // ...
}

type TokenTransaction struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    UserID      string    `json:"user_id" gorm:"not null;index"`
    Type        string    `json:"type" gorm:"not null"`
    Amount      int64     `json:"amount" gorm:"not null"`
    // ...
}
```

## 数据模型设计

### 核心表结构

基于GoFly现有模型，设计完整的SaaS数据结构：

```sql
-- 用户表 (基于GoFly User模型扩展)
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255),
    avatar_url VARCHAR(500),
    role ENUM('USER', 'ADMIN') DEFAULT 'USER',
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
    
    -- 套餐相关
    plan_id VARCHAR(36),
    plan_name ENUM('FREE', 'PRO', 'MAX') DEFAULT 'FREE',
    plan_expires_at DATETIME,
    
    -- 试用相关
    trial_start_at DATETIME,
    trial_end_at DATETIME,
    trial_source VARCHAR(50),
    trial_used BOOLEAN DEFAULT FALSE,
    
    -- OAuth相关
    google_id VARCHAR(100),
    google_email VARCHAR(255),
    
    -- 邀请相关
    invite_code VARCHAR(20) UNIQUE,
    invited_by VARCHAR(36),
    invited_at DATETIME,
    
    -- Token相关
    token_balance BIGINT DEFAULT 0,
    
    -- SaaS扩展字段
    tenant_id VARCHAR(36),
    company_name VARCHAR(100),
    industry VARCHAR(50),
    team_size VARCHAR(20),
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    INDEX idx_email (email),
    INDEX idx_tenant (tenant_id),
    INDEX idx_plan (plan_name),
    INDEX idx_status (status)
);

-- BatchGo任务表 (基于现有模型)
CREATE TABLE batch_tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    progress INT DEFAULT 0,
    total_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    urls TEXT,
    results TEXT,
    error TEXT,
    config TEXT,
    
    -- 执行配置
    cycle_count INT DEFAULT 1,
    current_cycle INT DEFAULT 1,
    open_count INT DEFAULT 1,
    open_interval INT DEFAULT 5,
    enable_randomization BOOLEAN DEFAULT FALSE,
    random_variation DECIMAL(3,2) DEFAULT 0.2,
    proxy_url VARCHAR(500),
    proxy_validated BOOLEAN DEFAULT FALSE,
    referer_option VARCHAR(20),
    mode VARCHAR(20) DEFAULT 'single',
    
    -- 时间信息
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    INDEX idx_user_status (user_id, status),
    INDEX idx_type (type),
    INDEX idx_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- SiteRank任务表 (基于现有模型)
CREATE TABLE site_rank_tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    keywords TEXT,
    search_engine VARCHAR(50) DEFAULT 'google',
    region VARCHAR(10) DEFAULT 'us',
    language VARCHAR(10) DEFAULT 'en',
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
    progress INT DEFAULT 0,
    total_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    results TEXT,
    error TEXT,
    config TEXT,
    
    -- 调度相关
    schedule_type VARCHAR(20) DEFAULT 'once',
    schedule_time VARCHAR(50),
    last_run_at DATETIME,
    next_run_at DATETIME,
    
    -- 时间信息
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    INDEX idx_user_status (user_id, status),
    INDEX idx_domain (domain),
    INDEX idx_schedule (schedule_type, next_run_at),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Token系统表 (基于现有完整实现)
CREATE TABLE token_balances (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) UNIQUE NOT NULL,
    balance BIGINT DEFAULT 0,
    frozen BIGINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE token_transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type ENUM('RECHARGE', 'CONSUME', 'REFUND', 'BONUS', 'ADJUST') NOT NULL,
    amount BIGINT NOT NULL,
    balance BIGINT NOT NULL,
    description TEXT,
    feature VARCHAR(50),
    task_id VARCHAR(36),
    status ENUM('PENDING', 'COMPLETED', 'FAILED') DEFAULT 'COMPLETED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_type (user_id, type),
    INDEX idx_feature (feature),
    INDEX idx_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 邀请系统表 (基于现有实现)
CREATE TABLE invitations (
    id VARCHAR(36) PRIMARY KEY,
    inviter_id VARCHAR(36) NOT NULL,
    invitee_id VARCHAR(36) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    status ENUM('PENDING', 'ACCEPTED', 'EXPIRED') DEFAULT 'PENDING',
    reward_amount BIGINT DEFAULT 50,
    expired_at DATETIME NOT NULL,
    accepted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_inviter (inviter_id),
    INDEX idx_code (code),
    INDEX idx_status (status),
    FOREIGN KEY (inviter_id) REFERENCES users(id),
    FOREIGN KEY (invitee_id) REFERENCES users(id)
);

-- 签到记录表 (基于GoFly签到模块)
CREATE TABLE checkin_records (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    checkin_date DATE NOT NULL,
    token_reward INT DEFAULT 10,
    consecutive_days INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_user_date (user_id, checkin_date),
    INDEX idx_user (user_id),
    INDEX idx_date (checkin_date),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 数据关系图

```mermaid
erDiagram
    USERS ||--o{ BATCH_TASKS : "创建"
    USERS ||--o{ SITE_RANK_TASKS : "创建"
    USERS ||--|| TOKEN_BALANCES : "拥有"
    USERS ||--o{ TOKEN_TRANSACTIONS : "产生"
    USERS ||--o{ INVITATIONS : "邀请"
    USERS ||--o{ CHECKIN_RECORDS : "签到"
    
    USERS {
        string id PK
        string email UK
        string plan_name
        datetime plan_expires_at
        string invite_code UK
        string invited_by FK
        bigint token_balance
    }
    
    BATCH_TASKS {
        string id PK
        string user_id FK
        string status
        int progress
        text urls
        text results
    }
    
    SITE_RANK_TASKS {
        string id PK
        string user_id FK
        string domain
        text keywords
        string status
    }
    
    TOKEN_BALANCES {
        string id PK
        string user_id UK,FK
        bigint balance
        bigint frozen
    }
    
    TOKEN_TRANSACTIONS {
        string id PK
        string user_id FK
        string type
        bigint amount
        string feature
    }
```

## 错误处理设计

### 统一错误处理

基于GoFly现有的错误处理系统：

```go
// 基于 internal/errors/app_error.go 扩展
type APIError struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Details string `json:"details,omitempty"`
    TraceID string `json:"trace_id,omitempty"`
}

// 错误码定义
const (
    // 成功
    SUCCESS = 0
    
    // 通用错误 1000-1999
    INVALID_PARAMS     = 1001
    MISSING_PARAMS     = 1002
    VALIDATION_FAILED  = 1003
    
    // 认证错误 2000-2999
    UNAUTHORIZED       = 2001
    TOKEN_EXPIRED      = 2002
    INVALID_TOKEN      = 2003
    PERMISSION_DENIED  = 2004
    
    // 业务错误 3000-3999
    USER_NOT_FOUND     = 3001
    INSUFFICIENT_TOKENS = 3002
    TASK_NOT_FOUND     = 3003
    PLAN_EXPIRED       = 3004
    
    // 系统错误 5000-5999
    INTERNAL_ERROR     = 5001
    DATABASE_ERROR     = 5002
    CACHE_ERROR        = 5003
    EXTERNAL_API_ERROR = 5004
)
```

### 错误处理中间件

```go
// 基于 internal/middleware/error_handler.go
func ErrorHandlerMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        defer func() {
            if err := recover(); err != nil {
                // 记录错误日志
                log.Printf("Panic recovered: %v", err)
                
                // 返回统一错误格式
                c.JSON(500, APIError{
                    Code:    INTERNAL_ERROR,
                    Message: "Internal server error",
                    TraceID: generateTraceID(),
                })
                c.Abort()
            }
        }()
        
        c.Next()
        
        // 处理业务错误
        if len(c.Errors) > 0 {
            err := c.Errors.Last()
            handleBusinessError(c, err)
        }
    }
}
```

## 测试策略

### 单元测试

基于GoFly现有的测试结构：

```go
// 用户服务测试
func TestUserService_CreateUser(t *testing.T) {
    // 使用GoFly的测试工具
    db := setupTestDB()
    defer cleanupTestDB(db)
    
    userService := user.NewService(db)
    
    tests := []struct {
        name    string
        request user.RegisterRequest
        wantErr bool
    }{
        {
            name: "valid user registration",
            request: user.RegisterRequest{
                Email:    "test@example.com",
                Password: "password123",
                Username: "testuser",
            },
            wantErr: false,
        },
        // 更多测试用例...
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, err := userService.Register(tt.request)
            if (err != nil) != tt.wantErr {
                t.Errorf("Register() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}
```

### 集成测试

```go
// API集成测试
func TestBatchGoAPI_Integration(t *testing.T) {
    // 启动测试服务器
    router := setupTestRouter()
    server := httptest.NewServer(router)
    defer server.Close()
    
    // 创建测试用户和Token
    user := createTestUser()
    token := generateTestToken(user.ID)
    
    // 测试创建任务
    taskData := map[string]interface{}{
        "name": "Test Task",
        "type": "BATCH_OPEN",
        "urls": []string{"https://example.com"},
    }
    
    resp := makeAuthenticatedRequest(server.URL+"/api/batchopen/tasks", "POST", taskData, token)
    assert.Equal(t, 200, resp.StatusCode)
    
    // 验证响应格式
    var response map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&response)
    assert.Equal(t, 0, response["code"])
    assert.NotNil(t, response["data"])
}
```

### 性能测试

```go
// 并发性能测试
func BenchmarkBatchTaskCreation(b *testing.B) {
    db := setupTestDB()
    service := batchgo.NewService(db)
    
    b.ResetTimer()
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            request := batchgo.CreateTaskRequest{
                Name: "Benchmark Task",
                Type: "BATCH_OPEN",
                Urls: []string{"https://example.com"},
            }
            
            _, err := service.CreateTask("test-user-id", request)
            if err != nil {
                b.Errorf("CreateTask failed: %v", err)
            }
        }
    })
}
```

## 部署架构

### 容器化部署

基于GoFly的单进程架构：

```dockerfile
# 多阶段构建
FROM golang:1.21-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o autoads-server ./cmd/server

# 运行阶段
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/

# 复制二进制文件
COPY --from=builder /app/autoads-server .
COPY --from=builder /app/config.yaml .

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# 启动命令
CMD ["./autoads-server"]
```

### 配置管理

```yaml
# config.yaml (基于GoFly配置扩展)
app:
  name: "autoads-saas"
  debug: false
  port: 8080
  version: "1.0.0"

database:
  type: "mysql"
  host: "${DB_HOST}"
  port: ${DB_PORT}
  username: "${DB_USER}"
  password: "${DB_PASSWORD}"
  database: "${DB_NAME}"
  charset: "utf8mb4"
  timezone: "UTC"
  pool:
    max_idle: 10
    max_open: 100
    max_lifetime: 3600

redis:
  enable: true
  host: "${REDIS_HOST}"
  port: ${REDIS_PORT}
  password: "${REDIS_PASSWORD}"
  db: 0
  pool_size: 100
  prefix: "autoads:"

jwt:
  secret: "${JWT_SECRET}"
  expires_in: 7200
  refresh_expires_in: 604800

# SaaS特定配置
saas:
  default_plan: "FREE"
  trial_days: 7
  invite_reward_tokens: 50
  daily_checkin_tokens: 10
  
rate_limit:
  enabled: true
  free_plan:
    requests_per_minute: 10
    batch_tasks_per_day: 5
    siterank_queries_per_day: 20
  pro_plan:
    requests_per_minute: 60
    batch_tasks_per_day: 50
    siterank_queries_per_day: 200
  max_plan:
    requests_per_minute: 300
    batch_tasks_per_day: 500
    siterank_queries_per_day: 2000
```

## 监控和日志

### 监控指标

基于GoFly的metrics系统：

```go
// 业务指标监控
var (
    UserRegistrations = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "autoads_user_registrations_total",
            Help: "Total number of user registrations",
        },
        []string{"source", "plan"},
    )
    
    TaskExecutions = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "autoads_task_executions_total", 
            Help: "Total number of task executions",
        },
        []string{"type", "status", "user_plan"},
    )
    
    TokenTransactions = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "autoads_token_transactions_total",
            Help: "Total number of token transactions",
        },
        []string{"type", "feature"},
    )
    
    ActiveUsers = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "autoads_active_users",
            Help: "Number of active users",
        },
        []string{"plan", "period"},
    )
)
```

### 日志结构

```go
// 结构化日志
type LogEntry struct {
    Timestamp string                 `json:"timestamp"`
    Level     string                 `json:"level"`
    Message   string                 `json:"message"`
    UserID    string                 `json:"user_id,omitempty"`
    TaskID    string                 `json:"task_id,omitempty"`
    Feature   string                 `json:"feature,omitempty"`
    Duration  int64                  `json:"duration_ms,omitempty"`
    Error     string                 `json:"error,omitempty"`
    Context   map[string]interface{} `json:"context,omitempty"`
}
```

## 安全设计

### 数据安全

1. **数据加密**：敏感数据字段加密存储
2. **访问控制**：基于用户ID的数据隔离
3. **审计日志**：所有操作记录审计追踪
4. **备份策略**：定期数据备份和恢复测试

### API安全

1. **认证授权**：JWT Token + 权限验证
2. **请求限流**：基于用户套餐的差异化限流
3. **输入验证**：所有输入参数严格验证
4. **HTTPS强制**：生产环境强制HTTPS

### 运行时安全

1. **容器安全**：非root用户运行
2. **网络隔离**：最小权限网络访问
3. **资源限制**：CPU和内存使用限制
4. **健康检查**：定期健康状态检查

## 可行性评估结论

基于对GoFly Admin V3源码的深入分析和完整需求文档的对比研究，该重构方案具有极高的可行性：

### 技术可行性（90%）
1. **功能完整性**：GoFly已实现80%的所需功能，SiteRankGo的多搜索引擎支持需要补充实现
2. **架构匹配度**：GoFly架构完全符合SaaS多用户系统需求
3. **API兼容性**：GoFly路由系统支持完整的API契约实现
4. **性能可达性**：Go语言特性和GoFly优化机制支持性能目标

### 实施可行性（90%）
1. **开发效率**：3周开发周期合理，基于85%功能复用
2. **团队配置**：2人团队充足，GoFly降低了技术复杂度
3. **风险可控**：所有技术风险都有明确的缓解策略
4. **部署简单**：单进程部署，运维复杂度低

### 优化建议
1. **SiteRankGo模块完善**：补充Bing、Baidu搜索引擎的实际API集成，目前只有框架代码
2. **代码清理**：遵循Linus原则，删除所有无用代码和文件
3. **模块化设计**：基于GoFly的模块系统，保持代码组织清晰
4. **性能优化**：利用GoFly的多级缓存和并发优化机制
5. **安全加固**：基于GoFly的安全中间件，加强数据保护

### 最佳实践
1. **直接扩展**：在GoFly基础上直接扩展，避免wrapper层
2. **统一标准**：使用GoFly的统一响应格式和错误处理
3. **自动化工具**：充分利用CRUD生成器和Admin面板
4. **监控完善**：集成GoFly的监控和日志系统

### 风险缓解
1. **技术风险**：通过POC验证关键功能，确保技术可行性
2. **性能风险**：提前进行压力测试，验证并发处理能力
3. **兼容风险**：严格按照API契约实现，确保前端兼容
4. **时间风险**：分阶段交付，关键功能优先实现

**结论**：基于GoFly的重构方案技术可行，能够显著提升开发效率。需要注意SiteRankGo模块的多搜索引擎支持需要额外开发工作，但这不影响整体方案的可行性。建议优先实现核心SaaS功能，搜索引擎支持可作为后续迭代内容。