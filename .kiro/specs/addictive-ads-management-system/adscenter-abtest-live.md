# Adscenter A/B 测试（ads_live 路径）

本文档说明预发已接入的 A/B 测试“真实路径”最小实现、配置方式与后续计划。

## 能力范围（MVP）

- 复制广告组（最小）：在相同 Campaign 下创建一个新的 Ad Group，名称追加 `_B` 后缀；暂不克隆 Ads/Keywords（后续迭代）。
- 指标刷新：按 Ad Group 维度查询最近 7 天 `impressions/clicks/cost_micros`，入库到 `ABTestMetric` 聚合表。
- 分流：当前仅记录期望的 split（A/B 百分比），不做实验级真实流量划分（下一步接入 Experiments）。

## 开关与凭据

- 开关：`ADS_ABTEST_LIVE=true`（默认关闭）
- 平台级凭据（从环境或 Secret Manager 读取，已内置缓存）：
  - `GOOGLE_ADS_DEVELOPER_TOKEN` 或 `GOOGLE_ADS_DEVELOPER_TOKEN_SECRET_NAME`
  - `GOOGLE_ADS_OAUTH_CLIENT_ID` 或 `GOOGLE_ADS_OAUTH_CLIENT_ID_SECRET_NAME`
  - `GOOGLE_ADS_OAUTH_CLIENT_SECRET` 或 `GOOGLE_ADS_OAUTH_CLIENT_SECRET_SECRET_NAME`
  - `GOOGLE_ADS_LOGIN_CUSTOMER_ID` 或 `GOOGLE_ADS_LOGIN_CUSTOMER_ID_SECRET_NAME`
- 用户级 Refresh Token：通过 OAuth 回调写入数据库（`storage.GetUserRefreshToken`）；优先使用用户 RT，缺失时回退平台 RT。

## 接口

- 创建测试（可能触发真实复制）
  - `POST /api/v1/adscenter/ab-tests`（需 `X-User-Id`）
  - 请求：`{ accountId, offerId, seedAdGroupId, splitA?, splitB?, notes? }`
  - 响应：`{ id, status, variants:{A,B}, split:{A,B} }`
  - 行为：若 `ADS_ABTEST_LIVE=true`，调用 `CopyAdGroupMinimal` 尝试在 `accountId` 下复制 `seedAdGroupId`，成功则以真实 `variant_b_group_id` 入库；否则退化为 `_B` 后缀。

- 指标刷新
  - `POST /api/v1/adscenter/ab-tests/{id}/refresh-metrics`（需 `X-User-Id`）
  - 行为：查询最近 7 天 A/B 两个 Ad Group 的 `impressions/clicks/cost_micros`，写入 `ABTestMetric`。

- 列表/详情
  - `GET /api/v1/adscenter/ab-tests`、`GET /api/v1/adscenter/ab-tests/{id}`
  - 输出：A/B 聚合指标、p-value（双比例 z 检验）与推荐。

## 依赖与限制

- `seedAdGroupId` 需为 Google Ads 数字型 Ad Group ID（非资源名）。
- 复制仅创建空 Ad Group；后续迭代将克隆主要 Ads 与 Top N 关键词。
- 分流目前未创建 Google Ads Experiments；下一步将：
  - `Experiment` + `ExperimentArm` 两臂（A/B）并设定 split；
  - 同步/毕业流程（`schedule/graduate`）。

## 后续计划

1) 复制增强：克隆 RSA/扩展文本广告与 Top N 关键词（分批 mutate）。
2) 实验式分流：接入 Experiments（创建/调度/结束/毕业）。
3) 指标刷新自动化：Scheduler → Pub/Sub → Functions → 轮询刷新到 `ABTestMetric`。
4) 胜者采纳：达到置信度后推送 Notification 并提供一键采纳。

