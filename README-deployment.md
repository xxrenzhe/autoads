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

### 2. 本地运行
```bash
# 启动本地环境
./scripts/start-autoads-saas.sh local --build

# 访问应用
open http://localhost:8888
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
- **资源**: 1.5C/1.5G

### 生产环境
- **域名**: autoads.dev
- **镜像**: `ghcr.io/xxrenzhe/autoads:prod-latest`
- **资源**: 2C/2G

## 监控和维护

### 健康检查
```bash
# 检查服务状态
curl https://www.autoads.dev/health

# 使用脚本检查
./scripts/health-check.sh production
```

### 日志查看
```bash
# 查看容器日志
docker logs autoads-saas-production

# 实时日志
./scripts/start-autoads-saas.sh production --logs
```

### 服务管理
```bash
# 重启服务
./scripts/start-autoads-saas.sh production --restart

# 停止服务
./scripts/start-autoads-saas.sh production --stop

# 查看状态
./scripts/start-autoads-saas.sh production --status
```

## 技术实现

### Dockerfile 特点
- **多阶段构建**：前端构建 → 后端构建 → 运行时
- **静态文件嵌入**：使用 Go embed 将前端文件打包
- **Alpine Linux**：最小化镜像大小
- **非 root 用户**：安全运行

### Go 服务器特点
- **静态文件服务**：直接服务 Next.js 构建产物
- **API 路由**：RESTful API 和 WebSocket 支持
- **健康检查**：内置多层健康检查
- **优雅关闭**：支持信号处理和优雅关闭

### 前端集成
- **SPA 路由**：支持 Next.js 客户端路由
- **API 代理**：无需配置，直接调用后端 API
- **静态资源**：优化的缓存策略

## 最佳实践

### 开发环境
```bash
# 本地开发
npm run dev          # 前端开发服务器
go run main.go       # 后端开发服务器

# 测试单镜像
./scripts/start-autoads-saas.sh local --build
```

### 生产部署
```bash
# CI/CD 自动构建
git push origin main        # 触发预发环境构建
git push origin production  # 触发生产环境构建

# 手动部署
./scripts/deploy-autoads-saas.sh production
```

### 监控告警
```bash
# 持续监控
./scripts/health-check.sh production --monitor

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
- ✅ **成本可控**：2C4G 运行完整应用

这种架构特别适合中小型 SaaS 应用，在保证功能完整性的同时，最大化了部署和运维的效率。