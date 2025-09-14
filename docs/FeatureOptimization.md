# 功能优化方案（Feature Optimization Plan）

本文件沉淀当前阶段的产品与工程优化方案，包含目标、约束、实施清单、里程碑与验收标准。方案明确守卫/扣费职责、SiteRank 统一缓存、客服微信弹窗复用与后台手动开通流程等关键点，确保新开会话亦可据此继续推进未完成任务。

## 背景与约束
- 支付方式：用户添加客服微信，管理员在后台手动配置充值/开通；不集成线上支付。
- 功能守卫 vs 扣费：
  - 功能守卫仅校验“登录 + 套餐 + PlanFeature”，决定能否使用。
  - 扣费仅在功能执行成功后进行 Token 扣减与记录。
- 301 跳转：已在 DNS 层实现，服务内不再实现。
- SiteRank 缓存与扣费策略：
  - 同一域名的“成功查询结果”全局缓存 7 天（不区分用户）。
  - 命中 7 天缓存仍视为成功查询，依然全额扣费。
- 客服微信弹窗：复用 pricing 页“立即订阅”弹窗的样式与骨架，根据场景调整文案（余额不足、无权限升级、AdsCenter 启用引导、BatchOpen/自动化入口）。

## 设计原则
- KISS、Never break userspace、实用主义；优先落地与可回滚。
- 安全与可观测：鉴权前置、限流可控、审计留痕、指标可见。

## P0（本周内）

### 1) 守卫/扣费职责彻底分离
- 核心思路：
  - withFeatureGuard 仅返回 401/403 与 X-Feature-Limits；不进行任何扣费或余额判断。
  - 业务路由执行“两步式”：
    - 预检余额（不扣费）：`TokenService.checkTokenBalance(userId, required)`；不足返回 402 + {required,balance}。
    - 执行主逻辑（含缓存读取/上游请求）。
    - 成功后扣费：`TokenService.consumeTokens(userId, feature, action, { batchSize, metadata })`。
- 标准特征映射：
  - 业务侧统一字符串：`siterank | batchopen | adscenter`。
  - DB 写入枚举：`SITERANK | BATCHOPEN | CHANGELINK`（AdsCenter ↔ CHANGELINK）。
  - 显式映射表替代字符串拼接。
- 影响范围：
  - `apps/frontend/src/lib/middleware/feature-guard-middleware.ts`（移除 requireToken/getTokenCost 逻辑）。
  - `apps/frontend/src/app/api/siterank/*`、`batchopen/*`、`adscenter/*` 路由（落地两步式流程）。
  - `apps/frontend/src/lib/services/token-service.ts`（统一映射、对齐枚举）。

### 2) SiteRank 成功结果全局缓存（7 天）
- Redis 设计：
  - 成功结果：`siterank:v1:<domain>`，TTL = 7 天（604800s）。
  - 错误结果：`siterank:v1:err:<domain>`，TTL = 1 小时（节流上游）。
  - 批量查询：`mget`/pipeline 拉取命中，剩余未命中并发查询；最终聚合返回。
- 扣费策略：按“请求域名数”计费，命中缓存不减免。
- 可观测：响应头可附 `X-Cache-Hit: <hitCount>/<total>`（仅提示，非契约）。
- 影响范围：
  - `apps/frontend/src/lib/siterank/unified-similarweb-service.ts`（接入 `getRedisClient()`，实现 get/set + TTL；批量 mget）。
  - `apps/frontend/src/app/api/siterank/batch/route.ts`（在成功路径扣费并写入响应头）。

### 3) 客服微信弹窗统一复用 + 场景化文案
- 组件复用：抽取 pricing 页“立即订阅”弹窗组件为通用组件（或对现组件暴露复用 API），统一在全站调用。
- 场景化文案建议（按需微调）：
  - 余额不足提示：
    - 标题：余额不足，联系顾问快速充值
    - 内容：本次预计消耗 {required} Token，当前余额 {balance}。添加客服微信，说明账户邮箱与需求，运营将尽快为你开通/充值。
    - 行为：复制微信号 / 扫码添加
  - 无权限升级提示：
    - 标题：升级套餐以解锁该功能
    - 内容：当前套餐不包含此功能。添加客服微信，告知账户邮箱与目标套餐，运营将协助开通。
  - AdsCenter 启用引导：
    - 标题：启用 AdsCenter 自动化
    - 内容：请联系顾问完成 Ads 账户配置与首次初始化，确保执行稳定可靠。
  - BatchOpen/自动化入口：
    - 标题：开通静默/自动化访问
    - 内容：根据场景推荐批量访问能力（静默/自动化/定时），添加客服获取最佳实践与开通支持。
