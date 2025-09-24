# CI/CD（Cloud Run + API Gateway + Firebase Hosting）

本文档说明如何配置 GitHub Actions 的密钥与环境，以自动构建并部署后端到 Cloud Run、前端到 Firebase Hosting，并发布 API Gateway。

## 必要的 GitHub Secrets

- `GCP_PROJECT_ID`: `gen-lang-client-0944935873`
- `GCP_REGION`: `asia-northeast1`（可选，默认该值）
- `GCP_SA_KEY`: 一个具备 Cloud Build / Artifact Registry / Cloud Run / API Gateway / Service Usage 权限的服务账号 JSON（推荐最小权限：`run.admin`、`cloudbuild.builds.editor`、`artifactregistry.admin`、`apigateway.admin`、`serviceusage.serviceUsageAdmin`）
- `FIREBASE_SERVICE_ACCOUNT`: Firebase Hosting 部署用服务账号 JSON（可由 Firebase 控制台生成，最小：Hosting 的发布权限）
\- （可选）Repository Variables：
  - `GCP_REGION`: `asia-northeast1`
  - `ARTIFACT_REPO`: `autoads-services`（Artifact Registry 代码库名）

> 注意：业务数据库等敏感配置不写入 GitHub Secrets，全部放在 Google Cloud Secret Manager 中，部署时依赖 `--set-secrets` 与 `DATABASE_URL_SECRET_NAME` 注入。

## 工作流说明

### 后端（Cloud Run + Artifact Registry）
- 文件：`.github/workflows/deploy-backend.yml`
- 触发：
  - 推送到 `main` → 环境：preview；镜像标签：`preview-latest`、`preview-<commit>`；部署到 Cloud Run（`asia-northeast1`）
  - 推送到 `production` → 环境：prod；镜像标签：`prod-latest`、`prod-<commit>`；部署到 Cloud Run（`asia-northeast1`）
  - 推送 tag（`v*`）→ 环境：prod；镜像标签：`prod-<tag>`、`prod-<commit>`；部署到 Cloud Run（`asia-northeast1`）
\- 镜像仓库：Google Cloud Artifact Registry，仓库名 `autoads-services`，镜像前缀：`<REGION>-docker.pkg.dev/<PROJECT_ID>/autoads-services/<service>`
\- 分阶段 Job：
  - meta：计算环境与镜像标签（primary/secondary）
  - changes：检测变更服务，输出矩阵
  - build-images：使用 Cloud Build 构建主标签镜像
  - tag-images：添加第二标签（避免重建）
  - deploy-services：使用主标签镜像部署到 Cloud Run（不覆盖运行时 env/secrets）
\- 变更检测：仅对变更过的服务进行构建与部署（脚本 `scripts/deploy/detect-changed-services.sh` 动态生成矩阵）
\- 版本发布：当触发 Tag（`v*`）构建时，强制全量部署所有服务（忽略变更检测）

### 网关（API Gateway）
- 文件：`.github/workflows/deploy-gateway.yml`
- 触发：推送到 `main/production` 或发布 Tag（`v*`），且任一变更命中 `deployments/api-gateway/gateway.yaml`、`scripts/gateway/**` 或 `services/**`
- 环境映射：`main` → preview（`autoads-api-preview`/`autoads-gw-preview`），`production`/Tag → prod（`autoads-api-prod`/`autoads-gw-prod`）
- 动作：
  - 发现各 Cloud Run 服务 URL（`gcloud run services describe`）
  - 渲染 gateway.yaml（替换 `*-REPLACE_WITH_RUN_URL` 占位符）
  - 创建/更新 API 与 Gateway 实例
  - 可观测性：在 Job Summary 中输出 Gateway 默认域名，便于回溯

### 前端（Firebase Hosting）
- 文件：`.github/workflows/deploy-frontend.yml`
- 触发：
  - 推送到 `main` → 部署到站点 `autoads-preview`
  - 推送到 `production` 或 tag（`v*`）→ 部署到站点 `autoads-prod`
- 动作：
  - 安装依赖并构建（Turbo/Next）
  - 使用 `FirebaseExtended/action-hosting-deploy` 发布到目标站点（`channelId: live`）
  - 构建缓存：启用 `actions/setup-node` 的 npm 缓存与 `.turbo`/`.next/cache` 目录缓存，加速重复构建

## 本地一键部署脚本（可选）

- `scripts/deploy/cloudrun-deploy.sh`: 云端构建镜像并部署 Cloud Run。
- `scripts/gcp/grant-run-sa.sh`: 自动为 Cloud Run 运行时服务账号授予常用权限（SecretManager/CloudSQL/PubSub）。
- `scripts/gateway/render-gateway-config.sh`: 渲染 API Gateway OpenAPI（替换 Cloud Run URL 占位符）。
- `scripts/gateway/deploy-gateway.sh`: 创建/更新 API 与 Gateway。

## 受保护路由联测

渲染/发布网关后，使用 `scripts/tests/gateway-smoke.sh` 做冒烟：

```bash
GATEWAY_HOST=<your-gateway-hostname> bash scripts/tests/gateway-smoke.sh
GATEWAY_HOST=<your-gateway-hostname> bash scripts/tests/gateway-smoke.sh <FIREBASE_ID_TOKEN>
```

未带 JWT 访问受保护路由应返回 401，带合法 ID Token 返回 200。
