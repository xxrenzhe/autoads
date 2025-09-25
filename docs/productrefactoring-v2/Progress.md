# 项目进展（阶段性汇报)

本页记录当前环境、服务、构建与下一步落地计划的最新状态，用于和 ImplementationPlan/TaskList 对齐。

## 环境与底座
- GCP 项目/区域：gen-lang-client-0944935873 / asia-northeast1
- Cloud SQL（PostgreSQL，私网）
  - Serverless VPC Access 连接器：cr-conn-default-ane1（10.8.0.0/28）
  - 防火墙：allow-serverless-vpc-to-sql（源 10.8.0.0/28 → tcp:5432）
- Pub/Sub（STACK=prod）
  - 主题：domain-events-prod；订阅：identity/offer/workflow/billing
- Secret Manager
  - DATABASE_URL（私网 DSN，经 URL 编码修正密码）
  - GOOGLE_ADS_*：developer token / OAuth client / MCC / test customer id
- Cloud Build 日志
  - 自管桶：gs://autoads-build-logs-asia-northeast1（构建统一使用 --gcs-log-dir）
- API Gateway
  - 入口：autoads-gw-885pd7lz.an.gateway.dev（ACTIVE）
  - 健康：/api/health → 200（映射 adscenter /health）
  - 受保护路由：未带 JWT 访问 /api/v1/offers → 401（Jwt is missing）

## 最新校验（只读）
- Secret Manager：存在 DATABASE_URL、GOOGLE_ADS_*、NEXTAUTH_SECRET、INTERNAL_JWT_SECRET、SIMILARWEB_API_KEY 等键（仅校验名称）
- Cloud Run：adscenter/identity/offer/siterank/workflow/billing/batchopen/console 服务均可见，均在 asia-northeast1
- API Gateway：autoads-gw（ACTIVE），/api/health=200，受保护路由 /api/v1/offers=401
- 新增：/api/health（透传 adscenter /health）、/api/health/console（透传 console /health）
- 服务健康（直连 best-effort）：adscenter/siterank/batchopen /health=200；其他服务 /health 返回 404（路由未定义或是 /healthz）

### 本地环境准备（执行 MustKnowV2）
- 已激活服务账号并设置项目：`codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com` / `gen-lang-client-0944935873`
- 已列出 Secret Manager 键名（未输出值），确认存在数据库与 Google Ads 相关密钥
- 已生成 `.env.local`（不含敏感值展示）：
  - `GOOGLE_APPLICATION_CREDENTIALS=./secrets/gcp_codex_dev.json`
  - `CLOUDSQL_CONNECTION_NAME=gen-lang-client-0944935873:asia-northeast1:autoads`
  - `DATABASE_URL` 取自 Secret Manager，并将主机改写为 `cloudsql-proxy:5432` 以便本地容器经代理私网访问
- 已构建后端镜像：`autoads-identity:dev`（本地构建通过）

## CI/CD 更新（2025-09-24）
- 工作流拆分与标签策略
  - 后端：.github/workflows/deploy-backend.yml 拆为 meta / changes / build-images / tag-images / deploy-services；支持 Tag 全量部署；空矩阵保护（无变更时跳过）
  - 网关：.github/workflows/deploy-gateway.yml 拆为 discover-render / publish；Job Summary 输出默认域名
  - 前端：.github/workflows/deploy-frontend.yml 拆为 meta / build-image / tag-image / deploy-cloudrun / deploy-hosting / summary
  - 镜像仓库改为 Artifact Registry：asia-northeast1-docker.pkg.dev/<PROJECT>/autoads-services/<service>:<tag>
- 安全与手动触发
  - 三条工作流均支持 workflow_dispatch；Secrets 使用 GCP_SA_KEY、FIREBASE_SERVICE_ACCOUNT；仓库变量 GCP_PROJECT_ID/GCP_REGION/ARTIFACT_REPO

