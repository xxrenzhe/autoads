# AutoAds 多用户 SaaS 架构设计方案

## 1. 架构概述

### 1.1 设计目标
- 将单体 AutoAds 应用重构为支持多用户的 SaaS 系统
- 利用 GoFly 框架提供企业级后台管理功能
- 保持三大核心业务功能（BatchGo、SiteRankGo、AdsCenterGo）的完整性
- 实现高性能、高可用、可扩展的系统架构

### 1.2 架构原则
- **多租户隔离**: 确保用户数据完全隔离
- **微服务架构**: 拆分核心业务为独立服务
- **前后端分离**: 保持 Next.js 前端，Go 后端服务
- **渐进式迁移**: 平滑过渡，不影响现有业务

## 2. 整体架构设计

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
┌───────▼────────┐            ┌──────▼──────────┐
│  Next.js      │            │   Go API       │
│  Frontend     │◄──────────►│   Gateway      │
│  (现有)       │            │   (GoFly)      │
└───────────────┘            └───────┬──────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
    ┌───────▼───────┐         ┌──────▼────────┐        ┌──────▼────────┐
    │   BatchGo     │         │  SiteRankGo   │        │  AdsCenterGo │
    │   Service     │         │    Service    │        │    Service    │
    │    (Go)       │         │     (Go)       │        │     (Go)      │
    └───────────────┘         └───────────────┘        └───────────────┘
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │        GoFly Admin System       │
                    │      (User Management, RBAC)    │
                    └─────────────────┬─────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
    ┌───────▼───────┐         ┌──────▼────────┐        ┌──────▼────────┐
    │    MySQL      │         │     Redis      │        │   File Store  │
    │  (Multi-tenant)│        │   (Cache/Sessions) │      │   (Uploads)   │
    └───────────────┘         └───────────────┘        └───────────────┘
