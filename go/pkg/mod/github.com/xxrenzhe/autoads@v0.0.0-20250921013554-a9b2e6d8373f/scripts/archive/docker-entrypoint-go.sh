#!/bin/bash
set -e

# 等待数据库就绪
wait_for_db() {
    echo "等待数据库连接..."
    until nc -z -v -w30 ${DB_HOST:-localhost} ${DB_PORT:-3306}
    do
        echo "等待 MySQL..."
        sleep 3
    done
    echo "数据库已就绪"
}

# 等待 Redis 就绪
wait_for_redis() {
    echo "等待 Redis 连接..."
    until nc -z -v -w30 ${REDIS_HOST:-localhost} ${REDIS_PORT:-6379}
    do
        echo "等待 Redis..."
        sleep 3
    done
    echo "Redis 已就绪"
}

# 运行数据库迁移
run_migrations() {
    if [ "$RUN_MIGRATIONS" = "true" ]; then
        echo "运行数据库迁移..."
        ./scripts/migrate.sh up
    fi
}

# 初始化应用
init_app() {
    # 创建日志目录
    mkdir -p /app/logs
    
    # 设置时区
    if [ ! -z "$TZ" ]; then
        ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
    fi
    
    # 打印启动信息
    echo "====================================="
    echo "AutoAds Go 版本: $(./autoads version)"
    echo "启动时间: $(date)"
    echo "环境: ${GIN_MODE:-release}"
    echo "端口: ${PORT:-8080}"
    echo "====================================="
}

# 主启动流程
main() {
    init_app
    
    # 根据环境决定是否等待依赖服务
    if [ "$SKIP_DEPENDENCY_CHECK" != "true" ]; then
        wait_for_db
        wait_for_redis
        run_migrations
    fi
    
    # 启动应用
    exec ./autoads "$@"
}

# 信号处理
trap 'echo "收到停止信号，正在关闭..."; exit 0' SIGTERM SIGINT

# 执行主函数
main "$@"