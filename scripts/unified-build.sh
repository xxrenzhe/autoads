#!/bin/bash

# 统一Docker构建脚本
# 使用优化的构建流程

set -e

ENVIRONMENT=${1:-preview}
VERSION=${2:-latest}

echo "🚀 开始统一构建流程..."
echo "  环境: $ENVIRONMENT"
echo "  版本: $VERSION"

# 设置镜像标签
if [ "$ENVIRONMENT" = "production" ]; then
    IMAGE_TAG="ghcr.io/xxrenzhe/url-batch-checker:prod-$VERSION"
    DOMAIN="autoads.dev"
else
    IMAGE_TAG="ghcr.io/xxrenzhe/url-batch-checker:preview-$VERSION"
    DOMAIN="urlchecker.dev"
fi

echo "  镜像标签: $IMAGE_TAG"
echo "  域名: $DOMAIN"

# 构建Docker镜像
docker build \
    -f Dockerfile.standalone \
    -t "$IMAGE_TAG" \
    --build-arg NODE_ENV=production \
    --build-arg NEXT_TELEMETRY_DISABLED=1 \
    --build-arg NEXT_PUBLIC_DEPLOYMENT_ENV="$ENVIRONMENT" \
    --build-arg NEXT_PUBLIC_DOMAIN="$DOMAIN" \
    .

echo "✅ 构建完成: $IMAGE_TAG"
