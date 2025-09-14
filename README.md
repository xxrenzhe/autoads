# AutoAds SaaS Platform

基于 Go + Next.js 的现代化 SaaS 平台，提供广告链接自动化管理服务。

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
