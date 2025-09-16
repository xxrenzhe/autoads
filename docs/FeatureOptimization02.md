# FeatureOptimization02 - AutoAds 功能优化方案（BatchOpen/登录/并发/持久化）

本文档汇总近期讨论达成的优化结论与实施方案，作为后续开发、测试与运营的统一规范。内容覆盖登录体系、BatchOpen 三版本的定位与实现（Basic/Silent/AutoClick）、AutoClick 的计划任务与 per-URL 执行切换策略、数据库与并发、SSE 实时进度、环境变量热更新及验收标准。按本文档推进，新的会话可直接接续任务落地。

## 目标与范围
- 明确并固化登录体系：用户端仅 Google OAuth；管理员登录走 Go 后台独立口。
- 下线 BatchOpen Advanced 版；保留并完善 Basic/Silent/AutoClick 三版本。
- Silent 与 AutoClick 均支持代理和自定义 Referer。
- AutoClick 聚焦“配置定时任务、启动任务、查看结果”的交互，支持 per-URL HTTP→Puppeteer 切换与问题 URL 归档。
- 全站统一 MySQL；多用户高并发下的稳定性、隔离性与持久化能力完善。
- 管理台支持 Proxy/方差等关键参数热更新；SSE 展示实时进度；完善审计与分类统计。

## 登录与权限体系
- 用户端登录：仅保留 Google OAuth（NextAuth v5），不提供邮箱注册/登录。
- 管理员登录：仅通过 Go 后台独立口（`/api/v1/admin/login`，Admin JWT）。前端以 `/ops/*` 反代访问管理台与后台 API，管理员认证不与 NextAuth 混用。
- 清理与文案：移除一切“邮箱注册/登录”入口/提示；`/auth/admin-signin` 如保留 UI，则直调 Go 的 `/admin/login` 并仅用于 `/ops/*` 请求头。

## BatchOpen 三版本
### 1) Basic（基本版）
- 定位：浏览器本地批量打开 URL，便于人工快速检视；不产生后端任务，无计费。
- 前端：URL 去重/校验、弹窗拦截提示、软限（单次最多 N 条）与 UX 引导；无后端交互。

### 2) Silent（静默版）
- 定位：后端执行 HTTP/最小化浏览器的“真实访问”，支持代理校验、Referer、自定义循环次数、实时进度与任务终止；计费与审计完整。
- 关键接口（BFF 转发至 Go）：
  - `POST /api/v1/batchopen/start?type=silent`
  - `GET /api/v1/batchopen/progress?taskId=...`
  - `POST /api/v1/batchopen/terminate`（{ taskId }）
  - `POST /api/v1/batchopen/proxy-url-validate`（{ proxyUrl }）
  - `GET /api/v1/batchopen/version?feature=batchopen`
- 参数支持：代理 URL、自定义 Referer（社媒列表或自定义）、并发、循环次数、超时/重试。
- 计费：每次任务按“URL×循环数”预消费；启动失败或执行失败项即时退款；`X-Tokens-*` 响应头返回消费/余额。

### 3) AutoClick（自动化版）
- 定位：以“计划任务”为中心；用户配置日目标、时段与参数，后端以调度器自动在目标时段执行分散的点击操作；实时/SSE 展示进度与当日/历史结果。
- 与 Silent 的差异：不强调即时一次性批处理，而强调“按小时分配、随机化时间点、全天分散执行”。支持 per-URL HTTP→Puppeteer 切换提升成功率。
- 下线 Advanced：不在前端展示，也不合并到 Silent。

## AutoClick：交互与参数
### 任务中心（表格）
- 列：任务名称、国家/时区、执行时间段、每日点击总数、状态（未启动/已启动/已终止）、今日进度、最近执行时间、操作（编辑/删除/启动/查看）。

### 新增/编辑（弹窗表单）
- 输入参数：
  - 任务名称（必填）
  - URL 列表（必填，去重与合法性校验）
  - 国家时区（单选下拉；默认“美国 US (UTC-8)”）
  - 执行时间段（单选下拉：`00:00-24:00` 或 `06:00-24:00`；默认 `00:00-24:00`；时间均以所选时区计算）
  - 每日点击总数（必填，正整数）
  - 自定义 Referer（单选：复用已存在社媒列表或自定义输入）
  - 代理（可选：默认随国家映射；也可指定代理 URL，创建时会校验）
  - 可选高级参数：并发/超时/重试、浏览器选项（headless、waitUntil 等）

### 查看详情
- 当日实时执行（SSE）：累计点击/成功/失败、小时进度、失败 URL TopN、切换次数等。
- 历史记录（最近 30 天）：天维度汇总列表。

## AutoClick：后端执行流程（三阶段）
### 阶段1：按日生成“每小时目标次数数组”
- 输入：每日点击总数 N、执行时间段（如 06–24）、方差系数 `AutoClick_Count_Variance_Hour`（默认 0.3）、权重曲线（可配置，高峰期 9–22 稍高）。
- 算法：
  - 有效小时数 H（如 18），平均值 A=N/H。
  - 目标值初稿：`round(A × (1+r) × w_h)`，其中 `r ~ U[-V, +V]`，`w_h` 为小时权重。
  - 总和校正：保证非负整数，且 sum= N；先随机分配，最后“差值回填/扣除”避免集中。
- 持久化：写入 `autoclick_daily_plans`，以（schedule_id + date + timezone）为键；每天任务执行前生成一次。

### 阶段2：URL 点击执行与 per-URL 切换
- 时间分散：每小时内将目标次数随机分布到 60 分钟（支持整点 ±10s 禁发），避免整点整分痕迹。
- 代理与 Referer：按国家默认代理（如 `Proxy_URL_US` 获取代理 IP）或 schedule 指定的代理；注入自定义 Referer（社媒/自定义）。
- 执行器选择（对每个 URL、对每次尝试）：
  - 查询 Redis：若标记 `prefer_browser:{user}:{urlHash}` 存在 → 直接用浏览器访问。
  - 否则先 HTTP；若 HTTP 连续失败 ≥3 或 窗口失败率 ≥50% → 切换为 Puppeteer/Chromium，并设置 `prefer_browser=1`（TTL 7d，可续期）。
  - 若浏览器也连续失败 ≥3：终止该 URL 当天访问，记录到 DB（`autoclick_url_failures`）与“当日失败清单”，便于管理台“问题 URL”展示。
- 计费：每处理 1 次预扣 1 个 Token，失败即时退款（与 Silent 一致）。
- 并发与限流：
  - 用户/全局并发上限（HTTP 与浏览器池分离）；用户多计划互不抢占（每计划独立 worker token）。
  - RateLimitManager：用户/全局 RPM 限制，触发时延迟或降级；可按功能维度限流（batchopen_autoclick）。
- 断点恢复：
  - 执行状态（`autoclick_executions`）与小时快照（`autoclick_execution_snapshots`）持久化；服务重启读取 running 状态恢复。
  - 任务启动幂等键：`schedule:{id}:{date}`，避免重复启动。

### 阶段3：结果同步与汇总
- 每小时写入快照：success/fail/total、失败 URL TopN、切换次数；通过 Redis Pub/Sub 推送 SSE（BFF 透传）。
- 当日达成总量 N → 生成天维度汇总记录，标记 execution.completed。
- 历史保留：近 30 天天维度记录可查。

## 数据库（MySQL）模型建议
- `autoclick_schedules`
  - id, user_id, name, urls_json, timezone, time_window, daily_target, referer_type, referer_value, proxy_url, http_options_json, browser_options_json, concurrency, status, last_run_at, next_run_at, created_at, updated_at
- `autoclick_daily_plans`
  - id, schedule_id, user_id, date (local), hour_distribution_json([24]int), variance, weight_profile, created_at
