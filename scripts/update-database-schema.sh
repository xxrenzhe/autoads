#!/bin/bash

echo "🚀 更新数据库架构和套餐特性..."

# 1. 生成 Prisma 客户端
echo "📦 生成 Prisma 客户端..."
npx prisma generate

# 2. 推送 schema 变更
echo "🗄️ 推送 schema 变更..."
npx prisma db push

# 3. 初始化套餐特性
echo "📋 初始化套餐特性..."
npx tsx scripts/initialize-plan-features.ts

# 4. 执行部署后初始化检查
echo "🔧 执行部署后初始化检查..."
npx tsx scripts/post-deploy-init.ts

echo "✅ 数据库更新完成"

# 显示当前套餐状态
echo ""
echo "📊 当前套餐状态："
npx prisma db execute --stdin << EOF
SELECT 
  p.name,
  p.price,
  p.currency,
  p.interval,
  p.token_quota,
  p.yearly_discount,
  pf.feature_id,
  pf.name as feature_name,
  pf.enabled,
  pf.config
FROM plans p
LEFT JOIN plan_features pf ON p.id = pf.plan_id
WHERE p.name IN ('free', 'pro', 'max')
ORDER BY p.sort_order, pf.feature_id;
EOF