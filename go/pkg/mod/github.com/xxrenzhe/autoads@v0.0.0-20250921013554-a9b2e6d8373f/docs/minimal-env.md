# 最小环境变量清单（首次启动必须）

以下变量为 AutoAds 单镜像首次启动的最小集；未提供的项将导致无法连接基础设施或鉴权失败。

## 必须（基础设施/站点）
- `DATABASE_URL`：MySQL 连接串，例如：
  - `mysql://user:pass@host:3306/autoads?parseTime=true&loc=Local`
- `REDIS_URL`：Redis 连接串，例如：
  - `redis://default:pass@host:6379/0`
- `AUTH_SECRET`：NextAuth/签名密钥（32+ 随机字节）。
- `NEXT_PUBLIC_DOMAIN`：运行域名（preview: `urlchecker.dev`；prod: `autoads.dev`）。
- `NEXT_PUBLIC_DEPLOYMENT_ENV`：`preview` 或 `production`。

## 必须（生产强制，预发/本地可临时关闭强制）
- `INTERNAL_JWT_PUBLIC_KEY`：Go 侧 RSA 公钥（PEM，多行）。
- `INTERNAL_JWT_PRIVATE_KEY`：Next 侧 RSA 私钥（PEM，多行）。
- `INTERNAL_JWT_ENFORCE`：`true|false`，生产必须 `true`。

生成 RSA 示例（OpenSSL）：
```
# 私钥（Next）
openssl genrsa -out private.pem 2048
# 公钥（Go）
openssl rsa -in private.pem -pubout -out public.pem
```

## 建议（第三方登录）
- `AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`、`AUTH_URL`（例：`https://www.<domain>`）。

## 自动推导（未显式设置时由入口脚本生成）
- `ALLOW_ORIGINS = https://<domain>,https://www.<domain>`
- `GOOGLE_REDIRECT_URI = https://www.<domain>/auth/google/callback`

## 端口（默认）
- `PORT=8080`（Go 内部）、`NEXTJS_PORT=3000`（Next，对外仅暴露 3000）。

> 更多细节参考：`docs/ArchitectureOptimization02.md`。

