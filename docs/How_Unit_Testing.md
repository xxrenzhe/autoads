# How Unit Testing (Production-like)

本文档从工程全局出发，先给出项目结构和部署/架构要点，再按功能域逐一梳理“完整请求流程（端到端链路）”，并在每节末列出“执行真实生产级单测所需的参数与配置”。

— 内容基于本仓库代码与 MustKnow/ Pricinples 文档，以及 Next.js 与 Go 后端的实际实现（apps/frontend 与 gofly_admin_v3）。

## 项目全景与关键路径

- 前端应用：`apps/frontend`（Next.js 13+/App Router）
  - 用户登录：NextAuth v5（Google OAuth，仅普通用户，参考 src/lib/auth/v5-config.ts）
  - 路由反代：
    - `GET|POST /go/:path*` → 代理至容器内 Go 后端（默认 http://127.0.0.1:8080），文件：`src/app/go/[...path]/route.ts`
    - `GET|POST /ops/:path*` → 管理后台专用代理，仅允许 `/console/*` 与 `/api/v1/console/*`，文件：`src/app/ops/[...path]/route.ts`
  - BFF 薄层：`src/app/api/*` 下若干“兼容/聚合”端点，统一转发至 `/go/api/v1/*` 后端（例如 batchopen、adscenter）。
  - 数据层：Prisma（本地用户与订阅影子表；生产态的只读信息从 Go 侧合并），详见 `src/lib/auth/v5-config.ts` 的 session 合并逻辑。
- 后端应用：`gofly_admin_v3`（Gin + GoFly 组件）
  - 路由总览：`utils/router/router.go`，自动/手动路由混合注册。
  - 用户态模块：
    - SiteRank：`internal/app/register_siterank.go`，SimilarWeb 接入与“原子扣费+批量执行”
    - BatchOpen（BatchGo）：`internal/app/register_batchopen.go`，含 silent/basic/autoclick 统一入口
    - AdsCenter：`internal/adscenter/*`，含 Google Ads/AdsPower 相关
    - Token/Subscription/Invitation/Checkin：`internal/user/*`、`internal/subscription/*`、`internal/invitation/*`、`internal/checkin/*`
    - 内部鉴权：`internal/middleware/internal_jwt.go`（由前端 /go 反代注入 RSA 内部JWT，Go 端验签设置 `user_id`）
  - 管理后台：
    - 管理 API：`/api/v1/console/*`（登录在 `/api/v1/console/login`）
    - 管理前端（Vite 构建产物）：`/console/*`（Next 通过 `/ops/*` 仅做网关转发/兜底静态）

## 部署与环境（摘自 MustKnow + README-deployment）

- 单镜像/单容器：同一容器内同时跑 Next(3000) 与 Go(8080)，外部仅暴露 3000。
- CI/CD：
  - main → 预发镜像：`ghcr.io/xxrenzhe/autoads:preview-latest`
  - production 分支 → 生产镜像：`ghcr.io/xxrenzhe/autoads:prod-latest`
  - 打 tag（vX.Y.Z）→ `ghcr.io/xxrenzhe/autoads:prod-[tag]`
- 重要环境：
  - 前端（NextAuth）：`AUTH_SECRET`、`AUTH_URL`、`AUTH_GOOGLE_ID/SECRET`、`DATABASE_URL`
  - 反代：`BACKEND_URL`（建议 http://127.0.0.1:8080）
  - 内部JWT桥：Next 设置 `INTERNAL_JWT_PRIVATE_KEY`；Go 设置 `INTERNAL_JWT_PUBLIC_KEY`
  - Go：数据库/Redis/JWT/限流配置见 `gofly_admin_v3/config.yaml.template`
  - 域名：预发 urlchecker.dev（301 至 www.urlchecker.dev）、生产 autoads.dev（301 至 www.autoads.dev）（DNS 层处理）

------------------------------------------------------------

## 1) 普通用户 注册/登录（Google OAuth）

流程（前端 NextAuth v5）：
1. 浏览器访问 `GET /auth/signin`（或点击登录按钮）
2. 跳转 Google OAuth（clientId/clientSecret 配置自 `AUTH_GOOGLE_*`）
3. 回调进入 NextAuth，若用户首次登录：Prisma `user` 表创建记录（`v5-config.ts` 中自定义 adapter 的 createUser）
4. 生成 JWT session，写入 `next-auth.session-token` Cookie（策略：jwt，7天）
5. 前端页面获取 `session`，SSR/CSR 侧可见 `session.user` 与 `userId`
6. 合并后端只读状态（订阅/Token 余额）：
   - RouteHandler `/go` 注入内部JWT（携带 userId/role）→ Go 侧 `InternalJWTAuth` 中间件设置 `user_id`
   - Next 在 session 回调里，调用：`GET /go/api/v1/user/subscription/current`、`GET /go/api/v1/tokens/balance` 等合并只读数据

