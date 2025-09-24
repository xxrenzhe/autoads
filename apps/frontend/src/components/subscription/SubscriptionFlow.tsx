'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { 
  CheckIcon, 
  CreditCardIcon,
  ShieldCheckIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import PlanSelector from './PlanSelector'
import PaymentForm from './PaymentForm'
import { toast } from 'sonner'
import SubscriptionConfirmation from './SubscriptionConfirmation'
import { http } from '@/shared/http/client'

interface Plan {
  id: string
  name: string
  price: number
  interval: 'month' | 'year'
  tokens: number
  features: string[]
  popular?: boolean
  stripePriceId: string
}

type FlowStep = 'plan-selection' | 'payment' | 'confirmation' | 'success' | 'error'

export default function SubscriptionFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const isPreview = (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV || '').toLowerCase() === 'preview'
  
  const [currentStep, setCurrentStep] = useState<FlowStep>('plan-selection')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)

  // Check for pre-selected plan from URL params
  useEffect(() => {
    const planId = searchParams?.get('plan') || undefined
    if (planId) {
      loadPlanDetails(planId)
    }
  }, [searchParams])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/subscribe')
    }
  }, [status, router])

  const loadPlanDetails = async (planId: string) => {
    try {
      const plan = await http.get<Plan>(`/admin/plans/${planId}`)
      setSelectedPlan(plan as any)
    } catch (error) {
      console.error('Failed to load plan details:', error)
    }
  }

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan)
    setCurrentStep('payment')
  }

  const handlePaymentSubmit = async (paymentData: any) => {
    if (!selectedPlan || !session?.user) return

    // 预发环境：直接跳过扣款，生成模拟订阅ID
    if (isPreview) {
      const mockId = 'sub_mock_' + Math.random().toString(36).slice(2, 10)
      setSubscriptionId(mockId)
      setCurrentStep('success')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await http.post<{ subscriptionId: string; error?: string }>(
        '/subscriptions',
        {
          planId: selectedPlan.id,
          stripePriceId: selectedPlan.stripePriceId,
          paymentMethodId: paymentData.paymentMethodId,
          billingDetails: paymentData.billingDetails
        }
      )

      if ((result as any)?.subscriptionId) {
        setSubscriptionId((result as any).subscriptionId)
        setCurrentStep('success')
      } else {
        throw new Error((result as any)?.error || 'Subscription creation failed')
      }
    } catch (error) {
      console.error('Subscription error:', error)
      const msg = error instanceof Error ? error.message : 'An error occurred'
      setError(msg)
      toast.error('创建订阅失败：' + msg)
      setCurrentStep('error')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToPlanSelection = () => {
    setCurrentStep('plan-selection')
    setSelectedPlan(null)
    setError(null)
  }

  const handleRetryPayment = () => {
    setCurrentStep('payment')
    setError(null)
  }

  // 预发环境：在进入支付步骤时自动完成订阅（无感通过）
  useEffect(() => {
    if (isPreview && currentStep === 'payment' && selectedPlan) {
      const mockId = 'sub_mock_' + Math.random().toString(36).slice(2, 10)
      setSubscriptionId(mockId)
      setCurrentStep('success')
    }
  }, [isPreview, currentStep, selectedPlan])

  if (status === 'loading') {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null // Will redirect to login
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-6">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            <li className="relative">
              <div className={`flex items-center ${
                currentStep === 'plan-selection' ? 'text-blue-600' : 
                ['payment', 'confirmation', 'success'].includes(currentStep) ? 'text-green-600' : 'text-gray-500'
              }`}>
                <span className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  currentStep === 'plan-selection' ? 'border-blue-600 bg-blue-50' :
                  ['payment', 'confirmation', 'success'].includes(currentStep) ? 'border-green-600 bg-green-50' : 'border-gray-300'
                }`}>
                  {['payment', 'confirmation', 'success'].includes(currentStep) ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">1</span>
                  )}
                </span>
                <span className="ml-2 text-sm font-medium">Select Plan</span>
              </div>
            </li>
            
            <li className="relative ml-8">
              <div className="flex items-center">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className={`h-0.5 w-full ${
                    ['payment', 'confirmation', 'success'].includes(currentStep) ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                </div>
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-white ${
                  currentStep === 'payment' ? 'border-blue-600 bg-blue-50 text-blue-600' :
                  ['confirmation', 'success'].includes(currentStep) ? 'border-green-600 bg-green-50 text-green-600' : 'border-gray-300 text-gray-500'
                }`}>
                  {['confirmation', 'success'].includes(currentStep) ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">2</span>
                  )}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep === 'payment' ? 'text-blue-600' :
                  ['confirmation', 'success'].includes(currentStep) ? 'text-green-600' : 'text-gray-500'
                }`}>
                  Payment
                </span>
              </div>
            </li>
            
            <li className="relative ml-8">
              <div className="flex items-center">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className={`h-0.5 w-full ${
                    currentStep === 'success' ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                </div>
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-white ${
                  currentStep === 'success' ? 'border-green-600 bg-green-50 text-green-600' : 'border-gray-300 text-gray-500'
                }`}>
                  {currentStep === 'success' ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">3</span>
                  )}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep === 'success' ? 'text-green-600' : 'text-gray-500'
                }`}>
                  Complete
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow">
        {currentStep === 'plan-selection' && (
          <PlanSelector onPlanSelect={handlePlanSelect} selectedPlan={selectedPlan} />
        )}

        {currentStep === 'payment' && selectedPlan && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handleBackToPlanSelection}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to plan selection
              </button>
              <div className="text-right">
                <div className="text-sm text-gray-600">Selected Plan</div>
                <div className="font-semibold">{selectedPlan.name}</div>
                <div className="text-lg font-bold text-blue-600">
                  ${selectedPlan.price}/{selectedPlan.interval}
                </div>
              </div>
            </div>
            
            <PaymentForm
              plan={selectedPlan}
              onSubmit={handlePaymentSubmit}
              loading={loading}
            />
          </div>
        )}

        {currentStep === 'success' && selectedPlan && subscriptionId && (
          <SubscriptionConfirmation
            plan={selectedPlan}
            subscriptionId={subscriptionId}
          />
        )}

        {currentStep === 'error' && (
          <div className="p-6">
            <div className="text-center">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">
                Payment Failed
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {error || 'There was an error processing your payment. Please try again.'}
              </p>
              <div className="mt-6 flex justify-center space-x-4">
                <button
                  onClick={handleRetryPayment}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <CreditCardIcon className="w-4 h-4 mr-2" />
                  Try Again
                </button>
                <button
                  onClick={handleBackToPlanSelection}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Change Plan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <ShieldCheckIcon className="h-5 w-5 text-blue-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Secure Payment
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                预发环境不会发起真实扣款；在生产环境，支付将通过合规渠道加密处理，我们不会在服务器上存储您的卡片信息。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
