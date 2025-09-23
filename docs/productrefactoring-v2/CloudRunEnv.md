# Cloud Run 环境变量与 Secret 清单（单项目多环境 / STACK）

适用：GCP 项目 `gen-lang-client-0944935873`，区域 `asia-northeast1`。基础设施公用，通过 `STACK` 实现逻辑隔离（事件与任务队列）。

通用要求（所有服务）
- ENV=production
- STACK=<逻辑命名空间>（如 `prod`/`sandbox-a`/`partner-x`）
- GOOGLE_CLOUD_PROJECT=gen-lang-client-0944935873
- DATABASE_URL_SECRET_NAME=projects/gen-lang-client-0944935873/secrets/DATABASE_URL/versions/latest
- Pub/Sub（两种方式二选一）
  - 显式设置：
    - PUBSUB_TOPIC_ID=domain-events-<STACK>
    - PUBSUB_SUBSCRIPTION_ID=<service>-sub-<STACK>
  - 或仅提供 STACK：代码将自动推导 Topic/Subscription（非 development 必须至少提供 STACK）。

建议：将下列敏感变量使用 Secret Manager 注入（Cloud Run --set-secrets），避免明文。

## identity-service
- 必需：ENV, STACK, GOOGLE_CLOUD_PROJECT, DATABASE_URL_SECRET_NAME
- Pub/Sub：PUBSUB_TOPIC_ID, PUBSUB_SUBSCRIPTION_ID（或用 STACK 推导）
- 业务：SUPER_ADMIN_EMAIL=<你的管理员邮箱>

## offers-service（offer）
- 必需：ENV, STACK, GOOGLE_CLOUD_PROJECT, DATABASE_URL_SECRET_NAME
- Pub/Sub：PUBSUB_TOPIC_ID, PUBSUB_SUBSCRIPTION_ID（或用 STACK 推导）

## billing-service
- 必需：ENV, STACK, GOOGLE_CLOUD_PROJECT, DATABASE_URL_SECRET_NAME
- Pub/Sub：PUBSUB_TOPIC_ID, PUBSUB_SUBSCRIPTION_ID（或用 STACK 推导）

## workflow-service
- 必需：ENV, STACK, GOOGLE_CLOUD_PROJECT, DATABASE_URL_SECRET_NAME
- Pub/Sub：PUBSUB_TOPIC_ID, PUBSUB_SUBSCRIPTION_ID（或用 STACK 推导）
- 可选：跨服务调用 URL（建议后续统一走 API Gateway，减少直连配置）

## siterank-service
- 必需：ENV, STACK, GOOGLE_CLOUD_PROJECT, DATABASE_URL_SECRET_NAME
- 可选：SIMILARWEB_BASE_URL=https://data.similarweb.com/api/v1/data?domain=%s（默认即为该免费端点）

## adscenter-service
- 必需：ENV, STACK, GOOGLE_CLOUD_PROJECT
- 必需（Secret 注入推荐）：
  - GOOGLE_ADS_DEVELOPER_TOKEN
  - GOOGLE_ADS_OAUTH_CLIENT_ID
  - GOOGLE_ADS_OAUTH_CLIENT_SECRET
  - GOOGLE_ADS_LOGIN_CUSTOMER_ID（MCC，如 5010618892）
  - GOOGLE_ADS_REFRESH_TOKEN（由授权用户生成）
- 可选：GOOGLE_ADS_TEST_CUSTOMER_ID（测试账户 ID）

> 说明：adscenter 当前 Pre-flight 仅做凭据与格式校验；后续将增加 AccessibleCustomers 探测与 validate_only 检查。

## 注入 Secret 的方式（示例）
使用 gcloud CLI 为 Cloud Run 设置 env secrets：

```
gcloud run services update adscenter \
  --region=asia-northeast1 \
  --set-env-vars=ENV=production,STACK=prod,GOOGLE_CLOUD_PROJECT=gen-lang-client-0944935873 \
  --set-secrets=GOOGLE_ADS_DEVELOPER_TOKEN=projects/gen-lang-client-0944935873/secrets/GOOGLE_ADS_DEVELOPER_TOKEN:latest,\
GOOGLE_ADS_OAUTH_CLIENT_ID=projects/gen-lang-client-0944935873/secrets/GOOGLE_ADS_OAUTH_CLIENT_ID:latest,\
GOOGLE_ADS_OAUTH_CLIENT_SECRET=projects/gen-lang-client-0944935873/secrets/GOOGLE_ADS_OAUTH_CLIENT_SECRET:latest,\
GOOGLE_ADS_LOGIN_CUSTOMER_ID=projects/gen-lang-client-0944935873/secrets/GOOGLE_ADS_LOGIN_CUSTOMER_ID:latest,\
GOOGLE_ADS_REFRESH_TOKEN=projects/gen-lang-client-0944935873/secrets/GOOGLE_ADS_REFRESH_TOKEN:latest
```

数据库 URL（通用）：
```
gcloud run services update identity \
  --region=asia-northeast1 \
  --set-env-vars=ENV=production,STACK=prod,GOOGLE_CLOUD_PROJECT=gen-lang-client-0944935873 \
  --set-env-vars=PUBSUB_TOPIC_ID=domain-events-prod,PUBSUB_SUBSCRIPTION_ID=identity-sub-prod \
  --set-secrets=DATABASE_URL_SECRET_NAME=projects/gen-lang-client-0944935873/secrets/DATABASE_URL:latest
```