```

### 2.2 技术栈选择

#### 前端技术栈
- **框架**: Next.js 14 (保持现有)
- **语言**: TypeScript (保持现有)
- **状态管理**: Zustand (保持现有)
- **UI组件**: MUI v7 (保持现有)
- **实时通信**: Socket.io (保持现有)

#### 后端技术栈
- **主框架**: GoFly Admin V3
- **语言**: Go 1.21+
- **Web框架**: Gin (GoFly内置)
- **ORM**: GoFly GDB (内置)
- **缓存**: Redis 7.0
- **认证**: JWT + OAuth2

#### 基础设施
- **数据库**: MySQL 8.0
- **缓存**: Redis 7.0
- **消息队列**: Redis Streams (轻量级)
- **文件存储**: 本地存储 + 云存储扩展
- **监控**: Prometheus + Grafana

## 3. 多租户架构设计

### 3.1 租户模型
采用**共享数据库、独立Schema**的多租户模式：

```sql
-- 租户表结构示例
CREATE TABLE `tenant` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '租户名称',
  `domain` varchar(100) DEFAULT NULL COMMENT '自定义域名',
  `status` tinyint(1) DEFAULT 1 COMMENT '状态：0禁用，1启用',
  `plan_id` bigint(20) DEFAULT NULL COMMENT '套餐ID',
  `expire_time` datetime DEFAULT NULL COMMENT '过期时间',
  `config` json DEFAULT NULL COMMENT '租户配置',
  `createtime` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatetime` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_domain` (`domain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.2 数据隔离策略

#### 方案一：Schema前缀（推荐）
```go
// 动态表名处理
func GetTenantTable(tenantID string, tableName string) string {
    return fmt.Sprintf("t%s_%s", tenantID, tableName)
}

// 示例：
// 租户1001的用户表：t1001_user
// 租户1001的任务表：t1001_batch_task
```

#### 方案二：租户ID字段
所有业务表添加 `tenant_id` 字段，通过数据库视图简化查询。

### 3.3 租户配置管理
```go
type TenantConfig struct {
    // 基础配置
    Name         string                 `json:"name"`
    Logo         string                 `json:"logo"`
    Theme        ThemeConfig            `json:"theme"`
    
    // 功能配置
    Features     FeatureConfig          `json:"features"`
    
    // 集成配置
    Integrations IntegrationConfig      `json:"integrations"`
    
    // 自定义配置
    CustomConfig map[string]interface{} `json:"custom_config"`
}
```

## 4. 微服务架构设计

### 4.1 服务拆分

#### 4.1.1 API网关服务
基于GoFly的统一入口：
- 路由转发
- 认证授权
- 限流熔断
- 日志监控

#### 4.1.2 用户中心服务
集成GoFly的用户管理：
- 用户注册/登录
- 用户资料管理
- 权限控制
- OAuth2集成

#### 4.1.3 BatchGo服务
重构现有BatchOpen功能：
- 任务管理
- 代理池管理
- 执行引擎
- 结果统计

#### 4.1.4 SiteRankGo服务
重构现有SiteRank功能：
- 查询任务管理
- API调用优化
- 缓存管理
- 数据分析

#### 4.1.5 AdsCenterGo服务
重构现有AdsCenter功能：
- Google Ads集成
- AdsPower自动化
- 链接管理
- 执行监控

### 4.2 服务间通信

#### 4.2.1 同步通信（gRPC）
```go
// 服务定义示例
service BatchGoService {
    rpc CreateTask (CreateTaskRequest) returns (CreateTaskResponse);
    rpc GetTaskStatus (GetTaskStatusRequest) returns (GetTaskStatusResponse);
    rpc CancelTask (CancelTaskRequest) returns (CancelTaskResponse);
}
```

#### 4.2.2 异步通信（Redis Streams）
```go
// 消息队列
type TaskMessage struct {
    TaskID     string                 `json:"task_id"`
    TenantID   string                 `json:"tenant_id"`
    UserID     string                 `json:"user_id"`
    TaskType   string                 `json:"task_type"`
    Payload    map[string]interface{} `json:"payload"`
    CreatedAt  time.Time              `json:"created_at"`
}
```

## 5. 数据库设计

### 5.1 核心表结构

#### 5.1.1 租户相关表
```sql
-- 租户表
CREATE TABLE `tenant` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL,
    `domain` varchar(100) DEFAULT NULL,
    `status` tinyint(1) DEFAULT 1,
    `plan_id` bigint(20) DEFAULT NULL,
    `expire_time` datetime DEFAULT NULL,
    `config` json DEFAULT NULL,
    `createtime` datetime DEFAULT CURRENT_TIMESTAMP,
    `updatetime` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_domain` (`domain`)
);

-- 租户套餐表
CREATE TABLE `tenant_plan` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `name` varchar(50) NOT NULL,
    `code` varchar(20) NOT NULL,
    `price` decimal(10,2) DEFAULT NULL,
    `tokens` int(11) DEFAULT NULL,
    `features` json DEFAULT NULL,
    `status` tinyint(1) DEFAULT 1,
    `sort` int(11) DEFAULT 0,
    `createtime` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_code` (`code`)
);
```

#### 5.1.2 用户相关表（基于GoFly）
```sql
-- 扩展GoFly的用户表，添加租户关联
ALTER TABLE `business_user` 
ADD COLUMN `tenant_id` bigint(20) DEFAULT NULL AFTER `id`,
ADD INDEX `idx_tenant_id` (`tenant_id`);
```

#### 5.1.3 BatchGo相关表
```sql
-- 任务表（多租户）
CREATE TABLE `batch_task` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `tenant_id` bigint(20) NOT NULL,
    `user_id` bigint(20) NOT NULL,
    `name` varchar(255) DEFAULT NULL,
    `mode` varchar(20) DEFAULT 'basic' COMMENT '执行模式：basic/silent/automated',
    `status` varchar(20) DEFAULT 'pending' COMMENT 'pending/running/completed/failed',
    `total_urls` int(11) DEFAULT 0,
    `success_urls` int(11) DEFAULT 0,
    `failed_urls` int(11) DEFAULT 0,
    `config` json DEFAULT NULL,
    `result` json DEFAULT NULL,
    `start_time` datetime DEFAULT NULL,
    `end_time` datetime DEFAULT NULL,
    `createtime` datetime DEFAULT CURRENT_TIMESTAMP,
    `updatetime` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_tenant_user` (`tenant_id`, `user_id`),
    KEY `idx_status` (`status`)
);

-- URL列表表
CREATE TABLE `batch_task_url` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `task_id` bigint(20) NOT NULL,
    `url` text NOT NULL,
    `status` varchar(20) DEFAULT 'pending',
    `result` json DEFAULT NULL,
    `error` varchar(500) DEFAULT NULL,
    `start_time` datetime DEFAULT NULL,
    `end_time` datetime DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_task_id` (`task_id`),
    KEY `idx_status` (`status`)
);
```

## 6. 认证与授权

### 6.1 多租户认证流程
```go
// JWT Token结构
type Claims struct {
    UserID   string `json:"user_id"`
    TenantID string `json:"tenant_id"`
    Role     string `json:"role"`
    jwt.StandardClaims
}

