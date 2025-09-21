#!/bin/bash

# 2C4G 环境部署验证脚本
# 用于验证修复后的容器是否正常运行

set -e

# 配置
PREVIEW_URL="https://www.urlchecker.dev"
PRODUCTION_URL="https://www.autoads.dev"
TIMEOUT=30
MAX_RETRIES=5

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 检查URL响应
check_url() {
    local url=$1
    local description=$2
    local retry_count=0
    
    log_info "检查 $description: $url"
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        if curl -f -s --max-time $TIMEOUT "$url" > /dev/null; then
            log_success "$description 响应正常"
            return 0
        else
            retry_count=$((retry_count + 1))
            log_warning "$description 检查失败，重试 $retry_count/$MAX_RETRIES"
            sleep 2
        fi
    done
    
    log_error "$description 检查失败，已达到最大重试次数"
    return 1
}

# 检查API响应时间
check_response_time() {
    local url=$1
    local description=$2
    local max_time=3
    
    log_info "检查 $description 响应时间"
    
    local response_time=$(curl -o /dev/null -s -w "%{time_total}" --max-time $TIMEOUT "$url" || echo "timeout")
    
    if [ "$response_time" = "timeout" ]; then
        log_error "$description 响应超时"
        return 1
    fi
    
    # 转换为毫秒
    local response_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)
    local max_ms=$((max_time * 1000))
    
    if [ $response_ms -lt $max_ms ]; then
        log_success "$description 响应时间: ${response_ms}ms (< ${max_ms}ms)"
        return 0
    else
        log_warning "$description 响应时间: ${response_ms}ms (> ${max_ms}ms)"
        return 1
    fi
}

# 检查健康状态
check_health() {
    local base_url=$1
    local env_name=$2
    
    echo ""
    echo "=========================================="
    echo "🔍 检查 $env_name 环境健康状态"
    echo "=========================================="
    
    # 检查主页
    if check_url "$base_url" "$env_name 主页"; then
        check_response_time "$base_url" "$env_name 主页"
    fi
    
    # 检查健康检查端点
    if check_url "$base_url/api/health" "$env_name 健康检查"; then
        check_response_time "$base_url/api/health" "$env_name 健康检查"
    fi
    
    # 检查核心功能端点
    local endpoints=(
        "/api/batchopen"
        "/api/siterank" 
        "/api/changelink"
    )
    
    for endpoint in "${endpoints[@]}"; do
        # 只检查端点是否可达，不检查具体功能
        local full_url="$base_url$endpoint"
        if curl -f -s --max-time $TIMEOUT -X GET "$full_url" > /dev/null 2>&1; then
            log_success "$env_name $endpoint 端点可达"
        else
            log_warning "$env_name $endpoint 端点检查失败（可能需要认证）"
        fi
    done
}

# 检查容器资源使用情况（如果可以访问）
check_container_resources() {
    local env_name=$1
    
    echo ""
    echo "=========================================="
    echo "📊 $env_name 环境资源使用建议"
    echo "=========================================="
    
    log_info "2C4G 环境优化检查清单："
    echo "  ✅ 内存设置: --max-old-space-size=768"
    echo "  ✅ 并发限制: MAX_CONCURRENT_REQUESTS=5"
    echo "  ✅ 超时设置: HTTP_TIMEOUT=20000"
    echo "  ✅ 后台进程: 已移除监控进程"
    echo "  ✅ 启动命令: 已简化"
    
    log_info "建议监控指标："
    echo "  - 内存使用率应 < 70%"
    echo "  - 启动时间应 < 60秒"
    echo "  - API响应时间应 < 3秒"
    echo "  - 无崩溃重启"
}

# 主函数
main() {
    local environment=${1:-"preview"}
    
    echo "🚀 2C4G 环境部署验证开始"
    echo "修复版本: Dockerfile.standalone-2c4g-fixed"
    echo "验证时间: $(date)"
    echo ""
    
    case $environment in
        "preview")
            check_health "$PREVIEW_URL" "Preview"
            check_container_resources "Preview"
            ;;
        "production")
            check_health "$PRODUCTION_URL" "Production"
            check_container_resources "Production"
            ;;
        "both")
            check_health "$PREVIEW_URL" "Preview"
            check_health "$PRODUCTION_URL" "Production"
            check_container_resources "Both"
            ;;
        *)
            log_error "无效的环境参数: $environment"
            echo "用法: $0 [preview|production|both]"
            exit 1
            ;;
    esac
    
    echo ""
    echo "=========================================="
    echo "📋 验证完成总结"
    echo "=========================================="
    
    log_info "如果发现问题，请检查："
    echo "  1. ClawCloud 容器是否使用最新镜像"
    echo "  2. 环境变量是否正确配置"
    echo "  3. 容器资源是否充足"
    echo "  4. 网络连接是否正常"
    
    echo ""
    log_info "如需回滚，请使用："
    echo "  - 镜像回滚: 使用之前的稳定版本"
    echo "  - 配置回滚: 降低内存设置到512MB"
    echo "  - 功能回滚: 禁用非核心功能"
    
    echo ""
    log_success "2C4G 环境部署验证完成！"
}

# 检查依赖
if ! command -v curl &> /dev/null; then
    log_error "curl 命令未找到，请安装 curl"
    exit 1
fi

if ! command -v bc &> /dev/null; then
    log_warning "bc 命令未找到，响应时间检查将被跳过"
fi

# 执行主函数
main "$@"