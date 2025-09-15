# AutoAds 架构优化方案 05（KISS · UI+BFF/Go 执行 · 可验收）

本文汇总此前讨论并固化为可执行的架构优化方案，确保新开 Session 亦能继续推进同一任务流。方案严格遵循 docs/Pricinples.md 的“四条铁律”：好品味（消除特例）、Never break userspace、实用主义、KISS。

## 1. 目标与边界
- Next（前端）：只做 UI + 薄 BFF + 认证最小写（NextAuth 相关表）。
- Go（含 GoFly Admin）：负责全部业务写入与长任务执行（BatchOpen 三版本：basic/silent/autoclick、SiteRank、AdsCenter、订阅/令牌/审计/统计、邀请+签到、API 管理）。
- 数据：共享同一 MySQL + Redis；迁移职责划分清晰（Prisma 管认证域；Go 管业务域）。
- 部署：延续单容器双进程（Next:3000 + Go:8080），Next 通过 `/ops/[...path]` 反代 Go 管理台，API 通过 BFF 透传。
- 不破坏用户空间（Never break userspace）：对外 API 路径与响应合同保持不变；通过灰度开关切换实现。

## 2. 现状评估摘要（基于代码实查）
- 术语说明：本文中“AutoClick”指 BatchOpen 的第三个版本（autoclick），不是独立功能。
- BatchOpen
  - Silent 版在 Next 内实现（`/api/batchopen/silent-*`），使用全局内存任务态（`silent-batch-task-manager.ts`）+ 复杂执行器（并发/代理/Referer/可选 puppeteer）。
  - Basic 版多为前端开标签页；AutoClick 与“automated”命名并存，语义略有分裂。
  - 风险：重逻辑与长任务在 Next 执行；任务状态不具备多实例/重启容错；token 扣费在 Next，未来与 Go 冲突。
- SiteRank
  - `unified-similarweb-service` 在生产或旗标开启时会走 Go 后端；否则本地执行（API/抓取/Redis 缓存、错误 TTL）。
  - 风险：Next 与 Go 双轨实现；限流/扣费/缓存分散在两侧；多版本服务并存（optimized/enhanced/unified）。
- AdsCenter
  - Next API（accounts/configurations/executions）既写规范化表也维护 SystemConfig 回退；执行前以 TokenRuleEngine 估成本并 TokenService 预检。
  - 风险：业务写入与执行调度在 Next 内，与“Next 只 UI+BFF”的目标冲突；数据双轨（SystemConfig 回退）。

## 3. 架构重构（KISS 落地）
### 3.1 职责边界
- Next：
  - 页面渲染、NextAuth 登录、参数校验、轻度 IP 限流、`x-request-id` 注入、统一错误体、BFF 透传至 Go。
  - 认证最小写：`users(基础字段)/accounts/sessions/verification_tokens/user_devices`。
  - 业务域：只读或通过 Go API 操作，禁止写入。
- Go：
  - 业务单写主导（订阅/令牌/任务/统计/审计/活动等）与所有执行器/调度/限流/缓存（含 BatchOpen 的 basic/silent/autoclick 三版本）。
  - GoFly Admin 提供“用户/订阅/Token/系统配置/API 管理/邀请+签到”六大模块。

### 3.2 BatchOpen（三版本统一）
- 统一数据模型（Go）：
  - `BatchJob(id, userId, type: BASIC|SILENT|AUTOCLICK, status, options JSON, createdAt, updatedAt)`
  - `BatchJobItem(jobId, url, status, result, retries, lastError)`
  - 可选 `BatchJobProgress(jobId, total, success, fail, running, startedAt, finishedAt)`
- 执行语义：
  - BASIC：HTTP 直访（轻量）；SILENT：异步执行 + 进度；AUTOCLICK（BatchOpen 的第三版本）：浏览器执行（Playwright/Puppeteer 二选一，仅在 Go）。
  - 统一协程池 + 简单队列（Redis/内存），令牌扣费在“成功 item”或“入队”一致化（事务 + 行锁/版本号）。
