# AutoAds BatchGo系统文档

## 概述

AutoAds BatchGo系统是一个强大的批量URL处理系统，支持三种不同的执行模式，提供完整的任务管理、进度跟踪和Token计费功能。系统完全兼容旧版API，确保前端无需修改即可使用。

## 核心特性

### 1. 三种执行模式
- **Basic模式**: 通过WebSocket通知前端执行window.open操作
- **Silent模式**: 后端并发处理URL，支持代理轮询和重试机制
- **AutoClick模式**: 定时任务调度，支持智能时间分配

### 2. 完整的任务管理
- **任务创建**: 支持批量URL和自定义配置
- **状态跟踪**: 实时监控任务执行状态
- **进度通知**: WebSocket实时推送执行进度
- **结果查询**: 详细的执行结果和统计信息

### 3. Token集成计费
- **Smart计费**: 根据模式和URL数量自动计算Token消费
- **预检查**: 执行前验证Token余额
- **实时消费**: 任务启动时立即消费Token

### 4. API完全兼容
- **新版API**: RESTful风格的现代API
- **旧版兼容**: 保持所有现有API路径不变
- **无缝迁移**: 前端无需任何修改

## 执行模式详解

### Basic模式
**用途**: 需要用户交互或特殊浏览器环境的场景

**工作流程**:
1. 创建任务并配置参数
2. 启动任务后通过WebSocket发送指令给前端
3. 前端接收指令执行window.open操作
4. 支持顺序执行和延迟控制

**Token消费**: 1 Token/URL

**配置参数**:
```json
{
  "basic": {
    "delay": 1000,        // 延迟时间（毫秒）
    "new_window": true,   // 是否新窗口打开
    "sequential": false   // 是否顺序执行
  }
}
```

### Silent模式
**用途**: 后端批量处理，无需用户交互

**工作流程**:
1. 创建任务并配置并发参数
2. 后端启动工作池并发处理URL
3. 支持代理轮询、重试机制和自定义头部
4. 实时更新进度和结果

**Token消费**: 1 Token/URL

**配置参数**:
```json
{
  "silent": {
    "concurrency": 5,           // 并发数
    "timeout": 30,              // 超时时间（秒）
    "retry_count": 3,           // 重试次数
    "use_proxy": false,         // 是否使用代理
    "proxy_rotation": false,    // 代理轮询
    "user_agent": "...",        // User Agent
    "headers": {...}            // 自定义头部
  }
}
```

### AutoClick模式
**用途**: 定时任务调度，智能时间分配

**工作流程**:
1. 创建任务并配置时间参数
2. 系统计算下次执行时间
3. 支持工作日限制和随机延迟
4. 定时触发任务执行

**Token消费**: 2 Token/URL（使用Puppeteer模式计费）

**配置参数**:
```json
{
  "autoclick": {
    "start_time": "09:00",      // 开始时间
    "end_time": "18:00",        // 结束时间
    "interval": 60,             // 间隔时间（分钟）
    "random_delay": true,       // 随机延迟
    "max_random_delay": 30,     // 最大随机延迟（分钟）
    "work_days": [1,2,3,4,5]    // 工作日（0-6，0为周日）
  }
}
```

## API接口

### 新版API (推荐)

#### 创建任务
```http
POST /api/v1/batchgo/tasks
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "批处理任务",
  "mode": "silent",
  "urls": [
    "https://example.com",
    "https://google.com"
  ],
  "config": {
    "silent": {
      "concurrency": 5,
      "timeout": 30,
      "retry_count": 3
    }
  }
}
```

#### 启动任务
```http
POST /api/v1/batchgo/tasks/{task_id}/start
Authorization: Bearer <jwt_token>
```

#### 获取任务详情
```http
GET /api/v1/batchgo/tasks/{task_id}
Authorization: Bearer <jwt_token>
```

#### 获取任务结果
```http
GET /api/v1/batchgo/tasks/{task_id}/result
Authorization: Bearer <jwt_token>
```

#### 获取任务列表
```http
GET /api/v1/batchgo/tasks?page=1&size=20
Authorization: Bearer <jwt_token>
```

### 兼容旧版API

#### Silent模式启动
```http
POST /api/batchopen/silent-start
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "urls": ["https://example.com"],
  "concurrency": 5,
  "timeout": 30,
  "retry_count": 3,
  "use_proxy": false
}
```

#### Basic模式启动
```http
POST /api/batchopen/basic-start
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "urls": ["https://example.com"],
  "delay": 1000,
  "new_window": true,
  "sequential": false
}
```

#### AutoClick模式启动
```http
POST /api/batchopen/autoclick-start
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "urls": ["https://example.com"],
  "start_time": "09:00",
  "end_time": "18:00",
  "interval": 60,
  "work_days": [1,2,3,4,5]
}
```

## 数据模型

