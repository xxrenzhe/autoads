# 可疑模式监测系统

## 概述

本系统实现了用户层面的可疑模式监测，通过多维度的行为分析和实时预警机制，有效识别和防范恶意使用行为。

## 系统架构

### 1. 优化的IP限制策略 (`optimized-ip-rate-limit.ts`)

区分三种访问类型的差异化限制：
- **页面访问**：每小时1000次请求
- **API访问**：每小时100次请求  
- **认证用户**：每小时5000次请求

### 2. 可疑活动检测器 (`suspicious-activity-detector.ts`)

实现8种可疑模式检测：
- 异常高频使用（1小时内超过1000次操作）
- 非正常时间使用（凌晨2-6点大量使用）
- 批量操作异常（单次批量超过1000个）
- IP地址频繁变更（24小时内超过10个不同IP）
- Token消耗异常（每小时超过1000个token）
- 功能跳跃使用（30分钟内使用超过5个功能）
- 错误率异常（错误率超过30%）
- 可疑的用户代理（检测自动化工具）

### 3. 行为分析服务 (`behavior-analysis-service.ts`)

提供深度用户行为分析：
- 使用频率模式分析
- 使用时间模式分析
- 功能使用序列分析
- 性能异常模式分析
- 错误模式分析

### 4. 实时预警系统 (`real-time-alert-system.ts`)

7种预警规则：
- 高风险用户预警
- 可疑IP预警
- 异常高频使用预警
- Token异常消耗预警
- 批量操作异常预警
- 登录异常预警
- 系统性能预警

### 5. 安全集成中间件 (`security-integration.ts`)

统一集成所有安全组件，提供：
- 自动用户活动记录
- 实时风险评分检查
- 事件驱动的预警触发
- 安全监控装饰器

## 数据库模型

### 新增表结构

```sql
-- 用户活动记录
CREATE TABLE user_activity (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 可疑警报
CREATE TABLE suspicious_alert (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(255)
);

-- 用户风险评分
CREATE TABLE user_risk_score (
  user_id VARCHAR(255) PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  level VARCHAR(20) NOT NULL DEFAULT 'low',
  factors TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户行为画像
CREATE TABLE user_behavior_profile (
  user_id VARCHAR(255) PRIMARY KEY,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  behavior_score INTEGER NOT NULL DEFAULT 100,
  patterns JSONB DEFAULT '{}',
  typical_usage_hours INTEGER[] DEFAULT '{}',
  average_session_duration BIGINT DEFAULT 0,
  favorite_features TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户限制
CREATE TABLE user_restriction (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 预警通知记录
CREATE TABLE alert_notification (
  id VARCHAR(255) PRIMARY KEY,
  rule_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 使用方法

### 1. API集成

```typescript
import { withSecurityIntegration } from '@/lib/security/security-integration';

const handler = withSecurityIntegration(
  async (request, userId) => {
    // 你的API处理逻辑
  },
  {
    enableSuspiciousDetection: true,
    enableBehaviorAnalysis: true,
    enableRealTimeAlerts: true,
    riskThreshold: 70
  }
);

export { handler as POST };
```

### 2. 监控特定操作

```typescript
import { SecurityMonitor } from '@/lib/security/security-integration';

// 监控Token消耗
await SecurityMonitor.monitorTokenConsumption(
  userId,
  'siterank_basic',
  tokenAmount,
  { balance: remainingTokens }
);

// 监控批量操作
await SecurityMonitor.monitorBatchOperation(
  userId,
  'siterank_query',
  domains.length,
  { endpoint: '/api/siterank/batch' }
);

// 监控用户登录
await SecurityMonitor.monitorUserLogin(userId, {
  success: true,
  newDevice: true,
  ip: clientIP,
  userAgent: browserUserAgent
});
```

### 3. 获取用户安全报告

```typescript
const securityReport = await SecurityMonitor.getUserSecurityReport(userId);

console.log(securityReport.riskScore);
console.log(securityReport.behaviorProfile);
console.log(securityReport.recommendations);
```

### 4. 管理API

#### 获取安全概览
```http
GET /api/admin/security
```

#### 执行管理操作
```http
POST /api/admin/security
Content-Type: application/json

{
  "action": "resolve_alert",
  "alertId": "alert_123",
  "reason": "False positive"
}
```

#### 获取用户安全详情
```http
GET /api/admin/security/users/{userId}
```

## 风险等级定义

- **low** (0-39分): 正常使用行为
- **medium** (40-69分): 轻微异常，需要关注
- **high** (70-99分): 明显异常，可能存在风险
- **critical** (100分以上): 严重异常，需要立即处理

## 性能优化

1. **数据库索引**：为关键查询字段创建索引
2. **缓存机制**：行为分析结果缓存1小时
3. **异步处理**：用户活动记录异步执行，不阻塞请求
4. **批量操作**：预警通知队列化处理
5. **滑动窗口**：IP限制使用滑动窗口算法

## 扩展性

系统设计支持：
- 添加新的可疑模式检测算法
- 自定义预警规则和动作
- 集成多种通知渠道（邮件、短信、Webhook）
- 与第三方安全服务集成

## 监控指标

- 实时活跃用户数
- 高风险用户数量
- 预警触发频率
- 系统响应时间
- 错误率和异常模式