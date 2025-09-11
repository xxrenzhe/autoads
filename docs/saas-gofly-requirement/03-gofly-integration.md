# GoFly框架集成指南

## 1. 概述

GoFly Admin V3是一个成熟的后台管理系统框架，经过评估，**85%的工具组件可以直接复用**到AutoAds重构项目中。重要说明：**我们将GoFly作为vendored库使用，而不是修改其源码**，这样可以保持解耦和独立性。

## 2. 框架价值评估

### 2.1 复用度分析

| 模块 | 复用度 | 价值说明 | 改造工作量 | 集成方式 |
|------|--------|----------|------------|----------|
| CRUD生成器 | 100% | 自动生成API，大幅提升效率 | 无 | 作为工具库调用 |
| 工具库 | 100% | 字符串、时间、JSON等工具 | 无 | 直接导入使用 |
| 缓存系统 | 100% | 多级缓存，支持Redis | 无 | 作为服务调用 |
| 定时任务 | 90% | Cron调度器，需要业务适配 | 低 | 集成调度器 |
| 日志系统 | 100% | 结构化日志，多输出支持 | 无 | 直接使用 |
| Excel导出 | 100% | 数据库直接导出Excel | 无 | 工具函数调用 |
| 数据验证 | 100% | 强大的参数验证 | 无 | 中间件使用 |
| 连接池 | 100% | 数据库、Redis连接池 | 无 | 配置使用 |
| 用户认证 | 0% | GoFly的Session认证不适用 | 高 | 自行实现JWT |
| 权限管理 | 0% | GoFly的RBAC不适用 | 高 | 自行实现SaaS权限 |

### 2.2 开发效率提升

- **基础API开发**：提升80%（CRUD自动生成）
- **数据处理**：提升70%（工具库复用）
- **定时任务**：提升90%（直接使用调度器）
- **导出功能**：提升95%（Excel导出复用）
- **缓存实现**：提升85%（缓存系统复用）
- **日志系统**：提升90%（直接复用）

## 3. 项目集成方式

### 3.1 目录结构

```
autoads-go/
├── cmd/
│   └── saas/
│       └── main.go                 # SaaS服务入口
├── internal/
│   ├── config/                     # 配置管理
│   ├── models/                     # SaaS数据模型
│   ├── handlers/                   # API处理器
│   ├── middleware/                 # 中间件
│   ├── services/                   # 业务逻辑
│   └── gofly/                      # GoFly集成层
│       ├── crud/                   # CRUD生成器封装
│       ├── cache/                  # 缓存系统封装
│       ├── scheduler/              # 定时任务封装
│       ├── excel/                  # Excel导出封装
│       └── utils/                  # 工具类封装
├── pkg/
│   └── gofly-admin-v3/              # GoFly源码（vendored）
├── web/
│   └── frontend/                   # Next.js前端（复制现有）
├── go.mod
├── go.sum
└── Dockerfile.standalone
```

### 3.2 GoFly集成步骤

#### 3.2.1 添加GoFly依赖
```bash
# 将GoFly作为vendored库
git clone https://github.com/your-repo/gofly-admin-v3.git pkg/gofly-admin-v3
```

#### 3.2.2 创建集成层
```go
// internal/gofly/crud/integration.go
package crud

import (
    "gofly-admin-v3/internal/crud"
    "gofly-admin-v3/utils/gform"
    "github.com/gin-gonic/gin"
)

// 封装GoFly的CRUD生成器
type SaaSCRUDGenerator struct {
    generator *crud.GoFlyCRUDGenerator
}

func NewSaaSCRUDGenerator(db *gform.DB) *SaaSCRUDGenerator {
    return &SaaSCRUDGenerator{
        generator: crud.NewGoFlyCRUDGenerator(db),
    }
}

// 带租户隔离的CRUD生成
func (g *SaaSCRUDGenerator) GenerateSaaSCRUDRoute(
    router *gin.Engine,
    path string,
    model interface{},
    service interface{},
) {
    // 自动添加租户中间件
    router.Use(TenantMiddleware())
    
    // 调用GoFly的CRUD生成器
    g.generator.GenerateCRUDRoute(router, path, model, service)
}
```

## 3. 核心组件集成

### 3.1 自动CRUD生成器

**功能说明**
- 基于数据模型自动生成增删改查API
- 支持分页、排序、搜索、软删除
- 自动处理参数绑定和验证

**集成方式**
```go
// 引入CRUD生成器
import "gofly-admin-v3/internal/crud"

// 创建生成器实例
generator := crud.NewGoFlyCRUDGenerator(db)

// 一行代码生成完整CRUD接口
generator.GenerateCRUDRoute(
    router, 
    "/api/v1/batchgo/tasks",
    &BatchTask{},
    &BatchTaskService{},
)
```

