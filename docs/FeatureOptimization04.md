# FeatureOptimization04 — 架构与功能优化汇总（可续接任务版）

本文汇总前序讨论与分析，沉淀为一份可执行的优化方案与TODO清单，确保在新开会话/新同学加入时也能快速续接未完成任务。

## 1. 背景与目标
- 架构：Next.js 前端 + BFF（`/api/go/*` 反代）+ Go 后端（gofly_admin_v3）。
- 目标：在不破坏用户侧契约的前提下，提升关键功能的完整性与实现简洁性（KISS），补齐部署与运维要点，明确事实来源（SoT），并提供可逐步落地的优化计划。

## 2. 当前架构速览
- 前端（apps/frontend）
  - Next.js 15（App Router）、NextAuth v5（Google OAuth）、Prisma（MySQL）。
  - BFF 网关：`/api/go/*` 统一转发到 Go（`BACKEND_URL`），带 readyz 预热、超时与错误兜底、请求头透传。
  - 内部 JWT：Next 生成 RSA 签名的 Internal JWT，Go 通过 `InternalJWTAuth` 校验并在 `gin.Context` 注入 `user_id`。
- 后端（gofly_admin_v3）
  - 模块：siterank、batchgo/autoclick、adscenter、user/token、admin、scheduler、middleware 等。
  - 大部分对外路由在 `cmd/server/main.go` 注册；internal/*/routes.go 多为占位/TODO。
- 部署：`Dockerfile.standalone` + `docker-entrypoint.sh` 同时启动 Go 与 Next（standalone），并可选启动本地执行器（Puppeteer、AdsCenter）。

## 3. 功能模块评估（结论）
- SiteRank：完整度高，品味好。
  - 提供单域、批量原子接口（预检→扣费→执行→失败退款），缓存写库（7天/1小时），SimilarWeb 客户端具备并发/限流/重试。
- BatchOpen：Silent 模式完整；AutoClick 计划/执行链路具备，但统一入口（basic/autoclick）仍复用 silent pipeline，后续可拆分。
- AdsCenter：最小闭环具备（任务创建/执行/查询、v1 accounts/configurations/executions），真实生产力依赖外部执行器/本地 Node 占位器，需逐步替换为真实路径。
- 用户鉴权：NextAuth v5 + 内部 JWT 桥接清晰；本地邮箱注册禁用，统一 Google 登录。
- 后台管理：功能丰富（系统配置、限流、API 管理、用户/套餐/Token、监控），但路由注册分散在 main.go，维护性一般；运维上需明确 `/ops` 反向代理到 Go。

## 4. 关键技术决策（维持/强化）
- KISS + Never break userspace：
  - 新增能力优先“网关/BFF 转发 + 后端真实实现”，减少前端冗余逻辑与双处状态。
  - 对外契约不变：保留兼容端点与响应结构；废弃路径加 `Deprecation/Sunset/Link` 头提示。
- 事实来源（SoT）收敛：
  - Token/计费/扣费：以 Go 服务为唯一事实来源，Next 仅读-聚合，避免双写。
  - 订阅/套餐：同样通过 Go 只读端点对外（Go 已可直接读取 Prisma 表），Next 不做写。
- 运维/安全：
  - `/api/go/*` 仅允许 `/api`、`/health|ready`；内部 JWT 缺失时非强制，但生产默认 `INTERNAL_JWT_ENFORCE=true`（entrypoint 已处理）。
  - 管理路径 `/ops/*` 需由网关/Nginx/ClawCloud 明确映射到 Go 管理 API（见“运维要点”）。

## 5. SiteRank 批量查询设计说明
- 推荐调用：`POST /api/v1/siterank/batch:check` → `POST /api/v1/siterank/batch:execute`
  - `:check`：根据 `domains` 计算总量，返回 `sufficient/balance/required/quantity`；仅校验不扣费。
  - `:execute`：二次校验→原子扣费（失败直接 402）→执行 SimilarWeb 批量→失败整单尝试退款（best-effort）→返回结果及 `X-Tokens-Consumed/X-Tokens-Balance`。
  - 幂等：支持 `Idempotency-Key`（DB 唯一 + Redis SetNX 双保护）。
- 兼容接口 `POST /api/v1/siterank/batch`：逐域名“缓存优先→单域拉取更新”，不做原子扣费，保留兼容与缓解配额压力。
- SimilarWeb 批量说明：
  - 通过并发多次单域 API 实现“批量效果”，并非官方的单一批处理端点。
  - 并发与限流：每次并发 5；用户 5/min、50/hour；全局 20/min、1000/hour；失败有指数退避与重试。
  - 配置：`SIMILARWEB_API_URL` 可指向企业网关/代理以注入 apikey；客户端默认不直带 apikey。

## 6. BatchOpen（含 AutoClick）现状与优化
- 已有能力
  - Silent 模式：`/api/v1/batchopen/silent:check|silent:execute|progress|terminate`，原子扣费、幂等、防并发。
  - 统一入口：`/api/v1/batchopen/start?type=...` 当前 basic/autoclick 暂复用 silent pipeline（保契约），后续拆分。
  - AutoClick：计划/日计划/执行/失败 URL 四表，CRUD + 启停、定时 Job、Redis 事件与 SSE 快照接口。
- 优化方向
  - 将 basic/autoclick 从 silent pipeline 拆分为独立执行流，计费动作明确到成功 item 维度；保留 `/start` 契约。
  - 把 main.go 中大段 BatchOpen 路由迁到 internal 包（app/routes.go 或各模块 routes.go）统一注册，main.go 仅装配。

## 7. AdsCenter 现状与优化
- 现状
  - v1 能力打通：`/api/v1/adscenter/create|tasks|tasks/:id` 与 minimal 的 `/accounts|/configurations|/executions`。
  - 执行依赖外部执行器（`ADSCENTER_EXECUTOR_URL`）或本地 Node 占位器（入口脚本可起）。
- 优化方向
  - 替换占位执行为真实外部服务（或统一 Playwright 执行器），标准化“模板→执行→追踪→报表”事件流。
  - 指标采集与报表：用 Job 固化日/周统计，Next 侧仅消费只读端点。

## 8. 认证与后台
- 用户：NextAuth v5（Google），本地邮箱注册禁用；登录后 Next → Internal JWT → Go 鉴权。
- 后台：`/api/v1/console/*` 管理 API + `/console` 静态前端（Vite 构建）。管理员 JWT 独立于用户态。
  - 前端运维面板经 `/ops/api/v1/console/*` 直达 Go（需网关映射）。

## 9. 运维与部署要点
- 镜像：使用 `Dockerfile.standalone`；entrypoint 负责：可选一次性建库→Go 迁移→Prisma 迁移→Next standalone 启动→可选执行器。
- 环境：
  - 强制内部 JWT（生产默认）：`INTERNAL_JWT_ENFORCE=true`，并设置 `INTERNAL_JWT_PUBLIC_KEY`（Go 验签）/`INTERNAL_JWT_PRIVATE_KEY`（Next 签名）。
  - SimilarWeb：`SIMILARWEB_API_URL` 指向企业代理/带 key 的服务。
- 反向代理（关键）：
  - `/api/go/*` → Go `BACKEND_URL`；
  - `/ops/*` → Go 根（从而 `/ops/api/v1/console/*` 命中后台 API，`/ops/console` 命中静态管理前端）。

## 10. 待办与里程碑（可续接）

### P0 — 基线稳定（本周）
- [ ] 明确 `/ops/*` 反代规则（预发/生产），更新 README-deployment 与 ClawCloud 配置参考。
  - 完成标准：能从前端访问 `/ops/api/v1/console/*` 与 `/ops/console`。
- [ ] 确认 Token/订阅事实来源（SoT）：Go 为唯一计费/扣费与只读查询服务；Next 仅读取合并。
  - 完成标准：Next 不再写 Token/订阅；文档标注数据流与表结构来源。
- [ ] SimilarWeb 接入校验：`SIMILARWEB_API_URL` 指向网关，网关注入 apikey；压测“批量”路径并验证限流/重试。
  - 完成标准：100 域名/批可在限流不触发 429 的阈值内稳定返回。

### P1 — 结构收敛（下周）
- [ ] 路由归拢：将 main.go 中大段业务路由迁至 internal（`internal/app/routes.go` 或模块 routes.go），main.go 保留装配与启动。
- [ ] BatchOpen：将 `start?type=basic|autoclick` 从 silent pipeline 拆分为独立流程，计费与失败退款逻辑与 silent 保持一致。
- [ ] AdsCenter：最小真实执行闭环替换占位器；统一执行日志/事件与指标采集。

### P2 — 体验与可观测（两周+）
- [ ] 管理台观测：对 `/api/go/*` 在 BFF 侧聚合上游 `X-RateLimit-*`、`x-request-id`，前端运维页展示。
- [ ] 缓存命中率与失败退款监控：为 SiteRank/BatchOpen 增加失败退款计数、缓存命中计数的只读端点。

## 11. 风险与应对
- SimilarWeb 官方无“批处理端点”，本系统通过并发单域拉取实现“批量效果”，需严格控制并发与配额。
- 双处数据模型风险（Next/Go）：通过 SoT 收敛 + 只读合并 + 观测比对降低不一致概率。
- `/ops` 反代缺失会导致管理功能不可用：优先级 P0 处理并形成变更手册。

## 12. 附录：参考端点与文件
- SiteRank 原子：`POST /api/v1/siterank/batch:check`，`POST /api/v1/siterank/batch:execute`
- SiteRank 兼容：`POST /api/v1/siterank/batch`
- BatchOpen Silent：`POST /api/v1/batchopen/silent:check|silent:execute`，`GET /api/v1/batchopen/progress`，`POST /api/v1/batchopen/terminate`
- AutoClick：`/api/v1/batchopen/autoclick/*`
- AdsCenter v1：`/api/v1/adscenter/create|tasks|tasks/:id`；minimal：`/api/v1/adscenter/accounts|configurations|executions`
- BFF 路由：`apps/frontend/src/app/api/go/[...path]/route.ts`
- SimilarWeb 客户端：`gofly_admin_v3/internal/siterankgo/similarweb_client.go`
- 入口：`docker-entrypoint.sh`，`Dockerfile.standalone`

—— 以上为可执行优化方案。落地顺序建议按 P0→P1→P2 推进，任何改动遵循 KISS 与“Never break userspace”。

