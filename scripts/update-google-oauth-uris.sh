#!/bin/bash

echo "🔧 Google OAuth 重定向 URI 更新脚本"
echo "=================================="

echo "📋 当前问题:"
echo "Google 登录重定向到错误页面，需要更新 OAuth 配置"

echo ""
echo "🎯 需要在 Google Cloud Console 中配置的重定向 URI:"
echo "=================================================="

echo "✅ 必须添加的 URI:"
echo "1. https://www.urlchecker.dev/api/auth/callback/google"
echo "2. https://autoads.dev/api/auth/callback/google"
echo "3. http://localhost:3000/api/auth/callback/google"

echo ""
echo "⚠️  可选保留的 URI (向后兼容):"
echo "4. https://urlchecker.dev/api/auth/callback/google"

echo ""
echo "🔧 Google Cloud Console 配置步骤:"
echo "================================"

echo "1. 访问 Google Cloud Console"
echo "   https://console.cloud.google.com/"

echo ""
echo "2. 选择项目并进入 APIs & Services"
echo "   - 点击左侧菜单 'APIs & Services'"
echo "   - 点击 'Credentials'"

echo ""
echo "3. 编辑 OAuth 2.0 客户端 ID"
echo "   - 找到客户端 ID: 1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com"
echo "   - 点击编辑按钮（铅笔图标）"

echo ""
echo "4. 更新授权重定向 URI"
echo "   在 'Authorized redirect URIs' 部分添加上述 URI"

echo ""
echo "5. 保存配置"
echo "   点击 'Save' 按钮"

echo ""
echo "🧪 验证配置:"
echo "==========="

echo "配置完成后，运行以下命令验证:"
echo "node scripts/test-csrf-comprehensive.js preview"

echo ""
echo "或手动测试:"
echo "1. 访问 https://www.urlchecker.dev"
echo "2. 点击 Google 登录按钮"
echo "3. 应该跳转到 Google OAuth 页面"

echo ""
echo "🔍 故障排除:"
echo "==========="

echo "如果仍有问题，检查:"
echo "• Google Console 中的 OAuth 同意屏幕配置"
echo "• 确认应用状态为 'Published' 或 'Testing'"
echo "• 检查测试用户列表（如果应用在测试模式）"
echo "• 验证客户端 ID 和密钥是否正确"

echo ""
echo "📞 获取帮助:"
echo "==========="
echo "如需进一步支持，请提供:"
echo "1. Google Console 的完整错误信息"
echo "2. 浏览器控制台的错误日志"
echo "3. Network 标签中的请求详情"

echo ""
echo "✅ Google OAuth URI 更新指南完成"