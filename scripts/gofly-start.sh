#!/bin/bash

# GoFly + Next.js 启动脚本
# 适用于 Docker 容器环境

set -e

echo "🚀 启动 GoFly + Next.js 应用..."

# 检查必需的环境变量
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL 未设置，将使用默认值"
fi

if [ -z "$REDIS_URL" ]; then
    echo "⚠️  REDIS_URL 未设置，将使用默认值"
fi

# 等待数据库就绪（可选）
if [ ! -z "$DATABASE_URL" ]; then
    echo "📊 检查数据库连接..."
    # 简单的数据库连通性检查
    timeout 30s bash -c "until echo > /dev/tcp/${DB_HOST:-localhost}/${DB_PORT:-3306}; do sleep 1; done" 2>/dev/null || \
    echo "⚠️  数据库连接检查超时，继续启动..."
fi

# 启动 GoFly 后端（在后台运行）
echo "🔧 启动 GoFly 后端服务..."
cd /app
./main &
GO_PID=$!

# 等待 Go 服务启动
echo "⏳ 等待 GoFly 后端启动..."
sleep 5

# 检查 Go 服务是否成功启动
if ! kill -0 $GO_PID 2>/dev/null; then
    echo "❌ GoFly 后端启动失败"
    exit 1
fi

echo "✅ GoFly 后端已启动 (PID: $GO_PID)"

# 启动 Next.js 前端
echo "🌐 启动 Next.js 前端服务..."
NODE_OPTIONS="--max-old-space-size=2048 --max-semi-space-size=128" \
./scripts/optimized-start.sh &
NODE_PID=$!

# 等待任意一个进程退出
echo "🎯 服务已全部启动"
echo "   - GoFly 后端: http://localhost:8080"
echo "   - Next.js 前端: http://localhost:3000"

# 清理函数
cleanup() {
    echo "🛑 正在停止服务..."
    if [ ! -z "$GO_PID" ]; then
        kill $GO_PID 2>/dev/null || true
    fi
    if [ ! -z "$NODE_PID" ]; then
        kill $NODE_PID 2>/dev/null || true
    fi
    exit 0
}

# 捕获信号
trap cleanup TERM INT

# 等待任意进程退出
wait -n $GO_PID $NODE_PID
EXIT_CODE=$?

echo "⚠️  一个服务已退出，正在停止所有服务..."
cleanup

exit $EXIT_CODE