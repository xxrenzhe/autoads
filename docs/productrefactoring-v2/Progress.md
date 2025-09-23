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

## 服务与接口（上线/对齐）
- Adscenter（上线）：/api/v1/adscenter/accounts|preflight|bulk-actions；URL：https://adscenter-yt54xvsg5q-an.a.run.app
- Identity（上线）：/healthz、/api/v1/identity/me；URL：https://identity-yt54xvsg5q-an.a.run.app
- Offer（上线）：/api/v1/offers（GET/POST，事件发布降级可运行）；URL：https://offer-yt54xvsg5q-an.a.run.app
- Siterank（上线）：/api/v1/siterank/analyze（202）、/api/v1/siterank/{offerId}；URL：https://siterank-yt54xvsg5q-an.a.run.app
- Workflow（上线，最小实现）：/api/v1/workflows/templates、/api/v1/workflows/start（202）；URL：https://workflow-yt54xvsg5q-an.a.run.app
- Billing（上线，最小实现）：/api/v1/billing/subscriptions/me、/tokens/me、/tokens/transactions；URL：https://billing-yt54xvsg5q-an.a.run.app
- Batchopen（上线，最小实现）：/api/v1/batchopen/tasks（202）；URL：https://batchopen-yt54xvsg5q-an.a.run.app

## 构建与交付（提速）
- Go 统一 1.25.1；Dockerfile 两段式缓存（go.work + 服务 go.mod 预热依赖 → 源码构建）
- 根 .dockerignore/.gcloudignore 优化；apps/frontend/.dockerignore 独立
- go.work 工作区：修复 pkg/httpclient、pkg/noop 的 go.mod；针对 siterank 增加 replace 覆盖到本地模块
- 网关脚本：scripts/gateway/render-gateway-config.sh 扩展为支持多服务占位符（identity/billing/offer/siterank/batchopen/adscenter/workflow/console）

## 进行中
- Console 镜像构建与上线（UI 占位）
- API Gateway 冒烟与前端联调

## 下一步（MVP 路线）
- 网关冒烟验证与统一入口发布：autoads-gw-885pd7lz.an.gateway.dev（受保护路由 JWT 校验）
- Adscenter Pre-flight 扩展：联通 AccessibleCustomers/validate_only；完善诊断项
- 恢复 Billing/Workflow 的事件投影（改由 CF 订阅），服务内仅保留 HTTP 面
