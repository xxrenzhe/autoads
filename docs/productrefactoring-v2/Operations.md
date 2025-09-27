# Operations — 运维与配置（摘要）

## 部署与环境
- 后端：Cloud Build → Artifact Registry → Cloud Run；事件处理：Cloud Functions。
- 前端：Next.js → Firebase Hosting（生产建议 ISR/SSG）。
  - 方案一（当前推荐）：Firebase Hosting 重写至 Cloud Run frontend 服务（region: asia-northeast1）。
  - 方案二：Firebase Hosting frameworks（SSR）直接部署（使用 GitHub Actions 避免本地工具链冲突）。
- 网关：API Gateway（JWT 校验与路由）。

### CI/CD 触发策略（主干）
- 推送到 `main`：预发（preview）环境构建与部署；镜像标注 `preview-latest`、`preview-<commit>`；Hosting 目标 `autoads-preview`。
- 推送到 `production`：生产（prod）环境构建与部署；镜像标注 `prod-latest`、`prod-<commit>`；Hosting 目标 `autoads-prod`。
- 推送 tag（`v*`）：生产（prod）版本发布；镜像标注 `prod-<tag>`、`prod-<commit>`；Hosting 目标 `autoads-prod`。

## 配置与密钥
- Secret Manager：DATABASE_URL、外部 API Key 等；以 *_SECRET_NAME 注入。
- Firebase Admin：生产用 ADC，开发用 JSON（不推荐）。
  - Hosting/CI：FIREBASE_SERVICE_ACCOUNT（secrets 内容为 firebase-adminsdk-fbsvc@gen-lang-client-0944935873.iam.gserviceaccount.com 的 JSON）。

## 配置中心（后台）
- 套餐/限额/Token 规则：版本、灰度、生效时间、审计。
- 模板与国家曲线库：新增/下发/回滚；标记“系统默认”。

## Runbook（例）
- 评估失败排查：SimilarWeb 限额/网络、重定向失败、降级策略。
- 批量异常回滚：通过审计快照一键回滚，生成工单与告警。
- 仿真质量偏低：检查代理/Referer/UA 权重配置与地域一致性。

## 定时任务（推荐方案）

为降低 OIDC 配置复杂度与跨服务鉴权不一致带来的 401/5xx 风险，定时作业统一采用：Scheduler → Pub/Sub → Cloud Functions(Dispatcher) → 服务 HTTP。

步骤：
1) 部署分发函数（Gen2）：`deployments/scripts/create-pubsub-dispatcher.sh`
2) 使用 `deployments/scripts/create-scheduler-pubsub-dispatch.sh` 创建 Pub/Sub 作业，设置：
   - `TOPIC=jobs-dispatcher`
   - `URL` 指向目标服务 API，例如：
     - 执行 tick：`https://<adscenter>/api/v1/adscenter/bulk-actions/execute-tick?max=2`
     - KPI 分片日更：`https://<offer>/api/v1/offers/internal/kpi/aggregate-daily?shard=0&totalShards=4`
   - `HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'`

示例（execute-tick）：
```bash
PROJECT_ID=gen-lang-client-0944935873 REGION=asia-northeast1 \
INTERNAL_SERVICE_TOKEN=xxxx ./deployments/scripts/create-pubsub-dispatcher.sh

PROJECT_ID=gen-lang-client-0944935873 REGION=asia-northeast1 TOPIC=jobs-dispatcher \
SCHEDULE="*/5 * * * *" \
URL="https://<adscenter>/api/v1/adscenter/bulk-actions/execute-tick?max=2" \
HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}' \
./deployments/scripts/create-scheduler-pubsub-dispatch.sh
```

注意：旧的 HTTP+OIDC 调度脚本已标注 DEPRECATED，仅作兼容保留。

## 执行指引（Hosting）
- GitHub Actions（推荐）：
  - 配置仓库 Secrets：`FIREBASE_SERVICE_ACCOUNT`
  - 推送 main 分支触发 `.github/workflows/deploy-frontend.yml`
- 本地（可选）：
  - 安装 firebase-tools，登录/使用服务账号，执行 `firebase deploy --only hosting --project gen-lang-client-0944935873`
  - 若使用“重写至 Cloud Run frontend”，先完成 Cloud Run 前端部署，再更新 firebase.json rewrites 的 serviceId

## 安全部署注意事项（Cloud Run）
- 更新配置时优先使用 `--update-env-vars` 而非 `--set-env-vars`，避免覆盖已有的 secrets/env（如 `DATABASE_URL_SECRET_NAME`）。
- 若服务通过 Secret Manager 注入 env：
  - identity：使用 `DATABASE_URL_SECRET_NAME`（推荐）
  - 其他服务：可直接注入 `DATABASE_URL`（`--set-secrets=DATABASE_URL=projects/<PROJECT>/secrets/DATABASE_URL:latest`）
- 脚本：`scripts/deploy/cloudrun-deploy.sh` 默认使用安全更新模式；如需强制注入 Secret，可设置 `FORCE_SET_SECRETS=1`。
