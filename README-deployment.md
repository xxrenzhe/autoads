# AutoAds SaaS 单镜像部署

## 为什么选择单镜像部署？

AutoAds SaaS 采用单镜像部署架构，将 Go 后端和 Next.js 前端打包到一个 Docker 镜像中，具有以下优势：

### 🎯 简化部署
- **一个镜像搞定**：无需管理多个服务和容器
- **减少复杂性**：不需要 Docker Compose 或 Kubernetes
- **降低运维成本**：单进程监控和管理

### 🚀 性能优势
- **减少网络延迟**：前后端在同一进程中，无网络开销
- **资源利用率高**：共享内存和CPU资源
- **启动速度快**：单个容器启动，无服务依赖等待

### 🔧 运维友好
- **日志统一**：所有日志在一个地方
- **健康检查简单**：只需检查一个端点
- **扩展容易**：直接复制容器实例

### 💰 成本效益
- **资源需求低**：2C4G 即可运行完整应用
- **网络流量少**：前后端通信无网络开销
- **存储需求小**：单个镜像，无重复文件

## 架构对比

### 传统微服务架构
```
┌─────────────┐    ┌─────────────┐
│  Next.js    │    │   Go API    │
│  容器       │◄──►│   容器      │
│  (1C2G)     │    │   (1C2G)    │
└─────────────┘    └─────────────┘
总资源: 2C4G + 网络开销 + 管理复杂度
```

### 单镜像架构
```
┌─────────────────────────────┐
│     AutoAds SaaS 容器       │
│  ┌─────────┐ ┌─────────────┐ │
│  │Next.js  │ │   Go API    │ │
│  │(静态文件)│ │  (主进程)   │ │
│  └─────────┘ └─────────────┘ │
│          (2C4G)             │
└─────────────────────────────┘
总资源: 2C4G，零网络开销，管理简单
```

## 快速开始

### 1. 构建镜像
```bash
# 预发环境
./scripts/deploy-autoads-saas.sh preview --build-only

# 生产环境
./scripts/deploy-autoads-saas.sh production --build-only
```

### 2. 本地运行（单端口 3000）
```bash
# 启动本地环境
./scripts/start-autoads-saas.sh local --build

# 访问应用
open http://localhost:3000
```

### 3. 部署到生产
```bash
# 完整部署流程
./scripts/deploy-autoads-saas.sh production

# 仅推送镜像（手动部署）
./scripts/deploy-autoads-saas.sh production --build-only
```

## 环境配置

### 预发环境
- **域名**: urlchecker.dev
- **镜像**: `ghcr.io/xxrenzhe/autoads:preview-latest`
- **资源**: 2C/4G

### 生产环境
- **域名**: autoads.dev
- **镜像**: `ghcr.io/xxrenzhe/autoads:prod-latest`
- **资源**: 2C/4G

## 监控和维护（单端口 3000）

### 健康检查
```bash
# 检查服务状态（外部）
curl https://www.autoads.dev/health

# 检查服务状态（容器内 Next 前端监听的 3000）
curl -f http://127.0.0.1:3000/api/health || true

# 使用脚本检查
./scripts/health-check.sh production
```

### BFF 与就绪守门
- 前端统一通过 `\`/api/go/*\`` 代理到 Go 后端（`BACKEND_URL`）。
- BFF 每次转发前会对 `BACKEND_URL/readyz` 做快速探测（带缓存 TTL），未就绪返回 503 并附加 `Retry-After`。
- 所有 BFF 响应统一添加：`X-BFF-Enforced: 1`、`X-Robots-Tag: noindex`、贯通 `x-request-id`。

相关环境变量（已在 `.env.*.template` 提供）
- `BACKEND_URL`、`BFF_MAX_BODY`、`BFF_UPSTREAM_TIMEOUT_MS`、`BFF_READY_TIMEOUT_MS`、`BFF_READY_TTL_MS`
- `/ops/*` 管理端反代：`BACKEND_PROXY_MAX_BODY`、`BACKEND_PROXY_TIMEOUT_MS`、`ADMIN_PROXY_ALLOW_PREFIXES`

### 日志查看
```bash
# 查看容器日志
docker logs autoads-saas-production

# 实时日志
./scripts/start-autoads-saas.sh production --logs
```