- `autoclick_executions`
  - id, schedule_id, user_id, date, status, message, progress, success_count, fail_count, total, started_at, completed_at, created_at, updated_at
- `autoclick_execution_snapshots`
  - id, execution_id, hour (0–23), success, fail, total, failed_urls_json, created_at
- `autoclick_url_failures`
  - id, user_id, url_hash, url, http_fail_consecutive, browser_fail_consecutive, last_fail_at, prefer_browser_until(可空), notes, created_at, updated_at

注：如已有通用 `batch_tasks` 表，可加字段 type='autoclick' 复用；但 per-URL 失败与当天分配等更适合独立表。

## API 契约（BFF 转发至 Go）
### 计划任务 CRUD
- `POST /api/v1/batchopen/autoclick/schedules`（新增）
- `GET /api/v1/batchopen/autoclick/schedules`（当前用户列表）
- `GET /api/v1/batchopen/autoclick/schedules/:id`（详情）
- `PUT /api/v1/batchopen/autoclick/schedules/:id`（编辑）
- `POST /api/v1/batchopen/autoclick/schedules/:id/enable`（启用）
- `POST /api/v1/batchopen/autoclick/schedules/:id/disable`（停用）
- `DELETE /api/v1/batchopen/autoclick/schedules/:id`（删除）

### 执行与进度
- `POST /api/v1/batchopen/start?type=autoclick&scheduleId=...`（可选：手动触发当日执行）
- `GET /api/v1/batchopen/progress?taskId=...`（Silent/AutoClick 一致）
- `GET /api/v1/batchopen/tasks/:id/live`（SSE）

### 结果查看
- `GET /api/v1/batchopen/autoclick/executions?scheduleId=...&date=...`（当日实时 or 历史）
- `GET /api/v1/batchopen/autoclick/summary?scheduleId=...&limit=30`（天维度汇总列表）

### 管理台（Console）
- `GET /api/v1/console/autoclick/problem-urls?userId?&date?`（问题 URL 列表/分类统计）
- `GET/POST /api/v1/console/config`（读写 `Proxy_URL_US`、`AutoClick_Count_Variance_Hour` 等，热更新广播）

## Redis Key 与切换规则
- `autoads:ac:fail:http:{user}:{urlHash}` 计数（TTL 24h）
- `autoads:ac:fail:browser:{user}:{urlHash}` 计数（TTL 24h）
- `autoads:ac:prefer_browser:{user}:{urlHash}` 标记（TTL 7d）

规则：HTTP 连续失败 ≥3 → prefer_browser=1（7d）；浏览器连续失败 ≥3 → 停止当天该 URL，归档为“问题 URL”；后续访问按 prefer 标记直接浏览器。

## 环境与配置（热更新）
- 新增环境变量：
  - `Proxy_URL_US`（默认值示例）
    - `https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt`
  - `AutoClick_Count_Variance_Hour`（默认 0.3）
- 管理台支持热更新：写入系统配置表，并通过 Redis Pub/Sub 广播，运行中的 worker 动态加载。
- 扩展：逐步支持多国家 `Proxy_URL_{COUNTRY}` 映射（US 先落地）。

## 并发与稳定性评估
- Next.js BFF：就绪检查（/ready）+ 超时 + 统一 x-request-id；Node 侧不做复杂业务写。
- Go 后端：RateLimitManager（用户/全局）；Silent/AutoClick 的 HTTP 与浏览器池分离；队列控制与幂等；失败率熔断/退避；代理池健康检查。
- 资源建议（2C4G 单实例）：
  - Silent：HTTP 并发 50–120（随超时/网络调优）
  - AutoClick：浏览器并发 3–6；HTTP 并发 30–60；每用户每计划默认 1 并发，互不影响
- 持久化与恢复：执行状态与小时快照持久化；服务重启按 running 状态恢复；计划任务每日幂等启动。
- SSE：基于 Redis Pub/Sub；网络不稳时降级轮询；事件丢失用“定期全量同步”补偿。

