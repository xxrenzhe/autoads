#!/usr/bin/env sh
set -e

APP_DIR="/app/gofly_admin_v3"
CONFIG_PATH="${ADMIN_CONFIG:-$APP_DIR/config.yaml}"
PORT="${PORT:-8080}"
NEXT_DIR="/app/frontend"
PRISMA_SCHEMA="/app/frontend/prisma/schema.prisma"
NEXTJS_PORT="${NEXTJS_PORT:-3000}"
PUPPETEER_EXECUTOR_PORT="${PUPPETEER_EXECUTOR_PORT:-8081}"
ADSCENTER_EXECUTOR_PORT="${ADSCENTER_EXECUTOR_PORT:-8082}"

# 生产环境默认强制启用内部 JWT 验签（可通过显式设置覆盖）
if [ -z "${INTERNAL_JWT_ENFORCE}" ]; then
  if [ "${NEXT_PUBLIC_DEPLOYMENT_ENV}" = "production" ] || [ "${NODE_ENV}" = "production" ]; then
    export INTERNAL_JWT_ENFORCE=true
    echo "[entrypoint] INTERNAL_JWT_ENFORCE=true (production default)"
  fi
fi

echo "[entrypoint] 使用配置: $CONFIG_PATH"

if [ ! -f "$CONFIG_PATH" ]; then
  if [ -f "$APP_DIR/config.yaml.template" ]; then
    echo "[entrypoint] 未找到配置，使用模板生成: $APP_DIR/config.yaml"
    # 直接复制主配置模板（不替换，避免清空其他占位变量）
    cp "$APP_DIR/config.yaml.template" "$APP_DIR/config.yaml"
    CONFIG_PATH="$APP_DIR/config.yaml"
  else
    echo "[entrypoint] 未找到配置文件也未找到模板，尝试仅用环境变量运行"
  fi
fi

# 渲染 resource/config.yaml（仅替换与域名相关的变量）
if [ -f "$APP_DIR/resource/config.yaml.template" ]; then
  echo "[entrypoint] 发现 resource 配置模板，准备渲染域名相关变量"
  : "${NEXT_PUBLIC_DOMAIN:=${DOMAIN}}"
  if [ -z "$ALLOW_ORIGINS" ] && [ -n "$NEXT_PUBLIC_DOMAIN" ]; then
    # 根据域名生成允许的来源列表（含 www 前缀）
    base_domain="$NEXT_PUBLIC_DOMAIN"
    www_domain="www.$NEXT_PUBLIC_DOMAIN"
    # 仅注入域名元信息，不处理301跳转
    ALLOW_ORIGINS="https://$base_domain,https://$www_domain"
  fi
  if [ -z "$GOOGLE_REDIRECT_URI" ] && [ -n "$NEXT_PUBLIC_DOMAIN" ]; then
    GOOGLE_REDIRECT_URI="https://www.$NEXT_PUBLIC_DOMAIN/auth/google/callback"
  fi
  # envsubst 仅替换与域名相关的变量，避免清空其他占位符
  if command -v envsubst >/dev/null 2>&1; then
    echo "[entrypoint] 渲染 resource/config.yaml (ALLOW_ORIGINS, GOOGLE_REDIRECT_URI)"
    VARS='${ALLOW_ORIGINS} ${GOOGLE_REDIRECT_URI}'
    envsubst "$VARS" < "$APP_DIR/resource/config.yaml.template" > "$APP_DIR/resource/config.yaml"
  else
    echo "[entrypoint] 警告: 未找到 envsubst，跳过 resource/config.yaml 渲染"
    cp "$APP_DIR/resource/config.yaml.template" "$APP_DIR/resource/config.yaml"
  fi
fi

# 执行数据库迁移（Go 后端 + Prisma）
echo "[entrypoint] 执行数据库迁移 (Go) ..."
"$APP_DIR/server" -migrate -config="$CONFIG_PATH" || true

# Prisma 迁移（仅当检测到 schema 与 DATABASE_URL 存在时执行）
if [ -f "$PRISMA_SCHEMA" ]; then
  if [ -n "$DATABASE_URL" ]; then
    echo "[entrypoint] 执行 Prisma 迁移: prisma migrate deploy"
    # 使用全局 prisma CLI，schema 指定到 Next 应用内
    if ! prisma migrate deploy --schema "$PRISMA_SCHEMA"; then
      echo "[entrypoint] ⚠️ Prisma 迁移失败"
      if [ "$PRISMA_DB_PUSH_FALLBACK" = "true" ]; then
        echo "[entrypoint] 尝试回退到 prisma db push（仅用于开发/临时环境）"
        prisma db push --accept-data-loss --schema "$PRISMA_SCHEMA" || true
      fi
    fi
  else
    echo "[entrypoint] 跳过 Prisma 迁移：未设置 DATABASE_URL"
  fi
else
  echo "[entrypoint] 跳过 Prisma 迁移：未找到 $PRISMA_SCHEMA"
fi

# 启动 Next.js 前端（若存在构建产物）
if [ -f "$NEXT_DIR/server.js" ]; then
  echo "[entrypoint] 启动 Next.js 前端: 端口=$NEXTJS_PORT"
  (
    cd "$NEXT_DIR" && \
    PORT="$NEXTJS_PORT" HOSTNAME="${HOSTNAME:-0.0.0.0}" node server.js >/dev/null 2>&1 &
  ) || echo "[entrypoint] ⚠️ 启动 Next.js 失败，但继续启动后端"
else
  echo "[entrypoint] 未检测到 Next.js standalone 产物，跳过前端启动"
fi

echo "[entrypoint] 启动服务..."

# 启动本地执行器（Puppeteer / AdsCenter），仅当未显式设置外部 URL 时启动本地版本
if [ -z "$PUPPETEER_EXECUTOR_URL" ]; then
  export PUPPETEER_EXECUTOR_URL="http://127.0.0.1:${PUPPETEER_EXECUTOR_PORT}"
  echo "[entrypoint] 启动本地 Playwright 执行器: $PUPPETEER_EXECUTOR_URL"
  ( node /app/executors/puppeteer-server.js >/dev/null 2>&1 & ) || echo "[entrypoint] ⚠️ 启动 Playwright 执行器失败"
fi
if [ -z "$ADSCENTER_EXECUTOR_URL" ]; then
  export ADSCENTER_EXECUTOR_URL="http://127.0.0.1:${ADSCENTER_EXECUTOR_PORT}"
  echo "[entrypoint] 启动本地 AdsCenter 执行器: $ADSCENTER_EXECUTOR_URL"
  ( node /app/executors/adscenter-update-server.js >/dev/null 2>&1 & ) || echo "[entrypoint] ⚠️ 启动 AdsCenter 执行器失败"
fi

exec "$APP_DIR/server" -config="$CONFIG_PATH" -port="$PORT"
