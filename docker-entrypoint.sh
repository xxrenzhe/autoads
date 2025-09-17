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

# Next.js 启动函数（确保日志与就绪探测）
start_next() {
  local dir="$1"
  echo "[entrypoint] 准备启动 Next（dir=$dir, port=$NEXTJS_PORT）"
  mkdir -p /app/logs || true
  (
    cd "$dir" && PORT="$NEXTJS_PORT" HOSTNAME="0.0.0.0" node server.js > /app/logs/next.log 2>&1 &
  ) || return 1
  # 就绪探测，最多 10 秒
  for i in $(seq 1 20); do
    code=$(curl -sS -o /dev/null -m 0.5 -w "%{http_code}" "http://127.0.0.1:${NEXTJS_PORT}/" || echo 000)
    if [ "$code" != "000" ]; then
      echo "[entrypoint] Next.js 已就绪: http://127.0.0.1:${NEXTJS_PORT} (code=$code)"
      return 0
    fi
    sleep 0.5
  done
  echo "[entrypoint] ⚠️ Next.js 未在端口 ${NEXTJS_PORT} 就绪，最近日志："
  tail -n 120 /app/logs/next.log || true
  # 常见问题：Prisma 引擎不匹配，尝试按运行时生成
  if grep -q "Prisma Client could not locate the Query Engine" /app/logs/next.log 2>/dev/null; then
    if [ -f "$PRISMA_SCHEMA" ] && command -v prisma >/dev/null 2>&1; then
      echo "[entrypoint] 发现 Prisma 引擎错误，尝试 prisma generate（运行时平台）"
      prisma generate --schema "$PRISMA_SCHEMA" || echo "[entrypoint] Prisma generate 失败"
      (
        cd "$dir" && PORT="$NEXTJS_PORT" HOSTNAME="0.0.0.0" node server.js > /app/logs/next.log 2>&1 &
      ) || true
      sleep 1
      code=$(curl -sS -o /dev/null -m 1 -w "%{http_code}" "http://127.0.0.1:${NEXTJS_PORT}/" || echo 000)
      echo "[entrypoint] Prisma 修复后 Next.js 端口检查: code=$code"
      [ "$code" != "000" ] && return 0
    fi
  fi
  return 1
}

# 生产环境默认强制启用内部 JWT 验签（可通过显式设置覆盖）
if [ -z "${INTERNAL_JWT_ENFORCE}" ]; then
  if [ "${NEXT_PUBLIC_DEPLOYMENT_ENV}" = "production" ] || [ "${NODE_ENV}" = "production" ]; then
    export INTERNAL_JWT_ENFORCE=true
    echo "[entrypoint] INTERNAL_JWT_ENFORCE=true (production default)"
  fi
fi

echo "[entrypoint] 使用配置: $CONFIG_PATH"

# 若 CONFIG_MODE=env，则跳过主配置文件生成，完全依赖环境变量
if [ "$CONFIG_MODE" = "env" ]; then
  echo "[entrypoint] CONFIG_MODE=env，跳过 config.yaml 生成，使用环境变量配置"
else
  if [ ! -f "$CONFIG_PATH" ]; then
    if [ -f "$APP_DIR/config.yaml.template" ]; then
      echo "[entrypoint] 未找到配置，使用模板生成: $CONFIG_PATH"
      # 确保目标目录存在
      mkdir -p "$(dirname "$CONFIG_PATH")" || true
      # 直接复制主配置模板（不替换，避免清空其他占位变量）
      if ! cp "$APP_DIR/config.yaml.template" "$CONFIG_PATH" 2>/dev/null; then
        echo "[entrypoint] 警告: 无法写入 $CONFIG_PATH（可能是挂载为只读或无权限）"
        # 回退到 /tmp，保证容器仍可启动；建议通过 ADMIN_CONFIG 指向可写挂载路径
        FALLBACK_PATH="/tmp/config.yaml"
        if cp "$APP_DIR/config.yaml.template" "$FALLBACK_PATH" 2>/dev/null; then
          CONFIG_PATH="$FALLBACK_PATH"
          echo "[entrypoint] 已回退到临时配置: $CONFIG_PATH"
        else
          echo "[entrypoint] 错误: 无法创建配置文件（包括回退路径）。请检查卷挂载与写入权限。"
        fi
      fi
    else
      echo "[entrypoint] 未找到配置文件也未找到模板，尝试仅用环境变量运行"
    fi
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
  # 确保 resource 目录存在
  mkdir -p "$APP_DIR/resource" || true
  if command -v envsubst >/dev/null 2>&1; then
    echo "[entrypoint] 渲染 resource/config.yaml (ALLOW_ORIGINS, GOOGLE_REDIRECT_URI)"
    VARS='${ALLOW_ORIGINS} ${GOOGLE_REDIRECT_URI}'
    envsubst "$VARS" < "$APP_DIR/resource/config.yaml.template" > "$APP_DIR/resource/config.yaml"
  else
    echo "[entrypoint] 警告: 未找到 envsubst，跳过 resource/config.yaml 渲染"
    cp "$APP_DIR/resource/config.yaml.template" "$APP_DIR/resource/config.yaml"
  fi
