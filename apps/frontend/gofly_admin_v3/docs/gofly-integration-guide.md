# GoFly框架深度集成指南

## 概述

本文档说明如何将AutoAds项目从当前的Gin+GORM架构深度集成到GoFly框架，充分利用GoFly的企业级能力。

## 主要集成点

### 1. ORM层替换（GORM → GoFly Model）

**当前代码**（使用GORM）：
```go
// internal/user/model.go
type User struct {
    ID        string    `json:"id" gorm:"primaryKey"`
    Email     string    `json:"email" gorm:"unique;not null"`
    CreatedAt time.Time `json:"created_at"`
}

func (s *Service) GetUserByEmail(email string) (*User, error) {
    var user User
    if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
        return nil, err
    }
    return &user, nil
}
```

**集成后**（使用GoFly Model）：
```go
// internal/user/model.go
type User struct {
    ID        string    `json:"id" gform:"primary"`
    Email     string    `json:"email" gform:"unique;required"`
    CreatedAt time.Time `json:"created_at" gform:"auto_time"`
}

func (s *Service) GetUserByEmail(email string) (*User, error) {
    var user User
    if err := s.db.Model(&User{}).Where("email = ?", email).Find(&user); err != nil {
        return nil, err
    }
    return &user, nil
}
```

### 2. 路由系统改造（手动注册 → 自动路由）

**当前代码**（手动注册）：
```go
// internal/app/routes.go
func SetupRoutes(router *gin.Engine, ctx *Context) {
    userGroup := v1.Group("/user")
    {
        userGroup.POST("/register", func(c *gin.Context) {
            // 手动处理
        })
    }
}
```

**集成后**（自动路由）：
```go
// internal/user/controller.go
type UserController struct{}

// @Summary 用户注册
// @Tags 用户管理
// @Router /api/v1/user/register [post]
func (c *UserController) Register(ctx *gf.GinCtx) {
    // 自动路由注册
    var req UserRegisterRequest
    if err := ctx.ShouldBind(&req); err != nil {
        ctx.Error(err)
        return
    }
    
    // 业务逻辑
}

// main.go
func main() {
    // 自动注册所有控制器
    gf.AutoRegisterControllers()
    
    // 启动服务
    gf.Run()
}
```

### 3. 缓存系统集成（直接Redis → GoFly Cache）

**当前代码**：
```go
// 直接使用Redis
func (s *Service) GetWithCache(key string) (interface{}, error) {
    val, err := s.redis.Get(key).Result()
    if err == redis.Nil {
        // 从数据库获取
    }
    return val, nil
}
```

**集成后**：
```go
// 使用GoFly多级缓存
func (s *Service) GetWithCache(key string) (interface{}, error) {
    // L1: 内存缓存
    if val := gcache.Get(key); val != nil {
        return val, nil
    }
    
    // L2: Redis缓存
    if val, err := gcache.Redis().Get(key); err == nil {
        // 自动回填内存缓存
        gcache.Set(key, val, time.Minute*5)
        return val, nil
    }
    
    // 从数据库获取并缓存
    val, err := s.loadFromDB(key)
    if err == nil {
        gcache.Set(key, val, time.Hour)
    }
    return val, nil
}
```

### 4. 验证框架集成

**当前代码**（手动验证）：
```go
func Register(c *gin.Context) {
    var req RegisterRequest
    if err := c.ShouldBind(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
}
```

**集成后**（GoFly验证）：
```go
type RegisterRequest struct {
    Email    string `v:"required|email#请输入邮箱|邮箱格式不正确"`
    Password string `v:"required|length:6,20#请输入密码|密码长度6-20位"`
}

func (c *UserController) Register(ctx *gf.GinCtx) {
    var req RegisterRequest
    
    // 自动验证，支持多语言错误信息
    if err := ctx.ShouldBind(&req); err != nil {
        ctx.Error(err)
        return
    }
    
    // 验证通过，继续业务逻辑
}
```

## 实施步骤

### 第一阶段：基础架构调整
1. 更新go.mod，添加GoFly依赖
2. 创建GoFly配置文件
3. 重构数据层，替换GORM为GoFly Model
4. 实现基础的数据库连接和模型定义

### 第二阶段：路由系统改造
1. 创建基础控制器结构
2. 实现自动路由注册
3. 添加Swagger文档支持
4. 迁移现有路由到新的控制器结构

### 第三阶段：缓存和优化
1. 实现多级缓存策略
2. 添加性能监控
3. 实现日志追踪
4. 优化数据库查询

### 第四阶段：功能完善
1. 完善业务逻辑
2. 添加单元测试
3. 性能测试
4. 部署和监控

## 配置示例

### GoFly配置文件 (config.yaml)
```yaml
# 数据库配置
database:
  type: mysql
  host: localhost
  port: 3306
  username: root
  password: password
  database: autoads
  pool:
    max_idle: 10
    max_open: 100
    max_lifetime: 3600

# Redis配置
redis:
  host: localhost
  port: 6379
  password: ""
  db: 0
  pool:
    max_idle: 10
    max_open: 100

# 应用配置
app:
  name: autoads
  debug: true
  port: 8080
  
# 日志配置
log:
  level: info
  format: json
  output: stdout
  
# 缓存配置
cache:
  default_expire: 3600
  memory_size: 1000
  redis_prefix: autoads:
```

### 主程序入口 (main.go)
```go
package main

import (
    "gofly"
    "gofly_admin_v3/internal/app"
)

func main() {
    // 初始化GoFly框架
    gf.Init()
    
    // 加载配置
    cfg := app.LoadConfig()
    
    // 初始化应用上下文
    ctx, err := app.NewContext(cfg)
    if err != nil {
        gf.Fatal("Failed to initialize application:", err)
    }
    
    // 自动注册所有控制器
    gf.AutoRegisterControllers()
    
    // 设置中间件
    gf.Use(middleware.CORS())
    gf.Use(middleware.Logger())
    gf.Use(middleware.Recovery())
    
    // 启动服务
    gf.Run()
}
```

## 注意事项

1. **向后兼容**：确保API接口保持不变
2. **性能监控**：集成后需要进行充分的性能测试
3. **错误处理**：统一的错误处理机制
4. **日志追踪**：完整的请求链路追踪