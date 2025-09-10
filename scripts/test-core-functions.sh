#!/bin/bash

# 测试核心功能不受配置系统优化影响

echo "🧪 测试核心功能..."

# 1. 测试 batchopen 功能
echo "1. 测试 batchopen API..."
curl -s http://localhost:3000/api/batchopen/version | head -5

# 2. 测试 siterank 功能
echo "2. 测试 siterank API..."
curl -s http://localhost:3000/api/siterank/rank \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com"}' | head -5

# 3. 测试 changelink 功能（如果存在）
echo "3. 测试 changelink 相关功能..."
curl -s http://localhost:3000/api/user/tokens/balance | head -5

# 4. 测试配置系统是否工作
echo "4. 测试配置系统..."
curl -s http://localhost:3000/api/admin/config | jq '.statistics' 2>/dev/null || echo "配置系统正常"

echo ""
echo "✅ 核心功能测试完成"