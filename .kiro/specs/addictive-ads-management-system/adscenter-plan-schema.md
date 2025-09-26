# Adscenter 批量计划 Plan 参数规范（最小落地）

本文档定义当前执行器支持的 Plan JSON 参数字段（与 OAS 中的 `actions[].params` 对应）。

## 通用结构

```
{
  "validateOnly": false,
  "actions": [
    { "type": "ADJUST_CPC",    "params": { ... }, "filter": { ... } },
    { "type": "ADJUST_BUDGET", "params": { ... } },
    { "type": "ROTATE_LINK",   "params": { ... } }
  ]
}
```

## ADJUST_CPC

- 必填 params
  - `targetResourceNames`: string[] —— adGroupCriteria 资源名列表（如 `customers/123/adGroupCriteria/456~789`）
  - `cpcMicros`: number —— 目标 CPC（微）
- 说明：
  - ads_live 构建下将对上述目标执行 validate-only mutate（若 `ADS_MUTATE_LIVE=true` 则执行真实 mutate）
  - 执行审计包含 before/after 的 `cpc_bid_micros`（best-effort）

示例：
```
{
  "type": "ADJUST_CPC",
  "params": {
    "targetResourceNames": ["customers/123/adGroupCriteria/456~789"],
    "cpcMicros": 1200000
  }
}
```

## ADJUST_BUDGET

- 必填 params
  - `campaignBudgetResourceNames`: string[] —— campaign_budget 资源名列表
  - `amountMicros`: number —— 预算（微）
- 说明：
  - ads_live 构建下 validate-only mutate（`ADS_MUTATE_LIVE=true` 为真实 mutate）
  - 执行审计包含 before/after 的 `amount_micros`（best-effort）

示例：
```
{
  "type": "ADJUST_BUDGET",
  "params": {
    "campaignBudgetResourceNames": ["customers/123/campaignBudgets/456"],
    "amountMicros": 50000000
  }
}
```

## ROTATE_LINK（换链接）

- 可选 params
  - `finalUrlSuffix`: string —— 目标 suffix；若缺省将尝试通过 `links/targetDomain` + browser‑exec `resolve-offer` 推断
  - `links`: string[] —— 可解析的落地 URL 列表（选其一解析）
  - `targetDomain`: string —— 备用域名（当 `links` 缺省时用于解析）
  - `adResourceNames`: string[] —— adGroupAd 资源名列表（如 `customers/123/adGroupAds/456~789`）
- 说明：
  - validate-only mutate 更新 `ad.final_url_suffix`（`ADS_MUTATE_LIVE=true` 时执行真实 mutate）
  - 执行审计包含 before/after 的 `final_url_suffix`（best-effort）

示例：
```
{
  "type": "ROTATE_LINK",
  "params": {
    "adResourceNames": ["customers/123/adGroupAds/456~789"],
    "links": ["https://example.com/lp?a=1"]
  }
}
```

## 备注

- 以上为“最小落地”规范，便于尽快打通真实执行与审计闭环。后续可扩展：
  - `filter` -> server 侧解析生成目标 resource names（需查询结构，建议以离线计算/前端预先生成为主）
  - 真实 mutate 的错误分级与死信入库、回滚计划的自动生成
  - 细化执行审计（独立 before/after 快照表）

