#!/bin/bash

# Docker Logging Enhancement Script
# 确保Docker容器中的所有日志都被正确捕获到output.log

set -e

echo "==========================================="
echo "Starting ChangeLink AutoAds Application..."
echo "Node: $(node --version)"
echo "Environment: ${NODE_ENV:-development}"
echo "Port: ${PORT:-3000}"
echo "==========================================="

# 创建日志目录（使用绝对路径）
mkdir -p /app/logs

# 确保日志文件存在并具有正确的权限
touch /app/logs/output.log
chmod 644 /app/logs/output.log

# 创建软链接到相对路径，以兼容应用中的相对路径引用
if [ ! -L "./logs" ]; then
  ln -sf /app/logs ./logs
fi

# 设置环境变量以增强日志捕获
export NODE_ENV=${NODE_ENV:-production}
export FORCE_COLOR=0  # 禁用颜色输出，使日志更清晰

# 初始化内存使用日志
echo "Initial memory usage:"
node -e "console.log('Memory:', 'RSS:', Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB', 'HeapTotal:', Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB', 'HeapUsed:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB')"

echo "==========================================="
echo "Starting application server with GC optimization..."

# 启动Next.js应用，将所有输出重定向到output.log
# 使用exec确保信号正确传递
exec npm start 2>&1 | tee -a logs/output.log