**复用优势**
- 减少80%的基础API开发工作
- 统一的API接口规范
- 内置分页、查询功能
- 自动处理错误和异常

### 3.2 定时任务调度器

**功能说明**
- 支持秒级精度的Cron任务
- 任务状态管理（pending/running/completed/failed）
- 失败重试机制和执行历史
- 动态任务管理（启动/停止/立即执行）

**集成方式**
```go
// 引入调度器
import "gofly-admin-v3/internal/scheduler"

// 调度器实例
sched := scheduler.GetScheduler()

// 启动调度器
sched.Start()

// 添加定时任务
sched.AddJob(&scheduler.CronJob{
    Job:         &TokenExpireCheckJob{},
    Schedule:    "0 0 * * * *",  // 每小时执行
    Enabled:     true,
    Description: "检查过期Token",
    Timeout:     5 * time.Minute,
    RetryCount:  3,
    RetryDelay:  30 * time.Second,
})

// SaaS应用场景的任务示例
// 1. 数据统计报表生成
sched.AddJob(&scheduler.CronJob{
    Job:         &DailyStatsJob{},
    Schedule:    "0 0 0 * * *",  // 每天凌晨
    Description: "生成每日统计报表",
})

// 2. 缓存定期清理
sched.AddJob(&scheduler.CronJob{
    Job:         &CacheCleanJob{},
    Schedule:    "0 30 2 * * *",  // 凌晨2:30
    Description: "清理过期缓存",
})

// 3. 用户订阅检查
sched.AddJob(&scheduler.CronJob{
    Job:         &SubscriptionCheckJob{},
    Schedule:    "0 */10 * * * *",  // 每10分钟
    Description: "检查用户订阅状态",
})
```

**任务实现示例**
```go
// Token过期检查任务
type TokenExpireCheckJob struct{}

func (j *TokenExpireCheckJob) GetName() string {
    return "token_expire_check"
}

func (j *TokenExpireCheckJob) GetDescription() string {
    return "Check and expire user tokens"
}

func (j *TokenExpireCheckJob) Run(ctx context.Context) error {
    // 实现Token过期逻辑
    // 1. 查询即将过期的Token
    // 2. 更新Token状态
    // 3. 发送通知
    return nil
}
```

### 3.3 Excel导出功能

**功能说明**
- 数据库记录直接导出Excel文件
- 自动读取字段注释作为表头
- 支持大数据量导出和自定义列

**集成方式**
```go
// 引入Excel导出
import "gofly-admin-v3/utils/extend/excelexport"

// API接口中使用
func ExportUserTasks(c *gin.Context) {
    // 查询数据
    var tasks []BatchTask
    query := db.Where("user_id = ?", userID).Find(&tasks)
    
    // 定义导出列
    columns := []interface{}{
        map[string]interface{}{
            "field": "id",
            "title": "任务ID",
        },
        map[string]interface{}{
            "field": "name", 
            "title": "任务名称",
        },
        map[string]interface{}{
            "field": "status",
            "title": "状态",
        },
        map[string]interface{}{
            "field": "created_at",
            "title": "创建时间",
        },
    }
    
    // 导出Excel
    data, err := excelexport.ExportToExcel(
        &query.Result,
        columns,
        "batch_tasks",
        c,
    )
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.Data(200, "application/vnd.ms-excel", data)
}
```

**复用场景**
- 用户数据导出
- 任务报告导出
- Token消费记录导出
- 邀请记录导出
- 签到记录导出

### 3.4 缓存系统

**功能说明**
- 多级缓存：内存缓存 + Redis
- 缓存击穿保护
- 缓存雪崩防护
- 热key自动识别

**集成方式**
```go
// 引入缓存
import "gofly-admin-v3/internal/cache"

// 获取缓存实例
cache := cache.GetCache()

// 设置缓存
err := cache.Set("user:123:info", userInfo, 30*time.Minute)

// 获取缓存
var user User
err := cache.Get("user:123:info", &user)

// 删除缓存
err := cache.Delete("user:123:info")

// 模式删除（支持通配符）
err := cache.DeletePattern("user:123:*")

// SaaS应用中的缓存策略
// 1. 用户信息缓存
cache.Set(fmt.Sprintf("user:%s:info", userID), userInfo, time.Hour)

// 2. Token余额缓存
cache.Set(fmt.Sprintf("user:%s:token_balance", userID), balance, 5*time.Minute)

// 3. 用户权限缓存
cache.Set(fmt.Sprintf("user:%s:permissions", userID), permissions, 30*time.Minute)

// 4. 租户配置缓存
cache.Set(fmt.Sprintf("tenant:%s:config", tenantID), config, time.Hour)
```

### 3.5 工具库集成

GoFly提供了丰富的工具库，可以直接复用：

