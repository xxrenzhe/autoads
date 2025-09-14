#!/usr/bin/env sh
set -e

APP_DIR="/app/gofly_admin_v3"
CONFIG_PATH="${ADMIN_CONFIG:-$APP_DIR/config.yaml}"
PORT="${PORT:-8080}"

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

echo "[entrypoint] 执行数据库迁移..."
"$APP_DIR/server" -migrate -config="$CONFIG_PATH" || true

echo "[entrypoint] 启动服务..."
exec "$APP_DIR/server" -config="$CONFIG_PATH" -port="$PORT"
