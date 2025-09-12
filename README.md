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

## 环境配置

复制环境变量模板：

```bash
cp .env.example .env
# 编辑 .env 文件配置数据库、Redis 等
```

## 开发指南

- [后端开发文档](docs/development/backend.md)
- [前端开发文档](docs/development/frontend.md)
- [API 文档](docs/api/README.md)
- [部署指南](docs/deployment/README.md)

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

MIT License