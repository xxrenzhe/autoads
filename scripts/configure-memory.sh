#!/bin/bash

# 动态内存配置脚本
# 根据容器内存自动调整Node.js堆内存

set -e

echo "🧠 配置容器内存..."

# 获取容器内存限制
get_container_memory() {
    # 尝试多种方式获取内存限制
    if [ -f /sys/fs/cgroup/memory.max ]; then
        # cgroup v2
        MEMORY_BYTES=$(cat /sys/fs/cgroup/memory.max)
    elif [ -f /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
        # cgroup v1
        MEMORY_BYTES=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
    elif [ -f /proc/meminfo ]; then
        # Linux系统内存
        MEMORY_BYTES=$(grep MemTotal /proc/meminfo | awk '{print $2 * 1024}')
    else
        # macOS或其他系统 - 默认4G用于测试
        MEMORY_BYTES=$((4 * 1024 * 1024 * 1024))
        echo "⚠️  无法检测系统内存，使用默认4G进行测试" >&2
    fi
    
    # 处理无限制情况
    if [ "$MEMORY_BYTES" = "9223372036854775807" ]; then
        if [ -f /proc/meminfo ]; then
            MEMORY_BYTES=$(grep MemTotal /proc/meminfo | awk '{print $2 * 1024}')
        else
            MEMORY_BYTES=$((4 * 1024 * 1024 * 1024))
        fi
    fi
    
    echo $MEMORY_BYTES
}

# 计算内存配置
CONTAINER_MEMORY=$(get_container_memory)
MEMORY_GB=$((CONTAINER_MEMORY / 1024 / 1024 / 1024))
MEMORY_MB=$((CONTAINER_MEMORY / 1024 / 1024))

echo "📊 容器内存: ${MEMORY_MB}MB (${MEMORY_GB}GB)"

# 根据内存大小设置堆内存 (50%规则)
if [ $MEMORY_MB -ge 7168 ]; then
    # 8G+ 容器 - 高性能生产环境
    NODE_HEAP=4096
    SEMI_SPACE=256
    MEMORY_PROFILE="8G+高性能"
elif [ $MEMORY_MB -ge 3584 ]; then
    # 4G+ 容器 - 标准生产环境
    NODE_HEAP=2048
    SEMI_SPACE=128
    MEMORY_PROFILE="4G+标准"
elif [ $MEMORY_MB -ge 1792 ]; then
    # 2G+ 容器 - 预发环境
    NODE_HEAP=1024
    SEMI_SPACE=64
    MEMORY_PROFILE="2G+预发"
elif [ $MEMORY_MB -ge 896 ]; then
    # 1G+ 容器 - 开发环境
    NODE_HEAP=512
    SEMI_SPACE=32
    MEMORY_PROFILE="1G+开发"
else
    # 小内存容器 - 测试环境
    NODE_HEAP=256
    SEMI_SPACE=16
    MEMORY_PROFILE="小内存测试"
fi

echo "🎯 内存配置: $MEMORY_PROFILE"
echo "   堆内存: ${NODE_HEAP}MB"
echo "   半空间: ${SEMI_SPACE}MB"
if [ $MEMORY_MB -gt 0 ]; then
    echo "   使用率: $((NODE_HEAP * 100 / MEMORY_MB))%"
else
    echo "   使用率: N/A"
fi

# 设置Node.js选项
export NODE_OPTIONS="--max-old-space-size=$NODE_HEAP --max-semi-space-size=$SEMI_SPACE --gc-interval=100"

echo "✅ Node.js选项: $NODE_OPTIONS"

# 设置环境变量文件（如果需要）
if [ "$1" = "--export" ]; then
    echo "export NODE_OPTIONS=\"$NODE_OPTIONS\"" > /tmp/memory-config.env
    echo "📁 配置已保存到 /tmp/memory-config.env"
fi

# 显示最终配置
echo ""
echo "📋 最终内存配置:"
echo "=================="
echo "容器内存: ${MEMORY_MB}MB"
echo "堆内存: ${NODE_HEAP}MB (${NODE_HEAP}MB)"
echo "半空间: ${SEMI_SPACE}MB"
echo "配置文件: $MEMORY_PROFILE"
echo "Node选项: $NODE_OPTIONS"
echo ""