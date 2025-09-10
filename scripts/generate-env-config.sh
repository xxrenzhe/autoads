#!/bin/bash

# 快速环境配置生成器
# 根据目标环境生成优化后的环境变量配置

set -e

echo "🚀 环境配置生成器"
echo "=================="

# 检查参数
if [ $# -eq 0 ]; then
    echo "用法: $0 <environment>"
    echo "环境选项:"
    echo "  preview     - 预览环境 (urlchecker.dev)"
    echo "  production  - 生产环境 (autoads.dev)"
    echo "  development - 开发环境 (localhost:3000)"
    exit 1
fi

ENVIRONMENT=$1

# 生成AUTH_SECRET
generate_secret() {
    openssl rand -hex 32
}

AUTH_SECRET=$(generate_secret)

echo ""
echo "🎯 生成 $ENVIRONMENT 环境配置:"
echo "================================"

case $ENVIRONMENT in
    "development")
        cat << EOF
# ========================================
# 开发环境配置
# ========================================

# 核心配置
NEXT_PUBLIC_DOMAIN=localhost:3000
NEXT_PUBLIC_DEPLOYMENT_ENV=development
NODE_ENV=development

# NextAuth v5配置
AUTH_SECRET=$AUTH_SECRET
AUTH_GOOGLE_ID=your-dev-google-client-id
AUTH_GOOGLE_SECRET=your-dev-google-client-secret

# 数据库配置
DATABASE_URL=postgresql://postgres:password@localhost:5432/admin_system_dev
REDIS_URL=redis://localhost:6379

# 开发环境特定配置
AUTH_DEBUG=true
NEXT_TELEMETRY_DISABLED=1

# ========================================
# 自动适配的配置
# ========================================
# AUTH_URL → http://localhost:3000
# JWT issuer/audience → localhost:3000
# Cookie domain → localhost:3000
# API base URL → http://localhost:3000/api
EOF
        ;;
    "preview")
        cat << EOF
# ========================================
# 预览环境配置 (ClawCloud)
# ========================================

# 核心配置
NEXT_PUBLIC_DOMAIN=urlchecker.dev
NEXT_PUBLIC_DEPLOYMENT_ENV=preview
NODE_ENV=production

# NextAuth v5配置
AUTH_SECRET=$AUTH_SECRET
AUTH_GOOGLE_ID=your-preview-google-client-id
AUTH_GOOGLE_SECRET=your-preview-google-client-secret

# 数据库配置
DATABASE_URL=postgresql://user:password@preview-db:5432/dbname
REDIS_URL=redis://preview-redis:6379

# 生产环境配置
NEXT_TELEMETRY_DISABLED=1

# ========================================
# 自动适配的配置
# ========================================
# AUTH_URL → https://urlchecker.dev
# JWT issuer/audience → urlchecker.dev
# Cookie domain → urlchecker.dev
# API base URL → https://urlchecker.dev/api
EOF
        ;;
    "production")
        cat << EOF
# ========================================
# 生产环境配置 (ClawCloud)
# ========================================

# 核心配置
NEXT_PUBLIC_DOMAIN=autoads.dev
NEXT_PUBLIC_DEPLOYMENT_ENV=production
NODE_ENV=production

# NextAuth v5配置
AUTH_SECRET=$AUTH_SECRET
AUTH_GOOGLE_ID=your-production-google-client-id
AUTH_GOOGLE_SECRET=your-production-google-client-secret

# 数据库配置
DATABASE_URL=postgresql://user:password@prod-db:5432/prod_dbname
REDIS_URL=redis://prod-redis:6379

# 生产环境配置
NEXT_TELEMETRY_DISABLED=1

# ========================================
# 自动适配的配置
# ========================================
# AUTH_URL → https://autoads.dev
# JWT issuer/audience → autoads.dev
# Cookie domain → autoads.dev
# API base URL → https://autoads.dev/api
EOF
        ;;
    *)
        echo "❌ 未知环境: $ENVIRONMENT"
        echo "支持的环境: development, preview, production"
        exit 1
        ;;
esac

echo ""
echo "✨ 配置生成完成！"
echo ""
echo "📋 下一步操作:"

case $ENVIRONMENT in
    "development")
        echo "1. 将上述配置保存到 .env.local 文件"
        echo "2. 更新Google OAuth客户端ID和密钥"
        echo "3. 确保数据库和Redis服务运行"
        echo "4. 运行 npm run dev 启动开发服务器"
        ;;
    "preview"|"production")
        echo "1. 在ClawCloud控制台中设置上述环境变量"
        echo "2. 更新Google OAuth客户端ID和密钥"
        echo "3. 确保数据库连接字符串正确"
        echo "4. 重启ClawCloud服务"
        echo "5. 运行验证脚本: ./scripts/verify-auth-url.sh"
        ;;
esac

echo ""
echo "🔐 Google OAuth配置:"
case $ENVIRONMENT in
    "development")
        echo "重定向URI: http://localhost:3000/api/auth/callback/google"
        echo "授权域名: localhost"
        ;;
    "preview")
        echo "重定向URI: https://urlchecker.dev/api/auth/callback/google"
        echo "授权域名: urlchecker.dev"
        ;;
    "production")
        echo "重定向URI: https://autoads.dev/api/auth/callback/google"
        echo "授权域名: autoads.dev"
        ;;
esac

echo ""
echo "💡 提示: AUTH_SECRET已自动生成，请妥善保存！"