# AutoAds SaaS 部署指南

## 概述

AutoAds SaaS 采用单进程部署架构，Go 主进程嵌入 Next.js 静态文件，实现简化的部署和运维。

## 部署架构

```
┌─────────────────────────────────────────┐
│           ClawCloud 容器平台            │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐ │
│  │     AutoAds SaaS 容器 (2C4G)       │ │
│  │  ┌─────────────┐ ┌─────────────────┐│ │
│  │  │ Go 后端     │ │ Next.js 前端    ││ │
│  │  │ (端口8888)  │ │ (静态文件)      ││ │
│  │  └─────────────┘ └─────────────────┘│ │
│  └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│           外部数据库服务                │
│  MySQL: dbprovider.sg-members-1...      │
│  Redis: dbprovider.sg-members-1...      │
└─────────────────────────────────────────┘
```

## 环境配置

### 预发环境 (Preview)
- **域名**: urlchecker.dev → www.urlchecker.dev (301重定向)
- **镜像**: `ghcr.io/xxrenzhe/autoads:preview-latest`
- **分支**: `main`
- **数据库**: `autoads_preview`
- **Redis DB**: `1`

### 生产环境 (Production)
- **域名**: autoads.dev → www.autoads.dev (301重定向)
- **镜像**: `ghcr.io/xxrenzhe/autoads:prod-latest` 或 `ghcr.io/xxrenzhe/autoads:prod-v1.0.0`
- **分支**: `production` 或 `tags`
- **数据库**: `autoads_production`
- **Redis DB**: `0`

## 部署流程

### 自动化部署 (推荐)

1. **代码推送触发构建**
   ```bash
   # 预发环境
   git push origin main
   
   # 生产环境
   git push origin production
   # 或者打标签
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **GitHub Actions 自动构建镜像**
   - 运行测试和安全扫描
   - 构建 Docker 镜像
   - 推送到 GitHub Container Registry

3. **手动部署到 ClawCloud**
   - 登录 ClawCloud 控制台
   - 更新服务镜像
   - 重启服务

### 手动部署

1. **使用部署脚本**
   ```bash
   # 部署到预发环境
   ./scripts/deploy-autoads-saas.sh preview
   
   # 部署到生产环境
   ./scripts/deploy-autoads-saas.sh production --force
   
   # 仅构建镜像
   ./scripts/deploy-autoads-saas.sh preview --build-only
   ```

2. **使用 Docker 直接运行**
   ```bash
   # 预发环境
   ./scripts/start-autoads-saas.sh preview --build
   
   # 生产环境
   ./scripts/start-autoads-saas.sh production --pull
   
   # 或直接使用Docker命令
   docker run -d --name autoads-saas-preview \
     -p 8888:8888 \
     --env-file .env.preview \
     --restart unless-stopped \
     autoads-saas:preview
   ```

## 环境变量配置

### 必需环境变量

```bash
# 基础配置
DEPLOYMENT_ENV=preview|production
DOMAIN=urlchecker.dev|autoads.dev
NODE_ENV=production

# 数据库
DATABASE_URL=mysql://root:password@host:port/database
REDIS_URL=redis://default:password@host:port/db

# 认证
JWT_SECRET=your-jwt-secret
AUTH_SECRET=your-auth-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# 外部服务
SIMILARWEB_API_KEY=your-similarweb-api-key

# 安全
ENCRYPTION_KEY=your-32-char-encryption-key
```

### 环境变量模板

复制并修改环境变量模板：
```bash
# 预发环境
cp .env.preview.template .env.preview
# 编辑 .env.preview 填入实际值

# 生产环境
cp .env.production.template .env.production
# 编辑 .env.production 填入实际值
```

## ClawCloud 部署步骤

### 1. 创建服务

1. 登录 ClawCloud 控制台
2. 创建新的容器服务
3. 配置基本信息：
   - 服务名称: `autoads-preview` 或 `autoads-prod`
   - 容器规格: 2C4G
   - 端口映射: 8888

### 2. 配置镜像

```bash
# 预发环境镜像
ghcr.io/xxrenzhe/autoads:preview-latest

# 生产环境镜像
ghcr.io/xxrenzhe/autoads:prod-latest
# 或指定版本
ghcr.io/xxrenzhe/autoads:prod-v1.0.0
```

### 3. 配置环境变量

在 ClawCloud 控制台中添加环境变量：

**预发环境**:
```
NODE_ENV=production
NEXT_PUBLIC_DOMAIN=urlchecker.dev
NEXT_PUBLIC_DEPLOYMENT_ENV=preview
DATABASE_URL=mysql://root:jtl85fn8@dbprovider.sg-members-1.clawcloudrun.com:30354/autoads_preview
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284/1
AUTH_SECRET=85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834
AUTH_URL=https://www.urlchecker.dev
AUTH_GOOGLE_ID=1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=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
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
```

**生产环境**:
```
NODE_ENV=production
NEXT_PUBLIC_DOMAIN=autoads.dev
NEXT_PUBLIC_DEPLOYMENT_ENV=production
DATABASE_URL=mysql://root:jtl85fn8@dbprovider.sg-members-1.clawcloudrun.com:30354/autoads_production
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284/0
AUTH_SECRET=85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834
AUTH_URL=https://www.autoads.dev
AUTH_GOOGLE_ID=1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=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
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
```

### 4. 配置域名和SSL

1. 在 ClawCloud 中配置域名绑定
2. 启用 SSL 证书
3. 配置 301 重定向：
   - `urlchecker.dev` → `www.urlchecker.dev`
   - `autoads.dev` → `www.autoads.dev`

## 健康检查和监控

### 健康检查端点

- **基础健康检查**: `/health`
- **就绪检查**: `/ready`
- **存活检查**: `/live`
- **API健康检查**: `/api/health`

### 使用健康检查脚本

```bash
# 检查预发环境
./scripts/health-check.sh preview

# 检查生产环境
./scripts/health-check.sh production

# 快速检查
./scripts/health-check.sh production --quick

# 监控模式
./scripts/health-check.sh preview --monitor
```

### ClawCloud 健康检查配置

在 ClawCloud 控制台配置健康检查：
- **检查路径**: `/health`
- **检查间隔**: 30秒
- **超时时间**: 10秒
- **失败阈值**: 3次
- **启动延迟**: 60秒

## 数据库迁移

### 自动迁移

容器启动时会自动执行数据库迁移：
1. 检查数据库连接
2. 运行未执行的迁移
3. 初始化基础数据

### 手动迁移

如需手动执行迁移：
```bash
# 进入容器
docker exec -it autoads-saas-preview /bin/sh

# 执行迁移
./autoads-saas-server --migrate

# 检查迁移状态
./autoads-saas-server --migrate-status
```

## 备份和恢复

### 数据库备份

生产环境自动备份：
- **频率**: 每日凌晨2点
- **保留期**: 30天
- **存储位置**: 容器卷 `/app/backups`

### 手动备份

```bash
# 创建备份
mysqldump -h dbprovider.sg-members-1.clawcloudrun.com -P 30354 -u root -p autoads_production > backup.sql

# 恢复备份
mysql -h dbprovider.sg-members-1.clawcloudrun.com -P 30354 -u root -p autoads_production < backup.sql
```

## 故障排除

### 常见问题

1. **容器启动失败**
   - 检查环境变量配置
   - 查看容器日志
   - 验证数据库连接

2. **健康检查失败**
   - 检查端口映射
   - 验证应用启动状态
   - 查看应用日志

3. **数据库连接失败**
   - 检查数据库服务状态
   - 验证连接参数
   - 检查网络连通性

### 日志查看

```bash
# 查看容器日志
docker logs autoads-saas-preview

# 实时查看日志
docker logs -f autoads-saas-preview

# 查看最近100行日志
docker logs --tail 100 autoads-saas-preview
```

### 性能监控

```bash
# 查看容器资源使用
docker stats autoads-saas-preview

# 查看系统资源
top
htop
```

## 回滚策略

### 快速回滚

1. **回滚到上一个镜像版本**
   ```bash
   # 在 ClawCloud 控制台中
   # 1. 停止当前服务
   # 2. 更改镜像标签到上一个版本
   # 3. 重启服务
   ```

2. **使用脚本回滚**
   ```bash
   # 回滚到指定版本
   ./scripts/deploy-autoads-saas.sh production --rollback v1.0.0
   ```

### 数据库回滚

如果涉及数据库变更：
1. 停止应用服务
2. 恢复数据库备份
3. 回滚应用版本
4. 重启服务

## 安全注意事项

1. **环境变量安全**
   - 不要在代码中硬编码敏感信息
   - 使用强密码和密钥
   - 定期轮换密钥

2. **网络安全**
   - 启用 HTTPS
   - 配置 CORS
   - 启用 CSRF 保护

3. **容器安全**
   - 使用非 root 用户运行
   - 定期更新基础镜像
   - 扫描安全漏洞

## 性能优化

1. **资源配置**
   - 预发环境: 1.5C/1.5G
   - 生产环境: 2C/2G

2. **缓存策略**
   - Redis 缓存用户数据
   - 静态文件缓存
   - API 响应缓存

3. **数据库优化**
   - 连接池配置
   - 索引优化
   - 查询优化

## 联系支持

如遇到部署问题，请联系：
- **技术支持**: team@autoads.com
- **紧急联系**: Slack #autoads-ops
- **文档更新**: 提交 PR 到项目仓库