# AutoAds 架构优化方案 V4（可执行版 | 可续作）

面向企业级多用户 SaaS，目标是在保持“零破坏性”的前提下，进一步简化边界、降低复杂度、提升可维护性与可靠性。本方案延续 V3 的方向（Next 负责 UI/轻编排/同源网关，Go 负责原子写入/扣费/限流/审计/任务），并落地一组 P0→P3 的分阶段任务清单，包含代码位置、验收标准与回滚开关，便于新会话直接续作。

## 约束与共识（必读）
- 部署：单镜像（Next + Go），对外暴露 3000 端口；遵循 docs/MustKnow.md 的镜像与域名策略。
- 边界：Next 只做 UI、会话管理与“只读/轻编排”；所有写入、扣费、限流、审计、重任务由 Go 承担。
- 网关：Next 通过 Route Handler 统一反代至容器内 Go 服务（`/go/*`、`/ops/*`）。
- 兼容：Never break userspace。对外接口行为保持一致；必要时在边缘层重写，保证旧入口可用。
- KISS：首选删除冗余与重复实现，而非引入新层次。

## 目标架构（简述）
- Next.js（apps/frontend）
  - 职责：终端 UI、NextAuth 会话、轻量 API 编排（仅只读/提示）、同源网关 `/go/*` 和 `/ops/*`。
  - 反代：注入/透传 `Authorization: Bearer <internal RS256 JWT>`、`X-Request-Id`、`Idempotency-Key`、`Server-Timing`。
  - 配置：远端只读快照 `GET /ops/console/config/v1`（ETag/If-None-Match）；ENV 仅作为回退。
  - 限流：仅 per-IP 轻保护与提示头（非权威）。
- Go（gofly_admin_v3）
  - 职责：写入、原子扣费、限流（权威，含计划热更）、幂等、调度、审计、配置中心。
  - 管理台：`/console` 静态 SPA + `/api/v1/console/*` 管理 API；聚合只读快照 `/ops/console/config/v1`。
  - 安全：支持内部 RS256 JWT 验签（`INTERNAL_JWT_ENFORCE=true` 强制）。

## 关键问题与改进点（现状扫描）
1) 顶层运行时错误（P0）
   - 文件：`apps/frontend/src/middleware.ts`
   - 症状：在 `export const config = {...}` 之后存在一段顶层代码块使用 `pathname/request/url`（未定义作用域），会在导入时抛错。需立即修复。

2) 数据写入边界混乱（P0）
   - Next 仍保留 SiteRank/BatchOpen/AdsCenter 等写路径与 Token 扣费逻辑；与 Go 的原子接口重复，增加维护与一致性风险。

3) Prisma 客户端重复构造（P0）
   - 存在多个 PrismaClient 实例入口（`src/lib/prisma.ts`、`src/lib/db/index.ts`、`src/lib/utils/db-migration-helper.ts` 等），易引发连接与生命周期问题。

4) 限流双写（P1）
   - Next 侧实现了多种限流（含 DB/Redis/分布式），应下沉到 Go（权威）；Next 仅保 per-IP 轻保护与提示头。

5) 同一功能多版本并存（P1）
   - SimilarWeb/RateLimiter/Token 等存在 optimized/legacy/unified 多套实现，增加复杂度与心智负担。

6) 配置读取不统一（P1）
   - Next 存在 ENV 与直查并存；应统一“远端快照优先 + ENV 回退”。

7) 构建别名桩过多（P2）
   - next.config.js 为离线构建设置了大量 alias/stub；需确保生产构建不误带到运行时代码路径。

## 分阶段任务板（可续作）

> 规则：勾选已完成项，并在 PR/变更描述中同步；保证下一会话可直接接续。

### P0（必须先完成）
- [x] 修复中间件顶层错误（apps/frontend/src/middleware.ts）
  - 方案：将导出 `config` 之后的“写路径重写逻辑块”并入 `export async function middleware()` 的路由改写段，或删除该重复逻辑。
  - 验收：构建/启动不报 ReferenceError；路由改写由 middleware 内部或 `/go/*`、`/ops/*` Route Handler 统一承担。

