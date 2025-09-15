# AutoAds 架构优化方案（可执行版）

本方案凝结近期讨论的最新结论，面向多用户 SaaS 的高并发生产环境，保持“Never break userspace”，用最少的概念收敛边界、统一计费与配置，并提供清晰的落地路线与任务清单，确保新开会话可直接续作。

## 目标与约束
- 多用户 SaaS，无“租户”概念；共享一套用户与业务数据。
- Go 后端承担所有高并发写入与重任务执行；Next.js 仅负责用户 UI、会话与轻量只读 API/编排。
- 计费口径：以“Go 原子扣费”为准（单事务、幂等、可回放）。
- 后台管理复用 GoFly Admin，作为唯一“配置中台 + 运营后台”，允许二次开发。
- 内部调用安全使用 RSA 签名的 JWT（Next 签发，Go 验签）。
- 单镜像部署（对外仅 3000 端口），2C4G 资源预算；域名/ENV 约束按 docs/MustKnow.md 执行。

## 原则（Linus 式）
- KISS：边界清晰、职责单一；消除特殊分支，优先整合到数据/契约层。
- Never break userspace：对外 API 与行为向后兼容（保留 rewrite、错误语义与返回头一致）。
- 实用主义：先交付 P0 最小闭环，再逐步演进；避免跨层重复实现。

## 目标架构（优化后）
- Next.js（apps/frontend）
  - 仅面向终端用户：UI、会话（NextAuth）、轻量只读 API、编排。
  - 通过同源 `/go/*` 代理调用 Go；在代理层签发内部 RSA JWT、注入 `X-Request-Id` 与 `Idempotency-Key`。
  - 不承载管理/配置/核心写入逻辑；删除内部 JSON 配置路径，仅读 Go 的配置聚合 API 与 ENV。
- Go 后端（gofly_admin_v3）
  - 承担所有高并发写入与重任务：权限校验、原子扣费、执行业务、落账、限流、缓存、审计。
  - 暴露配置聚合只读 API，热加载配置；结构化日志与统一指标。
- GoFly Admin（复用 + 二开）
  - 唯一“配置中台 + 运营后台”：SystemConfig、Plan/PlanFeature、RateLimit、TokenRules、FeatureFlags、Integrations、审计、任务监控等。
  - 所有配置编辑仅在 Admin 内完成；前台与业务服务仅只读快照。

## 边界与数据真相源
- 业务数据（用户/订阅/Token/审计/使用记录）统一存储 MySQL。
- Go 为“写入真相源”：原子扣费与业务执行在 Go 内完成，持久化与审计在同事务内；Next 不直接写业务表。
- Next 的 Prisma 作为只读视图（报表/列表/页面渲染），必要写操作改经由 Go API。

## 内部调用与安全（RSA）
- Next 在 `/go/*` 代理层签发 RS256 JWT，注入到 `Authorization: Bearer <jwt>`。
- Go 中间件使用公钥校验签名与声明，并校验幂等与限流：
  - 建议 Claims：
    - `iss=autoads-next`，`aud=internal-go`，`sub=<userId>`，`exp=+60~300s`，`nbf` 可选
    - `jti=<uuid>`（配合 Redis 短期存储，抗重放）
    - `role`、`planId`、`planTier`、`scope=[siterank.execute, adscenter.execute, ...]`
    - `featureFlagsHash`（变更即失效）
  - 幂等：`Idempotency-Key: <uuid>`（以 userId+key 作为 Redis 去重键，保持一次性/可重试）。
- 统一链路：`X-Request-Id` 贯穿 Next↔Go，`Server-Timing: upstream;dur=<ms>` 反映上游耗时。

必备环境变量（示例）：
- Next：`INTERNAL_JWT_PRIVATE_KEY`（PEM）、`INTERNAL_JWT_TTL_SECONDS`、`INTERNAL_JWT_ISS=autoads-next`、`INTERNAL_JWT_AUD=internal-go`
- Go：`INTERNAL_JWT_PUBLIC_KEY`（PEM）
- 其余遵循 docs/MustKnow.md（数据库、Redis、域名、镜像）。

