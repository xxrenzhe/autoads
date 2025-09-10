#!/bin/bash

# 构建优化版本的Docker镜像
# 使用统一的Dockerfile.standalone，支持多环境自适应

set -e

echo "🚀 构建优化版本Docker镜像..."

# 检查当前分支和提交
echo "📋 检查代码状态..."
CURRENT_BRANCH=$(git branch --show-current)
LATEST_COMMIT=$(git rev-parse --short HEAD)
echo "当前分支: $CURRENT_BRANCH"
echo "最新提交: $LATEST_COMMIT"

# 确认优化已完成
echo "🔍 验证优化状态..."

# 检查Playwright是否已移除
if npm list playwright 2>/dev/null | grep -q playwright; then
    echo "❌ Playwright依赖仍然存在，请先运行移除脚本"
    exit 1
else
    echo "✅ Playwright依赖已移除"
fi

# 检查统一Dockerfile是否存在
if [ ! -f "Dockerfile.standalone" ]; then
    echo "❌ 统一Dockerfile不存在"
    exit 1
else
    echo "✅ 统一Dockerfile存在"
fi

# 检查优化脚本是否存在
if [ ! -f "scripts/inject-env-2c4g.sh" ]; then
    echo "❌ 2C4G环境注入脚本不存在"
    exit 1
else
    echo "✅ 2C4G环境注入脚本存在"
fi

# 设置构建参数
IMAGE_NAME="url-checker"
TAG="unified-$(date +%Y%m%d-%H%M%S)"
LATEST_TAG="latest"

echo "📦 开始构建镜像..."
echo "镜像名称: $IMAGE_NAME:$TAG"
echo "最新标签: $IMAGE_NAME:$LATEST_TAG"

# 构建镜像（使用统一的Dockerfile.standalone）
docker build \
    -f Dockerfile.standalone \
    -t "$IMAGE_NAME:$TAG" \
    -t "$IMAGE_NAME:$LATEST_TAG" \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --build-arg VCS_REF="$LATEST_COMMIT" \
    --build-arg VERSION="v2.5.10-unified" \
    .

echo "✅ 镜像构建完成"

# 验证镜像
echo "🧪 验证镜像..."
docker images | grep "$IMAGE_NAME" | head -5

# 获取镜像大小
IMAGE_SIZE=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "$IMAGE_NAME:$LATEST_TAG" | awk '{print $2}')
echo "镜像大小: $IMAGE_SIZE"

# 快速测试镜像（标准环境）
echo "🔍 快速测试镜像（标准环境）..."
CONTAINER_ID=$(docker run -d \
    --name "test-standard-$TAG" \
    --memory=4g \
    --cpus=2 \
    -p 3001:3000 \
    "$IMAGE_NAME:$LATEST_TAG")

echo "测试容器ID（标准）: $CONTAINER_ID"

# 等待容器启动
echo "等待标准容器启动..."
sleep 10

# 检查标准容器状态
if docker ps | grep -q "$CONTAINER_ID"; then
    echo "✅ 标准容器启动成功"
    
    # 检查内存使用
    MEMORY_USAGE=$(docker stats --no-stream --format "{{.MemUsage}}" "$CONTAINER_ID")
    echo "标准环境内存使用: $MEMORY_USAGE"
    
    # 尝试健康检查
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ 标准环境健康检查通过"
    else
        echo "⚠️  标准环境健康检查失败（可能需要更多启动时间）"
    fi
else
    echo "❌ 标准容器启动失败"
    docker logs "test-standard-$TAG"
fi

# 清理标准测试容器
echo "🧹 清理标准测试容器..."
docker stop "test-standard-$TAG" > /dev/null 2>&1 || true
docker rm "test-standard-$TAG" > /dev/null 2>&1 || true

# 测试2C4G环境
echo "🔍 快速测试镜像（2C4G环境）..."
CONTAINER_ID_2C4G=$(docker run -d \
    --name "test-2c4g-$TAG" \
    --memory=4g \
    --cpus=2 \
    -e MEMORY_LIMIT=2C4G \
    -e LOW_MEMORY_MODE=true \
    -e NODE_OPTIONS="--max-old-space-size=768" \
    -e MAX_CONCURRENT_REQUESTS=3 \
    -e HTTP_TIMEOUT=15000 \
    -p 3002:3000 \
    "$IMAGE_NAME:$LATEST_TAG")

echo "测试容器ID（2C4G）: $CONTAINER_ID_2C4G"

# 等待2C4G容器启动
echo "等待2C4G容器启动..."
sleep 15

# 检查2C4G容器状态
if docker ps | grep -q "$CONTAINER_ID_2C4G"; then
    echo "✅ 2C4G容器启动成功"
    
    # 检查内存使用
    MEMORY_USAGE_2C4G=$(docker stats --no-stream --format "{{.MemUsage}}" "$CONTAINER_ID_2C4G")
    echo "2C4G环境内存使用: $MEMORY_USAGE_2C4G"
    
    # 尝试健康检查
    if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
        echo "✅ 2C4G环境健康检查通过"
    else
        echo "⚠️  2C4G环境健康检查失败（可能需要更多启动时间）"
    fi
else
    echo "❌ 2C4G容器启动失败"
    docker logs "test-2c4g-$TAG"
fi

# 清理测试容器
echo "🧹 清理测试容器..."
docker stop "test-2c4g-$TAG" > /dev/null 2>&1 || true
docker rm "test-2c4g-$TAG" > /dev/null 2>&1 || true

# 显示构建总结
echo ""
echo "📊 构建总结:"
echo "============"
echo "✅ 镜像构建成功: $IMAGE_NAME:$TAG"
echo "✅ 最新标签: $IMAGE_NAME:$LATEST_TAG"
echo "✅ 镜像大小: $IMAGE_SIZE"
echo "✅ 统一版本: v2.5.10-unified"
echo "✅ 构建时间: $(date)"
echo ""
echo "🚀 部署命令:"
echo ""
echo "标准环境 (4C8G+):"
echo "docker run -d \\"
echo "  --name url-checker \\"
echo "  --memory=8g \\"
echo "  --cpus=4 \\"
echo "  -p 3000:3000 \\"
echo "  $IMAGE_NAME:$LATEST_TAG"
echo ""
echo "2C4G环境 (低内存优化):"
echo "docker run -d \\"
echo "  --name url-checker \\"
echo "  --memory=4g \\"
echo "  --cpus=2 \\"
echo "  -p 3000:3000 \\"
echo "  -e MEMORY_LIMIT=2C4G \\"
echo "  -e LOW_MEMORY_MODE=true \\"
echo "  -e NODE_OPTIONS=\"--max-old-space-size=768\" \\"
echo "  -e MAX_CONCURRENT_REQUESTS=3 \\"
echo "  -e HTTP_TIMEOUT=15000 \\"
echo "  $IMAGE_NAME:$LATEST_TAG"
echo ""
echo "🎉 统一优化镜像构建完成！"

# 可选：推送到仓库
if [ "$1" = "--push" ]; then
    echo "📤 推送镜像到仓库..."
    docker push "$IMAGE_NAME:$TAG"
    docker push "$IMAGE_NAME:$LATEST_TAG"
    echo "✅ 镜像推送完成"
fi