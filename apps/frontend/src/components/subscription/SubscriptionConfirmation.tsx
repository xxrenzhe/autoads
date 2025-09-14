'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CheckCircleIcon,
  CreditCardIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ArrowRightIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { http } from '@/shared/http/client'
import { toast } from 'sonner'

interface Plan {
  id: string
  name: string
  price: number
  interval: 'month' | 'year'
  tokens: number
  features: string[]
}

interface SubscriptionConfirmationProps {
  plan: Plan
  subscriptionId: string
}

interface SubscriptionDetails {
  id: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  nextBillingDate: string
  paymentMethod: {
    brand: string
    last4: string
  }
  invoice?: {
    id: string
    url: string
    amount: number
  }
}

export default function SubscriptionConfirmation({ 
  plan, 
  subscriptionId 
}: SubscriptionConfirmationProps) {
  const router = useRouter()
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubscriptionDetails()
  }, [subscriptionId])

  const loadSubscriptionDetails = async () => {
    try {
      const data = await http.get<SubscriptionDetails>(`/subscriptions/${subscriptionId}`)
      setSubscriptionDetails(data as any)
    } catch (error) {
      console.error('Failed to load subscription details:', error)
      toast.error('加载订阅详情失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleGoToDashboard = () => {
    router.push('/dashboard')
  }

  const handleManageSubscription = () => {
    router.push('/account/subscription')
  }

  const handleDownloadInvoice = () => {
    if (subscriptionDetails?.invoice?.url) {
      window.open(subscriptionDetails.invoice.url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="text-center mb-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
          <CheckCircleIcon className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Subscription Successful!
        </h2>
        <p className="text-gray-600">
          Welcome to {plan.name}! Your subscription is now active and ready to use.
        </p>
      </div>

      {/* Subscription Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Subscription Details
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center">
              <CurrencyDollarIcon className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <div className="text-sm text-gray-600">Plan</div>
                <div className="font-medium">{plan.name}</div>
              </div>
            </div>
            
            <div className="flex items-center">
              <CalendarIcon className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <div className="text-sm text-gray-600">Billing</div>
                <div className="font-medium">${plan.price} per {plan.interval}</div>
              </div>
            </div>

            <div className="flex items-center">
              <div className="h-5 w-5 bg-blue-500 rounded-full mr-3 flex items-center justify-center">
                <span className="text-white text-xs font-bold">T</span>
              </div>
              <div>
                <div className="text-sm text-gray-600">Tokens</div>
                <div className="font-medium">{plan.tokens.toLocaleString()} per {plan.interval}</div>
              </div>
            </div>
          </div>

          {subscriptionDetails && (
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="h-5 w-5 bg-green-500 rounded-full mr-3"></div>
                <div>
                  <div className="text-sm text-gray-600">Status</div>
                  <div className="font-medium capitalize">{subscriptionDetails.status}</div>
                </div>
              </div>

              <div className="flex items-center">
                <CalendarIcon className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <div className="text-sm text-gray-600">Next Billing Date</div>
                  <div className="font-medium">
                    {formatDate(subscriptionDetails.nextBillingDate)}
                  </div>
                </div>
              </div>

              {subscriptionDetails.paymentMethod && (
                <div className="flex items-center">
                  <CreditCardIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <div className="text-sm text-gray-600">Payment Method</div>
                    <div className="font-medium">
                      {subscriptionDetails.paymentMethod.brand.toUpperCase()} ****{subscriptionDetails.paymentMethod.last4}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Features Included */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          What's Included
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plan.features?.map((feature, index: any) => (
            <div key={index} className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice Section */}
      {subscriptionDetails?.invoice && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Invoice #{subscriptionDetails.invoice.id}
                </div>
                <div className="text-sm text-gray-600">
                  Amount: ${subscriptionDetails.invoice.amount}
                </div>
              </div>
            </div>
            <button
              onClick={handleDownloadInvoice}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Download
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleGoToDashboard}
          className="flex-1 flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Go to Dashboard
          <ArrowRightIcon className="ml-2 h-5 w-5" />
        </button>
        
        <button
          onClick={handleManageSubscription}
          className="flex-1 flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Manage Subscription
        </button>
      </div>

      {/* Next Steps */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          What's Next?
        </h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Your tokens have been added to your account</li>
          <li>• You can now access all premium features</li>
          <li>• Check your email for a confirmation receipt</li>
          <li>• Visit your dashboard to start using the service</li>
        </ul>
      </div>
    </div>
  )
}