fi

# 无条件尝试启动 Next（最简逻辑）；失败不阻塞后续
echo "[entrypoint] 启动 Next.js 前端: 端口=$NEXTJS_PORT"
start_next "$NEXT_DIR" && touch /tmp/.next_started || echo "[entrypoint] ⚠️ Next 早期启动失败（查看 /app/logs/next.log）"

# 可选：仅在首次启动时执行完整初始化（重建库），避免重复执行破坏数据
if [ "${DB_REBUILD_ON_STARTUP}" = "true" ] || [ "${DB_REBUILD_ON_STARTUP}" = "1" ]; then
  MARK_DIR="/app/logs"
  MARK_FILE="$MARK_DIR/.db_rebuild_done"
  mkdir -p "$MARK_DIR" || true
  if [ ! -f "$MARK_FILE" ]; then
    echo "[entrypoint] 检测到 DB_REBUILD_ON_STARTUP 标记，首次执行一次性数据库初始化"
    # Initialize database schema + baseline data (idempotent; runs once by marker)
    if ! "$APP_DIR/server" -init-db -config="$CONFIG_PATH"; then
      echo "[entrypoint] ⚠️ 一次性数据库初始化失败（继续尝试常规迁移）"
    else
      date > "$MARK_FILE" || true
    fi
  else
    echo "[entrypoint] 跳过一次性数据库初始化：标记已存在 $MARK_FILE"
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

    # 可选：执行 Prisma Seed（仅在显式设置 PRISMA_DB_SEED=true 时执行）
    if [ "$PRISMA_DB_SEED" = "true" ]; then
      echo "[entrypoint] 执行 Prisma 数据种子: prisma db seed"
      prisma db seed --schema "$PRISMA_SCHEMA" || echo "[entrypoint] ⚠️ Prisma seed 失败，继续启动"
    fi
  else
    echo "[entrypoint] 跳过 Prisma 迁移：未设置 DATABASE_URL"
  fi
else
  echo "[entrypoint] 跳过 Prisma 迁移：未找到 $PRISMA_SCHEMA"
fi

# 仅保留一次尝试，避免多重分支与重复日志

echo "[entrypoint] 启动服务..."

# 启动本地执行器（Puppeteer / AdsCenter），仅当未显式设置外部 URL 时启动本地版本
if [ -z "$PUPPETEER_EXECUTOR_URL" ]; then
  export PUPPETEER_EXECUTOR_URL="http://127.0.0.1:${PUPPETEER_EXECUTOR_PORT}"
  echo "[entrypoint] 启动本地 Playwright 执行器: $PUPPETEER_EXECUTOR_URL"
  ( node /app/executors/puppeteer-server.js >/dev/null 2>&1 & ) || echo "[entrypoint] ⚠️ 启动 Playwright 执行器失败"
fi
# 兼容别名：为空则同步浏览器执行器URL
if [ -z "$ADSCENTER_EXECUTOR_URL" ]; then
  export ADSCENTER_EXECUTOR_URL="http://127.0.0.1:${ADSCENTER_EXECUTOR_PORT}"
  echo "[entrypoint] 启动本地 AdsCenter 执行器: $ADSCENTER_EXECUTOR_URL"
  ( node /app/executors/adscenter-update-server.js >/dev/null 2>&1 & ) || echo "[entrypoint] ⚠️ 启动 AdsCenter 执行器失败"
fi

exec "$APP_DIR/server" -config="$CONFIG_PATH" -port="$PORT"
