#!/bin/bash

# API测试脚本 - 测试验证和错误处理
# 测试请求验证和错误处理功能

API_BASE="http://localhost:8080/api/v1"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}开始测试 API 验证和错误处理...${NC}"

# 1. 测试健康检查
echo -e "\n${GREEN}1. 测试健康检查${NC}"
curl -s -X GET "$API_BASE/health" | jq '.'

# 2. 测试用户注册 - 无效邮箱
echo -e "\n${GREEN}2. 测试用户注册 - 无效邮箱${NC}"
curl -s -X POST "$API_BASE/user/register" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "testuser",
        "email": "invalid-email",
        "password": "password123"
    }' | jq '.'

# 3. 测试用户注册 - 密码太短
echo -e "\n${GREEN}3. 测试用户注册 - 密码太短${NC}"
curl -s -X POST "$API_BASE/user/register" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "testuser",
        "email": "test@example.com",
        "password": "123"
    }' | jq '.'

# 4. 测试用户注册 - 缺少必填字段
echo -e "\n${GREEN}4. 测试用户注册 - 缺少必填字段${NC}"
curl -s -X POST "$API_BASE/user/register" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "testuser"
    }' | jq '.'

# 5. 测试用户登录 - 无效请求体
echo -e "\n${GREEN}5. 测试用户登录 - 无效JSON${NC}"
curl -s -X POST "$API_BASE/user/login" \
    -H "Content-Type: application/json" \
    -d 'invalid json' | jq '.'

# 6. 测试需要认证的接口 - 无token
echo -e "\n${GREEN}6. 测试需要认证的接口 - 无token${NC}"
curl -s -X GET "$API_BASE/user/profile" | jq '.'

# 7. 测试不存在的路由
echo -e "\n${GREEN}7. 测试不存在的路由${NC}"
curl -s -X GET "$API_BASE/user/nonexistent" | jq '.'

# 8. 测试管理员登录 - 无效凭证
echo -e "\n${GREEN}8. 测试管理员登录 - 无效凭证${NC}"
curl -s -X POST "$API_BASE/admin/login" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "invalid",
        "password": "invalid"
    }' | jq '.'

# 9. 测试查询参数验证
echo -e "\n${GREEN}9. 测试查询参数验证${NC}"
curl -s -X GET "$API_BASE/admin/users?page=-1&page_size=1000" \
    -H "Authorization: Bearer invalid-token" | jq '.'

# 10. 测试限流（快速连续请求）
echo -e "\n${GREEN}10. 测试限流功能${NC}"
for i in {1..5}; do
    echo -n "请求 $i: "
    curl -s -X GET "$API_BASE/health" | jq -r '.status'
done

echo -e "\n${YELLOW}API 测试完成${NC}"