- 影响范围：
  - 新增/抽取：`components/common/WeChatSubscribeModal.(tsx|tsx+)`（或在现组件上暴露复用接口）。
  - 在 `siterank`、`batchopen`、`adscenter` 相关页面与余额不足/无权限拦截处调用。

### 4) 管理后台：手动充值/开通强化 + 审计
- 功能项：
  - 手动充值：指定用户、Token 数/备注；写 `TokenTransaction` 与用户余额；同步 `audit_logs`。
  - 套餐开通/调整：选择 Plan（立即/到期后生效）、写 `Subscription` 与 `SubscriptionHistory`；同步审计。
  - 快捷动作：一键赠送试用、延长有效期、恢复默认配额。
- 影响范围：
  - 后台 API：若已存在则对接，否则在 `/api/admin/*` 增补最小可用接口；沿用权限校验与速率限制。
    - 迁移完成：Next 端 `/api/admin/*` 不再承载写入；`/api/admin/api-management/*` 透明转发至 `/go/admin/api-management/*`，其余统一返回 410 并引导 `/go/admin/gofly-panel`。

### 5) 配置读取统一走只读快照（远端优先）
- 前端特性开关：
  - [x] 新增 `lib/config/feature-flags.ts`，统一 `payments/debug/analytics/maintenance` 等开关读取（远端 → ENV 兜底）
  - [x] 替换 Admin、订阅管理等入口的 `NEXT_PUBLIC_*` 读取
- 外部集成：
  - [x] SimilarWeb：通过 `APP_CONFIG` 优先远端（`APIs.SimilarWeb.BaseURL`/`HTTP.Timeout`）
  - [x] AdsPower：`AdsPowerApiClient` 与 `domain-config` 优先远端（`integrations.adsPower.apiUrl`）
  - [x] Gmail：`gmail-service` 从远端 `integrations.gmail.*` 读取 OAuth 配置，tokens 仍走 DB
- `config-service.ts`：
  - [x] `get(key)` 统一远端优先（支持 `system_configs.<key>`/平铺 `<key>`）→ Prisma `systemConfig` 兜底
  - 前端后台页：用户详情/套餐管理/Token 管理页增强。

### 5) 中间件与限流收敛
- 移除根目录 `security-middleware.ts`（中间件不直连 DB），仅保留 `apps/frontend/src/middleware.ts`。
- 统一限流实现：`src/lib/rate-limit.ts`；按路由配置 per-IP/per-User key，返回 `X-RateLimit-*` 头。

## P1（两周内）
- 任务中心：统一 SiteRank 批量与 AdsCenter 执行，提供任务列表、进度、失败重试、历史。
- SiteRank 体验与可运营：字段映射向导、优先级权重滑条、缓存命中提示 UI（不影响扣费）。
- 管理后台运营工具：Token 规则热加载与试算页、限流策略页、简版监控页。

进度备注（P1 部分已落地）
- SiteRank 缓存命中提示 UI：已在分析进度区显示“命中 X/Y”，并在结果表格域名列以“缓存”徽标提示（不影响扣费）。
- 任务中心（最小版）：/api/tasks 聚合 AdsCenter 执行与近 24h 的 SiteRank 批量使用记录，提供 /api/tasks/[id]/retry 重试占位；后续可接入前端页面。
- 管理后台运营工具（最小版）：
  - 限流策略页（仅查看/保存覆盖至 SystemConfig，实际生效以 ENV/后端为准）：/api/admin/rate-limit/overrides
  - Token 规则试算页 API：/api/admin/tokens/try-calc（支持 siterank/batchopen/adscenter）
  - SiteRank 设置（映射 + 权重）API：/api/admin/siterank/settings

## P2（1 月内）
- AdsCenter 执行链路：串联 Google Ads 更新 API 与 AdsPower，分阶段上线，失败重试与节流。
- BatchOpen 静默/自动化产品化：代理与 Referer 策略可视化、分布式执行、成功率统计并纳入任务中心。
- 多租户与品牌化配置：SystemConfig 扩展品牌/域配置，支撑后续多租户。

## 验收标准与指标
- 守卫/扣费：401/403/402 语义清晰；无预扣失败或重复扣费；扣费记录与余额一致。
- SiteRank：缓存命中显著降低响应时间；`X-Cache-Hit` 合理；命中缓存仍全额扣费。
- 客服微信弹窗：统一样式与交互，关键拦截点可见；点击率与转化率有提升。
- 后台手工开通：操作 ≤ 3 步，审计完整，可导出。

## 变更清单（实施指引）
- 守卫/扣费分离
  - 修改 `apps/frontend/src/lib/middleware/feature-guard-middleware.ts`：去除 Token 扣费相关能力，仅保留权限校验与 limits 头。
  - 路由改造：
    - `apps/frontend/src/app/api/siterank/batch/route.ts`（模板）：
      - 预检余额 → 查询（含缓存）→ 成功后扣费 → 返回并加 `X-Cache-Hit`。
    - `apps/frontend/src/app/api/batchopen/*`、`apps/frontend/src/app/api/adscenter/*` 同步改造。
  - 统一映射：`apps/frontend/src/lib/services/token-service.ts` 使用显式映射字典。
- SiteRank 缓存
  - `apps/frontend/src/lib/siterank/unified-similarweb-service.ts`：接入 Redis get/mget/setex、错误缓存与 TTL；批量查询合并；日志与 header（可选）。
- 客服微信弹窗
  - 抽取/导出 `pricing` 弹窗组件为 `components/common/WeChatSubscribeModal`；在前台多个场景调用。
- 后台手工开通
  - `/api/admin/*` 增补最小可用接口或对接现有接口；更新管理后台页面。
- 中间件与限流
  - 废弃根 `security-middleware.ts`；集中到 `apps/frontend/src/middleware.ts`；统一 `rate-limit.ts` 使用方式。

## 风险与回滚
- 缓存一致性：以 TTL 控制；出现上游契约变化时可临时关闭缓存（环境开关）。
- 环境开关：`SITERANK_CACHE_DISABLED=true` 可禁用 SiteRank 缓存（仅用于应急回滚与排障）。
- 守卫/扣费迁移：按路由分批上线；发现扣费异常可快速回退到旧路径（保留最小兼容层）。
- 弹窗复用：保留旧触发逻辑的开关，灰度到统一组件。

## 路线图与里程碑
- 里程碑 M1（P0 完成）：守卫/扣费分离、SiteRank 统一缓存、客服微信弹窗统一、后台手工开通增强。
- 里程碑 M2（P1 完成）：任务中心、运营工具完善、SiteRank 体验强化。
- 里程碑 M3（P2 部分）：AdsCenter 执行链路试点与 BatchOpen 产品化推进。

## 任务看板（可用于继续开发）
- 守卫/扣费分离
  - [x] 移除 `feature-guard-middleware` 中的扣费逻辑，仅保留权限
  - [x] `siterank/batch` 路由接入“两步式”并落地扣费
  - [x] 同步改造 `batchopen/*` 与 `adscenter/*` 路由（均为预检→执行→成功后扣费；AdsCenter 已迁至“执行完成后扣费”（幂等））
  - [x] `token-service` 特征映射改为显式字典
- SiteRank 缓存
  - [x] `unified-similarweb-service` 接入 Redis get/mget/setex
  - [x] 定义成功与错误缓存 TTL（7 天/1 小时）
  - [x] 批量查询聚合与 `X-Cache-Hit` 头
- 客服微信弹窗
  - [x] 抽取 pricing 弹窗为通用组件并导出
  - [x] 在余额不足、无权限升级、AdsCenter 引导、BatchOpen/自动化入口处复用
- 后台手工开通
  - [x] 增补/对接手动充值接口（页面对接待办）
  - [x] 增补/对接套餐开通/调整接口（既有接口对接，页面对接待办）
  - [x] 审计日志接入（导出已完成：`/api/admin/audits/export?format=csv|json`）
- 中间件与限流
  - [x] 移除根 `security-middleware.ts`
  - [x] 统一 `withApiProtection` 到 SiteRank/AdsCenter/BatchOpen 核心路由（含 `X-RateLimit-*` 提示头）
  - [x] 抽取限流阈值为环境变量（`RATE_LIMIT_*_PER_MINUTE`）以便热调
  - [ ] 余下零散路由继续接入与治理（按需）

### 验收与验证脚本（新增）
- [x] 健康检查脚本：`deployments/scripts/health-check.sh`（/go/health|ready|live|/go/api/health）
- [x] 回滚脚本：`deployments/scripts/rollback.sh <image_tag>`（单镜像，端口 3000）
- [x] 端到端脚本：`scripts/e2e-atomic-endpoints.sh`（预检→执行→幂等→校验 `X-Request-Id/Server-Timing/X-RateLimit-*`）
- [x] 启动前 ENV 校验：`apps/frontend/scripts/validate-env.js`（prestart），`scripts/validate-env.sh`（仓库级）

### 速率限制环境变量（可热调）
- `RATE_LIMIT_API_PER_MINUTE`（默认 100）
- `RATE_LIMIT_SITERANK_PER_MINUTE`（默认 30）
- `RATE_LIMIT_ADSCENTER_PER_MINUTE`（默认 20）
- `RATE_LIMIT_BATCHOPEN_PER_MINUTE`（默认 10）
- `RATE_LIMIT_AUTH_PER_MINUTE`（默认 5）
> 注：上述为 Next 侧轻量限流，最终以后端/Go 的权威限流为准；用于快速热调与前端提示。

以上方案与任务清单与 MustKnow/Principles 一致，可直接作为新会话的接续依据。
