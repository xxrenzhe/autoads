# 极简可疑行为检测系统

## 概述

这个极简系统只检测4种明确的异常模式，不影响token经济模型和正常使用。

## 检测的异常行为

### 1. 自动化工具检测
- 检测明显的自动化工具特征（curl、wget、python-requests等）
- 检测异常快的请求间隔（<100ms）

### 2. 暴力破解检测
- 5分钟内连续失败50次
- 只检测API调用失败

### 3. 异常Token消耗
- 每分钟消耗超过1000个token（非批量操作）
- 批量操作不触发此检测

### 4. IP地址轮换
- 1小时内使用超过20个不同IP
- 可能的账号共享或代理使用

## 系统特点

- **不限制使用** - 只记录，不阻止
- **异步处理** - 不影响API响应时间
- **人工决策** - 发现异常由管理员判断
- **最小化影响** - 极简设计，性能开销小

## 使用方法

### 1. 在API中使用

```typescript
import { withMinimalSecurity } from '@/lib/security/minimal-security-middleware';

const handler = withMinimalSecurity(
  async (request, userId) => {
    // 你的API逻辑
    return NextResponse.json({ data: 'success' });
  },
  {
    enableEventTracking: true,
    trackSuccess: true,
    trackErrors: true
  }
);

export { handler as POST };
```

### 2. 手动记录特定事件

```typescript
import { SecurityEventHelper } from '@/lib/security/minimal-security-middleware';

// 记录登录
await SecurityEventHelper.recordLogin(userId, success, { ip, userAgent });

// 记录Token消耗
await SecurityEventHelper.recordTokenConsumption(userId, amount, { feature: 'siterank' });

// 记录批量操作
await SecurityEventHelper.recordBatchOperation(userId, 'siterank', batchSize);
```

## 管理API

### 获取可疑事件列表
```
GET /api/admin/security-minimal
```

查询参数：
- `resolved=true/false` - 筛选已解决/未解决事件
- `limit=50` - 限制返回数量
- `type=automation_tool` - 筛选特定类型

### 解决事件
```
POST /api/admin/security-minimal
{
  "action": "resolve_event",
  "eventId": "event_id",
  "reason": "误报"
}
```

### 批量解决
```
POST /api/admin/security-minimal
{
  "action": "bulk_resolve",
  "eventIds": ["id1", "id2"],
  "reason": "批量处理"
}
```

### 获取用户事件历史
```
POST /api/admin/security-minimal
{
  "action": "get_user_events",
  "userId": "user123",
  "limit": 20
}
```

## 数据库表

只有2个表：

```sql
-- 用户事件表
user_events (
  id, user_id, action, endpoint, 
  user_agent, ip, metadata, timestamp
)

-- 可疑事件表
suspicious_events (
  id, user_id, type, details, 
  timestamp, resolved, resolved_at, resolved_by
)
```

## 配置说明

所有配置都在 `minimal-suspicious-detector.ts` 中：

```typescript
const config = {
  bruteForce: {
    windowMs: 5 * 60 * 1000,    // 5分钟
    maxFailures: 50            // 50次失败
  },
  ipRotation: {
    windowMs: 60 * 60 * 1000,  // 1小时
    maxIPs: 20                 // 20个IP
  },
  tokenConsumption: {
    windowMs: 60 * 1000,       // 1分钟
    maxTokensPerMinute: 1000   // 1000个token
  }
};
```

## 注意事项

1. **不限制正常使用** - 系统只记录不阻止
2. **可能误报** - 需要人工审核确认
3. **定期清理** - 自动清理30天前的数据
4. **性能友好** - 异步处理，轻量级检测

这个系统专注于保护系统安全，同时完全不影响正常的商业使用。