服务端关键文件：
- 前端：`apps/frontend/src/lib/auth/v5-config.ts`、`apps/frontend/src/app/go/[...path]/route.ts`
- 后端：`gofly_admin_v3/internal/middleware/internal_jwt.go`、`gofly_admin_v3/internal/subscription/expose.go`、`gofly_admin_v3/internal/user/token_controller.go`

生产级单测所需配置：
- Next（.env.local 或 CI 注入）
  - `AUTH_URL=https://www.autoads.dev`（或测试域）
  - `AUTH_SECRET=...`（≥32字节）
  - `AUTH_GOOGLE_ID=...`、`AUTH_GOOGLE_SECRET=...`（真实 Google OAuth 应用）
  - `DATABASE_URL=mysql://...`（Prisma 用户/订阅影子库）
  - `BACKEND_URL=http://127.0.0.1:8080`
  - `INTERNAL_JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...`
- Go（环境或 config.yaml）
  - `INTERNAL_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...`
  - 数据库/Redis：与 Next 一致或共享库
  - 端口：`PORT=8080`

建议校验用例：
- 登录后 `GET /api/auth/session` 包含 userId/role
- 通过 `/go` 访问只读端点，头部含 `X-Go-Backend: 1`、`x-request-id`、`Server-Timing: upstream;dur=...`

------------------------------------------------------------

## 2) SiteRank 功能（SimilarWeb + 原子扣费）

用户动作 → 端到端链路：
1. 前端页：`/siterank`（`SiteRankClient` + `useAnalysisEngine`）
2. 单域查询：前端调用 `GET /go/api/v1/siterank/rank?domain=xxx&source=similarweb`
3. 批量查询：
   - 预检：`POST /go/api/v1/siterank/batch:check` body: `{ domains: string[] }` → 返回 `sufficient/balance/required`
   - 执行：`POST /go/api/v1/siterank/batch:execute` body: `{ domains }` → 后端一次性扣费 + 并发抓取 + 结果映射
4. 后端会在响应头带消费信息：`X-Tokens-Consumed`、`X-Tokens-Balance`

后端实现要点：
- `gofly_admin_v3/internal/app/register_siterank.go`
  - `batch:check` 使用 `TokenService.CheckTokenSufficiency(userID, "siterank","query",数量)`
  - `batch:execute` 二次校验→扣费→批量查询（SimilarWeb client）→失败自动退款
- 内部鉴权：`InternalJWTAuth(false)` 解析 `user_id`（由 `/go` 注入）

生产级单测所需配置：
- 变量：
  - `BACKEND_URL=http://127.0.0.1:8080`
  - `INTERNAL_JWT_PRIVATE_KEY`（前端）/`INTERNAL_JWT_PUBLIC_KEY`（后端）
  - SimilarWeb 接入：`SIMILARWEB_API_URL`（必要时含密钥，或使用测试桩）
- 数据：
  - 用户初始 Token 余额（DB 预置或通过管理台充值）
  - 速率限制与套餐策略（可用默认/fallback，也可在 `rate_limit_configs` 表注入用例）
- 用例：
  - 正常批量（命中/未命中缓存的混合）
  - 余额不足 → 返回 402，前端弹窗提示
  - 429 限流（域/IP/套餐）

------------------------------------------------------------

## 3) BatchOpen 功能（basic / silent / autoclick）

版本与请求：
- basic（浏览器本地标签页）：
  - 纯前端打开，多窗口/标签页；不经服务端（仅页面内状态/统计）
  - 进度与终止通过 `window.postMessage` 与可选的浏览器扩展交互
- silent（后端执行器：HTTP 或 Puppeteer）
  - 预检余额（可选）：`POST /api/batchopen/silent:check`（BFF → /go/api/v1/batchopen/silent:check）
  - 启动任务：`POST /api/batchopen/silent-start`（BFF → `/go/api/v1/batchopen/start?type=silent`），Header 建议加 `Idempotency-Key`
  - 轮询进度：
    - 兼容端点：`GET /api/batchopen/silent-progress?taskId=xxx`（BFF → `/go/api/v1/batchopen/progress` 或 `/tasks/:id`）
    - 新端点：`GET /go/api/v1/batchopen/tasks/:id`、`GET /go/api/v1/batchopen/tasks/:id/live`(SSE)
  - 终止任务：`POST /api/batchopen/silent-terminate`（BFF → `/go/api/v1/batchopen/terminate`）
- autoclick（自动化点击/调度）
  - 配置/列表/启停：`/api/batchopen/autoclick/schedules*`（BFF → `/go/api/v1/batchopen/autoclick/schedules*`）