- BFF 映射（Next 保持路由不变）：
  - `/api/batchopen/silent-start|silent-progress|silent-terminate|version|proxy-url-validate` → BFF 校验+轻限流 → `http://127.0.0.1:8080/api/v1/batchopen/*`。
  - Basic 仍可前端开标签页（不创建服务端任务）。
- 清理/重命名：统一 `automated` ⇆ `autoclick` 命名；下线 Next 内执行器与全局任务态。

### 3.3 SiteRank
- 生产环境强制走 Go（去旗标）；Next 仅做鉴权/校验/轻限流/错误体统一。
- 缓存与错误 TTL、配额与扣费统一在 Go；Next 的重复实现（optimized/enhanced）逐步移除。

### 3.4 AdsCenter
- 全量迁至 Go：accounts/configurations/executions 的读写、执行调度、token 计费、统计与审计。
- SystemConfig 回退仅保留只读迁移窗口，完成后删除回退路径。
- Next 端 API 全部变为 BFF 透传，禁止本地写业务表。

### 3.6 切换策略（是否需要显式环境变量）
- KISS 优先：生产与预发直接切换到 Go 执行，无需任何额外开关（推荐）。
- 若需低风险灰度（仅限预发/短期）：可选单一开关 `EXECUTION_PROVIDER=go|legacy` 或布尔 `USE_GO_EXECUTOR=true`，用于临时回退；必须在里程碑 P2 结束时删除（设定明确截止日期）。
- 说明：该开关不是必须项，只作为短期安全网；默认方案为“直接采用优化后实现”。

### 3.5 限流/错误/配置统一
- Next：仅轻度 IP 限流（滑窗 + 标准限流头），错误体与配置入口使用单实现。
- Go：统一业务限流/熔断与指标；缓存/错误 TTL 在 Go 一处实现。

## 4. BFF 透传规则
- 统一工具：`bffFetch(path, init)` 注入：`x-request-id`、内部鉴权头（`Authorization: Bearer <INTERNAL_JWT>`），透传限流头与统一错误体。
- 路由映射（示例）：
  - `GET /api/siterank/rank` → `GET /api/v1/siterank/rank`
  - `POST /api/batchopen/silent-start` → `POST /api/v1/batchopen/start?type=silent`
  - `GET /api/batchopen/silent-progress` → `GET /api/v1/batchopen/progress`
  - `POST /api/adscenter/executions` → `POST /api/v1/adscenter/executions`

## 5. 数据与迁移
- Prisma（Next）只管理认证域表迁移；Go 管理业务域表迁移（避免双工具改同一表）。
- Next 连接只读业务库或在代码层集中拦截写操作（白名单表可写）。

## 6. 中间件与安全
- 合并为单一 `apps/frontend/src/middleware.ts`：
  - 仅保留 `/api/auth/csrf` 的 CORS 兼容、（可选）Region 头；移除 Next 管理员保护（Admin 统一走 /ops）。
- 内部鉴权：单一 `INTERNAL_JWT_SECRET`（环境变量），BFF→Go 只使用一种内部鉴权头。

## 7. 部署与运行
- 继续使用 `Dockerfile.standalone` 与 `docker-entrypoint.sh`，Next/Go 同容器、同生命周期。
- 关键环境变量（极简）：`DATABASE_URL, REDIS_URL, AUTH_SECRET, INTERNAL_JWT_SECRET, NEXT_PUBLIC_DOMAIN, NEXT_PUBLIC_DEPLOYMENT_ENV`。

