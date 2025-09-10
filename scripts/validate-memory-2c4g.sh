#!/bin/bash

# 2C4G 环境内存验证脚本
# 专门针对 ClawCloud 2C4G 环境优化

echo "🔍 Validating 2C4G memory configuration..."

# 获取系统内存信息
if [ -f /proc/meminfo ]; then
    TOTAL_MEMORY_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    AVAILABLE_MEMORY_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    FREE_MEMORY_KB=$(grep MemFree /proc/meminfo | awk '{print $2}')
    
    TOTAL_MEMORY_MB=$((TOTAL_MEMORY_KB / 1024))
    AVAILABLE_MEMORY_MB=$((AVAILABLE_MEMORY_KB / 1024))
    FREE_MEMORY_MB=$((FREE_MEMORY_KB / 1024))
    
    echo "📊 Memory Status:"
    echo "  Total: ${TOTAL_MEMORY_MB}MB"
    echo "  Available: ${AVAILABLE_MEMORY_MB}MB"
    echo "  Free: ${FREE_MEMORY_MB}MB"
else
    echo "⚠️  Cannot read /proc/meminfo, using default settings"
    TOTAL_MEMORY_MB=4096
    AVAILABLE_MEMORY_MB=3500
fi

# 检查容器内存限制
if [ -f /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
    CONTAINER_MEMORY_BYTES=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
    # 处理无限制的情况 (9223372036854775807)
    if [ $CONTAINER_MEMORY_BYTES -gt 9000000000000000000 ]; then
        echo "📦 Container: No memory limit set"
        CONTAINER_MEMORY_MB=$TOTAL_MEMORY_MB
    else
        CONTAINER_MEMORY_MB=$((CONTAINER_MEMORY_BYTES / 1024 / 1024))
        echo "📦 Container limit: ${CONTAINER_MEMORY_MB}MB"
    fi
else
    echo "📦 Container: Memory limit not available"
    CONTAINER_MEMORY_MB=$TOTAL_MEMORY_MB
fi

# 计算推荐的 Node.js 内存设置
# 为系统和其他进程保留内存
SYSTEM_RESERVED=512
RECOMMENDED_MAX_OLD_SPACE=$((CONTAINER_MEMORY_MB - SYSTEM_RESERVED))

# 2C4G 环境的安全设置
if [ $CONTAINER_MEMORY_MB -le 4096 ]; then
    # 4GB 或更少，使用保守设置
    RECOMMENDED_MAX_OLD_SPACE=768
    RECOMMENDED_SEMI_SPACE=32
    echo "🎯 2C4G detected: Using conservative memory settings"
elif [ $CONTAINER_MEMORY_MB -le 2048 ]; then
    # 2GB 或更少，使用极保守设置
    RECOMMENDED_MAX_OLD_SPACE=512
    RECOMMENDED_SEMI_SPACE=16
    echo "⚠️  Low memory detected: Using minimal settings"
else
    # 更大内存，可以使用更高设置
    RECOMMENDED_SEMI_SPACE=64
    echo "✅ Adequate memory: Using standard settings"
fi

echo "🔧 Recommended Node.js settings:"
echo "  --max-old-space-size=${RECOMMENDED_MAX_OLD_SPACE}"
echo "  --max-semi-space-size=${RECOMMENDED_SEMI_SPACE}"

# 检查当前的 NODE_OPTIONS
if [ -n "$NODE_OPTIONS" ]; then
    echo "📋 Current NODE_OPTIONS: $NODE_OPTIONS"
    
    # 提取当前的 max-old-space-size
    CURRENT_MAX_OLD_SPACE=$(echo $NODE_OPTIONS | grep -o '\--max-old-space-size=[0-9]*' | cut -d= -f2)
    
    if [ -n "$CURRENT_MAX_OLD_SPACE" ]; then
        if [ $CURRENT_MAX_OLD_SPACE -gt $RECOMMENDED_MAX_OLD_SPACE ]; then
            echo "⚠️  WARNING: Current setting (${CURRENT_MAX_OLD_SPACE}MB) exceeds recommendation (${RECOMMENDED_MAX_OLD_SPACE}MB)"
            echo "   This may cause OOM kills in 2C4G environment"
            
            # 自动调整到安全值
            export NODE_OPTIONS="--max-old-space-size=${RECOMMENDED_MAX_OLD_SPACE} --max-semi-space-size=${RECOMMENDED_SEMI_SPACE}"
            echo "🔄 Auto-adjusted NODE_OPTIONS: $NODE_OPTIONS"
        else
            echo "✅ Current memory setting is within safe limits"
        fi
    fi
else
    # 设置推荐的 NODE_OPTIONS
    export NODE_OPTIONS="--max-old-space-size=${RECOMMENDED_MAX_OLD_SPACE} --max-semi-space-size=${RECOMMENDED_SEMI_SPACE}"
    echo "🔄 Set NODE_OPTIONS: $NODE_OPTIONS"
fi

# 检查可用内存是否足够启动应用
MIN_REQUIRED_MB=1024
if [ $AVAILABLE_MEMORY_MB -lt $MIN_REQUIRED_MB ]; then
    echo "❌ ERROR: Insufficient memory available (${AVAILABLE_MEMORY_MB}MB < ${MIN_REQUIRED_MB}MB)"
    echo "   The application may fail to start or crash during startup"
    exit 1
fi

echo "✅ Memory validation completed successfully"
echo "💡 Tips for 2C4G environment:"
echo "   - Monitor memory usage during startup"
echo "   - Consider disabling non-essential features"
echo "   - Use Redis for caching to reduce memory pressure"
echo "   - Implement graceful degradation for memory-intensive operations"

exit 0