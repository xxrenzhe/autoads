# 配置中心 Schema（草案）

## Plan（套餐）
```json
{
  "id": "pro",
  "name": "Pro",
  "status": "active",
  "version": 1,
  "effectiveAt": "2025-10-01T00:00:00Z"
}
```

## Entitlement（授权/限额）
```json
{
  "planId": "pro",
  "featureKey": "siterank.deep_evaluate",
  "enabled": true,
  "limitDaily": 10,
  "limitMonthly": 200
}
```

## TokenRule（扣费规则）
```json
{
  "planId": "pro",
  "actionKey": "batchopen.click.standard",
  "tokenCost": 2,
  "version": 3,
  "effectiveAt": "2025-10-01T00:00:00Z"
}
```

## TemplateBundle（模板包）
```json
{
  "id": "default-cn-batchopen",
  "stage": "batchopen",
  "country": "CN",
  "default": true,
  "payload": {
    "proxyCountry": "CN",
    "refererStrategy": "mixed_common",
    "uaWeights": {"mobile":0.6, "desktop":0.35, "tablet":0.05},
    "hourlyCurve": [1,1,1,1,2,3,5,7,8,7,6,6,6,6,6,6,7,8,8,6,5,3,2,1]
  },
  "version": 1,
  "effectiveAt": "2025-10-01T00:00:00Z"
}
```

说明：以上配置存储在 Firestore（或等价存储）并支持版本/灰度/审计；服务通过订阅与缓存热更新。

## RecommendationWeights（推荐权重/阈值）
```json
{
  "id": "rec-default-v1",
  "type": "recommendation.weights",
  "weights": { "industry": 0.4, "keywords": 0.4, "geo": 0.2 },
  "thresholds": {
    "keywords_jaccard_min": 0.2,
    "landing_keywords_overlap_min": 3,
    "geo_match_required": true
  },
  "topN": 10,
  "candidatePool": 500,
  "diversity": { "byDomain": true, "maxPerDomain": 2 },
  "version": 1,
  "effectiveAt": "2025-10-01T00:00:00Z"
}
```

## RiskThresholds（风控阈值/窗口/严重度）
```json
{
  "id": "risk-default-v1",
  "type": "risk.thresholds",
  "windows": { "short": 7, "long": 30 },
  "min": { "impressions": 1000, "clicks": 50, "ctr": 0.005, "conv_rate": 0.01 },
  "sync": { "maxAgeHours": 24, "failRateWarn": 0.2 },
  "anomaly": { "sigma": 3.0, "ewmaAlpha": 0.3 },
  "actions": {
    "hint": { "cooldownHours": 24 },
    "task": { "cooldownHours": 24 },
    "auto": { "requireConfirmations": 2, "cooldownHours": 48 }
  },
  "severityMap": {
    "landing_unreachable": "critical",
    "data_sync_missing": "high",
    "high_impressions_low_ctr": "medium",
    "low_impressions_low_clicks": "low"
  },
  "overrides": {
    "vertical:finance": { "min": { "ctr": 0.01, "conv_rate": 0.02 } },
    "country:US": { "min": { "impressions": 1500 } }
  },
  "version": 1,
  "effectiveAt": "2025-10-01T00:00:00Z"
}
```
