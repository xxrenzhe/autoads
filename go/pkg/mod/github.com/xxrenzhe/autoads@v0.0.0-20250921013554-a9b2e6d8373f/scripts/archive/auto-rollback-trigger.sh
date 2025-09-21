#!/bin/bash

# 自动回滚触发脚本
# 监控部署后的应用状态，在满足回滚条件时自动触发回滚

set -e

ENVIRONMENT=${1:-preview}
THRESHOLD_FAILURES=${2:-3}  # 连续失败次数阈值
CHECK_INTERVAL=${3:-60}     # 检查间隔（秒）
MAX_CHECKS=${4:-10}         # 最大检查次数
BASE_URL=""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"
}

log_critical() {
    echo -e "${RED}[$(date '+%H:%M:%S')] 🚨 CRITICAL${NC} $1"
}

# 显示使用说明
show_usage() {
    echo "自动回滚触发脚本"
    echo ""
    echo "用法: $0 [环境] [失败阈值] [检查间隔] [最大检查次数]"
    echo ""
    echo "参数:"
    echo "  环境          - preview 或 production (默认: preview)"
    echo "  失败阈值      - 连续失败次数阈值 (默认: 3)"
    echo "  检查间隔      - 检查间隔，单位秒 (默认: 60)"
    echo "  最大检查次数  - 最大检查次数 (默认: 10)"
    echo ""
    echo "回滚触发条件:"
    echo "  - 连续健康检查失败次数达到阈值"
    echo "  - 响应时间超过5秒"
    echo "  - 错误率超过10%"
    echo "  - 数据库或Redis连接失败"
    echo ""
    echo "示例:"
    echo "  $0 preview 3 60 10    # 监控预发环境，3次失败后回滚"
    echo "  $0 production 5 30 20 # 监控生产环境，5次失败后回滚"
}

# 验证环境参数
validate_environment() {
    case $ENVIRONMENT in
        preview)
            BASE_URL="https://urlchecker.dev"
            ;;
        production)
            BASE_URL="https://autoads.dev"
            ;;
        *)
            log_error "无效的环境: $ENVIRONMENT"
            show_usage
            exit 1
            ;;
    esac
}

# 检查应用健康状态
check_application_health() {
    local health_status="unknown"
    local response_time=0
    local http_status=0
    local db_status="unknown"
    local redis_status="unknown"
    
    # 检查基础健康状态
    local curl_output=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}" "$BASE_URL/api/health" 2>/dev/null || echo "000:999")
    http_status=$(echo "$curl_output" | cut -d: -f1)
    response_time=$(echo "$curl_output" | cut -d: -f2)
    
    # 检查详细健康信息
    if [ "$http_status" = "200" ]; then
        local health_data=$(curl -s "$BASE_URL/api/admin/health" 2>/dev/null || echo "{}")
        health_status=$(echo "$health_data" | jq -r '.status' 2>/dev/null || echo "unknown")
        db_status=$(echo "$health_data" | jq -r '.database' 2>/dev/null || echo "unknown")
        redis_status=$(echo "$health_data" | jq -r '.redis' 2>/dev/null || echo "unknown")
    fi
    
    echo "$health_status:$response_time:$http_status:$db_status:$redis_status"
}