### 服务管理（外部仅暴露 3000）
```bash
# 重启服务（平台仅允许单端口，确保映射 3000 → 3000）
./scripts/start-autoads-saas.sh production --restart

# 停止服务
./scripts/start-autoads-saas.sh production --stop

# 查看状态
./scripts/start-autoads-saas.sh production --status
```

## 技术实现（单容器双服务，外部仅 3000）

### Dockerfile 特点
- **多阶段构建**：Next.js（apps/frontend）→ GoFly Admin Web（Vite）→ Go 后端 → 运行时
- **单容器双服务**：容器内同时运行 Next(3000) 与 Go(8080)，外部仅暴露 3000
- **Alpine/Node 运行层**：最小化镜像 + 内置 tini 作为 PID1
- **非 root 用户**：安全运行（node 用户）
 - **条件缓存**：前端 `backend.ts` 支持 ETag 条件 GET（If-None-Match/304），减少重复传输

### 前端到后端的内置反代（Route Handler）
- 新增 Next.js Route Handler：`/go/:path*` → 转发至容器内 `http://127.0.0.1:8080/:path*`
- 文件位置：`apps/frontend/src/app/go/[...path]/route.ts`
- 使用方式：
  - 将原本对 Go 的请求，例如：`http://127.0.0.1:8080/api/v1/...`
  - 改为同源路径：`/go/api/v1/...`
  - 优点：无需配置 CORS，仅暴露 3000 端口，统一鉴权/日志更方便
  
  观测与排障：
  - 反代会注入/透传 `X-Request-Id`，并在响应加上 `Server-Timing: upstream;dur=XXX`，可用来追踪延迟与端到端链路。
  - 前端（开发环境）会在控制台输出 `[backend]` 调用的耗时、请求ID、Server-Timing 摘要。

### 管理后台访问与登录分离（重要）

- 管理后台仅支持 URL 直达（Next 前端不提供任何入口），默认直达：
  - `/ops/console/login`（登录页）或 `/ops/console/panel`（已登录时）
- `/ops/*` 是 Next 的“管理网关”：
  - 仅允许代理到容器内的 `/console/*`（GoFly Admin 前端）与 `/api/v1/console/*`（管理 API）
  - 为所有响应添加 `X-Robots-Tag: noindex, nofollow`，避免被搜索引擎收录
  - 不做 NextAuth 预检，权限由 Go 的 `AdminJWT` 严格判定（独立于站点的 NextAuth）
- 普通用户登录站点（NextAuth）与管理员登录后台（AdminJWT）完全独立，Cookie/Session 不共享。
- 旧前缀 `/admin/*` 与 `/api/v1/admin/*` 已下线，请使用 `/console/*` 与 `/api/v1/console/*`。

### Go 服务器特点
- **静态文件服务**：直接服务 Next.js 构建产物
- **API 路由**：RESTful API 和 WebSocket 支持
- **健康检查**：内置多层健康检查
- **优雅关闭**：支持信号处理和优雅关闭

### 前端集成
- **SPA 路由**：支持 Next.js 客户端路由
- **API 代理**：无需配置，直接调用后端 API
- **静态资源**：优化的缓存策略

### 浏览器执行器与国家代理（同容器内）
- 单镜像会在容器内启动本地执行器（Playwright）并绑定 `127.0.0.1`，无需额外容器。
- 解析最终 URL 的请求由后端透传到执行器 `/resolve`，可按链接携带 `country` 选择代理，Referer 强制移除。
- 生产配置详见：docs/production-env-config.md 的“浏览器执行器与国家代理映射（生产）”章节（代理鉴权、出口合规与可观测性建议）。

## 最佳实践

### 开发环境
```bash
# 本地开发
npm run dev          # 前端开发服务器
go run main.go       # 后端开发服务器

# 测试单镜像
./scripts/start-autoads-saas.sh local --build
```

### 生产部署（平台单端口）
```bash
# CI/CD 自动构建
git push origin main        # 触发预发环境构建
git push origin production  # 触发生产环境构建

# 手动部署
./scripts/deploy-autoads-saas.sh production

# 平台端口映射（仅映射 3000）
# 外部端口示例：3000（或你选择的公开端口） → 容器 3000
# Go 服务保留在容器内 8080，不对外暴露
```