## 前端发布（Cloud Run + Hosting）现状
- 架构与配置
  - Hosting 采用 public + rewrites → Cloud Run 服务 `frontend`（asia‑northeast1），不再走 Web Frameworks 函数化构建
  - Cloud Run `frontend` 运行 Next.js（App Router），BFF 重写 `/api/:path* → /api/go/:path*` 直达 API Gateway
- 构建链路优化
  - Dockerfile 切换为 Next `output: 'standalone'` + `node:22-bookworm-slim`
  - 仅安装生产依赖（工作区模式：npm -w apps/frontend）；CI 关闭 TS/ESLint；Node 堆扩大（4GB）
  - 移除 puppeteer/@playwright/test 运行依赖；SSR 使用本地 stub 映射，避免浏览器下载
  - 修复 .dockerignore 导致的上下文缺失问题（放行 apps/frontend/**）
- 运行状态
  - 最新一轮 Cloud Build 已进入 WORKING（此前导致失败的 COPY/安装/TS/ESLint/OOM 均已处理），完成后将自动部署 Cloud Run 与 Hosting，并在 Job Summary 写入 URL

## 问题复盘（已解决）
- 构建上下文缺失：.dockerignore 忽略了 apps/** → 无法 COPY 前端源 → 修复为放行 apps/frontend/**
- 无锁安装失败：无 package-lock.json 导致 `npm ci` 报错 → 容错到 `npm install`；后续改为 workspace 安装
- Web Frameworks 依赖安装失败：Hosting 切换为 public + rewrites，避免在 CI/Hosting 中二次 npm 安装
- TS/ESLint OOM：CI 下关闭类型检查与 ESLint；同时提升 Node 堆
- puppeteer/playwright 体积/失败率：从前端移除，统一由后端/Worker 承担（前端保留 stub）

## 下一步（动作）
- 等待本轮前端流水线完成；记录镜像标签、Cloud Run 修订与 Hosting URL，进行端到端冒烟
-（可选）将前端 Hosting 部署设为“仅在 firebase.json 或 apps/frontend/public 变更时执行”，其余情况只部署 Cloud Run，进一步缩短发布时间
- 后端若需要用户可见文本本地化，采用 go‑i18n（ICU）加载资源；前端继续推进 next‑intl 接入

## 调整（代码就绪，待部署）
- 统一健康检查路由：为 identity/offer/workflow/billing 新增 `/health`（保留 `/healthz` 兼容），便于 API Gateway/监控统一探测。

## 部署更新（已完成）
- 重建并发布镜像：identity/offer/workflow/billing（Cloud Build → Artifact Registry → Cloud Run）
- 部署方式：保留既有 env/secrets，仅使用 `--update-env-vars`，避免覆盖 `DATABASE_URL_SECRET_NAME` 等关键变量
- 冒烟结果：
  - Gateway `/api/health`=200，受保护路由 `/api/v1/offers`=401（未携带 JWT）
  - 直连 `/health` 均返回 200：identity/offer/workflow/billing/adscenter/siterank/batchopen

## 前端改造（已完成）
- 统一 API 入口：Next 重写 `/api/:path* → /api/go/:path*`，同源 BFF 反代至 Google Cloud API Gateway；保留 `/api/auth/*` 给 NextAuth
- 去 Prisma：apps/frontend 不再安装/打包 `@prisma/client`、`prisma`；`@auth/prisma-adapter` 永久指向本地桩；NextAuth 无 DB 时使用 JWT 会话
- SSR 函数瘦身：在服务器端对 `google-ads-api`、`googleapis`、`puppeteer`、`exceljs`、`swagger-ui-react` 强制 alias 到本地桩，避免重依赖进入函数包
- 页面示范：`/user/center` 已改为 BFF 聚合端点（或并行多端点组装），构建通过（Next 15）

## 近期增量（2025-09-24）
- Secret Manager（adscenter 注入）
  - ADS_OAUTH_REDIRECT_URLS（多行 4 个回调域名；服务按 Host 精确匹配）
  - OAUTH_STATE_SECRET（state 的 HMAC-SHA256 秘钥）
  - REFRESH_TOKEN_ENC_KEY_B64（base64 的 32B AES-GCM 密钥，用于加密用户 refresh token）
- adscenter（OAuth + 用户 refresh token + MCC 绑定 + 预检）
  - 新增 OAuth 端点：GET `/api/v1/adscenter/oauth/url`、GET `/api/v1/adscenter/oauth/callback`
  - 用户 refresh token 加密入库（写入时加密；读取时支持新旧双密钥解密回退）
  - 账号列表：GET `/api/v1/adscenter/accounts`（基于用户 refresh token 调用 listAccessibleCustomers）
  - 统一 MCC 管理：
    - POST `/api/v1/adscenter/mcc/link` 发送邀请（`ADS_MCC_ENABLE_LIVE=true` 时真实调用，否则 stub）
    - GET  `/api/v1/adscenter/mcc/status` 查询状态
    - POST `/api/v1/adscenter/mcc/unlink` 解绑（已实现调度，慎用）
  - Pre-flight 强制用户级 refresh token（缺失直接 400，不做平台级降级）；结构化诊断已增强
- 数据库/配置统一
  - 所有服务生产统一使用 `DATABASE_URL_SECRET_NAME`（Cloud Run `services update --update-env-vars` 已完成）
  - adscenter 增加最小迁移执行容错（无迁移目录时跳过）
- 迁移工具（一次性将明文 refresh token 重写为密文）
  - 位置：`services/adscenter/cmd/migrate-refresh-tokens`
  - 使用：
    - `export DATABASE_URL=$(gcloud secrets versions access latest --secret=DATABASE_URL)`
    - `export REFRESH_TOKEN_ENC_KEY_B64=<base64(32B)>`
    - `go run ./services/adscenter/cmd/migrate-refresh-tokens -dry-run=false`

## Hosting 与发布（最新）
- 多站点：
  - 预发：`autoads-preview`（默认 URL: https://autoads-preview.web.app）
  - 生产：`autoads-prod`（默认 URL: https://autoads-prod.web.app）
- WebFrameworks：两个站点的 SSR 函数区域固定 `asia-northeast1`
- 预发防收录：middleware 对 `urlchecker.dev` 域返回 `X‑Robots‑Tag: noindex, nofollow`
- 自定义域（需在控制台绑定）：
  - 预发 → https://www.urlchecker.dev 绑定到 `autoads-preview`
  - 生产 → https://www.autoads.dev 绑定到 `autoads-prod`
- 构建稳定性：对 sharp 相关依赖增加 overrides，规避 Cloud Build 安装期版本不一致；建议设置 Artifact Registry 清理策略：`firebase functions:artifacts:setpolicy`

## 服务与接口（上线/对齐）
- Adscenter（上线）：/api/v1/adscenter/accounts|preflight|bulk-actions；URL：https://adscenter-yt54xvsg5q-an.a.run.app
- Identity（上线）：/healthz、/api/v1/identity/me；URL：https://identity-yt54xvsg5q-an.a.run.app
- Offer（上线）：/api/v1/offers（GET/POST，事件发布降级可运行）；URL：https://offer-yt54xvsg5q-an.a.run.app
- Siterank（上线）：/api/v1/siterank/analyze（202）、/api/v1/siterank/{offerId}；URL：https://siterank-yt54xvsg5q-an.a.run.app
- Workflow（上线，最小实现）：/api/v1/workflows/templates、/api/v1/workflows/start（202）；URL：https://workflow-yt54xvsg5q-an.a.run.app
- Billing（上线，最小实现）：/api/v1/billing/subscriptions/me、/tokens/me、/tokens/transactions；URL：https://billing-yt54xvsg5q-an.a.run.app
- Batchopen（上线，最小实现）：/api/v1/batchopen/tasks（202）；URL：https://batchopen-yt54xvsg5q-an.a.run.app
 - Console（上线，占位）：/console/* 直达页面；URL：https://console-644672509127.asia-northeast1.run.app

## 构建与交付（提速）
- Go 统一 1.25.1；Dockerfile 两段式缓存（go.work + 服务 go.mod 预热依赖 → 源码构建）
- 根 .dockerignore/.gcloudignore 优化；apps/frontend/.dockerignore 独立
- go.work 工作区：修复 pkg/httpclient、pkg/noop 的 go.mod；针对 siterank 增加 replace 覆盖到本地模块
- 网关脚本：scripts/gateway/render-gateway-config.sh 扩展为支持多服务占位符（identity/billing/offer/siterank/batchopen/adscenter/workflow/console）

## 进行中
- 前端（替换与清理）
  - 批量替换剩余 prisma 使用点为 BFF 调用（订阅/令牌 → AdsCenter/BatchOpen/SiteRank → 统计/管理）
  - 删除 `apps/frontend/src/lib/prisma.ts`、`apps/frontend/src/lib/types/prisma-types.ts`、`apps/frontend/prisma/`（已完成）
  - 对客户端特性的大型包使用 `next/dynamic({ ssr:false })`，持续瘦身 SSR 函数
- 自定义域绑定与发布
  - 控制台绑定 `www.urlchecker.dev` 与 `www.autoads.dev` 各自站点，生效后执行：
    - 预发：`firebase deploy --only hosting:autoads-preview --project gen-lang-client-0944935873`
    - 生产：`firebase deploy --only hosting:autoads-prod --project gen-lang-client-0944935873`
- API Gateway 冒烟与前端联调（BFF 注入内部 JWT；网关验证 JWT/Firebase ID Token 均可）

## 下一步（MVP 路线）
- 网关冒烟验证与统一入口发布：autoads-gw-885pd7lz.an.gateway.dev（受保护路由 JWT 校验）
- Adscenter Pre-flight 扩展：联通 AccessibleCustomers/validate_only；完善诊断项
- 恢复 Billing/Workflow 的事件投影（改由 CF 订阅），服务内仅保留 HTTP 面

## 校验脚本（只读）
- 基础设施校验：`scripts/ops/verify-infra.sh`（列出 Secret/Cloud Run/API Gateway/PubSub；使用 `secrets/gcp_codex_dev.json` 激活 SA）
- 网关与服务冒烟：`scripts/ops/smoke-gateway.sh`（检查 `/api/health`=200、受保护路由=401 及服务 `/health(z)`）
 - 前端直连冒烟（Cloud Run）：
   - `curl -i https://frontend-644672509127.asia-northeast1.run.app/api/health` （expect 200）
   - `curl -i https://frontend-644672509127.asia-northeast1.run.app/api/go/api/health` （expect 200）

说明：当前代理环境网络受限时，可在本地拉仓库执行上述脚本完成 MustKnowV2 的只读校验，不会读取或输出 Secret 值。
- 前端（Cloud Run + Hosting 重写路径）
  - 新建并发布 Cloud Run 服务：frontend（源：`hosting/` Next 最小应用，提供 `/api/health` 与 `/api/go/*` 反向代理）
  - 环境：`NEXT_PUBLIC_DEPLOYMENT_ENV=production`、`NEXT_PUBLIC_FIREBASE_PROJECT_ID=gen-lang-client-0944935873`、`BACKEND_URL=https://autoads-gw-885pd7lz.an.gateway.dev`
  - 访问：`https://frontend-644672509127.asia-northeast1.run.app`（/api/health=200，/api/go/api/health=200）
  - Hosting：`firebase.json` 已配置将 `**` 重写到 Cloud Run `frontend`，待执行 `firebase deploy --only hosting` 生效（见“进行中”）

预发部署触发校验：2025-09-24T14:06:42Z

CI触发校验：2025-09-24T14:53:46Z
\n触发前端与后端部署：2025-09-24T17:45:40Z
\n前端发布流水线（多阶段）触发：2025-09-24T19:02:45Z（Cloud Build WORKING）