## 计费/限流/审计
- 计费：每项处理预扣 1 Token，失败即时退款；任务头返回 `X-Tokens-*`。
- 限流：按功能（siterank、batchopen_silent、batchopen_autoclick）设置用户/全局 RPM；管理台热配置。
- 审计：记录创建/启动/终止/执行项分类（如 http_timeout、403_blocked、captcha_detected、browser_required 等）。

## 接入与验收
### 验收标准
- 前端仅显示 Basic/Silent/AutoClick（Advanced 不可见）。
- Silent/AutoClick 均可设置代理和 Referer，并在服务端生效。
- AutoClick：
  - 能新增/编辑/删除/启停计划任务；参数校验完整。
  - 当日执行采用“小时目标数组”，时间分散、总量达成后生成当日汇总。
  - per-URL 切换：HTTP 连续失败后改用浏览器；浏览器仍连续失败则归档为问题 URL；后续访问优先浏览器。
  - SSE 实时进度渲染；历史近 30 天可查。
- 多租户隔离：不同用户、同用户多计划互不干扰。
- 持久化与断点恢复：服务重启不影响当日计划的继续执行；幂等防重入。
- 配置热更新：管理台更新 `Proxy_URL_US`、`AutoClick_Count_Variance_Hour` 可无重启生效。

### 里程碑（实施顺序）
1. 前端清理与信息架构：移除 Advanced；新增 AutoClick 任务中心（表格/表单/查看）；Silent 复用 Proxy/Referer 组件。
2. 后端 API：AutoClick 计划任务 CRUD/启停/查询、执行结果与 SSE；DB 迁移。
3. 执行引擎 V1：
   - 阶段1分配 + 阶段2 HTTP 执行 + 计费/退款 + 小时快照；
   - per-URL Redis 标记（prefer_browser）与切换；
   - 断点恢复与幂等键。
4. 执行引擎 V2：
   - 浏览器执行器接入与稳定化（Puppeteer/Chromium）；
   - 代理池集成、失败分类完善；
   - 管理台“问题 URL”面板。
5. 配置热更新：管理台→DB→Redis Pub/Sub→Worker 动态生效。
6. 压测与优化：并发/队列、SSE 稳定性、成功率与延迟；指标可视化与告警。

## 待办清单（便于新会话接续）
- 文档与环境：
  - [x] `.env.example` 统一为 MySQL DSN；README/docs 与 MustKnow 保持一致。
- 前端：
  - [x] 移除 Advanced 版入口与文案（保留兼容字段，不在前端展示）。
  - [x] 新增/完善 AutoClick 计划任务页面（表格/新增/编辑/删除/启停/查看）。
  - [x] 在 AutoClick 表单补齐代理/Referer 字段（与 Silent 形态一致）。
  - [x] 对接 SSE：`useAutoClickLiveProgress` → BFF 透传 `/api/v1/batchopen/tasks/:id/live`（同时兼容 `/api/autoclick/*`）。
  - [x] 管理台“问题 URL”面板增强（备注/批量操作/清除优先/诊断）。
  - [x] 历史统计视图（最近 N 天汇总，图表 + 表格）。
- 后端：
  - [x] DB 迁移：五张表（schedules/daily_plans/executions/execution_snapshots/url_failures）。
  - [x] 计划任务 CRUD/启停 API；权限校验按 user_id（`/api/v1/batchopen/autoclick/schedules`）。
  - [x] 执行引擎 V1（分配/HTTP 执行/计费/退款/快照/幂等/恢复）最小实现（每分钟 tick 推进、Token 扣费/失败退款、小时快照、断点可继续）。
  - [x] Redis Key 与 per-URL 切换实现；prefer_browser TTL=7d；连续失败归档“问题 URL”。
  - [x] SSE 推送：Redis Pub/Sub 发布执行事件；提供 `/api/v1/batchopen/tasks/:id/live`（轮询型）与 `/api/v1/batchopen/autoclick/executions/live`（直连 Redis）两种通道；BFF 已透传。
  - [x] 浏览器执行器接入（最小）：通过 `AutoClick_Browser_Executor_URL` 调用外部 Node 执行器，支持代理/Referer/超时/等待与错误分类；未配置时保持占位逻辑。
  - [x] 管理台配置热更新与“问题 URL”面板。
