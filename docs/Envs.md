# 环境变量配置文档

## 概述

遵循简单实用原则，本应用仅需配置8-9个核心环境变量即可完成部署。支持预发环境（urlchecker.dev）和生产环境（autoads.dev）。

## 核心环境变量（仅需8个）

### 必需配置（8个变量）

| 变量名 | 描述 | 预发环境值 | 生产环境值 |
|--------|------|-----------|-----------|
| `NODE_ENV` | 运行环境 | `production` | `production` |
| `NEXT_PUBLIC_DEPLOYMENT_ENV` | 部署环境 | `preview` | `production` |
| `NEXT_PUBLIC_DOMAIN` | 应用域名 | `urlchecker.dev` | `autoads.dev` |
| `DATABASE_URL` | 数据库连接 | `postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/?directConnection=true` | 同预发 |
| `REDIS_URL` | Redis连接 | `redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284` | 同预发 |
| `AUTH_SECRET` | 认证密钥 | `85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834` | 生产环境专用密钥 |
| `AUTH_URL` | 认证URL | `https://www.urlchecker.dev` | `https://www.autoads.dev` |
| `AUTH_GOOGLE_ID` | Google客户端ID | `1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com` | 生产环境专用ID |
| `AUTH_GOOGLE_SECRET` | Google客户端密钥 | `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` | 生产环境专用密钥 |

### 可选配置（1个变量）

| 变量名 | 描述 | 默认值 | 说明 |
|--------|------|--------|------|
| `AutoClick_Count_Variance_Hour` | 点击数量方差系数 | `0.3` | 控制每小时点击数量的随机波动范围（0-1之间） |

## 自动配置（无需手动设置）

以下变量由Docker容器自动设置，无需手动配置：

- `PORT=3000` - 应用端口
- `HOSTNAME=0.0.0.0` - 监听地址
- `NODE_OPTIONS` - 内存优化（2C4G环境自动调整）
- `LOW_MEMORY_MODE=true` - 低内存模式
- `NEXT_TELEMETRY_DISABLED=1` - 禁用遥测

## 部署配置模板

### 预发环境（urlchecker.dev）

```bash
NODE_ENV=production
NEXT_PUBLIC_DEPLOYMENT_ENV=preview
NEXT_PUBLIC_DOMAIN=urlchecker.dev
DATABASE_URL=postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/?directConnection=true
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284
AUTH_SECRET=85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834
AUTH_URL=https://www.urlchecker.dev
AUTH_GOOGLE_ID=1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=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
# AutoClick可选配置
AutoClick_Count_Variance_Hour=0.3
```

### 生产环境（autoads.dev）

```bash
NODE_ENV=production
NEXT_PUBLIC_DEPLOYMENT_ENV=production
NEXT_PUBLIC_DOMAIN=autoads.dev
DATABASE_URL=postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/?directConnection=true
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284
AUTH_SECRET=your-production-secret-key-64-characters-long
AUTH_URL=https://www.autoads.dev
AUTH_GOOGLE_ID=your-production-google-client-id
AUTH_GOOGLE_SECRET=your-production-google-client-secret
# AutoClick可选配置
AutoClick_Count_Variance_Hour=0.3
```

## 部署流程

### GitHub Actions自动构建

- `main` 分支推送 → 构建预发环境镜像：`ghcr.io/xxrenzhe/url-batch-checker:preview-latest`
- `production` 分支推送 → 构建生产环境镜像：`ghcr.io/xxrenzhe/url-batch-checker:prod-latest`
- 打tag（如v3.0.0） → 构建版本镜像：`ghcr.io/xxrenzhe/url-batch-checker:prod-v3.0.0`

### ClawCloud部署

1. 在ClawCloud配置上述9个环境变量
2. 拉取对应的Docker镜像
3. 容器配置：2C4G（2核4GB内存）
4. 端口映射：3000

## 域名和重定向

### 预发环境
- 主域名：`urlchecker.dev`
- 访问重定向：`https://urlchecker.dev` → `https://www.urlchecker.dev`
- 容器内部域名：`autoads-preview-xxx-xxx:3000`

### 生产环境
- 主域名：`autoads.dev`
- 访问重定向：`https://autoads.dev` → `https://www.autoads.dev`
- 容器内部域名：`autoads-prod-xxx-xxx:3000`

## 核心功能保障

本配置确保以下三大核心功能正常运行：

1. **batchopen** - 批量URL检查功能
2. **siterank** - 网站排名查询功能
3. **changelink** - 广告链接管理功能

## 故障排查

### 应用无法启动
1. 检查9个必需环境变量是否都已配置
2. 验证数据库和Redis连接是否正常
3. 确认域名配置是否正确

### Google登录失败
1. 检查 `AUTH_URL` 与实际访问域名是否一致
2. 确认Google OAuth回调URL配置正确
3. 验证客户端ID和密钥是否匹配

### 性能问题
- 2C4G环境已自动优化内存使用
- 如遇内存不足，检查应用日志
- Redis连接失败会自动降级到内存缓存

## 开发环境

本地开发仅需配置：

```bash
# .env.local
NODE_ENV=development
NEXT_PUBLIC_DEPLOYMENT_ENV=development
NEXT_PUBLIC_DOMAIN=localhost:3000
DATABASE_URL=your-local-database-url
AUTH_SECRET=any-64-character-string
AUTH_URL=http://localhost:3000
```

其他变量可选配置，不影响基本功能。