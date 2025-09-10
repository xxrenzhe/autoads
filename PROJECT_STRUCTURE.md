# AutoAds 项目文件组织说明

## 项目根目录结构

```
AutoAds/
├── docs/                     # 项目文档
│   ├── prd-new.md           # 新的 PRD 文档
│   ├── prd.md               # 原 PRD 文档
│   ├── saas-architecture-design.md  # SaaS 架构设计
│   ├── MustKnow.md          # 部署和配置说明
│   └── Pricinples.md        # 设计原则
├── gofly_admin_v3/          # GoFly 框架源码
│   ├── app/                 # 应用代码
│   ├── utils/               # 工具库
│   ├── resource/            # 资源文件
│   └── main.go              # 入口文件
├── src/                     # Next.js 前端源码
│   ├── app/                 # App Router 页面
│   ├── components/          # React 组件
│   ├── lib/                 # 工具库
│   └── styles/              # 样式文件
├── prisma/                  # 数据库架构和迁移
├── scripts/                 # 构建和部署脚本
├── public/                  # 静态资源
├── package.json             # 项目依赖
├── next.config.js           # Next.js 配置
├── tailwind.config.ts       # Tailwind 配置
└── tsconfig.json            # TypeScript 配置
```

## 重要文件说明

### 文档文件
- **docs/prd-new.md**: 新创建的完整 PRD 文档，包含 SaaS 重构的所有需求
- **docs/saas-architecture-design.md**: 详细的技术架构设计方案
- **docs/MustKnow.md**: 部署相关的配置信息

### GoFly 框架
- **gofly_admin_v3/**: 完整的 GoFly Admin V3 框架源码
  - 包含用户管理、RBAC 权限、路由系统等
  - 可直接用于构建 SaaS 后台管理系统

### 清理脚本
- **cleanup-project.sh**: 项目清理脚本，用于清理临时文件和构建缓存

## 清理建议

运行清理脚本（可选）：
```bash
./cleanup-project.sh
```

该脚本会清理：
- 系统临时文件（.DS_Store 等）
- 构建缓存（.next 目录）
- 旧的日志文件
- TypeScript 构建信息
- 测试覆盖率报告

## 注意事项

1. **备份重要数据**: 清理前请确保已备份重要数据
2. **Git 状态**: 清理前请提交所有 Git 更改
3. **依赖恢复**: 清理 node_modules 后需要运行 `npm install`
4. **构建恢复**: 清理 .next 后需要重新构建项目

## 后续开发建议

1. 基于 GoFly 框架开始后端微服务开发
2. 保持前端 Next.js 架构，适配新的 API
3. 参考架构设计文档进行系统实现
4. 使用 PRD 文档作为开发指导