## 统一限流与配额（Go 权威）
- Redis 计数键：`rl:user:<userId>`、`rl:ip:<ip>`、`rl:plan:<planId>`（支持 RPS/RPM 与 `burst`）。
- 规则来自 GoFly Admin 的 `rate_limit` 配置（按套餐/功能粒度），热加载生效。
- 响应头对齐：`X-RateLimit-Limit/Remaining/Reset`、`Retry-After`；超限返回 429。
- Next 仅保轻量 per-IP 保护，最终以 Go 判定为准。

## 原子扣费与命令式接口（Go 为准）
- 命名建议（示例）：
  - `POST /api/v1/siterank/batch:execute`（执行） / `POST /api/v1/siterank/batch:check`（预检）
  - `POST /api/v1/batchopen/silent:execute` / `:check`
  - `POST /api/v1/adscenter/link:update` / `:check`
- 语义统一：鉴权/限额 → 原子扣费 → 业务执行 → 账单/结果落库（单事务/幂等）。
- 预检仅用于 UI 提示，不产生扣费；最终扣费以 `:execute` 为准。

## 配置中台与下发（GoFly Admin）
- 数据模型：`system_configs`、`plans`、`plan_features`、`rate_limit_plans`、`token_rules`、`feature_flags`、`integrations`。
- 聚合只读 API：`GET /admin/config/v1`
  - 返回配置快照 + `version` + `ETag`；支持 `If-None-Match`；适配灰度/热更新。
  - Next 仅读取与缓存（内存/Redis）；删除内部 JSON 配置路径依赖。
- 基础设施配置（DB/Redis/HTTP/日志）保留 YAML；“业务配置”100%入库、可审计与热更。

## 缓存与外部 API（Go 统一）
- SiteRank 缓存：成功 TTL=7 天、错误 TTL=1 小时；响应头 `X-Cache-Hit: 1|0`。
- 对上游透传 `ETag/If-None-Match`，减少带宽与成本；缓存穿透/雪崩采用抖动与单飞行防护。

## 日志、追踪与健康
- 结构化 JSON 日志字段：`request_id`、`user_id`、`feature`、`plan`、`tokens_cost`、`latency_ms`、`cache_hit`、`rate_limited`、`error_code`。
- `X-Request-Id` 贯穿，`Server-Timing` 暴露上游耗时；必要时增设 `traceparent`。
- 健康：`/health`（综合）、`/ready`、`/live`；Next `/api/health` 与 Go `/api/health` 语义保持一致。

## 兼容性与路由
- 统一名称：`adscenter`；保留 `/api/changelink/*` → `/api/adscenter/*` 的 rewrite（不破坏用户空间）。
- 外部只有 3000 端口，Go 仅容器内 8080；Next `/go/*` 反代 Go。

---

## P0（1–2 周）最小可用改造
- Next（apps/frontend）
  - [ ] 去除 `src/lib/config/environment.ts` 对 `config/environments/*.json` 的依赖；仅用 ENV + `GET /admin/config/v1`（只读）。
  - [ ] `/go/*` 代理签发 RSA JWT（TTL=120s），注入 `Authorization`、`Idempotency-Key`、`X-Request-Id`。
  - [ ] 统一错误语义与头（401/403/402/429、`X-RateLimit-*`、`Server-Timing`）。
  - [ ] 下线/隐藏 Next 管理台入口（全部跳转 GoFly Admin）。
- Go（gofly_admin_v3 + GoFly Admin 二开）
  - [ ] 中间件：RSA 验签（`INTERNAL_JWT_PUBLIC_KEY`）+ 统一限流（Redis）+ 结构化日志 + `X-Request-Id`。
  - [ ] 配置聚合 API：`GET /admin/config/v1`（快照 + `version` + `ETag`）；热加载回调。
  - [ ] 落地首条原子命令端点：`POST /api/v1/siterank/batch:execute` 与 `:check`（事务/幂等/审计）。
  - [ ] 文档化错误码、头、幂等与重试规则；提供回滚开关（feature flag）。
