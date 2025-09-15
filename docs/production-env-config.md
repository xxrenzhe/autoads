# AutoAds 生产环境变量配置文档

## 概述

本文档详细列出了 AutoAds 系统在生产环境中需要配置的所有环境变量。遵循最小化配置原则，所有可选参数都有合理的默认值。

## 基础应用配置

### 必需配置

```bash
# 应用基础信息
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# 部署环境标识
NEXT_PUBLIC_DEPLOYMENT_ENV=production
NEXT_PUBLIC_DOMAIN=autoads.dev

# 应用密钥（生成一个强密钥）
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=https://www.autoads.dev
```

### 可选配置

```bash
# 应用标题和描述
NEXT_PUBLIC_APP_NAME=AutoAds
NEXT_PUBLIC_APP_DESCRIPTION=自动化营销平台

# API版本
NEXT_PUBLIC_API_VERSION=v1

# 调试模式（生产环境应为false）
NEXT_PUBLIC_DEBUG=false
```

## 数据库配置

### 必需配置

```bash
# MySQL 数据库连接
DATABASE_URL=mysql://username:password@hostname:port/database_name?sslmode=require

# 示例：
# DATABASE_URL=mysql://autoads_prod:secure_password@db-prod.autoads.internal:3306/autoads_production?sslmode=require

> 说明：容器启动时会自动执行数据库迁移（Go 迁移 + Prisma 迁移）。
> - 请确保在运行环境（Kubernetes Secret/ConfigMap、Docker 环境变量等）设置了 `DATABASE_URL`。
> - CI/CD 部署脚本会校验该变量是否存在；默认依赖容器启动时迁移。
> - 如需部署前预检，可设置 `MIGRATION_PRECHECK=true` 运行一次性检查。
```

### 可选配置

```bash
# 数据库连接池配置
DB_MIN_CONNECTIONS=2
DB_MAX_CONNECTIONS=20
DB_CONNECTION_TIMEOUT=30
DB_IDLE_TIMEOUT=300

# Prisma 配置
PRISMA_QUERY_TIMEOUT=5000
PRISMA_ENGINE_TIMEOUT=5000
```

## Redis 配置

### 必需配置

```bash
# Redis 连接
REDIS_URL=redis://username:password@hostname:port/db

# 示例：
# REDIS_URL=redis://autoads_prod:secure_password@redis-prod.autoads.internal:6379/0
```

### 可选配置

```bash
# Redis 连接池
REDIS_POOL_MIN=2
REDIS_POOL_MAX=10
REDIS_POOL_TIMEOUT=5000

# 缓存配置
REDIS_CACHE_TTL=3600
REDIS_PREFIX=autoads:prod
```

## 认证授权配置

### 必需配置

```bash
# NextAuth.js 配置
AUTH_SECRET=your-auth-secret-here
AUTH_URL=https://www.autoads.dev

# Google OAuth 配置
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# JWT 配置
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d
```

### 可选配置

```bash
# 认证相关
JWT_REFRESH_EXPIRES_IN=30d
MAX_SESSIONS=5
SESSION_TIMEOUT=3600

# 管理员账户（首次部署时设置）
ADMIN_EMAIL=admin@autoads.dev
ADMIN_PASSWORD=secure-admin-password
```

## 第三方服务配置

### SimilarWeb API 配置

```bash
# SimilarWeb API（必需）
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
SIMILARWEB_API_KEY=your-similarweb-api-key

# 可选配置
SIMILARWEB_RATE_LIMIT=100
SIMILARWEB_CACHE_TTL=86400
```

### Google Ads API 配置

```bash
# Google Ads API（可选，用于 AdsCenterGo）
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_CLIENT_ID=your-oauth-client-id
GOOGLE_ADS_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_CUSTOMER_ID=your-customer-id
```

### AdsPower API 配置

```bash
# AdsPower API（可选，用于 AdsCenterGo）
ADSPOWER_API_URL=http://localhost:50325
ADSPOWER_API_TOKEN=your-adspower-token
```

## 邮件服务配置

```bash
# 邮件服务（可选，用于通知）
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
EMAIL_FROM=noreply@autoads.dev

# 可选配置
EMAIL_SECURE=true
EMAIL_TLS=true
```

## 监控和日志配置

```bash
# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=/var/log/autoads/app.log
LOG_MAX_SIZE=100m
LOG_MAX_FILES=10

# 监控配置
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_PATH=/api/health
```