### BatchTask 任务模型
```go
type BatchTask struct {
    ID             string          // 任务ID
    UserID         string          // 用户ID
    Name           string          // 任务名称
    Mode           BatchTaskMode   // 执行模式
    Status         BatchTaskStatus // 任务状态
    URLs           json.RawMessage // URL列表
    URLCount       int             // URL总数
    Config         json.RawMessage // 任务配置
    ProcessedCount int             // 已处理数量
    SuccessCount   int             // 成功数量
    FailedCount    int             // 失败数量
    TokenCost      int             // Token消费
    TokenConsumed  int             // 已消费Token
    StartTime      *time.Time      // 开始时间
    EndTime        *time.Time      // 结束时间
    ScheduledTime  *time.Time      // 计划执行时间
    ErrorMessage   string          // 错误信息
    CreatedAt      time.Time       // 创建时间
    UpdatedAt      time.Time       // 更新时间
}
```

### 任务状态
- `pending`: 等待中
- `running`: 运行中
- `completed`: 已完成
- `failed`: 失败
- `cancelled`: 已取消
- `paused`: 已暂停

## WebSocket通信

### Basic模式消息格式
```json
{
  "type": "batch_task_start",
  "task_id": "task_123",
  "mode": "basic",
  "urls": [
    {
      "url": "https://example.com",
      "status": "pending"
    }
  ],
  "config": {
    "delay": 1000,
    "new_window": true,
    "sequential": false
  }
}
```

### 进度通知消息格式
```json
{
  "type": "batch_progress",
  "task_id": "task_123",
  "processed": 5,
  "total": 10,
  "percentage": 50.0
}
```

## Token计费规则

### 消费标准
| 模式 | Token消费 | 说明 |
|------|-----------|------|
| Basic | 1 Token/URL | 前端执行，资源消耗较少 |
| Silent | 1 Token/URL | 后端HTTP请求 |
| AutoClick | 2 Token/URL | 使用Puppeteer，资源消耗较大 |

### 计费流程
1. **创建任务时**: 预估Token消费，检查余额
2. **启动任务时**: 立即消费Token
3. **任务失败时**: 不退还Token（已消耗资源）

## 并发控制

### Silent模式并发策略
- **工作池模式**: 固定数量的工作协程
- **任务队列**: 通过channel分发任务
- **结果收集**: 统一收集处理结果
- **进度更新**: 实时更新任务进度

### 性能优化
- **连接复用**: HTTP客户端连接池
- **超时控制**: 防止长时间阻塞
- **重试机制**: 指数退避重试策略
- **内存管理**: 及时释放资源

## 错误处理

### 常见错误类型
- `invalid_request`: 请求参数错误
- `insufficient_tokens`: Token余额不足
- `task_not_found`: 任务不存在
- `invalid_status`: 任务状态不允许操作
- `execution_failed`: 任务执行失败

### 错误恢复
- **重试机制**: 自动重试失败的URL
- **部分成功**: 记录成功和失败的URL
- **错误日志**: 详细的错误信息记录

## 监控和统计

### 任务统计
- **执行时长**: 任务开始到结束的时间
- **成功率**: 成功URL数量占比
- **平均响应时间**: URL处理的平均时间
- **Token效率**: 每Token处理的URL数量

### 性能指标
- **并发处理能力**: 同时处理的URL数量
- **吞吐量**: 每秒处理的URL数量
- **错误率**: 失败URL的占比
- **资源使用率**: CPU和内存使用情况

## 最佳实践

### 1. 任务配置
- **合理并发**: Silent模式并发数建议5-10
- **适当超时**: 根据目标网站响应时间设置
- **重试策略**: 建议重试2-3次
- **批次大小**: 单次任务URL数量建议不超过1000

### 2. 错误处理
- **预检查**: 启动前验证URL格式和Token余额
- **监控进度**: 实时监控任务执行状态
- **日志记录**: 记录详细的执行日志
- **异常恢复**: 处理网络异常和超时情况

### 3. 性能优化
- **批量处理**: 合并小任务减少开销
- **缓存策略**: 缓存常用的配置和结果
- **资源管理**: 及时释放不用的资源
- **负载均衡**: 分散高并发任务的执行时间

### 4. 用户体验
- **实时反馈**: 通过WebSocket提供实时进度
- **清晰状态**: 明确的任务状态和错误信息
- **历史记录**: 保存任务历史便于查看
- **快速响应**: 优化API响应时间

## 扩展功能

### 1. 高级调度
- **优先级队列**: 支持任务优先级
- **资源限制**: 基于用户套餐的并发限制
- **负载均衡**: 智能分配任务到不同节点

### 2. 结果处理
- **数据提取**: 从响应中提取特定数据
- **结果过滤**: 基于条件过滤结果
- **数据导出**: 支持多种格式的结果导出

### 3. 集成扩展
- **代理池**: 集成代理服务提供商
- **浏览器池**: 管理Puppeteer浏览器实例
- **通知系统**: 任务完成后的多渠道通知

### 4. 安全增强
- **访问控制**: 基于域名的访问限制
- **频率限制**: 防止对目标网站的过度请求
- **审计日志**: 完整的操作审计记录