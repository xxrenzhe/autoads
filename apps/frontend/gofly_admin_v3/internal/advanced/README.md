# AutoAds SaaS 高级功能扩展系统

## 概述

AutoAds SaaS 高级功能扩展系统充分利用 GoFly 框架的成熟功能，构建了一个企业级的 SaaS 平台功能生态。系统包含以下核心组件：

## 核心组件

### 1. 插件系统 (Plugin System)
- **文件**: `plugin_system.go`
- **功能**: 
  - 支持第三方集成插件
  - 功能扩展机制
  - 事件总线
  - 插件生命周期管理
- **内置插件**:
  - Token消费监控插件
  - 任务监控插件

### 2. 增强限流系统 (Enhanced Rate Limiting)
- **文件**: `enhanced_ratelimit.go`
- **功能**:
  - 基于套餐的精细化限流
  - 用户使用分析
  - 热更新配置
  - 自适应速率限制
  - 使用模式分析

### 3. 统一通知系统 (Unified Notification System)
- **文件**: `notification_system.go`
- **功能**:
  - 邮件通知
  - 系统消息
  - WebSocket实时通知
  - 通知模板管理
  - 通知规则引擎

### 4. 高级安全系统 (Advanced Security System)
- **文件**: `security_system.go`
- **功能**:
  - 操作审计
  - 异常检测
  - 安全报告生成
  - 威胁分析
  - 用户行为模式分析

### 5. 工具集成系统 (Tools Integration)
- **文件**: `tools_integration.go`
- **功能**:
  - 充分利用GoFly的50+工具模块
  - 数据处理工具
  - 文件处理工具
  - 通信工具
  - 安全工具
  - 验证工具
  - 国际化工具

### 6. 高级功能管理器 (Advanced Features Manager)
- **文件**: `advanced_manager.go`
- **功能**:
  - 统一管理所有高级功能
  - 系统间集成
  - 状态监控
  - 中间件支持

## 使用方法

### 启动高级功能服务器

```bash
cd gofly_admin_v3/cmd/autoads-saas
go run main_advanced.go
```

### API 接口

#### 1. 系统状态查询
```http
GET /api/v1/advanced/status
```

#### 2. 插件管理
```http
GET /api/v1/advanced/plugins/list
POST /api/v1/advanced/plugins/{name}/enable
POST /api/v1/advanced/plugins/{name}/disable
```

#### 3. 速率限制管理
```http
GET /api/v1/advanced/rate-limit/usage-pattern/{userID}/{feature}
POST /api/v1/advanced/rate-limit/config/{plan}/{feature}
```

#### 4. 通知系统
```http
POST /api/v1/advanced/notifications/send
POST /api/v1/advanced/notifications/send-template
GET /api/v1/advanced/notifications/templates
```

#### 5. 安全系统
```http
POST /api/v1/advanced/security/analyze
GET /api/v1/advanced/security/behavior-pattern/{userID}
POST /api/v1/advanced/security/reports/generate
```

#### 6. 工具集成
```http
GET /api/v1/advanced/tools/list
POST /api/v1/advanced/tools/execute/{toolName}
POST /api/v1/advanced/tools/batch-execute
```

### 演示接口

#### Token消费演示
```http
POST /api/v1/demo/consume-token
Content-Type: application/json

{
  "user_id": "user123",
  "amount": 10
}
```

#### 任务完成演示
```http
POST /api/v1/demo/complete-task
Content-Type: application/json

{
  "user_id": "user123",
  "task_id": "task456",
  "task_type": "siterank"
}
```

#### 发送通知演示
```http
POST /api/v1/demo/send-notification
Content-Type: application/json

{
  "user_id": "user123",
  "template_id": "token_low",
  "channels": ["email", "websocket"],
  "data": {
    "balance": 50
  }
}
```

## 系统集成

### 事件驱动架构
系统采用事件驱动架构，各组件通过事件总线进行通信：

1. **Token消费事件** → 触发余额检查 → 发送通知
2. **任务完成事件** → 记录审计日志 → 发送通知
3. **安全威胁事件** → 触发安全响应 → 发送警报
4. **配置变更事件** → 热更新配置 → 记录变更日志

### 中间件集成
高级功能通过中间件自动集成到现有的API中：

```go
// 在路由中使用高级功能中间件
api.Use(advanced.AdvancedMiddleware(advancedFeaturesManager))
```

中间件会自动进行：
- 安全分析
- 速率限制检查
- 请求审计
- 事件发布

## 配置说明

### 插件配置
插件系统支持动态配置，可以通过API或配置文件进行管理。

### 速率限制配置
支持基于套餐的动态配置：
- FREE套餐：API 30次/分钟，1000次/小时
- PRO套餐：API 100次/分钟，5000次/小时
- MAX套餐：API 500次/分钟，20000次/小时

### 通知模板
内置通知模板：
- `token_low`: Token余额不足提醒
- `task_completed`: 任务完成通知
- `task_failed`: 任务失败通知
- `plan_expired`: 套餐到期提醒

### 安全规则
内置安全规则：
- 高频请求检测
- 可疑User-Agent检测
- IP黑名单检查
- 行为异常检测

## 监控和日志

### 系统监控
- 插件状态监控
- 速率限制统计
- 通知发送状态
- 安全事件统计

### 日志记录
- 操作审计日志
- 安全事件日志
- 系统运行日志
- 性能监控日志

## 扩展开发

### 自定义插件
实现 `Plugin` 接口来开发自定义插件：

```go
type CustomPlugin struct {
    *AutoAdsPlugin
}

func (p *CustomPlugin) Execute(ctx context.Context, params map[string]interface{}) error {
    // 插件逻辑
    return nil
}
```

### 自定义工具
实现 `Tool` 接口来开发自定义工具：

```go
type CustomTool struct {
    name        string
    description string
    version     string
}

func (t *CustomTool) Execute(ctx context.Context, params map[string]interface{}) (interface{}, error) {
    // 工具逻辑
    return result, nil
}
```

### 自定义通知渠道
实现 `NotificationChannel` 接口来开发自定义通知渠道：

```go
type CustomChannel struct {
    enabled bool
}

func (c *CustomChannel) Send(ctx context.Context, notification *Notification) error {
    // 发送逻辑
    return nil
}
```

## 性能优化

### 缓存策略
- 用户行为模式缓存：30分钟
- 速率限制状态缓存：1分钟
- 安全分析结果缓存：5分钟

### 异步处理
- 通知发送异步处理
- 审计日志异步写入
- 安全分析异步执行

### 资源管理
- 连接池管理
- 内存使用优化
- 垃圾回收优化

## 故障排除

### 常见问题
1. **插件启动失败**: 检查依赖是否满足
2. **通知发送失败**: 检查邮件服务配置
3. **速率限制异常**: 检查缓存服务状态
4. **安全检测误报**: 调整检测阈值

### 调试方法
1. 查看系统状态：`GET /api/v1/advanced/status`
2. 检查日志输出
3. 使用演示接口测试功能
4. 监控系统指标

## 部署建议

### 生产环境
- 使用Redis作为缓存
- 配置数据库连接池
- 启用日志轮转
- 配置监控告警

### 安全配置
- 启用HTTPS
- 配置防火墙规则
- 定期更新安全规则
- 监控异常访问

## 版本历史

### v1.0.0
- 初始版本
- 基础插件系统
- 增强速率限制
- 统一通知系统
- 高级安全系统
- 工具集成系统

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证。