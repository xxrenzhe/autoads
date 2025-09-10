#!/bin/bash

# 智能启动脚本
# 自动检测容器环境并优化配置

set -e

echo "🚀 智能启动 AutoAds..."

# 1. 检测容器环境
echo "🔍 检测容器环境..."

# 获取容器内存
get_container_memory() {
    if [ -f /sys/fs/cgroup/memory.max ]; then
        MEMORY_BYTES=$(cat /sys/fs/cgroup/memory.max)
    elif [ -f /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
        MEMORY_BYTES=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
    else
        MEMORY_BYTES=$(grep MemTotal /proc/meminfo | awk '{print $2 * 1024}')
    fi
    
    if [ "$MEMORY_BYTES" = "9223372036854775807" ]; then
        MEMORY_BYTES=$(grep MemTotal /proc/meminfo | awk '{print $2 * 1024}')
    fi
    
    echo $((MEMORY_BYTES / 1024 / 1024))
}

# 获取容器CPU核心数
get_container_cpu() {
    # cgroup v2
    if [ -f /sys/fs/cgroup/cpu.max ]; then
        CPU_MAX=$(cat /sys/fs/cgroup/cpu.max)
        if [ "$CPU_MAX" = "max" ]; then
            # 无限制，返回宿主机核心数
            nproc
        else
            CPU_QUOTA=$(echo $CPU_MAX | cut -d' ' -f1)
            CPU_PERIOD=$(echo $CPU_MAX | cut -d' ' -f2)
            # 计算容器分配的CPU核心数
            echo $((CPU_QUOTA / CPU_PERIOD))
        fi
    # cgroup v1
    elif [ -f /sys/fs/cgroup/cpu/cpu.cfs_quota_us ] && [ -f /sys/fs/cgroup/cpu/cpu.cfs_period_us ]; then
        QUOTA=$(cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us)
        PERIOD=$(cat /sys/fs/cgroup/cpu/cpu.cfs_period_us)
        if [ "$QUOTA" = "-1" ]; then
            # 无限制，返回宿主机核心数
            nproc
        else
            # 计算容器分配的CPU核心数
            echo $((QUOTA / PERIOD))
        fi
    else
        # 无法获取cgroup信息，返回宿主机核心数
        nproc
    fi
}

MEMORY_MB=$(get_container_memory)
CPU_COUNT=$(get_container_cpu)

# CPU检测信息
echo "🔍 CPU检测:"
if [ -f /sys/fs/cgroup/cpu.max ]; then
    CPU_MAX_VALUE=$(cat /sys/fs/cgroup/cpu.max)
    echo "   cgroup v2: $CPU_MAX_VALUE"
elif [ -f /sys/fs/cgroup/cpu/cpu.cfs_quota_us ] && [ -f /sys/fs/cgroup/cpu/cpu.cfs_period_us ]; then
    QUOTA_VALUE=$(cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us)
    PERIOD_VALUE=$(cat /sys/fs/cgroup/cpu/cpu.cfs_period_us)
    echo "   cgroup v1 quota: $QUOTA_VALUE, period: $PERIOD_VALUE"
fi
echo "   容器分配CPU核心数: ${CPU_COUNT}"

echo "📊 容器资源:"
echo "   内存: ${MEMORY_MB}MB"
echo "   CPU: ${CPU_COUNT}核"

# 2. 动态配置内存
echo "🧠 配置内存优化..."

if [ $MEMORY_MB -ge 7168 ]; then
    # 8G+ 容器 - 高性能生产环境
    NODE_HEAP=4096
    SEMI_SPACE=256
    PROFILE="高性能生产环境(8G+)"
    export LOW_MEMORY_MODE=false
    export HIGH_PERFORMANCE_MODE=true
elif [ $MEMORY_MB -ge 3584 ]; then
    # 4G+ 容器 - 标准生产环境
    NODE_HEAP=2048
    SEMI_SPACE=128
    PROFILE="标准生产环境(4G+)"
    export LOW_MEMORY_MODE=false
    export HIGH_PERFORMANCE_MODE=false
elif [ $MEMORY_MB -ge 1792 ]; then
    # 2G+ 容器 - 预发环境
    NODE_HEAP=1024
    SEMI_SPACE=64
    PROFILE="预发环境(2G+)"
    export LOW_MEMORY_MODE=false
    export HIGH_PERFORMANCE_MODE=false
else
    # 小内存容器 - 开发环境
    NODE_HEAP=768
    SEMI_SPACE=32
    PROFILE="开发环境(<2G)"
    export LOW_MEMORY_MODE=true
    export HIGH_PERFORMANCE_MODE=false
fi

# 设置Node.js选项（根据内存大小优化）
if [ "$HIGH_PERFORMANCE_MODE" = "true" ]; then
    # 8G+ 高性能模式
    export NODE_OPTIONS="--max-old-space-size=$NODE_HEAP --max-semi-space-size=$SEMI_SPACE --gc-interval=50 --optimize-for-size=false"
else
    # 标准模式
    export NODE_OPTIONS="--max-old-space-size=$NODE_HEAP --max-semi-space-size=$SEMI_SPACE"
fi

echo "✅ 内存配置: $PROFILE"
echo "   堆内存: ${NODE_HEAP}MB"
echo "   Node选项: $NODE_OPTIONS"

# 3. 配置环境变量
echo "⚙️  配置环境变量..."

# 确保必要的环境变量
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export HOSTNAME=${HOSTNAME:-0.0.0.0}
export NEXT_TELEMETRY_DISABLED=1

# 根据部署环境设置默认值
if [ -z "$NEXT_PUBLIC_DEPLOYMENT_ENV" ]; then
    if [ $MEMORY_MB -ge 3584 ]; then
        export NEXT_PUBLIC_DEPLOYMENT_ENV=production
        export NEXT_PUBLIC_DOMAIN=${NEXT_PUBLIC_DOMAIN:-autoads.dev}
    else
        export NEXT_PUBLIC_DEPLOYMENT_ENV=preview
        export NEXT_PUBLIC_DOMAIN=${NEXT_PUBLIC_DOMAIN:-urlchecker.dev}
    fi
fi

# 8G+ 环境的特殊配置
if [ "$HIGH_PERFORMANCE_MODE" = "true" ]; then
    echo "⚡ 启用高性能模式配置..."
    export UV_THREADPOOL_SIZE=16
    export LIBUV_THREAD_POOL_SIZE=16
    export NODE_ENV=production
    export NEXT_SHARP=1
fi

echo "✅ 环境配置:"
echo "   NODE_ENV: $NODE_ENV"
echo "   DEPLOYMENT_ENV: $NEXT_PUBLIC_DEPLOYMENT_ENV"
echo "   DOMAIN: $NEXT_PUBLIC_DOMAIN"

# 4. 数据库检查
echo "🗄️  检查数据库连接..."
if [ -n "$DATABASE_URL" ]; then
    echo "✅ 数据库URL已配置"
else
    echo "⚠️  数据库URL未配置，某些功能可能受限"
fi

# 5. Redis检查
echo "🔗 检查Redis连接..."
if [ -n "$REDIS_URL" ]; then
    echo "✅ Redis URL已配置"
    export REDIS_ENABLED=true
else
    echo "⚠️  Redis未配置，将使用内存缓存"
    export REDIS_ENABLED=false
fi

# 6. 启动应用
echo ""
echo "🎯 启动配置总结:"
echo "=================="
echo "环境: $PROFILE"
echo "内存: ${NODE_HEAP}MB堆 + ${SEMI_SPACE}MB半空间"
echo "部署: $NEXT_PUBLIC_DEPLOYMENT_ENV ($NEXT_PUBLIC_DOMAIN)"
echo "数据库: $([ -n "$DATABASE_URL" ] && echo "已配置" || echo "未配置")"
echo "Redis: $([ -n "$REDIS_URL" ] && echo "已配置" || echo "内存模式")"
echo ""

echo "🚀 启动应用程序..."

# 启动Next.js应用
exec node server.js