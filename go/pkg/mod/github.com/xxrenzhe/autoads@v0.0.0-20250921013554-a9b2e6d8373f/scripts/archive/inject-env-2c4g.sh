#!/bin/bash

# ========================================
# 2C4G 环境优化的配置注入脚本
# 专门针对 ClawCloud 2C4G 环境优化
# ========================================

set -e

# 环境变量映射表
declare -A ENV_MAPPING=(
    ["preview.env"]="urlchecker.dev"
    ["preview.base_url"]="https://www.urlchecker.dev"
    ["preview.app_name"]="AutoAds Preview"
    ["preview.redis_cache_ttl"]="86400000"
    ["preview.siterank_batch_query_limit"]="50"
    
    ["production.env"]="autoads.dev"
    ["production.base_url"]="https://www.autoads.dev"
    ["production.app_name"]="AutoAds"
    ["production.redis_cache_ttl"]="604800000"
    ["production.siterank_batch_query_limit"]="100"
)

# 获取部署环境
if [[ -z "$NEXT_PUBLIC_DEPLOYMENT_ENV" ]]; then
    if [[ -n "$DOMAIN" ]]; then
        case "$DOMAIN" in
            *"urlchecker.dev"*)
                DEPLOYMENT_ENV="preview"
                ;;
            *"autoads.dev"*)
                DEPLOYMENT_ENV="production"
                ;;
            *)
                DEPLOYMENT_ENV="production"
                ;;
        esac
    else
        DEPLOYMENT_ENV="production"
    fi
    export NEXT_PUBLIC_DEPLOYMENT_ENV=$DEPLOYMENT_ENV
    echo "🔍 Auto-detected environment: $DEPLOYMENT_ENV"
else
    DEPLOYMENT_ENV=$NEXT_PUBLIC_DEPLOYMENT_ENV
    echo "🚀 Initializing environment: $DEPLOYMENT_ENV"
fi

# 验证环境
if [[ ! "$DEPLOYMENT_ENV" =~ ^(preview|production)$ ]]; then
    echo "❌ Invalid deployment environment: $DEPLOYMENT_ENV"
    exit 1
fi

echo "📝 Injecting environment-specific configuration..."

# 设置基础配置
export DOMAIN=${DOMAIN:-${ENV_MAPPING["${DEPLOYMENT_ENV}.env"]}}
export BASE_URL=${BASE_URL:-${ENV_MAPPING["${DEPLOYMENT_ENV}.base_url"]}}
export NEXT_PUBLIC_DOMAIN=${NEXT_PUBLIC_DOMAIN:-$DOMAIN}
export NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL:-$BASE_URL}
export APP_NAME=${APP_NAME:-${ENV_MAPPING["${DEPLOYMENT_ENV}.app_name"]}}
export NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME:-$APP_NAME}

# 设置缓存配置（2C4G 优化）
export REDIS_CACHE_TTL=${REDIS_CACHE_TTL:-${ENV_MAPPING["${DEPLOYMENT_ENV}.redis_cache_ttl"]}}
export REDIS_ERROR_CACHE_TTL=${REDIS_ERROR_CACHE_TTL:-"3600000"}

# 设置网络配置（2C4G 优化）
export HTTP_TIMEOUT=${HTTP_TIMEOUT:-"20000"}
export PROXY_TIMEOUT=${PROXY_TIMEOUT:-"30000"}
export API_TIMEOUT=${API_TIMEOUT:-"25000"}
export MAX_CONCURRENT_REQUESTS=${MAX_CONCURRENT_REQUESTS:-"5"}

# 设置安全配置
export HTTPS_ONLY=${HTTPS_ONLY:-"false"}
export SECURE_COOKIES=${SECURE_COOKIES:-"true"}
export ENABLE_ANALYTICS=${ENABLE_ANALYTICS:-"true"}
export DEBUG_MODE=${DEBUG_MODE:-"false"}

# 设置 NextAuth 配置
export AUTH_URL=${AUTH_URL:-$BASE_URL}
export AUTH_TRUST_HOST=${AUTH_TRUST_HOST:-"true"}