// 中间件验证
func TenantAuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(401, gin.H{"code": 401, "message": "未授权"})
            c.Abort()
            return
        }
        
        // 验证Token并提取租户信息
        claims, err := ValidateToken(token)
        if err != nil {
            c.JSON(401, gin.H{"code": 401, "message": "Token无效"})
            c.Abort()
            return
        }
        
        // 设置上下文
        c.Set("user_id", claims.UserID)
        c.Set("tenant_id", claims.TenantID)
        c.Set("role", claims.Role)
        
        c.Next()
    }
}
```

### 6.2 RBAC权限控制
基于GoFly的RBAC系统，扩展多租户支持：
- 租户级权限管理
- 用户组权限
- 资源级权限控制

## 7. 迁移策略

### 7.1 数据迁移
1. **备份现有数据**
2. **创建新表结构**
3. **数据迁移脚本**
4. **数据一致性验证**

### 7.2 服务迁移
1. **阶段一**：部署GoFly基础框架
2. **阶段二**：实现用户管理系统
3. **阶段三**：逐个迁移核心业务服务
4. **阶段四**：前端适配和集成测试

## 8. 部署架构

### 8.1 Docker容器化
```dockerfile
# Dockerfile示例
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
COPY --from=builder /app/resource ./resource

EXPOSE 8200
CMD ["./main"]
```

### 8.2 Kubernetes部署（可选）
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: autods-gofly-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: autods-gofly-api
  template:
    metadata:
      labels:
        app: autods-gofly-api
    spec:
      containers:
      - name: api
        image: autods/gofly-api:latest
        ports:
        - containerPort: 8200
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
```

## 9. 监控与运维

### 9.1 日志管理
- 结构化日志输出
- 日志分级存储
- 日志聚合分析

### 9.2 性能监控
- API响应时间
- 数据库性能
- 缓存命中率
- 系统资源使用

### 9.3 告警机制
- 服务异常告警
- 资源使用告警
- 业务指标告警

## 10. 安全设计

### 10.1 数据安全
- 数据传输加密
- 敏感数据脱敏
- 定期数据备份

### 10.2 访问控制
- API访问控制
- 文件访问控制
- 数据库访问控制

### 10.3 合规性
- GDPR合规
- 数据隐私保护
- 审计日志

## 11. 性能优化

### 11.1 缓存策略
- Redis缓存热点数据
- 查询结果缓存
- 页面静态化

### 11.2 数据库优化
- 读写分离
- 分库分表
- 索引优化

### 11.3 并发处理
- 连接池优化
- 协程池管理
- 请求限流

## 12. 扩展性设计

### 12.1 水平扩展
- 无状态服务设计
- 分布式session
- 负载均衡

### 12.2 功能扩展
- 插件化架构
- 开放API平台
- 第三方集成

## 13. 实施计划

### Phase 1: 基础设施搭建（2周）
- 搭建GoFly开发环境
- 设计数据库结构
- 实现基础框架

### Phase 2: 用户系统开发（3周）
- 集成GoFly用户管理
- 实现多租户架构
- 开发认证授权系统

### Phase 3: BatchGo服务迁移（4周）
- Go服务开发
- API对接
- 功能测试

### Phase 4: SiteRankGo服务迁移（3周）
- 服务重构
- 性能优化
- 缓存实现

### Phase 5: AdsCenterGo服务迁移（4周）
- 核心功能迁移
- 自动化流程
- 监控实现

### Phase 6: 前端适配（2周）
- API适配
- 界面优化
- 多租户支持

### Phase 7: 测试部署（2周）
- 集成测试
- 性能测试
- 生产部署

## 14. 风险评估

### 14.1 技术风险
- Go开发经验不足
- 微服务架构复杂度
- 性能瓶颈

### 14.2 业务风险
- 功能不兼容
- 用户体验下降
- 数据迁移失败

### 14.3 缓解措施
- 技术培训和预研
- 分阶段迁移
- 充分测试验证

## 15. 总结

本架构设计方案基于AutoAds现有业务需求，结合GoFly框架的强大功能，提供了一个完整的多用户SaaS解决方案。通过微服务架构、多租户隔离、渐进式迁移等策略，确保系统重构的顺利进行，同时保持业务的连续性和稳定性。