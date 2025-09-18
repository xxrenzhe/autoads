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

# 自动修正 Prisma 的 DATABASE_URL：当缺少库名或指向系统库时，拼接业务库名
auto_fix_prisma_url() {
  [ "${PRISMA_AUTO_FIX_DB:-true}" = "true" ] || return 0
  # 若未设置 DATABASE_URL，则尝试通过环境变量构造
  # 若设置了但缺少路径或指向 mysql/information_schema，则改写为业务数据库
  local url="$DATABASE_URL"
  local dbname="${DB_DATABASE:-}"
  # 若未提供 DB_DATABASE，则尝试从配置文件读取 database.database 字段
  if [ -z "$dbname" ] && [ -f "$CONFIG_PATH" ]; then
    # 解析 YAML：进入顶层 database: 块后，读取其中的字段 database: 的值
    dbname=$(awk '
      /^[[:space:]]*database:[[:space:]]*$/ { in_db=1; next }
      in_db==1 && /^[[:space:]]*database:[[:space:]]*/ {
        line=$0
        sub(/^[[:space:]]*database:[[:space:]]*/, "", line)
        gsub(/"/, "", line)
        gsub(/[[:space:]]+$/, "", line)
        print line
        exit
      }
      in_db==1 && /^[^[:space:]]/ { in_db=0 }
    ' "$CONFIG_PATH" 2>/dev/null | head -n1)
  fi
  if [ -z "$dbname" ]; then
    return 0
  fi
  # 尝试从 DATABASE_URL 提取路径
  if [ -n "$url" ]; then
    case "$url" in
      mysql://*)
        local path
        path=$(printf "%s" "$url" | sed -n 's#^mysql://[^/]\+/?\([^?]*\).*#\1#p')
        # 当无路径或指向系统库时，替换为业务库
        if [ -z "$path" ] || [ "$path" = "mysql" ] || [ "$path" = "information_schema" ]; then
          local base qs
          base=$(printf "%s" "$url" | sed -E 's#(mysql://[^/]+).*#\1#')
          qs=$(printf "%s" "$url" | sed -n 's#^[^?]*\(\?[^#]*\)$#\1#p')
          export DATABASE_URL="${base}/${dbname}${qs}"
          echo "[entrypoint] Prisma DATABASE_URL 已自动指向业务库（内部覆盖），确保迁移与运行时一致"
        fi
        ;;
      *) ;;
    esac
  else
    # 未设置 DATABASE_URL，尝试基于环境变量拼接
    if [ -n "$DB_USERNAME" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
      export DATABASE_URL="mysql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${dbname}"
      echo "[entrypoint] Prisma DATABASE_URL 已根据环境变量自动生成（内部覆盖）"
    fi
  fi
}

# Next.js 启动函数（确保日志与就绪探测）
start_next() {
  local dir="$1"
  echo "[entrypoint] 准备启动 Next（dir=$dir, port=$NEXTJS_PORT）"
  mkdir -p /app/logs || true
  (
    cd "$dir" && \
    if [ "$NEXT_LOG_TO_STDOUT" = "true" ]; then \
      PORT="$NEXTJS_PORT" HOSTNAME="0.0.0.0" node server.js 2>&1 | tee -a /app/logs/next.log & \
    else \
      PORT="$NEXTJS_PORT" HOSTNAME="0.0.0.0" node server.js >> /app/logs/next.log 2>&1 & \
    fi
  ) || return 1
  # 就绪探测，最多 10 秒（仅 2xx/3xx 视为成功；修复 000000 误判）
  for i in $(seq 1 20); do
    resp=$(curl -s -o /dev/null -m 1 -w "%{http_code}" "http://127.0.0.1:${NEXTJS_PORT}/" 2>/dev/null || true)
    case "$resp" in
      2??|3??)
        echo "[entrypoint] Next.js 已就绪: http://127.0.0.1:${NEXTJS_PORT} (code=$resp)"
        return 0 ;;
    esac
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
      resp=$(curl -s -o /dev/null -m 1 -w "%{http_code}" "http://127.0.0.1:${NEXTJS_PORT}/" 2>/dev/null || true)
      case "$resp" in
        2??|3??)
          echo "[entrypoint] Prisma 修复后 Next.js 端口检查: code=$resp"
          return 0 ;;
      esac
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

# 在启动 Next 之前，尝试自动修正 Prisma 的 DATABASE_URL，避免迁移与运行时连接到系统库
auto_fix_prisma_url || true

# 打印已解析的 Prisma 连接（脱敏），便于排查是否误连到 system DB
if [ -n "$DATABASE_URL" ]; then
  case "$DATABASE_URL" in
    mysql://*)
      base=$(printf "%s" "$DATABASE_URL" | sed -E 's#^mysql://([^/@]+)@([^/:]+)(:[0-9]+)?/([^?]+).*#\2\3/\4#')
      echo "[entrypoint] Prisma 目标: mysql://${base}"
      ;;
  esac
fi

# 严格启动 Next（提前且必须成功）
echo "[entrypoint] 启动 Next.js 前端: 端口=$NEXTJS_PORT"
start_next "$NEXT_DIR" || { echo "[entrypoint] ❌ Next 启动失败，退出"; exit 1; }


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

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
  # 执行数据库迁移（Go 后端 + Prisma）
  echo "[entrypoint] 执行数据库迁移 (Go) ..."
  # 传入 -port 与最终运行端口保持一致，避免旧版本在 -migrate 后继续监听到默认 8888 端口
  # 为避免极端情况下 -migrate 阶段阻塞启动，这里加超时与日志文件
  MIGRATE_TIMEOUT="${MIGRATE_TIMEOUT:-90}"
  mkdir -p /app/logs >/dev/null 2>&1 || true
  MIGRATE_LOG="/app/logs/go-migrate.log"
  rm -f "$MIGRATE_LOG" 2>/dev/null || true
  "$APP_DIR/server" -migrate -config="$CONFIG_PATH" -port="$PORT" >"$MIGRATE_LOG" 2>&1 &
  MIG_PID=$!
  end_ts=$(( $(date +%s) + MIGRATE_TIMEOUT ))
  while kill -0 "$MIG_PID" 2>/dev/null; do
    if [ $(date +%s) -ge $end_ts ]; then
      echo "[entrypoint] ⚠️ Go 迁移执行超过 ${MIGRATE_TIMEOUT}s，尝试终止并继续启动（请检查 $MIGRATE_LOG）"
      kill "$MIG_PID" 2>/dev/null || true
      sleep 1
      kill -9 "$MIG_PID" 2>/dev/null || true
      break
    fi
    sleep 1
  done
  # 收集退出码（若已被 kill -9，wait 也会返回非零，继续启动即可）
  wait "$MIG_PID" 2>/dev/null || true
  echo "[entrypoint] 迁移日志（最近120行）："
  tail -n 120 "$MIGRATE_LOG" 2>/dev/null || true
else
  echo "[entrypoint] 跳过 Go 迁移（RUN_MIGRATIONS_ON_START=false）"
fi

# Prisma 迁移（仅当检测到 schema 与 DATABASE_URL 存在时执行）
if [ -f "$PRISMA_SCHEMA" ]; then
  if [ -n "$DATABASE_URL" ]; then
    echo "[entrypoint] 执行 Prisma 迁移: prisma migrate deploy"
    # 使用全局 prisma CLI，schema 指定到 Next 应用内
    PRISMA_OUTPUT=$(prisma migrate deploy --schema "$PRISMA_SCHEMA" 2>&1) || DEPLOY_RC=$?
    if [ -n "$DEPLOY_RC" ] && [ "$DEPLOY_RC" -ne 0 ]; then
      echo "$PRISMA_OUTPUT"
      echo "[entrypoint] ⚠️ Prisma 迁移失败"
      # 自动基线：当数据库非空（P3005）且仅有一个迁移时，标记该迁移为已应用
      if printf "%s" "$PRISMA_OUTPUT" | grep -q "P3005"; then
        : "${PRISMA_AUTO_BASELINE:=true}"
        if [ "$PRISMA_AUTO_BASELINE" = "true" ]; then
          MIG_DIR="$(dirname "$PRISMA_SCHEMA")/migrations"
          if [ -d "$MIG_DIR" ]; then
            MIG_COUNT=$(find "$MIG_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
            if [ "$MIG_COUNT" -eq 1 ]; then
              FIRST_MIG=$(basename "$(find "$MIG_DIR" -mindepth 1 -maxdepth 1 -type d | head -n1)")
              echo "[entrypoint] 检测到 P3005 且仅有 1 个迁移，执行基线标记: $FIRST_MIG"
              if prisma migrate resolve --schema "$PRISMA_SCHEMA" --applied "$FIRST_MIG"; then
                echo "[entrypoint] 重试 Prisma 迁移: prisma migrate deploy"
                prisma migrate deploy --schema "$PRISMA_SCHEMA" || echo "[entrypoint] ⚠️ 重试 prisma migrate deploy 仍失败"
              else
                echo "[entrypoint] ⚠️ Prisma 基线标记失败，请手动处理"
              fi
            else
              echo "[entrypoint] ⚠️ 检测到 P3005，但迁移数=$MIG_COUNT，出于安全不自动基线。请手动执行 prisma migrate resolve。"
            fi
          else
            echo "[entrypoint] ⚠️ 检测到 P3005，但未找到迁移目录：$MIG_DIR"
          fi
        else
          echo "[entrypoint] 已禁用自动基线（PRISMA_AUTO_BASELINE=false）"
        fi
      fi
      if [ "$PRISMA_DB_PUSH_FALLBACK" = "true" ]; then
        echo "[entrypoint] 尝试回退到 prisma db push（仅用于开发/临时环境）"
        prisma db push --accept-data-loss --schema "$PRISMA_SCHEMA" || true
      fi
    else
      # 打印成功输出（若有）
      [ -n "$PRISMA_OUTPUT" ] && printf "%s\n" "$PRISMA_OUTPUT" | tail -n +1
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

# 第二次启动前先检测是否已就绪，已就绪则跳过，避免端口占用告警
READY_CODE=$(curl -s -o /dev/null -m 1 -w "%{http_code}" "http://127.0.0.1:${NEXTJS_PORT}/" 2>/dev/null || true)
case "$READY_CODE" in
  2??|3??)
    echo "[entrypoint] Next.js 已在端口 ${NEXTJS_PORT} 运行，跳过重复启动 (code=$READY_CODE)" ;;
  *)
    echo "[entrypoint] 启动 Next.js 前端: 端口=$NEXTJS_PORT"
    start_next "$NEXT_DIR" || { echo "[entrypoint] ❌ Next 启动失败，退出"; exit 1; } ;;
