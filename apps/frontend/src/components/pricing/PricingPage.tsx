'use client'

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Check, 
  Star, 
  Zap, 
  Shield, 
  BarChart3,
  Users,
  Clock,
  Infinity,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import CustomerServiceDialog from './CustomerServiceDialog'

interface PricingPlan {
  id: string
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  tokenQuota: number
  features: string[]
  limitations?: string[]
  popular?: boolean
  recommended?: boolean
  icon: React.ComponentType<{ className?: string }>
  buttonText: string
  buttonVariant: 'default' | 'outline' | 'secondary'
}

const pricingPlans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: '适合个人用户和小型项目',
    monthlyPrice: 0,
    yearlyPrice: 0,
    tokenQuota: 1000,
    icon: Users,
    features: [
      '支持"真实点击"功能，包括"初级版本"和"静默版本"',
      '支持"网站排名"功能',
      '批量查询域名上限100个/次',
      '包含1,000 tokens'
    ],
    buttonText: '免费开始',
    buttonVariant: 'outline'
  },
  {
    id: 'pro',
    name: 'Pro',
    description: '适合成长型企业和专业用户',
    monthlyPrice: 298,
    yearlyPrice: 1788,
    tokenQuota: 10000,
    icon: BarChart3,
    popular: true,
    features: [
      '支持所有免费套餐的功能',
      '"真实点击"功能，包括"自动化版本"',
      '"网站排名"功能，批量查询域名上限500个/次',
      '"自动化广告"功能，批量管理ads账号（上限10个）',
      '包含10,000 tokens'
    ],
    buttonText: '立即订阅',
    buttonVariant: 'default'
  },
  {
    id: 'max',
    name: 'Max',
    description: '适合大型企业和高用量用户',
    monthlyPrice: 998,
    yearlyPrice: 5988,
    tokenQuota: 100000,
    icon: Zap,
    features: [
      '支持所有高级套餐的功能',
      '"网站排名"功能，批量查询域名上限5000个/次',
      '"自动化广告"功能，批量管理ads账号（上限100个）',
      '包含100,000 tokens',
      '优先技术支持',
      '专属客户经理'
    ],
    buttonText: '立即订阅',
    buttonVariant: 'default'
  }
]