**字符串工具（gstr）**
```go
import "gofly-admin-v3/utils/tools/gstr"

// URL编码
encoded := gstr.UrlEncode("hello world")

// 字符串截取
sub := gstr.SubStr("hello world", 0, 5)

// 驼峰转下划线
snake := gstr.CaseSnake("HelloWorld")
```

**时间工具（gtime）**
```go
import "gofly-admin-v3/utils/tools/gtime"

// 获取当前时间
now := gtime.Now()

// 格式化时间
str := gtime.Format("Y-m-d H:i:s")

// 时间解析
t, err := gtime.StrToTime("2024-01-01 00:00:00")

// 计算时间差
duration := gtime.Diff(now, t)
```

**JSON工具（gjson）**
```go
import "gofly-admin-v3/utils/tools/gjson"

// JSON编码
jsonStr := gjson.Encode(data)

// JSON解码
var result map[string]interface{}
err := gjson.Decode(jsonStr, &result)

// 从JSON中获取值
value := gjson.Get(jsonStr, "user.name")
```

**文件工具（gfile）**
```go
import "gofly-admin-v3/utils/tools/gfile"

// 判断文件是否存在
exists := gfile.Exists("/path/to/file")

// 创建目录
err := gfile.Mkdir("/path/to/dir")

// 读取文件
content, err := gfile.GetContents("/path/to/file")

// 写入文件
err := gfile.PutContents("/path/to/file", "content")
```

## 4. 认证系统集成

### 4.1 JWT认证

GoFly提供了完整的JWT认证实现：

```go
// 引入认证模块
import "gofly-admin-v3/internal/auth"

// JWT配置
jwtConfig := auth.JWTConfig{
    SecretKey:     "your-secret-key",
    ExpiresIn:     2 * time.Hour,  // 访问令牌2小时
    RefreshExpire: 7 * 24 * time.Hour,  // 刷新令牌7天
    Issuer:       "autoads-saas",
}

// 创建认证中间件
authMiddleware := auth.NewJWTMiddleware(jwtConfig)

// 使用中间件
router.Use(authMiddleware.Authenticate())

// 获取当前用户
user := auth.GetCurrentUser(c)
tenantID := auth.GetCurrentTenantID(c)
```

### 4.2 SaaS适配

需要对GoFly的认证系统进行SaaS适配：

```go
// 扩展JWT Claims，增加租户信息
type SaaSJWTClaims struct {
    UserID   string `json:"user_id"`
    TenantID string `json:"tenant_id"`
    Role     string `json:"role"`
    auth.StandardClaims
}

// 租户验证中间件
func TenantMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        tenantID := auth.GetCurrentTenantID(c)
        
        // 验证租户状态
        tenant, err := GetTenant(tenantID)
        if err != nil || tenant.Status != 1 {
            c.AbortWithStatusJSON(403, gin.H{
                "code":    403,
                "message": "Tenant is disabled",
            })
            return
        }
        
        // 验证订阅状态
        if !CheckSubscriptionActive(tenantID) {
            c.AbortWithStatusJSON(403, gin.H{
                "code":    403,
                "message": "Subscription expired",
            })
            return
        }
        
        c.Next()
    }
}
```

## 5. 数据库集成

### 5.1 GORM集成

GoFly使用GORM作为ORM框架：

```go
// 引入GORM
import "gofly-admin-v3/utils/gform"

// 数据库连接
db := gform.Instance()

// 定义模型
type BatchTask struct {
    gform.Model
    TenantID  string `gorm:"type:varchar(36);not null;index"`
    UserID    string `gorm:"type:varchar(36);not null;index"`
    Name      string `gorm:"type:varchar(100);not null"`
    Status    string `gorm:"type:varchar(20);default:'pending'"`
    // 其他字段...
}

// 自动CRUD操作
// 创建
task := BatchTask{
    TenantID: tenantID,
    UserID:   userID,
    Name:     "New Task",
}
result := db.Create(&task)

// 查询
var tasks []BatchTask
result := db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).Find(&tasks)

// 更新
result := db.Model(&task).Where("id = ?", taskID).Updates(map[string]interface{}{
    "status": "completed",
})

// 删除（软删除）
result := db.Delete(&task)
```

### 5.2 数据库迁移

GoFly支持自动数据库迁移：

```go
// 自动迁移表结构
err := db.AutoMigrate(
    &Tenant{},
    &SaaSUser{},
    &UserSubscription{},
    &UserToken{},
    &Invitation{},
    &CheckinRecord{},
    &BatchTask{},
    &SiteRankQuery{},
    &AdsAccount{},
)
```

## 6. 日志系统集成

### 6.1 结构化日志

