# AutoAds 项目结构重构说明

## 重构目标

将混乱的根目录结构重新组织为清晰的 monorepo 结构，提高代码可维护性和开发体验。

## 新结构说明

### apps/ - 应用程序目录

```
apps/
├── backend/     -> 符号链接到 gofly_admin_v3 (Go后端)
└── frontend/    -> Next.js前端应用
```

### configs/ - 配置文件目录

```
configs/
├── environments/    # 环境配置文件
│   ├── development.yaml
│   ├── preview.yaml
│   └── production.yaml
└── docker/          # Docker相关配置
    ├── Dockerfile.monorepo
    ├── Dockerfile.backend
    └── Dockerfile.frontend
```

### deployments/ - 部署相关

```
deployments/
├── scripts/         # 核心部署脚本
│   ├── build.sh
│   ├── deploy.sh
│   └── health-check.sh
└── docker-compose/  # Docker Compose配置
    ├── docker-compose.dev.yml
    └── docker-compose.prod.yml
```

### docs/ - 文档目录

```
docs/
├── architecture/    # 架构设计文档
├── api/            # API文档
├── deployment/     # 部署文档
└── development/    # 开发指南
```

## 使用说明

### 开发命令

```bash
# 安装所有依赖
npm run setup

# 启动前端
npm run dev:frontend

# 启动后端
npm run dev:backend

# 构建项目
npm run build

# 运行测试
npm test
```

### Docker部署

```bash
# 开发环境
npm run docker:dev

# 生产环境
npm run docker:prod
```

## 注意事项

1. `gofly_admin_v3` 保持为独立Git仓库，通过符号链接引用
2. 前端代码已移至 `apps/frontend` 目录
3. 环境配置文件集中在 `configs/environments` 目录
4. 部署脚本精简，只保留核心功能
5. 所有路径引用已更新为新的目录结构