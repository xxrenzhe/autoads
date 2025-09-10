#!/bin/bash

# Google OAuth 快速设置脚本
echo "🔐 Google OAuth 凭据设置向导"
echo "================================"
echo ""

# 检查当前配置
echo "📋 当前配置检查："
if grep -q "your-actual-google-client-id\|your-google-client-id" .env .env.local 2>/dev/null; then
    echo "❌ 检测到占位符凭据，需要配置真实的Google OAuth凭据"
else
    echo "✅ 凭据已配置"
fi

echo ""
echo "📖 请按照以下步骤获取Google OAuth凭据："
echo ""
echo "1️⃣  访问 Google Cloud Console："
echo "   https://console.cloud.google.com/"
echo ""
echo "2️⃣  创建或选择项目"
echo ""
echo "3️⃣  启用必要的API："
echo "   - Google+ API (必需)"
echo "   - Google Identity API (推荐)"
echo ""
echo "4️⃣  配置OAuth同意屏幕："
echo "   - 应用名称: AutoAds"
echo "   - 授权域名: localhost (开发环境)"
echo "   - 作用域: userinfo.email, userinfo.profile, openid"
echo ""
echo "5️⃣  创建OAuth 2.0凭据："
echo "   - 应用类型: Web应用"
echo "   - JavaScript来源: http://localhost:3000"
echo "   - 重定向URI: http://localhost:3000/api/auth/callback/google"
echo ""

# 交互式输入凭据
echo "🔑 请输入您的Google OAuth凭据："
echo ""

read -p "请输入客户端ID (Client ID): " CLIENT_ID
if [ -z "$CLIENT_ID" ]; then
    echo "❌ 客户端ID不能为空"
    exit 1
fi

echo ""
read -s -p "请输入客户端密钥 (Client Secret): " CLIENT_SECRET
echo ""
if [ -z "$CLIENT_SECRET" ]; then
    echo "❌ 客户端密钥不能为空"
    exit 1
fi

echo ""
echo "💾 正在更新配置文件..."

# 备份现有文件
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ .env 文件已备份"
fi

if [ -f .env.local ]; then
    cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ .env.local 文件已备份"
fi

# 更新 .env 文件
if [ -f .env ]; then
    # 更新现有的配置
    sed -i.tmp "s|AUTH_GOOGLE_ID=.*|AUTH_GOOGLE_ID=\"$CLIENT_ID\"|" .env
    sed -i.tmp "s|AUTH_GOOGLE_SECRET=.*|AUTH_GOOGLE_SECRET=\"$CLIENT_SECRET\"|" .env
    rm -f .env.tmp
    echo "✅ .env 文件已更新"
else
    echo "⚠️  .env 文件不存在，跳过更新"
fi

# 更新 .env.local 文件
if [ -f .env.local ]; then
    # 更新现有的配置
    sed -i.tmp "s|AUTH_GOOGLE_ID=.*|AUTH_GOOGLE_ID=\"$CLIENT_ID\"|" .env.local
    sed -i.tmp "s|AUTH_GOOGLE_SECRET=.*|AUTH_GOOGLE_SECRET=\"$CLIENT_SECRET\"|" .env.local
    rm -f .env.local.tmp
    echo "✅ .env.local 文件已更新"
else
    echo "⚠️  .env.local 文件不存在，跳过更新"
fi

echo ""
echo "🧪 正在验证配置..."

# 验证配置
if command -v node >/dev/null 2>&1; then
    if [ -f scripts/test-auth-fix.js ]; then
        echo "运行配置测试..."
        node scripts/test-auth-fix.js
    else
        echo "⚠️  测试脚本不存在，跳过自动测试"
    fi
else
    echo "⚠️  Node.js 未安装，跳过自动测试"
fi

echo ""
echo "🎉 Google OAuth 配置完成！"
echo ""
echo "📋 下一步操作："
echo "1. 重启开发服务器: npm run dev"
echo "2. 访问登录页面: http://localhost:3000/auth/signin"
echo "3. 测试Google登录功能"
echo ""
echo "📚 详细设置指南请查看: docs/google-oauth-setup-guide.md"
echo ""

# 询问是否立即启动开发服务器
read -p "是否现在启动开发服务器？(y/N): " START_DEV
if [[ $START_DEV =~ ^[Yy]$ ]]; then
    echo "🚀 启动开发服务器..."
    npm run dev
fi