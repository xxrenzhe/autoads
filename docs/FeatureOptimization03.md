# FeatureOptimization03 — 前端极简与后台收敛（AutoClick/AdsCenter v2）

本文档在 FeatureOptimization02 的基础上，结合“前端极简 + 复杂度收敛到后台”的原则（见 docs/Pricinples.md），对 BatchOpen 的 AutoClick 版本与 AdsCenter 进行产品化与架构收敛设计。允许为这两类新增功能引入破坏性变更（不强制兼容旧端点/旧负载），以获得更简洁、可控、可观测的实现。新会话可直接依据本文件继续落地未完成项。

## 指导原则（复述）
- 好品味：消除特殊分支，用统一数据结构与事件格式解决问题。
- Never break userspace：仅对新增功能（AutoClick/AdsCenter）放宽，已有功能保持兼容。
- 实用主义：先达成业务闭环与可运维，再优化性能与精度。
- 简洁执念：一个任务模型、一个事件流、一个队列池、一个配置读取层。

---

## 总览与范围
- 统一任务模型 + 统一事件流（ExecutionUpdate）。
- AutoClick v2：计划任务（日目标/时段/国家/预设），前端极简，服务端长期池执行，OPS 承载代理/Referer/并发/RPM/权重曲线等复杂策略。
- AdsCenter v2：多账户统一管理（凭据托管）+ 数据采集（聚合表）+ 可视化面板 + 模板驱动更新 Final URL Suffix（干跑/执行/回滚），前端极简。
- OPS（后台）集中：模板中心、采集策略、并发/限流、失败熔断、队列与指标面板、审计与回滚。

---

## 统一数据与事件
- Task/Execution 统一模型（逻辑层）：
  - Task: { id, feature: 'autoclick'|'adscenter', status, progress, totalItems, processedItems, createdAt, updatedAt }
  - Item: 按功能存储到各自表（AutoClick 执行快照；AdsCenter 变更记录）。
- SSE 统一负载（唯一格式，向前只追加字段）：
  - `{ type: 'execution_update', id, feature, status, progress, processedItems, totalItems, ts }`
- 快照与降级：
  - `GET /api/v2/tasks/:id` 返回与 SSE 一致的对象（断线降级轮询）。
  - `GET /api/v2/stream/tasks/:id` 推送 SSE（首包即发送快照）。

### 事件负载规范与状态枚举
- status 枚举：`pending | running | completed | failed | cancelled`
- progress：0–100（整数，取整），按 processedItems/totalItems 计算（无 total 时允许缺省为 -1 或省略）
- 时序：`ts` 为毫秒时间戳（Unix epoch ms）
- 可选字段（按功能追加）：如 message、hourly、error 分类等；追加不移除，前端需向前兼容

---

## 前端（面向用户）：极简化
- BatchOpen/AutoClick（v2）
  - 表单字段：名称、URL 列表、国家/时段（预设下拉）、每日目标、执行预设（由后台下发）、Referer（社媒/自定义）。
  - 不暴露：代理/并发/重试/轮换/浏览器切换等（Referer 仅 Silent/AutoClick 暴露，Basic 不暴露）。
  - 创建/启停/详情：统一进度组件（基于 ExecutionUpdate）。
- AdsCenter（v2）
  - 概览：多账户 KPI 卡片（Cost/Clicks/Impressions/Conv/ROAS）、时间序列趋势、TopN（Campaign/AdGroup）。
  - 更新：选择账户 + 模板 → 干跑预估（影响条数/Token 预估/样例）→ 执行；详情页统一进度组件；仅保留“重试失败项”。
  - Offer URL 解析：输入联盟 Offer URL → 一键“解析”→ 自动填充 Final URL 与 Final URL Suffix（解析逻辑在服务端/后台）。
  - 绑定与轮换：用户可将 Offer URL 与一个或多个 Ads 账户绑定，并设置“更换频率”（每小时/每天/每周等）；系统按策略定时执行“换链接”（更新 Final URL 与 Final URL Suffix），并保证每次换新的链接在设定唯一性窗口内不重复。
- siterank：保持现有简洁交互（域名输入→结果），不扩展前端复杂参数；后台管理缓存与限流策略。

---

## 后端 API（/api/v2，允许破坏兼容）
- 统一任务与流媒体：
  - `GET  /api/v2/tasks/:id`
  - `GET  /api/v2/stream/tasks/:id` (SSE)
