#!/bin/bash

# 健康检查脚本
set -e

ENVIRONMENT=${1:-preview}
MAX_RETRIES=${2:-30}
RETRY_INTERVAL=${3:-10}

echo "🏥 执行健康检查 (环境: $ENVIRONMENT)"
echo "=================================="

# 根据环境设置URL
case $ENVIRONMENT in
    "development")
        URL="http://localhost:3000"
        ;;
    "preview")
        URL="https://urlchecker.dev"
        ;;
    "production")
        URL="https://autoads.dev"
        ;;
    *)
        echo "❌ 无效的环境: $ENVIRONMENT"
        exit 1
        ;;
esac

HEALTH_URL="$URL/api/health"

echo "检查URL: $HEALTH_URL"
echo "最大重试次数: $MAX_RETRIES"
echo "重试间隔: ${RETRY_INTERVAL}秒"
echo ""

# 健康检查函数
check_health() {
    local response
    local status_code
    
    response=$(curl -s -w "%{http_code}" "$HEALTH_URL" || echo "000")
    status_code="${response: -3}"
    
    if [ "$status_code" = "200" ]; then
        echo "✅ 健康检查通过 (HTTP $status_code)"
        return 0
    else
        echo "❌ 健康检查失败 (HTTP $status_code)"
        return 1
    fi
}

# 详细健康检查
detailed_health_check() {
    echo "📊 执行详细健康检查..."
    
    local response
    response=$(curl -s "$HEALTH_URL" || echo '{"error": "connection_failed"}')
    
    echo "健康检查响应:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
    
    # 解析响应
    local status
    status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "unknown")
    
    case $status in
        "healthy")
            echo "✅ 系统状态: 健康"
            return 0
            ;;
        "unhealthy")
            echo "❌ 系统状态: 不健康"
            return 1
            ;;
        "warning")
            echo "⚠️  系统状态: 警告"
            return 0
            ;;
        *)
            echo "❓ 系统状态: 未知"
            return 1
            ;;
    esac
}

# 等待服务启动
echo "⏳ 等待服务启动..."
retry_count=0

while [ $retry_count -lt $MAX_RETRIES ]; do
    echo "尝试 $((retry_count + 1))/$MAX_RETRIES..."
    
    if check_health; then
        echo ""
        detailed_health_check
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "🎉 健康检查完成! 服务正常运行"
            exit 0
        fi
    fi
    
    retry_count=$((retry_count + 1))
    
    if [ $retry_count -lt $MAX_RETRIES ]; then
        echo "等待 ${RETRY_INTERVAL}秒 后重试..."
        sleep $RETRY_INTERVAL
    fi
done

echo ""
echo "❌ 健康检查失败! 服务在 $((MAX_RETRIES * RETRY_INTERVAL)) 秒内未能正常启动"
echo ""
echo "🔍 故障排除建议:"
echo "1. 检查服务日志: docker-compose logs app"
echo "2. 检查数据库连接: docker-compose logs db"
echo "3. 检查Redis连接: docker-compose logs redis"
echo "4. 验证环境变量配置"
echo "5. 检查端口是否被占用"

exit 1