#!/bin/bash

# 验证配置系统优化是否生效

echo "🔍 验证配置系统优化状态..."

# 检查配置服务是否在使用优化版本
echo "1. 检查配置服务实现..."
if grep -q "OptimizedConfigurationService" /app/src/app/api/admin/config/route.ts; then
    echo "   ✅ 使用优化后的配置服务"
else
    echo "   ❌ 仍在使用旧版配置服务"
fi

# 检查数据库索引
echo "2. 检查数据库索引..."
npx prisma db execute --stdin --url="$DATABASE_URL" << EOF 2>/dev/null
SELECT indexname FROM pg_indexes WHERE tablename IN ('system_configs', 'environment_variables') AND indexname LIKE '%_idx';
EOF

# 检查配置分类
echo "3. 检查配置分类..."
npx prisma db execute --stdin --url="$DATABASE_URL" << EOF 2>/dev/null
SELECT category, COUNT(*) FROM system_configs GROUP BY category;
EOF

# 检查配置缓存
echo "4. 测试配置缓存..."
curl -s http://localhost:3000/api/admin/config | head -20

# 测试批量更新
echo "5. 测试批量操作..."
curl -X PUT http://localhost:3000/api/admin/config \
  -H "Content-Type: application/json" \
  -d '{"updates": [{"key": "test.config", "value": "test"}], "reason": "性能测试"}' \
  -w "\n响应时间: %{time_total}s\n"

echo ""
echo "🎉 配置系统优化验证完成"