```go
// 引入日志
import "gofly-admin-v3/utils/tools/glog"

// 记录日志
glog.Info(c, "user_login", gform.Map{
    "user_id":   userID,
    "tenant_id": tenantID,
    "ip":        c.ClientIP(),
    "user_agent": c.Request.UserAgent(),
})

// 错误日志
glog.Error(c, "token_consume_failed", gform.Map{
    "user_id":     userID,
    "amount":      amount,
    "error":       err.Error(),
    "stack_trace": string(debug.Stack()),
})

// 带上下文的日志
ctx := glog.WithContext(c)
ctx.Info("processing_task", gform.Map{
    "task_id": taskID,
    "status":  "started",
})
```

### 6.2 日志配置

```go
// 日志配置
logConfig := glog.Config{
    Level:      "info",
    Format:     "json",
    Output:     []string{"stdout", "file"},
    Filename:   "logs/autoads.log",
    MaxSize:    100,  // MB
    MaxBackups: 10,
    MaxAge:     30,   // days
    Compress:   true,
}

// 初始化日志
glog.Init(logConfig)
```

## 7. 监控系统集成

### 7.1 性能监控

```go
// 引入监控
import "gofly-admin-v3/internal/metrics"

// 性能监控中间件
router.Use(metrics.PrometheusMiddleware())

// 自定义指标
counter := metrics.NewCounter(
    "token_consume_total",
    "Total token consumption",
    []string{"tenant_id", "user_id"},
)

histogram := metrics.NewHistogram(
    "api_request_duration_seconds",
    "API request duration",
    []string{"method", "endpoint"},
)

// 在API中使用
counter.WithLabelValues(tenantID, userID).Inc()
histogram.WithLabelValues(c.Request.Method, c.FullPath).Observe(duration)
```

### 7.2 健康检查

```go
// 健康检查接口
router.GET("/health", func(c *gin.Context) {
    // 检查数据库
    if err := db.DB.Exec("SELECT 1").Error; err != nil {
        c.JSON(500, gin.H{"status": "unhealthy", "reason": "database"})
        return
    }
    
    // 检查Redis
    if err := cache.Ping(); err != nil {
        c.JSON(500, gin.H{"status": "unhealthy", "reason": "redis"})
        return
    }
    
    c.JSON(200, gin.H{
        "status": "healthy",
        "timestamp": time.Now(),
        "version": "1.0.0",
    })
})
```

## 8. 最佳实践

### 8.1 错误处理

```go
// 统一错误处理
func ErrorHandler() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()
        
        // 获取第一个错误
        err := c.Errors.Last()
        if err != nil {
            // 记录错误日志
            glog.Error(c, "api_error", gform.Map{
                "error": err.Error(),
                "path":  c.Request.URL.Path,
            })
            
            // 返回统一错误格式
            c.JSON(200, gin.H{
                "code":    1000,
                "message": err.Error(),
                "data":    nil,
            })
        }
    }
}
```

### 8.2 响应格式

```go
// 统一响应格式
type Response struct {
    Code       int         `json:"code"`
    Message    string      `json:"message"`
    Data       interface{} `json:"data,omitempty"`
    Pagination interface{} `json:"pagination,omitempty"`
}

// 成功响应
func Success(c *gin.Context, data interface{}) {
    c.JSON(200, Response{
        Code:    0,
        Message: "成功",
        Data:    data,
    })
}

// 分页响应
func SuccessWithPagination(c *gin.Context, data interface{}, pagination interface{}) {
    c.JSON(200, Response{
        Code:       0,
        Message:    "成功",
        Data:       data,
        Pagination: pagination,
    })
}

// 错误响应
func Error(c *gin.Context, code int, message string) {
    c.JSON(200, Response{
        Code:    code,
        Message: message,
    })
}
```

### 8.3 中间件链

```go
// 推荐的中间件顺序
router.Use(middleware.Logger())          // 日志记录
router.Use(middleware.Recovery())       // 异常恢复
router.Use(middleware.CORS())           // 跨域处理
router.Use(middleware.RateLimit())      // 限流控制
router.Use(authMiddleware.Authenticate()) // 认证验证
router.Use(TenantMiddleware())           // 租户验证
router.Use(PermissionMiddleware())       // 权限验证
```

## 9. 集成检查清单

### 9.1 基础组件集成
- [ ] 数据库连接配置
- [ ] Redis缓存配置
- [ ] JWT认证集成
- [ ] 日志系统配置
- [ ] 监控系统集成

### 9.2 业务功能集成
- [ ] CRUD生成器配置
- [ ] 定时任务配置
- [ ] Excel导出集成
- [ ] 数据验证集成
- [ ] 工具库引用

### 9.3 SaaS适配
- [ ] 租户模型创建
- [ ] 多租户数据隔离
- [ ] SaaS认证适配
- [ ] 订阅系统集成
- [ ] 权限系统适配

通过以上集成，可以最大化复用GoFly框架的功能，显著提升开发效率，保证系统质量。