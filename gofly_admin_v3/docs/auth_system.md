# AutoAds SaaS 认证系统文档

## 概述

AutoAds SaaS 认证系统基于 JWT (JSON Web Token) 实现，支持传统邮箱密码登录和 Google OAuth 登录，提供完整的用户认证、授权和数据隔离功能。

## 核心特性

### 1. 统一认证处理器
- **JWT Token 管理**: 生成、验证、刷新 JWT 令牌
- **多种登录方式**: 支持邮箱密码和 Google OAuth
- **用户会话管理**: 自动处理用户登录状态

### 2. Google OAuth 集成
- **一键登录**: 支持 Google 账号快速登录注册
- **账号绑定**: 自动绑定 Google 账号到现有用户
- **邮箱验证**: Google 登录用户自动验证邮箱

### 3. 认证中间件
- **RequireAuth**: 强制用户认证
- **OptionalAuth**: 可选用户认证
- **RequireRole**: 基于角色的访问控制
- **RequirePlan**: 基于套餐的功能限制
- **DataIsolation**: 用户数据隔离

### 4. 数据隔离机制
- **用户级隔离**: 确保用户只能访问自己的数据
- **管理员例外**: 管理员可以访问所有数据
- **URL 参数检查**: 自动验证 URL 中的 user_id 参数

## API 接口

### 认证接口

#### 用户注册
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "username": "username",
  "invite_code": "INV123456" // 可选
}
```

#### 用户登录
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Google 登录
```http
POST /api/v1/auth/google-login
Content-Type: application/json

{
  "id_token": "google_id_token_here"
}
```

#### 获取用户信息
```http
GET /api/v1/auth/profile
Authorization: Bearer <jwt_token>
```

#### 刷新令牌
```http
POST /api/v1/auth/refresh
Authorization: Bearer <jwt_token>
```

### 响应格式

#### 登录成功响应
```json
{
  "token": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "expires_at": "2025-09-13T13:48:00Z"
  },
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "username": "username",
    "role": "user",
    "plan_name": "free",
    "token_balance": 100,
    "email_verified": true
  },
  "is_new_user": false
}
```

## 中间件使用

### 基本认证
```go
// 需要登录的路由
protected := router.Group("/api/v1/protected")
protected.Use(middleware.RequireAuth())
{
    protected.GET("/data", handler)
}
```

### 角色控制
```go
// 只有管理员可以访问
admin := router.Group("/api/v1/admin")
admin.Use(middleware.RequireRole("admin"))
{
    admin.GET("/users", handler)
}
```

### 套餐限制
```go
// 需要 Pro 或 Max 套餐
pro := router.Group("/api/v1/pro")
pro.Use(middleware.RequirePlan("pro", "max"))
{
    pro.GET("/features", handler)
}
```

### 数据隔离
```go
// 用户只能访问自己的数据
userData := router.Group("/api/v1/users/:user_id")
userData.Use(middleware.DataIsolation())
{
    userData.GET("/data", handler)
}
```

## JWT Token 结构

### Claims 内容
```json
{
  "user_id": "user-uuid",
  "email": "user@example.com",
  "role": "user",
  "plan_name": "free",
  "iss": "autoads-saas",
  "iat": 1694520000,
  "exp": 1694606400,
  "nbf": 1694520000
}
```

### Token 配置
- **过期时间**: 24 小时
- **刷新期**: 7 天
- **签名算法**: HS256
- **密钥**: 可配置

## 安全特性

### 1. 密码安全
- **bcrypt 加密**: 使用 bcrypt 算法加密存储密码
- **盐值随机**: 每个密码使用不同的盐值
- **强度要求**: 最少 6 位密码

### 2. Token 安全
- **HMAC 签名**: 使用 HMAC-SHA256 签名
- **过期控制**: 自动过期和刷新机制
- **Bearer 认证**: 标准的 Bearer Token 格式

### 3. 数据隔离
- **用户级隔离**: 严格的用户数据隔离
- **参数验证**: 自动验证 URL 参数
- **管理员权限**: 管理员可以跨用户访问

### 4. Google OAuth 安全
- **ID Token 验证**: 验证 Google ID Token
- **邮箱验证**: 自动验证 Google 邮箱
- **账号绑定**: 安全的账号绑定机制

## 错误处理

### 认证错误码
- `INVALID_CREDENTIALS`: 无效的登录凭据
- `USER_NOT_FOUND`: 用户不存在
- `USER_DISABLED`: 用户账号被禁用
- `TOKEN_EXPIRED`: Token 已过期
- `TOKEN_INVALID`: 无效的 Token
- `INSUFFICIENT_PERMISSIONS`: 权限不足

### HTTP 状态码
- `200`: 成功
- `201`: 创建成功
- `400`: 请求参数错误
- `401`: 未认证
- `403`: 权限不足
- `409`: 资源冲突（如邮箱已存在）
- `422`: 需要付费套餐

## 配置说明

### JWT 配置
```go
type JWTConfig struct {
    SecretKey     string // JWT 签名密钥
    ExpireHours   int    // Token 过期时间（小时）
    RefreshHours  int    // 刷新期限（小时）
    Issuer        string // 签发者
}
```

### Google OAuth 配置
```go
type GoogleOAuthConfig struct {
    ClientID     string   // Google Client ID
    ClientSecret string   // Google Client Secret
    RedirectURL  string   // 回调 URL
    Scopes       []string // 权限范围
}
```

## 最佳实践

### 1. Token 管理
- 在客户端安全存储 Token
- 实现自动刷新机制
- 登出时清除 Token

### 2. 错误处理
- 统一的错误响应格式
- 详细的错误日志记录
- 用户友好的错误信息

### 3. 安全建议
- 使用 HTTPS 传输
- 定期更新 JWT 密钥
- 监控异常登录行为
- 实施账号锁定机制

## 扩展功能

### 1. 多因素认证 (MFA)
- 短信验证码
- 邮箱验证码
- TOTP 应用

### 2. 社交登录
- GitHub OAuth
- 微信登录
- 企业微信登录

### 3. 会话管理
- 设备管理
- 会话列表
- 远程登出

### 4. 审计日志
- 登录日志
- 操作日志
- 安全事件记录