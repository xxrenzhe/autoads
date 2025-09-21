#!/bin/bash

# ========================================
# 环境配置注入脚本
# 用于在容器启动时根据部署环境注入配置
# ========================================

set -e

# 环境变量映射表
declare -A ENV_MAPPING=(
    # 预发环境配置
    ["preview.env"]="urlchecker.dev"
    ["preview.base_url"]="https://www.urlchecker.dev"
    ["preview.app_name"]="AutoAds Preview"
    ["preview.redis_cache_ttl"]="86400000"
    ["preview.siterank_batch_query_limit"]="50"
    
    # 生产环境配置
    ["production.env"]="autoads.dev"
    ["production.base_url"]="https://www.autoads.dev"
    ["production.app_name"]="AutoAds"
    ["production.redis_cache_ttl"]="604800000"
    ["production.siterank_batch_query_limit"]="100"
)

# 获取部署环境（允许自动检测）
if [[ -z "$NEXT_PUBLIC_DEPLOYMENT_ENV" ]]; then
    # 智能环境检测
    if [[ -n "$DOMAIN" ]]; then
        case "$DOMAIN" in
            *"urlchecker.dev"*)
                DEPLOYMENT_ENV="preview"
                ;;
            *"autoads.dev"*)
                DEPLOYMENT_ENV="production"
                ;;
            *"localhost"*|*"127.0.0.1"*)
                DEPLOYMENT_ENV="development"
                ;;
            *)
                DEPLOYMENT_ENV="production"
                ;;
        esac
    else
        DEPLOYMENT_ENV="production"
    fi
    export NEXT_PUBLIC_DEPLOYMENT_ENV=$DEPLOYMENT_ENV
    echo "🔍 Auto-detected environment: $DEPLOYMENT_ENV (based on domain)"
else
    DEPLOYMENT_ENV=$NEXT_PUBLIC_DEPLOYMENT_ENV
    echo "🚀 Initializing environment: $DEPLOYMENT_ENV"
fi

# 验证环境
if [[ ! "$DEPLOYMENT_ENV" =~ ^(preview|production)$ ]]; then
    echo "❌ Invalid deployment environment: $DEPLOYMENT_ENV"
    echo "Valid environments: preview, production"
    exit 1
fi

# 注入环境特定配置
echo "📝 Injecting environment-specific configuration..."

# 设置域名相关配置
export DOMAIN=${DOMAIN:-${ENV_MAPPING["${DEPLOYMENT_ENV}.env"]}}
export BASE_URL=${BASE_URL:-${ENV_MAPPING["${DEPLOYMENT_ENV}.base_url"]}}
export NEXT_PUBLIC_DOMAIN=${NEXT_PUBLIC_DOMAIN:-$DOMAIN}
export NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL:-$BASE_URL}

# 设置应用配置
export APP_NAME=${APP_NAME:-${ENV_MAPPING["${DEPLOYMENT_ENV}.app_name"]}}
export NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME:-$APP_NAME}

# 设置缓存配置
export REDIS_CACHE_TTL=${REDIS_CACHE_TTL:-${ENV_MAPPING["${DEPLOYMENT_ENV}.redis_cache_ttl"]}}
export REDIS_ERROR_CACHE_TTL=${REDIS_ERROR_CACHE_TTL:-"3600000"}

# 设置SiteRank配置
export SITERANK_BATCH_QUERY_LIMIT=${SITERANK_BATCH_QUERY_LIMIT:-${ENV_MAPPING["${DEPLOYMENT_ENV}.siterank_batch_query_limit"]}}

# 设置网络和代理配置
export HTTP_TIMEOUT=${HTTP_TIMEOUT:-"30000"}
export PROXY_TIMEOUT=${PROXY_TIMEOUT:-"60000"}
export PROXY_MAX_RETRIES=${PROXY_MAX_RETRIES:-"5"}
export API_TIMEOUT=${API_TIMEOUT:-"45000"}
export MAX_CONCURRENT_REQUESTS=${MAX_CONCURRENT_REQUESTS:-"10"}

# 设置安全配置
if [[ "$DEPLOYMENT_ENV" == "production" ]]; then
    export HTTPS_ONLY=${HTTPS_ONLY:-"true"}
    export SECURE_COOKIES=${SECURE_COOKIES:-"true"}
    export ENABLE_ANALYTICS=${ENABLE_ANALYTICS:-"true"}
    export DEBUG_MODE=${DEBUG_MODE:-"false"}
else
    export HTTPS_ONLY=${HTTPS_ONLY:-"false"}
    export SECURE_COOKIES=${SECURE_COOKIES:-"true"}
    export ENABLE_ANALYTICS=${ENABLE_ANALYTICS:-"true"}
    export DEBUG_MODE=${DEBUG_MODE:-"false"}
fi

# 设置OAuth重定向URI
export OAUTH_REDIRECT_URI=${OAUTH_REDIRECT_URI:-"${BASE_URL}/oauth/callback"}

