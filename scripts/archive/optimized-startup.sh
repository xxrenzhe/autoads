#!/bin/bash

# 优化启动脚本
# 优先使用外部Redis集群，内存优化，性能提升

set -e

echo "🚀 启动优化系统..."

# 1. 环境检测
echo "📋 检测运行环境..."

# 检测内存限制
TOTAL_MEMORY=$(free -m 2>/dev/null | awk 'NR==2{printf "%.0f", $2}' || echo "unknown")
if [ "$TOTAL_MEMORY" != "unknown" ] && [ "$TOTAL_MEMORY" -lt 5000 ]; then
    echo "⚠️  检测到低内存环境: ${TOTAL_MEMORY}MB"
    export LOW_MEMORY_MODE=true
    export MEMORY_LIMIT=2C4G
else
    echo "✅ 标准内存环境: ${TOTAL_MEMORY}MB"
fi

# 2. Redis连接优化
echo "🔗 优化Redis连接..."

if [ -n "$REDIS_URL" ]; then
    echo "✅ 检测到REDIS_URL环境变量"
    
    # 检查是否为集群配置
    if [[ "$REDIS_URL" == *","* ]]; then
        echo "🔄 检测到Redis集群配置"
        export REDIS_CLUSTER_MODE=true
        
        # 计算节点数量
        NODE_COUNT=$(echo "$REDIS_URL" | tr ',' '\n' | wc -l)
        echo "📊 Redis集群节点数: $NODE_COUNT"
    else
        echo "🔗 单节点Redis配置"
        export REDIS_CLUSTER_MODE=false
    fi
    
    # 测试Redis连接
    echo "🧪 测试Redis连接..."
    if command -v redis-cli >/dev/null 2>&1; then
        # 提取第一个Redis URL进行测试
        FIRST_REDIS_URL=$(echo "$REDIS_URL" | cut -d',' -f1)
        
        # 解析Redis URL
        REDIS_HOST=$(echo "$FIRST_REDIS_URL" | sed -n 's|redis://[^@]*@\([^:]*\):.*|\1|p')
        REDIS_PORT=$(echo "$FIRST_REDIS_URL" | sed -n 's|redis://[^@]*@[^:]*:\([0-9]*\).*|\1|p')
        REDIS_PASSWORD=$(echo "$FIRST_REDIS_URL" | sed -n 's|redis://[^:]*:\([^@]*\)@.*|\1|p')
        
        if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
            if timeout 5 redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping >/dev/null 2>&1; then
                echo "✅ Redis连接测试成功"
                export REDIS_CONNECTION_STATUS=connected
            else
                echo "⚠️  Redis连接测试失败，将使用fallback"
                export REDIS_CONNECTION_STATUS=fallback
            fi
        else
            echo "⚠️  无法解析Redis URL，将使用fallback"
            export REDIS_CONNECTION_STATUS=fallback
        fi
    else
        echo "ℹ️  redis-cli不可用，跳过连接测试"
        export REDIS_CONNECTION_STATUS=unknown
    fi
else
    echo "⚠️  未配置REDIS_URL，将使用内存缓存"
    export REDIS_CONNECTION_STATUS=disabled
fi

# 3. Node.js内存优化
echo "💾 配置Node.js内存优化..."

# 根据环境设置内存限制
if [ "$LOW_MEMORY_MODE" = "true" ]; then
    # 2C4G环境优化
    export NODE_OPTIONS="--max-old-space-size=768 --max-semi-space-size=64 --optimize-for-size --gc-interval=100"
    echo "🔧 低内存模式: 768MB堆内存"
else
    # 标准环境
    export NODE_OPTIONS="--max-old-space-size=1536 --max-semi-space-size=128 --optimize-for-size"
    echo "🔧 标准模式: 1536MB堆内存"
fi

# 启用垃圾回收暴露
export NODE_OPTIONS="$NODE_OPTIONS --expose-gc"

# 4. 应用程序配置优化
echo "⚙️  优化应用程序配置..."

# 并发控制
if [ "$LOW_MEMORY_MODE" = "true" ]; then
    export MAX_CONCURRENT_REQUESTS=3
    export HTTP_TIMEOUT=15000
    export BATCH_SIZE=20
else
    export MAX_CONCURRENT_REQUESTS=5
    export HTTP_TIMEOUT=30000
    export BATCH_SIZE=50
fi

# 缓存配置
export CACHE_TTL=1800  # 30分钟
export CACHE_MAX_SIZE=1000

# 5. 启动前检查
echo "🔍 启动前检查..."

# 检查必要的环境变量
REQUIRED_VARS=("DATABASE_URL" "NEXTAUTH_SECRET")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ 缺少必要环境变量: $var"
        exit 1
    else
        echo "✅ $var 已配置"
    fi
done

# 检查端口可用性
PORT=${PORT:-3000}
if command -v lsof >/dev/null 2>&1; then
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  端口 $PORT 已被占用"
        # 尝试找到可用端口
        for i in {3001..3010}; do
            if ! lsof -Pi :$i -sTCP:LISTEN -t >/dev/null 2>&1; then
                export PORT=$i
                echo "🔄 使用替代端口: $PORT"
                break
            fi
        done
    else
        echo "✅ 端口 $PORT 可用"
    fi
fi

# 6. 性能监控设置
echo "📊 设置性能监控..."

# 启用性能监控
export ENABLE_PERFORMANCE_MONITORING=true
export MEMORY_CHECK_INTERVAL=30000  # 30秒
export CACHE_CLEANUP_INTERVAL=300000  # 5分钟

# 7. 启动应用程序
echo "🎯 启动应用程序..."

# 显示最终配置
echo ""
echo "📋 启动配置摘要:"
echo "=================="
echo "内存模式: $([ "$LOW_MEMORY_MODE" = "true" ] && echo "低内存(2C4G)" || echo "标准")"
echo "Node内存: $(echo "$NODE_OPTIONS" | grep -o 'max-old-space-size=[0-9]*' | cut -d'=' -f2)MB"
echo "Redis状态: $REDIS_CONNECTION_STATUS"
echo "并发限制: $MAX_CONCURRENT_REQUESTS"
echo "端口: $PORT"
echo "=================="
echo ""

# 启动应用
if [ "$NODE_ENV" = "production" ]; then
    echo "🚀 生产模式启动..."
    exec npm start
else
    echo "🛠️  开发模式启动..."
    exec npm run dev
fi