#!/bin/bash

# AutoAds SaaS 部署测试脚本
# 使用方法: ./scripts/test-deployment.sh [preview|production|local]

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-local}

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

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    ((TOTAL_TESTS++))
    
    log_debug "运行测试: $test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        log_info "✅ $test_name"
        ((PASSED_TESTS++))
        return 0
    else
        log_error "❌ $test_name"
        ((FAILED_TESTS++))
        return 1
    fi
}

# 检查Docker环境
test_docker_environment() {
    log_info "检查Docker环境..."
    
    run_test "Docker已安装" "command -v docker"
    run_test "Docker服务运行中" "docker info"
}

# 检查项目文件
test_project_files() {
    log_info "检查项目文件..."
    
    cd "$PROJECT_DIR"
    
    run_test "Dockerfile.autoads-saas存在" "test -f Dockerfile.autoads-saas"
    run_test "Dockerfile存在" "test -f Dockerfile.autoads-saas"
    run_test "部署脚本存在" "test -f scripts/deploy-autoads-saas.sh"
    run_test "健康检查脚本存在" "test -f scripts/health-check.sh"
    run_test "启动脚本存在" "test -f scripts/start-autoads-saas.sh"
    
    # 检查环境配置文件
    run_test "预发环境配置存在" "test -f config/environments/preview.yaml"
    run_test "生产环境配置存在" "test -f config/environments/production.yaml"
    
    # 检查GoFly源码
    run_test "GoFly主程序存在" "test -f gofly_admin_v3/cmd/server/main.go"
    run_test "GoFly go.mod存在" "test -f gofly_admin_v3/go.mod"
}

# 检查前端构建
test_frontend_build() {
    log_info "检查前端构建..."
    
    cd "$PROJECT_DIR"
    
    run_test "package.json存在" "test -f package.json"
    run_test "Next.js配置存在" "test -f next.config.js"
    run_test "TypeScript配置存在" "test -f tsconfig.json"
    
    # 检查是否可以安装依赖
    if [[ ! -d "node_modules" ]]; then
        log_debug "安装前端依赖..."
        if npm ci --silent >/dev/null 2>&1; then
            run_test "前端依赖安装" "true"
        else
            run_test "前端依赖安装" "false"
        fi
    else
        run_test "前端依赖已安装" "test -d node_modules"
    fi
    
    # 检查TypeScript编译
    run_test "TypeScript类型检查" "npm run type-check"
}

# 检查Go后端
test_backend_build() {
    log_info "检查Go后端..."
    
    cd "$PROJECT_DIR/gofly_admin_v3"
    
    run_test "Go模块有效" "go mod verify"
    run_test "Go代码格式化" "test -z \"\$(gofmt -l .)\""
    run_test "Go代码检查" "go vet ./..."
    
    # 尝试编译
    log_debug "编译Go程序..."
    if go build -o /tmp/autoads-test ./cmd/server/main.go >/dev/null 2>&1; then
        run_test "Go程序编译" "true"
        rm -f /tmp/autoads-test
    else
        run_test "Go程序编译" "false"
    fi
}

# 测试Docker构建
test_docker_build() {
    log_info "测试Docker构建..."
    
    cd "$PROJECT_DIR"
    
    # 构建测试镜像
    log_debug "构建Docker镜像（可能需要几分钟）..."
    
    local build_args=""
    if [[ "$ENVIRONMENT" == "production" ]]; then
        build_args="--build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=production --build-arg NEXT_PUBLIC_DOMAIN=autoads.dev"
    else
        build_args="--build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=preview --build-arg NEXT_PUBLIC_DOMAIN=urlchecker.dev"
    fi
    
    if docker build -f Dockerfile.autoads-saas $build_args -t autoads-saas-test:latest . >/dev/null 2>&1; then
        run_test "Docker镜像构建" "true"
        
        # 检查镜像大小
        local image_size=$(docker images autoads-saas-test:latest --format "{{.Size}}")
        log_debug "镜像大小: $image_size"
        
        # 清理测试镜像
        docker rmi autoads-saas-test:latest >/dev/null 2>&1 || true
    else
        run_test "Docker镜像构建" "false"
    fi
}

# 测试Docker运行配置
test_docker_run() {
    log_info "测试Docker运行配置..."
    
    cd "$PROJECT_DIR"
    
    # 检查环境变量文件
    if [[ "$ENVIRONMENT" == "production" ]]; then
        run_test "生产环境变量文件存在" "test -f .env.production.template"
    else
        run_test "预发环境变量文件存在" "test -f .env.preview.template"
    fi
    
    # 检查启动脚本语法
    run_test "启动脚本语法正确" "bash -n scripts/start-autoads-saas.sh"
}

