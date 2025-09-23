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
- 服务健康（直连 best-effort）：adscenter/siterank/batchopen /health=200；其他服务 /health 返回 404（路由未定义或是 /healthz）

## 调整（代码就绪，待部署）
- 统一健康检查路由：为 identity/offer/workflow/billing 新增 `/health`（保留 `/healthz` 兼容），便于 API Gateway/监控统一探测。

## 部署更新（已完成）
- 重建并发布镜像：identity/offer/workflow/billing（Cloud Build → Artifact Registry → Cloud Run）
- 部署方式：保留既有 env/secrets，仅使用 `--update-env-vars`，避免覆盖 `DATABASE_URL_SECRET_NAME` 等关键变量
- 冒烟结果：
  - Gateway `/api/health`=200，受保护路由 `/api/v1/offers`=401（未携带 JWT）
  - 直连 `/health` 均返回 200：identity/offer/workflow/billing/adscenter/siterank/batchopen

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
- 前端（Firebase Hosting）
  - Hosting 配置与 GitHub Actions 已就绪（.github/workflows/deploy-frontend.yml，FIREBASE_SERVICE_ACCOUNT）
  - 方案一：Hosting → Cloud Run frontend（重写），Cloud Run 前端镜像构建中；修复 Next API 路由编译问题后切换
  - 方案二：Hosting frameworks（SSR）直接部署，受限于本地 npm 工具链问题，建议走 Actions 执行
- API Gateway 冒烟与前端联调（授权路由需提供 Firebase ID Token 验证 200/202）

## 下一步（MVP 路线）
- 网关冒烟验证与统一入口发布：autoads-gw-885pd7lz.an.gateway.dev（受保护路由 JWT 校验）
- Adscenter Pre-flight 扩展：联通 AccessibleCustomers/validate_only；完善诊断项
- 恢复 Billing/Workflow 的事件投影（改由 CF 订阅），服务内仅保留 HTTP 面

## 校验脚本（只读）
- 基础设施校验：`scripts/ops/verify-infra.sh`（列出 Secret/Cloud Run/API Gateway/PubSub；使用 `secrets/gcp_codex_dev.json` 激活 SA）
- 网关与服务冒烟：`scripts/ops/smoke-gateway.sh`（检查 `/api/health`=200、受保护路由=401 及服务 `/health(z)`）

说明：当前代理环境网络受限时，可在本地拉仓库执行上述脚本完成 MustKnowV2 的只读校验，不会读取或输出 Secret 值。
