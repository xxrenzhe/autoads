# API契约文档

**文档版本**: v1.0  
**最后更新**: 2025-09-11  
**文档状态**: 已标准化  
**API版本**: v1

## 1. API规范

### 1.1 基础规范

**请求格式**
- Content-Type: `application/json`
- 认证方式：`Authorization: Bearer <token>`（用户端）或Cookie（管理端）
- 请求大小限制：10MB

**响应格式**
```json
{
    "code": 0,           // 0表示成功，非0表示错误
    "message": "成功",    // 响应消息
    "data": {},          // 响应数据
    "pagination": {      // 分页信息（可选）
        "page": 1,
        "page_size": 20,
        "total": 100
    }
}
```

**错误码定义**
- 0: 成功
- 1001: 参数缺失
- 1002: 参数格式错误
- 1003: 参数值无效
- 2001: 资源不存在
- 2002: 权限不足
- 2003: Token余额不足
- 2004: 操作频繁
- 3001: 未登录
- 3002: Token无效
- 3003: Token过期
- 3004: 会话过期
- 5001: 系统内部错误
- 5002: 数据库错误
- 5003: 第三方服务错误

### 1.2 通用响应结构

```go
// API响应结构
type APIResponse struct {
    Code       int         `json:"code"`
    Message    string      `json:"message"`
    Data       interface{} `json:"data"`
    Pagination *Pagination `json:"pagination,omitempty"`
}

type Pagination struct {
    Page      int `json:"page"`
    PageSize  int `json:"page_size"`
    Total     int `json:"total"`
    TotalPage int `json:"total_page"`
}
```

## 2. 认证相关API

### 2.1 Google OAuth登录

```http
POST /api/auth/google
Content-Type: application/json

{
    "id_token": "google_id_token",
    "access_token": "google_access_token"
}
```

**响应**
```json
{
    "code": 0,
    "message": "登录成功",
    "data": {
        "user": {
            "id": "user123",
            "email": "user@example.com",
            "name": "张三",
            "avatar": "https://example.com/avatar.jpg",
            "role": "user",
            "plan": "pro",
            "plan_expires": "2024-12-31T23:59:59Z",
            "token_balance": 1000
        },
        "token": "jwt_token_here",
        "expires_in": 86400
    }
}
```

### 2.2 管理员登录

```http
POST /api/admin/login
Content-Type: application/json

{
    "email": "admin@example.com",
    "password": "password123"
}
```

**响应**
```json
{
    "code": 0,
    "message": "登录成功",
    "data": {
        "user": {
            "id": "admin123",
            "email": "admin@example.com",
            "name": "系统管理员",
            "role": "admin"
        }
    }
}
```

## 3. 用户相关API

### 3.1 获取用户信息

```http
GET /api/user/profile
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "id": "user123",
        "email": "user@example.com",
        "name": "张三",
        "avatar": "https://example.com/avatar.jpg",
        "role": "user",
        "plan": "pro",
        "plan_expires": "2024-12-31T23:59:59Z",
        "token_balance": 1000,
        "invite_code": "ABC12345",
        "invited_by": "inviter123",
        "created_at": "2024-01-01T00:00:00Z",
        "last_login": "2024-01-10T10:00:00Z"
    }
}
```

### 3.2 获取用户统计

```http
GET /api/user/stats
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "total_tokens_earned": 5000,
        "total_tokens_spent": 4000,
        "batch_tasks_total": 50,
        "batch_tasks_success": 45,
        "siterank_queries_total": 100,
        "invitations_total": 10,
        "invitations_accepted": 8,
        "checkin_days": 30
    }
}
```

## 4. Token相关API

### 4.1 获取Token余额

```http
GET /api/tokens/balance
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "balance": 1000,
        "updated_at": "2024-01-10T10:00:00Z"
    }
}
```

### 4.2 获取Token交易记录

```http
GET /api/tokens/transactions?page=1&page_size=20&type=consume
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "transactions": [
            {
                "id": "tx123",
                "amount": -10,
                "balance": 990,
                "type": "consume",
                "description": "BatchGo任务消费",
                "created_at": "2024-01-10T10:00:00Z"
            }
        ],
        "pagination": {
            "page": 1,
            "page_size": 20,
            "total": 100,
            "total_page": 5
        }
    }
}
```

### 4.3 购买Token

```http
POST /api/tokens/purchase
Authorization: Bearer <token>
Content-Type: application/json

{
    "package_id": "package_1000",
    "payment_method": "stripe"
}
```

**响应**
```json
{
    "code": 0,
    "message": "创建支付订单成功",
    "data": {
        "order_id": "order123",
        "amount": 9.99,
        "currency": "USD",
        "tokens": 1000,
        "payment_url": "https://stripe.com/checkout/..."
    }
}
```

