# FeatureOptimization03 实施说明（/api/v2）

本次提交在不破坏 v1 的前提下，新增并落地了 /api/v2 的以下能力：

## 统一任务与事件
- GET `/api/v2/tasks/:id`：返回 ExecutionUpdate 快照
- GET `/api/v2/stream/tasks/:id`：SSE 实时推送（首包包含快照），断线降级轮询
- 适配三类任务：BatchOpen（batch_tasks）、AutoClick（autoclick_executions）、AdsCenter（adscenter_tasks）

## BatchOpen Silent v2
- POST `/api/v2/batchopen/silent/start`
- GET `/api/v2/batchopen/silent/tasks/:id`
- POST `/api/v2/batchopen/silent/terminate`
- POST `/api/v2/batchopen/proxy/validate`

复用 v1 服务逻辑，输出统一 ExecutionUpdate。权限：用户级隔离，需 Authorization。

## AutoClick v2
- CRUD/启停：
  - GET `/api/v2/autoclick/schedules`
  - POST `/api/v2/autoclick/schedules`
  - GET `/api/v2/autoclick/schedules/:id`
  - PUT `/api/v2/autoclick/schedules/:id`
  - DELETE `/api/v2/autoclick/schedules/:id`
  - PATCH `/api/v2/autoclick/schedules/:id/(enable|disable)`

## AdsCenter v2
- 模板更新：
  - GET `/api/v2/adscenter/templates`（system_configs: `adscenter.templates`）
  - POST `/api/v2/adscenter/templates/:id/dry-run?account=mock|{customer_id}`
  - POST `/api/v2/adscenter/templates/:id/execute?account=...`
  - 客户端：支持 mock 账户；真实账户读取 `google_ads_configs`（用户私有）
- Offer 解析：
  - POST `/api/v2/adscenter/offers/resolve`（浏览器执行器可选，回退 HTTP 重定向；Redis 缓存 24h）
- 绑定与轮换（最小可用）：
  - POST/GET/PATCH/DELETE `/api/v2/adscenter/offers`
  - POST `/api/v2/adscenter/offers/:id/rotate`（生成轮换记录 + 预测 nextRotationAt）
- 分析面板（基础）：
  - GET `/api/v2/adscenter/analytics/summary|timeseries|breakdown`
    - 有 `ads_metrics_daily` 数据时优先使用聚合表；无则回退轮换/执行统计

## Admin（仅管理员）
- GET `/api/v2/admin/adscenter/google-ads/credentials`：按 userId 可选过滤，脱敏返回
- POST `/api/v2/admin/adscenter/google-ads/oauth/link`：生成授权链接
- POST `/api/v2/admin/adscenter/google-ads/oauth/callback`：交换 refresh_token 入库

## 前端改造
- 新增 BFF：`/api/v2/[...path]` 直转 `/api/go/api/v2`
- 新增 Hook：`useLiveExecution(taskId)` 统一监听 ExecutionUpdate（SSE + 轮询降级）

## 迁移与表
- GORM 自动迁移：
  - `ads_offers`, `ads_offer_bindings`, `ads_offer_rotations`
- 不改动既有 v1 表；与 v1 共存，前端通过 `/api/go/*` 访问。

## 验收建议
- Silent：启动 → `/api/v2/tasks/:id` 进度一致；Terminate 生效
- AutoClick：CRUD/启停；执行队列推进（原有逻辑）
- AdsCenter：
  - `/templates` 正常加载；`account=mock` 下 `dry-run/execute` 返回成功与结果统计
  - `/offers/resolve` 返回 `finalUrl/finalUrlSuffix`；缓存命中
  - 绑定/查询/更新/删除；`/offers/:id/rotate` 产生轮换记录，并回填 nextRotationAt
  - `/analytics/*` 返回数据结构完整（聚合表优先，回退轮换/执行统计）
  - 管理 OAuth：`/admin/adscenter/google-ads/oauth/link` 与 `.../oauth/callback` 正常；回调后 `google_ads_configs` 有刷新令牌

---

注：Google Ads 真实执行取决于 `google_ads_configs` 与网络可达，mock 账户用于本地/CI 验收。Offer 浏览器解析统一使用 `PUPPETEER_EXECUTOR_URL`（容器内置执行器，未配置时使用默认 127.0.0.1:8081）；亦可通过 `AutoClick_Browser_Executor_URL` 的系统配置覆盖。
