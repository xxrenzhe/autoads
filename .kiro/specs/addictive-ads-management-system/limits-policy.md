# Adscenter 套餐化限流与配额策略（配置指南）

本策略用于为不同套餐（Plan）配置 Adscenter 的调用速率（RPM/并发）与每日配额（daily），并支持按动作类型（preflight/mutate/…）分别配置，保证公平性与总量受控。

## 配置来源

- 优先：Secret Manager（推荐）
  - 环境变量：`ADSCENTER_LIMITS_SECRET`
  - 值：JSON（见示例）
- 备选：环境变量
  - `ADSCENTER_LIMITS_JSON`

服务读取策略时会在进程内缓存，支持热更新（Secret 内容刷新后可重启服务或等待缓存过期）。

## JSON 示例（建议直接写入 Secret）

```json
{
  "defaults": {
    "global": { "rpm": 60, "concurrency": 4 },
    "actions": {
      "preflight": { "rpm": 60, "concurrency": 4 },
      "mutate":    { "rpm": 30, "concurrency": 2 }
    },
    "quotas": { "daily": 1000 }
  },
  "plans": {
    "Pro": {
      "actions": {
        "preflight": { "rpm": 120, "concurrency": 8 },
        "mutate":    { "rpm": 60,  "concurrency": 4 }
      },
      "quotas": { "daily": 2000 }
    },
    "Elite": {
      "actions": {
        "preflight": { "rpm": 240, "concurrency": 16 },
        "mutate":    { "rpm": 120, "concurrency": 8 }
      },
      "quotas": { "daily": 5000 }
    }
  },
  "maxKeys": 1000,
  "keyTTLSeconds": 3600
}
```

说明：
- `defaults`：默认全局与各动作的限流、每日配额（适用于未在 `plans` 覆盖的套餐）
- `plans`：按套餐名（与 Billing 返回的 `planName` 一致）覆盖默认策略
- `maxKeys`：分片限流键空间上限（LRU 回收）
- `keyTTLSeconds`：空闲键 TTL（过期回收）

## 生效范围

- Pre-flight LIVE（非 validateOnly）：按套餐/动作注入分片限流参数，执行“分片限流 → 全局限流 → 指数退避”
- 执行端（mutate 分片）：execute-next / execute-tick 执行分片前按套餐注入限流参数
- 批量校验（Validate）：按套餐每日配额读取用户当日使用量，超限直接阻断（429）

## 依赖与前置

- Billing：`GET $BILLING_URL/api/v1/billing/subscriptions/me`（Header: X-User-Id）用于解析用户当前套餐
- Browser-Exec：`BROWSER_EXEC_URL`（可选，用于 ROTATE_LINK resolve），`BROWSER_INTERNAL_TOKEN`（服务间鉴权）

## 部署建议

1. 创建 Secret 并注入到 Adscenter（预发/生产分别维护）
2. 在 Cloud Run（adscenter）设置环境变量：
   - `ADSCENTER_LIMITS_SECRET` 指向上一步创建的 Secret 版本
   - `BILLING_URL` 指向 Billing 服务 URL（Gateway 路由或 Cloud Run URL）
3. 可使用 `deployments/scripts/create-bulk-exec-scheduler.sh` 创建执行调度（execute-tick）