const featureComparison = [
  {
    category: '真实点击功能',
    features: [
      { name: '初级版本', free: true, pro: true, max: true },
      { name: '静默版本', free: true, pro: true, max: true },
      { name: '自动化版本', free: false, pro: true, max: true }
    ]
  },
  {
    category: '网站排名功能',
    features: [
      { name: '基本功能', free: true, pro: true, max: true },
      { name: '批量查询域名上限', free: '100个/次', pro: '500个/次', max: '5000个/次' }
    ]
  },
  {
    category: '自动化广告功能',
    features: [
      { name: '功能支持', free: false, pro: true, max: true },
      { name: 'ads账号管理上限', free: '不支持', pro: '10个', max: '100个' }
    ]
  },
  {
    category: '资源配额',
    features: [
      { name: '包含Token数量', free: '1,000', pro: '10,000', max: '100,000' },
      { name: '年付优惠', free: '无', pro: '50%', max: '50%' }
    ]
  },
  {
    category: '技术支持',
    features: [
      { name: '技术支持等级', free: '标准', pro: '优先', max: '专属' },
      { name: '客户经理', free: '无', pro: '无', max: '专属' }
    ]
  }
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const [customerServiceOpen, setCustomerServiceOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  const { data: session } = useSession()

  const getPrice = (plan: PricingPlan) => {
    return isYearly ? plan.yearlyPrice : plan.monthlyPrice
  }

  const getSavings = (plan: PricingPlan) => {
    if (plan.monthlyPrice === 0) return 0
    const monthlyTotal = plan.monthlyPrice * 12
    const savings = monthlyTotal - plan.yearlyPrice
    return Math.round((savings / monthlyTotal) * 100)
  }

  const handleSubscribeClick = (planId: string, planName: string) => {
    if (planId === 'free') {
      if (session) {
        window.location.href = '/dashboard'
      } else {
        window.location.href = '/auth/signin'
      }
    } else {
      setSelectedPlan(planName)
      setCustomerServiceOpen(true)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-[linear-gradient(135deg,#2563eb,#7c3aed)] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [background-clip:text]">
            选择适合您的套餐
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            透明的价格，灵活的选择
          </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <Label htmlFor="billing-toggle" className={cn(!isYearly && "font-semibold")}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={isYearly}
            onCheckedChange={setIsYearly}
          />
          <Label htmlFor="billing-toggle" className={cn(isYearly && "font-semibold")}>
            Yearly
            <Badge variant="secondary" className="ml-2">
              年付优惠50%
            </Badge>
          </Label>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {pricingPlans.map((plan: any) => {
          const price = getPrice(plan)
          const savings = getSavings(plan)

          return (
            <Card 
              key={plan.id} 
              className={cn(
                "relative bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden",
                plan.popular && "ring-2 ring-blue-500 shadow-xl scale-105"
              )}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-center py-2 text-sm font-semibold">
                  最受欢迎
                </div>
              )}

              <CardHeader className="text-center pb-8 pt-12">
                <div className="flex justify-center mb-4">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center",
                    plan.id === 'free' && "bg-gray-100",
                    plan.id === 'pro' && "bg-gradient-to-br from-blue-500 to-blue-600",
                    plan.id === 'max' && "bg-gradient-to-br from-purple-500 to-purple-600"
                  )}>
                    <plan.icon className={cn(
                      "h-8 w-8",
                      plan.id === 'free' && "text-gray-600",
                      plan.id === 'pro' && "text-white",
                      plan.id === 'max' && "text-white"
                    )} />
                  </div>
                </div>
                <CardTitle className={cn(
                  "text-3xl font-bold mb-2",
                  plan.id === 'free' && "text-gray-700",
                  plan.id === 'pro' && "text-blue-600",
                  plan.id === 'max' && "text-purple-600"
                )}>
                  {plan.name}
                </CardTitle>
                <CardDescription className="text-base text-gray-600">
                  {plan.description}
                </CardDescription>
                
                <div className="mt-6">
                  <div className="flex items-baseline justify-center">
                    <span className={cn(
                      "text-5xl font-bold",
                      plan.id === 'free' && "text-gray-700",
                      plan.id === 'pro' && "text-blue-600",
                      plan.id === 'max' && "text-purple-600"
                    )}>
                      {price === 0 ? '免费' : `¥${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-gray-500 ml-2 text-lg">
                        /{isYearly ? '年' : '月'}
                      </span>
                    )}
                  </div>
                  
                  {isYearly && savings > 0 && (
                    <p className="text-sm text-green-600 mt-2 font-semibold">
                      年付节省{savings}%
                    </p>
                  )}
                  
                  <p className="text-sm text-gray-500 mt-2">
                    包含 {plan.tokenQuota.toLocaleString()} tokens
                  </p>
                </div>
              </CardHeader>

              <CardContent className="px-8 pb-8">
                <ul className="space-y-3 mb-8">
                  {plan.features?.map((feature, index: any) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className={cn(
                        "h-5 w-5 mt-0.5 flex-shrink-0",
                        plan.id === 'free' && "text-gray-400",
                        plan.id === 'pro' && "text-blue-500",
                        plan.id === 'max' && "text-purple-500"
                      )} />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className={cn(
                    "w-full py-4 text-lg font-semibold rounded-xl transition-all duration-300",
                    plan.id === 'free' && "bg-gray-200 text-gray-700 hover:bg-gray-300",
                    plan.id === 'pro' && "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-lg",
                    plan.id === 'max' && "bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 hover:shadow-lg"
                  )}
                  size="lg"
                  onClick={((: any): any) => handleSubscribeClick(plan.id, plan.name)}
                >
                  {plan.buttonText}
                  {plan.id !== 'free' && <ArrowRight className="w-5 h-5 ml-2" />}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Feature Comparison */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
          套餐功能对比
        </h2>
        
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-6 font-semibold text-gray-900">功能特性</th>
                  <th className="text-center p-6 font-semibold text-gray-700">免费版</th>
                  <th className="text-center p-6 font-semibold text-blue-600">Pro版</th>
                  <th className="text-center p-6 font-semibold text-purple-600">Max版</th>
                </tr>
              </thead>
              <tbody>
                {featureComparison.map((category: any) => (
                  <React.Fragment key={category.category}>
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="p-4 font-semibold text-gray-900">
                        {category.category}
                      </td>
                    </tr>
                    {category.features.map((feature, index: any) => (
                      <tr key={index} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="p-4 text-gray-700">{feature.name}</td>
                        <td className="p-4 text-center">
                          {typeof feature.free === 'boolean' ? (
                            feature.free ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )
                          ) : (
                            <span className="text-gray-700">{feature.free}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {typeof feature.pro === 'boolean' ? (
                            feature.pro ? (
                              <Check className="h-5 w-5 text-blue-500 mx-auto" />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )
                          ) : (
                            <span className="text-blue-600 font-semibold">{feature.pro}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {typeof feature.max === 'boolean' ? (
                            feature.max ? (
                              <Check className="h-5 w-5 text-purple-500 mx-auto" />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )
                          ) : (
                            <span className="text-purple-600 font-semibold">{feature.max}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
          常见问题
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-3 text-gray-900">什么是Token？</h3>
            <p className="text-gray-600 leading-relaxed">
              Token是使用我们平台功能的计量单位。不同功能操作会消耗不同数量的Token，让您更灵活地控制使用成本。
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-3 text-gray-900">可以随时更改套餐吗？</h3>
            <p className="text-gray-600 leading-relaxed">
              是的，您可以随时升级或降级套餐。变更会立即生效，费用会按比例计算，让您灵活调整。
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-3 text-gray-900">如果超出配额怎么办？</h3>
            <p className="text-gray-600 leading-relaxed">
              您可以购买额外的Token或升级到更高级的套餐。在接近限制时我们会通知您，确保服务不中断。
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-3 text-gray-900">有免费试用吗？</h3>
            <p className="text-gray-600 leading-relaxed">
              是的，所有新用户注册即可获得14天Pro版免费试用。无需信用卡，即刻体验所有高级功能。
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-3 text-gray-900">年付有什么优惠？</h3>
            <p className="text-gray-600 leading-relaxed">
              年付可享受50%的优惠，相当于只付6个月费用就能使用12个月。更划算的选择。
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-3 text-gray-900">如何联系客服？</h3>
            <p className="text-gray-600 leading-relaxed">
              点击"立即订阅"按钮即可扫描客服二维码，或发送邮件至 support@autoads.dev，我们将在24小时内回复。
            </p>
          </div>
        </div>
      </div>

      {/* Customer Service Dialog */}
      <CustomerServiceDialog 
        open={customerServiceOpen}
        onOpenChange={setCustomerServiceOpen}
        planName={selectedPlan}
      />
      </div>
    </div>
  )
}