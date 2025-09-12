#!/bin/bash

# ========================================
# 智能环境检测脚本
# 根据域名自动检测部署环境
# ========================================

set -e

# 获取容器主机名（如果可用）
HOSTNAME=$(hostname 2>/dev/null || echo "unknown")

# 智能环境检测函数
detect_environment() {
    # 1. 优先使用环境变量
    if [[ -n "$NEXT_PUBLIC_DEPLOYMENT_ENV" ]]; then
        echo "$NEXT_PUBLIC_DEPLOYMENT_ENV"
        return
    fi
    
    # 2. 根据域名检测
    if [[ -n "$DOMAIN" ]]; then
        case "$DOMAIN" in
            *"urlchecker.dev"*)
                echo "preview"
                return
                ;;
            *"autoads.dev"*)
                echo "production"
                return
                ;;
            *"localhost"*|*"127.0.0.1"*)
                echo "development"
                return
                ;;
        esac
    fi
    
    # 3. 根据主机名检测
    if [[ "$HOSTNAME" != "unknown" ]]; then
        case "$HOSTNAME" in
            *"preview"*|*"staging"*|*"urlchecker"*)
                echo "preview"
                return
                ;;
            *"prod"*|*"production"*|*"autoads"*)
                echo "production"
                return
                ;;
            *"dev"*|*"test"*|*"local"*)
                echo "development"
                return
                ;;
        esac
    fi
    
    # 4. 默认生产环境
    echo "production"
}

# 检测环境
DETECTED_ENV=$(detect_environment)
echo "🔍 Detected environment: $DETECTED_ENV"

# 如果检测到的环境与当前设置不同，更新它
if [[ -n "$NEXT_PUBLIC_DEPLOYMENT_ENV" ]] && [[ "$NEXT_PUBLIC_DEPLOYMENT_ENV" != "$DETECTED_ENV" ]]; then
    echo "⚠️  Environment mismatch: configured=$NEXT_PUBLIC_DEPLOYMENT_ENV, detected=$DETECTED_ENV"
    echo "💡 Consider updating NEXT_PUBLIC_DEPLOYMENT_ENV to $DETECTED_ENV"
fi

# 导出检测到的环境
export NEXT_PUBLIC_DEPLOYMENT_ENV=$DETECTED_ENV

# 显示建议
echo ""
echo "💡 Environment Configuration Tips:"
echo "================================"
if [[ "$DETECTED_ENV" == "preview" ]]; then
    echo "For preview environment, ensure these are set in ClawCloud:"
    echo "- NEXT_PUBLIC_DEPLOYMENT_ENV=preview"
    echo "- DOMAIN=urlchecker.dev (or your actual preview domain)"
    echo ""
    echo "Or let the script auto-detect based on domain."
elif [[ "$DETECTED_ENV" == "production" ]]; then
    echo "For production environment, ensure these are set in ClawCloud:"
    echo "- NEXT_PUBLIC_DEPLOYMENT_ENV=production"
    echo "- DOMAIN=autoads.dev (or your actual production domain)"
    echo ""
    echo "Or let the script auto-detect based on domain."
fi