# 简化的可疑模式监测系统

## 核心特点

1. **简单实用** - 只保留最核心的风险检测功能
2. **轻量级** - 最小化数据库表和代码复杂度
3. **易于维护** - 清晰的逻辑和简单的配置

## 系统组成

### 1. 简化可疑检测器 (`simple-suspicious-detector.ts`)

检测5种核心风险模式：
- 高频使用（>500次/小时）
- 批量操作异常（>100个/次）
- 错误率过高（>30%）
- 凌晨时段活跃（2-6点）
- IP频繁变更（>5个/24小时）

### 2. 简化安全中间件 (`simple-security-middleware.ts`)

提供：
- 自动用户活动记录
- 风险等级检查
- 自动限制机制
- 简单的监控接口

### 3. 数据库表（仅4张）

- `user_risks` - 用户风险等级
- `suspicious_events` - 可疑事件记录
- `user_activities` - 用户活动记录
- `user_restrictions` - 用户限制记录

## 快速使用

### 1. 在API中使用

```typescript
import { withSimpleSecurity } from '@/lib/security/simple-security-middleware';

const handler = withSimpleSecurity(
  async (request, userId) => {
    // 你的API逻辑
    return NextResponse.json({ success: true });
  },
  {
    enableActivityTracking: true,
    enableRiskCheck: true,
    riskThreshold: 80
  }
);

export { handler as POST };
```

### 2. 手动记录事件

```typescript
import { SimpleSecurityMonitor } from '@/lib/security/simple-security-middleware';

// 记录可疑事件
await SimpleSecurityMonitor.recordEvent(
  userId,
  'suspicious_login',
  '检测到异常登录',
  'high',
  { ip: '123.45.67.89' }
);

// 限制用户
await SimpleSecurityMonitor.restrictUser(
  userId,
  'api_limit',
  '频繁调用API',
  24 // 限制24小时
);
```

### 3. 检查用户安全状态

```typescript
const safety = await SimpleSecurityMonitor.isUserSafe(userId);
if (!safety.safe) {
  console.log(`用户风险等级: ${safety.riskLevel}`);
  console.log(`风险分数: ${safety.riskScore}`);
  console.log(`风险原因: ${safety.reasons.join(', ')}`);
}
```

## 风险等级

- **normal** (0-29分) - 正常用户
- **suspicious** (30-79分) - 可疑用户，需要关注
- **dangerous** (80-100分) - 危险用户，自动限制

## 管理API

### 获取安全概览
```
GET /ops/api/v1/console/security/simple
```

### 管理操作
```
POST /ops/api/v1/console/security/simple
{
  "action": "reset_user_risk",
  "userId": "user123",
  "reason": "误报"
}
```

支持的action：
- `resolve_event` - 解决可疑事件
- `reset_user_risk` - 重置用户风险
- `restrict_user` - 限制用户
- `unrestrict_user` - 解除限制
- `get_user_details` - 获取用户详情

## 配置说明

所有配置都在 `simple-suspicious-detector.ts` 的 config 对象中：

```typescript
const config = {
  maxRequestsPerHour: {
    normal: 500,      // 正常阈值
    suspicious: 1000, // 可疑阈值
    dangerous: 2000   // 危险阈值
  },
  maxBatchSize: 100,        // 最大批量大小
  maxErrorRate: 0.3,        // 最大错误率30%
  maxIPs: 5,               // 最大IP数量
  nightHours: [2,3,4,5],   // 凌晨时段
  maxNightRequests: 50     // 凌晨最大请求数
};
```

## 性能考虑

1. **异步处理** - 活动检测异步执行，不影响API响应
2. **定期清理** - 自动清理30天前的旧数据
3. **索引优化** - 关键字段都有数据库索引
4. **缓存机制** - 风险信息内存缓存（可扩展）

## 扩展建议

如需添加新的检测规则，只需在 `detectSuspiciousActivity` 方法中添加新的检测逻辑：

```typescript
// 检测6: 自定义规则
if (yourCondition) {
  riskFactors.push('自定义风险描述');
  riskScore += 25;
}
```