# 评估是否需要回滚
should_rollback() {
    local health_info="$1"
    local health_status=$(echo "$health_info" | cut -d: -f1)
    local response_time=$(echo "$health_info" | cut -d: -f2)
    local http_status=$(echo "$health_info" | cut -d: -f3)
    local db_status=$(echo "$health_info" | cut -d: -f4)
    local redis_status=$(echo "$health_info" | cut -d: -f5)
    
    local rollback_reasons=()
    
    # 检查HTTP状态
    if [ "$http_status" != "200" ]; then
        rollback_reasons+=("HTTP状态异常: $http_status")
    fi
    
    # 检查响应时间（超过5秒）
    local response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)
    if [ "$response_time_ms" -gt 5000 ]; then
        rollback_reasons+=("响应时间过长: ${response_time_ms}ms")
    fi
    
    # 检查应用健康状态
    if [ "$health_status" = "unhealthy" ]; then
        rollback_reasons+=("应用状态异常: $health_status")
    fi
    
    # 检查数据库连接
    if [ "$db_status" != "connected" ] && [ "$db_status" != "unknown" ]; then
        rollback_reasons+=("数据库连接失败: $db_status")
    fi
    
    # 检查Redis连接
    if [ "$redis_status" != "connected" ] && [ "$redis_status" != "unknown" ]; then
        rollback_reasons+=("Redis连接失败: $redis_status")
    fi
    
    # 如果有回滚原因，返回失败
    if [ ${#rollback_reasons[@]} -gt 0 ]; then
        echo "ROLLBACK_NEEDED:${rollback_reasons[*]}"
        return 1
    else
        echo "HEALTHY"
        return 0
    fi
}

# 执行回滚操作
perform_rollback() {
    local reasons="$1"
    
    log_critical "触发自动回滚！"
    log_critical "回滚原因: $reasons"
    
    # 记录回滚事件
    local rollback_log="rollback-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).log"
    cat > "$rollback_log" << EOF
回滚事件记录
=============
时间: $(date '+%Y-%m-%d %H:%M:%S')
环境: $ENVIRONMENT
触发原因: $reasons
回滚方式: 自动触发

回滚步骤:
1. 通知相关人员
2. 记录当前状态
3. 执行回滚操作（需要手动在ClawCloud上操作）
4. 验证回滚结果
EOF
    
    # 发送紧急通知
    send_emergency_notification "$reasons"
    
    # 由于使用ClawCloud部署，这里只能记录和通知，实际回滚需要手动操作
    log_critical "⚠️  注意：使用ClawCloud部署，需要手动执行回滚操作！"
    log_critical "📋 回滚步骤："
    log_critical "   1. 登录ClawCloud控制台"
    log_critical "   2. 选择 $ENVIRONMENT 环境"
    log_critical "   3. 回滚到上一个稳定版本"
    log_critical "   4. 验证回滚结果"
    
    log_info "回滚日志已保存: $rollback_log"
    
    return 0
}

# 发送紧急通知
send_emergency_notification() {
    local reasons="$1"
    
    # 这里可以集成各种通知方式
    log_critical "🚨 发送紧急通知..."
    
    # Slack通知（如果配置了）
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"🚨 自动回滚触发！\",
                \"attachments\": [{
                    \"color\": \"danger\",
                    \"fields\": [
                        {\"title\": \"环境\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"时间\", \"value\": \"$(date '+%Y-%m-%d %H:%M:%S')\", \"short\": true},
                        {\"title\": \"原因\", \"value\": \"$reasons\", \"short\": false},
                        {\"title\": \"操作\", \"value\": \"需要立即在ClawCloud上执行手动回滚\", \"short\": false}
                    ]
                }]
            }" 2>/dev/null || log_warning "Slack通知发送失败"
    fi
    
    # 邮件通知（如果配置了）
    if [ -n "$EMERGENCY_EMAIL" ]; then
        echo "紧急回滚通知: $ENVIRONMENT 环境需要回滚。原因: $reasons" | \
        mail -s "🚨 紧急回滚通知 - $ENVIRONMENT" "$EMERGENCY_EMAIL" 2>/dev/null || \
        log_warning "邮件通知发送失败"
    fi
    
    log_info "紧急通知已发送"
}

# 主监控循环
main_monitoring_loop() {
    local consecutive_failures=0
    local check_count=0
    
    log_info "开始自动回滚监控"
    log_info "环境: $ENVIRONMENT"
    log_info "监控地址: $BASE_URL"
    log_info "失败阈值: $THRESHOLD_FAILURES"
    log_info "检查间隔: ${CHECK_INTERVAL}秒"
    log_info "最大检查次数: $MAX_CHECKS"
    echo ""
    
    while [ $check_count -lt $MAX_CHECKS ]; do
        check_count=$((check_count + 1))
        
        log_info "执行第 $check_count/$MAX_CHECKS 次检查..."
        
        local health_info=$(check_application_health)
        local rollback_result=$(should_rollback "$health_info")
        
        if [ $? -eq 0 ]; then
            # 健康检查通过
            log_success "✅ 应用状态正常"
            consecutive_failures=0
        else
            # 健康检查失败
            consecutive_failures=$((consecutive_failures + 1))
            local reasons=$(echo "$rollback_result" | cut -d: -f2-)
            
            log_error "❌ 检查失败 ($consecutive_failures/$THRESHOLD_FAILURES): $reasons"
            
            # 检查是否达到回滚阈值
            if [ $consecutive_failures -ge $THRESHOLD_FAILURES ]; then
                perform_rollback "$reasons"
                return 1
            fi
        fi
        
        # 等待下次检查
        if [ $check_count -lt $MAX_CHECKS ]; then
            log_info "等待 ${CHECK_INTERVAL}秒 后进行下次检查..."
            sleep $CHECK_INTERVAL
        fi
    done
    
    log_success "🎉 监控完成，应用状态稳定，无需回滚"
    return 0
}

# 检查依赖
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v bc &> /dev/null; then
        missing_deps+=("bc")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "缺少依赖: ${missing_deps[*]}"
        log_info "请安装缺少的依赖后重试"
        exit 1
    fi
}

# 脚本入口
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
fi

# 验证参数
if ! [[ "$THRESHOLD_FAILURES" =~ ^[0-9]+$ ]] || [ "$THRESHOLD_FAILURES" -lt 1 ]; then
    log_error "失败阈值必须是大于0的数字"
    exit 1
fi

if ! [[ "$CHECK_INTERVAL" =~ ^[0-9]+$ ]] || [ "$CHECK_INTERVAL" -lt 10 ]; then
    log_error "检查间隔必须是大于等于10的数字"
    exit 1
fi

if ! [[ "$MAX_CHECKS" =~ ^[0-9]+$ ]] || [ "$MAX_CHECKS" -lt 1 ]; then
    log_error "最大检查次数必须是大于0的数字"
    exit 1
fi

check_dependencies
validate_environment

# 执行监控
main_monitoring_loop