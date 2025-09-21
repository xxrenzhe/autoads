# AutoAds 架构优化方案 02（可执行版，含任务清单）

本方案在 01 版基础上，结合最新决策与约束，面向企业级多用户 SaaS 的高并发生产场景，优先 KISS 与可维护性。一切“零破坏性”要求在与简化或可维护性冲突时让位（允许直接下线旧实现并重命名接口路径）。

本文件可作为新会话的继续执行依据：包含目标、边界、路由规范、接口约定、最小环境变量、分阶段任务与验收标准。

## 目标与边界

- 架构目标
  - 高并发、高可靠、可维护的多用户 SaaS（无“租户”概念）。
  - Go 为写入与重任务真相源；Next.js 仅做 UI、轻读与网关编排。
  - 单镜像部署（外部仅 3000），2C4G 可稳定运行。
- 取舍策略
  - 当“零破坏性”与 KISS/可维护性冲突时，允许破坏性变更（提供清晰迁移步骤与脚本）。
- 角色模型（收敛）
  - 仅保留 USER 与 ADMIN 两种角色；移除 SUPER_ADMIN 等派生概念。
- 定时任务
  - 统一复用 GoFly 内置 scheduler，不引入新的调度器。

## 路由与前缀（避开 WAF 拦截）

- 管理台页面与 API 全量更名（不再使用 /admin 前缀）：
  - 页面：`/console/*`（替代所有 `/admin/*`）
  - 管理 API：`/api/v1/console/*`（替代 `/api/v1/admin/*`）
- Next 网关（外部到容器内）
  - 外部前缀：`/ops/*` → 反代至容器内 `http://127.0.0.1:8080/console/*` 和 `/api/v1/console/*`
  - 业务前缀：继续使用 `/go/*` 代理通用后端 API（非管理用途），避免相互干扰。
  - 网关注入：`Authorization: Bearer <内部RS256 JWT>`、`Idempotency-Key`、`X-Request-Id`；透传 `Server-Timing`。
- 兼容策略
  - 旧 `/admin/*` 与 `/api/v1/admin/*` 直接下线，无兼容窗口。

## 后端统一（Go / Gin）

- 单入口与单限流
  - 统一入口：`gofly_admin_v3/cmd/server/main.go`（Gin）。
  - 唯一限流实现：`internal/middleware/rate_limiter`（支持 Redis/Plan 维度）；删除 `cmd/server` 内“简易限流”。
- 管理鉴权
  - Next→Go 内部调用强制 `InternalJWTAuth(enforce=true)`（白名单：`/health|/ready|/live|/console/panel/*`）。
  - 管理 API 由 `AdminJWT` 保护，仅 `ADMIN` 可访问。
- 原子端点（写入/扣费/重任务）
  - 统一 `:check | :execute` 语义（示例）：
    - `POST /api/v1/siterank/batch:check | batch:execute`
    - `POST /api/v1/batchopen/silent:check | silent:execute`
    - `POST /api/v1/adscenter/link:update:check | link:update:execute`
  - 幂等：`Idempotency-Key` + Redis SetNX + DB 唯一键（见下文“幂等登记表”）。
- 配置真相源（聚合只读 + 热更新）
  - 聚合端点：`GET /console/config/v1`（或沿用 `/admin/config/v1` 的实现但仅对外暴露新路径）。
  - ETag + version；配置更新 → Redis 事件 `system:config:updated` → ConfigManager 重建快照并触发回调，限流/HTTP 客户端/外部 API 客户端即时生效。

## 前端统一（Next）

- 管理入口
  - 后台仅支持“URL 直达”，Next 前端不提供任何导航/按钮/搜索入口。
  - 管理默认直达 URL：`/ops/console/panel`（Next 网关反代 → Go `/console/panel`）。
- 网关与编排
  - `/ops/*`（专用于管理）与 `/go/*`（业务）并存，前者仅允许 `/console/*` 与 `/api/v1/console/*` 前缀，后者用于通用业务 API。
  - `/ops/*` 仅做盲反代与安全头部处理：附加 `X-Robots-Tag: noindex, nofollow`（禁止收录），权限校验由后端 Go 的 AdminJWT 完成。
