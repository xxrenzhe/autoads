'use client'

import { useState, useEffect } from 'react'
import { CheckIcon, StarIcon } from '@heroicons/react/24/solid'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Plan {
  id: string
  name: string
  description: string
  price: number
  yearlyPrice: number
  currency: string
  tokenQuota: number
  features: string[]
  isPopular: boolean
  isActive: boolean
  stripeProductId?: string
  stripePriceId?: string
  stripeYearlyPriceId?: string
}

export default function PricingPlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [isYearly, setIsYearly] = useState(false)
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null)
  const { data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/plans')
      if (response.ok) {
        const data = await response.json()
        setPlans(data.plans || [])
      } else {
        // Mock data for development
        setPlans([
          {
            id: 'free',
            name: '免费版',
            description: '适合个人用户和小型项目',
            price: 0,
            yearlyPrice: 0,
            currency: 'CNY',
            tokenQuota: 1000,
            features: [
              '每月 1,000 Token',
              '基础 URL 检查',
              '邮件支持',
              '基础分析报告',
              '最多 3 个项目'
            ],
            isPopular: false,
            isActive: true
          },
          {
            id: 'pro',
            name: 'Pro 版',
            description: '适合成长中的企业和团队',
            price: 199,
            yearlyPrice: 1592, // 20% discount
            currency: 'CNY',
            tokenQuota: 10000,
            features: [
              '每月 10,000 Token',
              '高级 URL 检查',
              '优先邮件支持',
              '高级分析报告',
              '无限项目',
              'API 访问',
              '批量操作',
              '自定义报告'
            ],
            isPopular: true,
            isActive: true,
            stripeProductId: 'prod_pro',
            stripePriceId: 'price_pro_monthly',
            stripeYearlyPriceId: 'price_pro_yearly'
          },
          {
            id: 'max',
            name: 'Max 版',
            description: '适合大型企业和高级用户',
            price: 699,
            yearlyPrice: 5592, // 20% discount
            currency: 'CNY',
            tokenQuota: 50000,
            features: [
              '每月 50,000 Token',
              '企业级 URL 检查',
              '24/7 优先支持',
              '自定义分析报告',
              '无限项目和用户',
              '完整 API 访问',
              '高级批量操作',
              '白标选项',
              '自定义集成',
              '专属客户经理'
            ],
            isPopular: false,
            isActive: true,
            stripeProductId: 'prod_max',
            stripePriceId: 'price_max_monthly',
            stripeYearlyPriceId: 'price_max_yearly'
          }
        ])
      }
    } catch (error) {
      console.error('Error loading plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (plan: Plan) => {
    if (!session) {
      router.push('/auth/signin?callbackUrl=/pricing')
      return
    }

    if (plan.price === 0) {
      // Free plan - redirect to dashboard
      router.push('/dashboard')
      return
    }

    setSubscribingPlan(plan.id)

    try {
      const priceId = isYearly ? plan.stripeYearlyPriceId : plan.stripePriceId
      
      const response = await fetch('/api/subscriptions/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          priceId,
          planId: plan.id,
          successUrl: `${window.location.origin}/subscription/success`,
          cancelUrl: `${window.location.origin}/pricing`
        })
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        throw new Error('Failed to create checkout session')
      }
    } catch (error) {
      console.error('Error creating subscription:', error)
      alert('订阅失败，请稍后重试')
    } finally {
      setSubscribingPlan(null)
    }
  }

  const formatPrice = (price: number) => {
    if (price === 0) return '免费'
    return `¥${price.toLocaleString()}`
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`
    }
    return tokens.toString()
  }

  const calculateSavings = (monthlyPrice: number, yearlyPrice: number) => {
    if (monthlyPrice === 0) return 0
    const monthlyCost = monthlyPrice * 12
    return Math.round(((monthlyCost - yearlyPrice) / monthlyCost) * 100)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 rounded-2xl h-96"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Billing Toggle */}
      <div className="flex items-center justify-center">
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setIsYearly(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !isYearly
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            月付
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isYearly
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            年付
            <span className="ml-1 text-xs text-green-600 font-semibold">
              (省20%)
            </span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const currentPrice = isYearly ? plan.yearlyPrice : plan.price
          const savings = calculateSavings(plan.price, plan.yearlyPrice)
          
          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                plan.isPopular
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Popular Badge */}
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center">
                    <StarIcon className="h-4 w-4 mr-1" />
                    最受欢迎
                  </div>
                </div>
              )}

              <div className="p-8">
                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {plan.description}
                  </p>
                  
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900">
                        {formatPrice(currentPrice)}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-gray-600 ml-2">
                          /{isYearly ? '年' : '月'}
                        </span>
                      )}
                    </div>
                    
                    {isYearly && plan.price > 0 && savings > 0 && (
                      <div className="text-sm text-green-600 font-medium mt-1">
                        相比月付节省 {savings}%
                      </div>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    {formatTokens(plan.tokenQuota)} Token/{isYearly ? '年' : '月'}
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-4 mb-8">
                  {plan.features?.map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <CheckIcon className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={subscribingPlan === plan.id}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                    plan.isPopular
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
                      : plan.price === 0
                      ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } ${
                    subscribingPlan === plan.id
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:scale-105'
                  }`}
                >
                  {subscribingPlan === plan.id ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      处理中...
                    </div>
                  ) : plan.price === 0 ? (
                    '免费开始'
                  ) : (
                    `选择 ${plan.name}`
                  )}
                </button>

                {/* Additional Info */}
                {plan.price > 0 && (
                  <p className="text-xs text-gray-500 text-center mt-4">
                    随时可以取消订阅
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Enterprise CTA */}
      <div className="text-center mt-12">
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            需要企业级解决方案？
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            我们为大型企业提供定制化的解决方案，包括专属部署、
            高级安全功能、专业培训和24/7技术支持。
          </p>
          <button className="bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors">
            联系企业销售
          </button>
        </div>
      </div>
    </div>
  )
}