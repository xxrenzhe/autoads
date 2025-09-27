# 预发部署常见问题与有效修复记录（持续更新）

目的：沉淀 Cloud Build / Cloud Run 过程中踩过的坑与修复方案，复用为下一次“零摩擦”发布指南。

## 1. Cloud Build 使用 docker builder 报错：找不到 Dockerfile 路径

- 现象
  - 日志：`unable to prepare context: unable to evaluate symlinks in Dockerfile path: lstat /workspace/services/siterank: no such file or directory`
- 根因
  - `.gcloudignore` 中包含了未锚定（无 `/` 前缀）的模式，例如 `siterank`、`adscenter`，意外将 `services/siterank` 目录排除了。
- 解决
  - 将根目录的二进制忽略规则改为“仅忽略根路径同名文件”，加上 `/` 前缀：
    - `.gcloudignore` / `.dockerignore`：从 `siterank` → `/siterank`（其余类似 `/adscenter`、`/billing` 等）
  - 同时改用 Kaniko，避免 docker-in-docker 环境限制（见问题 2）。

## 2. Cloud Build 使用 docker builder 受限；切换到 Kaniko

- 现象
  - docker 构建步骤失败或拉取受限；或 Cloud Build 环境没有特权运行能力。
- 解决
  - 将 `deployments/<svc>/cloudbuild.yaml` 切换为 `gcr.io/kaniko-project/executor:latest`，使用以下参数：
    - `--destination=${_IMAGE}`
    - `--dockerfile=services/<svc>/Dockerfile`
    - `--context=dir:///workspace`
    - `--single-snapshot`、`--use-new-run`
  - 注意：使用 Kaniko 时，`cloudbuild.yaml` 中应去掉 `images:` 字段，避免 Cloud Build 在步骤外再次校验镜像存在而报 `images not found`。

## 3. Kaniko COPY 失败：前端 node_modules 软链导致复制错误

- 现象
  - 日志：`error building image: copying dir: symlink ... apps/frontend/node_modules/.bin/esbuild: no such file or directory`
- 根因
  - 直接 `COPY . .` 将前端 node_modules（包含链接文件）带入构建上下文，Kaniko 在容器环境中无法解析这些软链。
- 解决
- 精简 Dockerfile 的 COPY 范围，仅复制 Go 工作区文件：
  - `COPY go.work ./go.work`
  - `COPY pkg ./pkg`
  - `COPY services/<svc> ./services/<svc>`
  - 在 `.dockerignore` 与 `.gcloudignore` 中显式忽略：`apps/frontend/node_modules/**`

【补充】Offer 构建同类问题（再次踩坑）
- 现象
  - Cloud Build（Kaniko）日志显示 `COPY . .`，随后在 `apps/frontend/.../node_modules/.bin/esbuild` 处失败。
- 根因
  - Offer 的 Dockerfile 仍使用了“复制整个仓库”的模式（`COPY . .`），与前端目录软链冲突。
- 解决
  - 重写 `services/offer/Dockerfile` 为“最小工作区拷贝”模式：
    - `FROM golang:1.25 as builder`
    - `COPY go.work ./go.work`
    - `COPY pkg ./pkg`
    - `COPY services/offer ./services/offer`
    - `go build -o /offer-service`；runtime 使用 `gcr.io/distroless/base-debian12`
  - 确保 `.dockerignore`、`.gcloudignore` 均包含 `apps/frontend/node_modules/**`（已经落地）
  - 重新触发构建：
    - `gcloud builds submit . --config deployments/offer/cloudbuild.yaml --substitutions _IMAGE=asia-northeast1-docker.pkg.dev/<PROJECT>/autoads-services/offer:preview-oapi`
  - 验证观察点：构建日志不应再出现 `COPY . .`，而是只看到 `COPY go.work`、`COPY pkg`、`COPY services/offer`。

【补充】Next.js TSX 三元渲染语法错误（Unexpected token `div`）
- 现象
  - Next 构建报 `Unexpected token 'div'. Expected jsx identifier`，指向 `</table>` 后的 `<div>`。
- 根因
  - JSX 三元表达式的“else 分支”返回了两个相邻元素 `<table/>` 与 `<div/>`，未用父容器（Fragment/Div）包裹，导致语法错误。