- 退重
  - 移除 Next 本地“管理 API”与重逻辑执行路径。前台执行流统一经 `/go/*`（业务）或 `/ops/*`（管理）。

> 校验点：全仓不得再出现 `'/admin'` 或 `'/go/admin'` 的导航/跳转/链接；站点地图与 robots 同步排除 `/ops/*`。

## 认证与登录（分离）

- 普通用户（Next 前端站点）
  - 使用 NextAuth 登录与会话，仅用于业务站点功能；与后台完全隔离。
- 管理员（后台管理系统）
  - 独立登录页与会话，由 GoFly Admin Web 提供（容器内 `/console/login`）；
  - 外部 URL 访问经 `/ops/console/login` 或直接 `/ops/console/panel`（未登录时会跳至登录页）。
  - 登录成功后，后台前端持有 Admin JWT（Authorization: Bearer ...）访问 `/api/v1/console/*`；Go 侧 `AdminJWT` 严格鉴权。
  - 建议使用独立 Cookie/存储名（如 `admin_token`），避免与 NextAuth Cookie 冲突。

## 后台管理（最小可用）

包含以下模块并保证“基本可用”：
- 用户管理：列表/搜索/启禁用、资料查看；关键动作：
  - “调整订阅”：`POST /api/v1/console/users/{userId}/subscription:adjust`
  - “充值/扣减 Token”：`POST /api/v1/console/users/{userId}/tokens:adjust`
  - 幂等：要求 `Idempotency-Key`；写入 `subscription_history`、`token_transactions`，并记录 `user_operation_logs`。
- 订阅管理：Plan 与 Subscription 增改、延期/取消、历史查询。
- Token 管理：余额与流水、充值/扣减、导出。
- 系统管理（强化）：
  - 有效配置快照：`GET /api/v1/console/system/config/effective`（合并 YAML 与 DB 后的生效配置树，含 version/ETag）。
  - 键值编辑：`GET /api/v1/console/system/config/keys`、`POST /api/v1/console/system/config`、`PATCH /api/v1/console/system/config/batch`、`DELETE /api/v1/console/system/config/:key`。
  - 敏感键保护：DB/Redis 密码、JWT/secret 等不可经 UI 修改；所有变更均审计。
  - 热更新：保存即发布 `system:config:updated`，ConfigManager 回调中刷新限流/HTTP/外部 API 客户端。
- API 管理：端点开关、API Keys（生成/吊销）、套餐限额（落表 `rate_limit_configs`）。
- 用户活动：邀请（生成/记录）、签到（规则/记录）。

## 定时任务（复用 GoFly Scheduler）

- 启动：在 `cmd/server/main.go` 调用 `scheduler.GetScheduler().Start()`。
- 建议系统任务（最小可用）：
  - RefreshRateLimitsJob（每 60s）：从 `rate_limit_configs` 刷新计划/阈值到内存/Redis，替代零散轮询。
  - ExpireSubscriptionsJob（每日 00:05）：将到期订阅置为 EXPIRED，并记录 history。
  - CleanupIdempotencyAndTasks（每小时）：清理过期 `idempotency_requests` 与历史任务记录。
  - GenerateUsageReportJob（每日 01:00）：生成使用/扣费日报（便于对账）。
- 管理 API（仅 ADMIN）：`GET 列表/状态`、`POST 立即运行`、`PATCH 启用/禁用`。

## 幂等与计费一致性

- 幂等登记表
  - 表结构建议：`idempotency_requests(user_id, endpoint, key, status, created_at)`，唯一键 `(user_id, endpoint, key)`。
  - 路径：所有 `:execute | :adjust` 强制要求 `Idempotency-Key`；重复到达返回“duplicate=true”或上次结果引用。
- 计费规范
  - 预检不扣费；成功路径扣费并写 `token_transactions`；失败（系统异常）可最小化退款并审计。

## 限流与可观测

- 限流
  - 统一由 Go 返回 `X-RateLimit-Limit/Remaining/Reset` 与 `Retry-After`；套餐维度由 `RateLimitConfig.Plans`/`rate_limit_configs` 驱动。
  - Next 仅保轻量 per-IP 提示（可选），最终判定以后端为准。
- 可观测
  - 全链路 `X-Request-Id` 与 `Server-Timing`；结构化 JSON 日志包含 `request_id/user_id/plan/tokens_cost/cache_hit/latency_ms`。
  - 指标（Prometheus）：QPS、限流命中、任务队列深度、上游错误率等。

## 首启最小环境变量（必须项）

- 必须（无法启动/鉴权会失败）
  - `DATABASE_URL`：MySQL 连接串（例：`mysql://user:pass@host:3306/autoads?parseTime=true&loc=Local`）
  - `REDIS_URL`：Redis 连接串（例：`redis://default:pass@host:6379/0`）
  - `AUTH_SECRET`：NextAuth/签名密钥（随机 32+ 字节）
  - `NEXT_PUBLIC_DOMAIN`：运行域名（preview: `urlchecker.dev`；prod: `autoads.dev`）
  - `NEXT_PUBLIC_DEPLOYMENT_ENV`：`preview | production`
- 必须（生产建议强制）
  - `INTERNAL_JWT_PUBLIC_KEY`（Go 验签，PEM）
  - `INTERNAL_JWT_PRIVATE_KEY`（Next 签发，PEM）
  - 若暂缺，可在开发期设 `INTERNAL_JWT_ENFORCE=false`（生产必须启用）。
- 建议（第三方登录）
  - `AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`、`AUTH_URL`（例：`https://www.<domain>`）
- 自动推导（未显式设置时由入口脚本生成）
  - `ALLOW_ORIGINS = https://<domain>,https://www.<domain>`
  - `GOOGLE_REDIRECT_URI = https://www.<domain>/auth/google/callback`
- 端口（默认）
  - `PORT=8080`（Go 内部）、`NEXTJS_PORT=3000`（Next，对外仅暴露 3000）

> 建议将以上清单提炼为《docs/minimal-env.md》，并在 README/部署文档显著引用；可附 RSA 密钥生成示例命令。

## 实施计划（按优先级）

- P0（1–3 天，完成最小闭环）
  - 后端
    - [已完成] 将 `cmd/server/main.go` 切换为 `internal/middleware/rate_limiter`，删除简易限流；启用 `InternalJWTAuth`（按环境开关）。
    - [已完成] 管理前缀改造：静态托管 `/console/*`，新增管理 API 前缀 `/api/v1/console/*`（系统配置已接入）；`internal/admin/auth.go` 支持 console 路径。
    - [已完成] 暴露 `GET /console/config/v1`（聚合只读 + ETag）。
  - 前端
    - [已完成] 新增 `/ops/[...path]` 反代（仅允许 `/console/*` 与 `/api/v1/console/*`），为响应添加 `X-Robots-Tag: noindex, nofollow`。
    - [已完成] 移除 Next 所有“管理入口/搜索项/旧路由”，后台仅 URL 直达 `/ops/console/login|/ops/console/panel`。
    - [已完成] 删除 Next 本地管理 API：移除 `apps/frontend/src/app/api/admin/*` 目录，实现彻底退重，所有管理请求统一通过 `/ops/api/v1/console/*` 转发至 Go。
  - 管理台（GoFly Web）
    - [已完成] 路由前缀更名为 `/console/*`；前端 API 客户端切换为 `/ops/api/v1/console/*`（经 Next /ops 网关）；系统管理页与监控页已改用 console 前缀。
    - [已完成（最小版）] 用户列表页新增“调整订阅/充值 Token”弹窗；提交后调用 `/ops/api/v1/console/users/*` 与 `/ops/api/v1/console/tokens/*`。
  - 文档
    - [已完成] 本文落地；新增 `docs/minimal-env.md`（首启最小环境变量）。

