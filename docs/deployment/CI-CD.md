# CI/CD（Cloud Run + API Gateway + Firebase Hosting）

本文档说明如何配置 GitHub Actions 的密钥与环境，以自动构建并部署后端到 Cloud Run、前端到 Firebase Hosting，并发布 API Gateway。

## 必要的 GitHub Secrets

- `GCP_PROJECT_ID`: `gen-lang-client-0944935873`
- `GCP_REGION`: `asia-northeast1`（可选，默认该值）
- `GCP_SA_KEY`: 一个具备 Cloud Build / Artifact Registry / Cloud Run / API Gateway / Service Usage 权限的服务账号 JSON（推荐最小权限：`run.admin`、`cloudbuild.builds.editor`、`artifactregistry.admin`、`apigateway.admin`、`serviceusage.serviceUsageAdmin`）
- `FIREBASE_SERVICE_ACCOUNT`: Firebase Hosting 部署用服务账号 JSON（可由 Firebase 控制台生成，最小：Hosting 的发布权限）

> 注意：业务数据库等敏感配置不写入 GitHub Secrets，全部放在 Google Cloud Secret Manager 中，部署时依赖 `--set-secrets` 与 `DATABASE_URL_SECRET_NAME` 注入。

## 工作流说明

### 后端（Cloud Run）
- 文件：`.github/workflows/deploy-backend.yml`
- 触发：推送到 `main` 且路径命中 `services/**`
- 动作：
  - 使用 Cloud Build 构建并推送镜像到 Artifact Registry
  - 部署 Cloud Run，设置 `DATABASE_URL_SECRET_NAME`，并通过 `--set-secrets` 注入 Secret Manager 中的 `DATABASE_URL`

### 网关（API Gateway）
- 文件：`.github/workflows/deploy-gateway.yml`
- 触发：推送到 `main`，变更了 `deployments/api-gateway/gateway.yaml` 或后端服务
- 动作：
  - 渲染 gateway.yaml（自动查询 Cloud Run 服务 URL 并替换占位符）
  - 创建/更新 API 与 Gateway 实例

### 前端（Firebase Hosting）
- 文件：`.github/workflows/deploy-frontend.yml`
- 触发：推送到 `main`，变更 `apps/frontend/**`
- 动作：
  - 安装依赖并构建
  - 使用 `FirebaseExtended/action-hosting-deploy` 部署到 Hosting（`channelId: live`）

## 本地一键部署脚本（可选）

- `scripts/deploy/cloudrun-deploy.sh`: 云端构建镜像并部署 Cloud Run。
- `scripts/gcp/grant-run-sa.sh`: 自动为 Cloud Run 运行时服务账号授予常用权限（SecretManager/CloudSQL/PubSub）。
- `scripts/deploy/render-gateway.sh`: 渲染 API Gateway OpenAPI（替换 Cloud Run URL）。
- `scripts/deploy/gateway-deploy.sh`: 创建/更新 API 与 Gateway。

## 受保护路由联测

渲染/发布网关后，使用 `scripts/tests/gateway-smoke.sh` 做冒烟：

```bash
GATEWAY_HOST=<your-gateway-hostname> bash scripts/tests/gateway-smoke.sh
GATEWAY_HOST=<your-gateway-hostname> bash scripts/tests/gateway-smoke.sh <FIREBASE_ID_TOKEN>
```

未带 JWT 访问受保护路由应返回 401，带合法 ID Token 返回 200。