# 设置NextAuth配置
export AUTH_URL=${AUTH_URL:-$BASE_URL}
export AUTH_TRUST_HOST=${AUTH_TRUST_HOST:-"true"}

# ClawCloud 内部域名信任配置
# 检测 ClawCloud 容器环境的内部域名
DETECTED_HOSTNAME=""

# 尝试多种方式检测容器主机名
if [[ -n "$HOSTNAME" ]]; then
    DETECTED_HOSTNAME="$HOSTNAME"
elif [[ -f /etc/hostname ]]; then
    DETECTED_HOSTNAME=$(cat /etc/hostname)
fi

# 检查是否为 ClawCloud 环境
if [[ -n "$DETECTED_HOSTNAME" ]]; then
    if [[ "$DETECTED_HOSTNAME" =~ ^autoads-preview-[a-f0-9]+-[a-z0-9]+$ ]]; then
        echo "🔧 Detected ClawCloud preview environment: $DETECTED_HOSTNAME"
        export AUTH_TRUSTED_HOSTS="${AUTH_TRUSTED_HOSTS:-},$DETECTED_HOSTNAME:3000,$DETECTED_HOSTNAME"
        export AUTH_TRUST_HOST="true"
        echo "   Added to trusted hosts: $DETECTED_HOSTNAME:3000"
    elif [[ "$DETECTED_HOSTNAME" =~ ^autoads-prod-[a-f0-9]+-[a-z0-9]+$ ]]; then
        echo "🔧 Detected ClawCloud production environment: $DETECTED_HOSTNAME"
        export AUTH_TRUSTED_HOSTS="${AUTH_TRUSTED_HOSTS:-},$DETECTED_HOSTNAME:3000,$DETECTED_HOSTNAME"
        export AUTH_TRUST_HOST="true"
        echo "   Added to trusted hosts: $DETECTED_HOSTNAME:3000"
    fi
fi

# 设置支持的域名列表
if [[ "$DEPLOYMENT_ENV" == "preview" ]]; then
    export NEXT_PUBLIC_SUPPORTED_DOMAINS=${NEXT_PUBLIC_SUPPORTED_DOMAINS:-"urlchecker.com,www.urlchecker.com,autoads.dev,www.autoads.dev"}
else
    export NEXT_PUBLIC_SUPPORTED_DOMAINS=${NEXT_PUBLIC_SUPPORTED_DOMAINS:-"autoads.dev,www.autoads.dev"}
fi

# 验证必需的环境变量
echo "🔍 Validating required environment variables..."

REQUIRED_VARS=(
    "REDIS_URL"
    "DOMAIN"
    "BASE_URL"
)

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
echo "SiteRank Limit: ${SITERANK_BATCH_QUERY_LIMIT}"
echo "HTTP Timeout: ${HTTP_TIMEOUT}ms"
echo "Proxy Timeout: ${PROXY_TIMEOUT}ms"
echo "API Timeout: ${API_TIMEOUT}ms"
echo "Max Concurrent: ${MAX_CONCURRENT_REQUESTS}"
echo "HTTPS Only: $HTTPS_ONLY"
echo "Analytics: $ENABLE_ANALYTICS"
echo "Debug Mode: $DEBUG_MODE"
echo ""

# 检查Google Ads配置（生产环境）
if [[ "$DEPLOYMENT_ENV" == "production" ]]; then
    if [[ -z "$GOOGLE_ADS_CLIENT_ID" ]] || [[ -z "$GOOGLE_ADS_DEVELOPER_TOKEN" ]]; then
        echo "⚠️  Warning: Google Ads API credentials not configured"
        echo "   Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_DEVELOPER_TOKEN for full functionality"
    fi
fi

# 验证内存配置
echo "🔍 Validating memory configuration..."
if /usr/local/bin/validate-memory; then
    echo "✅ Memory configuration is valid"
else
    echo "⚠️  Memory configuration warning, continuing anyway..."
fi

# 运行数据库迁移
echo "🗄️  Running database migrations..."
if npx prisma migrate deploy; then
    echo "✅ Database migrations completed successfully"
else
    echo "⚠️  Database migrations failed, attempting to continue..."
fi

# 重新生成 Prisma 客户端（确保与数据库结构同步）
echo "🔧 Generating Prisma client..."
npx prisma generate

# Perform initial cleanup
echo "🧹 Performing initial cleanup..."
/usr/local/bin/startup-cleanup

# Start storage monitoring in background
echo "📊 Starting storage monitoring..."
/usr/local/bin/storage-monitor &

# Start periodic log rotation
echo "🔄 Starting periodic log rotation..."
(
  while true; do
    sleep 300  # Run every 5 minutes
    /usr/local/bin/log-rotation
  done
) &

# 执行原始的启动命令
echo "🚀 Starting application..."
exec "$@"