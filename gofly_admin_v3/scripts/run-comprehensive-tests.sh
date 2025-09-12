#!/bin/bash

# AutoAds SaaS 全面测试和验证脚本
# 执行任务15：全面测试和验证

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_RESULTS=()

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

log_header() {
    echo -e "\n${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}\n"
}

# 记录测试结果
record_test_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("✅ $test_name")
        log_success "$test_name - PASSED"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("❌ $test_name - $details")
        log_error "$test_name - FAILED: $details"
    fi
}

# 检查依赖
check_dependencies() {
    log_header "检查测试依赖"
    
    # 检查Go环境
    if ! command -v go &> /dev/null; then
        log_error "Go未安装或不在PATH中"
        exit 1
    fi
    
    go_version=$(go version | awk '{print $3}')
    log_info "Go版本: $go_version"
    
    # 检查测试目录
    if [ ! -d "cmd/autoads-saas" ]; then
        log_error "测试目录不存在: cmd/autoads-saas"
        exit 1
    fi
    
    # 检查测试文件
    test_files=(
        "cmd/autoads-saas/comprehensive_test.go"
        "cmd/autoads-saas/api_compatibility_test.go"
        "cmd/autoads-saas/security_test.go"
        "cmd/autoads-saas/performance_test.go"
    )
    
    for file in "${test_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "测试文件不存在: $file"
            exit 1
        fi
    done
    
    log_success "所有依赖检查通过"
}

# 启动测试服务器
start_test_server() {
    log_header "启动测试服务器"
    
    # 检查端口是否被占用
    if lsof -Pi :8888 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "端口8888已被占用，尝试终止现有进程"
        pkill -f "autoads-saas" || true
        sleep 2
    fi
    
    # 构建测试应用
    log_info "构建AutoAds SaaS应用..."
    cd cmd/autoads-saas
    go build -o autoads-saas-test main.go
    
    if [ $? -ne 0 ]; then
        log_error "构建失败"
        exit 1
    fi
    
    # 启动服务器
    log_info "启动测试服务器..."
    ./autoads-saas-test &
    SERVER_PID=$!
    
    # 等待服务器启动
    log_info "等待服务器启动..."
    for i in {1..30}; do
        if curl -s http://localhost:8888/health >/dev/null 2>&1; then
            log_success "测试服务器启动成功 (PID: $SERVER_PID)"
            return 0
        fi
        sleep 1
    done
    
    log_error "测试服务器启动失败"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
}

# 停止测试服务器
stop_test_server() {
    if [ ! -z "$SERVER_PID" ]; then
        log_info "停止测试服务器 (PID: $SERVER_PID)"
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
}

# 执行API兼容性测试
run_api_compatibility_tests() {
    log_header "执行API兼容性测试"
    
    log_info "测试所有现有API路径和响应格式100%兼容..."
    
    if go test -v -run TestAPICompatibility ./cmd/autoads-saas/ -timeout 10m; then
        record_test_result "API兼容性测试" "PASS" ""
    else
        record_test_result "API兼容性测试" "FAIL" "API接口不兼容"
    fi
}

# 执行功能完整性测试
run_functional_completeness_tests() {
    log_header "执行功能完整性测试"
    
    log_info "测试BatchGo、SiteRankGo、Chengelink功能100%迁移验证..."
    
    if go test -v -run TestFunctionalCompleteness ./cmd/autoads-saas/ -timeout 15m; then
        record_test_result "功能完整性测试" "PASS" ""
    else
        record_test_result "功能完整性测试" "FAIL" "功能迁移不完整"
    fi
}

# 执行性能测试
run_performance_tests() {
    log_header "执行性能测试"
    
    log_info "测试50并发用户，P95响应时间<200ms验证..."
    
    if go test -v -run TestPerformanceValidation ./cmd/autoads-saas/ -timeout 20m; then
        record_test_result "性能测试" "PASS" ""
    else
        record_test_result "性能测试" "FAIL" "性能不达标"
    fi
}

# 执行安全测试
run_security_tests() {
    log_header "执行安全测试"
    
    log_info "测试用户数据隔离、Token消费准确性、认证授权验证..."
    
    if go test -v -run TestSecurityValidation ./cmd/autoads-saas/ -timeout 15m; then
        record_test_result "安全测试" "PASS" ""
    else
        record_test_result "安全测试" "FAIL" "安全验证失败"
    fi
}

# 执行端到端测试
run_end_to_end_tests() {
    log_header "执行端到端测试"
    
    log_info "测试完整用户流程，从注册到使用所有功能..."
    
    if go test -v -run TestEndToEnd ./cmd/autoads-saas/ -timeout 20m; then
        record_test_result "端到端测试" "PASS" ""
    else
        record_test_result "端到端测试" "FAIL" "端到端流程失败"
    fi
}

# 执行集成测试
run_integration_tests() {
    log_header "执行集成测试"
    
    log_info "测试GoFly成熟功能模块集成..."
    
    if go test -v -run TestAutoAdsSaaSIntegration ./cmd/autoads-saas/ -timeout 15m; then
        record_test_result "集成测试" "PASS" ""
    else
        record_test_result "集成测试" "FAIL" "模块集成失败"
    fi
}

# 执行用户体验测试
run_ux_tests() {
    log_header "执行用户体验测试"
    
    log_info "测试用户体验功能集成..."
    
    if go test -v -run TestUXFeaturesIntegration ./cmd/autoads-saas/ -timeout 10m; then
        record_test_result "用户体验测试" "PASS" ""
    else
        record_test_result "用户体验测试" "FAIL" "用户体验功能失败"
    fi
}

# 执行基准测试
run_benchmark_tests() {
    log_header "执行基准测试"
    
    log_info "执行性能基准测试..."
    
    # 执行基准测试并保存结果
    if go test -bench=. -benchmem ./cmd/autoads-saas/ -timeout 10m > benchmark_results.txt 2>&1; then
        record_test_result "基准测试" "PASS" ""
        log_info "基准测试结果已保存到 benchmark_results.txt"
    else
        record_test_result "基准测试" "FAIL" "基准测试执行失败"
    fi
}

# 生成测试报告
generate_test_report() {
    log_header "生成测试报告"
    
    local report_file="test_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# AutoAds SaaS 全面测试和验证报告

## 测试概览

- **测试时间**: $(date)
- **测试版本**: AutoAds SaaS v1.0.0
- **测试环境**: $(uname -s) $(uname -r)
- **Go版本**: $(go version | awk '{print $3}')

## 测试统计

- **总测试数**: $TOTAL_TESTS
- **通过测试**: $PASSED_TESTS
- **失败测试**: $FAILED_TESTS
- **成功率**: $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)%

## 测试结果详情

EOF

    for result in "${TEST_RESULTS[@]}"; do
        echo "- $result" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

## 性能指标

### 要求验收标准
- ✅ 支持50并发用户
- ✅ P95响应时间<200ms
- ✅ API兼容性100%
- ✅ 功能完整性100%
- ✅ 用户数据隔离
- ✅ Token消费准确性
- ✅ 认证授权验证

### 实际测试结果
$(if [ -f "benchmark_results.txt" ]; then
    echo "基准测试结果："
    echo '```'
    cat benchmark_results.txt
    echo '```'
fi)

## 测试结论

EOF

    if [ $FAILED_TESTS -eq 0 ]; then
        cat >> "$report_file" << EOF
🎉 **所有测试通过！**

AutoAds SaaS平台已成功完成全面测试和验证，满足所有需求的验收标准：

1. **API兼容性**: 所有现有API路径和响应格式100%兼容 ✅
2. **功能完整性**: BatchGo、SiteRankGo、Chengelink功能100%迁移成功 ✅
3. **性能达标**: 支持50并发用户，P95响应时间<200ms ✅
4. **安全验证**: 用户数据隔离、Token消费准确性、认证授权验证通过 ✅
5. **端到端测试**: 完整用户流程测试通过 ✅

系统已准备好投入生产使用。
EOF
    else
        cat >> "$report_file" << EOF
⚠️ **测试发现问题**

有 $FAILED_TESTS 个测试失败，需要修复后重新测试。

### 失败的测试
$(for result in "${TEST_RESULTS[@]}"; do
    if [[ $result == *"❌"* ]]; then
        echo "- $result"
    fi
done)

### 建议
1. 检查失败测试的详细日志
2. 修复相关问题
3. 重新运行测试验证
EOF
    fi
    
    log_success "测试报告已生成: $report_file"
}

# 清理函数
cleanup() {
    log_info "清理测试环境..."
    stop_test_server
    cd - >/dev/null 2>&1 || true
}

# 主函数
main() {
    # 设置清理陷阱
    trap cleanup EXIT INT TERM
    
    log_header "AutoAds SaaS 全面测试和验证"
    log_info "开始执行任务15：全面测试和验证"
    
    # 检查依赖
    check_dependencies
    
    # 启动测试服务器
    start_test_server
    
    # 等待服务器完全启动
    sleep 3
    
    # 执行各项测试
    run_api_compatibility_tests
    run_functional_completeness_tests
    run_performance_tests
    run_security_tests
    run_end_to_end_tests
    run_integration_tests
    run_ux_tests
    run_benchmark_tests
    
    # 生成测试报告
    generate_test_report
    
    # 输出最终结果
    log_header "测试完成"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log_success "🎉 所有测试通过！AutoAds SaaS平台验证成功！"
        log_success "✅ API兼容性: 100%"
        log_success "✅ 功能完整性: 100%"
        log_success "✅ 性能达标: P95<200ms"
        log_success "✅ 安全验证: 通过"
        log_success "✅ 端到端测试: 通过"
        exit 0
    else
        log_error "❌ 发现 $FAILED_TESTS 个测试失败"
        log_error "请查看测试报告了解详情"
        exit 1
    fi
}

# 检查是否直接运行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi