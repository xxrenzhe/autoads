# 架构设计文档

**文档版本**: v1.0  
**最后更新**: 2025-09-11  
**文档状态**: 设计规划阶段  

> **⚠️ 验证要求**  
> 本架构设计基于对GoFly框架的理解和假设。**在实施前必须验证：**
> - GoFly框架是否确实支持文档中描述的所有功能
> - 框架的实际性能和并发处理能力
> - 与现有Next.js前端的集成可行性

## 1. 概述

### 1.1 设计原则

遵循Linus Torvalds的设计哲学：

**数据结构优先**
- "Bad programmers worry about the code. Good programmers worry about data structures."
- 先设计核心数据模型，再实现业务逻辑

**消除特殊情况**
- "好代码没有特殊情况"
- 通过合理的数据结构设计，减少if/else分支

**保持简洁**
- "如果你需要超过3层缩进，你就已经完蛋了"
- 每个函数只做一件事，并做好

**永不破坏用户空间**
- 保持前端界面100%一致
- 确保现有用户操作习惯不受影响

### 1.2 核心问题分析

**当前问题**
- Next.js单体架构，并发处理能力差（仅支持1个并发用户）
- 缺少多用户支持，无法扩展为SaaS平台
- 需要增加邀请、签到、Token等新功能
- 性能瓶颈明显，响应时间长
- Chengelink功能的自动化流程需要稳定的高并发支持（详见[Chengelink功能规格说明书](./11-chengelink-specification.md)）

**解决方案**
- 采用GoFly框架重构后端，利用其高并发特性
- 设计多用户数据模型
- 集成框架现有组件，快速实现新功能
- 通过Go嵌入Next.js静态文件，保持前端不变
- 优化Chengelink的自动化流程，支持并发执行（详见[Chengelink功能规格说明书](./11-chengelink-specification.md)）

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户访问层                           │
├─────────────────────────────────────────────────────────────┤
│              统一入口 (8888端口)                            │
├─────────────────────────────────────────────────────────────┤
│                   扩展的GoFly框架                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   SaaS模块      │  │   Admin模块     │  │  核心框架   │ │
│  │                 │  │                 │  │             │ │
│  │ - 用户认证      │  │ - 用户管理      │  │ - 路由      │ │
│  │ - BatchOpen     │  │ - 系统配置      │  │ - 中间件   │ │
│  │ - SiteRank      │  │ - 数据统计      │  │ - ORM       │ │
│  │ - Token系统     │  │ - 用户管理      │  │ - 缓存      │ │
│  │ - 邀请/签到     │  │                 │  │ - 日志      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    基础设施层                               │
│  MySQL 8.0  │  Redis  │  监控  │  日志收集  │  告警系统    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 架构设计决策

#### 2.2.1 GoFly框架集成方式
**决策：直接fork GoFly并扩展为SaaS平台**

**理由：**
- **数据结构优先**：扩展GoFly的用户模型，而不是创建两套系统
- **消除复杂性**：避免wrapper层，直接在核心中实现多用户
- **充分利用**：GoFly已经有完整的Admin、权限、CRUD系统
- **实用主义**：用最直接的方式解决问题，而不是追求理论完美

**项目结构：**
```
gofly_admin_v3/                 # GoFly源码目录
├── internal/
│   ├── models/                 # 扩展的数据模型
│   │   ├── user.go             # 扩展用户模型
│   │   └── subscription.go     # 新增订阅模型
│   ├── auth/                   # 扩展JWT认证
│   ├── crud/                   # 复用CRUD生成器
│   ├── middleware/             # 添加用户中间件
│   └── modules/                # 新增业务模块
│       ├── batchgo/           # BatchOpen功能
│       ├── siterankgo/        # SiteRank功能
│       ├── token/             # Token系统
│       ├── invitation/         # 邀请系统
│       └── checkin/           # 签到系统
├── web/
│   └── admin/                  # 复用GoFly Admin界面
└── cmd/
    └── server.go               # 统一服务入口
```

#### 2.2.2 数据模型设计
**决策：直接扩展GoFly的User模型，实现多用户系统**

**理由：**
- **数据结构优先**：在GoFly User模型基础上添加必要字段
- **消除特殊情况**：每个用户独立，无需复杂的租户隔离逻辑
- **简洁性**：最简单的用户-服务关系
- **实用主义**：满足AutoAds的实际需求

**数据模型设计：**
```go
// 统一用户模型，与API契约一致
type User struct {
    gorm.Model               // 使用GORM基础模型 (ID, CreatedAt, UpdatedAt, DeletedAt)
    Email         string    `gorm:"type:varchar(100);unique;not null"`
    Password      string    `json:"-" gorm:"size:255"`                    // 管理员密码
    GoogleID      string    `gorm:"type:varchar(255);unique"`             // Google OAuth
    Role          string    `gorm:"type:varchar(20);default:'user'"`      // 'user' or 'admin'
    TokenBalance  int       `gorm:"default:0"`
    Plan          string    `gorm:"type:varchar(20);default:'free'"`       // free, pro
    PlanExpires   *time.Time
    InviteCode    string    `gorm:"type:varchar(20);unique"`
    InvitedBy     *string   `gorm:"type:varchar(36)"`
    Name          string    `gorm:"type:varchar(100)"`
    Avatar        string    `gorm:"type:varchar(255)"`
    LastLogin     *time.Time
    Status        int       `gorm:"default:1"` // 1: active, 0: inactive
}

// Token交易记录
type TokenTransaction struct {
    gorm.Model
    UserID      string    `gorm:"type:varchar(36);not null;index"`
    Amount      int       `gorm:"not null"`          // 正数增加，负数消费
    Balance     int       `gorm:"not null"`          // 变动后余额
    Type        string    `gorm:"type:varchar(20)"`   // purchase, checkin, invite, consume
    Description string    `gorm:"type:varchar(100)"`
}

// 业务模型示例
type BatchTask struct {
    gorm.Model
    UserID       string    `gorm:"type:varchar(36);not null;index"`
    Name         string    `gorm:"type:varchar(100);not null"`
    Type         string    `gorm:"type:varchar(20);not null"`      // silent, autoclick
    Status       string    `gorm:"type:varchar(20);default:'pending'"`
    URLs         []string  `gorm:"type:json"`
    TotalURLs    int       `gorm:"not null;default:0"`
    SuccessCount int       `gorm:"default:0"`
    FailCount    int       `gorm:"default:0"`
    // 其他业务字段...
}
```

**优势：**
- 完全复用GoFly的CRUD生成器
- 自动获得软删除、时间戳等功能
- 统一的API接口格式
- 简单的用户数据关联，通过user_id即可

#### 2.2.3 部署架构
**决策：直接使用GoFly的单进程部署**

**理由：**
- **极致简单**：GoFly本身就是完整的Web框架，无需额外代理
- **资源高效**：单进程处理所有请求，符合Go的并发设计
- **部署简单**：一个二进制文件，一个进程，零配置
- **调试方便**：统一的日志、监控、错误处理

**实现方案：**
```go
func main() {
    // 初始化GoFly应用
    app := gofly.NewApp()
    
    // 配置数据库和Redis
    app.SetDB(config.GetDB())
    app.SetCache(config.GetRedis())
    
    // 注册SaaS模块
    app.RegisterModule(&modules.SaaS{})
    app.RegisterModule(&modules.BatchGo{})
    app.RegisterModule(&modules.SiteRankGo{})
    
    // 启动服务
    app.Run(":8888")
}
```

**前端集成方案：**
- 将Next.js构建的静态文件嵌入到Go二进制文件中
- Go HTTP服务器直接服务静态文件和API路由
- 单进程处理所有请求
- 架构简洁，部署简单

### 2.3 技术栈

**后端技术栈**
- **Go 1.21+** - 主要开发语言
- **GoFly Admin V3** - 作为本地框架使用（需验证实际功能）
- **Gin** - HTTP路由框架（假设GoFly基于Gin）
- **GORM** - ORM框架（假设GoFly使用GORM）
- **Redis** - 缓存和会话存储
- **MySQL 8.0** - 主数据库

> **🔍 待验证项**  
> - GoFly框架的具体技术栈和依赖
> - 框架是否内置了文档中提到的所有组件
> - 实际的API设计和路由组织方式

## 3. 核心模块设计

### 3.1 多用户架构

**用户数据隔离**
- 数据隔离：通过`user_id`字段关联所有业务数据
- 缓存隔离：Redis key使用`user:{user_id}:{data_key}`格式
- 会话隔离：JWT Token包含user_id信息

**数据模型**
```sql
-- 所有业务表都包含user_id
CREATE TABLE batch_tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    -- 其他字段...
    INDEX idx_user (user_id)
);
```

### 3.2 API兼容性设计

**决策：实现完整的API路径和格式兼容**

**理由：**
- **零风险**：前端完全不需要修改，确保功能100%一致
- **渐进式迁移**：可以逐个API迁移，随时可以回滚
- **测试简单**：可以直接用现有的测试用例
- **用户无感知**：迁移过程对用户完全透明

**兼容性实现：**
```go
// 完全复刻现有API路径
router.POST("/api/batchopen/silent-start", handlers.SilentStartHandler)
router.GET("/api/siterank/rank", handlers.SiteRankHandler)
router.POST("/api/auth/callback", handlers.AuthCallbackHandler)

// 响应格式完全一致
type APIResponse struct {
    Code       int         `json:"code"`
    Message    string      `json:"message"`
    Data       interface{} `json:"data"`
    Pagination interface{} `json:"pagination,omitempty"`
}
```

### 3.3 认证系统设计

采用简化的双重认证体系：
- **网站用户**：Google OAuth + JWT Token（详见[安全设计文档](./13-security-design.md)）
- **管理员**：账号密码 + Session认证（复用GoFly现有系统）

详细实现见[13-security-design.md](./13-security-design.md)。
### 3.4 模块划分

**用户服务模块**
1. **Google登录** - OAuth回调、自动注册
2. **订阅管理** - 套餐购买、升级、过期检查
3. **Token系统** - 余额查询、消耗记录、充值
4. **业务模块** - BatchOpen、SiteRank、Chengelink（详见[Chengelink功能规格说明书](./11-chengelink-specification.md)）

**系统管理模块**
1. **用户管理** - 查看所有用户、状态管理
2. **系统配置** - 套餐价格、Token规则
3. **数据统计** - 用户活跃、收入统计

## 4. 数据库设计

### 4.1 核心表结构

**用户表（users）**
```sql
-- 统一用户表，支持所有必要字段
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    
    email VARCHAR(100) UNIQUE NOT NULL COMMENT '邮箱',
    password VARCHAR(255) COMMENT '密码（仅管理员）',
    google_id VARCHAR(255) UNIQUE COMMENT 'Google ID',
    role ENUM('user', 'admin') DEFAULT 'user' COMMENT '角色',
    token_balance INT DEFAULT 0 COMMENT 'Token余额',
    plan ENUM('free', 'pro') DEFAULT 'free' COMMENT '套餐',
    plan_expires DATETIME COMMENT '套餐到期时间',
    invite_code VARCHAR(20) UNIQUE COMMENT '邀请码（注册时自动生成）',
    invited_by VARCHAR(36) COMMENT '邀请人ID',
    name VARCHAR(100) COMMENT '用户名',
    avatar VARCHAR(255) COMMENT '头像URL',
    last_login DATETIME COMMENT '最后登录时间',
    status TINYINT DEFAULT 1 COMMENT '状态：1-正常，0-禁用',
    
    INDEX idx_role (role),
    INDEX idx_plan (plan),
    INDEX idx_status (status),
    INDEX idx_email (email),
    INDEX idx_google_id (google_id)
);
```

**Token交易记录表（token_transactions）**
```sql
CREATE TABLE token_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
    amount INT NOT NULL COMMENT '变动数量',
    balance INT NOT NULL COMMENT '变动后余额',
    type ENUM('purchase', 'checkin', 'invite', 'consume') NOT NULL COMMENT '类型',
    description VARCHAR(100) COMMENT '描述',
    
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_type (type)
);
```

**用户套餐记录表（user_subscriptions）**
```sql
CREATE TABLE user_subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    plan_type VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2),
    payment_method VARCHAR(20),
    status ENUM('pending', 'active', 'expired', 'cancelled') DEFAULT 'active',
    started_at DATETIME,
    expired_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_status (user_id, status)
);
```

### 4.2 新功能表结构

**BatchGo任务表**
```sql
CREATE TABLE batch_tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('silent', 'autoclick') NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed', 'terminated') DEFAULT 'pending',
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
    
    INDEX idx_user_status (user_id, status),
    INDEX idx_type_status (type, status),
    INDEX idx_created_at (created_at)
);
```

**SiteRank查询表**
```sql
CREATE TABLE site_rank_queries (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed') NOT NULL DEFAULT 'pending',
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
    INDEX idx_user_status (user_id, status),
    INDEX idx_domain (domain),
    INDEX idx_cache_until (cache_until)
);
```

**签到记录表**
```sql
CREATE TABLE checkin_records (
    user_id VARCHAR(36) NOT NULL,
    checkin_date DATE NOT NULL,
    token_reward INT DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, checkin_date)
);
```

**邀请记录表**
```sql
CREATE TABLE invitations (
    id VARCHAR(36) PRIMARY KEY,
    inviter_id VARCHAR(36) NOT NULL,
    invitee_id VARCHAR(36) NOT NULL,
    invite_code VARCHAR(20) NOT NULL,
    status ENUM('pending', 'completed') DEFAULT 'pending',
    inviter_reward_given BOOLEAN DEFAULT FALSE,
    invitee_reward_given BOOLEAN DEFAULT FALSE,
    invitee_is_new_user BOOLEAN DEFAULT TRUE,
    reward_days INT DEFAULT 30,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_inviter (inviter_id),
    UNIQUE KEY uk_invitee (invitee_id)
);
```


## 5. API设计

### 5.1 API规范

**统一响应格式**
```json
{
    "code": 0,
    "message": "成功",
    "data": {},
    "pagination": {
        "page": 1,
        "page_size": 20,
        "total": 100
    }
}
```

**错误码规范**
- 0: 成功
- 1000-1999: 参数错误
- 2000-2999: 业务逻辑错误
- 3000-3999: 认证授权错误
- 5000-5999: 系统内部错误

### 5.2 核心API列表

#### 认证相关
- `POST /api/auth/google` - Google OAuth登录
- `POST /api/admin/login` - 管理员账号密码登录
- `POST /api/admin/logout` - 管理员登出

#### 用户相关
- `GET /api/user/profile` - 获取用户信息
- `PUT /api/user/profile` - 更新用户信息
- `GET /api/user/stats` - 获取用户统计数据

#### 订阅相关
- `GET /api/subscription/current` - 获取当前订阅
- `POST /api/subscription/upgrade` - 升级套餐
- `GET /api/subscription/plans` - 获取套餐列表
- `POST /api/subscription/webhook` - 支付回调处理

#### Token相关
- `GET /api/tokens/balance` - 获取Token余额
- `GET /api/tokens/transactions` - 获取交易记录
- `POST /api/tokens/purchase` - 购买Token

#### BatchGo相关
- `POST /api/batchopen/silent-start` - 启动Silent任务（兼容旧路径）
- `GET /api/batchopen/silent-progress` - 查询任务进度（兼容旧路径）
- `POST /api/batchopen/silent-terminate` - 终止任务（兼容旧路径）
- `POST /api/v1/batchgo/tasks/silent/start` - 启动Silent任务（新路径）
- `GET /api/v1/batchgo/tasks/silent/progress` - 查询任务进度（新路径）
- `POST /api/v1/batchgo/tasks/silent/terminate` - 终止任务（新路径）
- `POST /api/autoclick/tasks` - 创建AutoClick任务（兼容旧路径）
- `GET /api/autoclick/tasks/{id}/progress` - 查询AutoClick进度（兼容旧路径）
- `POST /api/autoclick/tasks/{id}/{action}` - AutoClick任务操作（兼容旧路径）
- `POST /api/v1/batchgo/tasks/autoclick` - 创建AutoClick任务（新路径）
- `GET /api/v1/batchgo/tasks/autoclick/{id}/progress` - 查询AutoClick进度（新路径）
- `POST /api/v1/batchgo/tasks/autoclick/{id}/{action}` - AutoClick任务操作（新路径）

#### SiteRank相关
- `GET /api/siterank/rank` - 查询网站排名（兼容旧路径）
- `POST /api/v1/siterankgo/traffic/batch` - 批量查询（新路径）
- `GET /api/v1/siterankgo/traffic/priorities` - 获取优先级（新路径）
- `GET /api/v1/siterankgo/traffic/{domain}` - 查询网站排名（新路径）

#### 邀请相关
- `GET /api/invitation/info` - 获取邀请信息
- `POST /api/invitation/generate-link` - 生成邀请链接
- `GET /api/invitation/history` - 获取邀请历史

#### 签到相关
- `GET /api/checkin/info` - 获取签到信息
- `POST /api/checkin/perform` - 执行签到
- `GET /api/checkin/history` - 获取签到历史

#### Chengelink相关
- `GET /api/chengelink/status` - 获取链接状态（兼容旧路径）
- `POST /api/chengelink/create` - 创建链接任务（兼容旧路径）
- `GET /api/chengelink/tasks` - 获取任务列表（兼容旧路径）
- `POST /api/chengelink/tasks/{id}/execute` - 执行任务（兼容旧路径）
- `GET /api/v1/chengelink/links/{id}/status` - 获取链接状态（新路径）
- `POST /api/v1/chengelink/links` - 创建链接任务（新路径）
- `GET /api/v1/chengelink/tasks` - 获取任务列表（新路径）
- `POST /api/v1/chengelink/tasks/{id}/execute` - 执行任务（新路径）

### 5.3 API安全规范

#### 认证方式
- **网站用户**：JWT Bearer Token
- **管理员**：Session Cookie

#### 权限控制
- RBAC（基于角色的访问控制）
- API级别的权限验证
- 数据级别的权限验证（用户数据隔离）

#### 安全限制
- 请求频率限制：100次/分钟
- 请求大小限制：10MB
- Token消耗验证
- IP白名单（管理后台）

## 6. 性能设计

### 6.1 性能目标

- **并发处理**: 支持50个并发用户
- **响应时间**: P95 < 200ms
- **错误率**: < 0.1%
- **可用性**: 99.9%

### 6.2 性能优化策略

**数据库优化**
- 读写分离：主库写，从库读
- 分库分表：按用户ID水平拆分（未来扩展）
- 索引优化：为常用查询字段建立索引
- 连接池：配置合适的连接池大小

**缓存优化**
- 多级缓存：本地缓存 + Redis
- 缓存预热：系统启动时加载热点数据
- 缓存击穿防护：使用互斥锁或空值缓存
- 缓存雪崩防护：随机过期时间

**并发优化**
- 协程池：控制并发协程数量
- 请求限流：令牌桶算法
- 超时控制：设置合理的超时时间
- 熔断降级：异常情况自动降级

## 7. 安全设计

### 7.1 认证安全

- Google OAuth使用官方库，确保安全性
- 管理员密码使用bcrypt哈希，强度12
- 登录限制：连续失败5次锁定30分钟
- Session有效期：管理员后台8小时

### 7.2 数据安全

- 敏感数据加密存储
- SQL注入防护：使用参数化查询
- XSS防护：输出转义
- CSRF防护：Token验证

### 7.3 访问控制

- 基于角色的访问控制（RBAC）
- 用户数据隔离验证
- API权限验证
- 操作日志记录

## 8. 监控设计

### 8.1 监控指标

**系统指标**
- CPU使用率
- 内存使用率
- 磁盘使用率
- 网络带宽

**应用指标**
- QPS（每秒查询数）
- 响应时间
- 错误率
- 并发连接数

**业务指标**
- 用户活跃度
- Token消耗量
- 订阅转化率
- 邀请转化率

### 8.2 日志规范

**日志级别**
- ERROR：系统错误，需要立即处理
- WARN：警告信息，需要关注
- INFO：普通信息，记录操作
- DEBUG：调试信息，开发使用

**日志格式**
```json
{
    "timestamp": "2024-01-01T00:00:00Z",
    "level": "INFO",
    "service": "saas-api",
    "trace_id": "abc123",
    "user_id": "user123",
    "message": "User login success",
    "data": {}
}
```