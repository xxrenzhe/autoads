# AutoAds SaaS（GoFly 架构）

统一构建与部署使用 `Dockerfile.gofly`，由 Go 服务统一暴露 API 与健康检查，内置静态资源（若未嵌入将回退到 `./web` 目录）。Redis 为必选依赖，MySQL 为业务数据存储。

## 快速开始（本地）

1) 准备配置（任选其一）

- 配置文件：`gofly_admin_v3/config.yaml`（确保 `redis.enable: true`，并配置 MySQL/Redis 连接）
- 或环境变量：`AUTH_SECRET`、数据库与 Redis 连接等

2) 构建镜像（Go + 静态）

```bash
docker build -f Dockerfile.gofly -t autoads:dev .
```

3) 运行容器

```bash
docker run --rm -p 8888:8888 \
  -e AUTH_SECRET=your_jwt_secret \
  -e APP_ENV=local \
  -v $(pwd)/gofly_admin_v3/config.yaml:/app/config.yaml:ro \
  autoads:dev
```

4) 健康检查

- 存活：`GET http://localhost:8888/api/health`
- DB 检查：`GET http://localhost:8888/api/health/v2`

## CI/CD 与镜像

- GitHub Actions 构建统一使用 `Dockerfile.gofly`：
  - `main` → `ghcr.io/<org>/autoads:preview-latest`
  - `production` → `ghcr.io/<org>/autoads:prod-latest`
  - 打 tag（如 v3.0.0）→ `ghcr.io/<org>/autoads:prod-v3.0.0`

## 运行时要点

- Redis 为必选项：应用启动时强制校验 Redis 连接
- 端口：对外统一暴露 `8888`
- 限流：全局 `/api/*` 路由 100 req/min（优先 Redis，回退内存）
- 日志：输出 JSON 结构化日志与关键操作审计日志

## 环境变量清单（最小必需）

注意：数据库与 Redis 建议通过 `gofly_admin_v3/config.yaml` 配置；下列环境变量用于应用运行期的核心行为控制。

- 核心
  - `AUTH_SECRET`（必填）JWT 签名密钥（长度建议 ≥32）
  - `APP_ENV`（可选）运行环境标识，如 `local/preview/production`

- 管理后台
  - `ADMIN_USER`（可选，默认 `admin`）管理员账号（Basic Auth）
  - `ADMIN_PASS`（可选，默认 `admin123`）管理员密码（Basic Auth）

- SiteRank/第三方
  - `SIMILARWEB_API_URL`（可选，默认 `https://data.similarweb.com/api/v1/data`）SimilarWeb 免费接口地址

- 前端标识（用于 SEO/静态资源标识，可选）
  - `NEXT_PUBLIC_DEPLOYMENT_ENV`（`preview/production/local`）
  - `NEXT_PUBLIC_DOMAIN`（如 `urlchecker.dev`、`autoads.dev`）

示例（本地运行）：

```bash
export AUTH_SECRET="change_me_to_a_long_random_string"
export ADMIN_USER="admin"
export ADMIN_PASS="strong_password"
export SIMILARWEB_API_URL="https://data.similarweb.com/api/v1/data"
```

## 烟囱测试

```bash
BASE_URL=http://localhost:8888 AUTH="Bearer <token>" ./scripts/smoke-api.sh
```

## 目录

- `gofly_admin_v3/`：Go 服务（路由、模块、健康、限流等）
- `Dockerfile.gofly`：统一构建文件（Go + 静态）
- `.github/workflows/`：CI/CD 工作流（已切换至 Dockerfile.gofly）
- `scripts/`：部署/联调/测试脚本（如 `smoke-api.sh`）