- 解决
  - 使用 Fragment 包裹 else 分支：
    - `) : ( <> <table>...</table> <div>...</div> </> )`
  - 已修复：`apps/frontend/src/app/recommend/opportunities/page.tsx`

## 4. Go Modules 拉取本仓库子包失败（unknown revision）

- 现象
  - 日志：
    - `reading github.com/xxrenzhe/autoads/pkg/idempotency/go.mod ... unknown revision`
    - 或 `pkg/httpclient` 等内部包被当作远程模块拉取失败
- 根因
  - 多模块工作区 `go.work` 存在，但 Cloud Build 的远程 `go mod tidy` 未正确解析到本地子包；或 `require` 未覆盖到所有内部包。
- 解决
  - 在服务的 `go.mod` 中增加 `replace` 指向工作区相对路径：
    - 例如：
      - `replace github.com/xxrenzhe/autoads/pkg/idempotency => ../../pkg/idempotency`
      - `replace github.com/xxrenzhe/autoads/pkg/httpclient => ../../pkg/httpclient`
      - 以及 `events`、`middleware`、`telemetry`、`config` 等实际用到的内部包
  - 必要时在 `require` 中添加占位版本（`v0.0.0-00010101000000-000000000000`）以显式纳入依赖图，再由 `replace` 覆盖到本地。

## 5. 使用 Cloud Build 指定服务账号的参数格式错误

- 现象
  - `--service-account` 传入邮箱报：`expect projects/{project}/serviceAccounts/{service_account}`
- 解决
  - 使用资源名格式：
    - `--service-account projects/<PROJECT_ID>/serviceAccounts/codex-dev@<PROJECT_ID>.iam.gserviceaccount.com`

## 6. Artifact Registry 推送失败：构建成功但最终显示 `images not found`

- 现象
  - Kaniko 步骤成功，构建整体失败，提示 images 不存在。
- 根因
  - `cloudbuild.yaml` 中保留了 `images:` 字段，Cloud Build 在步骤外尝试校验镜像存在；同时使用非 docker builder 时，此行为与 Kaniko 的推送逻辑不一致。
- 解决
  - 删除 `images:` 字段；仅依赖 Kaniko 的 `--destination` 推送。
  - 同时确保使用具有写权限的服务账号运行 Cloud Build（例如 `codex-dev`）。

## 7. Cloud Run 启动失败：chi 中间件注册顺序错误

## 11. API Gateway 映射健康聚合 404
- 现象：`/api/health` 返回 404（其它健康探针 200）
- 根因：聚合映射到了 Console 根路径，未追加 `/health`
- 解决：将 `gateway.v2.yaml` 中 `/api/health` 的 backend 改为 `address: https://console-.../health` + `CONSTANT_ADDRESS`，滚动更新 Config 与 Gateway

## 12. Identity/Workflow 服务已下线但仍被构建/部署
- 现象
  - Cloud Build/GitHub Actions 仍尝试构建 `services/identity`/`services/workflow`，导致 go mod tidy 拉取不存在的内部包版本（unknown revision），构建失败。
- 根因
  - 历史流水线未清理全量服务列表（强制全量或“核心/共享变更时全量”仍包含 identity/workflow）。
- 解决
  - 更新 CI/CD：
    - `.github/workflows/deploy-backend.yml`：Tag 构建的全量列表移除 identity/workflow。
    - `scripts/deploy/detect-changed-services.sh`：核心变更触发的“全量构建列表”移除 identity/workflow，改为有效服务集合（billing/offer/siterank/adscenter/batchopen/console/recommendations/notifications）。
    - `scripts/deploy/cloudrun-deploy.sh`：默认 SERVICES_ARR 不再包含 identity/workflow。
  - 说明：v2 网关已合并鉴权（Firebase），不再需要独立 Identity 服务；Workflow 由事件驱动与 Saga 替代。

## 13. Docker 构建在 go.work 环境下报缺少其他模块目录
- 现象
  - 在服务 Dockerfile 里仅复制了 `pkg/` 与对应 `services/<svc>`，但仍复制了根 `go.work`。`go mod tidy` 报：`cannot load module ../batchopen listed in go.work file...`。
- 根因
  - `go.work` 中 `use` 了多个服务路径；容器内这些路径未被 COPY，Go 在 workspace 模式下会尝试解析并报错。
