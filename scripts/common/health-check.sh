#!/bin/bash

# AutoAds SaaS 健康检查脚本
# 使用方法: ./scripts/health-check.sh [preview|production|local]

set -e

# 配置
ENVIRONMENT=${1:-preview}
TIMEOUT=10
MAX_RETRIES=3

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 获取基础URL
get_base_url() {
    case $ENVIRONMENT in
        production)
            echo "https://www.autoads.dev"
            ;;
        preview)
            echo "https://www.urlchecker.dev"
            ;;
        local)
            echo "http://localhost:8888"
            ;;
        *)
            log_error "未知环境: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# 执行HTTP请求
make_request() {
    local url=$1
    local expected_status=${2:-200}
    local retry_count=0
    
    while [[ $retry_count -lt $MAX_RETRIES ]]; do
        local response=$(curl -s -w "%{http_code}|%{time_total}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000|0")
        local status_code=$(echo "$response" | cut -d'|' -f1)
        local response_time=$(echo "$response" | cut -d'|' -f2)
        
        if [[ "$status_code" == "$expected_status" ]]; then
            echo "$response_time"
            return 0
        fi
        
        ((retry_count++))
        if [[ $retry_count -lt $MAX_RETRIES ]]; then
            log_debug "请求失败 (状态码: $status_code)，重试 $retry_count/$MAX_RETRIES"
            sleep 2
        fi
    done
    
    log_error "请求失败: $url (状态码: $status_code)"
    return 1
}

# 检查健康状态
check_health() {
    local base_url=$(get_base_url)
    local health_url="$base_url/health"
    
    log_info "检查健康状态: $health_url"
    
    local response_time=$(make_request "$health_url")
    if [[ $? -eq 0 ]]; then
        log_info "✅ 健康检查通过 (响应时间: ${response_time}s)"
        
        # 获取详细健康信息
        local health_data=$(curl -s --max-time $TIMEOUT "$health_url" 2>/dev/null)
        if [[ -n "$health_data" ]]; then
            echo "$health_data" | jq '.' 2>/dev/null || echo "$health_data"
        fi
        
        return 0
    else
        log_error "❌ 健康检查失败"
        return 1
    fi
}

# 检查API可用性
check_api() {
    local base_url=$(get_base_url)
    local api_url="$base_url/api/health"
    
    log_info "检查API可用性: $api_url"
    
    local response_time=$(make_request "$api_url")
    if [[ $? -eq 0 ]]; then
        log_info "✅ API检查通过 (响应时间: ${response_time}s)"
        return 0
    else
        log_error "❌ API检查失败"
        return 1
    fi
}

# 检查前端可用性
check_frontend() {
    local base_url=$(get_base_url)
    
    log_info "检查前端可用性: $base_url"
    
    local response_time=$(make_request "$base_url")
    if [[ $? -eq 0 ]]; then
        log_info "✅ 前端检查通过 (响应时间: ${response_time}s)"
        return 0
    else
        log_error "❌ 前端检查失败"
        return 1
    fi
}

# 检查WebSocket连接
check_websocket() {
    local base_url=$(get_base_url)
    local ws_url="${base_url/http/ws}/ws"
    
    log_info "检查WebSocket连接: $ws_url"
    
    # 使用websocat或wscat检查WebSocket（如果可用）
    if command -v websocat >/dev/null 2>&1; then
        timeout 5 websocat "$ws_url" --text --exit-on-eof <<<'{"type":"ping"}' >/dev/null 2>&1
        if [[ $? -eq 0 ]]; then
            log_info "✅ WebSocket检查通过"
            return 0
        else
            log_warn "⚠️  WebSocket检查失败（可能正常，取决于认证要求）"
            return 0  # 不作为致命错误
        fi
    else
        log_debug "跳过WebSocket检查（websocat未安装）"
        return 0
    fi
}

# 性能测试
performance_test() {
    local base_url=$(get_base_url)
    
    log_info "执行性能测试..."
    
    # 测试多个端点的响应时间
    local endpoints=("/" "/health" "/api/health")
    local total_time=0
    local test_count=0
    
    for endpoint in "${endpoints[@]}"; do
        local url="$base_url$endpoint"
        log_debug "测试: $url"
        
        local response_time=$(make_request "$url")
        if [[ $? -eq 0 ]]; then
            total_time=$(echo "$total_time + $response_time" | bc -l)
            ((test_count++))
            
            # 检查响应时间是否超过阈值
            if (( $(echo "$response_time > 2.0" | bc -l) )); then
                log_warn "⚠️  响应时间较慢: $endpoint (${response_time}s)"
            fi
        fi
    done
    
    if [[ $test_count -gt 0 ]]; then
        local avg_time=$(echo "scale=3; $total_time / $test_count" | bc -l)
        log_info "📊 平均响应时间: ${avg_time}s"
        
        if (( $(echo "$avg_time < 1.0" | bc -l) )); then
            log_info "✅ 性能测试通过"
        elif (( $(echo "$avg_time < 2.0" | bc -l) )); then
            log_warn "⚠️  性能一般"
        else
            log_error "❌ 性能测试失败"
            return 1
        fi
    fi
    
    return 0
}