- [x] 生产强制内部 JWT 验签（Go）
  - 环境：Next 注入 `INTERNAL_JWT_PRIVATE_KEY`（PEM）；Go 设置 `INTERNAL_JWT_PUBLIC_KEY` 与 `INTERNAL_JWT_ENFORCE=true`。
  - 代码：`gofly_admin_v3/internal/middleware/internal_jwt.go`、`cmd/server/main.go`（已支持）。
  - 验收：未携带/验签失败请求在生产环境返回 401（健康与静态路径除外）。

- [x] Next 直写全面改为 Go 原子端点
  - 方式：
    - 路径统一通过 `/go/*` 反代（`apps/frontend/src/app/go/[...path]/route.ts`）。
    - 同步或保留边缘层重写以兼容旧路径（`apps/frontend/src/middleware.ts` 中 `/api/admin/*` → `/ops/api/v1/console/*`）。
  - 范围：`/api/siterank/*`、`/api/batchopen/*`、`/api/adscenter/*` 等写路径全部改为调用 Go 的 `:check/:execute` 原子接口；同时将 `/api/siterank/rank` GET 特判重写到 Go 的兼容端点 `/api/siterank/rank`；Next 仅保参数校验与提示头。
  - 验收：写操作链路仅在 Go 执行；Next 无直写 DB 的路径；响应头包含 `X-Request-Id/Server-Timing` 与 `X-RateLimit-*`（提示）。

- [x] Prisma 客户端唯一化（Next）
  - 保留 `apps/frontend/src/lib/prisma.ts` 为唯一入口（单例 + 全局缓存）。
  - 修正引用：`src/lib/db/index.ts`、`src/lib/utils/db-migration-helper.ts`、`src/lib/db-pool.ts` 等不再自行 new，统一复用单例。
  - 备注：`src/lib/database/connection-pool.ts` 为备用方案，当前未被引用；如启用需同样复用单例或移除。
  - 验收：运行路径仅保单例，连接数与内存稳定。

### P1（次级收敛）
- [x] 限流职责下沉到 Go（权威）
  - Next：仅 per-IP 内存级轻保护与 `X-RateLimit-*` 提示；移除 DB/Redis/分布式权威限流实现。
  - Go：使用 `middleware.NewRateLimitMiddleware` + `PlanAPIRateLimit`，动态热更来自 `system_configs.rate_limit_plans`（见 `internal/app/routes.go` 中 `loadPlanRates()`）。
  - 验收：429/`X-RateLimit-*` 语义一致；不同套餐/用户策略可热更生效。

- [x] SimilarWeb/Service 实现统一
  - Next：统一走 Go 的 `/api/v1/siterank/batch:execute`（批量）与 `/api/siterank/rank`（单域名，兼容端点）。
  - 验收：单域名与批量查询均在 Go 执行；Next 仅展示 `X-Cache-Hit` 等提示信息。

- [x] 配置中心“远端优先”
  - Next 所有运行时配置读取改为 `GET /ops/console/config/v1`（ETag/If-None-Match）；ENV 仅作为 fallback。
  - 验收：变更系统配置后，ETag/Version 变化可被 Next 命中 304 或刷新；不再依赖本地硬编码。

### P2（增强与可观测）
- [x] 统一结构化日志
  - 字段：`request_id/user_id/feature/latency/tokens/cache_hit`；Next 与 Go 输出一致，便于聚合分析。
  - 可选接入 `traceparent/APM`（灰度）。

- [x] 构建别名桩最小化
  - next.config.js 的 alias/stub 仅服务于离线构建；生产运行时代码路径禁止 import 这些桩。
  - 验收：生产构建产物无桩模块；构建/运行体积与启动时间优化。

- [x] 任务/调度统一 Go
  - Next 不再自动运行任何后台调度（需显式 FRONTEND_SCHEDULER_ENABLED 才启用）；前端 cron API 已废弃（410）。
  - Go 使用 robfig/cron 统一调度（超时/重试/审计/状态）；保留的 setInterval 仅限 UI 轻量观察/健康检查范畴，不属于后端重任务。

---

