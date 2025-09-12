#!/bin/bash

# AutoAds GoFly API 测试脚本

echo "================================"
echo "AutoAds GoFly API 测试脚本"
echo "================================"

BASE_URL="http://localhost:8080/api/v1"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 测试函数
test_api() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    
    echo -e "\n测试: $description"
    echo "请求: $method $url"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$url")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PUT -H "Content-Type: application/json" -d "$data" "$url")
    fi
    
    # 提取HTTP状态码
    http_code=$(echo "$response" | grep -o 'HTTP_CODE:[0-9]*' | cut -d: -f2)
    body=$(echo "$response" | sed 's/HTTP_CODE:[0-9]*$//')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ 状态码: $http_code${NC}"
    else
        echo -e "${RED}✗ 状态码: $http_code${NC}"
    fi
    
    echo "响应: $body" | jq '.' 2>/dev/null || echo "$body"
}

# 检查服务是否运行
echo "检查服务状态..."
health_response=$(curl -s "$BASE_URL/../health" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 服务正在运行${NC}"
else
    echo -e "${RED}✗ 服务未运行，请先启动服务${NC}"
    exit 1
fi

# 1. 测试管理员登录
echo -e "\n${GREEN}===== 管理员认证测试 =====${NC}"
ADMIN_TOKEN=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' \
    "$BASE_URL/admin/login" | jq -r '.data.token // empty')

if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
    echo -e "${GREEN}✓ 管理员登录成功${NC}"
    echo "Token: $ADMIN_TOKEN"
else
    echo -e "${RED}✗ 管理员登录失败${NC}"
    exit 1
fi

# 设置认证头
AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"

# 2. 测试管理员仪表板
test_api "GET" "$BASE_URL/admin/dashboard" "" "获取管理员仪表板" -H "$AUTH_HEADER"

# 3. 测试获取管理员资料
test_api "GET" "$BASE_URL/admin/profile" "" "获取管理员资料" -H "$AUTH_HEADER"

# 4. 测试获取用户列表
test_api "GET" "$BASE_URL/admin/users" "" "获取用户列表" -H "$AUTH_HEADER"

# 5. 测试获取系统统计
test_api "GET" "$BASE_URL/admin/system/stats" "" "获取系统统计" -H "$AUTH_HEADER"

# 6. 测试获取系统配置
test_api "GET" "$BASE_URL/admin/system/config" "" "获取系统配置" -H "$AUTH_HEADER"

# 7. 测试获取管理员列表（仅超级管理员）
test_api "GET" "$BASE_URL/admin/admins" "" "获取管理员列表" -H "$AUTH_HEADER"

echo -e "\n${GREEN}===== 基础测试完成 =====${NC}"
echo "更多API测试可以手动进行："