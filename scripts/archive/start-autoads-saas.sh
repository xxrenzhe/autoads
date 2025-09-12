#!/bin/bash

# AutoAds SaaS 启动脚本 - 单镜像部署
# 使用方法: ./scripts/start-autoads-saas.sh [preview|production|local]

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-preview}

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

# 显示帮助
show_help() {
    cat << EOF
AutoAds SaaS 启动脚本 - 单镜像部署

使用方法:
    $0 [environment] [options]

环境:
    preview     预发环境 (urlchecker.dev)
    production  生产环境 (autoads.dev)
    local       本地开发环境

选项:
    --build         重新构建镜像
    --pull          拉取最新镜像
    --logs          启动后显示日志
    --detach        后台运行（默认）
    --help          显示帮助信息

示例:
    $0 preview --build --logs    # 构建并启动预发环境，显示日志
    $0 production --pull         # 拉取最新镜像并启动生产环境
    $0 local                     # 启动本地开发环境

EOF
}

# 检查环境
check_environment() {
    log_info "检查启动环境: $ENVIRONMENT"
    
    if [[ "$ENVIRONMENT" != "preview" && "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "local" ]]; then
        log_error "无效的环境: $ENVIRONMENT"
        show_help
        exit 1
    fi
    
    # 检查必要工具
    command -v docker >/dev/null 2>&1 || { log_error "Docker 未安装"; exit 1; }
}

# 加载环境变量
load_env() {
    local env_file="$PROJECT_DIR/.env.$ENVIRONMENT"
    
    if [[ -f "$env_file" ]]; then
        log_info "加载环境变量: $env_file"
        export $(grep -v '^#' "$env_file" | xargs)
    else
        log_warn "环境变量文件不存在: $env_file"
        
        # 设置默认环境变量
        export DEPLOYMENT_ENV="$ENVIRONMENT"
        case $ENVIRONMENT in
            production)
                export DOMAIN="autoads.dev"
                export PORT="8888"
                ;;
            preview)
                export DOMAIN="urlchecker.dev"
                export PORT="8888"
                ;;
            local)
                export DOMAIN="localhost"
                export PORT="8888"
                ;;
        esac
    fi
}

# 获取容器名称和镜像
get_container_info() {
    case $ENVIRONMENT in
        production)
            CONTAINER_NAME="autoads-saas-production"
            IMAGE_NAME="autoads-saas:production"
            REMOTE_IMAGE="ghcr.io/xxrenzhe/autoads:prod-latest"
            ;;
        preview)
            CONTAINER_NAME="autoads-saas-preview"
            IMAGE_NAME="autoads-saas:preview"
            REMOTE_IMAGE="ghcr.io/xxrenzhe/autoads:preview-latest"
            ;;
        local)
            CONTAINER_NAME="autoads-saas-local"
            IMAGE_NAME="autoads-saas:local"
            REMOTE_IMAGE=""
            ;;
    esac
}

# 构建镜像
build_image() {
    log_info "构建Docker镜像..."
    
    cd "$PROJECT_DIR"
    
    local build_args=""
    if [[ "$ENVIRONMENT" == "production" ]]; then
        build_args="--build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=production --build-arg NEXT_PUBLIC_DOMAIN=autoads.dev"
    elif [[ "$ENVIRONMENT" == "preview" ]]; then
        build_args="--build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=preview --build-arg NEXT_PUBLIC_DOMAIN=urlchecker.dev"
    else
        build_args="--build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=local --build-arg NEXT_PUBLIC_DOMAIN=localhost"
    fi
    
    docker build -f Dockerfile.autoads-saas $build_args -t "$IMAGE_NAME" .
    
    log_info "✅ 镜像构建完成: $IMAGE_NAME"
}

# 拉取镜像
pull_image() {
    if [[ -z "$REMOTE_IMAGE" ]]; then
        log_warn "本地环境无远程镜像，跳过拉取"
        return 0
    fi
    
    log_info "拉取最新镜像: $REMOTE_IMAGE"
    
    docker pull "$REMOTE_IMAGE"
    docker tag "$REMOTE_IMAGE" "$IMAGE_NAME"
    
    log_info "✅ 镜像拉取完成"
}

# 停止现有容器
stop_container() {
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        log_info "停止现有容器: $CONTAINER_NAME"
        docker stop "$CONTAINER_NAME"
    fi
    
    if docker ps -aq -f name="$CONTAINER_NAME" | grep -q .; then
        log_debug "删除现有容器: $CONTAINER_NAME"
        docker rm "$CONTAINER_NAME"
    fi
}

