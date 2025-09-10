#!/bin/bash

# Pre-startup Memory Validation Script
# 在应用启动前验证内存配置

echo "Validating memory configuration..."

# 获取容器内存限制（如果在容器中运行）
if [ -f /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
    CONTAINER_MEMORY_BYTES=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
    CONTAINER_MEMORY_MB=$((CONTAINER_MEMORY_BYTES / 1024 / 1024))
    echo "Container memory limit: ${CONTAINER_MEMORY_MB}MB"
    
    # 计算推荐的Node.js内存设置
    # 保留512MB给系统和其他进程
    RECOMMENDED_MAX_OLD_SPACE=$((CONTAINER_MEMORY_MB - 512))
    
    if [ $RECOMMENDED_MAX_OLD_SPACE -lt 1024 ]; then
        RECOMMENDED_MAX_OLD_SPACE=1024
    fi
    
    echo "Recommended --max-old-space-size: ${RECOMMENDED_MAX_OLD_SPACE}MB"
    
    # 检查当前的NODE_OPTIONS
    if [ -n "$NODE_OPTIONS" ]; then
        echo "Current NODE_OPTIONS: $NODE_OPTIONS"
        
        # 提取当前的max-old-space-size
        CURRENT_MAX_OLD_SPACE=$(echo $NODE_OPTIONS | grep -o --max-old-space-size=[0-9]* | cut -d= -f2)
        
        if [ -n "$CURRENT_MAX_OLD_SPACE" ]; then
            if [ $CURRENT_MAX_OLD_SPACE -gt $CONTAINER_MEMORY_MB ]; then
                echo "⚠️  WARNING: Node.js memory setting (${CURRENT_MAX_OLD_SPACE}MB) exceeds container limit (${CONTAINER_MEMORY_MB}MB)"
                echo "   This may cause container crashes"
            fi
        fi
    fi
fi

# 检查系统内存
echo "System memory information:"
free -h

echo "Memory validation complete."