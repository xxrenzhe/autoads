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
# SimilarWeb API
# 情况A：使用无需鉴权的公开端点（默认）
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data

# 情况B：使用需要鉴权的企业端点（可选）
# 如果你的供应商需要 apikey/Authorization，请将 SIMILARWEB_API_URL 指向内部网关，
# 由网关统一注入密钥后再转发至 SimilarWeb 官方服务。
# SIMILARWEB_API_URL=https://gw.example.com/sw/api/v1/data
# SIMILARWEB_API_KEY=your-similarweb-api-key   # 仅供网关或上游使用，Go 客户端默认不直带 key

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

### BFF / 就绪守门配置

```bash
# BFF 统一转发到 Go 后端
BACKEND_URL=http://127.0.0.1:8080
BFF_MAX_BODY=2097152
BFF_UPSTREAM_TIMEOUT_MS=15000
BFF_READY_TIMEOUT_MS=1200
BFF_READY_TTL_MS=3000

# 管理端反向代理（/ops/*）
BACKEND_PROXY_MAX_BODY=2097152
BACKEND_PROXY_TIMEOUT_MS=15000
# 允许通过 /ops 访问的后端子路径前缀
ADMIN_PROXY_ALLOW_PREFIXES=/console,/console/assets,/console/panel,/console/login,/api/v1/console

> 说明：仓库已内置 Next Route Handler 作为管理网关：`/ops/:path*` → `BACKEND_URL/:path*`。
> - 仅放行 `/console/*` 与 `/api/v1/console/*`（以及 `/admin/*` 兼容路径），权限由 Go 端 `AdminJWT` 判断。
> - 生产仍建议在外部网关层做精细化限流/黑白名单；内置代理用于快速落地与本地验证。
```

## 浏览器执行器与国家代理映射（生产）

单镜像部署：容器内会同时运行 Go 后端、Next.js BFF，以及本地浏览器执行器（Playwright）。默认绑定 127.0.0.1，不对外暴露。

- 执行器路由（容器内）：
  - `GET /resolve?url=...&country=US[&proxy=...]` 返回最终 URL（移除 Referer，跟随多重重定向）
  - `GET /health` 健康检查；`GET /metrics` 简要指标

- 环境变量（按国家选择代理）：
  ```bash
  # 浏览器执行器 URL（容器内自动设置为本地）
  PUPPETEER_EXECUTOR_URL=http://127.0.0.1:8081

  # 按国家映射代理（JSON）和默认代理（可选）
  PUPPETEER_PROXY_BY_COUNTRY='{"US":"http://user:pass@us-proxy:8080","DE":"socks5://de-proxy:1080"}'
  PUPPETEER_PROXY_DEFAULT='http://user:pass@default-proxy:8080'

  # 建议在任务中为每个链接指定 country；不再推荐使用全局国家/代理环境变量
  ```

- 任务侧传参（后端会优先使用任务内传参）：
  - 全局默认国家：`country`（字符串）
  - 每条链接国家：`links[{ affiliate_url, country }]`（优先级高于 `country`）

- Referer 策略：执行器对所有请求移除 `Referer` 头，确保为空。

安全建议（代理鉴权与出口合规）
- 代理鉴权
  - 使用专用的代理账号，不与其他系统复用；按国家划分独立凭据便于吊销与审计
  - 避免在日志中输出带鉴权的代理 URL；如需记录有效代理，仅记录主机与端口（已在执行器返回中仅回显 `effectiveProxy`，不包含凭据）
  - 建议通过平台 Secret 管理（K8s Secret、CI/CD Secret Store）注入代理凭据

- 出口合规
  - 仅允许容器对外访问“代理网关”和业务目标域名；优先通过安全组/防火墙/Service Mesh 限制 egress
  - 代理出口 IP 建立白名单；必要时在代理侧做目的域细粒度限制
  - TLS 合规：避免 MITM；如企业代理需要 TLS 终止/再加密，确保证书链合规并做好内部 CA 管理
  - 控制并发与速率：通过环境变量调整执行器的并发、队列和节流，避免触发对端风控

- 隔离与最小暴露
  - 执行器仅监听 `127.0.0.1`；不要把执行器端口直接对外暴露
  - 运行时加固：Chromium 使用 `--no-sandbox` 仅限容器隔离完善的环境；生产建议开启 seccomp/AppArmor，并限定容器能力

可观测性与运维
- 通过 `GET /metrics` 获取执行器近期 p95 延迟、队列长度和分类统计；可被 Prometheus 抓取（建议通过 sidecar/agent 拉取并聚合）
- 通过 `/api/v1/adscenter/metrics` 查看后端的“任务分布、分阶段耗时、错误分类”聚合数据

常见配置示例（Docker/K8s）
```bash
# docker-compose 片段
environment:
  - PUPPETEER_EXECUTOR_URL=http://127.0.0.1:8081
  - PUPPETEER_PROXY_BY_COUNTRY={"US":"http://user:pass@us-proxy:8080","GB":"http://user:pass@gb-proxy:8080"}
  - PUPPETEER_PROXY_DEFAULT=http://user:pass@default-proxy:8080
  #（已不推荐）ADSCENTER_COUNTRY：请在任务的每条链接上明确 country，而非使用全局环境变量
  - NODE_TLS_REJECT_UNAUTHORIZED=1
``` 


### Internal JWT（Next → Go 身份贯通）

```bash
# Next 用于签发内部 JWT 的 RSA 私钥（PEM 格式，多行需转义）
INTERNAL_JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
INTERNAL_JWT_ISS=autoads-next
INTERNAL_JWT_AUD=internal-go
INTERNAL_JWT_TTL_SECONDS=120

# Go 端验证同一对公钥（在 Go 应用环境中）
# INTERNAL_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
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