esac

echo "[entrypoint] 启动服务..."

# 启动本地执行器（Puppeteer / AdsCenter），仅当未显式设置外部 URL 时启动本地版本
if [ -z "$PUPPETEER_EXECUTOR_URL" ]; then
  export PUPPETEER_EXECUTOR_URL="http://127.0.0.1:${PUPPETEER_EXECUTOR_PORT}"
  echo "[entrypoint] 启动本地 Playwright 执行器: $PUPPETEER_EXECUTOR_URL"
  mkdir -p /app/logs || true
  if [ "$EXEC_LOG_TO_STDOUT" = "true" ]; then
    ( node /app/executors/puppeteer-server.js 2>&1 | tee -a /app/logs/exec-puppeteer.log & ) || echo "[entrypoint] ⚠️ 启动 Playwright 执行器失败"
  else
    ( node /app/executors/puppeteer-server.js >> /app/logs/exec-puppeteer.log 2>&1 & ) || echo "[entrypoint] ⚠️ 启动 Playwright 执行器失败"
  fi
fi
# 兼容别名：为空则同步浏览器执行器URL
if [ -z "$ADSCENTER_EXECUTOR_URL" ]; then
  export ADSCENTER_EXECUTOR_URL="http://127.0.0.1:${ADSCENTER_EXECUTOR_PORT}"
  echo "[entrypoint] 启动本地 AdsCenter 执行器: $ADSCENTER_EXECUTOR_URL"
  mkdir -p /app/logs || true
  if [ "$EXEC_LOG_TO_STDOUT" = "true" ]; then
    ( node /app/executors/adscenter-update-server.js 2>&1 | tee -a /app/logs/exec-adscenter.log & ) || echo "[entrypoint] ⚠️ 启动 AdsCenter 执行器失败"
  else
    ( node /app/executors/adscenter-update-server.js >> /app/logs/exec-adscenter.log 2>&1 & ) || echo "[entrypoint] ⚠️ 启动 AdsCenter 执行器失败"
  fi
fi

# 在启动 Go 服务前，输出一次后端启动摘要，便于在容器启动日志中直观看到关键信息
echo "[entrypoint] Go 后端启动摘要："
echo "[entrypoint]  - 二进制: $APP_DIR/server"
echo "[entrypoint]  - 配置:   $CONFIG_PATH"
echo "[entrypoint]  - 端口:   $PORT"
echo "[entrypoint]  - 健康检查: http://127.0.0.1:$PORT/health | /readyz"

# 如设置了 BACKEND_URL，检查与端口是否一致，给出提示（用于 Next.js /go 代理对齐）
if [ -n "$BACKEND_URL" ]; then
  # 仅尝试简单解析端口；未显式端口时不强行判定
  BACKEND_URL_PORT=$(printf "%s" "$BACKEND_URL" | sed -n 's#.*://[^:/]*:\([0-9][0-9]*\).*#\1#p')
  echo "[entrypoint]  - BACKEND_URL: $BACKEND_URL"
  if [ -n "$BACKEND_URL_PORT" ] && [ "$BACKEND_URL_PORT" != "$PORT" ]; then
    echo "[entrypoint]  ⚠️ 警告：BACKEND_URL 指向端口 $BACKEND_URL_PORT，与 Go 实际启动端口 $PORT 不一致，/go 代理可能返回 502。"
  fi
else
  echo "[entrypoint]  - BACKEND_URL: (未设置)"
fi

echo "[entrypoint] 正在启动 Go 后端服务..."
exec "$APP_DIR/server" -config="$CONFIG_PATH" -port="$PORT"
