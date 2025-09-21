# AutoAds 架构优化方案 V3（可执行版 | 可续作）

面向企业级多用户 SaaS，聚焦可维护性与可靠性，在高并发场景保持稳定与高性能。文档包含明确的边界、数据与接口契约、迁移步骤与“任务看板”，以便新开会话能无缝续作未完成任务。

## 目标与约束
- 多用户 SaaS，无租户概念，统一用户/业务数据。
- KISS 优先；如与“零破坏性”冲突，则以可维护性与清晰度为先。
- Go 负责所有“写入/扣费/限流/重任务/审计”；Next 负责 UI、会话与轻量只读编排。
- 管理后台：仅保 GoFly Admin V3（/console 静态页面 + /api/v1/console/* API），旧管理页与 API 直接下线。
- 内部调用使用 RS256 JWT（Next 签发，Go 验签）；生产强制开启。
- 资源约束：单镜像对外 3000 端口，容器 2C4G；域名与镜像流程遵循 docs/MustKnow.md。

## 原则
- KISS：边界清晰、职责单一；通过数据/契约消除特殊分支。
- Never break userspace：对外用户功能不破坏；管理台旧入口允许直接下线。
- 实用主义：先交付 P0 闭环，再迭代 P1/P2；拒绝跨层重复实现。

---

## 目标架构（优化后）

### Next.js（apps/frontend）
- 职责：终端用户 UI、NextAuth 会话、轻量只读 API/编排；不承载核心写入与重任务。
- 访问后端：通过同源 `/ops/*` 反代至 Go（apps/frontend/src/app/ops/[...path]/route.ts）。
  - 代理层注入：`Authorization: Bearer <internal RS256 JWT>`、`X-Request-Id`、`Idempotency-Key`；回显 `Server-Timing`。
- 管理台：移除/隐藏 Next 内的 `app/admin/*` 与 `src/admin/*`；统一跳转 `/console`（避免 Cloudflare 拦截 /admin）。
- 配置读取：仅通过 `GET /ops/console/config/v1`（ETag + version + 热更新），ENV 作为 fallback。
- 限流：仅保轻量 per-IP 保护（展示/兜底）；权威限流以 Go 为准。

### Go 服务（gofly_admin_v3）
- 职责：权限校验、原子扣费、限流/幂等、业务执行、持久化、审计、调度、配置中心。
- 管理后台：/console 静态 SPA + `/api/v1/console/*` 管理 API（用户/订阅/Token/系统/接口/活动）。
- 配置中心：`system_configs` + Redis PubSub 热更新；提供聚合只读快照 `GET /ops/console/config/v1`。
- 调度：统一使用内置 cron（robfig/cron），任务具备“超时/重试/审计/状态”。

---

## 数据与契约统一（高优先）

### 1) system_configs 统一
- 统一表结构（推荐）：
  - `id, config_key, config_value, category, description, is_secret, is_active, created_by, updated_by, created_at, updated_at`
- Go 侧全部使用 `config_key/config_value` 访问；修正任何 `key/value` 的 SQL 写法。
- Next 侧如需 ORM 视图，使用 `@map/@@map` 映射至上述字段或直接只读访问。
- 订阅者模式：Redis 通道 `system:config:updated`；Go 内部 `system.On(k, cb)` 回调热更（示例：上传大小/类型）。

### 2) 订阅模型统一
- 推荐以 Go 现有定义为准：
  - `subscriptions(id, user_id, plan_id, status, started_at, ended_at, created_at, updated_at)`
- Next Prisma 以 `@map` 对齐字段名或退化为只读；任何写入动作统一改走 Go 原子端点。

---

## 内部调用与安全（RS256）
- Next 代理层签发 RS256 JWT：
  - Claims 建议：`iss=autoads-next`、`aud=internal-go`、`sub=<userId>`、`exp=+60..300s`、`jti=<uuid>`、`role=USER|ADMIN`、`scope=[siterank.execute, adscenter.execute, ...]`、`featureFlagsHash`。
  - 幂等：`Idempotency-Key: <uuid>`；Go 以 `userId+jti/ikey` 在 Redis 做短期去重；失败可安全重试。
- Go 中间件：`internal/middleware/internal_jwt.go` 使用公钥验签；`INTERNAL_JWT_ENFORCE=true` 时强制校验（生产）。
- 链路：贯穿 `X-Request-Id`，回显 `Server-Timing: upstream;dur=<ms>`。

---

## 路由与兼容
- 管理台：仅 `/console`（静态 SPA），Next 旧管理路由永久跳转；`/api/admin/*` 在边缘层重写为 `/ops/api/v1/console/*`。
- 旧管理页与 API：直接下线（无需兼容窗口）。
- 业务 API：统一“命令式 + 原子扣费”语义：`:check`（预检不扣费）与 `:execute`（原子扣费+执行+落账）。

---

## 限流/配额与审计
- 权威实现：Go + Redis；维度：`user/ip/plan/feature`，支持 RPS/RPM/concurrent 与 burst。
- 统一响应头：`X-RateLimit-Limit/Remaining/Reset`、`Retry-After`；超限 429。
- Next 仅做 UI 级展示/轻量 per-IP 保护，避免跨层双写。
- 审计：落库 `api_access_logs`、`token_transactions`、`user_operation_logs`；请求/用户/功能/耗时/扣费/缓存命中。

---

## 配置聚合快照 API（需补齐）
- `GET /ops/console/config/v1`
  - 入参：无；支持 `If-None-Match`。
  - 出参：`{ version: string, config: object }`；同时设置 `ETag` 响应头；配置变化触发新 version/ETag。
  - 语义：只读快照，聚合来自 `system_configs` 的有效项与必要 ENV 衍生值。
  - 用途：Next 的 `remote-config.ts`、`token-config.ts`、脚本 `scripts/e2e-smoke.sh` 等统一读取与校验。

---

## 调度（统一使用 Go）
- 基础任务（建议默认启用）：
  - `refresh_rate_limits`：发布 `ratelimit:plans:update` 触发各节点刷新套餐限额。
  - `expire_subscriptions`：将 `ended_at < now` 的 ACTIVE 订阅置为 EXPIRED。
  - `cleanup_idempotency_and_tasks`：清理 7 天前幂等登记与临时任务数据。
  - `daily_usage_report`：生成昨日使用/扣费日报（可先写入统计表或日志）。
- 任务特性：超时、重试、状态/结果、审计入库；提供“立即运行 RunNow”接口便于排查。

---

## 管理后台（只保必要功能）
- 用户管理：列表/详情/状态、订阅调整、Token 充值/扣减、流水与活动。
- 订阅管理：手工分配/续期/取消；生命周期状态一致（ACTIVE/EXPIRED/CANCELLED…）。
- Token 管理：配置与交易流水、活动/购买/订阅额度合并口径。
- 系统管理：全部系统参数展示与编辑（热更新），历史审计可查；“有效配置快照”视图用于运维对齐。
- API 管理：端点开关、Key 管理（加密存储）、基础指标面板（从 api_access_logs 聚合）。
- 用户活动：邀请 + 签到（最简可用）。

---

## 迁移计划（P0 → P1 → P2）

### P0（本轮上线必须）
1) 统一 `system_configs` 字段
- 修正所有 Go SQL：一律使用 `config_key/config_value`；移除/替换 `key/value` 风格。
- 更新 Admin 前端 `/console/system` 读写键名；仍复用现有页面组件。

2) 统一 `subscriptions` 模型
- 选定 `started_at/ended_at/status` 字段命名；Next 以只读/映射处理；Go 修正所有 UPDATE/SELECT。

3) 下线 Next 旧管理页与 API
- 删除/隐藏 `apps/frontend/src/app/admin/*` 与 `apps/frontend/src/admin/*`；中间件将 `/admin/*` 永久重定向 `/console`。

4) 配置快照 API 上线
- 在 Go 增加 `GET /ops/console/config/v1`（version + ETag + 304）。

5) 统一原子端点调用
- Next 侧界面操作（SiteRank/BatchOpen/AdsCenter/充值/订阅变更）全部走 Go 原子端点；禁用 Next 直写业务表。

### P1（次级）
- 角色收敛：仅 USER/ADMIN；清理 RBAC 冗余、移除 SUPER_ADMIN。
- 调度收敛：删除 Next 的 cron/调度器；所有定时作业迁至 Go。
- 系统管理完善：快照树形视图、分类筛选、批量变更、历史审计齐备（已基本具备，持续打磨）。
- API 管理：持久化字段修正，指标聚合完善。

### P2（增强）
- 观测性：统一结构化日志，贯穿 `X-Request-Id` 与 `Server-Timing`；必要时接入 APM。
- 弹性与保护：更精细的套餐/功能限额、缓存策略、灰度发布与回滚工具化。

---

## 验收标准
- 扣费：`:execute` 端点单事务原子扣费，幂等生效；`:check` 不扣费。
- 限流：返回头 `X-RateLimit-*` 与 429 语义一致；Next 轻量限流不与 Go 冲突。
- 管理后台：用户/订阅/Token/系统/API/活动可用；配置热更实时生效；快照 ETag/304 工作正常。
- 可维护性：Next 不再直写业务表；服务边界清晰；新增需求落点明确（Go 或 Next）。

---

## 回滚与开关
- Feature Flag：可关闭内部 JWT 验签与新原子端点，临时回退到旧链路（仅紧急情况下）。
- 配置回滚：`system_configs` 版本化/审计可查询，必要时回退上一稳定版。
- 限流降级：异常峰值先降阈值/加缓存/降并发，再逐步排障。

---

## 环境变量（首次启动最小集）
- 数据/站点：`DATABASE_URL`、`REDIS_URL`、`NEXT_PUBLIC_DOMAIN`、`NEXT_PUBLIC_DEPLOYMENT_ENV`
- 鉴权：`AUTH_SECRET`、`INTERNAL_JWT_PRIVATE_KEY`（Next, PEM）、`INTERNAL_JWT_PUBLIC_KEY`（Go, PEM）、`INTERNAL_JWT_ENFORCE`
- 端口：`NEXTJS_PORT=3000`、（Go 内部）`PORT=8080`
- 参考：`docs/minimal-env.md`

---

## 参考实现位置（便于定位）
- Next 反代：`apps/frontend/src/app/ops/[...path]/route.ts`
- Next 中间件：`apps/frontend/src/middleware.ts`（/api/admin → /ops/api/v1/console + 轻量限流 + X-Request-Id）
- Go 配置缓存：`gofly_admin_v3/internal/system/config_cache.go`（Redis PubSub 热更）
- 管理后台接口：`gofly_admin_v3/internal/admin/*`（系统/速率/用户/订阅/Token/API 管理）
- 调度：`gofly_admin_v3/internal/scheduler/*`

---

## 任务看板（可续作 | 面向下一会话）

P0（必须）
- [x] 修正 Admin API 对 `system_configs` 的持久化字段，统一 `config_key/config_value`（文件：`internal/admin/api_management_controller.go` 等）
- [x] 修正所有读写 `system_configs` 的 SQL/Model，移除 `key/value` 风格（全仓检索）
- [x] 前端订阅只读改经由 Go 端点（`/api/v1/user/subscription/current`），并已在服务层启用“远端优先 + Prisma 回退”
- [x] Go 实现 `GET /ops/console/config/v1`（version + ETag + If-None-Match=304）
- [x] 下线 Next 旧管理路由（删除导出或强制 301 到 `/console`）
- [x] Next 改造：Siterank/BatchOpen/AdsCenter 写路径切换为 Go 原子端点（中间件重写到 `:check/:execute`；含 silent-progress → tasks/:id 映射），移除 Next 直写路径

P1（次级）
- [x] 角色模型收敛为 USER/ADMIN（后端仅允许 ADMIN；兼容历史 super_admin 自动映射为 ADMIN）
- [x] 删除 Next 内部 cron/调度器/重任务执行器
- [x] 系统管理页批量操作/历史审计优化与 UI 打磨（新增“立即广播刷新”套餐限额按钮；快照/历史/批量操作已可用）
- [x] API 管理指标聚合完善（支持 endpoint/method/userId/requestId 过滤；新增“最近请求”表格与 Request ID 详情）

P2（增强）
- [x] 非 429 成功响应也输出 `X-RateLimit-Limit/Remaining/Reset`（全局/用户/IP/API 维度）
- [x] ApiAccessLogger 追加 request_id（使用 `X-Request-Id` 作为主键）
- [x] 通过 `system_configs.rate_limit_plans` + Redis 通知动态热更套餐限流（示例：`{"FREE":{"rps":5,"burst":10},"PRO":{"rps":50,"burst":100}}`）
- [x] 后端自动解析用户套餐（`user_id` → 活跃订阅 → 计划名），并带 60s 内存缓存；不依赖 Header

P2（增强）
- [ ] 统一结构化日志方案（包含 request_id/user_id/feature/latency/tokens/cache_hit）
- [ ] 更细粒度套餐/功能限额与灰度策略
- [ ] 可选接入 traceparent 与 APM

> 提示：以上清单为“活清单”。当你完成任一任务，请在此文件勾选并在 PR 描述中同步，确保后续会话可直接续作。

---

## 附：配置快照 API 返回示例
```json
{
  "version": "2025-09-15T10:00:00Z#a1b2c3",
  "config": {
    "general:site_name": "AutoAds",
    "upload:max_file_size": "10485760",
    "feature:payments": "enabled"
  }
}
```
- ETag = sha256(config JSON)，配置变更即更新。