### 进展小结（V4 实施结果）
- 中间件重写与反代统一，核心写路径（SiteRank/BatchOpen/AdsCenter）已切换到 Go。
- 单域名 SiteRank 接口（GET /api/siterank/rank）已特判转发到 Go 的兼容端点，保持既有响应结构与体验。
- Prisma 统一为单例，连接与日志在生产降噪；备用连接池未启用。
- 生产默认启用内部 JWT 验签；构建桩仅在开发或显式开启时启用。
 - 统一结构化日志：Next API 装饰器与 Go 中间件输出一致字段；Go 端点返回 `X-Tokens-Consumed`/`X-Tokens-Balance` 供可观测聚合。

### P3（清理/降复杂）
- [x] 清理“optimized/legacy/old”命名族与重复实现（运行时收敛）
  - SimilarWeb 统一由 Go 后端提供数据与计费；Next 的 UnifiedSimilarWebService 在生产环境改为透明代理至 `/go/api/siterank/*`，删除跨层重复实现的运行路径。
  - 其余族群保留源码但不在运行路径生效（构建桩仅在开发启用），逐步清理。

- [x] 管理后台入口与文档统一
  - Next 不提供管理台入口；统一直达 `/ops/console/login|/ops/console/panel`。
  - 中间件已实现：`/admin/*` → 308 `/console/*`；`/console/*` 改写到 `/ops/console/*`；文档/README 已对齐。

## 代码指引与定位
- Next 反代：
  - `/go/*` → `apps/frontend/src/app/go/[...path]/route.ts`
  - `/ops/*` → `apps/frontend/src/app/ops/[...path]/route.ts`
- 中间件与重写：`apps/frontend/src/middleware.ts`
- Next 配置：`apps/frontend/next.config.js`
- Prisma 唯一入口：`apps/frontend/src/lib/prisma.ts`
- Go 路由与限流：`gofly_admin_v3/internal/app/routes.go`
- Go 内部 JWT：`gofly_admin_v3/internal/middleware/internal_jwt.go`、`cmd/server/main.go`
- 管理台只读快照：`GET /ops/console/config/v1`（Go 内已实现）

## 环境变量（运行最小集）
- 数据/站点：`DATABASE_URL`、`REDIS_URL`、`NEXT_PUBLIC_DOMAIN`、`NEXT_PUBLIC_DEPLOYMENT_ENV`
- 鉴权：
  - Next：`INTERNAL_JWT_PRIVATE_KEY`（PEM，RS256）
  - Go：`INTERNAL_JWT_PUBLIC_KEY`、`INTERNAL_JWT_ENFORCE=true`（生产）
- 端口：`NEXTJS_PORT=3000`（外部）/ Go 内部 `:8080`（仅容器内）

## 验收与冒烟
- 健康检查：
  - 外部：`GET https://<域名>/health`
  - 容器内：`GET http://127.0.0.1:3000/api/health`
- 反代链路：
  - 任意写路径返回头包含 `X-Request-Id` 与 `Server-Timing: upstream;dur=<ms>`
  - 管理台响应包含 `X-Robots-Tag: noindex, nofollow`
- 速率限制：
  - 成功与 429 响应均带有 `X-RateLimit-*`；Go 改阈值后，策略热更生效
- SiteRank：
  - 单域名与批量查询：`X-Cache-Hit` 提示正确；强制刷新 `forceRefresh=true` 能触发 L1/L2 缓存清除

## 回滚与安全阀
- `INTERNAL_JWT_ENFORCE` 可临时关闭强制验签（紧急情况下）。
- `SITERANK_CACHE_DISABLED=true` 可暂时禁用 SiteRank 缓存以排障。
- Next per-IP 轻限流可快速调节 `FRONTEND_LIGHT_RPM` 以兜底。

## 里程碑建议（节奏）
1. 当天修复 P0：中间件顶层错误 + 生产启用内部 JWT；锁定 Next 无直写路径。
2. 本周完成 P1：限流权威下沉、SimilarWeb 统一、配置中心远端优先。
3. 两周内推进 P2：结构化日志、构建桩最小化、调度统一。
4. 月内完成 P3：清理重复实现与命名族，完善文档与跳转策略。

> 注：本 V4 文档为“活清单”。完成任一任务时，请勾选状态并在变更描述中同步，以便新会话可无缝续作。