# ClawCloud 内部域名信任配置
DETECTED_HOSTNAME=""
if [[ -n "$HOSTNAME" ]]; then
    DETECTED_HOSTNAME="$HOSTNAME"
elif [[ -f /etc/hostname ]]; then
    DETECTED_HOSTNAME=$(cat /etc/hostname)
fi

if [[ -n "$DETECTED_HOSTNAME" ]]; then
    if [[ "$DETECTED_HOSTNAME" =~ ^autoads-preview-[a-f0-9]+-[a-z0-9]+$ ]]; then
        echo "🔧 Detected ClawCloud preview environment: $DETECTED_HOSTNAME"
        export AUTH_TRUSTED_HOSTS="${AUTH_TRUSTED_HOSTS:-},$DETECTED_HOSTNAME:3000,$DETECTED_HOSTNAME"
        echo "   Added to trusted hosts: $DETECTED_HOSTNAME:3000"
    elif [[ "$DETECTED_HOSTNAME" =~ ^autoads-prod-[a-f0-9]+-[a-z0-9]+$ ]]; then
        echo "🔧 Detected ClawCloud production environment: $DETECTED_HOSTNAME"
        export AUTH_TRUSTED_HOSTS="${AUTH_TRUSTED_HOSTS:-},$DETECTED_HOSTNAME:3000,$DETECTED_HOSTNAME"
        echo "   Added to trusted hosts: $DETECTED_HOSTNAME:3000"
    fi
fi

# 验证必需的环境变量
echo "🔍 Validating required environment variables..."
REQUIRED_VARS=("REDIS_URL" "DOMAIN" "BASE_URL")

for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    fi
done

# 显示配置摘要
echo ""
echo "✅ Environment Configuration Summary"
echo "=================================="
echo "Environment: $DEPLOYMENT_ENV"
echo "Domain: $DOMAIN"
echo "Base URL: $BASE_URL"
echo "App Name: $APP_NAME"
echo "Auth URL: ${AUTH_URL}"
echo "Auth Trust Host: ${AUTH_TRUST_HOST}"
if [[ -n "$AUTH_TRUSTED_HOSTS" ]]; then
    echo "Auth Trusted Hosts: ${AUTH_TRUSTED_HOSTS}"
fi
if [[ -n "$DETECTED_HOSTNAME" ]]; then
    echo "Detected Hostname: ${DETECTED_HOSTNAME}"
fi
echo "Redis Cache TTL: ${REDIS_CACHE_TTL}ms"
echo "HTTP Timeout: ${HTTP_TIMEOUT}ms (2C4G optimized)"
echo "Max Concurrent: ${MAX_CONCURRENT_REQUESTS} (2C4G optimized)"
echo ""

# 2C4G 内存优化检查
echo "🔍 Validating 2C4G memory configuration..."
TOTAL_MEMORY_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEMORY_MB=$((TOTAL_MEMORY_KB / 1024))
echo "Available memory: ${TOTAL_MEMORY_MB}MB"

if [[ $TOTAL_MEMORY_MB -lt 3500 ]]; then
    echo "⚠️  Low memory detected, applying conservative settings"
    export NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=16"
else
    echo "✅ Memory configuration is adequate for 2C4G"
fi

# 运行数据库迁移（简化）
echo "🗄️  Running database migrations..."
if timeout 30 npx prisma migrate deploy; then
    echo "✅ Database migrations completed successfully"
else
    echo "⚠️  Database migrations timed out or failed, continuing..."
fi

# 重新生成 Prisma 客户端
echo "🔧 Generating Prisma client..."
if timeout 30 npx prisma generate; then
    echo "✅ Prisma client generated successfully"
else
    echo "⚠️  Prisma client generation failed, continuing..."
fi

# 简化的清理（不启动后台进程）
echo "🧹 Performing minimal cleanup..."
rm -rf /tmp/playwright-* /tmp/puppeteer-* 2>/dev/null || true

# 执行原始的启动命令
echo "🚀 Starting application with 2C4G optimizations..."
exec "$@"