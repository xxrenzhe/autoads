# Secrets Inventory — Secret Manager 键清单与服务映射

适用：GCP 项目 `gen-lang-client-0944935873`，区域 `asia-northeast1`。

说明：本清单仅列出 Secret 名称与用途，不包含任何敏感值。所有 Cloud Run 服务通过 `--set-secrets` 方式注入，或使用 `*_SECRET_NAME` 传递 Secret 引用路径（推荐）。

## 全局（所有服务通用）
- `DATABASE_URL`
  - 值：PostgreSQL 私网 DSN（Cloud SQL / VPC Connector）；建议值为私网地址，密码如包含特殊字符需 URL 编码。
  - 注入方式：
    - 推荐：`DATABASE_URL_SECRET_NAME=projects/<PROJECT_ID>/secrets/DATABASE_URL/versions/latest`
    - 或直接：`--set-secrets=DATABASE_URL=projects/<PROJECT_ID>/secrets/DATABASE_URL:latest`

## adscenter-service（Google Ads 集成）
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_OAUTH_CLIENT_ID`
- `GOOGLE_ADS_OAUTH_CLIENT_SECRET`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID`（MCC）
- `GOOGLE_ADS_REFRESH_TOKEN`
- Optional: `GOOGLE_ADS_TEST_CUSTOMER_ID`

## 其他服务（identity/offer/billing/workflow/siterank/batchopen）
- 仅需 `DATABASE_URL`（或 `DATABASE_URL_SECRET_NAME`）与通用 env（`ENV`、`STACK`、`GOOGLE_CLOUD_PROJECT`）。
- Pub/Sub：可显式配置 `PUBSUB_TOPIC_ID` 与 `PUBSUB_SUBSCRIPTION_ID`，或仅提供 `STACK` 由代码推导。

## 参考命令
详见：`docs/productrefactoring-v2/CloudRunEnv.md` 中的 `gcloud run services update` 示例（包含 `--set-secrets` 与通用 env 注入）。

## 校验
- 列表 Secret（名称）：`gcloud secrets list --project gen-lang-client-0944935873`
- 验证绑定：`gcloud run services describe <svc> --region asia-northeast1` 并检查 env/secret 挂载。

