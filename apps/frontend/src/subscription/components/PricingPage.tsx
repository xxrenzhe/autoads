'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Check, 
  X,
  Star,
  Zap,
  Users,
  Shield,
  Headphones,
  ArrowRight,
  CreditCard,
  Gift
} from 'lucide-react'
import { usePricing } from '../hooks/usePricing'

export interface PricingPlan {
  id: string
  name: string
  description: string
  price: {
    monthly: number
    yearly: number
    currency: string
  }
  features: Array<{
    name: string
    included: boolean
    limit?: string
  }>
  popular?: boolean
  recommended?: boolean
  buttonText: string
  buttonVariant: 'default' | 'outline' | 'secondary'
}

export interface PricingPageProps {
  userId?: string
  currentPlan?: string
  onSelectPlan?: (planId: string, billing: 'monthly' | 'yearly') => void
}

export function PricingPage({ userId, currentPlan, onSelectPlan }: PricingPageProps) {
  const { plans, isLoading, error } = usePricing()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId)
    onSelectPlan?.(planId, billingCycle)
  }

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(price / 100)
  }

  const getYearlySavings = (monthly: number, yearly: number) => {
    const yearlyTotal = yearly * 12
    const monthlyTotal = monthly * 12
    const savings = ((monthlyTotal - yearlyTotal) / monthlyTotal) * 100
    return Math.round(savings)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600">Loading pricing plans...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-6">
        <p>Error loading pricing plans: {error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Choose Your Plan
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          Select the perfect plan for your needs. Upgrade or downgrade at any time.
        </p>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <span className={`text-sm ${billingCycle === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={((: any): any) => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              billingCycle === 'yearly' ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm ${billingCycle === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            Yearly
          </span>
          {billingCycle === 'yearly' && (
            <Badge variant="success" className="ml-2">
              <Gift className="h-3 w-3 mr-1" />
              Save up to 20%
            </Badge>
          )}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {plans.map((plan: any) => {
          const price = billingCycle === 'monthly' ? plan.price.monthly : plan.price.yearly
          const isCurrentPlan = currentPlan === plan.id
          const savings = billingCycle === 'yearly' ? getYearlySavings(plan.price.monthly, plan.price.yearly) : 0
          
          return (
            <Card 
              key={plan.id}
              className={`relative transition-all duration-200 hover:shadow-lg ${
                plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''
              } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge variant="default" className="px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              {plan.recommended && (
                <div className="absolute -top-4 right-4">
                  <Badge variant="secondary" className="px-3 py-1">
                    Recommended
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                  {plan.name}
                </CardTitle>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  {plan.description}
                </p>
                
                <div className="mt-6">
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {formatPrice(price, plan.price.currency)}
                    </span>
                    <span className="text-gray-500 ml-2">
                      /{billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                  
                  {billingCycle === 'yearly' && savings > 0 && (
                    <div className="mt-2">
                      <Badge variant="success" className="text-xs">
                        Save {savings}% annually
                      </Badge>
                    </div>
                  )}
                  
                  {billingCycle === 'yearly' && (
                    <p className="text-sm text-gray-500 mt-1">
                      {formatPrice(plan.price.yearly, plan.price.currency)} billed annually
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {plan.features?.map((feature, index: any) => (
                    <li key={index} className="flex items-start">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <span className={`text-sm ${feature.included ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                          {feature.name}
                        </span>
                        {feature.limit && (
                          <span className="text-xs text-gray-500 block">
                            {feature.limit}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                <Button
                  onClick={((: any): any) => handleSelectPlan(plan.id)}
                  variant={isCurrentPlan ? 'outline' : plan.buttonVariant}
                  className="w-full"
                  disabled={isCurrentPlan}
                >
                  {isCurrentPlan ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Current Plan
                    </>
                  ) : (
                    <>
                      {plan.buttonText}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Features Comparison */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
          Compare All Features
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-4 px-4 font-medium text-gray-900 dark:text-white">
                  Features
                </th>
                {plans.map((plan: any) => (
                  <th key={plan.id} className="text-center py-4 px-4 font-medium text-gray-900 dark:text-white">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Get all unique features */}
              {Array.from(new Set(plans.flatMap(plan => plan.features?.filter(Boolean)?.map((f: any) => f.name)))).map((featureName: any) => (
                <tr key={featureName} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                    {featureName}
                  </td>
                  {plans.map((plan: any) => {
                    const feature = plan.features?.find((f: any) => f.name === featureName)
                    return (
                      <td key={plan.id} className="py-3 px-4 text-center">
                        {feature?.included ? (
                          <Check className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-400 mx-auto" />
                        )}
                        {feature?.limit && (
                          <div className="text-xs text-gray-500 mt-1">
                            {feature.limit}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="text-center mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
          Frequently Asked Questions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Can I change my plan anytime?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the billing accordingly.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              What payment methods do you accept?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              We accept all major credit cards, PayPal, and bank transfers. All payments are processed securely through Stripe.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Is there a free trial?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Yes, all paid plans come with a 14-day free trial. No credit card required to start your trial.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              What happens if I exceed my limits?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              We'll notify you when you're approaching your limits. You can upgrade your plan or purchase additional resources as needed.
            </p>
          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-8 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
          <div className="flex flex-col items-center">
            <Shield className="h-8 w-8 text-green-500 mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Secure</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bank-level security
            </p>
          </div>
          
          <div className="flex flex-col items-center">
            <Users className="h-8 w-8 text-blue-500 mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Trusted</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              10,000+ customers
            </p>
          </div>
          
          <div className="flex flex-col items-center">
            <Headphones className="h-8 w-8 text-purple-500 mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Support</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              24/7 customer support
            </p>
          </div>
          
          <div className="flex flex-col items-center">
            <Zap className="h-8 w-8 text-yellow-500 mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Fast</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              99.9% uptime SLA
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PricingPage