#!/bin/bash

# AutoClick Service Startup Script
# 初始化并启动所有AutoClick相关服务

echo "=== AutoClick Service Startup ==="
echo "Starting all AutoClick services..."

# 设置环境变量
export NODE_ENV=production

# 检查必要的环境变量
check_env() {
    echo "Checking environment variables..."
    
    required_vars=(
        "DATABASE_URL"
        "REDIS_HOST"
        "REDIS_PORT"
        "KAFKA_BROKERS"
        "Proxy_URL_US"
    )
    
    missing_vars=()
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo "Error: Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    echo "All required environment variables are set"
}

# 初始化数据库
init_database() {
    echo "Initializing database..."
    
    # 运行Prisma迁移
    npx prisma migrate deploy
    
    # 生成Prisma客户端
    npx prisma generate
    
    echo "Database initialized"
}

# 启动服务
start_services() {
    echo "Starting AutoClick services..."
    
    # 启动Next.js应用（这会自动初始化AutoClick调度器）
    echo "Starting Next.js application..."
    npm start &
    
    # 等待服务启动
    sleep 10
    
    # 检查服务状态
    echo "Checking service status..."
    
    # 检查健康检查端点
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "✅ Next.js service is running"
    else
        echo "❌ Next.js service failed to start"
        exit 1
    fi
    
    # 检查AutoClick调度器状态
    if curl -f http://localhost:3000/api/autoclick/status > /dev/null 2>&1; then
        echo "✅ AutoClick scheduler is running"
    else
        echo "❌ AutoClick scheduler failed to start"
        exit 1
    fi
    
    echo "All services started successfully"
}

# 显示服务信息
show_info() {
    echo ""
    echo "=== Service Information ==="
    echo "Next.js App: http://localhost:3000"
    echo "AutoClick Status: http://localhost:3000/api/autoclick/status"
    echo "Performance Metrics: http://localhost:3000/api/autoclick/metrics"
    echo ""
    echo "=== Service Logs ==="
    echo "To view logs, run:"
    echo "  journalctl -u autoclick -f"
    echo ""
}

# 主函数
main() {
    case "${1:-start}" in
        "check")
            check_env
            ;;
        "init-db")
            init_database
            ;;
        "start")
            check_env
            init_database
            start_services
            show_info
            ;;
        "status")
            echo "Checking AutoClick service status..."
            curl -s http://localhost:3000/api/autoclick/status | jq .
            ;;
        "metrics")
            echo "Getting performance metrics..."
            curl -s http://localhost:3000/api/autoclick/metrics | jq .
            ;;
        "stop")
            echo "Stopping AutoClick services..."
            pkill -f "next start"
            echo "Services stopped"
            ;;
        "restart")
            $0 stop
            sleep 5
            $0 start
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 {start|stop|restart|status|metrics|check|init-db|help}"
            echo ""
            echo "Commands:"
            echo "  start     Start all AutoClick services (default)"
            echo "  stop      Stop all services"
            echo "  restart   Restart all services"
            echo "  status    Check service status"
            echo "  metrics   Get performance metrics"
            echo "  check     Check environment variables"
            echo "  init-db   Initialize database"
            echo "  help      Show this help message"
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|status|metrics|check|init-db|help}"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"