- P1（1–2 周，可靠性与可维护性）
  - [已完成] 幂等登记表 + Redis 双重保护：已接入 siterank.batch.execute / batchopen.silent.execute / adscenter.link.update.execute。
  - [已完成] 调度器四个系统任务：限额刷新(60s)/订阅到期(00:05)/幂等清理(每小时)/日报(01:00)；已提供“列表/运行/启停”管理 API（/api/v1/console/scheduler/*）。
  - [已完成（后端+前端调用改造）] API 管理：已注册 /api/v1/console/api-management/*（端点/Keys/分析/性能）；GoFly Web 的 API 客户端已切换为 console 前缀（经 /ops）。
  - [已完成（基础版）] 系统管理页新增“有效配置快照”视图（/ops/console/config/v1）；支持查看 version/ETag 与生效配置树；后续可增强为树形折叠/高亮/搜索。
  - [已完成] 角色收敛：前后端仅保留 USER/ADMIN；前端移除一切 SUPER_ADMIN 入口与判定；后端 AdminJWT 严格限制 ADMIN。

## 未完成项与评估（Remaining Work）

- 文档与脚本
  - [已完成] 统一替换仓库文档中的 `/api/admin` 示例为 `/ops/api/v1/console/*`；核心 README/部署文档与 minimal-env 已更新，新增 CI 冒烟测试接入示例（README-deployment.md）。
  - [已完成] `scripts/e2e-smoke.sh` 覆盖 :check/:execute 幂等、限流头与 `/ops/console/config/v1` ETag 304 验证，可在 CI 调用。
- UI/体验增强
  - [已完成（基础版）] 系统管理“有效配置快照”支持树形折叠与关键词筛选，便于大规模配置排查（GoFly Web SystemManager）。
  - [保留建议] 用户详情页聚合可在后续按需实现，当前在列表页提供最小操作入口，满足基本维护需求。
  - [已完成（调整）] API 监控 SSE 暂未启用，前端已改为轮询基础指标；如需实时流可后续接入 SSE/WebSocket。
- 代码与注释
  - [保留建议] Go 侧少量注释/样例仍存在 `/api/admin` 文本（不影响运行），可在后续统一替换为 `/api/v1/console` 与 `/console`。
  - [保留建议] 部分“演示/归档”型前端页面指向的 `/ops/api/v1/console/*` 后端端点尚未落地（无导航入口不影响使用），如需启用可在 Go 端补齐 API。
- SEO 与访问限制
  - [已完成] /ops/* 已注入 X-Robots-Tag，robots 排除；站点地图不包含 /ops 链接。
- 可观测与告警
  - [已完成（基础版）] 暴露 Prometheus 指标 `/metrics`，包含 HTTP/系统/任务等指标；告警可通过外置 Prometheus + Alertmanager 依据阈值规则接入（示例见 gofly_admin_v3/cmd/autoads-saas/README.md）。

- P2（2–4 周，观测与体验）
  - 指标完善与告警接入；日志字段补齐；导出报表工具。
  - 上游客户端熔断/退避策略完善；错误 TTL/成功 TTL 与阈值可配置。

## 一次性执行指令（无中断授权语句）

将以下指令粘贴给开发代理（本助手）即可一次性推进 P0+P1 所有改动（允许破坏性变更）：

```
按 docs/ArchitectureOptimization02.md 一次性完成 P0+P1 全量改动（允许破坏性重构，无需兼容窗口）：

1) 路由与权限
- 将所有 /admin/* 与 /api/v1/admin/* 改为 /console/* 与 /api/v1/console/*；删除旧前缀；
- Next 新增 /ops/[...path] 反代，仅允许 /console/* 与 /api/v1/console/*，附 X-Robots-Tag；权限由 Go AdminJWT 决策；
- Next 前端移除全部“管理入口/搜索项/旧路由”，后台仅 URL 直达 /ops/console/login 或 /ops/console/panel；
- 角色仅 USER/ADMIN，移除 SUPER_ADMIN；所有管理守卫仅 ADMIN；

2) 后端统一
- cmd/server/main.go 切换为 internal/middleware/rate_limiter，删除简易限流；
- 启用 InternalJWTAuth（预发 INTERNAL_JWT_ENFORCE=false，生产 true），白名单 /health|/ready|/live|/console/panel/*；
- 暴露 /console/config/v1（聚合只读+ETag）与系统管理 CRUD（keys/effective/upsert/batch/delete，热更新+审计）；
- 新增 idempotency_requests 表与必要索引（subscriptions/token_transactions/rate_limit_configs）。

3) 调度与系统任务（复用 GoFly scheduler）
- 启动 scheduler 并注册：限额刷新(60s)、订阅到期(00:05)、幂等与任务清理(每小时)、日报(01:00)；
- 管理 API：列表/运行/启停（仅 ADMIN）。

4) 管理台（GoFly Web）
- 全量更名路由与 API 客户端到 /console 与 /api/v1/console；
- 用户详情新增“调整订阅/充值 Token”弹窗；
- 系统管理页新增“有效配置快照/键值编辑器”。

5) 文档与校验
- 增补 docs/minimal-env.md；更新 README/部署文档引用；
- 添加/更新冒烟脚本：验证 :check/:execute 幂等、限流头、系统管理热更；

注：RSA PEM 在部署时通过环境变量注入：
- INTERNAL_JWT_PUBLIC_KEY（Go）
- INTERNAL_JWT_PRIVATE_KEY（Next）
```

> 若暂未准备 RSA，可在预发/本地设置 `INTERNAL_JWT_ENFORCE=false` 以便开发联调；生产前必须开启。

## 验收标准

- 并发与稳定：执行型原子端点在 2C4G 单实例可承载 300–600 RPS，错误率 < 0.1%，TP90 < 200ms（内网）。
- 一致性：`X-Request-Id`/`Server-Timing` 覆盖；`X-RateLimit-*` 与 `Retry-After` 正确；幂等键不重复扣费。
- 可维护：后端单入口/单限流/单配置；前端无本地管理 API；管理台功能“够用且不复杂”。
- 热更新：系统管理保存后 1–2 秒内各模块生效；`/console/config/v1` 的 version/ETag 更新可见。

## 变更清单（文件级提示）

- Go（示例关键路径）
  - `gofly_admin_v3/cmd/server/main.go`：
    - 接入 `internal/middleware/rate_limiter`，删除简易限流；
    - 新增/改名路由组至 `/api/v1/console/*` 与 `/console/*`；
    - 启动 `scheduler`（Start）并注册系统 Job；
    - 暴露 `/console/config/v1` 与系统管理 CRUD。
  - `gofly_admin_v3/internal/admin/auth.go`：路径判断从 admin 改为 console，仅 `ADMIN` 允许。
  - 新增表/索引：`idempotency_requests`、常用查询索引（subscriptions/token_transactions/rate_limit_configs）。
- Next（示例关键路径）
  - `apps/frontend/src/app/ops/[...path]/route.ts`：新增网关；
  - `apps/frontend/src/app/go/[...path]/route.ts`：更新 allow 前缀，移除 `/admin/*`，加入 `/console/*` 与 `/api/v1/console/*`；
  - 前端不提供任何后台入口：移除导航/搜索项/直达链接（后台仅 URL 直达）；
  - 删除 Next 本地管理 API：移除 `apps/frontend/src/app/api/admin/*`，所有管理调用统一走 `/ops/api/v1/console/*`；
  - 角色守卫仅 ADMIN，移除一切 SUPER_ADMIN 代码路径与选项；
- GoFly Admin Web（Vite）
  - `web/src/router/index.js` 与相关 API 客户端：`/admin` → `/console`，`/api/v1/admin` → `/api/v1/console`；
  - 用户详情页：新增“调整订阅/充值 Token”弹窗逻辑与对接 API；
  - 系统管理页：新增“有效配置快照/键值编辑器”两个页签。

## 回滚策略（仅紧急）

- 关闭 `INTERNAL_JWT_ENFORCE`、临时放宽限流阈值；保留 `/ops/*` 网关但允许更多前缀以排障。
- 回退镜像到上一已知稳定版本（CI 已按分支/Tag 产出 preview/prod 标签）。

---

以上为 02 版架构优化方案。若需继续实施，请从“实施计划 P0”开始逐项推进；遇到未覆盖问题，补充到本文件“变更清单/任务列表”并更新状态，确保后续会话可无缝衔接。