## 5. BatchGo相关API

### 5.1 Silent模式

#### 启动任务
```http
POST /api/batchopen/silent-start
Authorization: Bearer <token>
Content-Type: application/json

{
    "task_id": "task_123",
    "urls": [
        "https://example1.com",
        "https://example2.com"
    ],
    "cycle_count": 3,
    "open_count": 1,
    "open_interval": 5,
    "proxy_url": "http://proxy.example.com:8080",
    "enable_concurrent_execution": true,
    "enable_randomization": false,
    "random_variation": 0.1,
    "referer_option": "social",
    "access_method": "http",
    "proxy_validated": true
}
```

**响应**
```json
{
    "code": 0,
    "message": "任务启动成功",
    "data": {
        "task_id": "task_123",
        "status": "running",
        "total_urls": 2,
        "cycle_count": 3,
        "token_consumed": 6
    }
}
```

#### 查询进度
```http
GET /api/batchopen/silent-progress?task_id=task_123
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "task_id": "task_123",
        "status": "running",
        "progress": 50.0,
        "total": 6,
        "success_count": 3,
        "fail_count": 0,
        "pending_count": 3,
        "message": "正在执行中...",
        "proxy_stats": {
            "total_proxies": 10,
            "success_proxies": 8,
            "fail_proxies": 2
        },
        "error_summary": null,
        "start_time": "2024-01-10T10:00:00Z",
        "end_time": null
    }
}
```

#### 终止任务
```http
POST /api/batchopen/silent-terminate
Authorization: Bearer <token>
Content-Type: application/json

{
    "task_id": "task_123"
}
```

**响应**
```json
{
    "code": 0,
    "message": "任务已终止",
    "data": {
        "task_id": "task_123",
        "status": "terminated",
        "final_stats": {
            "total": 6,
            "success": 3,
            "failed": 0,
            "pending": 3
        }
    }
}
```

### 5.2 AutoClick模式

#### 创建任务
```http
POST /api/autoclick/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
    "task_id": "autoclick_123",
    "target_url": "https://example.com",
    "daily_clicks": 100,
    "access_method": "http",
    "proxy_url": "http://proxy.example.com:8080",
    "referer_option": "search"
}
```

**响应**
```json
{
    "code": 0,
    "message": "AutoClick任务创建成功",
    "data": {
        "task_id": "autoclick_123",
        "target_url": "https://example.com",
        "daily_clicks": 100,
        "status": "scheduled",
        "schedule": "0 * * * *", // 每小时执行
        "next_execute_time": "2024-01-10T11:00:00Z"
    }
}
```

#### 任务操作
```http
POST /api/autoclick/tasks/autoclick_123/pause
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "任务已暂停",
    "data": {
        "task_id": "autoclick_123",
        "status": "paused"
    }
}
```

#### 查询进度
```http
GET /api/autoclick/tasks/autoclick_123/progress
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "task_id": "autoclick_123",
        "status": "running",
        "daily_target": 100,
        "current_progress": 45,
        "completion_rate": 45.0,
        "last_execute_time": "2024-01-10T10:30:00Z",
        "next_execute_time": "2024-01-10T11:00:00Z"
    }
}
```

## 6. SiteRank相关API

### 6.1 查询网站排名

```http
GET /api/siterank/rank?domain=example.com&type=similarweb
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "domain": "example.com",
        "global_rank": 1500,
        "category": "News and Media",
        "country": "US",
        "visits": 15.5, // 百万
        "bounce_rate": 45.2,
        "pages_per_visit": 2.8,
        "avg_duration": 185.5,
        "cached": false,
        "updated_at": "2024-01-10T10:00:00Z"
    }
}
```

### 6.2 批量查询

```http
POST /api/v1/siterankgo/traffic/batch
Authorization: Bearer <token>
Content-Type: application/json

{
    "domains": ["example1.com", "example2.com"],
    "source": "similarweb"
}
```

**响应**
```json
{
    "code": 0,
    "message": "批量查询已提交",
    "data": {
        "batch_id": "batch_123",
        "total_domains": 2,
        "status": "processing",
        "estimated_time": 30
    }
}
```

### 6.3 获取优先级

```http
POST /api/v1/siterankgo/traffic/priorities
Authorization: Bearer <token>
Content-Type: application/json

{
    "domains": ["example1.com", "example2.com"]
}
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "priorities": {
            "example1.com": "High",
            "example2.com": "Medium"
        },
        "calculated_at": "2024-01-10T10:00:00Z"
    }
}
```

## 7. 邀请相关API

### 7.1 获取邀请信息

```http
GET /api/invitation/info
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "invite_link": "https://autoads.dev/register?invite=ABC123",
        "invite_code": "ABC123",
        "stats": {
            "total_invited": 10,
            "accepted_invited": 8,
            "total_reward_days": 240,
            "pending_invited": 2
        },
        "recent_invitations": [
            {
                "invitee_email": "newuser@example.com",
                "status": "accepted",
                "created_at": "2024-01-10T10:00:00Z"
            }
        ]
    }
}
```

### 7.2 生成邀请链接

```http
POST /api/invitation/generate-link
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "生成成功",
    "data": {
        "invite_link": "https://autoads.dev/register?invite=ABC123",
        "invite_code": "ABC123"
    }
}
```

### 7.3 获取邀请历史

```http
GET /api/invitation/history?page=1&page_size=20
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "invitations": [
            {
                "id": "inv123",
                "invitee": {
                    "email": "user@example.com",
                    "name": "新用户"
                },
                "status": "accepted",
                "reward_days": 30,
                "created_at": "2024-01-10T10:00:00Z"
            }
        ],
        "pagination": {
            "page": 1,
            "page_size": 20,
            "total": 10,
            "total_page": 1
        }
    }
}
```

## 8. 签到相关API

### 8.1 获取签到信息

```http
GET /api/checkin/info
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "checked_in": false,
        "today_reward": 10,
        "month_calendar": {
            "2024-01-01": true,
            "2024-01-02": true,
            "2024-01-03": true
        },
        "total_checkins": 30
    }
}
```

### 8.2 执行签到

```http
POST /api/checkin/perform
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "签到成功",
    "data": {
        "reward": {
            "tokens": 10,
            "balance": 1010
        }
    }
}
```

### 8.3 获取签到历史

```http
GET /api/checkin/history?page=1&page_size=30
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "records": [
            {
                "checkin_date": "2024-01-10",
                "token_reward": 10,
                "created_at": "2024-01-10T10:00:00Z"
            }
        ],
        "pagination": {
            "page": 1,
            "page_size": 30,
            "total": 30,
            "total_page": 1
        }
    }
}
```

## 9. Chengelink相关API

### 9.1 获取链接状态

```http
GET /api/chengelink/status?link_id=link123
Authorization: Bearer <token>
```

**响应**
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "link_id": "link123",
        "url": "https://example.com",
        "status": "active",
        "health_score": 95,
        "last_checked": "2024-01-10T10:00:00Z",
        "next_check": "2024-01-10T11:00:00Z",
        "issues": []
    }
}
```

### 9.2 创建链接任务

```http
POST /api/chengelink/create
Authorization: Bearer <token>
Content-Type: application/json

{
    "urls": ["https://example1.com", "https://example2.com"],
    "check_interval": 3600,
    "alert_threshold": 80
}
```

**响应**
```json
{
    "code": 0,
    "message": "任务创建成功",
    "data": {
        "task_id": "task123",
        "links_count": 2,
        "token_consumed": 20,
        "next_run": "2024-01-10T11:00:00Z"
    }
}
```

## 10. WebSocket接口

### 10.1 连接认证

```javascript
// WebSocket连接
const ws = new WebSocket('wss://api.autoads.dev/ws?token=jwt_token');

// 消息格式
{
    "type": "authenticate",
    "data": {
        "token": "jwt_token"
    }
}
```

### 10.2 消息类型

#### 任务进度推送
```json
{
    "type": "task_progress",
    "data": {
        "task_id": "task123",
        "progress": 75.5,
        "status": "running",
        "message": "正在处理..."
    }
}
```

#### 系统通知
```json
{
    "type": "notification",
    "data": {
        "level": "info",
        "title": "任务完成",
        "message": "您的BatchGo任务已完成",
        "timestamp": "2024-01-10T10:00:00Z"
    }
}
```

## 11. 错误处理

### 11.1 标准错误响应

```json
{
    "code": 2001,
    "message": "资源不存在",
    "data": null,
    "error_details": {
        "resource_type": "BatchTask",
        "resource_id": "task123"
    }
}
```

### 11.2 验证错误

```json
{
    "code": 1002,
    "message": "参数格式错误",
    "data": null,
    "validation_errors": {
        "urls": ["必须至少包含一个URL"],
        "cycle_count": ["必须在1-100之间"]
    }
}
```

## 12. API版本控制

### 12.1 版本策略

- 当前版本：v1
- API路径格式：`/api/v1/{resource}`
- 向后兼容：主版本号变更时不兼容
- 废弃通知：提前30天通知API废弃

### 12.2 版本头

```http
GET /api/v1/user/profile
Accept-Version: v1
```

通过以上API契约，确保前后端交互的一致性和可靠性。