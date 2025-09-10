#!/bin/bash

# 内存优化的启动脚本
# 专为1GB内存容器优化

echo "==========================================="
echo "启动内存优化的ChangeLink AutoAds应用"
echo "==========================================="

# 设置Node.js内存限制（注意：--expose-gc 不能在 NODE_OPTIONS 中设置）
export NODE_OPTIONS="--max-old-space-size=640 --max-semi-space-size=64"

# 其他环境变量优化
export NEXT_TELEMETRY_DISABLED=1
export NODE_ENV=production

# 打印内存配置
echo "内存配置:"
echo "- Node.js最大堆内存: 640MB"
echo "- Node.js新生代内存: 64MB"
echo "- 禁用遥测: $NEXT_TELEMETRY_DISABLED"

# 创建日志目录
mkdir -p /app/logs

# 启动前清理旧日志（保留最近2个）
echo "清理旧日志文件..."
find /app/logs -name "*.log" -mtime +1 -delete 2>/dev/null || true

# 显示初始内存使用
echo "初始内存使用:"
node -e "const m = process.memoryUsage(); console.log(\`RSS: \${Math.round(m.rss/1024/1024)}MB, Heap: \${Math.round(m.heapUsed/1024/1024)}/\${Math.round(m.heapTotal/1024/1024)}MB\`)"

# 启动应用
echo "启动应用..."
echo "==========================================="

# 使用带GC暴露的Node.js启动（需要直接传递 --expose-gc 参数）
exec node --expose-gc node_modules/.bin/next start