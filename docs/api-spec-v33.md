## 5. API设计规范

### 5.1 路由设计原则

基于GoFly框架的自动路由特性，采用以下规范：

```
/app/
├── business/           # 业务模块
│   ├── user/          # 用户相关
│   │   ├── Account/
│   │   ├── Auth/
│   │   └── Subscription/
│   ├── batchgo/       # BatchGo模块
│   ├── siterankgo/    # SiteRankGo模块
│   ├── adscentergo/   # AdsCenterGo模块
│   └── payment/       # 支付相关
└── admin/             # 管理后台模块
    ├── system/        # 系统管理
    ├── user/          # 用户管理
    └── dashboard/     # 仪表板
```

### 5.2 自动路由规则

GoFly自动将控制器方法转换为路由：

- `GetList` → `GET /business/user/account/getlist`
- `Create` → `POST /business/user/account/create`
- `Update` → `PUT /business/user/account/update`
- `Delete` → `DELETE /business/user/account/delete`

### 5.3 API版本管理

通过URL前缀实现版本控制：

- v1 API: `/api/v1/...`
- 未来版本: `/api/v2/...`

### 5.4 统一响应格式

```go
type Response struct {
    Code    int         `json:"code"`    // 状态码：200成功，其他失败
    Message string      `json:"message"` // 提示信息
    Data    interface{} `json:"data"`    // 数据
    Success bool        `json:"success"` // 是否成功
}
```

### 5.5 API路由映射表

| 功能模块 | 控制器路径 | HTTP方法 | 路由 | 说明 |
|---------|-----------|---------|------|------|
| **用户认证** | /app/business/user/Auth/ | POST | /api/v1/business/user/auth/login | 用户登录 |
| | | POST | /api/v1/business/user/auth/register | 用户注册 |
| | | POST | /api/v1/business/user/auth/google | Google登录 |
| | | POST | /api/v1/business/user/auth/logout | 退出登录 |
| **用户管理** | /app/business/user/Account/ | GET | /api/v1/business/user/account/info | 获取用户信息 |
| | | PUT | /api/v1/business/user/account/update | 更新用户信息 |
| **BatchGo任务** | /app/business/batchgo/Task/ | GET | /api/v1/business/batchgo/task/list | 任务列表 |
| | | POST | /api/v1/business/batchgo/task/create | 创建任务 |
| | | GET | /api/v1/business/batchgo/task/detail | 任务详情 |
| | | PUT | /api/v1/business/batchgo/task/start | 启动任务 |
| | | PUT | /api/v1/business/batchgo/task/stop | 停止任务 |
| **SiteRankGo** | /app/business/siterankgo/Query/ | POST | /api/v1/business/siterankgo/query/batch | 批量查询 |
| | | GET | /api/v1/business/siterankgo/query/history | 查询历史 |
| **AdsCenterGo** | /app/business/adscentergo/Account/ | GET | /api/v1/business/adscentergo/account/list | 账号列表 |
| | | POST | /api/v1/business/adscentergo/account/create | 添加账号 |
| | | GET | /api/v1/business/adscentergo/task/list | 任务列表 |
| **Token管理** | /app/business/user/Token/ | GET | /api/v1/business/user/token/balance | 余额查询 |
| | | GET | /api/v1/business/user/token/transactions | 交易记录 |
| **管理员认证** | /app/admin/system/Auth/ | POST | /admin/login | 管理员登录 |
| | | POST | /admin/logout | 管理员退出 |
| **管理员用户管理** | /app/admin/user/User/ | GET | /admin/user/user/list | 用户列表 |
| | | PUT | /admin/user/user/update-status | 更新用户状态 |
| | | PUT | /admin/user/user/reset-password | 重置密码 |
| **系统配置** | /app/admin/system/Config/ | GET | /admin/system/config/list | 配置列表 |
| | | PUT | /admin/system/config/update | 更新配置 |

### 5.6 WebSocket端点

基于GoFly WebSocket封装：

```go
// 任务进度推送
ws://autoads.dev/ws/business/batchgo/task/{task_id}/progress

// 系统通知
ws://autoads.dev/ws/business/user/notifications

// 管理员实时监控
ws://autoads.dev/ws/admin/dashboard/stats
```

### 5.7 API限流策略

基于Redis的滑动窗口限流：

```
限流键格式：rate_limit:{user_id}:{api_path}:{time_unit}
```

不同套餐的限流配置：
- Free: 100次/小时
- Pro: 1000次/小时
- Max: 10000次/小时

### 5.8 错误码规范

```go
const (
    Success          = 200
    InvalidParams    = 400
    Unauthorized     = 401
    Forbidden        = 403
    NotFound         = 404
    TooManyRequests  = 429
    InternalError    = 500
    
    // 业务错误码
    UserNotFound     = 1001
    PasswordError    = 1002
    TokenInsufficient = 1003
    PlanExpired      = 1004
)
```

### 5.9 中间件链

```go
// 请求处理中间件链
Router.Use(middleware.CORS())
Router.Use(middleware.RateLimit())
Router.Use(middleware.Auth())
Router.Use(middleware.Logger())
Router.Use(middleware.Recover())
```