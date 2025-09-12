#!/bin/bash

# AutoAds SaaS 系统稳定性验证脚本
# 确保错误率<0.1%，系统可用性99.9%

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
HEALTH_CHECK_URL="http://localhost:8888/health"
API_BASE_URL="http://localhost:8888/api"
TEST_DURATION=300  # 5分钟测试
CONCURRENT_USERS=10
ERROR_THRESHOLD=0.1  # 0.1% 错误率阈值
AVAILABILITY_THRESHOLD=99.9  # 99.9% 可用性阈值

# 统计变量
TOTAL_REQUESTS=0
SUCCESSFUL_REQUESTS=0
FAILED_REQUESTS=0
RESPONSE_TIMES=()

echo -e "${BLUE}=== AutoAds SaaS 系统稳定性验证 ===${NC}"
echo "测试时长: ${TEST_DURATION}秒"
echo "并发用户: ${CONCURRENT_USERS}"
echo "错误率阈值: ${ERROR_THRESHOLD}%"
echo "可用性阈值: ${AVAILABILITY_THRESHOLD}%"
echo ""

# 1. 基础健康检查
echo -e "${YELLOW}1. 基础健康检查${NC}"

check_service() {
    local service_name=$1
    local check_url=$2
    
    echo -n "检查 $service_name... "
    
    if curl -s -f "$check_url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# 检查各个服务
check_service "应用健康状态" "$HEALTH_CHECK_URL"
check_service "数据库连接" "$HEALTH_CHECK_URL/db" || echo "  警告: 数据库健康检查端点可能未实现"
check_service "Redis连接" "$HEALTH_CHECK_URL/redis" || echo "  警告: Redis健康检查端点可能未实现"

echo ""

# 2. API端点可用性测试
echo -e "${YELLOW}2. API端点可用性测试${NC}"

api_endpoints=(
    "GET /health"
    "GET /api/user/profile"
    "GET /api/tokens/balance"
    "GET /api/siterank/stats"
    "GET /api/batchgo/tasks"
)

for endpoint in "${api_endpoints[@]}"; do
    method=$(echo $endpoint | cut -d' ' -f1)
    path=$(echo $endpoint | cut -d' ' -f2)
    url="$API_BASE_URL$path"
    
    echo -n "测试 $endpoint... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -o /dev/null "$url" 2>/dev/null || echo "000")
    else
        response="000"
    fi
    
    if [[ "$response" =~ ^[23] ]]; then
        echo -e "${GREEN}✓ ($response)${NC}"
    else
        echo -e "${RED}✗ ($response)${NC}"
    fi
done

echo ""

# 3. 并发负载测试
echo -e "${YELLOW}3. 并发负载测试 (${TEST_DURATION}秒)${NC}"

# 创建临时文件存储结果
TEMP_DIR=$(mktemp -d)
RESULTS_FILE="$TEMP_DIR/results.txt"

# 单个请求测试函数
test_request() {
    local user_id=$1
    local start_time=$(date +%s.%N)
    
    while [ $(echo "$(date +%s.%N) - $start_time < $TEST_DURATION" | bc) -eq 1 ]; do
        local request_start=$(date +%s.%N)
        
        # 随机选择API端点进行测试
        local endpoints=("$HEALTH_CHECK_URL" "$API_BASE_URL/health")
        local endpoint=${endpoints[$RANDOM % ${#endpoints[@]}]}
        
        local response_code=$(curl -s -w "%{http_code}" -o /dev/null "$endpoint" 2>/dev/null || echo "000")
        local request_end=$(date +%s.%N)
        local response_time=$(echo "$request_end - $request_start" | bc)
        
        # 记录结果
        echo "$response_code,$response_time" >> "$RESULTS_FILE"
        
        # 短暂休息避免过度负载
        sleep 0.1
    done
}

# 启动并发测试
echo "启动 $CONCURRENT_USERS 个并发用户..."
for i in $(seq 1 $CONCURRENT_USERS); do
    test_request $i &
done

# 显示进度
for i in $(seq 1 $TEST_DURATION); do
    echo -n "."
    sleep 1
done
echo ""

# 等待所有后台进程完成
wait

echo "负载测试完成，分析结果..."

# 4. 结果分析
echo -e "${YELLOW}4. 结果分析${NC}"

if [ -f "$RESULTS_FILE" ]; then
    # 统计请求数量
    TOTAL_REQUESTS=$(wc -l < "$RESULTS_FILE")
    SUCCESSFUL_REQUESTS=$(grep -c "^[23]" "$RESULTS_FILE" || echo "0")
    FAILED_REQUESTS=$((TOTAL_REQUESTS - SUCCESSFUL_REQUESTS))
    
    # 计算错误率
    if [ $TOTAL_REQUESTS -gt 0 ]; then
        ERROR_RATE=$(echo "scale=2; $FAILED_REQUESTS * 100 / $TOTAL_REQUESTS" | bc)
        AVAILABILITY=$(echo "scale=2; $SUCCESSFUL_REQUESTS * 100 / $TOTAL_REQUESTS" | bc)
    else
        ERROR_RATE=100
        AVAILABILITY=0
    fi
    
    # 计算响应时间统计
    if [ $SUCCESSFUL_REQUESTS -gt 0 ]; then
        # 提取成功请求的响应时间
        grep "^[23]" "$RESULTS_FILE" | cut -d',' -f2 > "$TEMP_DIR/response_times.txt"
        
        AVG_RESPONSE_TIME=$(awk '{sum+=$1} END {print sum/NR}' "$TEMP_DIR/response_times.txt" 2>/dev/null || echo "0")
        MAX_RESPONSE_TIME=$(sort -n "$TEMP_DIR/response_times.txt" | tail -1 2>/dev/null || echo "0")
        
        # 计算P95响应时间
        P95_LINE=$(echo "$SUCCESSFUL_REQUESTS * 0.95" | bc | cut -d'.' -f1)
        P95_RESPONSE_TIME=$(sort -n "$TEMP_DIR/response_times.txt" | sed -n "${P95_LINE}p" 2>/dev/null || echo "0")
    else
        AVG_RESPONSE_TIME=0
        MAX_RESPONSE_TIME=0
        P95_RESPONSE_TIME=0
    fi
    
    # 显示统计结果
    echo "总请求数: $TOTAL_REQUESTS"
    echo "成功请求: $SUCCESSFUL_REQUESTS"
    echo "失败请求: $FAILED_REQUESTS"
    echo "错误率: ${ERROR_RATE}%"
    echo "可用性: ${AVAILABILITY}%"
    echo "平均响应时间: ${AVG_RESPONSE_TIME}s"
    echo "最大响应时间: ${MAX_RESPONSE_TIME}s"
    echo "P95响应时间: ${P95_RESPONSE_TIME}s"
    
else
    echo -e "${RED}错误: 无法找到测试结果文件${NC}"
    exit 1
fi

echo ""

# 5. 稳定性评估
echo -e "${YELLOW}5. 稳定性评估${NC}"

PASS_COUNT=0
TOTAL_CHECKS=4

# 检查错误率
echo -n "错误率检查 (< ${ERROR_THRESHOLD}%): "
if [ $(echo "$ERROR_RATE < $ERROR_THRESHOLD" | bc) -eq 1 ]; then
    echo -e "${GREEN}✓ (${ERROR_RATE}%)${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗ (${ERROR_RATE}%)${NC}"
fi

# 检查可用性
echo -n "可用性检查 (> ${AVAILABILITY_THRESHOLD}%): "
if [ $(echo "$AVAILABILITY > $AVAILABILITY_THRESHOLD" | bc) -eq 1 ]; then
    echo -e "${GREEN}✓ (${AVAILABILITY}%)${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗ (${AVAILABILITY}%)${NC}"
fi

# 检查P95响应时间
echo -n "P95响应时间检查 (< 200ms): "
P95_MS=$(echo "$P95_RESPONSE_TIME * 1000" | bc | cut -d'.' -f1)
if [ $P95_MS -lt 200 ]; then
    echo -e "${GREEN}✓ (${P95_MS}ms)${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗ (${P95_MS}ms)${NC}"
fi

# 检查平均响应时间
echo -n "平均响应时间检查 (< 100ms): "
AVG_MS=$(echo "$AVG_RESPONSE_TIME * 1000" | bc | cut -d'.' -f1)
if [ $AVG_MS -lt 100 ]; then
    echo -e "${GREEN}✓ (${AVG_MS}ms)${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗ (${AVG_MS}ms)${NC}"
fi

echo ""

# 6. 最终评估
echo -e "${YELLOW}6. 最终评估${NC}"

PASS_RATE=$(echo "scale=1; $PASS_COUNT * 100 / $TOTAL_CHECKS" | bc)

echo "通过检查: $PASS_COUNT/$TOTAL_CHECKS (${PASS_RATE}%)"

if [ $PASS_COUNT -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}🎉 系统稳定性验证通过！${NC}"
    echo -e "${GREEN}✅ 错误率 < 0.1%${NC}"
    echo -e "${GREEN}✅ 系统可用性 > 99.9%${NC}"
    echo -e "${GREEN}✅ 性能指标达标${NC}"
    EXIT_CODE=0
elif [ $PASS_COUNT -ge 3 ]; then
    echo -e "${YELLOW}⚠️  系统稳定性基本达标，但有改进空间${NC}"
    EXIT_CODE=1
else
    echo -e "${RED}❌ 系统稳定性验证失败${NC}"
    echo -e "${RED}需要检查和优化系统性能${NC}"
    EXIT_CODE=2
fi

# 7. 生成报告
echo ""
echo -e "${YELLOW}7. 生成详细报告${NC}"

REPORT_FILE="stability_report_$(date +%Y%m%d_%H%M%S).txt"

cat > "$REPORT_FILE" << EOF
AutoAds SaaS 系统稳定性验证报告
生成时间: $(date)
测试时长: ${TEST_DURATION}秒
并发用户: ${CONCURRENT_USERS}

=== 测试结果 ===
总请求数: $TOTAL_REQUESTS
成功请求: $SUCCESSFUL_REQUESTS
失败请求: $FAILED_REQUESTS
错误率: ${ERROR_RATE}%
可用性: ${AVAILABILITY}%

=== 性能指标 ===
平均响应时间: ${AVG_RESPONSE_TIME}s (${AVG_MS}ms)
最大响应时间: ${MAX_RESPONSE_TIME}s
P95响应时间: ${P95_RESPONSE_TIME}s (${P95_MS}ms)

=== 稳定性评估 ===
错误率检查: $([ $(echo "$ERROR_RATE < $ERROR_THRESHOLD" | bc) -eq 1 ] && echo "通过" || echo "失败")
可用性检查: $([ $(echo "$AVAILABILITY > $AVAILABILITY_THRESHOLD" | bc) -eq 1 ] && echo "通过" || echo "失败")
P95响应时间检查: $([ $P95_MS -lt 200 ] && echo "通过" || echo "失败")
平均响应时间检查: $([ $AVG_MS -lt 100 ] && echo "通过" || echo "失败")

通过率: ${PASS_RATE}%
最终结果: $([ $EXIT_CODE -eq 0 ] && echo "通过" || echo "需要优化")

=== 建议 ===
$(if [ $EXIT_CODE -eq 0 ]; then
    echo "系统运行稳定，建议继续监控关键指标。"
elif [ $EXIT_CODE -eq 1 ]; then
    echo "系统基本稳定，建议优化响应时间和错误处理。"
else
    echo "系统存在稳定性问题，建议立即检查日志和系统资源。"
fi)
EOF

echo "详细报告已保存到: $REPORT_FILE"

# 清理临时文件
rm -rf "$TEMP_DIR"

echo ""
echo -e "${BLUE}=== 验证完成 ===${NC}"

exit $EXIT_CODE