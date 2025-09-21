#!/bin/bash

echo "🧪 测试邀请链接API端点..."

# Test the API endpoint
echo -e "\n1. 测试 /api/invitation/my-code 端点..."
response=$(curl -s http://localhost:3000/api/invitation/my-code)

# Check if response contains proper URL
if echo "$response" | grep -q "https://"; then
    echo "   ✅ API返回HTTPS URL"
else
    echo "   ❌ API未返回HTTPS URL"
fi

if echo "$response" | grep -q "0.0.0.0"; then
    echo "   ❌ URL包含0.0.0.0"
else
    echo "   ✅ URL不包含0.0.0.0"
fi

# Extract and display the invitation URL
invitation_url=$(echo "$response" | grep -o '"invitationUrl":"[^"]*"' | cut -d'"' -f4)
if [ -n "$invitation_url" ]; then
    echo -e "\n2. 生成的邀请链接:"
    echo "   $invitation_url"
fi

echo -e "\n🎉 测试完成!"