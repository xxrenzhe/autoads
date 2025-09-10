#!/bin/bash

echo "🧪 测试定时任务服务API..."

# Test 1: Check if server is running
echo -e "\n1. 检查服务器状态..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    echo "   ✅ 服务器运行正常"
else
    echo "   ❌ 服务器未响应"
    exit 1
fi

# Test 2: Check API endpoint
echo -e "\n2. 测试API端点..."
response=$(curl -s -w "%{http_code}" http://localhost:3000/api/scheduled-tasks)
http_code="${response: -3}"
body="${response%???}"

if [ "$http_code" = "200" ]; then
    echo "   ✅ API端点响应正常"
    echo -e "\n   API响应内容:"
    echo "$body" | head -c 500
    echo ""
else
    echo "   ❌ API端点返回错误: $http_code"
fi

# Test 3: Test triggering a task
echo -e "\n3. 测试触发任务..."
trigger_response=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"action": "trigger", "taskId": "subscription-expiration"}' \
    -w "%{http_code}" \
    http://localhost:3000/api/scheduled-tasks 2>/dev/null)
trigger_code="${trigger_response: -3}"

if [ "$trigger_code" = "200" ]; then
    echo "   ✅ 任务触发成功"
else
    echo "   ❌ 任务触发失败: $trigger_code"
fi

echo -e "\n🎉 测试完成!"