后端实现要点：
- `gofly_admin_v3/internal/app/register_batchopen.go`
  - 统一入口：`POST /api/v1/batchopen/start?type=silent|basic|autoclick`
  - 预检/扣费：`TokenService.CheckTokenSufficiency` 与 `ConsumeTokensByService("batchgo", action)`
  - 幂等：`Idempotency-Key` → MySQL/Redis 双层去重
  - 进度：`GET /api/v1/batchopen/tasks/:id`（统一聚合）

生产级单测所需配置：
- 变量：`BACKEND_URL`、内部JWT密钥对、DB/Redis、执行器相关超时/并发（见 register_batchopen.go SilentConfig 默认值，可在 DB 覆盖）
- 数据：
  - 用户 Token 余额、套餐限流（Plan → API与Feature RPM）
  - 如测 Puppeteer 路径：需容器内浏览器依赖（Dockerfile.standalone 已含）
- 用例：
  - basic：仅前端行为校验（进度条、终止反馈、弹窗拦截提示）
  - silent：余额不足/成功扣费/失败退款/幂等重复提交
  - autoclick：新建/启停/进度SSE

------------------------------------------------------------

## 4) AdsCenter 功能

用户动作 → 端到端链路：
1. 页面：`/adscenter` 与子页（accounts/configurations/reports…）
2. 所有 API 经 BFF：`/api/adscenter/:subpath` → `/go/api/v1/adscenter/:subpath`
3. 常见端点（以 gofly_admin_v3/internal/adscenter 为准）：
   - 账户管理：`POST/GET/PUT/DELETE /api/v1/adscenter/accounts`、`/accounts/:id`
   - 同步任务：`POST /accounts/:id/sync`、`GET /accounts/:id/sync-tasks`
   - 报表与统计：`GET /stats`、`GET /accounts/:id/performance`、`/keywords`、`/recommendations`
   - 链接批量替换：`POST /batch-replace-links`、`GET /replace-status/:task_id`
   - AdsPower 集成：见 `adspower.go`

后端实现要点：
- AdsCenterService 依据 `TokenService` 做扣费（如链接提取/批量替换）；部分端点依赖 Google Ads 凭据（开发者 token、OAuth 刷新 token）
- 鉴权：同用户态，通过 `/go` 注入的内部JWT → `user_id`

生产级单测所需配置：
- 变量：`GOOGLE_ADS_DEVELOPER_TOKEN`、`GOOGLE_CLIENT_ID/SECRET`、Google OAuth 回调（若涉及在线授权）
- 数据：
  - 预置一条 Ads 账户配置（customerId、refreshToken）或使用测试桩
  - Token 余额（根据实际消耗规则）
- 用例：
  - 账户 CRUD、连接/刷新 Token
  - 同步任务创建与进度查询
  - 报表查询（时间范围、维度）

------------------------------------------------------------

## 5) 个人中心（User Center）

呈现的数据来源：
- SSR 页面：`apps/frontend/src/app/user/center/page.tsx` 直接用 Prisma 读取本地 `user/subscription` 影子数据（含 feature 转换）
- 会话阶段：NextAuth session 回调里通过 `/go` 合并只读订阅与 Token 余额

典型请求（只读）：
- `GET /go/api/v1/user/subscription/current` → 当前订阅
- `GET /go/api/v1/tokens/balance`、`GET /go/api/v1/tokens/transactions`、`GET /go/api/v1/tokens/stats`
- 邀请/签到：`/api/invitation/*`、`/api/checkin/*`（RouteHandler BFF → Go 写接口，需内部JWT强制）

生产级单测所需配置：
- 变量：与登录一致（NextAuth、BACKEND_URL、内部JWT密钥对）
- 数据：
  - 至少一条 ACTIVE 订阅（`subscriptions` 与 `plans`）
  - Token 交易若干（分页/统计验证）
- 用例：
  - 页面 SSR 渲染字段完整性
  - 只读端点拉取一致（前/后端影子数据差异容忍）

------------------------------------------------------------

## 6) 管理员登录

路径与职责分离：
- 管理后台前端：`/ops/console/*`（Next 只做“静态兜底 + 反代网关”，不参与鉴权）
- 管理 API：`/ops/api/v1/console/*`（透传至 Go）
- 登录：`POST /ops/api/v1/console/login` → Go 端 `admin.AdminLoginHandler` 颁发管理员JWT（与 NextAuth 完全独立）

后端关键：`gofly_admin_v3/internal/app/routes.go`
- `v1.POST("/console/login", admin.AdminLoginHandler)`
- `adminGroup := v1.Group("/console")` + `admin.AdminJWT()` 保护其余管理端点

