网关配置渲染与部署

目标：将 `deployments/gateway/gateway.v2.yaml` 渲染为包含真实 Project 与后端 URL 的配置，并部署至 Google Cloud API Gateway，实现统一入口与 Firebase Bearer 校验。

步骤
- 准备环境变量：
  - `PROJECT_ID`（或 `GOOGLE_CLOUD_PROJECT`）
  - 各后端 Cloud Run HTTPS URL（包含 https:// 前缀）：
    - `SITERANK_URL`、`ADSCENTER_URL`、`BATCHOPEN_URL`、`BILLING_URL`、`OFFER_URL`、`NOTIFICATIONS_URL`、`RECOMMENDATIONS_URL`、`CONSOLE_URL`
- 渲染（可使用 sed/envsubst，示例）：
  - 将文件内 `<PROJECT_ID>` 替换为项目 ID
  - 将 `*-REPLACE_WITH_RUN_URL` 替换为相应的 Cloud Run URL
  - 输出至 `deployments/gateway/gateway.v2.rendered.yaml`
- 部署示例命令（参考）：
  - `gcloud api-gateway apis create autoads-api --project=$PROJECT_ID || true`
  - `gcloud api-gateway api-configs create autoads-v2 --api=autoads-api --openapi-spec=deployments/gateway/gateway.v2.rendered.yaml --project=$PROJECT_ID`
  - `gcloud api-gateway gateways create autoads-gw --api=autoads-api --api-config=autoads-v2 --location=asia-northeast1 --project=$PROJECT_ID`

一键自动渲染（推荐）
- 使用脚本 `deployments/scripts/render-gateway-auto.sh` 自动发现 Cloud Run 服务 URL 并渲染：
  - 支持 `STACK=dev|preview|prod`：优先发现 `service-STACK`，找不到则回退到 `service`
  - 示例：`PROJECT_ID=gen-lang-client-0944935873 REGION=asia-northeast1 STACK=preview ./deployments/scripts/render-gateway-auto.sh`
  - 输出文件：`deployments/gateway/gateway.v2.rendered.yaml`

说明
- gateway.v2.yaml 已开启 `securityDefinitions.firebase`，替换 `<PROJECT_ID>` 后即可通过 API Gateway 验证 Firebase Bearer Token，无需独立 Identity 服务。
- 若需要，我可以补充自动渲染脚本（Bash），一键替换占位符并生成 rendered 配置。
 - 本仓库已内置自动渲染脚本，支持基于 `STACK` 的环境隔离命名规范。
