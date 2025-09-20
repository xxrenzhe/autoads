#!/bin/bash

# 综合测试脚本
# 测试所有API功能和性能

API_BASE="http://localhost:8080/api/v1"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  AutoAds GoFly API 综合测试  ${NC}"
echo -e "${BLUE}================================${NC}"

# 1. 健康检查
echo -e "\n${YELLOW}1. 测试健康检查${NC}"
health_response=$(curl -s -X GET "$API_BASE/health")
if [[ $(echo $health_response | jq -r '.status') == "ok" ]]; then
    echo -e "${GREEN}✓ 健康检查通过${NC}"
    echo $health_response | jq '.'
else
    echo -e "${RED}✗ 健康检查失败${NC}"
    echo $health_response
fi

# 2. 测试请求验证
echo -e "\n${YELLOW}2. 测试请求验证${NC}"
echo -e "\n${BLUE}2.1 测试无效邮箱注册${NC}"
curl -s -X POST "$API_BASE/user/register" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "testuser",
        "email": "invalid-email",
        "password": "password123"
    }' | jq '.'

echo -e "\n${BLUE}2.2 测试密码过短${NC}"
curl -s -X POST "$API_BASE/user/register" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "testuser",
        "email": "test@example.com",
        "password": "123"
    }' | jq '.'

# 3. 测试用户注册
echo -e "\n${YELLOW}3. 测试用户注册${NC}"
register_response=$(curl -s -X POST "$API_BASE/user/register" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }')

if [[ $(echo $register_response | jq -r '.code') == "200" ]]; then
    echo -e "${GREEN}✓ 注册成功${NC}"
    TOKEN=$(echo $register_response | jq -r '.data.token')
    USER_ID=$(echo $register_response | jq -r '.data.user.id')
    echo "Token: $TOKEN"
else
    echo -e "${RED}✗ 注册失败${NC}"
    echo $register_response
fi

# 4. 测试用户登录
echo -e "\n${YELLOW}4. 测试用户登录${NC}"
login_response=$(curl -s -X POST "$API_BASE/user/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@example.com",
        "password": "password123"
    }')

if [[ $(echo $login_response | jq -r '.code') == "200" ]]; then
    echo -e "${GREEN}✓ 登录成功${NC}"
    TOKEN=$(echo $login_response | jq -r '.data.token')
    echo "Token: $TOKEN"
else
    echo -e "${RED}✗ 登录失败${NC}"
    echo $login_response
fi

# 5. 测试需要认证的接口
if [[ ! -z "$TOKEN" ]]; then
    echo -e "\n${YELLOW}5. 测试需要认证的接口${NC}"
    
    # 获取用户信息
    echo -e "\n${BLUE}5.1 获取用户信息${NC}"
    profile_response=$(curl -s -X GET "$API_BASE/user/profile" \
        -H "Authorization: Bearer $TOKEN")
    if [[ $(echo $profile_response | jq -r '.code') == "200" ]]; then
        echo -e "${GREEN}✓ 获取用户信息成功${NC}"
        echo $profile_response | jq '.'
    else
        echo -e "${RED}✗ 获取用户信息失败${NC}"
        echo $profile_response
    fi
    
    # 更新用户资料
    echo -e "\n${BLUE}5.2 更新用户资料${NC}"
    update_response=$(curl -s -X PUT "$API_BASE/user/profile" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "updateduser",
            "avatar": "https://example.com/avatar.jpg"
        }')
    if [[ $(echo $update_response | jq -r '.code') == "200" ]]; then
        echo -e "${GREEN}✓ 更新资料成功${NC}"
    else
        echo -e "${RED}✗ 更新资料失败${NC}"
        echo $update_response
    fi
    
    # 修改密码
    echo -e "\n${BLUE}5.3 修改密码${NC}"
    password_response=$(curl -s -X POST "$API_BASE/user/change-password" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "old_password": "password123",
            "new_password": "newpassword123"
        }')
    if [[ $(echo $password_response | jq -r '.code') == "200" ]]; then
        echo -e "${GREEN}✓ 修改密码成功${NC}"
    else
        echo -e "${RED}✗ 修改密码失败${NC}"
        echo $password_response
    fi
    
    # 刷新token
    echo -e "\n${BLUE}5.4 刷新token${NC}"
    refresh_response=$(curl -s -X POST "$API_BASE/user/refresh-token" \
        -H "Authorization: Bearer $TOKEN")
    if [[ $(echo $refresh_response | jq -r '.code') == "200" ]]; then
        echo -e "${GREEN}✓ 刷新token成功${NC}"
        NEW_TOKEN=$(echo $refresh_response | jq -r '.data.token')
        echo "New Token: $NEW_TOKEN"
    else
        echo -e "${RED}✗ 刷新token失败${NC}"
        echo $refresh_response
    fi
    
    # 登出
    echo -e "\n${BLUE}5.5 用户登出${NC}"
    logout_response=$(curl -s -X POST "$API_BASE/user/logout" \
        -H "Authorization: Bearer $TOKEN")
    if [[ $(echo $logout_response | jq -r '.code') == "200" ]]; then
        echo -e "${GREEN}✓ 登出成功${NC}"
    else
        echo -e "${RED}✗ 登出失败${NC}"
        echo $logout_response
    fi
fi

# 6. 测试管理员登录
echo -e "\n${YELLOW}6. 测试管理员登录${NC}"
admin_login_response=$(curl -s -X POST "$API_BASE/admin/login" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "admin",
        "password": "admin123"
    }')

if [[ $(echo $admin_login_response | jq -r '.code') == "200" ]]; then
    echo -e "${GREEN}✓ 管理员登录成功${NC}"
    ADMIN_TOKEN=$(echo $admin_login_response | jq -r '.data.token')
    echo "Admin Token: $ADMIN_TOKEN"
else
    echo -e "${RED}✗ 管理员登录失败${NC}"
    echo $admin_login_response
fi

# 7. 测试错误处理
echo -e "\n${YELLOW}7. 测试错误处理${NC}"

# 无效token
echo -e "\n${BLUE}7.1 无效token${NC}"
curl -s -X GET "$API_BASE/user/profile" \
    -H "Authorization: Bearer invalid_token" | jq '.'

# 不存在的路由
echo -e "\n${BLUE}7.2 不存在的路由${NC}"
curl -s -X GET "$API_BASE/user/nonexistent" | jq '.'

# 8. 测试限流
echo -e "\n${YELLOW}8. 测试限流功能${NC}"
echo -e "${BLUE}快速发送10个请求...${NC}"
for i in {1..10}; do
    response=$(curl -s -X GET "$API_BASE/health")
    status=$(echo $response | jq -r '.status')
    echo "请求 $i: $status"
    if [[ "$status" == "ok" ]]; then
        continue
    else
        echo -e "${RED}✗ 请求被限流${NC}"
        break
    fi
done

# 9. 性能测试
echo -e "\n${YELLOW}9. 性能测试${NC}"
echo -e "${BLUE}9.1 并发健康检查（10个并发请求）${NC}"
start_time=$(date +%s%N)
for i in {1..10}; do
    curl -s -X GET "$API_BASE/health" > /dev/null &
done
wait
end_time=$(date +%s%N)
duration=$((($end_time - $start_time) / 1000000))
echo "完成时间: ${duration}ms"

echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}        测试完成        ${NC}"
echo -e "${BLUE}================================${NC}"