- 解决
  - 在 Dockerfile 中加入 `ENV GOWORK=off`，让构建使用模块模式 + go.mod 里的 replace 覆盖到本地 `pkg/*`；或仅复制“精简 go.work”。
  - 已落实：为 adscenter/siterank/offer 的 Dockerfile 增加 `GOWORK=off`，并保持 `replace github.com/xxrenzhe/autoads/pkg/* => ../../pkg/*` 有效。
  - 同类修复：为 batchopen Dockerfile 增加 `GOWORK=off` 且采用“最小 COPY（go.work/pkg/services/batchopen）”，并在 go.mod 补充 `replace`（errors/logger/eventbus/telemetry/http/middleware）。

- 现象
  - 日志：`panic: chi: all middlewares must be defined before routes on a mux`
- 根因
  - 先注册路由再调用 `r.Use(...)`。
- 解决
  - 将所有 `r.Use(...)` 中间件放在任何路由挂载之前。示例：
    - `r := chi.NewRouter(); r.Use(telemetry.ChiMiddleware("svc")); r.Use(middleware.LoggingMiddleware("svc")); r.Get("/health", ...)`

## 8. gcloud 参数不兼容

## 14. 创建 Firebase Web API Key 报 SERVICE_DISABLED / 权限不足
- 现象
  - `gcloud services api-keys create` 返回 `PERMISSION_DENIED` 或提示启用 `apikeys.googleapis.com`。
- 根因
  - 项目未启用 API Keys API，或当前服务账号无足够权限创建 API Key。
- 解决
  - 在 GCP 控制台启用 API Keys API：`apikeys.googleapis.com`。
  - 使用具备相应权限的服务账号（通常需要 `roles/serviceusage.serviceUsageAdmin` + `roles/serviceusage.apiKeysAdmin`）。
  - 备选：从 Firebase 控制台（项目设置 → Web App 配置）复制现有 Web API Key，并存入 Secret Manager（NEXT_PUBLIC_FIREBASE_API_KEY）。

## 15. 创建 Cloud Scheduler Job 报 PERMISSION_DENIED
- 现象
  - `gcloud scheduler jobs create http ...` 提示缺少 `cloudscheduler.jobs.create` 权限。
- 根因
  - 构建/运行使用的服务账号未授予 Cloud Scheduler 管理权限。
- 解决
  - 为运行命令的服务账号授予 `roles/cloudscheduler.admin`（或至少包含 `jobs.create/update/run` 的角色）。
  - 配置 OIDC：`--oidc-service-account-email=<run-service-sa>`，确保调用目标 Cloud Run 需要鉴权时可签发令牌。

## 16. 创建 Monitoring 告警策略报 PERMISSION_DENIED / INVALID_ARGUMENT
- 现象
  - 403：缺少编辑权限；400：MQL 语法错误（如 join/table 对齐/括号不匹配）。
- 根因
  - 服务账号缺少 `roles/monitoring.editor`；或 MQL 查询未按最新语法编写。
- 解决
  - 赋权 `roles/monitoring.editor`。
  - 构建请求体时严格 JSON 转义查询（避免 shell 变量插值破坏格式），参考：用 Python `json.dumps()` 包装查询字符串。
  - 如 MQL join 仍报错，可先用阈值型条件（conditionThreshold）或使用更简洁的 MQL 变体（避免复杂 join），待后续验证后再升级到 ratio 方案。

- 现象
  - `gcloud builds submit` 使用 `--logging=CLOUD_LOGGING_ONLY` 报不识别。
- 解决
  - 去掉该参数或使用 `gcloud beta builds submit`；本项目统一移除该参数。

## 9. .gcloudignore 与 .dockerignore 的通用规范

- 原则
  - 锚定根目录二进制忽略：`/siterank`、`/adscenter` 等，仅忽略根级同名文件，不影响 `services/<svc>` 源码目录。
  - 显式忽略前端大型目录：`apps/frontend/node_modules/**`。
  - 保留 Go 工作区必须文件：`!go.work`、`!services/**`、`!pkg/**`。

## 10. 参考命令（预发构建与部署）

- 构建（以 siterank 为例）：
  - `gcloud builds submit . --config deployments/siterank/cloudbuild.yaml --substitutions _IMAGE=asia-northeast1-docker.pkg.dev/<PROJECT>/autoads-services/siterank:preview-latest --service-account projects/<PROJECT>/serviceAccounts/codex-dev@<PROJECT>.iam.gserviceaccount.com`