- 稳定性：
  - [x] 并发/节流热配置：`AutoClick_HTTP_Concurrency`、`AutoClick_Browser_Concurrency`、`AutoClick_MaxStepPerTick`、`AutoClick_User_RPM` 接入（Worker 热读）。
  - [ ] RateLimitManager 深度接入（plan-based UI 与策略全面接管）。
  - [ ] 压测与回归用例（成功率/延迟/退款准确性/边界条件）。

---

本文档为本轮功能优化的唯一事实来源（SSOT）。后续如有变更，请在本文件追加“变更记录”并同步相关实现。

## 完成情况与未完项评估

已完成（核心交付）
- 登录与权限：用户端仅 Google OAuth；管理端独立登录（Admin JWT，经 `/ops/*` 反代），与 NextAuth 解耦。
- BatchOpen 前端版本治理：Advanced 已隐藏；仅显示 Basic/Silent/AutoClick。
- AutoClick 前端：任务中心（表格/新增/编辑/删除/启停/查看）；表单包含 Referer/代理；SSE 实时进度已接通（BFF → `/api/v1/batchopen/tasks/:id/live`）。
- AutoClick 后端：
  - 五表迁移与 CRUD/启停 API；执行引擎 V1（按日分配→小时推进→计费/失败退款→小时快照→断点恢复）；per-URL 切换（Redis失败计数，prefer_browser=7d）；问题 URL 归档。
- SSE：提供轮询型 SSE 与直连 Redis 的订阅；新增 execution/schedule 粒度频道，降低广播开销。
- 管理台：
  - 系统配置热更新：`AutoClick_Count_Variance_Hour`、`Proxy_URL_{COUNTRY}`（含 US 起步）支持在线更新并热生效（DB→Redis Pub/Sub→缓存刷新→Worker 读取）。
  - 问题 URL 面板：查询/筛选/备注；单条与批量操作（优先浏览器、重置计数、清除优先、删除）；一键“诊断”（真实浏览器执行+截图）。
- 并发/节流：HTTP/浏览器并发、每 tick 最大推进、用户 RPM（可配置）；未配置 RPM 时按套餐（RateLimitManager）回退。
- 历史统计：Admin 侧最近 N 天（默认 30）汇总视图（图表 + 表格）。

未完成/部分完成项（建议后续迭代）
- 执行引擎 V2（部分完成）：
  - 已接入 Node/浏览器执行器（支持代理/Referer/超时/等待/截图/分类）。
  - 待完善：动作脚本（click/type/evaluate 等）、稳定性与资源管理、截图/指标持久化、代理池健康检查与更细审计分类。
- RateLimitManager 深度接入（计划）：
  - 在管理台提供计划级（FREE/PRO/MAX）策略配置 UI；由 plan limits 全面接管 AutoClick 的 RPM/并发策略。
- 并发池与隔离：
  - 将 per-tick 并发提升为长期 HTTP/Browser 池，并支持用户/计划维度并发隔离与队列可视化。
- 压测与回归（未完成）：
  - 成功率/延迟/退款一致性回归；SSE 稳定性与丢失补偿；不同并发表的资源消耗与基线指标。

影响评估与建议
- 当前交付已满足“可用”的计划任务与在线运维闭环；不影响主流程使用。
- 若业务需真实浏览器场景成功率，可优先推进 V2（Puppeteer）与代理池健康检查；同时补齐限流/并发热配置与压测基线。
