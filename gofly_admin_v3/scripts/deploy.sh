#!/bin/bash

# AutoAds SaaS 部署脚本
# 使用方法: ./scripts/deploy.sh [staging|production]

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-staging}

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# 检查环境
check_environment() {
    log_info "检查部署环境: $ENVIRONMENT"
    
    if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
        log_error "无效的环境: $ENVIRONMENT. 请使用 'staging' 或 'production'"
        exit 1
    fi
    
    # 检查必要的工具
    command -v docker >/dev/null 2>&1 || { log_error "Docker 未安装"; exit 1; }
    command -v docker-compose >/dev/null 2>&1 || { log_error "Docker Compose 未安装"; exit 1; }
}

# 加载环境变量
load_env() {
    local env_file="$PROJECT_DIR/.env.$ENVIRONMENT"
    
    if [[ -f "$env_file" ]]; then
        log_info "加载环境变量: $env_file"
        set -a
        source "$env_file"
        set +a
    else
        log_warn "环境变量文件不存在: $env_file"
    fi
}

# 备份数据库
backup_database() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "创建数据库备份..."
        
        local backup_dir="$PROJECT_DIR/backups"
        local backup_file="$backup_dir/autoads_saas_$(date +%Y%m%d_%H%M%S).sql"
        
        mkdir -p "$backup_dir"
        
        # 创建数据库备份
        docker-compose exec -T mysql mysqldump \
            -u"$DB_USERNAME" \
            -p"$DB_PASSWORD" \
            "$DB_DATABASE" > "$backup_file"
        
        # 压缩备份文件
        gzip "$backup_file"
        
        log_info "数据库备份完成: ${backup_file}.gz"
        
        # 清理旧备份（保留30天）
        find "$backup_dir" -name "*.sql.gz" -mtime +30 -delete
    fi
}

# 构建镜像
build_image() {
    log_info "构建Docker镜像..."
    
    cd "$PROJECT_DIR"
    
    # 构建镜像
    docker build -t "autoads/saas:$ENVIRONMENT" .
    
    log_info "镜像构建完成"
}

# 部署应用
deploy_app() {
    log_info "部署应用到 $ENVIRONMENT 环境..."
    
    cd "$PROJECT_DIR"
    
    # 选择合适的 docker-compose 文件
    local compose_file="docker-compose.yml"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        compose_file="docker-compose.prod.yml"
    fi
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose -f "$compose_file" down
    
    # 启动新服务
    log_info "启动新服务..."
    docker-compose -f "$compose_file" up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 健康检查
    health_check
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f "http://localhost:8080/health" >/dev/null 2>&1; then
            log_info "健康检查通过"
            return 0
        fi
        
        log_warn "健康检查失败，重试 $attempt/$max_attempts"
        sleep 10
        ((attempt++))
    done
    
    log_error "健康检查失败，部署可能有问题"
    return 1
}

# 运行数据库迁移
run_migrations() {
    log_info "运行数据库迁移..."
    
    # 等待数据库就绪
    sleep 10
    
    # 运行迁移
    docker-compose exec autoads-saas ./main migrate
    
    log_info "数据库迁移完成"
}

# 清理旧镜像
cleanup() {
    log_info "清理旧Docker镜像..."
    
    # 删除未使用的镜像
    docker image prune -f
    
    # 删除旧版本镜像（保留最新3个版本）
    docker images "autoads/saas" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
        tail -n +4 | \
        awk '{print $1}' | \
        xargs -r docker rmi
    
    log_info "清理完成"
}

# 发送通知
send_notification() {
    local status=$1
    local message="AutoAds SaaS 部署到 $ENVIRONMENT 环境"
    
    if [[ $status -eq 0 ]]; then
        message="$message 成功 ✅"
    else
        message="$message 失败 ❌"
    fi
    
    # 发送 Slack 通知（如果配置了 webhook）
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    log_info "通知已发送: $message"
}

# 回滚函数
rollback() {
    log_warn "开始回滚..."
    
    # 停止当前服务
    docker-compose down
    
    # 恢复上一个版本的镜像
    docker tag "autoads/saas:$ENVIRONMENT-backup" "autoads/saas:$ENVIRONMENT"
    
    # 重新启动服务
    docker-compose up -d
    
    log_info "回滚完成"
}

# 主函数
main() {
    log_info "开始部署 AutoAds SaaS..."
    
    # 检查环境
    check_environment
    
    # 加载环境变量
    load_env
    
    # 备份当前镜像（用于回滚）
    if docker images "autoads/saas:$ENVIRONMENT" >/dev/null 2>&1; then
        docker tag "autoads/saas:$ENVIRONMENT" "autoads/saas:$ENVIRONMENT-backup"
    fi
    
    # 执行部署步骤
    if backup_database && \
       build_image && \
       deploy_app && \
       run_migrations; then
        
        log_info "部署成功完成！"
        cleanup
        send_notification 0
        
        # 显示服务状态
        docker-compose ps
        
    else
        log_error "部署失败！"
        
        # 询问是否回滚
        read -p "是否要回滚到上一个版本？(y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rollback
        fi
        
        send_notification 1
        exit 1
    fi
}

# 处理中断信号
trap 'log_error "部署被中断"; exit 1' INT TERM

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi