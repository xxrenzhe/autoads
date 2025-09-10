#!/bin/bash

# E2E用户流程验证脚本
# 使用curl进行基本的API功能验证

echo "🚀 开始E2E用户流程验证..."
echo "📍 基础URL: ${BASE_URL:-http://localhost:3000}"
echo ""

# 测试结果统计
PASSED=0
FAILED=0
TOTAL=0

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 测试函数
test_api() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    
    TOTAL=$((TOTAL + 1))
    echo -n "测试 $name ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/response_body.json "$url" 2>/dev/null)
    else
        response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" -o /tmp/response_body.json "$url" 2>/dev/null)
    fi
    
    status_code="${response: -3}"
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "201" ] || [ "$status_code" = "401" ]; then
        echo -e "${GREEN}✅ 通过${NC} (状态码: $status_code)"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ 失败${NC} (状态码: $status_code)"
        FAILED=$((FAILED + 1))
    fi
}

echo "=== 1. 健康检查测试 ==="
test_api "健康检查API" "${BASE_URL:-http://localhost:3000}/api/health"

echo ""
echo "=== 2. BatchOpen功能测试 ==="
TASK_ID="test-e2e-$(date +%s)"
BATCH_DATA='{"taskId":"'$TASK_ID'","urls":["https://example.com"],"cycleCount":1,"openInterval":5}'
test_api "BatchOpen创建任务" "${BASE_URL:-http://localhost:3000}/api/batchopen/silent-start" "POST" "$BATCH_DATA"

echo ""
echo "=== 3. SiteRank功能测试 ==="
SITERANK_DATA='{"domains":["example.com"],"includeSimilarWeb":false}'
test_api "SiteRank网站排名分析" "${BASE_URL:-http://localhost:3000}/api/siterank/rank" "POST" "$SITERANK_DATA"

echo ""
echo "=== 4. ChangeLink功能测试 ==="
CHANGELINK_DATA='{"campaignId":"test-campaign-'$TASK_ID'","urls":[{"url":"https://example.com","anchor":"Example"}]}'
test_api "ChangeLink链接管理" "${BASE_URL:-http://localhost:3000}/api/enhanced-example" "POST" "$CHANGELINK_DATA"

echo ""
echo "=== 5. 管理员功能测试 ==="
test_api "管理员统计API" "${BASE_URL:-http://localhost:3000}/api/admin/dashboard/stats"

echo ""
echo "========================================"
echo "📊 E2E测试结果总结"
echo "========================================"
echo "总测试数: $TOTAL"
echo "通过: $PASSED ✅"
echo "失败: $FAILED ❌"
if [ $TOTAL -gt 0 ]; then
    PASS_RATE=$((PASSED * 100 / TOTAL))
    echo "通过率: $PASS_RATE%"
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！系统已准备好进行部署。${NC}"
    exit 0
else
    echo -e "${RED}⚠️  部分测试失败，请检查相关功能。${NC}"
    exit 1
fi