## 8. 功能测试清单（上线门槛）
- 认证/会话：Google 登录/登出；新用户首登；CSRF；www 域跳转 Cookie；异常路径（无邮箱/Inactive/CSRF）。
- 用户管理（/ops）：列表/筛选/详情；启用/禁用；角色变更；写审计。
- 订阅管理：创建/变更/取消/试用；`subscription_history` 记录；到期/续期逻辑；用户视图展示正确。
- Token 管理：增减、充值/奖励；`token_transactions` 前后余额与原因正确；并发扣费无重复。
- 系统配置：配置项 CRUD；分组/校验；`config_change_history` 审计记录完整。
- API 管理：Endpoint 注册/状态/限流；统计（近 24h 调用/429 Top）；规则变更实时生效。
- 用户活动：邀请码生成/绑定→奖励入账；签到次数与周期限制；流水/审计完整。
- BatchOpen：
  - Basic：前端开标签页；非法 URL 过滤；不产生服务端任务。
  - Silent：创建→入队→进度→终止→统计；令牌扣费流水一致。
  - AutoClick：浏览器执行（Go）；代理/UA/Referer 生效；错误重试/错误 TTL。
- SiteRank：单域/批量；强制刷新；缓存命中/错误 TTL；IP 限流头正确。
- 统一 BFF 行为：`x-request-id` 贯穿；统一错误体；限流头透传。
- 健康/观测：`/api/health` 与 Go 健康一致；pprof/基础 metrics 可用；结构化日志包含 request-id、耗时、状态、错误。
- 判定：全部通过；关键表（transactions/history/audit）与 UI/导出一致；失败率=0。

## 9. 压测基线与 SLO（上线门槛）
- 场景（1000 VU，15 分钟稳态，30–60 秒斜坡）：
  - 60% `GET /api/siterank/rank?domain=…`（缓存命中/未命中混合）
  - 20% `POST /api/batchopen/start(type=basic)` → 轮询进度
  - 10% `POST /api/batchopen/start(type=silent)` → 轮询进度
  - 5% `POST /api/batchopen/start(type=autoclick)` → 轮询进度（小规模）
  - 5% `GET /api/user/usage-report`
- SLO（需全部满足）：
  - 错误率：总非 2xx/3xx < 0.5%，5xx < 0.1%
  - 延迟：
    - BFF 读：P95 ≤ 300ms、P99 ≤ 800ms
    - 经 Go（缓存命中）：P95 ≤ 800ms、P99 ≤ 1500ms
    - 创建任务：P95 ≤ 800ms（入队即返）
    - 进度轮询：P95 ≤ 200ms
  - 资源：CPU < 80%，内存 < 75%；DB P95 < 50ms、Redis P99 < 5ms；队列长度 < workerCount×5，worker 利用 < 85%
  - 业务正确性：抽样任务“成功/失败/扣费流水”0 偏差

## 10. 观测与健康
- 统一日志：结构化、贯穿 `x-request-id`；Next 透传至 Go 并回写响应头。
- 健康检查：Next `/api/health` 透传 Go 健康；部署探针使用同一路径。
- 指标：QPS、P95/99、队列长度、busy workers、DB/Redis 延迟；慢查询采样。

## 11. 风险与回滚
- 风险：Next 侧业务写残留；迁移窗口双实现拖期；内部鉴权多把“钥匙”。
- 缓解：Next 使用只读业务库或统一写拦截；按 Gate 管理灰度窗口并设硬下线日期；内部鉴权只保留单一 `INTERNAL_JWT_SECRET`。
- 回滚：保留 `FEATURE_USE_GO_EXECUTOR` 单一开关（预发演练、生产短期保留），一键切回旧实现（不改外部合同）。

## 12. 里程碑与 Gate（可执行）
- P0（1–2 天，预发）
  - 合并 `middleware.ts`；禁用 Node 侧执行器路径（返回提示或转发 Go）；/admin 跳转 /ops。
  - 为 batchopen/siterank/adscenter 写 BFF 转发（鉴权/校验/轻限流→Go）。
  - Next 的 Prisma 对业务域只读化（只读 DB 用户或代码集中拦截）。
  - Gate 0：预发冒烟通过（登录/创建任务/轮询/令牌流水可见）；无 API 破坏。
- P1（1 周，预发→生产灰度）
  - Go：补齐/迁移 BatchOpen 三版本统一执行器；令牌扣费/限额/限流；进度/统计/审计。
  - GoFly Admin：六模块“列表-详情-单操作”闭环。
  - 清理 Next 重复实现（执行器/全局任务态/puppeteer、SiteRank 冗余版本、AdsCenter 业务写）。
  - Gate 1：功能测试清单 100% 通过，灰度放量。
- P2（1–2 周，生产）
  - 压测达标；补充观测与慢查询采样；清理回退开关与冗余代码。
  - Gate 2：SLO 达标、容量余量 > 20%。

## 13. 待办清单（供新 Session 继续）
- Next（必做）
  - [ ] 新建/合并 `apps/frontend/src/middleware.ts`，移除 `middleware.edge.ts / middleware-csrf.ts / middleware.admin.ts` 重复逻辑
  - [ ] 为以下路由增加 BFF 转发器（鉴权/校验/轻限流/错误体/请求 ID）：
    - [ ] `/api/batchopen/silent-start|silent-progress|silent-terminate|version|proxy-url-validate`
    - [ ] `/api/siterank/rank|batch|batch-minimal`
    - [ ] `/api/adscenter/accounts|configurations|executions`
  - [ ] 在 Next 层删除/封存：`lib/silent-batch-task-manager.ts`、`lib/services/task-execution-service.ts`、`lib/puppeteer-visitor.ts`、SiteRank 的冗余版本实现
  - [ ] `apps/frontend/src/lib/auth/v5-config.ts` 与任意 Token/订阅写路径：改为调用 Go 的后登录/发放 API（Next 仅认证最小写）
  - [ ] `/admin` 统一跳转 `/ops/console/panel`
  - [ ] 统一错误体与配置入口（移除重复实现），Next 对业务库只读
- Go（必做）
  - [ ] 落库：BatchOpen 统一模型三表（Job/Item/Progress）与索引
  - [ ] 实现 API：`/api/v1/batchopen/start|progress|terminate`（包含 type=basic|silent|autoclick）
  - [ ] SiteRank：`/api/v1/siterank/rank|batch`，统一缓存/错误 TTL/扣费/限流
  - [ ] AdsCenter：`/api/v1/adscenter/accounts|configurations|executions`，执行调度 + 令牌计费；SystemConfig 回退只读迁移
  - [ ] GoFly Admin：六模块（用户/订阅/Token/系统配置/API 管理/邀请+签到）页面与操作闭环
  - [ ] 观测：pprof、基础 metrics、结构化日志（含 request-id）
- 测试与压测（上线门槛）
  - [ ] 按“功能测试清单”全量通过
  - [ ] 按“压测基线与 SLO”执行并达标
- 文档与运维
  - [ ] 更新 `.env.preview.template` / `.env.production.template`（仅变量名）
  - [ ] 更新 `README-deployment.md` 与 `docs/production-env-config.md`（BFF/健康/限流头）
  - [ ] 标注“表所有者矩阵”（Prisma 仅认证域；Go 业务域）

---

如需按模块推进，建议从 P0 的中间件合并与 BFF 转发骨架开始，随后并行 Go 端 BatchOpen/SiteRank/AdsCenter 的 API 与执行器实现，最后以功能清单与压测门槛作为统一验收。

## 14. 统一错误与限流头规范（合同化）
- 错误响应结构（BFF 与 Go 统一）：
  - HTTP 状态码与 JSON：
    - 400 校验错误：`{"error": {"code": "VALIDATION_ERROR", "message": "...", "details"?, "requestId"}}`
    - 401 未认证：`AUTHENTICATION_ERROR`
    - 403 未授权：`AUTHORIZATION_ERROR`
    - 404 资源不存在：`NOT_FOUND`
    - 409 并发/冲突：`CONFLICT`
    - 422 业务规则：`BUSINESS_RULE_VIOLATION`（如余额不足可用 402 或 422，推荐 402：`PAYMENT_REQUIRED`）
    - 429 限流：`RATE_LIMIT_EXCEEDED`（必须带限流头）
    - 5xx 上游/内部错误：`EXTERNAL_SERVICE_ERROR` / `INTERNAL_ERROR`
  - 公共字段：`code, message, details?, requestId`
  - 示例：
    ```json
    {
      "error": {
        "code": "RATE_LIMIT_EXCEEDED",
        "message": "Too many requests. Please try again later.",
        "details": {"limit": 30, "window": 60},
        "requestId": "abc123"
      }
    }
    ```
- 限流头（选定并统一为 X-RateLimit-*，保持与现有实现兼容）：
  - `X-RateLimit-Limit: <max>`
  - `X-RateLimit-Remaining: <remaining>`
  - `X-RateLimit-Reset: <unix-seconds-or-ms>`
  - 出现 429 时建议附带 `Retry-After: <seconds>`（BFF 与 Go 同步）。

## 15. API 映射总表（旧 → BFF → Go）
- SiteRank
  - `GET /api/siterank/rank?domain=...`
    - BFF → `GET /api/v1/siterank/rank?domain=...`
  - `POST /api/siterank/batch`
    - BFF → `POST /api/v1/siterank/batch`
  - `POST /api/siterank/batch-minimal`
    - BFF → `POST /api/v1/siterank/batch`（同一后端端点，语义由入参控制）
- BatchOpen（保持旧路径合同）
  - `POST /api/batchopen/silent-start`
    - BFF → `POST /api/v1/batchopen/start?type=silent`
  - `GET /api/batchopen/silent-progress?taskId=...`
    - BFF → `GET /api/v1/batchopen/progress?taskId=...`
  - `POST /api/batchopen/silent-terminate`
    - BFF → `POST /api/v1/batchopen/terminate`
  - `GET /api/batchopen/version?feature=batchopen`
    - BFF → `GET /api/v1/batchopen/version?feature=batchopen`
  - `POST /api/batchopen/proxy-url-validate`
    - BFF → `POST /api/v1/batchopen/proxy-url-validate`
  - Basic 版：前端开标签页（不创建后端任务）；AutoClick：`POST /api/v1/batchopen/start?type=autoclick`
- AdsCenter
  - `GET/POST /api/adscenter/accounts`
    - BFF → `GET/POST /api/v1/adscenter/accounts`
  - `GET/POST /api/adscenter/configurations`
    - BFF → `GET/POST /api/v1/adscenter/configurations`
  - `GET/POST /api/adscenter/executions`
    - BFF → `GET/POST /api/v1/adscenter/executions`

> 说明：以上为核心映射，其他旧路由按此模式增补到同一表。BFF 统一做：鉴权（NextAuth）、入参校验、轻度 IP 限流、`x-request-id` 注入、错误体统一与限流头透传。

## 16. 表所有者矩阵（单写边界与迁移责任）
- Next（认证域：可写，可迁移/Prisma）
  - `users`（仅基础字段：id/email/name/avatar/emailVerified/role/status/lastLoginAt 等，与认证直接相关）
  - `accounts`, `sessions`, `verification_tokens`, `user_devices`
- Go（业务域：写入权与迁移权归 Go；Next 只读）
  - 订阅/令牌：`subscriptions`, `subscription_history`, `plans`, `plan_features`, `payments`, `token_transactions`, `token_purchases`, `token_usage`
  - 审计/日志：`audit_logs`, `api_access_logs`, `api_performance_logs`, `user_activities`, `notification_logs`
  - 配置：`system_configs`, `service_configs`, `environment_variables`（业务配置由 Go 管理）
  - 任务域：BatchOpen（`batch_jobs`, `batch_job_items`, `batch_job_progress`）、AutoClick（相应任务/计划/执行表）、SiteRank（缓存/抓取结果表，若持久化）
  - AdsCenter：`ads_accounts`, `ads_configurations`, `ads_executions`（或对应规范化表名）
- 迁移工具边界
  - Prisma：仅认证域表的 schema 迁移
  - Go：其余业务域表迁移与演进
- 访问控制建议
  - Next 使用“只读业务账号”连接业务库，或在 `lib/prisma` 层白名单可写模型、默认禁止写。
  - CI 检查：若 PR 修改了“非认证域”的 Prisma schema 或写路径，自动阻止并提示所有权矩阵。
