#!/bin/bash

# 生成隐私政策和服务条款页面脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "📄 生成法律页面脚本"
echo "===================="
echo ""

# 获取应用信息
read -p "请输入应用名称 (默认: AutoAds): " APP_NAME
APP_NAME=${APP_NAME:-AutoAds}

read -p "请输入应用域名 (默认: autoads.dev): " APP_DOMAIN
APP_DOMAIN=${APP_DOMAIN:-autoads.dev}

read -p "请输入联系邮箱 (默认: legal@${APP_DOMAIN}): " CONTACT_EMAIL
CONTACT_EMAIL=${CONTACT_EMAIL:-legal@${APP_DOMAIN}}

read -p "请输入隐私邮箱 (默认: privacy@${APP_DOMAIN}): " PRIVACY_EMAIL
PRIVACY_EMAIL=${PRIVACY_EMAIL:-privacy@${APP_DOMAIN}}

# 创建目录
mkdir -p src/app/privacy
mkdir -p src/app/terms

log_info "生成隐私政策页面..."

# 生成隐私政策页面
cat > src/app/privacy/page.tsx << EOF
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '隐私政策 - ${APP_NAME}',
  description: '${APP_NAME}应用的隐私政策和数据使用说明'
}

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">隐私政策</h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-gray-600 mb-6">
          最后更新：{new Date().toLocaleDateString('zh-CN')}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. 信息收集</h2>
          <p>当您使用Google登录时，我们会收集以下信息：</p>
          <ul>
            <li><strong>基本资料信息</strong>：姓名、邮箱地址、头像</li>
            <li><strong>Google用户ID</strong>：用于识别您的账户</li>
            <li><strong>邮箱验证状态</strong>：确认您的邮箱已验证</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. 信息使用</h2>
          <p>我们使用收集的信息用于：</p>
          <ul>
            <li>提供身份验证和账户管理服务</li>
            <li>个性化您的应用体验</li>
            <li>发送重要的服务通知</li>
            <li>改善我们的服务质量</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. 信息保护</h2>
          <p>我们采取以下措施保护您的个人信息：</p>
          <ul>
            <li>使用HTTPS加密传输所有数据</li>
            <li>数据库信息加密存储</li>
            <li>定期进行安全审计</li>
            <li>遵循最小权限原则</li>
            <li>不会向第三方出售您的个人信息</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. 数据保留</h2>
          <p>我们会保留您的信息直到：</p>
          <ul>
            <li>您删除您的账户</li>
            <li>您撤销对我们应用的授权</li>
            <li>法律要求的保留期限结束</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. 您的权利</h2>
          <p>您有权：</p>
          <ul>
            <li>访问我们存储的您的个人信息</li>
            <li>要求更正不准确的信息</li>
            <li>要求删除您的个人信息</li>
            <li>撤销对我们应用的授权</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. 联系我们</h2>
          <p>如果您对本隐私政策有任何问题，请通过以下方式联系我们：</p>
          <ul>
            <li>邮箱：${PRIVACY_EMAIL}</li>
            <li>网站：https://${APP_DOMAIN}</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
EOF

log_success "隐私政策页面已生成: src/app/privacy/page.tsx"

log_info "生成服务条款页面..."

# 生成服务条款页面
cat > src/app/terms/page.tsx << EOF
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '服务条款 - ${APP_NAME}',
  description: '${APP_NAME}应用的服务条款和使用协议'
}

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">服务条款</h1>
      
      <div className="prose prose-lg max-w-none">
        <p className="text-gray-600 mb-6">
          最后更新：{new Date().toLocaleDateString('zh-CN')}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. 服务描述</h2>
          <p>${APP_NAME}提供以下服务：</p>
          <ul>
            <li>Google OAuth身份验证</li>
            <li>用户账户管理</li>
            <li>应用核心功能</li>
            <li>数据分析和报告</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. 用户责任</h2>
          <p>使用我们的服务时，您同意：</p>
          <ul>
            <li>提供准确和完整的信息</li>
            <li>保护您的账户安全</li>
            <li>不滥用我们的服务</li>
            <li>遵守适用的法律法规</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. 服务可用性</h2>
          <p>我们努力保持服务的可用性，但不保证：</p>
          <ul>
            <li>服务100%无中断</li>
            <li>所有功能在所有时间都可用</li>
            <li>服务不会出现错误或故障</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. 免责声明</h2>
          <p>在法律允许的最大范围内：</p>
          <ul>
            <li>我们不对服务中断造成的损失负责</li>
            <li>我们不对用户数据丢失负责（建议定期备份）</li>
            <li>我们不对第三方服务的可用性负责</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. 服务变更</h2>
          <p>我们保留以下权利：</p>
          <ul>
            <li>随时修改或终止服务</li>
            <li>更新这些服务条款</li>
            <li>暂停或终止违规用户的账户</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. 联系信息</h2>
          <p>如果您对服务条款有任何问题，请联系我们：</p>
          <ul>
            <li>邮箱：${CONTACT_EMAIL}</li>
            <li>网站：https://${APP_DOMAIN}</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
EOF

log_success "服务条款页面已生成: src/app/terms/page.tsx"

echo ""
echo "🎉 法律页面生成完成！"
echo ""
echo "📋 下一步操作："
echo "1. 检查生成的页面内容并根据需要修改"
echo "2. 启动开发服务器测试页面: npm run dev"
echo "3. 访问页面确认显示正常:"
echo "   - https://${APP_DOMAIN}/privacy"
echo "   - https://${APP_DOMAIN}/terms"
echo "4. 在Google Cloud Console中更新OAuth同意屏幕链接"
echo "5. 发布OAuth应用"
echo ""
echo "📚 详细发布指南请查看:"
echo "   docs/google-oauth-verification-publishing.md"
echo ""

# 询问是否立即测试
read -p "是否现在启动开发服务器测试页面？(y/N): " TEST_PAGES
if [[ $TEST_PAGES =~ ^[Yy]$ ]]; then
    log_info "启动开发服务器..."
    echo ""
    echo "🚀 开发服务器启动中..."
    echo "📱 访问以下链接测试页面:"
    echo "   http://localhost:3000/privacy"
    echo "   http://localhost:3000/terms"
    echo "🛑 按 Ctrl+C 停止服务器"
    echo ""
    npm run dev
fi