- BatchOpen（v2）
  - Silent：
    - `POST   /api/v2/batchopen/silent/start`（Body: { urls[], cycles?, referer?, presetId? }）
    - `GET    /api/v2/batchopen/silent/tasks/:id`（任务快照，返回 ExecutionUpdate 风格）
    - `POST   /api/v2/batchopen/silent/terminate`（Body: { taskId }）
    - `POST   /api/v2/batchopen/proxy/validate`（Body: { proxyUrl }）
  - Basic：不产生后端任务；若涉及计费/校验端点，同样按 user_id 隔离与审计。
- AutoClick：
  - `GET  /api/v2/autoclick/schedules`
  - `POST /api/v2/autoclick/schedules`
  - `PATCH /api/v2/autoclick/schedules/:id/(enable|disable)`（启停）
  - `DELETE /api/v2/autoclick/schedules/:id`（删除）
- AdsCenter：
  - `GET  /api/v2/adscenter/accounts`
  - `GET  /api/v2/adscenter/templates`
  - `POST /api/v2/adscenter/templates/:id/dry-run?account=...`
  - `POST /api/v2/adscenter/templates/:id/execute?account=...`
  - `POST /api/v2/adscenter/executions/:id/retry-failures`
  - `POST /api/v2/adscenter/executions/:id/rollback`
  - `POST /api/v2/adscenter/offers/resolve`（Offer URL 解析：跟踪重定向获得最终广告主 URL，并拆解 Final URL/Suffix）
  - Offers 绑定与轮换：
    - `POST   /api/v2/adscenter/offers` 绑定 Offer 与账户（Body: { offerUrl, accountIds[], rotation: { frequency: 'hourly'|'daily'|'weekly', at?: 'HH:mm', uniqueWindowDays?: number } })
    - `GET    /api/v2/adscenter/offers?accountId=` 列表
    - `PATCH  /api/v2/adscenter/offers/:id` 更新轮换策略/启停
    - `DELETE /api/v2/adscenter/offers/:id` 解绑
    - `POST   /api/v2/adscenter/offers/:id/rotate` 手动触发一次“换链接”（资源拥有者或管理员）
  - Analytics（可视化）：
    - `GET /api/v2/adscenter/analytics/summary?accounts=&range=`
    - `GET /api/v2/adscenter/analytics/timeseries?metric=&accounts=&granularity=day`
    - `GET /api/v2/adscenter/analytics/breakdown?dimension=&accounts=&range=&sort=&limit=`
  - Finance（余额）：
    - `GET /api/v2/adscenter/finance/summary?accounts=&range=`（余额/信用/未出账/可用额度汇总，含 currency）
    - `GET /api/v2/adscenter/finance/timeseries?metric=balance|available&accounts=&granularity=day`

### 错误码与错误语义
- 统一使用 HTTP 状态码 + 业务体 `{ code, message, details? }`
- 常见错误：
  - 400 VALIDATION_FAILED（参数非法）
  - 401 UNAUTHORIZED（未认证）
  - 403 FORBIDDEN（越权访问）
  - 404 NOT_FOUND（资源不存在或越权隐藏）
  - 409 CONFLICT（唯一性冲突，如轮换目标重复）
  - 422 INSUFFICIENT_TOKENS（余额不足）
  - 429 RATE_LIMITED（限流命中）
  - 5xx 服务端错误（含上游错误分类）

### 请求示例（简化）
- AutoClick 创建：
```json
POST /api/v2/autoclick/schedules
{
  "name": "daily_us_campaign",
  "urls": ["https://example.com/a", "https://example.com/b"],
  "timezone": "US",
  "timeWindow": "06:00-24:00",
  "dailyTarget": 200,
  "presetId": "us_standard",
  "referer": { "type": "social", "id": "google" }
}
```
- Silent 启动：
```json
POST /api/v2/batchopen/silent/start
{
  "urls": ["https://example.com/a"],
  "cycles": 3,
  "presetId": "us_standard",
  "referer": { "type": "custom", "value": "https://www.google.com/" }
}
```
- Offer 解析：
```json
POST /api/v2/adscenter/offers/resolve
{ "offerUrl": "https://affiliate.network/track?pid=...", "accountId": "123-456-7890" }
```
- Offer 绑定与轮换：
```json
POST /api/v2/adscenter/offers
{
  "offerUrl": "https://affiliate.network/track?...",
  "accountIds": ["123-456-7890"],
  "rotation": { "frequency": "daily", "at": "03:00", "uniqueWindowDays": 90 }
}
```
- Finance 汇总：
```
GET /api/v2/adscenter/finance/summary?accounts=123-456-7890,111-222-3333&range=last_30d
```

### 用户级隔离（Per-user isolation & RBAC）
- 用户态端点（/api/v2/adscenter/*、/api/v2/batchopen/*、/api/v2/autoclick/*）按 user_id 严格隔离：
  - 身份：前端会话（NextAuth）→ BFF 注入内部 JWT → 后端解析 user_id；
  - 服务端所有查询/写入均以 `WHERE user_id = :uid` 约束；禁止无 user_id 过滤的全表扫描；
  - 涉及资源：accounts/offers/bindings/rotations/executions/analytics/finance 等；
  - 越权访问：访问他人资源返回 404/403（建议 404 避免信息泄露）。
- 管理端（/api/v2/admin/adscenter/*）仅管理员可用：
  - 允许按 userId 查询任意用户资源；所有访问与变更均记录审计；
  - 支持导出与只读快照；写操作（回滚/强制轮换）需二次确认与审计原因。

### 输入校验与标准化
- URL 列表（BatchOpen）：
  - 去重/裁剪，长度与数量上限（URL ≤ 2KB；一次最多 N 条，N 按 OPS 配置）；
  - 协议限定 http/https；过滤内网/环回/文件协议；
  - cycles（循环次数）1–1000，超限按策略拒绝或回退默认。
- Referer：
  - social：从 OPS 列表取 URL（必须 http/https）；
  - custom：必须 http/https，长度 ≤255，可选白/黑名单域名策略；
  - Basic 版本不强制设置 Referer（浏览器端不可控）。
- Offer URL（AdsCenter）：
  - 标准化去 fragment；
  - 解析失败分类明确；缓存与重试退避；
  - Final URL/Suffix 拆解并做一次性追踪参数过滤（白/黑名单由 OPS 配置）。
- 幂等与去重：
  - Silent start 支持 `Idempotency-Key`；
  - AdsCenter 轮换按 final_hash+window 去重；
  - AutoClick schedule 名称/参数可选唯一键，避免重复创建。

---

## 服务端执行与队列（统一 PoolManager）
- 长期池：HTTPPool/BrowserPool（AutoClick 使用），AdsCenter 以 API 访问为主可公用 HTTPPool 或独立 API 池。
- 配置热更新（OPS → DB → Redis Pub/Sub → Worker）：
  - `automation.http_concurrency`
  - `automation.browser_concurrency`
  - `automation.rpm_per_user`
  - `automation.max_step_per_tick`
  - `automation.autoclick.variance_hour`, `automation.autoclick.weight_profile_default`
  - `automation.proxy.<country>`, `automation.referer.default`
- SSE：首包快照 + 心跳；断线降级轮询；周期性全量快照补偿（15–30 秒）。

### AdsCenter 链接轮换（换链接）
- 触发：
  - 定时：按用户配置的频率（hourly/daily/weekly）与时间点（at: HH:mm，按账户时区）触发；
  - 手动：`POST /offers/:id/rotate`（资源拥有者或管理员）。
- 流程：
  1) 取绑定的 Offer URL → 调用 Offer 解析（resolve）得到 `{ finalUrl, finalUrlSuffix }`；
  2) 唯一性检查（解析优先）：对绑定目标集合的历史轮换记录（binding 维度）在 `uniqueWindowDays`（默认 90 天）窗口内进行哈希对比 `finalUrl + '?' + finalUrlSuffix`；若重复，则尝试再次解析（可重试 3 次）；仍重复则跳过本次并记录；
  3) 通过模板（Final URL/Suffix 更新）执行变更，成功扣费、失败退款、记录 `adscenter_changes`；
  4) 更新轮换高水位：`last_rotation_at` 与 `next_rotation_at`。
- 失败与退避：解析失败或唯一性冲突 → 重试（退避）或跳过并记录；熔断阈值触发暂停并告警（OPS）。

---

## AdsCenter 数据采集与可视化（新增）
- 账号与凭据：`ads_accounts`, `ads_oauth_credentials`
- 聚合表（MySQL）：`ads_metrics_daily(user_id, account_id, date, campaign_id, ad_group_id, device, network, clicks, impressions, cost_micros, conversions, conv_value_micros, vtc)`
- 采集策略：
  - 回填窗口（近 30/90 天）+ 小时增量；高水位断点续跑；每账号 RPM；失败率熔断与退避重试。
  - Token 规则：`token.adscenter.collect.costPerAccountDay`（或免费，按需配置）。
- 可视化 API：`/analytics/*` 返回 KPI、时序、TopN（Campaign/AdGroup），前端只做选择与展示。
- 模板驱动更新（Final URL Suffix）：模板版本化与回滚，执行按 diff 扣费，失败即时退款，幂等键去重。

### Offer-Account 绑定与唯一性
- 模型（建议）：
  - `ads_offers`：{ id, user_id, offer_url, status, created_at, updated_at }
  - `ads_offer_bindings`：{ id, offer_id, account_id, rotation_frequency('hourly'|'daily'|'weekly'), rotation_at('HH:mm' 可空), unique_window_days(int, 默认90), active(bool), last_rotation_at, next_rotation_at, created_at, updated_at }
  - `ads_offer_rotations`：{ id, binding_id, account_id, ad_group_id, rotated_at, final_url, final_url_suffix, final_hash, status, message }
- 唯一性保障：
  - 计算 `final_hash = sha256(lowercase(normalized(final_url + '?' + final_url_suffix)))`；
  - 在 `unique_window_days` 窗口内，以绑定维度（binding_id）下的目标集合历史记录检索 `final_hash`，若存在则视为重复，尝试二次解析（最多 3 次）或跳过；
  - 窗口默认 90 天，可由绑定配置覆盖；可选 Bloom 过滤器/Redis 辅助加速。

### Offer URL 解析（浏览器跟踪）
- 单阶段解析：直接调用浏览器执行器（Puppeteer/Chromium）访问 Offer URL，跟踪多重重定向至最终 `page.url()`。
- 标准化与拆解：去除 fragment；Final URL = origin + pathname；Final URL Suffix = search（去除前导 ?，按白/黑名单过滤一次性追踪参数，如 gclid/fbclid）。
- API：`POST /api/v2/adscenter/offers/resolve { offerUrl, accountId? } -> { ok, finalUrl?, finalUrlSuffix?, classification?, hops?, screenshotBase64? }`。
- 策略：每用户/全局 RPM；失败分类熔断（captcha/timeout/blocked 等）；结果缓存（Redis/MySQL，默认 TTL 24h）；审计与指标（成功率/耗时/分类 TopN）。

---

## OPS（后台管理）
- 模板中心：
  - AutoClick：权重曲线/方差/预设集合。
  - AdsCenter：Final URL Suffix 模板（追加/覆盖/正则/宏/白名单），版本化/回滚。
- 策略与资源：代理池、Referer 模板、执行器配置与健康、并发与限流（每用户/每账号/全局）。
- 队列可视化：已具备 HTTP/Browser 队列卡片与迷你趋势；按 feature 粒度扩展指标（吞吐/平均等待/预警阈值）。
- 审计：模板与系统配置变更、任务执行分类、退款一致性报表。

### 财务与币种（Finance Settings）
- 余额采集：按账户时区在每日固定窗口采集余额快照（可与报表采集共享窗口与速率限制）。
- 币种与折算：以账户 currency 展示；多账户汇总按 OPS 配置的汇率表或实时汇率折算为组织默认币种；
- 报警：余额低于阈值或连续下降异常触发告警（阈值与观察窗口由 OPS 配置）。

### 默认配置键（automation.* 建议集）
- automation.http_concurrency / automation.browser_concurrency
- automation.rpm_per_user / automation.max_step_per_tick
- automation.autoclick.variance_hour / automation.autoclick.weight_profile_default
- automation.proxy.US（可按国家扩展） / automation.referer.default
- adscenter.collect.costPerAccountDay（如需计费）

### 绑定与轮换策略（AdsCenter）
- 绑定管理：
  - 录入 Offer URL 并关联账户（多选）；
  - 配置轮换频率（hourly/daily/weekly）、时间点（HH:mm，可选）、唯一性窗口（天）、作用域（per ad_group/per account）；
  - 启停与手动触发。
- 策略开关：
  - 唯一性作用域与窗口全局默认；
  - 失败率熔断阈值（解析/更新分别可配）；
  - 变更前干跑预估（可选）。

### Google Ads 凭据与账户（管理与授权）
- 管理目标：集中配置并更新 Google Ads 开发者与账户信息，保证最小权限、可审计与可轮换。
- 可配置项：
  - Developer Token（开发者令牌）
  - OAuth 客户端（client_id / client_secret / redirect_uri）
  - MCC（Manager）Account：manager_customer_id，作为默认上层账户（可验证可用性）
  - 组织级默认时区/货币（可选，仅用于展示与报表折算）
- 授权/绑定流程：
  - 生成授权链接（基于配置的 OAuth Client 与 redirect_uri）→ 用户完成授权 → 回调保存 refresh_token（加密存储）
  - 选择是否挂载到某个 MCC（linking / invitations，依业务需要）
  - 账户健康检查：配额、权限范围、API 速率与失败率
- 运维操作：
  - 吊销/轮换 refresh_token；更新 Developer Token；切换 MCC；
  - 最小权限策略：仅启用报表/更新所需 scope；按需细化沙盒/生产开关
- 审计与告警：任何凭据变更/授权/吊销均落审计；凭据将过期/失败率异常触发告警

（建议 Admin API）
- `GET   /api/v2/admin/adscenter/google-ads/credentials`（只读查看）
- `POST  /api/v2/admin/adscenter/google-ads/credentials`（创建/更新 Developer Token、OAuth Client、MCC）
- `POST  /api/v2/admin/adscenter/google-ads/oauth/link`（生成授权链接）
- `POST  /api/v2/admin/adscenter/google-ads/oauth/callback`（回调入库；可由前端 Next 路由代理）
- `POST  /api/v2/admin/adscenter/google-ads/credentials/rotate`（轮换/吊销 refresh_token）

### Referer 与社媒列表（BatchOpen/AutoClick 专用）
- OPS 维护社媒 Referer 列表（id/name/url/是否启用/排序）与国家/模板默认 Referer；可配置 `allowUserRefererOverride`。
- 后端收到用户 referer 时（social 或 custom）做合法化与注入；若模板禁止覆盖则忽略用户值并记审计。

---

## 上线策略（无过渡期）
- AutoClick/AdsCenter 直接采用 /api/v2 新合同；不提供 v1 兼容或过渡层，BFF 与前端全面切换到 v2。
- 数据：
  - AutoClick：保留现有表以读取历史；新任务可逐步切换至统一 Task 表（可选）。
  - AdsCenter：新建聚合与模板/变更记录表。
 - 配置：推荐直接使用 `automation.*` 键；如代码仍引用旧键（如 `AutoClick_HTTP_Concurrency`），可在内部 Facade 做映射以降低改造成本（对外无兼容承诺）。

---

## 验收标准
- 前端极简：
  - AutoClick：2 步创建（输入→选择预设），执行详情统一进度。
  - AdsCenter：概览 KPI/时序/TopN 正常，更新流程（干跑→执行）顺畅。
- 后台托管：并发/RPM/代理/执行器/模板/回滚/失败熔断均可在 OPS 管理与热更新。
- 可靠与可观测：队列面板稳定；SSE 首包 < 1s（可达环境）；降级轮询正常；计费与退款一致。
- BatchOpen/AutoClick Referer：用户可选社媒或自定义，后端注入并生效；未选择时采用模板/国家默认 Referer；禁覆盖时有审计。
- AdsCenter Offer 解析：多数联盟链接可解析到稳定 finalUrl；suffix 拆解正确；一次性追踪参数按策略过滤。
- AdsCenter 绑定与轮换：Offer 与账户绑定可配置频率与时间点；按唯一性窗口与作用域保证每次换链接不重复；冲突与失败可观测并可退避/熔断。
- 用户级隔离：用户仅能查询/修改自己的账户与配置；跨用户访问返回 404/403；管理台可按 userId 查看全量并有审计记录。

### 验收用例（建议）
- AutoClick：创建→启用→进度→禁用→SSE 断线降级→计费/退款一致；Referer（social/custom）头生效；越权 schedule 拒绝。
- Silent：幂等启动→进度查询→终止→计费/退款一致；越权 task 拒绝。
- AdsCenter 解析：复杂联盟链接解析成功率>阈值；缓存命中；分类准确；一次性参数过滤正确。
- AdsCenter 绑定与轮换：按频率触发；轮换前解析→唯一性校验通过；重复则重试→最终保障不重复；手动触发权限有效。
- 采集与可视化：日聚合与余额采集成功；KPI/时序/TopN/余额展示正确；多账户币种折算正确；低余额告警触发。
- RBAC：用户仅见本人数据；管理员可按 userId 查询/导出；敏感操作审计存在。
 - BatchOpen 三版本隔离：Basic/Silent/AutoClick 的所有用户态端点或计费行为严格以 user_id 约束；越权访问拒绝并落审计。

---

## 里程碑（实施顺序）
- P0（2 周）
  - /api/v2 统一任务与事件流（SSE/快照）；前端统一进度组件与 Hook。
  - AutoClick v2 前端极简表单与 /v2 接口适配；OPS 预设读取。
  - AdsCenter v2 模板干跑/执行 3 接口与前端“快速更新”卡片。
- P1（2 周）
  - AdsCenter 数据采集：聚合表 + 调度器 + /analytics 接口；概览/时序/TopN 三组件。
  - OPS：模板中心（版本化/回滚）、并发与 RPM、失败熔断；队列面板加入吞吐/等待与预警。
- P1.1（并行可做）
  - Offer URL 解析：/api/v2/adscenter/offers/resolve 浏览器解析 + 拆解 + 缓存 + 熔断 + 指标；前端“快速更新”卡片加入“解析”按钮与结果回填。
- P2（2 周）
  - 压测与观测：成功率/RT/退款一致性/首包延迟基线；E2E/回归；用户文档更新（仅 v2）。
  - 轮换：绑定/轮换 API 与调度器落地，唯一性校验与历史记录；OPS 绑定与策略管理界面。

---

## 最终方案与导航/访问策略（汇总）
- 导航与入口
  - 顶部“自动化广告”跳转至 AdsCenter（v2）主页（/adscenter），提供快速更新卡片（账号+模板→干跑→执行→统一进度）与报表入口。
  - AutoClick 作为 /batchopen 页面下的一个 Tab 标签，不单独在导航中暴露；列表项提供“查看进度”按钮直达统一进度页。
  - Admin（仅管理员）菜单放在后台管理系统左侧导航，包含“凭据总览/筛选”（/admin/adscenter/credentials）、“OAuth 管理”（/admin/adscenter/oauth）、“指标回填/导出”（/admin/adscenter/metrics）。
- 访问与权限
  - 网站所有页面未登录可浏览（不做模糊化）；点击功能按钮时强制登录，登录后校验套餐：
    - AdsCenter 功能需有 `limits.adscenter`；
    - AutoClick 功能需 `limits.batchopen.versions` 包含 `autoclick`（或 `automated`）。
    - 无权限跳转“价格”（/pricing）。
  - 后台管理系统仅管理员可登录访问；普通用户不得访问后台任一页面（直链进入将重定向至 /ops/console/login）。
- 统一任务与进度
  - 统一 ExecutionUpdate 格式；前端 `useLiveExecution` Hook（SSE 首包 + 断线降级轮询）。
  - 后端：GET `/api/v2/tasks/:id` 与 GET `/api/v2/stream/tasks/:id`；Silent/AutoClick/AdsCenter 执行均统一输出。
- 关键能力与实现
  - BatchOpen Silent v2：幂等启动（Idempotency-Key）、代理校验、统一进度；降级轮询；按钮守卫接入。
  - AutoClick v2：Schedules CRUD/启停，默认 Referer 注入（automation.referer.default）；在 /batchopen 的 AutoClick Tab 内提供“查看进度”按钮，调用 `/api/v2/autoclick/schedules/:id/execution/current` 取执行 ID 后跳 `/adscenter/executions/v2/{id}`。
  - AdsCenter v2：模板（干跑/执行/失败重试/回滚）、Offer 解析（浏览器执行器优先 + 缓存 + 熔断）、绑定/轮换（唯一性 + 调度器）、分析（聚合优先，回退轮换/执行统计）。
  - 采集：`ads_metrics_daily` 日聚合表；调度器每小时采集，高水位推进；对率限与暂态错误指数退避重试；Admin 可手动回填。
  - OPS：PoolManager 并发热更新（automation.*），/ops/pool/state 返回队列/并发+吞吐/平均等待；/ops/presets 返回 Referer 与 RPM 预设。
  - Admin：OAuth 链接/回调、凭据总览/筛选/导出、指标回填；Admin analytics（summary/timeseries/breakdown）。
- 非需求项（明确不做）
  - /batchopen 页面“统一进度汇总表”不纳入本期（按指示不需要）。

---

## 待办清单（可直接用于新会话接续）
- 统一事件与任务
  - [x] /api/v2/tasks/:id 与 /api/v2/stream/tasks/:id（SSE）
  - [x] 前端统一 Hook：useLiveExecution（SSE 首包 + 轮询降级）
  - [x] 统一进度组件替换 AutoClick/AdsCenter 详情页
- AutoClick v2
  - [x] /api/v2/autoclick/schedules CRUD/启停
  - [x] 表单极简（仅 URL/国家时段/日目标/预设 + Referer）
  - [x] OPS 预设读取与策略注入（代理/Referer/并发/RPM/权重）
- BatchOpen Silent v2
  - [x] /api/v2/batchopen/silent/start /silent/tasks/:id /silent/terminate
  - [x] /api/v2/batchopen/proxy/validate
  - [x] 表单极简 + Referer 控件；Idempotency-Key 支持
  - [x] 统一任务事件与快照输出（ExecutionUpdate）
- AdsCenter v2 — 模板更新
  - [x] /api/v2/adscenter/templates 列表
  - [x] /templates/:id/dry-run 与 /execute
  - [x] /executions/:id/retry-failures 与 /rollback
  - [x] 前端“快速更新”卡片（账号+模板+干跑+执行）
- AdsCenter 数据采集与可视化
  - [x] MySQL 表：ads_accounts（最小）/ ads_metrics_daily（聚合表）
  - [x] 调度器：回填 + 每小时增量 + 高水位断点（回填天数可配）
  - [x] /analytics/summary /timeseries /breakdown 三接口
  - [x] 概览 KPI/时序/TopN 三组件（前端）
- AdsCenter 绑定与轮换
  - [x] 表：ads_offers / ads_offer_bindings / ads_offer_rotations
  - [x] API：POST/GET/PATCH/DELETE /api/v2/adscenter/offers（绑定/查询/修改/解绑）
  - [x] API：POST /api/v2/adscenter/offers/:id/rotate（手动触发）与调度器自动轮换（已实现，5分钟周期扫描到期绑定）
  - [x] 唯一性校验：uniqueWindowDays 与历史哈希对比（重复最多重试3次，仍重复则跳过并记录）
  - [x] 前端：绑定与频率选择（极简下拉），详情中显示轮换历史
- 统一池与配置
  - [x] PoolManager 作为通用模块（AutoClick/AdsCenter 复用）
  - [x] Config Facade（automation.* 键合并）
- 观测与压测
  - [x] 队列面板：吞吐/平均等待/预警阈值
  - [ ] 成功率/延迟/退款一致性压测脚本与基线
- 新增（解析与 Referer）
  - [x] /api/v2/adscenter/offers/resolve（浏览器解析 + 缓存 + 分类 + 熔断）
  - [x] 前端 Offer URL 解析按钮与结果回填（Final URL/Suffix）
  - [x] AutoClick/Silent 表单统一 Referer 控件（社媒/自定义）与服务端注入
  - [x] Admin OAuth 链接与回调（/api/v2/admin/adscenter/google-ads/oauth/link|callback），支持刷新令牌写入 google_ads_configs
- 安全与隔离
  - [x] 用户态端点统一追加 user_id 过滤与用例校验（防跨用户访问）
  - [x] Admin 端点（/api/v2/admin/adscenter/*）仅管理员可用，支持按 userId 查询与导出，读写审计

---

## 变更记录
- 2025-09-16
  - 初稿：定义 /api/v2 合同、前端极简化、OPS 承载策略、AdsCenter 采集与可视化方案、统一任务与事件流、里程碑与待办。
  - 2025-09-16（收敛）：补充最终导航与访问策略（未登录可浏览，功能按钮登录+套餐校验；Admin 仅管理员），AutoClick 入口收敛至 /batchopen Tab，AdsCenter（v2）作为顶部“自动化广告”入口；明确不做 /batchopen 统一进度汇总表；其余 v2 能力（Silent 幂等、AutoClick schedules、AdsCenter 模板/解析/绑定/轮换/分析、采集调度、OPS 并发观测、Admin OAuth/凭据/回填/导出）已全部落地。
  - 2025-09-16（实现）：落地 /api/v2 统一任务与事件流、Silent v2、AutoClick schedules v2、AdsCenter 模板干跑与执行、执行重试与回滚、Offer 解析、绑定与轮换（唯一性）、基础 /analytics 三端点、BFF `/api/v2/*` 与前端 Hook（useLiveExecution）。