- DB/运维
  - [ ] Redis 去重键（`idem:<userId>:<key>`）与 JWT `jti` 窗口；TTL 合理配置。
  - [ ] 启动校验必需 ENV/密钥（按 docs/MustKnow.md 与本方案）。

## P1（2–4 周）并发稳定与运营闭环
- [ ] 任务中心（Go）：优先级/并发度/重试/滞留监控；Next 仅展示进度/历史。
- [ ] 完成 BatchOpen 静默、AdsCenter 链路的原子端点迁移；统一扣费口径。
- [ ] SiteRank 缓存与 ETag 透传完整化；运营工具（规则热加载试算、手工充值/订阅调整在 Go 执行）。
- [ ] 统一指标面板（QPS/P95/P99/错误率/限流命中/扣费失败/任务滞留、配置版本与审计）。

## P2（1–3 个月）韧性与扩展
- [ ] 执行器弹性：分片、熔断、隔离故障域；配置灰度生效。
- [ ] 可选分镜像产物（默认仍单镜像）：`autoads-next` 与 `autoads-go`，为未来水平扩缩容做准备。

---

## 接口契约（摘要）
- 通用请求头：
  - `Authorization: Bearer <internal_rsa_jwt>`
  - `Idempotency-Key: <uuid>`（必选）
  - `X-Request-Id: <uuid>`（若缺失由服务生成并回写）
- 通用响应头：
  - `X-Request-Id`、`X-RateLimit-Limit/Remaining/Reset`、`Server-Timing`、可选 `X-Cache-Hit`
- 错误语义：
  - 401 未认证、403 无权限、402 余额不足、429 触发限流、5xx 服务错误；`{ code, message, details? }`
- JWT Claims 示例（payload）：
  ```json
  {
    "iss": "autoads-next",
    "aud": "internal-go",
    "sub": "user_abc123",
    "exp": 1735689600,
    "jti": "1b2a4f8a-...",
    "role": "USER",
    "planId": "plan_pro",
    "planTier": "PRO",
    "scope": ["siterank.execute", "adscenter.execute"],
    "featureFlagsHash": "sha256:..."
  }
  ```

## 环境变量（增量）
- Next：
  - `INTERNAL_JWT_PRIVATE_KEY`（PEM）
  - `INTERNAL_JWT_TTL_SECONDS=120`
  - `INTERNAL_JWT_ISS=autoads-next`
  - `INTERNAL_JWT_AUD=internal-go`
- Go：
  - `INTERNAL_JWT_PUBLIC_KEY`（PEM）

其余 ENV（数据库/Redis/域名/镜像标签/资源）按 docs/MustKnow.md 执行。

## 验收标准
- 扣费：所有可计费操作经 Go 的原子端点完成；同一 `Idempotency-Key` 不重复扣费；预检不扣费。
- 限流：`X-RateLimit-*` 头与 429 语义一致；per-IP 与 per-User 生效，套餐维度规则按配置生效。
- 观测：日志含 `request_id/user_id/feature/plan/tokens_cost/latency_ms/cache_hit`；Next↔Go 的 `Server-Timing` 与 `X-Request-Id` 贯通。
- 兼容：/api/changelink/* 旧路径仍可用（rewrite 至 /api/adscenter/*）；外部行为无破坏。

## 回滚策略
- Feature flag：可一键关闭“原子端点/新限流/内部 JWT 验签”，回退到旧链路（仅在紧急情况下，保留最小兼容层）。
- 配置回滚：GoFly Admin 配置版本化，回滚到上一个稳定版本。
- 观测兜底：异常峰值时，先降级缓存 TTL/并发度与限流阈值，后排障。

---

## 任务看板（可续作）

// Next：
//  - [x] 移除 `apps/frontend/src/lib/config/environment.ts` 的 JSON 查找；全站改用 ENV + `/go/admin/config/v1` 只读（已落地）
//  - [x] `/go/*` 注入 RSA JWT/Idempotency/X-Request-Id；统一错误头回显
//  - [x] 隐藏/跳转所有 Next 管理台入口（链接/导航/直达路由 → `/go/admin/gofly-panel`）
//  - [x] SiteRank 批量接入 Go 原子端点（check→execute 预检与原子扣费，失败回退单域）
//  - [x] BatchOpen 静默接入 Go 原子端点（开关式：`NEXT_PUBLIC_USE_GO_BATCHOPEN`，失败回退本地实现）
//  - [x] BatchOpen 进度轮询支持 `/go/api/v1/batchopen/tasks/:id`
//  - [x] 新增前端只读配置适配器（`lib/config/remote-config.ts`，ETag + 60s TTL 缓存）
//  - [x] AdsCenter 旧入口切换到新 Hook（`useAdsCenterUpdate`，check→execute；保留回退和快速执行卡片）
//  - [x] 用只读配置适配器替换散落配置读取点（ENV 为 fallback）：FeatureFlags/SimilarWeb/AdsPower/Gmail/TokenConfig 等（其余按需补充）
//      · 已覆盖：Token/AdsCenter/SimilarWeb/AdsPower/Gmail/FeatureFlags（payments/debug/analytics/maintenance）
//  - [x] UI 限流上限展示（远端配置驱动）：已在 SiteRank/BatchOpen/AdsCenter 三处对齐（仅展示用途，权威以后端 X-RateLimit-* 为准；含 Plan/Feature 维度展示）
//  - [x] Admin API 全量透明转发：`/api/admin/*` → `/ops/api/v1/console/*`（通过同源反代注入内部JWT/幂等/链路头）

- Go：
  - [x] 新增中间件：RSA 验签（软启用/可强制）+ 结构化请求日志 + `X-Request-Id` 回显
  - [x] `GET /admin/config/v1` 配置聚合（ETag/版本）与热更回调（只读快照）
  - [x] `POST /api/v1/siterank/batch:check|:execute`（原子扣费/幂等/审计）
  - [x] `POST /api/v1/batchopen/silent:check|:execute` + `GET /api/v1/batchopen/tasks/:id`（原子扣费/幂等/进度/审计）
  - [x] 成功路径输出 `X-RateLimit-*` 头（Redis/内存）与 `Server-Timing: app;dur=...`
  - [x] AdsCenter 原子端点（check/execute，按 extract+update_ads 规则估算；执行在服务内分阶段扣费）

- 运维/CI：
  - [x] 启动前 ENV 校验脚本（keys/DB/Redis/域名/镜像 tag）
  - [x] 健康检查/回滚脚本更新（保持单镜像、外部仅 3000）
  - [x] 端到端 E2E 验证脚本（预检→执行→幂等→审计头）

## 未完成项与后续计划（评估）
- UI 限流提示扩展（已覆盖主流程）
  - 现状：已在 SiteRank/BatchOpen/AdsCenter 页面展示“每分钟请求上限（展示）”，并读取 Plan/Feature 维度上限用于更细粒度提示；其余页面（若需要）可按需补齐。
  - 建议：按需在更多入口展示，或仅在接近阈值/触发 429 时引导，进一步平衡信息量与体验。
- CI 集成 E2E（待接入）
  - 已提供 `scripts/e2e-atomic-endpoints.sh`；建议在 Preview/Prod 部署前做冒烟验证，校验预检/幂等/审计头。
- Trace 上下文（可选）
  - 文档中提到可增设 `traceparent`；目前仅贯通 `X-Request-Id` 与 `Server-Timing`。如需与外部 APM 对接，可追加 `traceparent` 注入与解析。
- 余量配置点核查（按需）
  - 已覆盖 FeatureFlags/SimilarWeb/AdsPower/Gmail/TokenConfig 的只读化读取；其余零散 ENV 读取（如 Stripe 显示开关、部分 runtime 变量）保持 ENV-only，符合“基础设施配置走 ENV、业务配置走只读快照”的原则。

> 注：P0 已实现核心闭环（内部 JWT、配置聚合、SiteRank/BatchOpen/AdsCenter 原子端点与前端接入开关）。下一步：用只读配置适配器替换散落读取点，并将 AdsCenter 既有入口全量切换到新 Hook（保留回退）。