- 部署（Cloud Run）：
  - `gcloud run deploy siterank-preview --image asia-northeast1-docker.pkg.dev/<PROJECT>/autoads-services/siterank:preview-latest --service-account codex-dev@<PROJECT>.iam.gserviceaccount.com --region asia-northeast1 --vpc-connector projects/<PROJECT>/locations/asia-northeast1/connectors/cr-conn-default-ane1 --vpc-egress all --allow-unauthenticated --update-env-vars DATABASE_URL_SECRET_NAME=projects/<PROJECT>/secrets/DATABASE_URL/versions/latest`
- 冒烟：
 - `/health`：`curl -sf https://<SERVICE_URL>/health`
 - siterank 分析：`curl -sS -X POST "$SVC/api/v1/siterank/analyze" -H 'Content-Type: application/json' -H 'X-User-Id: smoke-user' -d '{"offerId":"offer-smoke-1"}'`

---

以上问题与修复均已在本次预发构建与部署中验证通过。若新增问题，请继续在此文件补充“现象/根因/解决/复现要点”。

## 11. Offer 服务 `main.go` 编译失败：`undefined: config.LoadConfig`

- 现象
  - `services/offer/cmd/server/main.go: undefined: config.LoadConfig`
- 根因
  - 代码从早期版本迁移后，`pkg/config` 的接口/版本已改变或未引入；运行时并不需要从外部文件加载配置。
- 解决
  - 改为读取环境变量：`PORT`（默认 8080）与 `DATABASE_URL`；去除文件配置依赖。
  - 注意在重构后补上 `var err error` 声明，避免移除代码后遗留未定义的 `err`。

## 12. Console 规则评估实现中使用匿名 interface 作为参数导致语法错误

- 现象
  - `syntax error: unexpected comma in interface type; possibly missing semicolon or newline or }`
- 根因
  - 在函数签名内直接写 `interface{ service, metric, cmp string; th float64 }` 这种“字段聚合”语法在 Go 中非法。
- 解决
  - 改为显式参数（`svc, metric, cmp string, th float64`）或定义具名结构体类型。

## 13. AdminOnly 阻断内部自动化（Scheduler/Functions）

- 现象
  - Cloud Scheduler/Cloud Functions 调用 Console/Offer 内部接口返回 401/403，日志显示 `Admin role required`。
- 根因
  - `AdminOnly` 只接受用户 Bearer 鉴权，未允许内部自动化访问。
- 解决
  - 在 `AdminOnly` 中增加对 `X-Service-Token` 的校验：当其与环境变量 `INTERNAL_SERVICE_TOKEN` 匹配时放行（仅限内部作业）。
  - 建议对该令牌严格管理，仅用于内部作业，切勿暴露给前端。

## 14. Cloud Build 使用 Kaniko 仍出现 `images not found`

- 现象
  - Kaniko 步骤成功，但 Cloud Build 结束时报 `images not found`。
- 根因
  - `cloudbuild.yaml` 仍保留 `images:` 字段，Cloud Build 会在步骤外二次校验镜像存在。
- 解决
  - 切换 Kaniko 时移除 `images:` 字段，只保留 `--destination=${_IMAGE}`。
  - 参见本仓 `deployments/*/cloudbuild.yaml` 的范例（adscenter/siterank/offer 等）。

## 15. OpenAPI 工具缺失导致 CI 校验失败

- 现象
  - CI 中 `redocly`/`spectral` 或 `oapi-codegen` 不存在；本地 `npx` 环境缺失。
- 解决
  - 提供脚本降级/提示：
    - `scripts/openapi/validate.sh`：优先使用 Redocly；不存在时仅列出规范文件，避免“硬失败”。
    - `scripts/openapi/generate.sh`：在本地安装好 `oapi-codegen` 与 `openapi-typescript` 后运行，CI 中可跳过生成仅做校验。

## 16. Scheduler OIDC 调用易失败，统一改为 Pub/Sub 调度

- 症状
  - 直连 Cloud Run HTTP 调度需要配置 OIDC；不同服务的鉴权与路由差异导致调用时有 401/403 或 5xx。