# 启动容器
start_container() {
    log_info "启动AutoAds SaaS容器..."
    
    # 构建Docker运行命令
    local docker_cmd="docker run"
    
    # 基本参数
    docker_cmd="$docker_cmd --name $CONTAINER_NAME"
    docker_cmd="$docker_cmd --restart unless-stopped"
    docker_cmd="$docker_cmd -p ${PORT:-8888}:8888"
    
    # 环境变量
    if [[ -f "$PROJECT_DIR/.env.$ENVIRONMENT" ]]; then
        docker_cmd="$docker_cmd --env-file $PROJECT_DIR/.env.$ENVIRONMENT"
    fi
    
    # 添加关键环境变量
    docker_cmd="$docker_cmd -e NODE_ENV=production"
    docker_cmd="$docker_cmd -e NEXT_PUBLIC_DEPLOYMENT_ENV=$ENVIRONMENT"
    docker_cmd="$docker_cmd -e NEXT_PUBLIC_DOMAIN=${DOMAIN:-localhost}"
    
    # 数据卷
    docker_cmd="$docker_cmd -v autoads-logs-$ENVIRONMENT:/app/logs"
    docker_cmd="$docker_cmd -v autoads-uploads-$ENVIRONMENT:/app/uploads"
    
    # 资源限制
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker_cmd="$docker_cmd --memory=2g --cpus=2"
    else
        docker_cmd="$docker_cmd --memory=1.5g --cpus=1.5"
    fi
    
    # 健康检查
    docker_cmd="$docker_cmd --health-cmd='curl -f http://localhost:8888/health || exit 1'"
    docker_cmd="$docker_cmd --health-interval=30s"
    docker_cmd="$docker_cmd --health-timeout=10s"
    docker_cmd="$docker_cmd --health-retries=3"
    docker_cmd="$docker_cmd --health-start-period=60s"
    
    # 后台运行或显示日志
    if [[ "$SHOW_LOGS" == "true" ]]; then
        docker_cmd="$docker_cmd -it"
    else
        docker_cmd="$docker_cmd -d"
    fi
    
    # 镜像名称
    docker_cmd="$docker_cmd $IMAGE_NAME"
    
    # 执行命令
    log_debug "执行命令: $docker_cmd"
    eval "$docker_cmd"
    
    log_info "✅ 容器启动完成: $CONTAINER_NAME"
}

# 等待服务就绪
wait_for_ready() {
    if [[ "$SHOW_LOGS" == "true" ]]; then
        return 0  # 显示日志模式下不等待
    fi
    
    log_info "等待服务就绪..."
    
    local max_attempts=30
    local attempt=1
    local health_url="http://localhost:${PORT:-8888}/health"
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$health_url" >/dev/null 2>&1; then
            log_info "✅ 服务已就绪"
            return 0
        fi
        
        log_debug "等待服务就绪... ($attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    log_error "服务启动超时"
    return 1
}

# 显示服务状态
show_status() {
    log_info "服务状态:"
    
    docker ps -f name="$CONTAINER_NAME"
    
    # 显示访问信息
    cat << EOF

🌐 访问信息
===========
环境: $ENVIRONMENT
容器: $CONTAINER_NAME
端口: ${PORT:-8888}

EOF
    
    case $ENVIRONMENT in
        production)
            echo "- 主站: https://www.autoads.dev"
            echo "- 健康检查: https://www.autoads.dev/health"
            echo "- API: https://www.autoads.dev/api"
            ;;
        preview)
            echo "- 主站: https://www.urlchecker.dev"
            echo "- 健康检查: https://www.urlchecker.dev/health"
            echo "- API: https://www.urlchecker.dev/api"
            ;;
        local)
            echo "- 主站: http://localhost:${PORT:-8888}"
            echo "- 健康检查: http://localhost:${PORT:-8888}/health"
            echo "- API: http://localhost:${PORT:-8888}/api"
            ;;
    esac
    
    echo ""
}

# 显示日志
show_logs() {
    log_info "显示服务日志 (Ctrl+C 退出):"
    docker logs -f "$CONTAINER_NAME"
}

# 停止服务
stop_services() {
    log_info "停止AutoAds SaaS服务..."
    stop_container
    log_info "✅ 服务已停止"
}

# 重启服务
restart_services() {
    log_info "重启AutoAds SaaS服务..."
    stop_container
    start_container
    wait_for_ready
    show_status
    log_info "✅ 服务重启完成"
}

# 主函数
main() {
    local build=false
    local pull=false
    local show_logs_after=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            preview|production|local)
                ENVIRONMENT="$1"
                shift
                ;;
            --build)
                build=true
                shift
                ;;
            --pull)
                pull=true
                shift
                ;;
            --logs)
                show_logs_after=true
                shift
                ;;
            --detach)
                # 默认行为，不需要特殊处理
                shift
                ;;
            --stop)
                check_environment
                get_container_info
                stop_services
                exit 0
                ;;
            --restart)
                check_environment
                load_env
                get_container_info
                restart_services
                exit 0
                ;;
            --status)
                check_environment
                get_container_info
                show_status
                exit 0
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
    
    log_info "启动AutoAds SaaS - 环境: $ENVIRONMENT"
    
    # 检查环境
    check_environment
    
    # 加载环境变量
    load_env
    
    # 获取容器信息
    get_container_info
    
    # 构建或拉取镜像
    if [[ "$build" == "true" ]]; then
        build_image
    elif [[ "$pull" == "true" ]]; then
        pull_image
    fi
    
    # 设置日志显示标志
    export SHOW_LOGS="$show_logs_after"
    
    # 停止现有容器
    stop_container
    
    # 启动新容器
    start_container
    
    # 如果不是显示日志模式，等待服务就绪并显示状态
    if [[ "$show_logs_after" != "true" ]]; then
        wait_for_ready
        show_status
        
        log_info "🎉 AutoAds SaaS 启动成功！"
        log_info "使用 './scripts/start-autoads-saas.sh $ENVIRONMENT --logs' 查看日志"
        log_info "使用 './scripts/start-autoads-saas.sh $ENVIRONMENT --stop' 停止服务"
    else
        # 显示日志
        show_logs
    fi
}

# 处理中断信号
trap 'log_info "启动被中断"; exit 1' INT TERM

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi