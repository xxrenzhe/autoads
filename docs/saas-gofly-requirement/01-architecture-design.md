# 架构设计文档

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
- 缺少多租户支持，无法扩展为SaaS平台
- 需要增加邀请、签到、Token等新功能
- 性能瓶颈明显，响应时间长

**解决方案**
- 采用GoFly框架重构后端，利用其高并发特性
- 设计多租户数据隔离机制
- 集成框架现有组件，快速实现新功能
- 通过Go内置反向代理，保持前端不变

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户访问层                           │
├─────────────────────────────────────────────────────────────┤
│  Web前端(Next.js)  │  API接口 (3000端口)                   │
├─────────────────────────────────────────────────────────────┤
│              Go HTTP Server (单进程双端口)                  │
│     ├── Next.js反向代理 (端口3000)                          │
│     └── SaaS API服务 (端口8888)                             │
├─────────────────────────────────────────────────────────────┤
│                    SaaS服务层                               │
│  - 用户认证  -  BatchGo  -  SiteRankGo  - Token系统        │
│  - 订阅管理  -  邀请系统  -  签到系统    - 数据统计        │
├─────────────────────────────────────────────────────────────┤
│                    GoFly工具层                              │
│  CRUD生成器  缓存系统  定时任务  Excel导出  日志系统       │
├─────────────────────────────────────────────────────────────┤
│                    基础设施层                               │
│  MySQL 8.0  │  Redis  │  监控  │  日志收集  │  告警系统    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 架构设计决策

#### 2.2.1 GoFly框架集成方式
**决策：将GoFly作为库使用，而非修改源码**

**理由：**
- **解耦合**：避免SaaS业务逻辑与Admin管理功能强耦合
- **易于维护**：GoFly可独立升级，不影响SaaS业务
- **代码清晰**：避免在同一个文件中混用两套用户系统
- **高复用度**：只复用GoFly的工具类（CRUD生成器、缓存、Excel导出等）

**项目结构：**
```
autoads-go/
├── cmd/
│   ├── saas/main.go          # SaaS服务入口
│   └── admin/main.go         # Admin服务入口（可选）
├── internal/
│   ├── saas/                 # SaaS业务逻辑
│   ├── models/               # 数据模型（全新设计）
│   └── gofly/                # GoFly集成层
└── vendor/gofly-admin-v3     # GoFly作为vendored库
```

#### 2.2.2 数据隔离策略
**决策：创建全新的SaaS表结构，只复用GoFly工具**

**理由：**
- **数据干净**：SaaS和Admin数据模型差异大，分开更清晰
- **扩展性好**：SaaS表完全按业务需求设计
- **迁移简单**：从Next.js迁移时映射关系清晰
- **避免冲突**：不会与GoFly未来更新冲突

**基础模型设计：**
```go
// 所有SaaS表都嵌入这个基础结构
type SaaSBaseModel struct {
    ID        string    `gorm:"primary_key;type:varchar(36)"`
    TenantID  string    `gorm:"type:varchar(36);not null;index"`
    CreatedAt time.Time 
    UpdatedAt time.Time
    DeletedAt time.Time `gorm:"index"`
}
```

#### 2.2.3 部署架构
**决策：单进程双端口，使用Go的http.ServeMux做路由分发**

**理由：**
- **简单可靠**：单进程避免进程间通信复杂性
- **资源高效**：2C4G容器配置下，单进程更节省资源
- **部署简单**：符合现有ClawCloud单容器部署模式
- **调试方便**：日志统一，问题排查简单

**实现方案：**
```go
func main() {
    // 启动Next.js（子进程）
    cmd := exec.Command("npm", "start")
    cmd.Dir = "./frontend"
    cmd.Start()
    
    // 端口3000：反向代理Next.js
    go func() {
        router := gin.New()
        // 静态资源代理
        router.Static("/", "./frontend/.next/static")
        // API请求转发到8888
        router.Any("/api/*path", proxyHandler)
        router.Run(":3000")
    }()
    
    // 端口8888：SaaS API服务
    saasRouter := gin.Default()
    setupSaaSRoutes(saasRouter)
    saasRouter.Run(":8888")
}
```

### 2.3 技术栈

**后端技术栈**
- **Go 1.21+** - 主要开发语言
- **GoFly Admin V3** - 作为vendored库使用（复用工具类）
- **Gin** - HTTP路由框架
- **GORM** - ORM框架
- **Redis** - 缓存和会话存储
- **MySQL 8.0** - 主数据库

## 3. 核心模块设计

### 3.1 多租户架构

**租户隔离策略**
- 数据隔离：通过`tenant_id`字段隔离所有业务数据
- 缓存隔离：Redis key使用`tenant:{tenant_id}:{data_key}`格式
- 会话隔离：JWT Token包含tenant_id信息

**数据模型**
```sql
-- 所有业务表都包含tenant_id
CREATE TABLE batch_tasks (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    -- 其他字段...
    INDEX idx_tenant (tenant_id)
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

**SaaS用户认证**
- JWT Token认证（RS256签名）
- 支持Bearer Token和Cookie两种方式
- Token包含：user_id, tenant_id, role, exp
- 访问令牌2小时，刷新令牌7天

**密码安全**
- 使用bcrypt哈希，强度12
- 登录限制：连续失败5次锁定30分钟

### 3.3 模块划分

**SaaS服务模块**
1. **用户管理** - 注册、登录、个人信息
2. **订阅管理** - 套餐购买、过期检查、权限控制
3. **Token系统** - 余额查询、消耗记录、购买充值
4. **邀请系统** - 邀请链接生成、奖励发放
5. **签到系统** - 每日签到、连续签到奖励
6. **业务模块** - BatchGo、SiteRankGo、AdsCenterGo

**Admin管理模块**
1. **租户管理** - SaaS租户的CRUD管理
2. **用户管理** - 查看所有SaaS用户
3. **系统配置** - 套餐配置、Token规则等
4. **数据统计** - 用户活跃度、收入统计
5. **运营工具** - 邀请排行、签到统计

## 4. 数据库设计

### 4.1 核心表结构

**租户表（tenants）**
```sql
CREATE TABLE tenants (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    domain VARCHAR(100) UNIQUE,
    status TINYINT DEFAULT 1 COMMENT '1:正常 0:禁用',
    plan_id VARCHAR(36),
    expired_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**SaaS用户表（saas_users）**
```sql
CREATE TABLE saas_users (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50),
    role ENUM('user', 'admin') DEFAULT 'user',
    status TINYINT DEFAULT 1,
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_email (tenant_id, email)
);
```

**用户订阅表（user_subscriptions）**
```sql
CREATE TABLE user_subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    plan_id VARCHAR(36) NOT NULL,
    status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
    started_at DATETIME,
    expired_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_status (user_id, status)
);
```

### 4.2 新功能表结构

**邀请记录表（invitations）**
```sql
CREATE TABLE invitations (
    id VARCHAR(36) PRIMARY KEY,
    inviter_id VARCHAR(36) NOT NULL,
    invitee_id VARCHAR(36),
    code VARCHAR(20) UNIQUE NOT NULL,
    status ENUM('pending', 'accepted', 'expired') DEFAULT 'pending',
    reward_days INT DEFAULT 30,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expired_at DATETIME,
    INDEX inviter_idx (inviter_id),
    INDEX code_idx (code)
);
```

**签到记录表（checkin_records）**
```sql
CREATE TABLE checkin_records (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    checkin_date DATE NOT NULL,
    continuous_days INT DEFAULT 1,
    token_reward INT DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, checkin_date)
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

**认证相关**
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/refresh` - 刷新Token
- `POST /api/auth/logout` - 用户登出

**订阅相关**
- `GET /api/subscription/current` - 获取当前订阅
- `POST /api/subscription/upgrade` - 升级套餐
- `GET /api/subscription/plans` - 获取套餐列表

**Token相关**
- `GET /api/tokens/balance` - 获取Token余额
- `GET /api/tokens/consumption` - 获取消费记录
- `POST /api/tokens/purchase` - 购买Token

**邀请相关**
- `POST /api/invitations/generate` - 生成邀请链接
- `GET /api/invitations/my-code` - 获取我的邀请码
- `GET /api/invitations/records` - 邀请记录

**签到相关**
- `POST /api/checkin/today` - 今日签到
- `GET /api/checkin/records` - 签到历史
- `GET /api/checkin/calendar` - 签到日历

## 6. 性能设计

### 6.1 性能目标

- **并发处理**: 支持50个并发用户
- **响应时间**: P95 < 200ms
- **错误率**: < 0.1%
- **可用性**: 99.9%

### 6.2 性能优化策略

**数据库优化**
- 读写分离：主库写，从库读
- 分库分表：按租户ID水平拆分
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

- JWT Token使用RS256签名
- Token有效期：访问令牌2小时，刷新令牌7天
- 密码存储：使用bcrypt哈希，强度12
- 登录限制：连续失败5次锁定30分钟

### 7.2 数据安全

- 敏感数据加密存储
- SQL注入防护：使用参数化查询
- XSS防护：输出转义
- CSRF防护：Token验证

### 7.3 访问控制

- 基于角色的访问控制（RBAC）
- 租户数据隔离验证
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
    "tenant_id": "tenant123",
    "message": "User login success",
    "data": {}
}
```