# 测试脚本权限和语法
test_scripts() {
    log_info "测试脚本..."
    
    cd "$PROJECT_DIR"
    
    # 检查脚本权限
    run_test "部署脚本可执行" "test -x scripts/deploy-autoads-saas.sh"
    run_test "健康检查脚本可执行" "test -x scripts/health-check.sh"
    run_test "启动脚本可执行" "test -x scripts/start-autoads-saas.sh"
    
    # 检查脚本语法
    run_test "部署脚本语法" "bash -n scripts/deploy-autoads-saas.sh"
    run_test "健康检查脚本语法" "bash -n scripts/health-check.sh"
    run_test "启动脚本语法" "bash -n scripts/start-autoads-saas.sh"
    
    # 测试脚本帮助功能
    run_test "部署脚本帮助" "scripts/deploy-autoads-saas.sh --help"
    run_test "健康检查脚本帮助" "scripts/health-check.sh --help"
    run_test "启动脚本帮助" "scripts/start-autoads-saas.sh --help"
}

# 测试环境变量模板
test_env_templates() {
    log_info "测试环境变量模板..."
    
    cd "$PROJECT_DIR"
    
    run_test "预发环境变量模板存在" "test -f .env.preview.template"
    run_test "生产环境变量模板存在" "test -f .env.production.template"
    
    # 检查模板内容
    run_test "预发模板包含必需变量" "grep -q 'DATABASE_URL' .env.preview.template"
    run_test "生产模板包含必需变量" "grep -q 'DATABASE_URL' .env.production.template"
}

# 测试CI/CD配置
test_cicd_config() {
    log_info "测试CI/CD配置..."
    
    cd "$PROJECT_DIR"
    
    run_test "GitHub Actions工作流存在" "test -f .github/workflows/autoads-saas-cicd.yml"
    
    # 检查YAML语法（如果有yq）
    if command -v yq >/dev/null 2>&1; then
        run_test "GitHub Actions YAML语法" "yq eval '.jobs' .github/workflows/autoads-saas-cicd.yml"
    else
        log_debug "跳过YAML语法检查（缺少yq工具）"
    fi
}

# 测试文档
test_documentation() {
    log_info "测试文档..."
    
    cd "$PROJECT_DIR"
    
    run_test "部署指南存在" "test -f docs/deployment-guide.md"
    run_test "部署指南非空" "test -s docs/deployment-guide.md"
    
    # 检查文档内容
    run_test "部署指南包含环境配置" "grep -q '环境配置' docs/deployment-guide.md"
    run_test "部署指南包含部署流程" "grep -q '部署流程' docs/deployment-guide.md"
}

# 生成测试报告
generate_report() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat << EOF

📋 部署测试报告
===============
环境: $ENVIRONMENT
时间: $timestamp
总测试数: $TOTAL_TESTS
通过: $PASSED_TESTS
失败: $FAILED_TESTS
成功率: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%

EOF

    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_info "🎉 所有测试通过！部署配置就绪。"
        cat << EOF
✅ 部署准备就绪

下一步操作:
1. 配置环境变量: cp .env.$ENVIRONMENT.template .env.$ENVIRONMENT
2. 编辑环境变量文件，填入实际值
3. 运行部署: ./scripts/deploy-autoads-saas.sh $ENVIRONMENT

EOF
    else
        log_error "❌ 发现 $FAILED_TESTS 个问题，请修复后重试。"
        cat << EOF

🔧 修复建议:
1. 检查Docker环境是否正常
2. 确保所有依赖已安装
3. 验证代码语法和格式
4. 检查配置文件完整性

EOF
    fi
}

# 显示帮助
show_help() {
    cat << EOF
AutoAds SaaS 部署测试脚本

使用方法:
    $0 [environment] [options]

环境:
    preview     预发环境测试
    production  生产环境测试
    local       本地环境测试

选项:
    --quick     快速测试（跳过构建）
    --build     包含Docker构建测试
    --help      显示帮助信息

示例:
    $0 preview              # 测试预发环境配置
    $0 production --build   # 测试生产环境并构建镜像
    $0 local --quick        # 快速测试本地环境

EOF
}

# 主函数
main() {
    local quick_mode=false
    local include_build=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            preview|production|local)
                ENVIRONMENT="$1"
                shift
                ;;
            --quick)
                quick_mode=true
                shift
                ;;
            --build)
                include_build=true
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
    
    log_info "AutoAds SaaS 部署测试 - 环境: $ENVIRONMENT"
    
    # 执行测试
    test_docker_environment
    test_project_files
    test_env_templates
    test_scripts
    test_cicd_config
    test_documentation
    
    if [[ "$quick_mode" != "true" ]]; then
        test_frontend_build
        test_backend_build
        test_docker_run
        
        if [[ "$include_build" == "true" ]]; then
            test_docker_build
        fi
    fi
    
    # 生成报告
    generate_report
    
    # 返回适当的退出码
    if [[ $FAILED_TESTS -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# 处理中断信号
trap 'log_info "测试被中断"; exit 1' INT TERM

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi