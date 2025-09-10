'use client'

import { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

interface FAQItem {
  question: string
  answer: string
}

export default function PricingFAQ() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set([0])) // First item open by default

  const faqItems: FAQItem[] = [
    {
      question: '什么是 Token？如何计算使用量？',
      answer: 'Token 是我们系统中的计量单位，用于衡量各种操作的资源消耗。不同的操作消耗不同数量的 Token：URL 检查通常消耗 1-5 个 Token，批量操作根据处理的链接数量计算，API 调用根据复杂度消耗 1-10 个 Token。您可以在控制面板中实时查看 Token 使用情况。'
    },
    {
      question: '可以随时升级或降级订阅计划吗？',
      answer: '是的，您可以随时升级或降级您的订阅计划。升级会立即生效，您将获得新计划的所有功能和 Token 配额。降级将在当前计费周期结束时生效，以确保您不会失去已付费的服务。我们会按比例退还或收取费用差额。'
    },
    {
      question: '年付订阅有什么优势？',
      answer: '选择年付订阅可以享受 20% 的折扣，相当于免费使用 2.4 个月。此外，年付用户还享有优先客户支持、提前体验新功能的权利，以及更稳定的服务保障。年付订阅也简化了财务管理，减少了月度付款的麻烦。'
    },
    {
      question: '免费版有哪些限制？',
      answer: '免费版提供每月 1,000 个 Token，最多创建 3 个项目，基础的 URL 检查功能，以及工作日邮件支持。免费版不包括 API 访问、高级分析报告、实时监控等功能。对于个人用户和小型项目来说，免费版已经足够满足基本需求。'
    },
    {
      question: '如何取消订阅？',
      answer: '您可以随时在账户设置中取消订阅，无需任何理由或额外费用。取消后，您的订阅将在当前计费周期结束时停止，您可以继续使用付费功能直到期满。我们不会自动删除您的数据，您可以随时重新订阅来恢复完整功能。'
    },
    {
      question: '支持哪些付款方式？',
      answer: '我们支持多种付款方式，包括信用卡（Visa、MasterCard、American Express）、借记卡、支付宝、微信支付等。所有付款都通过 Stripe 安全处理，我们不会存储您的付款信息。企业用户还可以选择银行转账和发票付款。'
    },
    {
      question: '数据安全和隐私如何保障？',
      answer: '我们非常重视数据安全和用户隐私。所有数据传输都使用 SSL 加密，数据存储在符合 SOC 2 标准的安全数据中心。我们定期进行安全审计，实施多层安全防护。我们承诺不会出售或共享您的个人数据，详细信息请查看我们的隐私政策。'
    },
    {
      question: '是否提供 API 文档和技术支持？',
      answer: 'Pro 版和 Max 版用户可以访问完整的 API 文档，包括详细的接口说明、示例代码和 SDK。我们提供多种编程语言的示例，包括 Python、JavaScript、PHP 等。技术支持团队可以帮助您集成 API，Max 版用户还享有专属的技术顾问服务。'
    },
    {
      question: '企业版有什么特殊功能？',
      answer: '企业版（Max 版）提供 SSO 单点登录、白标定制、私有部署选项、99.9% SLA 保证、专属客户经理、一对一培训服务等。我们还可以根据企业需求定制特殊功能，提供专业的实施和迁移服务。企业版适合有特殊安全要求或大规模使用需求的组织。'
    },
    {
      question: '如何联系客户支持？',
      answer: '我们提供多种联系方式：免费版用户可以通过邮件获得工作日支持，Pro 版用户享有 24 小时邮件响应和工作时间在线聊天，Max 版用户可以使用 24/7 在线聊天、电话支持和专属客户经理。您也可以访问我们的帮助中心查看常见问题和教程。'
    }
  ]

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems)
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index)
    } else {
      newOpenItems.add(index)
    }
    setOpenItems(newOpenItems)
  }

  return (
    <div className="space-y-4">
      {faqItems.map((item, index) => (
        <div
          key={index}
          className="bg-white rounded-lg border border-gray-200 shadow-sm"
        >
          <button
            onClick={() => toggleItem(index)}
            className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h3 className="text-lg font-medium text-gray-900 pr-4">
              {item.question}
            </h3>
            {openItems.has(index) ? (
              <ChevronUpIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
            )}
          </button>
          
          {openItems.has(index) && (
            <div className="px-6 pb-4">
              <div className="text-gray-700 leading-relaxed">
                {item.answer}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Contact Support CTA */}
      <div className="mt-8 text-center">
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            还有其他问题？
          </h3>
          <p className="text-gray-600 mb-4">
            我们的客户支持团队随时为您提供帮助
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              联系支持
            </button>
            <button className="border border-blue-600 text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors">
              查看帮助中心
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}