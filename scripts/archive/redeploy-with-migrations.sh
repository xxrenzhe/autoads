#!/bin/bash

# 重新部署脚本 - 用于应用数据库迁移修复
# 此脚本会重新构建并部署容器

set -e

echo "🔄 重新部署容器以应用数据库迁移修复..."

# 检查环境
if [[ -z "$NEXT_PUBLIC_DEPLOYMENT_ENV" ]]; then
    echo "❌ 请设置部署环境 (preview 或 production)"
    echo "例如: export NEXT_PUBLIC_DEPLOYMENT_ENV=preview"
    exit 1
fi

# 显示当前环境
echo "📋 当前环境: $NEXT_PUBLIC_DEPLOYMENT_ENV"

# 构建新的 Docker 镜像
echo "🏗️  构建 Docker 镜像..."
if [[ "$NEXT_PUBLIC_DEPLOYMENT_ENV" == "preview" ]]; then
    docker build -f Dockerfile.standalone-lite \
        --build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=preview \
        --build-arg NEXT_PUBLIC_DOMAIN=urlchecker.dev \
        --build-arg AUTH_URL=https://www.urlchecker.dev \
        -t url-batch-checker:latest .
else
    docker build -f Dockerfile.standalone-lite \
        --build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=production \
        --build-arg NEXT_PUBLIC_DOMAIN=autoads.dev \
        --build-arg AUTH_URL=https://www.autoads.dev \
        -t url-batch-checker:latest .
fi

echo "✅ Docker 镜像构建完成"

echo ""
echo "📝 下一步操作："
echo "1. 将镜像推送到容器仓库"
echo "2. 在 ClawCloud 控制台中更新容器镜像"
echo "3. 容器重启时会自动运行数据库迁移"
echo ""
echo "🔧 重要提示："
echo "- 首次启动时会运行数据库迁移"
echo "- 请确保 DATABASE_URL 环境变量已正确设置"
echo "- 迁移完成后应用会正常启动"