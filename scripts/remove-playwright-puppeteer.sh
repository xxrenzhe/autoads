#!/bin/bash

# 完全移除 Playwright 和 Puppeteer 依赖脚本
# 这个脚本会移除所有相关的依赖、配置文件和代码引用

set -e

echo "🗑️  开始移除 Playwright 和 Puppeteer 依赖..."

# 1. 移除 npm 依赖
echo "📦 移除 npm 依赖..."

# 移除 Playwright 相关依赖
npm uninstall playwright playwright-core @playwright/test @playwright/experimental-ct-react @playwright/experimental-ct-core || true

# 移除 Puppeteer 相关依赖
npm uninstall puppeteer puppeteer-core || true

echo "✅ npm 依赖已移除"

# 2. 移除配置文件
echo "🔧 移除配置文件..."

# 移除 Playwright 配置
rm -f playwright.config.ts
rm -f playwright.config.js
rm -f .playwright/

# 移除 Playwright 优化配置
rm -f src/lib/config/playwright-optimization.ts

echo "✅ 配置文件已移除"

# 3. 移除测试文件
echo "🧪 移除测试文件..."

# 移除 E2E 测试目录
rm -rf e2e/
rm -rf tests/smoke/
rm -rf tests/e2e/

echo "✅ 测试文件已移除"

# 4. 移除脚本文件
echo "📜 移除相关脚本..."

rm -f analyze-adspower-playwright.mjs
rm -f scripts/playwright-compatibility-check.sh

echo "✅ 脚本文件已移除"

# 5. 清理 node_modules 和重新安装
echo "🧹 清理并重新安装依赖..."

rm -rf node_modules/
rm -f package-lock.json
npm install

echo "✅ 依赖重新安装完成"

# 6. 显示需要手动处理的文件
echo ""
echo "⚠️  需要手动处理的文件:"
echo "以下文件包含 Playwright/Puppeteer 引用，需要手动修改或删除："
echo ""

# 搜索包含 playwright 或 puppeteer 的文件
grep -r "playwright\|puppeteer" src/ --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" 2>/dev/null | cut -d: -f1 | sort -u | while read file; do
    echo "  - $file"
done

echo ""
echo "📋 建议的后续操作:"
echo "1. 检查并修改上述文件中的代码引用"
echo "2. 移除 package.json 中相关的脚本命令"
echo "3. 更新文档和 README"
echo "4. 测试应用程序功能是否正常"

echo ""
echo "✅ Playwright 和 Puppeteer 依赖移除完成！"