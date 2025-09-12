# 零侵入式API监控集成指南

## 概述

本监控系统通过中间件和装饰器模式实现零侵入式集成，无需修改现有业务逻辑代码。

## 集成方式

### 1. 自动监控（中间件模式）

所有API请求都会被自动监控，无需任何修改：

- ✅ 自动记录所有API调用
- ✅ 自动提取IP和User-Agent
- ✅ 自动计算响应时间
- ✅ 自动推断功能类型

### 2. 增强监控（装饰器模式）

如果需要更准确的用户信息，可以使用装饰器：

```typescript
// 原有代码
export async function POST(request: NextRequest) {
  // 业务逻辑...
  return NextResponse.json({ data: 'success' });
}

// 只需要添加一行（零侵入）
import { withApiMonitoring, setUserIdInResponse } from '@/lib/security/api-monitoring';

export const POST = withApiMonitoring(async function(request: NextRequest) {
  // 业务逻辑完全不变
  const { userId } = await auth();
  
  const response = NextResponse.json({ data: 'success' });
  
  // 如果有用户信息，设置到响应头
  if (userId) {
    return setUserIdInResponse(response, userId);
  }
  
  return response;
});
```

## 监控范围

### 自动检测的行为

1. **自动化工具检测**
   - 检测curl、wget、python-requests等
   - 检测异常快的请求间隔（<100ms）

2. **暴力破解检测**
   - 5分钟内连续失败50次
   - 只检测API调用失败

3. **异常Token消耗**
   - 每分钟消耗超过1000个token（非批量操作）
   - 批量操作不触发此检测

4. **IP地址轮换**
   - 1小时内使用超过20个不同IP
   - 可能的账号共享或代理使用

### 监控的API路径

- `/api/siterank/*` - SiteRank相关功能
- `/api/batchopen/*` - BatchOpen相关功能
- `/api/adscenter/*` - AdsCenter相关功能
- `/api/token/*` - Token相关功能
- `/api/user/*` - 用户相关功能

### 不监控的路径

- `/api/auth/*` - 认证相关
- `/api/admin/security-minimal` - 避免循环
- `/api/health` - 健康检查
- `/api/metrics` - 指标接口

## 查看监控结果

### 1. 管理界面

访问 `/api/admin/security-minimal` 查看可疑事件：

```bash
# 获取未解决的可疑事件
curl "http://localhost:3000/api/admin/security-minimal?resolved=false"

# 解决事件
curl -X POST "http://localhost:3000/api/admin/security-minimal" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "resolve_event",
    "eventId": "event_id",
    "reason": "误报"
  }'
```

### 2. 数据库表

系统创建了两个表：

- `user_events` - 用户事件记录
- `suspicious_events` - 可疑事件记录

## 性能影响

- **零延迟**：所有监控都是异步处理
- **零阻塞**：不影响API响应时间
- **零侵入**：不需要修改业务代码
- **自动清理**：30天后自动删除旧数据

## 配置选项

在 `minimal-suspicious-detector.ts` 中可以调整检测阈值：

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

## 禁用监控

如果需要临时禁用监控，删除或注释掉 `src/middleware.ts` 中的相关代码即可。