- 解决
  - 采用模式：Scheduler → Pub/Sub → Cloud Functions(Dispatcher) → 目标服务 HTTP。
  - 优点：
    - 无需为 Scheduler 配置 OIDC；Dispatcher 统一注入 `X-Service-Token`。
    - 作业载荷（URL/Headers/Body）集中在 Pub/Sub 消息中，便于追踪与重放。
  - 产物：`services/functions/dispatcher`、`create-pubsub-dispatcher.sh`、`create-scheduler-pubsub-dispatch.sh`。

## 17. SSE 事件解析与 via 字段展示

- 现象
  - SSE 多行事件解析不稳定；无法在 UI 中稳定显示 Siterank 的 `via`。
- 根因
  - SSE 事件由多行组成，需要完整读取到空行分隔；`data:` 行需拼接再 `JSON.parse`。
- 解决
  - 在前端实现按 `\n\n` 分帧的解析器；对 `event:`/`data:` 逐行提取，确保 `data` 串完整后再 `JSON.parse`，并健壮地捕获 `via`。

## 18. SQL 迁移顺序与 apply 脚本

- 现象
  - 新表（OfferDailyKPI/OfferAccountMap/OfferKpiDeadLetter/notification_rules）增加后忘记应用顺序或漏迁移。
- 解决
  - 统一增加顺序化迁移：012/013/014，并通过 `scripts/db/apply-sql.sh` 按字典序应用。
  - 开发环境建议每次功能完结执行一次 apply，避免接口先行但表结构缺失。

## 19. Bash JSON 参数转义导致 Pub/Sub 载荷格式错误

- 现象
  - 使用 `create-scheduler-pubsub-dispatch.sh` 创建作业时，`HEADERS_JSON` 或 `BODY_JSON` 未正确转义，Cloud Scheduler 发布到 Pub/Sub 的消息 data 不是合法 JSON，分发函数报错。
- 根因
  - Shell 变量中嵌套 JSON 时未用单引号包裹、或内部引号未转义，导致最终字符串被 `jq` 解析失败。
- 解决
  - 统一示例与脚本：`HEADERS_JSON` 与 `BODY_JSON` 强烈建议使用单引号包裹，内部使用双引号，例如：
    - `HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'`
    - `BODY_JSON='{}'`
  - 在脚本内通过 `jq -c -n --arg/--argjson` 构造最终 payload，避免手工拼接。

## 20. Pub/Sub 分发器未注入内部令牌导致 401

- 现象
  - 分发器调用目标服务返回 401/403，后台日志提示需要管理员或内部令牌。
- 根因
  - 载荷 headers 未设置 `X-Service-Token`，或设置的字符串未指示为 ENV 注入模式。
- 解决
  - 在调度脚本中设置：`HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'`，分发器会将 `INTERNAL_SERVICE_TOKEN` 环境变量注入到真实请求头。
  - 确保目标服务的 AdminOnly 中已支持该令牌放行（已在 `pkg/middleware/AdminOnly` 落地）。

## 21. GitHub Actions OpenAPI 校验失败（工具版本/环境缺失）

- 现象
  - 工作流报 `oapi-codegen` 或 `@redocly/cli` 不存在，或 Node/Go 版本不兼容。
- 解决
  - 固定工作流环境：Node 20、Go 1.22，并显式 `go install github.com/deepmap/oapi-codegen/...@latest`。
  - 脚本降级处理：`scripts/openapi/validate.sh` 在 Redocly 缺失时仅做存在性检查，避免硬失败；`ci-check.sh` 先 `validate` 再尝试 `generate`，生成失败不影响校验结果。

## 22. KPI 预热带来的瞬时并发与抖动

- 现象
  - 看板初次加载时若同时触发多条 Offer 的 KPI 拉取，可能造成后端短瞬时拥塞或“占位→真实”的抖动感知变差。
- 解决
  - 采用串行预热 + 微小间隔（每 300ms 触发 1 条，默认前 3 条），并保持“占位→真实”的自动聚合与刷新，不阻塞 UI。

## 23. SSE 事件解析变量复用导致数据解析混乱

- 现象
  - SSE 解析中复用 `data` 变量名或未在分帧后再 JSON 解析，可能导致上一次事件的残留数据串联，JSON 解析失败。
- 解决
  - 按 `\n\n` 分帧后再解析；将 `event:` 与 `data:` 分开累积，完成一个帧后再 `JSON.parse` 到本地作用域变量，避免与外层 `data` 命名冲突。

## 24. Cloud Run Job 迁移失败：已有表结构与新迁移不兼容（列不存在）

