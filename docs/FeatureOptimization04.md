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
  - 解析最终 URL 已统一走本地 Playwright 执行器（同容器内），支持“每条链接指定国家 → 选择对应代理 IP”，并强制移除 Referer；后端记录 `classification/durationMs`，指标端点 `/api/v1/adscenter/metrics` 增加“分阶段耗时与错误分类”聚合。
  - 可选：广告更新阶段仍可接入外部执行器（`ADSCENTER_EXECUTOR_URL`）以满足特定出口管控与弹性扩缩容（默认不需要）。
- 优化方向
  - 指标与报表：用 Job 固化按日/周统计，Next 仅消费只读端点；进一步补充 per-item 耗时（更新阶段）。
  - 前端表单增强：支持 `links[{affiliate_url,country}]` 的批量录入（后端已支持）。

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
  - 浏览器执行器：单镜像内置并仅监听 127.0.0.1；按国家映射代理（`PUPPETEER_PROXY_BY_COUNTRY`/`PUPPETEER_PROXY_DEFAULT`），详见 `docs/production-env-config.md` “浏览器执行器与国家代理映射（生产）”。

## 10. 待办与里程碑（可续接）

### P0 — 基线稳定（本周）
- [x] 明确 `/ops/*` 反代规则（预发/生产），并提供内置实现。
  - 已完成：新增 Next Route Handler `apps/frontend/src/app/ops/[...path]/route.ts`，作为内置管理网关；并在 `README-deployment.md` 与 `docs/production-env-config.md` 补充说明。
  - 完成标准：能从前端访问 `/ops/api/v1/console/*` 与 `/ops/console`。
- [x] 确认 Token/订阅事实来源（SoT）：Go 为唯一计费/扣费与只读查询服务；Next 仅读取合并。
  - 已完成：新增 `docs/ADR-0001-SoT-Tokens-Subscriptions.md`；生产/预发通过中间件禁用 Next 写入（除白名单），开发/显式变量可开启。
  - 完成标准：Next 不再写 Token/订阅（除开发/显式允许外）；文档标注数据流与表结构来源。
- [~] SimilarWeb 接入校验（按需）：
  - 现状：使用公开免费端点无需 apikey；已在 `docs/production-env-config.md` 明确两种接入（公开/企业网关）。
  - 说明：用户明确暂不需要批量压测（siterank-batch），该项暂缓；如后续接入企业网关或遇到配额问题再开启压测与限流调优。

### P1 — 结构收敛（下周）
- [x] 路由归拢（第一批）：
  - [x] SiteRank 原子端点（`/api/v1/siterank/batch:check|batch:execute`）→ `internal/app/register_siterank.go`
  - [x] BatchOpen 原子端点与任务进度/SSE（`/api/v1/batchopen/silent:check|silent:execute|tasks/:id|tasks/:id/live`）→ `internal/app/register_batchopen.go`
  - [x] v2 统一任务快照/SSE（`/api/v2/tasks/:id`、`/api/v2/stream/tasks/:id`）→ `internal/app/register_v2_tasks.go`
  - [x] AdsCenter v1 minimal（`/api/v1/adscenter/accounts|configurations|executions`）→ `internal/app/register_adscenter_minimal.go` 并已在 main.go 切换为统一调用。
- [x] BatchOpen：`/api/v1/batchopen/start?type=silent|basic|autoclick` 拆分为独立流程（保契约），原子预检/扣费/创建/启动与 silent 对齐。
- [~] AdsCenter：执行器统一与指标完善（进行中）
  - [x] 新增 `POST /api/v1/adscenter/executions` 使用服务创建并启动（阶段性扣费由服务处理）。
  - [x] 性能/状态端点：`GET /api/v1/adscenter/metrics` 展示分布与耗时分位；管理台 `/admin/system/performance` 展示。
  - [x] 将占位/多路径执行彻底替换为统一的真实执行器（Playwright/外部服务），并上报分阶段耗时与错误分类。
    - 已实现：新增外部执行器 HTTP 客户端，服务层统一使用 `PUPPETEER_EXECUTOR_URL` 调用浏览器执行器（新增 `/resolve` 端点）；执行结果记录 `classification/durationMs`；`/api/v1/adscenter/metrics` 增加“任务分布 + 分阶段耗时 + 错误分类”聚合。

### P2 — 体验与可观测（两周+）
- [x] 管理台观测：BFF 侧聚合上游 `X-RateLimit-*`、`x-request-id` 并在 `/admin/system/observability` 展示（最近 100 条）。
- [x] 统计与监控（基础版已完成）：
  - [x] 基础统计端点：`GET /api/v1/siterank/stats`，`GET /api/v1/batchopen/stats`。
  - [x] SiteRank 缓存洞察：`GET /api/v1/siterank/cache-insights`（命中率估算与 TTL 建议），页面 `/admin/system/cache-insights` 展示。
  - [x] 执行性能：`GET /api/v1/batchopen/metrics`、`GET /api/v1/adscenter/metrics`（状态分布与耗时分位），页面 `/admin/system/performance` 展示。
  - [x] AutoClick 队列：`GET /api/v1/autoclick/queue/metrics`（池状态与近100条执行分布）。
  - [x] 深度指标（缓存命中率时间序列、执行阶段耗时细分、按用户/任务分布、per-item 更新耗时）：
    - 新增 `GET /api/v1/siterank/cache-timeseries?window=24h&bucket=1h[&group_by=user]`，提供缓存命中率时间序列与 Top 用户分布。
    - 扩展 `GET /api/v1/adscenter/metrics`：输出 `tasks.phase_duration_ms`（提取/更新分阶段 p50/p90/p99）与 `tasks.byUser`（最近200条任务的按用户分布与平均耗时）。
    - 新增 per-item 更新耗时采集（可选）：设置 `ADSCENTER_MEASURE_PER_ITEM=true` 时逐项更新并记录 `updateResults[].duration_ms`（默认保持批量更新）。

## 进度与评估
- 已完成
  - /ops 管理网关内置，避免外部网关依赖；SoT 决策固化并在生产/预发禁用 Next 写入；路由归拢完成 SiteRank/BatchOpen/v2 快照的迁移。
  - AdsCenter v1 minimal 切换至 internal；新增执行创建端点接入服务层；BatchOpen `start` 入口已拆分三模式并完成原子扣费与创建启动。
  - AdsCenter 执行器统一：本地 Playwright 执行器解析最终 URL（每链接按国家选代理、Referer 置空），后端记录分类/耗时；`/api/v1/adscenter/metrics` 新增“任务分布 + 分阶段耗时 + 错误分类”聚合。
  - 观测与统计：BFF 观测页（限流/请求ID）、SiteRank 缓存洞察与 TTL 建议、BatchOpen/AdsCenter 性能分布、AutoClick 队列/池状态页面已上线。
- 进行中/可快速完成
  - AdsCenter 前端表单支持 `links[{affiliate_url,country}]` 的批量录入与校验（后端已支持）。
  - Go 侧观测补全：pprof、Prometheus 指标导出、结构化日志（含 request-id）。
- 暂缓/按需触发
  - SimilarWeb 批量压测与网关注入 apikey：公开端点无需 apikey，且用户暂不需要压测，保留文档指引，后续再启。
- 待规划
  - 深度指标与可视化增强：缓存命中率按时间序列、执行阶段耗时拆解（提取/解析/更新）、按用户/任务粒度分布与报表下载；AdsCenter 更新阶段 per-item 耗时采集。

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
