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

# 打印 Go 二进制版本信息，便于部署时核对镜像是否最新
if [ -x "/app/gofly_admin_v3/server" ]; then
  echo "[entrypoint] Go server version info:"
  /app/gofly_admin_v3/server -version 2>/dev/null || true
fi

# 自动修正 Prisma 的 DATABASE_URL：当缺少库名或指向系统库时，拼接业务库名
auto_fix_prisma_url() {
  [ "${PRISMA_AUTO_FIX_DB:-true}" = "true" ] || return 0
  # 若未设置 DATABASE_URL，则尝试通过配置/环境变量构造
  # 若设置了但缺少路径或指向 mysql/information_schema，则改写为业务数据库
  local url="$DATABASE_URL"
  local dbname="${DB_DATABASE:-}"
  # 1) 从 config.yaml 读取 database.database 作为库名
  if [ -z "$dbname" ] && [ -f "$CONFIG_PATH" ]; then
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
  # 2) 从 config.yaml 读取 host/port/username/password（仅在对应 env 为空时）
  local db_host="$DB_HOST" db_port="$DB_PORT" db_user="$DB_USERNAME" db_pass="$DB_PASSWORD"
  if [ -f "$CONFIG_PATH" ]; then
    eval $(awk '
      /^[[:space:]]*database:[[:space:]]*$/ { in_db=1; next }
      in_db==1 && /^[^[:space:]]/ { in_db=0 }
      in_db==1 {
        if ($1 ~ /^[[:space:]]*host:/)     { sub(/^[[:space:]]*host:[[:space:]]*/, ""); gsub(/"/, ""); print "__Y_HOST=" $0 }
        if ($1 ~ /^[[:space:]]*port:/)     { sub(/^[[:space:]]*port:[[:space:]]*/, ""); gsub(/"/, ""); print "__Y_PORT=" $0 }
        if ($1 ~ /^[[:space:]]*username:/) { sub(/^[[:space:]]*username:[[:space:]]*/, ""); gsub(/"/, ""); print "__Y_USER=" $0 }
        if ($1 ~ /^[[:space:]]*password:/) { sub(/^[[:space:]]*password:[[:space:]]*/, ""); gsub(/"/, ""); print "__Y_PASS=" $0 }
      }
    ' "$CONFIG_PATH" 2>/dev/null)
    [ -z "$db_host" ] && db_host="$__Y_HOST"
    [ -z "$db_port" ] && db_port="$__Y_PORT"
    [ -z "$db_user" ] && db_user="$__Y_USER"
    [ -z "$db_pass" ] && db_pass="$__Y_PASS"
  fi
  # 没有库名直接返回
  if [ -z "$dbname" ]; then
    return 0
  fi
  # 3) 若已有 DATABASE_URL 且缺少库名/指向系统库，则纠正库名
  if [ -n "$url" ]; then
    case "$url" in
      mysql://*)
        local path
        path=$(printf "%s" "$url" | sed -n 's#^mysql://[^/]\+/?\([^?]*\).*#\1#p')
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
    # 4) 未设置 DATABASE_URL，基于配置/环境变量拼接
    if [ -n "$db_user" ] && [ -n "$db_pass" ] && [ -n "$db_host" ] && [ -n "$db_port" ]; then
      export DATABASE_URL="mysql://${db_user}:${db_pass}@${db_host}:${db_port}/${dbname}"
      echo "[entrypoint] Prisma DATABASE_URL 已根据配置自动生成（内部覆盖）"
    elif [ -n "$DB_USERNAME" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
      export DATABASE_URL="mysql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${dbname}"
      echo "[entrypoint] Prisma DATABASE_URL 已根据环境变量自动生成（内部覆盖）"
    fi
  fi
}

# 只执行 Prisma 迁移并退出（用于部署 Job）
if [ "$1" = "prisma-migrate-only" ]; then
  auto_fix_prisma_url || true
  if [ ! -f "$PRISMA_SCHEMA" ]; then
    echo "[entrypoint] 未找到 Prisma schema: $PRISMA_SCHEMA"
    exit 1
  fi
  if [ -z "$DATABASE_URL" ]; then
    echo "[entrypoint] 未能解析 DATABASE_URL（请检查 $CONFIG_PATH 或相关环境变量）"
    exit 2
  fi
  echo "[entrypoint] 以独立模式执行 Prisma 迁移 ..."
  prisma migrate deploy --schema "$PRISMA_SCHEMA"
  exit $?
fi

if [ "$1" = "prisma-migrate-status" ]; then
  auto_fix_prisma_url || true
  if [ ! -f "$PRISMA_SCHEMA" ]; then
    echo "[entrypoint] 未找到 Prisma schema: $PRISMA_SCHEMA"
    exit 1
  fi
  if [ -z "$DATABASE_URL" ]; then
    echo "[entrypoint] 未能解析 DATABASE_URL（请检查 $CONFIG_PATH 或相关环境变量）"
    exit 2
  fi
  echo "[entrypoint] 检查 Prisma 迁移状态 ..."
  prisma migrate status --schema "$PRISMA_SCHEMA" || true
  exit 0
fi

# 基于部署环境自动推导 NextAuth 基准 URL（避免 redirect_uri_mismatch）
auto_set_auth_urls() {
  # 若已显式设置则不覆盖
  if [ -n "$NEXTAUTH_URL" ] && [ -n "$AUTH_URL" ]; then
    return 0
  fi
  # 推导域名
  : "${NEXT_PUBLIC_DOMAIN:=${DOMAIN}}"
  local env="${NEXT_PUBLIC_DEPLOYMENT_ENV:-${NODE_ENV}}"
  local scheme host url
  case "$env" in
    production|preview)
      # 外部有 301 到 www.<domain>，这里直接使用 www 子域
      if [ -n "$NEXT_PUBLIC_DOMAIN" ]; then
        scheme="https"; host="www.${NEXT_PUBLIC_DOMAIN}"
        url="${scheme}://${host}"
      fi
      ;;
    *)
      url="http://127.0.0.1:${NEXTJS_PORT}"
      ;;
  esac
  # 注入（仅当未显式设置时）
  if [ -n "$url" ]; then
    if [ -z "$NEXTAUTH_URL" ]; then
      export NEXTAUTH_URL="$url"
      echo "[entrypoint] NEXTAUTH_URL 未设置，已自动设为: $NEXTAUTH_URL"
    fi
    if [ -z "$AUTH_URL" ]; then
      export AUTH_URL="$url"
      echo "[entrypoint] AUTH_URL 未设置，已自动设为: $AUTH_URL"
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

# 自动设置 NextAuth URL，避免回落到 localhost 导致 Google OAuth 回调不匹配
auto_set_auth_urls || true

# 打印已解析的 Prisma 连接（脱敏），便于排查是否误连到 system DB
if [ -n "$DATABASE_URL" ]; then
  case "$DATABASE_URL" in
    mysql://*)
      base=$(printf "%s" "$DATABASE_URL" | sed -E 's#^mysql://([^/@]+)@([^/:]+)(:[0-9]+)?/([^?]+).*#\2\3/\4#')
      echo "[entrypoint] Prisma 目标: mysql://${base}"
      ;;
  esac
fi

# 说明：为避免迁移期间 Next 持有查询/事务导致 MySQL 元数据锁等待，这里改为：
# 先执行 Go/Prisma 迁移，再启动 Next。生产环境可显著降低 DDL 等待与超时风险。

# 一次性数据库基线初始化（幂等）。确保后台基础表存在（admin_users/system_configs 等）。
BASE_MARK_DIR="/app/logs"
BASE_INIT_MARK="$BASE_MARK_DIR/.db_init_done"
mkdir -p "$BASE_MARK_DIR" || true
if [ ! -f "$BASE_INIT_MARK" ]; then
  echo "[entrypoint] 执行一次性数据库基线初始化（server -init-db）..."
  if "$APP_DIR/server" -init-db -config="$CONFIG_PATH"; then
    date > "$BASE_INIT_MARK" || true
    echo "[entrypoint] ✅ 基线初始化完成"
  else
    echo "[entrypoint] ⚠️ 基线初始化失败，但将继续尝试 Prisma 迁移"
  fi
fi

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
  echo "[entrypoint] 启动期迁移：仅执行 Prisma（Go 迁移已统一到 Prisma）"
else
  echo "[entrypoint] 跳过启动期迁移（RUN_MIGRATIONS_ON_START=false）"
fi

# Prisma 迁移（仅当检测到 schema 与 DATABASE_URL 存在时执行）
if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ] && [ -f "$PRISMA_SCHEMA" ]; then
  if auto_fix_prisma_url && [ -n "$DATABASE_URL" ]; then
    echo "[entrypoint] 执行 Prisma 迁移: prisma migrate deploy"
    # 使用全局 prisma CLI，schema 指定到 Next 应用内
    PRISMA_OUTPUT=$(prisma migrate deploy --schema "$PRISMA_SCHEMA" 2>&1) || DEPLOY_RC=$?
    if [ -n "$DEPLOY_RC" ] && [ "$DEPLOY_RC" -ne 0 ]; then
      echo "$PRISMA_OUTPUT"
      echo "[entrypoint] ⚠️ Prisma 迁移失败"
      # 自动 resolve 失败的迁移（仅当显式开启）
      if [ "${PRISMA_AUTO_RESOLVE_FAILED}" = "true" ]; then
        FAILED_LIST=$(prisma migrate status --schema "$PRISMA_SCHEMA" 2>/dev/null | awk '/Following migration have failed:/{flag=1; next} flag && NF {print $0}')
        if [ -n "$FAILED_LIST" ]; then
          echo "[entrypoint] 检测到失败迁移，执行 resolve --rolled-back:"
          echo "$FAILED_LIST" | while read -r mig; do
            case "$mig" in *[!0-9A-Za-z_-]*) continue;; esac
            echo "  - $mig"
            prisma migrate resolve --schema "$PRISMA_SCHEMA" --rolled-back "$mig" || true
          done
          echo "[entrypoint] 重试 Prisma 迁移: prisma migrate deploy"
          prisma migrate deploy --schema "$PRISMA_SCHEMA" || echo "[entrypoint] ⚠️ 重试 prisma migrate deploy 仍失败"
        fi
      fi
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
    echo "[entrypoint] 跳过 Prisma 迁移：未设置/无法解析 DATABASE_URL"
  fi
elif [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ] && [ ! -f "$PRISMA_SCHEMA" ]; then
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
echo "[entrypoint] Go 将绑定: host=0.0.0.0 port=$PORT"
exec "$APP_DIR/server" -config="$CONFIG_PATH" -port="$PORT" -host="0.0.0.0"
