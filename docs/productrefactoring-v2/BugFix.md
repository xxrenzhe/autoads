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

- 现象
  - 日志：`panic: chi: all middlewares must be defined before routes on a mux`
- 根因
  - 先注册路由再调用 `r.Use(...)`。
- 解决
  - 将所有 `r.Use(...)` 中间件放在任何路由挂载之前。示例：
    - `r := chi.NewRouter(); r.Use(telemetry.ChiMiddleware("svc")); r.Use(middleware.LoggingMiddleware("svc")); r.Get("/health", ...)`

## 8. gcloud 参数不兼容

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