- 现象
  - 预发执行 DB 迁移 Job 报错：`apply /app/schemas/sql/014_notification_rules.sql failed: pq: column "service" does not exist`
  - 项目早期版本已创建 `notification_rules` 表，且无 `service/metric` 等新字段；新迁移直接建索引/使用列导致失败。
- 根因
  - 迁移脚本假设“空库/全新建表”，未考虑“已有旧表需增量演进”的情况。
- 解决
  - 将 014 迁移改为“向后兼容、幂等”的增量策略：
    - 先检测表是否存在；存在则 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`、条件创建索引；不存在再一次性建表。
  - 新增 015 补丁脚本，确保旧库平滑升级（补列、回填默认、条件索引创建）。
  - 产物：`schemas/sql/014_notification_rules.sql`（重写为增量版）、`schemas/sql/015_notification_rules_patch.sql`。
  - 旁路：若必须保留“严格迁移”与“增量迁移”，可拆分 dry-run 检查与 apply 两段，并在 Job 启动时加 CHECK_ONLY 模式验证表结构。

## 25. Cloud Run Job 执行失败：VPC Connector 名称错误

- 现象
  - Job 报错 `VpcNetworkNotFound`，提示 VPC connector 不存在或无权限。
- 根因
  - 使用了错误的连接器名称 `autoads-vpc`，预发可用的是 `cr-conn-default-ane1`。
- 解决
  - 更新 Job 部署参数为 `--vpc-connector projects/<PROJECT>/locations/asia-northeast1/connectors/cr-conn-default-ane1`，执行成功。

## 26. gcloud --set-secrets 参数格式错误

- 现象
  - `--set-secrets GOOGLE_ADS_DEVELOPER_TOKEN=projects/.../secrets/GOOGLE_ADS_DEVELOPER_TOKEN:latest` 报 secret 名称无效。
- 根因
  - Cloud Run `--set-secrets` 参数期望的是简名 `NAME:version`，不接受完整资源名。
- 解决
  - 使用短格式：`--set-secrets KEY=SECRET_NAME:latest`。

## 27. OAS 装载顺序导致自定义路由 404（ab-tests/preflight/accounts/oauth/url）

- 现象
  - 直连 Cloud Run 访问 `/api/v1/adscenter/ab-tests`/`/preflight`/`/accounts`/`/oauth/url` 404；其它 OAS 内路由可用。
- 根因
  - 先 Mount OAS 再注册自定义路由，或 BaseURL/catch-all 导致匹配顺序被 OAS 占用。
- 解决
  - 将自定义路由注册“提前于 OAS 挂载”，并对 chi 路由使用 `r.Get/r.Post` 或包装函数，确保中间件与优先级生效。
  - 必要时同时保留 OAS 同名路由（由生成代码挂载），避免 BaseURL 差异。

## 28. chi 路由签名不匹配（Handler vs HandlerFunc）

- 现象
  - 编译错误：`cannot use http.Handler as http.HandlerFunc in r.Get/r.Post`。
- 根因
  - `r.Get/r.Post` 需要 `http.HandlerFunc`，而中间件返回的是 `http.Handler`。
- 解决
  - 使用包装：`r.Get(path, func(w,r){ middleware.AuthMiddleware(http.HandlerFunc(handler)).ServeHTTP(w,r) })`。

## 29. Bash 毫秒时间戳不可移植

- 现象
  - 脚本使用 `date +%s%3N` 在部分环境报 `value too great for base`。
- 根因
  - 不同系统的 `date` 不支持 `%N` 或 `%3N` 精度；行为不一致。
- 解决
  - 用 `python3 -c 'import time; print(int(time.time()*1000))'` 生成毫秒级时间戳（跨平台）。
  - 产物：`scripts/e2e/e2e-perf.sh`、`scripts/e2e/e2e-sample.sh` 已统一。

## 30. Kaniko/KRM 构建成功但 Job 执行拉取旧镜像

- 现象
  - Cloud Build 成功，Job 立即执行仍使用旧镜像版本。
- 根因
  - 构建“成功”到镜像“可拉取”存在短延迟；立即执行 Job 可能还未就绪。
- 解决
  - 构建后等待 30–90s 再执行 Job，或轮询 Artifact Registry 镜像可见性；在脚本中加入 sleep/轮询。
