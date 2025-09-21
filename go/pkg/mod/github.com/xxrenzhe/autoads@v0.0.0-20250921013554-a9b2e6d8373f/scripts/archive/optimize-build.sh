#!/bin/bash

# Docker构建优化脚本
# 提供多种优化策略来加速构建过程

set -e

echo "⚡ Docker构建优化工具"

# 默认参数
ENVIRONMENT=${1:-preview}
CACHE_STRATEGY=${2:-aggressive}
PARALLEL_BUILDS=${3:-true}

echo "📋 构建配置:"
echo "   环境: $ENVIRONMENT"
echo "   缓存策略: $CACHE_STRATEGY"
echo "   并行构建: $PARALLEL_BUILDS"

# 设置构建参数
case $ENVIRONMENT in
    "preview")
        IMAGE_TAG="ghcr.io/xxrenzhe/url-batch-checker:preview-latest"
        BUILD_ARGS="--build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=preview --build-arg NEXT_PUBLIC_DOMAIN=urlchecker.dev"
        ;;
    "production")
        IMAGE_TAG="ghcr.io/xxrenzhe/url-batch-checker:prod-latest"
        BUILD_ARGS="--build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=production --build-arg NEXT_PUBLIC_DOMAIN=autoads.dev"
        ;;
    *)
        echo "❌ 无效环境: $ENVIRONMENT"
        exit 1
        ;;
esac

echo "🎯 目标镜像: $IMAGE_TAG"

# 1. 预热Docker缓存
echo "🔥 预热Docker缓存..."
docker pull node:20.18.0-alpine || true
docker pull $IMAGE_TAG || true

# 2. 清理构建缓存（如果需要）
if [ "$CACHE_STRATEGY" = "clean" ]; then
    echo "🧹 清理构建缓存..."
    docker builder prune -f
fi

# 3. 设置BuildKit优化
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

# 4. 构建优化参数
BUILDX_ARGS=""

# 缓存策略
case $CACHE_STRATEGY in
    "aggressive")
        BUILDX_ARGS="$BUILDX_ARGS --cache-from type=local,src=/tmp/.buildx-cache"
        BUILDX_ARGS="$BUILDX_ARGS --cache-to type=local,dest=/tmp/.buildx-cache-new,mode=max"
        ;;
    "registry")
        BUILDX_ARGS="$BUILDX_ARGS --cache-from type=registry,ref=$IMAGE_TAG-cache"
        BUILDX_ARGS="$BUILDX_ARGS --cache-to type=registry,ref=$IMAGE_TAG-cache,mode=max"
        ;;
    "inline")
        BUILDX_ARGS="$BUILDX_ARGS --cache-from type=registry,ref=$IMAGE_TAG"
        BUILD_ARGS="$BUILD_ARGS --build-arg BUILDKIT_INLINE_CACHE=1"
        ;;
esac

# 并行构建优化
if [ "$PARALLEL_BUILDS" = "true" ]; then
    BUILDX_ARGS="$BUILDX_ARGS --build-arg MAKEFLAGS=-j$(nproc)"
fi

# 5. 执行优化构建
echo "🚀 开始优化构建..."
START_TIME=$(date +%s)

docker buildx build \
    --platform linux/amd64 \
    --file Dockerfile.standalone \
    --tag $IMAGE_TAG \
    $BUILD_ARGS \
    $BUILDX_ARGS \
    --build-arg NODE_ENV=production \
    --build-arg NEXT_TELEMETRY_DISABLED=1 \
    --build-arg NPM_CONFIG_CACHE=/tmp/.npm \
    --build-arg NPM_CONFIG_PREFER_OFFLINE=true \
    --build-arg NPM_CONFIG_NO_AUDIT=true \
    --build-arg NPM_CONFIG_NO_FUND=true \
    --load \
    .

END_TIME=$(date +%s)
BUILD_DURATION=$((END_TIME - START_TIME))

echo "✅ 构建完成！"
echo "⏱️  构建时间: ${BUILD_DURATION}秒"

# 6. 显示镜像信息
echo "📊 镜像信息:"
docker images $IMAGE_TAG --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# 7. 缓存管理
if [ "$CACHE_STRATEGY" = "aggressive" ] && [ -d "/tmp/.buildx-cache-new" ]; then
    echo "🔄 更新构建缓存..."
    rm -rf /tmp/.buildx-cache
    mv /tmp/.buildx-cache-new /tmp/.buildx-cache
fi

# 8. 快速测试
echo "🧪 快速容器测试..."
CONTAINER_ID=$(docker run -d \
    --name quick-test-$ENVIRONMENT \
    --memory=2g \
    --cpus=1 \
    -p 3001:3000 \
    -e NODE_ENV=production \
    -e NEXT_PUBLIC_DEPLOYMENT_ENV=$ENVIRONMENT \
    $IMAGE_TAG)

echo "等待容器启动..."
sleep 15

if docker ps | grep -q quick-test-$ENVIRONMENT; then
    echo "✅ 容器启动成功"
    
    # 检查内存使用
    MEMORY_USAGE=$(docker stats --no-stream --format "{{.MemUsage}}" quick-test-$ENVIRONMENT)
    echo "💾 内存使用: $MEMORY_USAGE"
    
    # 尝试健康检查
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ 健康检查通过"
    else
        echo "⚠️  健康检查失败（可能需要数据库）"
    fi
else
    echo "❌ 容器启动失败"
    docker logs quick-test-$ENVIRONMENT | tail -10
fi

# 清理测试容器
docker stop quick-test-$ENVIRONMENT 2>/dev/null || true
docker rm quick-test-$ENVIRONMENT 2>/dev/null || true

echo ""
echo "📋 构建优化总结:"
echo "=================="
echo "镜像: $IMAGE_TAG"
echo "构建时间: ${BUILD_DURATION}秒"
echo "缓存策略: $CACHE_STRATEGY"
echo "环境: $ENVIRONMENT"
echo ""
echo "🚀 部署命令:"
echo "docker run -d --name url-checker --memory=4g --cpus=2 -p 3000:3000 $IMAGE_TAG"
echo ""
echo "✅ 优化构建完成！"