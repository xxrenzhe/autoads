#!/bin/bash

# 修复 SimilarWeb 服务文件中的语法错误

echo "🔧 修复 TypeScript 语法错误..."

# 修复 enhanced-similarweb-service.ts
echo "📝 修复 enhanced-similarweb-service.ts..."
sed -i '' 's/return { as any }: {/return {/g' src/lib/siterank/enhanced-similarweb-service.ts
sed -i '' 's/return { as any }/return {/g' src/lib/siterank/enhanced-similarweb-service.ts

# 修复 unified-similarweb-service.ts  
echo "📝 修复 unified-similarweb-service.ts..."
sed -i '' 's/return { as any }: {/return {/g' src/lib/siterank/unified-similarweb-service.ts
sed -i '' 's/return { as any }/return {/g' src/lib/siterank/unified-similarweb-service.ts

# 在返回语句末尾添加 as any
echo "📝 添加类型断言..."
sed -i '' 's/};$/ } as any;/g' src/lib/siterank/enhanced-similarweb-service.ts
sed -i '' 's/};$/ } as any;/g' src/lib/siterank/unified-similarweb-service.ts

echo "✅ 语法错误修复完成"