## 安全配置

```bash
# 安全头部
SECURITY_FRAME_OPTIONS=DENY
SECURITY_XSS_PROTECTION=1; mode=block
SECURITY_CONTENT_TYPE=nosniff
SECURITY_HSTS_MAX_AGE=31536000
SECURITY_HSTS_INCLUDE_SUBDOMAINS=true

# CORS 配置
CORS_ORIGIN=https://www.autoads.dev
CORS_CREDENTIALS=true

# 速率限制
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

## Puppeteer/Chrome 配置

```bash
# Puppeteer 配置（用于批量访问）
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
CHROME_BIN=/usr/bin/chromium-browser

# 浏览器配置
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage
```

## GoFly 配置（Go 版本）

```bash
# Go 应用配置
GO_ENV=production
GO_APP_PORT=8080
GO_APP_HOST=0.0.0.0

# GoFly 特定配置
GOFLY_ADMIN_PORT=8081
GOFLY_ADMIN_SECRET=your-gofly-secret
GOFLY_DB_AUTO_MIGRATE=true
```

## 缓存配置

```bash
# 应用缓存
CACHE_TYPE=redis
CACHE_TTL=300
CACHE_PREFIX=app:prod

# 静态资源缓存
STATIC_CACHE_TTL=86400
BROWSER_CACHE_TTL=3600
```

## 业务规则配置

```bash
# Token 配置
TOKEN_DEFAULT_BALANCE=1000
TOKEN_CONSUMPTION_ENABLED=true
TOKEN_REFUND_ON_FAILURE=true

# 套餐配置
TRIAL_PERIOD_DAYS=14
INVITE_REWARD_DAYS=30
MAX_TRIAL_DAYS=365

# 任务配置
MAX_CONCURRENT_TASKS=50
TASK_TIMEOUT=3600
TASK_CLEANUP_INTERVAL=86400
```

## 生产环境最小配置示例

以下是生产环境的最小必需配置（所有可选参数使用默认值）：

```bash
# .env.production

# 基础配置
NODE_ENV=production
NEXT_PUBLIC_DEPLOYMENT_ENV=production
NEXT_PUBLIC_DOMAIN=autoads.dev
NEXTAUTH_SECRET=your-very-secure-secret-here
NEXTAUTH_URL=https://www.autoads.dev

# 数据库
DATABASE_URL=mysql://user:pass@host:3306/dbname?sslmode=require

# Redis
REDIS_URL=redis://user:pass@host:6379/0

# 认证
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
JWT_SECRET=your-jwt-secret-here

# 第三方服务
SIMILARWEB_API_KEY=your-similarweb-key
```

## 环境检查清单

部署前请确认以下配置：

- [ ] 所有必需的环境变量已设置
- [ ] 密码和密钥已更改为强随机值
- [ ] 数据库连接字符串包含 SSL 模式
- [ ] 生产环境域名正确配置
- [ ] OAuth 客户端 ID 和 Secret 已更新
- [ ] 所有 API 密钥已申请并配置
- [ ] 敏感信息已从代码中移除
- [ ] 环境变量文件权限已设置为 600

## 安全注意事项

1. **密钥管理**：所有密钥和密码必须使用强随机值生成
2. **权限控制**：环境变量文件应仅对应用用户可读（权限 600）
3. **敏感信息**：切勿将生产环境的密钥提交到版本控制系统
4. **定期轮换**：建议定期更换 API 密钥和 JWT 密钥
5. **监控告警**：配置密钥泄露监控和异常访问告警

## 配置验证

应用启动时会自动验证以下配置：

- 必需的环境变量是否已设置
- 数据库连接是否可用
- Redis 连接是否正常
- JWT 密钥强度是否足够
- 域名配置是否正确

## 故障排查

常见配置问题：

1. **数据库连接失败**：检查 DATABASE_URL 格式和网络连通性
2. **Redis 连接失败**：检查 REDIS_URL 和 Redis 服务状态
3. **OAuth 回调失败**：检查重定向 URL 是否在白名单中
4. **JWT 验证失败**：确认前端和后端使用相同的 JWT_SECRET
5. **CORS 错误**：确保 CORS_ORIGIN 包含前端域名

## 联系方式

如遇配置问题，请联系技术支持：
- 邮箱：support@autoads.dev
- 紧急联系：系统管理员
