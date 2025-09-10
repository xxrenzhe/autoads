#!/bin/bash

echo "⚡ Performance Optimization Script"
echo "================================="

# 1. Enable Node.js performance monitoring
export NODE_OPTIONS="--max-old-space-size=4096 --inspect=0.0.0.0:9229"

# 2. Check memory usage
echo "Memory Usage:"
node -e "console.log(process.memoryUsage())"

# 3. Enable production optimizations
export NODE_ENV=production

# 4. Set optimal worker count
CPU_COUNT=$(nproc)
export UV_THREADPOOL_SIZE=$((CPU_COUNT * 2))

echo "CPU Count: $CPU_COUNT"
echo "Thread Pool Size: $UV_THREADPOOL_SIZE"

# 5. Start application with optimizations
echo "Starting application with performance optimizations..."
npm run dev

echo "✅ Performance optimizations applied!"
