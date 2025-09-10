#!/bin/bash

# 测试新的类型检查配置
echo "🧪 Testing TypeScript CI configuration..."

# 检查必要文件是否存在
echo "📁 Checking configuration files..."

if [[ ! -f "tsconfig.ci.json" ]]; then
    echo "❌ tsconfig.ci.json not found"
    exit 1
fi

if [[ ! -f "scripts/type-check-ci.sh" ]]; then
    echo "❌ scripts/type-check-ci.sh not found"
    exit 1
fi

if [[ ! -x "scripts/type-check-ci.sh" ]]; then
    echo "❌ scripts/type-check-ci.sh is not executable"
    exit 1
fi

echo "✅ Configuration files found"

# 测试 CI 配置的语法
echo "🔍 Validating tsconfig.ci.json..."
if npx tsc --project tsconfig.ci.json --noEmit --dry-run 2>/dev/null; then
    echo "✅ tsconfig.ci.json is valid"
else
    echo "⚠️  tsconfig.ci.json may have issues"
fi

# 测试脚本执行
echo "🚀 Testing type check script..."
if ./scripts/type-check-ci.sh; then
    echo "✅ Type check script executed successfully"
else
    echo "⚠️  Type check script completed with warnings/errors"
fi

echo "🎉 Type check configuration test completed"