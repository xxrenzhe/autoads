'use client'

import { useState, useEffect } from 'react'
import { CheckIcon, StarIcon } from '@heroicons/react/24/solid'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { http } from '@/shared/http/client'
import { toast } from 'sonner'

interface Plan {
  id: string
  name: string
  price: number
  interval: 'month' | 'year'
  tokens: number
  features: string[]
  popular?: boolean
  stripePriceId: string
  description?: string
}

interface PlanSelectorProps {
  onPlanSelect: (plan: Plan) => void
  selectedPlan?: Plan | null
}

export default function PlanSelector({ onPlanSelect, selectedPlan }: PlanSelectorProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month')

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      const data = await http.getCached<{ plans: Plan[] }>(
        '/admin/plans',
        { active: true },
        5 * 60 * 1000,
        false
      )
      const plansData = (data as any)?.plans || data || []
      setPlans(plansData as any)
    } catch (error) {
      console.error('Failed to load plans:', error)
      toast.error('加载套餐失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const filteredPlans = plans.filter((plan: any) => plan.interval === billingInterval)

  const formatPrice = (price: number, interval: string) => {
    if (interval === 'year') {
      const monthlyPrice = price / 12
      return (
        <div>
          <span className="text-3xl font-bold">${price}</span>
          <span className="text-gray-500">/year</span>
          <div className="text-sm text-gray-500">
            ${monthlyPrice.toFixed(0)}/month billed annually
          </div>
        </div>
      )
    }
    return (
      <div>
        <span className="text-3xl font-bold">${price}</span>
        <span className="text-gray-500">/month</span>
      </div>
    )
  }

  const calculateSavings = (monthlyPrice: number, yearlyPrice: number) => {
    const yearlyMonthly = yearlyPrice / 12
    const savings = ((monthlyPrice - yearlyMonthly) / monthlyPrice) * 100
    return Math.round(savings)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i: any) => (
              <div key={i} className="h-96 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Choose the perfect plan for you
        </h2>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center mb-6">
          <div className="bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setBillingInterval('month')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                billingInterval === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('year')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors relative ${
                billingInterval === 'year'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Yearly
              {plans.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  Save {calculateSavings(
                    plans.find((p: any) => p.interval === 'month')?.price || 0,
                    plans.find((p: any) => p.interval === 'year')?.price || 0
                  )}%
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {filteredPlans.map((plan: any) => (
          <div
            key={plan.id}
            className={`relative rounded-lg border-2 p-6 cursor-pointer transition-all ${
              plan.popular
                ? 'border-blue-500 bg-blue-50'
                : selectedPlan?.id === plan.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onPlanSelect(plan)}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500 text-white">
                  <StarIcon className="w-3 h-3 mr-1" />
                  Most Popular
                </span>
              </div>
            )}

            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {plan.name}
              </h3>
              
              {plan.description && (
                <p className="text-sm text-gray-600 mb-4">
                  {plan.description}
                </p>
              )}

              <div className="mb-6">
                {formatPrice(plan.price, plan.interval)}
              </div>

              <div className="mb-6">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {plan.tokens.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">
                  tokens per {plan.interval}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features?.map((feature, index: any) => (
                  <li key={index} className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onPlanSelect(plan)}
                className={`w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md transition-colors ${
                  plan.popular
                    ? 'text-white bg-blue-600 hover:bg-blue-700'
                    : selectedPlan?.id === plan.id
                    ? 'text-white bg-blue-600 hover:bg-blue-700'
                    : 'text-blue-600 bg-white border-blue-600 hover:bg-blue-50'
                }`}
              >
                {selectedPlan?.id === plan.id ? 'Selected' : 'Select Plan'}
                <ArrowRightIcon className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            No plans available for {billingInterval}ly billing.
          </p>
        </div>
      )}
    </div>
  )
}