### 监控告警
```bash
# 持续监控
./scripts/health-check.sh production --monitor

## 数据库迁移（镜像内集成）

- 镜像包含 Prisma CLI，并在容器启动时自动执行：
  - Go 后端迁移：`server -migrate`
  - Prisma 迁移：`prisma migrate deploy --schema /app/frontend/prisma/schema.prisma`
- 需要设置 `DATABASE_URL`（MySQL DSN），例如：`mysql://user:pass@host:3306/dbname`
- 可选：`PRISMA_DB_PUSH_FALLBACK=true`，当迁移失败时使用 `prisma db push`（仅开发/临时环境，不建议生产）

- 一次性重建库（初始化基础数据，不会重复执行）：
  - 设置 `DB_REBUILD_ON_STARTUP=true`，容器首次启动时执行一次 `server -init-db`，并在 `/app/logs/.db_rebuild_done` 写入标记；后续重启不再重复执行，避免破坏已有数据。
  - 仍会执行常规的 `server -migrate` 与 Prisma 迁移（幂等、安全）。

示例运行：
```bash
docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_DOMAIN=localhost \
  -e DATABASE_URL="mysql://user:pass@db:3306/autoads" \
  -e DB_REBUILD_ON_STARTUP=true \
  ghcr.io/xxrenzhe/autoads:latest
```

# 集成到监控系统
curl -f https://www.autoads.dev/health || alert
```

## 故障排除

### 常见问题
1. **容器启动失败** → 检查环境变量和资源限制
2. **健康检查失败** → 检查端口映射和应用状态
3. **前端资源404** → 检查静态文件嵌入和路由配置

### 调试命令
```bash
# 进入容器
docker exec -it autoads-saas-production /bin/sh

# 检查进程
docker exec autoads-saas-production ps aux

# 检查端口
docker exec autoads-saas-production netstat -tlnp
```

## 总结

单镜像部署是 AutoAds SaaS 的核心架构决策，它在简化运维、提升性能和降低成本方面都有显著优势。通过将前后端打包到一个镜像中，我们实现了：

- ✅ **部署简单**：一个命令完成部署
- ✅ **性能优异**：零网络延迟，资源利用率高
- ✅ **运维友好**：统一监控，简化管理

## ClawCloud 运行时覆盖域名元信息（重要，单端口 3000）

为配合 MustKnow.md 的两步部署流程，CI 会在构建镜像时注入“域名元信息”，并在容器启动时渲染 `gofly_admin_v3/resource/config.yaml`。在 ClawCloud 控制台你可以覆盖以下环境变量，无需改动镜像内容：

- 变量：`ALLOW_ORIGINS`
  - 用途：渲染 `resource/config.yaml` 中的 `app.allowurl`（CORS 允许来源）
  - 说明：请填写以逗号分隔的 https 域名列表（不含 301 开关；跳转由域名解析/边缘层负责）
  - 示例（预发）：`https://urlchecker.dev,https://www.urlchecker.dev`
  - 示例（生产）：`https://autoads.dev,https://www.autoads.dev`

- 变量：`GOOGLE_REDIRECT_URI`
  - 用途：渲染 `resource/config.yaml` 中 Google OAuth 的回调地址
  - 示例（预发）：`https://www.urlchecker.dev/auth/google/callback`
  - 示例（生产）：`https://www.autoads.dev/auth/google/callback`

注意事项：
- 若未显式设置上述变量，启动脚本会基于 `NEXT_PUBLIC_DOMAIN` 或 `DOMAIN` 自动推导：
  - `ALLOW_ORIGINS = https://<domain>,https://www.<domain>`
  - `GOOGLE_REDIRECT_URI = https://www.<domain>/auth/google/callback`
- CI 侧不会注入“301 跳转开关”，因为 301 已在域名层实现。
- 模板位置：`gofly_admin_v3/resource/config.yaml.template`（其中 `allowurl: ${ALLOW_ORIGINS}`）。
- 渲染逻辑：`docker-entrypoint.sh` 使用 `envsubst` 只替换域名相关变量，不会覆盖其他保密配置位。

额外环境变量：
- `BACKEND_URL`（可选）：覆盖前端 Route Handler 反代的目标后端地址，默认 `http://127.0.0.1:8080`。

验证步骤：
- 部署后在容器日志中应看到“渲染 resource/config.yaml (ALLOW_ORIGINS, GOOGLE_REDIRECT_URI)”提示。
- 进入容器检查：`/app/gofly_admin_v3/resource/config.yaml` 的 `allowurl` 是否为期望域名列表。
- 跨域验证：带 `Origin: https://www.<domain>` 请求 API，应返回允许跨域的响应头。
- Next 前端可通过容器内环回地址访问 Go：`http://127.0.0.1:8080`（无需暴露 8080）。
- ✅ **成本可控**：2C4G 运行完整应用

## 单端口平台部署要点

- 仅映射容器端口 `3000` 到外部（如 3000 或 8888）。
- Go 服务对外不暴露，容器内监听 `8080`，供前端内部调用。
- 若需由 Next 前端转发到 Go 的 API，可在 Next 中配置服务端调用 `http://127.0.0.1:8080`（SSR/Route Handlers/Middleware）。

### 运行时可配置变量（反代/后端）
- `BACKEND_URL`（可选）：反代目标后端，默认 `http://127.0.0.1:8080`
- `BACKEND_PROXY_MAX_BODY`（可选）：反代请求体大小限制（字节），默认 `2097152`（2MB）
- `BACKEND_PROXY_TIMEOUT_MS`（可选）：反代上游超时（毫秒），默认 `15000`
- `NEXT_PUBLIC_BACKEND_PREFIX`（可选）：前端 `backend.ts` 访问后端的前缀，默认 `/go`
- `BACKEND_PROXY_ALLOW_PREFIXES`（可选）：允许反代的前缀列表，逗号分隔；默认最小集：
  - `/health,/ready,/live,/api/user,/api/tokens,/api/v1/siterank,/api/v1/adscenter,/api/v1/batchopen`

#### 示例配置

本地/容器运行时可通过环境变量覆盖，例如：

```bash
# 仅允许必要后端路径通过 /go 反代（业务前缀）
export BACKEND_PROXY_ALLOW_PREFIXES="/health,/ready,/live,/api/user,/api/tokens,/api/v1/siterank,/api/v1/adscenter,/api/v1/batchopen"

# 如后端在其它端口或地址
export BACKEND_URL="http://127.0.0.1:8080"

# 提高上游超时（毫秒）与请求体上限（字节）
export BACKEND_PROXY_TIMEOUT_MS=20000
export BACKEND_PROXY_MAX_BODY=5242880 # 5MB
```

### CI 冒烟测试接入（示例）

在部署完成后增加冒烟测试步骤，验证原子端点幂等、限流头与配置热更新 ETag：

```bash
# GitHub Actions 示例步骤
- name: Smoke test
  run: |
    BASE_URL=${{ steps.deploy.outputs.url }} \
    USER_TOKEN="Bearer $USER_JWT" \
    ADMIN_TOKEN="Bearer $ADMIN_JWT" \
    ./scripts/e2e-smoke.sh
```

若未使用 GitHub Actions，可在任何 CI 平台以相同方式调用 `scripts/e2e-smoke.sh`。脚本输出将包含 X-Request-Id、Server-Timing 与 X-RateLimit-* 等关键头部，便于快速诊断。

这种架构特别适合中小型 SaaS 应用，在保证功能完整性的同时，最大化了部署和运维的效率。
## BFF 统一入口与健康探针

前端所有业务 API 通过本地薄壳（/api/*）转发到统一 BFF 入口 `/api/go/[...path]`，该入口将请求安全地代理到后端 `BACKEND_URL`，并具备：

- 路径白名单（仅允许 /api/*、/api/v1/*、/health(z)、/readyz）
- 请求体大小限制（默认 2MB）与上游超时（默认 15s）
- 在响应头注入 `x-request-id` 以及 `X-BFF-Enforced: 1`
- 透传限流头（X-RateLimit-*）与 `Server-Timing: upstream;dur=...`
- 转发前进行 `/readyz` 短超时健康探测（TTL 3s）；若未就绪，直接返回 503 并附带 `Retry-After: 2`

环境变量（.env.preview/.env.production）：

```
BACKEND_URL=http://127.0.0.1:8080
BFF_MAX_BODY=2097152
BFF_UPSTREAM_TIMEOUT_MS=15000
BFF_READY_TIMEOUT_MS=1200
BFF_READY_TTL_MS=3000
NEXT_PRISMA_GUARD=true
```

Prisma 写入守卫（NEXT_PRISMA_GUARD=true）会在 production/preview 环境拦截 Next 层对业务域模型的写操作，仅允许认证域表（user/account/session/verificationToken/userDevice）写入，确保“认证最小写，业务写入后移到 Go”。
