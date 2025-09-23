# Environment Setup — 环境与变量对齐（基于给定信息）

本说明用于本地与 Cloud Run 部署前的环境变量与资源对齐，结合 `docker-compose.yml` 与各服务配置加载逻辑。

## GCP / 区域 / Cloud SQL
- GOOGLE_CLOUD_PROJECT=gen-lang-client-0944935873
- 部署区域：asia-northeast1（东京）
- Cloud SQL（PostgreSQL）实例：autoads
- Cloud SQL 连接名（供 Proxy 使用）：`gen-lang-client-0944935873:asia-northeast1:autoads`

## Cloud SQL Proxy（docker-compose）
- 需要本机提供 GCP 服务账号密钥：`GOOGLE_APPLICATION_CREDENTIALS=./secrets/key.json`
- 在 `.env.local`（或等价环境）设置：
  - `CLOUDSQL_CONNECTION_NAME=gen-lang-client-0944935873:asia-northeast1:autoads`
  - `GOOGLE_APPLICATION_CREDENTIALS=./secrets/key.json`

## 数据库连接（服务侧）
- 优先使用 Secret Manager：`DATABASE_URL_SECRET_NAME=projects/<PROJECT>/secrets/DATABASE_URL/versions/latest`
- 本地开发可直接使用明文：`DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@cloudsql-proxy:5432/<DB_NAME>?sslmode=disable`

## Pub/Sub（单项目多环境/命名空间建议）
- 命名空间：使用 `STACK` 作为逻辑环境标识（如 `prod`, `sandbox-a`, `partner-x`），所有事件资源根据 `STACK` 拼接。
- 主题：`domain-events-<STACK>`（例如 `domain-events-prod`、`domain-events-sandbox-a`）
- 订阅：`<service>-sub-<STACK>`（例如 `offer-sub-prod`, `workflow-sub-sandbox-a`）
- 环境变量：
  - `ENV=development|staging|production`（仅控制校验与默认值）
  - `STACK=<logical-namespace>`（单项目多环境推荐必填）
  - `PUBSUB_TOPIC_ID` / `PUBSUB_SUBSCRIPTION_ID` 可省略；若省略且 `ENV!=development`，系统将使用 `STACK` 自动推导；无 `STACK` 时启动报错。

> 说明：仅 prod 项目也可并行多套逻辑环境，通过不同 `STACK` 值实现事件与任务队列隔离，避免相互影响。

## Firebase Admin
- 将 `secrets/firebase-adminsdk.json` 作为 Admin SDK 凭据（docker-compose 已挂载至相关服务）。
- 服务需要：`FIREBASE_CREDENTIALS_FILE=/app/secrets/firebase-adminsdk.json`

## SimilarWeb（Siterank 快扫）
- 免费端点，无需 Key：`SIMILARWEB_BASE_URL=https://data.similarweb.com/api/v1/data?domain=%s`

## 代理（Batchopen 初始配置）
- 美国代理（示例）：
  - `PROXY_URL_US=https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt`

## Google Ads API（Adscenter）
- 参考 `docs/google-ads-api-integration-manual.md` 与实际凭据（Developer Token、OAuth Client、Login Customer ID）。
- 建议变量：
  - `GOOGLE_ADS_DEVELOPER_TOKEN`
  - `GOOGLE_ADS_OAUTH_CLIENT_ID`
  - `GOOGLE_ADS_OAUTH_CLIENT_SECRET`
  - `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
  - `GOOGLE_ADS_REFRESH_TOKEN`（如使用服务端长期刷新）

## 前端订阅（无 Stripe）
- 订阅通过“联系客服”二维码弹窗完成（已在 `apps/frontend/public/Customer-service-QR-code.jpg`）。
- `/pricing` 页面已去除 Free，保留 Pro/Max/Elite，CTA 打开客服弹窗。

## 端口约定
- 容器内统一监听 `8080`（adscenter/siterank 已对齐）；compose 对应映射到不同宿主端口。

## 启动顺序建议（本地）
1. 准备 `.env.local` 与 `secrets/key.json`、`secrets/firebase-adminsdk.json`。
2. `docker compose up -d cloudsql-proxy`（确认 5432 连通）。
3. `docker compose up -d identity offer billing siterank workflow adscenter console frontend`。
4. 打开 `http://localhost:3000/pricing` 验证订阅弹窗；调用 `/health` 验证服务健康。

> 注：生产环境请优先使用 Secret Manager 注入 `DATABASE_URL`；Ads API/代理等敏感变量建议使用 Secret Manager 管理。
