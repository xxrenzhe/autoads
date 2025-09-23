# Operations — 运维与配置（摘要）

## 部署与环境
- 后端：Cloud Build → Artifact Registry → Cloud Run；事件处理：Cloud Functions。
- 前端：Next.js → Firebase Hosting（生产建议 ISR/SSG）。
  - 方案一（当前推荐）：Firebase Hosting 重写至 Cloud Run frontend 服务（region: asia-northeast1）。
  - 方案二：Firebase Hosting frameworks（SSR）直接部署（使用 GitHub Actions 避免本地工具链冲突）。
- 网关：API Gateway（JWT 校验与路由）。

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
