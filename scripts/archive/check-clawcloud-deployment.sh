#!/bin/bash

# ClawCloud 预发环境故障排查脚本

echo "🔍 ClawCloud 预发环境故障排查"
echo "=================================="

# 1. 检查最新的镜像
echo ""
echo "📦 1. 检查 Docker 镜像"
echo "最新的预发环境镜像: ghcr.io/xxrenzhe/url-batch-checker:preview-latest"
echo "构建时间: $(gh run view --repo xxrenzhe/url-batch-checker 16983419772 --json createdAt --jq '.createdAt' 2>/dev/null || echo '无法获取')"
echo "修复内容: 已禁用预发环境的 www 重定向，避免 308 重定向循环"

# 2. 环境变量检查清单
echo ""
echo "⚙️ 2. ClawCloud 环境变量检查清单"
echo "--------------------------------"
echo "请在 ClawCloud 控制台中确认以下环境变量已设置："
echo ""
echo "必需变量："
echo "  NODE_ENV=production"
echo "  NEXT_PUBLIC_DEPLOYMENT_ENV=preview"
echo "  NEXT_PUBLIC_DOMAIN=www.urlchecker.dev"
echo "  NEXT_PUBLIC_BASE_URL=https://www.urlchecker.dev"
echo "  PORT=3000"
echo "  HOSTNAME=0.0.0.0"
echo ""
echo "可选变量："
echo "  REDIS_URL=your_redis_url"
echo "  DATABASE_URL=your_database_url"
echo "  NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID=your_client_id"
echo "  GOOGLE_CLIENT_SECRET=your_client_secret"
echo ""

# 3. 健康检查测试
echo "🩺 3. 健康检查测试"
echo "正在测试 https://www.urlchecker.dev/api/health ..."
response=$(curl -s -o /dev/null -w "%{http_code}" https://www.urlchecker.dev/api/health 2>/dev/null || echo "000")

if [ "$response" = "200" ]; then
    echo "✅ 健康检查正常 (HTTP $response)"
elif [ "$response" = "503" ]; then
    echo "❌ 服务不可用 (HTTP $response) - 应用未启动"
    echo "   请检查："
    echo "   1. 应用日志"
    echo "   2. 环境变量配置"
    echo "   3. 镜像是否正确部署"
else
    echo "⚠️  意外响应 (HTTP $response)"
fi

# 4. 快速修复步骤
echo ""
echo "🚀 4. 快速修复步骤"
echo "----------------"
echo "1. 登录 ClawCloud 控制台"
echo "2. 选择预发环境应用"
echo "3. 点击 'Update' 或 'Redeploy'"
echo "4. 更新镜像标签为: ghcr.io/xxrenzhe/url-batch-checker:preview-latest"
echo "5. 确认环境变量设置正确"
echo "6. 部署并等待启动完成"
echo ""

# 5. 查看日志命令
echo "📋 5. 查看应用日志"
echo "在 ClawCloud 控制台中："
echo "1. 进入应用详情页"
echo "2. 点击 'Logs' 标签"
echo "3. 查看实时日志，寻找错误信息"
echo ""

# 6. 常见错误
echo "🐛 6. 常见错误及解决方案"
echo "----------------------"
echo "错误: 'upstream connect error'"
echo "  原因: 应用未成功启动"
echo "  解决: 检查应用日志，查看启动错误"
echo ""
echo "错误: '端口冲突'"
echo "  原因: PORT 未设置或设置错误"
echo "  解决: 确保 PORT=3000"
echo ""
echo "错误: '环境变量缺失'"
echo "  原因: NEXT_PUBLIC_DEPLOYMENT_ENV 未设置"
echo "  解决: 设置 NEXT_PUBLIC_DEPLOYMENT_ENV=preview"
echo ""

echo "✨ 排查完成！"