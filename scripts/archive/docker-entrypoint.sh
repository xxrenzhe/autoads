#!/bin/bash

# Docker Entrypoint Script
# 容器启动脚本，确保日志系统正确初始化

set -e

echo "🚀 Starting URL Checker application..."

# 创建日志目录
echo "📁 Creating logs directory..."
mkdir -p /app/logs
chmod 755 /app/logs

# 创建初始日志文件
echo "📝 Initializing log files..."
echo "# app.log - Created at $(date -u +"%Y-%m-%dT%H:%M:%SZ")" > /app/logs/app.log
echo "# output.log - Created at $(date -u +"%Y-%m-%dT%H:%M:%SZ")" > /app/logs/output.log

# 设置日志文件权限
chmod 644 /app/logs/*.log

# 设置环境变量
export NODE_ENV=${NODE_ENV:-production}
export DOCKER_ENV=true
export RUNNING_IN_DOCKER=true

echo "🔧 Environment: $NODE_ENV"
echo "📂 Log directory: /app/logs"
echo "📊 Log files initialized:"
ls -la /app/logs/

# 启动应用程序
echo "🎯 Starting Next.js application..."

# 如果是生产环境，使用优化的启动命令
if [ "$NODE_ENV" = "production" ]; then
    echo "🏭 Production mode: Starting optimized server..."
    
    # 启动服务器（后台运行）
    node server.js &
    SERVER_PID=$!
    
    # 等待服务器启动
    echo "⏳ Waiting for server to start..."
    sleep 10
    
    # 检查服务器健康状态
    echo "🔍 Checking server health..."
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "✅ Server is healthy"
    else
        echo "⚠️  Health check failed, but continuing..."
    fi
    
    # 等待后台进程
    wait $SERVER_PID
else
    echo "🛠️  Development mode: Starting with npm"
    exec npm run dev
fi