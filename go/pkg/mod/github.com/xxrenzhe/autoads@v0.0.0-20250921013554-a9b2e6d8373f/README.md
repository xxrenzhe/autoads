# AutoAds SaaS Platform

基于 Go + Next.js 的现代化 SaaS 平台，提供广告链接自动化管理服务。

> 架构优化（AO-06）已生效：
> - Next 不再内置 Admin；后台统一走 `/ops/console/*`（反代 Go 控制台）。
> - 生产禁止 Next 写入业务数据（仅认证相关表可写）；业务写入走 Go 原子端点。
> - API 统一入口 `/go/*`；`/api/go/*` 与 `/api/(siterank|adscenter)/*` 为兼容层，将逐步下线。
> - 数据迁移集中到 Go：启动前执行 `npm run migrate:backend`。
> - 支付/充值入口默认隐藏（`NEXT_PUBLIC_PAYMENTS_ENABLED=false`）。

## 项目结构

```
autoads/
├── apps/                  # 应用程序
│   ├── backend/          # Go 后端服务
│   └── frontend/         # Next.js 前端应用
├── configs/              # 配置文件
│   ├── environments/     # 环境配置
│   └── docker/           # Docker 配置
├── deployments/          # 部署相关
│   ├── scripts/         # 部署脚本
│   └── docker-compose/  # Docker Compose 配置
├── docs/               # 文档
├── scripts/            # 通用脚本
└── .github/            # GitHub Actions 工作流
```

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- Go >= 1.21.0
- Docker & Docker Compose
- Redis
- MySQL 8.0+

### 安装依赖

```bash
# 安装所有依赖
npm run setup

# 或者分别安装
npm install
npm run setup:frontend
npm run setup:backend
```

### 开发环境

```bash
# 启动前端开发服务器
npm run dev:frontend

# 启动后端开发服务器
npm run dev:backend

# 同时启动前后端（需要安装 concurrently）
npm run dev
```

### 生产部署

```bash
# 构建应用
npm run build

# 使用 Docker 部署
npm run docker:prod
```

### 运行时域名配置（ClawCloud）

CI 会根据分支注入预发/生产域名信息，并在容器启动时渲染 CORS 与 OAuth 回调：
- 覆盖变量：`ALLOW_ORIGINS`（CORS 允许来源，逗号分隔）
- 覆盖变量：`GOOGLE_REDIRECT_URI`（Google OAuth 回调地址）

示例：
- 预发：`ALLOW_ORIGINS=https://urlchecker.dev,https://www.urlchecker.dev`，`GOOGLE_REDIRECT_URI=https://www.urlchecker.dev/auth/google/callback`
- 生产：`ALLOW_ORIGINS=https://autoads.dev,https://www.autoads.dev`，`GOOGLE_REDIRECT_URI=https://www.autoads.dev/auth/google/callback`

注意：不注入 301 跳转相关开关（已在域名层实现）。详见《README-deployment.md》的“ClawCloud 运行时覆盖域名元信息”。

### 管理后台访问与新前缀

- 管理后台仅支持 URL 直达（Next 前端不提供入口）：
  - 直达 URL：`/ops/console/login` 或 `/ops/console/panel`
  - `/ops/*` 是 Next 的管理网关，内部反向代理至 Go 的 `/console/*`（管理前端）与 `/api/v1/console/*`（管理 API），并统一加 `X-Robots-Tag: noindex, nofollow`。
- 业务 API 通过 `/go/*` 访问（Next 网关），后台管理 API 通过 `/ops/*` 访问（权限由 Go 的 AdminJWT 严格判定）。
- 旧前缀 `/admin/*` 与 `/api/v1/admin/*` 已下线，**请改用** `/console/*` 与 `/api/v1/console/*`。
  - React Admin（Next 内置管理台）已彻底下线，相关代码与路由已移除；唯一后台为 GoFly Admin，经 `/ops/console/*` 访问。
  - 如需本地验证管理 API，请使用 `/ops/api/v1/console/*`（由 Next BFF 反代至 Go）。

### 一次性联调（冒烟）

建议使用脚本 `scripts/e2e-smoke.sh`（见脚本内注释）进行冒烟：
- 验证 siterank `:check/:execute` 幂等（重复请求返回 `duplicate=true`）
- 验证响应头 `X-Request-Id` 与 `X-RateLimit-*` 存在
- 验证系统配置热更新（`/ops/console/config/v1` 的 ETag/Version 随更新变化）

## 环境配置

复制环境变量模板：

```bash
cp .env.example .env
# 编辑 .env 文件配置数据库、Redis 等
```

### Feature Flags

- NEXT_PUBLIC_PAYMENTS_ENABLED
  - 作用：控制前端支付/Stripe 相关入口与界面显示。
  - 默认：`false`（隐藏支付配置、支付记录、订阅变更、账单/付款方式等模块）。
  - 设置为 `true` 时，将在管理后台与用户订阅页显示相关功能入口与模块。
  - 注意：该开关仅控制前端展示，若未正确配置支付后端或第三方账号，开启后功能仍不可用。

## 开发指南

- [后端开发文档](docs/development/backend.md)
- [前端开发文档](docs/development/frontend.md)
- [API 文档](docs/api/README.md)
- [部署指南](docs/deployment/README.md)

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

MIT License
## 运行时限流与缓存配置

为便于运营与排障，Next 侧提供轻量限流与缓存控制。注意：最终限流以后端/Go 为权威；Next 侧用于提示/保护。

### 速率限制（每分钟配额）

通过环境变量热调：

- `RATE_LIMIT_API_PER_MINUTE`（默认 100）
- `RATE_LIMIT_SITERANK_PER_MINUTE`（默认 30）
- `RATE_LIMIT_ADSCENTER_PER_MINUTE`（默认 20）
- `RATE_LIMIT_BATCHOPEN_PER_MINUTE`（默认 10）
- `RATE_LIMIT_AUTH_PER_MINUTE`（默认 5）

路由返回头包含 `X-RateLimit-*`（提示用途），配合中间件 `withApiProtection` 使用。

### SiteRank 缓存控制

- 成功结果缓存 7 天，错误结果缓存 1 小时；命中缓存仅用于提速，“命中缓存仍全额扣费”。
- 可用 `SITERANK_CACHE_DISABLED=true` 临时禁用 SiteRank 缓存（用于应急回滚与排障）。
- `forceRefresh=true` 参数可强制刷新单个域名缓存（Rank 路由）。

### 可观测

- 全局注入/透传 `X-Request-Id`；核心路由返回 `Server-Timing: upstream;dur=<ms>`。
- SiteRank 返回 `X-Cache-Hit: <hit>/<total>`（提示用途）。