# 数据库连接测试
check_database() {
    local base_url=$(get_base_url)
    local db_check_url="$base_url/ready"
    
    log_info "检查数据库连接: $db_check_url"
    
    local response_time=$(make_request "$db_check_url")
    if [[ $? -eq 0 ]]; then
        log_info "✅ 数据库连接检查通过 (响应时间: ${response_time}s)"
        return 0
    else
        log_error "❌ 数据库连接检查失败"
        return 1
    fi
}

# 生成报告
generate_report() {
    local status=$1
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat << EOF

📋 健康检查报告
===============
环境: $ENVIRONMENT
时间: $timestamp
状态: $(if [[ $status -eq 0 ]]; then echo "✅ 健康"; else echo "❌ 异常"; fi)

检查项目:
- 健康状态: $(if [[ ${HEALTH_STATUS:-1} -eq 0 ]]; then echo "✅"; else echo "❌"; fi)
- API可用性: $(if [[ ${API_STATUS:-1} -eq 0 ]]; then echo "✅"; else echo "❌"; fi)
- 前端可用性: $(if [[ ${FRONTEND_STATUS:-1} -eq 0 ]]; then echo "✅"; else echo "❌"; fi)
- 数据库连接: $(if [[ ${DATABASE_STATUS:-1} -eq 0 ]]; then echo "✅"; else echo "❌"; fi)
- WebSocket: $(if [[ ${WEBSOCKET_STATUS:-1} -eq 0 ]]; then echo "✅"; else echo "⚠️"; fi)
- 性能测试: $(if [[ ${PERFORMANCE_STATUS:-1} -eq 0 ]]; then echo "✅"; else echo "❌"; fi)

EOF

    if [[ $status -ne 0 ]]; then
        cat << EOF
⚠️  发现问题，建议检查:
1. 服务是否正常运行
2. 网络连接是否正常
3. 数据库是否可访问
4. 配置是否正确

EOF
    fi
}

# 监控模式
monitor_mode() {
    log_info "启动监控模式 (Ctrl+C 退出)"
    
    while true; do
        echo "$(date): 执行健康检查..."
        
        if check_health >/dev/null 2>&1; then
            echo "$(date): ✅ 系统健康"
        else
            echo "$(date): ❌ 系统异常"
            
            # 发送告警（如果配置了）
            if [[ -n "$ALERT_WEBHOOK" ]]; then
                curl -X POST -H 'Content-type: application/json' \
                    --data "{\"text\":\"🚨 AutoAds SaaS ($ENVIRONMENT) 健康检查失败\"}" \
                    "$ALERT_WEBHOOK" 2>/dev/null || true
            fi
        fi
        
        sleep 60  # 每分钟检查一次
    done
}

# 显示帮助
show_help() {
    cat << EOF
AutoAds SaaS 健康检查脚本

使用方法:
    $0 [environment] [options]

环境:
    preview     预发环境 (urlchecker.dev)
    production  生产环境 (autoads.dev)
    local       本地环境 (localhost:8888)

选项:
    --monitor   监控模式（持续检查）
    --quick     快速检查（仅基本项目）
    --help      显示帮助信息

示例:
    $0 preview              # 检查预发环境
    $0 production --quick   # 快速检查生产环境
    $0 local --monitor      # 监控本地环境

EOF
}

# 主函数
main() {
    local quick_mode=false
    local monitor=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            preview|production|local)
                ENVIRONMENT="$1"
                shift
                ;;
            --monitor)
                monitor=true
                shift
                ;;
            --quick)
                quick_mode=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log_info "AutoAds SaaS 健康检查 - 环境: $ENVIRONMENT"
    
    # 监控模式
    if [[ "$monitor" == "true" ]]; then
        monitor_mode
        exit 0
    fi
    
    # 执行检查
    local overall_status=0
    
    # 基本检查
    check_health; HEALTH_STATUS=$?
    check_api; API_STATUS=$?
    check_frontend; FRONTEND_STATUS=$?
    
    if [[ "$quick_mode" != "true" ]]; then
        # 完整检查
        check_database; DATABASE_STATUS=$?
        check_websocket; WEBSOCKET_STATUS=$?
        performance_test; PERFORMANCE_STATUS=$?
    fi
    
    # 计算总体状态
    if [[ $HEALTH_STATUS -ne 0 ]] || [[ $API_STATUS -ne 0 ]] || [[ $FRONTEND_STATUS -ne 0 ]]; then
        overall_status=1
    fi
    
    if [[ "$quick_mode" != "true" ]] && [[ $DATABASE_STATUS -ne 0 ]]; then
        overall_status=1
    fi
    
    # 生成报告
    generate_report $overall_status
    
    exit $overall_status
}

# 处理中断信号
trap 'log_info "健康检查被中断"; exit 1' INT TERM

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi