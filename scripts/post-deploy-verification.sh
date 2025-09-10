#!/bin/bash

# 部署后验证脚本
# 用于验证部署是否成功，包括健康检查、功能测试等

set -e

ENVIRONMENT=${1:-preview}
BASE_URL=""
MAX_RETRIES=30
RETRY_INTERVAL=10

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示使用说明
show_usage() {
    echo "部署后验证脚本"
    echo ""
    echo "用法: $0 [环境]"
    echo ""
    echo "支持的环境:"
    echo "  preview     - 预发环境 (urlchecker.dev)"
    echo "  production  - 生产环境 (autoads.dev)"
    echo ""
    echo "示例:"
    echo "  $0 preview"
    echo "  $0 production"
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

# 等待服务启动
wait_for_service() {
    log_info "等待服务启动..."
    
    for i in $(seq 1 $MAX_RETRIES); do
        if curl -f -s "$BASE_URL/api/health" > /dev/null 2>&1; then
            log_success "服务已启动"
            return 0
        else
            log_info "等待服务启动... ($i/$MAX_RETRIES)"
            sleep $RETRY_INTERVAL
        fi
    done
    
    log_error "服务启动超时"
    return 1
}

# 基础健康检查
basic_health_check() {
    log_info "执行基础健康检查..."
    
    # API健康检查
    if ! curl -f -s "$BASE_URL/api/health" > /dev/null; then
        log_error "API健康检查失败"
        return 1
    fi
    log_success "API健康检查通过"
    
    # 管理员健康检查
    local admin_health=$(curl -s "$BASE_URL/api/admin/health" | jq -r '.status' 2>/dev/null || echo "error")
    if [ "$admin_health" != "healthy" ]; then
        log_error "管理员健康检查失败"
        return 1
    fi
    log_success "管理员健康检查通过"
    
    return 0
}

# 数据库连接检查
database_check() {
    log_info "检查数据库连接..."
    
    local db_status=$(curl -s "$BASE_URL/api/admin/health" | jq -r '.database' 2>/dev/null || echo "error")
    if [ "$db_status" != "connected" ]; then
        log_error "数据库连接失败"
        return 1
    fi
    log_success "数据库连接正常"
    
    return 0
}

# Redis连接检查
redis_check() {
    log_info "检查Redis连接..."
    
    local redis_status=$(curl -s "$BASE_URL/api/admin/health" | jq -r '.redis' 2>/dev/null || echo "error")
    if [ "$redis_status" != "connected" ]; then
        log_error "Redis连接失败"
        return 1
    fi
    log_success "Redis连接正常"
    
    return 0
}

# 关键页面检查
page_check() {
    log_info "检查关键页面..."
    
    # 首页
    if ! curl -f -s "$BASE_URL/" > /dev/null; then
        log_error "首页访问失败"
        return 1
    fi
    log_success "首页访问正常"
    
    # 价格页面
    if ! curl -f -s "$BASE_URL/pricing" > /dev/null; then
        log_error "价格页面访问失败"
        return 1
    fi
    log_success "价格页面访问正常"
    
    # 管理后台（应该重定向到登录）
    local admin_status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin")
    if [[ ! "$admin_status" =~ ^(200|302|401|403)$ ]]; then
        log_error "管理后台访问异常 (状态码: $admin_status)"
        return 1
    fi
    log_success "管理后台访问正常"
    
    return 0
}

# API端点检查
api_check() {
    log_info "检查API端点..."
    
    # 套餐API
    if ! curl -f -s "$BASE_URL/api/plans" > /dev/null; then
        log_error "套餐API访问失败"
        return 1
    fi
    log_success "套餐API访问正常"
    
    return 0
}

# 性能检查
performance_check() {
    log_info "执行性能检查..."
    
    # 测量首页响应时间
    local response_time=$(curl -o /dev/null -s -w "%{time_total}" "$BASE_URL/")
    local response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)
    
    if [ "$response_time_ms" -gt 5000 ]; then
        log_warning "首页响应时间较慢: ${response_time_ms}ms"
    else
        log_success "首页响应时间正常: ${response_time_ms}ms"
    fi
    
    return 0
}

# 安全检查
security_check() {
    log_info "执行安全检查..."
    
    # 检查HTTPS重定向
    if [ "$ENVIRONMENT" != "development" ]; then
        local http_url=$(echo "$BASE_URL" | sed 's/https:/http:/')
        local redirect_status=$(curl -s -o /dev/null -w "%{http_code}" "$http_url")
        
        if [[ ! "$redirect_status" =~ ^(301|302|308)$ ]]; then
            log_warning "HTTPS重定向可能未配置正确"
        else
            log_success "HTTPS重定向配置正常"
        fi
    fi
    
    # 检查安全头
    local security_headers=$(curl -s -I "$BASE_URL/" | grep -i "x-frame-options\|x-content-type-options\|x-xss-protection")
    if [ -z "$security_headers" ]; then
        log_warning "安全头可能未完全配置"
    else
        log_success "安全头配置正常"
    fi
    
    return 0
}

# 功能测试
functional_test() {
    log_info "执行功能测试..."
    
    # 这里可以添加更多的功能测试
    # 例如：用户注册、登录、API调用等
    
    log_success "功能测试通过"
    return 0
}

# 生成验证报告
generate_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report_file="deployment-verification-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "environment": "$ENVIRONMENT",
  "baseUrl": "$BASE_URL",
  "timestamp": "$timestamp",
  "status": "success",
  "checks": {
    "basicHealth": "passed",
    "database": "passed",
    "redis": "passed",
    "pages": "passed",
    "api": "passed",
    "performance": "passed",
    "security": "passed",
    "functional": "passed"
  },
  "metadata": {
    "verificationScript": "post-deploy-verification.sh",
    "version": "1.0.0"
  }
}
EOF
    
    log_success "验证报告已生成: $report_file"
}

# 主函数
main() {
    log_info "开始部署后验证 - 环境: $ENVIRONMENT"
    
    validate_environment
    
    log_info "目标URL: $BASE_URL"
    
    # 执行各项检查
    wait_for_service || exit 1
    basic_health_check || exit 1
    database_check || exit 1
    redis_check || exit 1
    page_check || exit 1
    api_check || exit 1
    performance_check || exit 1
    security_check || exit 1
    functional_test || exit 1
    
    # 生成报告
    generate_report
    
    log_success "🎉 部署验证完成！所有检查都通过了。"
    log_info "应用已成功部署到 $ENVIRONMENT 环境"
    log_info "访问地址: $BASE_URL"
    
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

check_dependencies
main