生产级单测所需配置：
- 管理员初始账号（DB 预置 admin_users 表）
- 管理端 JWT 密钥（Go 内部；与前台无关）
- Next 的 `/ops` 反代必须指向正确 `BACKEND_URL`

用例：
- 登录成功/失败次数限制（如有配置）
- 登录后访问 `GET /ops/api/v1/console/system/config` 等受保护端点

------------------------------------------------------------

## 7) 管理后台各模块

主要模块与端点（均为 `/ops/api/v1/console/*` 网关代理到 Go）：
- 系统配置：`GET/POST/DELETE /system/config`、`GET /system/config/history`
- 速率限制：`/rate-limit/*`（见 `internal/admin/ratelimit_controller.go`）
- API 管理（端点/Key、分析/性能）：`/api-management/*`
- 用户管理：`/users/*`（列表、更新、开关、Token 变更）
- 订阅与计划：`/plans`、`/subscriptions`、分配/取消/续费/改配
- Token 管理：`/tokens/balance|adjust|transactions`、规则管理 `/token/rules`
- 监控/告警：`/monitoring/*`

生产级单测所需配置：
- 管理员 JWT（登录拿到）
- DB 有可操作对象（用户/计划/订阅/交易）
- 建议通过 `/ops/console` 前端进行一轮 E2E 点击，随后以 API 做回归

------------------------------------------------------------

## 8) 通用单测基线与建议

- 环境准备（本地一机跑通）：
  - 端口：Next 3000、Go 8080；`BACKEND_URL=http://127.0.0.1:8080`
  - 内部JWT密钥对：Next 注入私钥、Go 注入公钥，确保 `/go` 与受保护写接口均可识别 `user_id`
  - DB/Redis：使用模板 `.env.production.template` 与 `config.yaml.template` 作为参考
  - 构建方式：`Dockerfile.standalone`（单镜像）或本地分别 `npm run dev` + `go run main.go`
- 观测与排障：
  - `/health`、`/ready`、`/live`、`/metrics`（Go）
  - `/go/*` 响应头：`x-request-id`、`Server-Timing: upstream;dur=...`
  - 管理前端兜底：`/ops/console/*` 在上游 5xx 时回退本地 dist 文件
- 数据隔离：
  - 前台用户（NextAuth/Prisma 用户表）与后台管理员（Go admin_users）完全分离
  - Token/订阅以 Go 为权威，Next 侧仅作影子/只读合并

------------------------------------------------------------

## 9) 最小化示例（环境变量清单，供 CI/本地测试）

前端（.env.local）：
```
AUTH_URL=http://localhost:3000
AUTH_SECRET=dev-secret-autoads-please-change
AUTH_GOOGLE_ID=your-google-oauth-client-id
AUTH_GOOGLE_SECRET=your-google-oauth-client-secret
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/autoads
BACKEND_URL=http://127.0.0.1:8080
INTERNAL_JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
```

后端（环境变量或 config.yaml）：
```
PORT=8080
INTERNAL_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
DB_USERNAME=autoads
DB_PASSWORD=... 
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=autoads
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

------------------------------------------------------------

## 10) 参考文件与代码位置

- 文档：
  - MustKnow：`docs/MustKnow.md`
  - 部署：`README-deployment.md`
  - PRD/架构：`docs/prd-new-V5.md`、`docs/architecture-gofly-v5.1.md`
- 前端：
  - Auth：`apps/frontend/src/lib/auth/v5-config.ts`
  - 反代：`apps/frontend/src/app/go/[...path]/route.ts`、`apps/frontend/src/app/ops/[...path]/route.ts`
  - BFF：`apps/frontend/src/app/api/batchopen/[...path]/route.ts`、`apps/frontend/src/app/api/adscenter/[...path]/route.ts`
  - SiteRank 页面：`apps/frontend/src/app/siterank/*`（含 `AnalysisEngine`）
  - BatchOpen 页面：`apps/frontend/src/components/BatchOpenSection.tsx`、`SilentBatchOpen.tsx`
  - AdsCenter 页面：`apps/frontend/src/app/adscenter/*`
- 后端：
  - 路由/中间件：`gofly_admin_v3/utils/router/router.go`、`internal/middleware/internal_jwt.go`
  - SiteRank：`internal/app/register_siterank.go`
  - BatchOpen：`internal/app/register_batchopen.go`
  - AdsCenter：`internal/adscenter/*`
  - Tokens/Subscription：`internal/user/*`、`internal/subscription/*`
  - Admin：`internal/app/routes.go`（/api/v1/console 与 /console）

以上即可作为“真实生产级”单测执行的清单与路线图。若需补充专项测试（安全/限流/幂等/回滚），可在对应模块按上述端点扩展用例。

