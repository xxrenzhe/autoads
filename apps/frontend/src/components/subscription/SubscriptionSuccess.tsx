'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  CheckCircleIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

export default function SubscriptionSuccess() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscriptionData, setSubscriptionData] = useState<any>(null)

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const subscriptionId = searchParams.get('subscription_id')

    if (sessionId || subscriptionId) => {
      verifySubscription(sessionId, subscriptionId)
    } else {
      setError('Missing subscription information')
      setLoading(false)
    }
  }, [searchParams])

  const verifySubscription = async (sessionId?: string | null, subscriptionId?: string | null) => {
    try {
      const params = new URLSearchParams()
      if (sessionId) params.append('session_id', sessionId)
      if (subscriptionId) params.append('subscription_id', subscriptionId)

      const response = await fetch(`/api/subscriptions/verify?${params}`)
      const data = await response.json()

      if (response.ok) => {
        setSubscriptionData(data)
      } else {
        setError(data.error || 'Failed to verify subscription')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setError('An error occurred while verifying your subscription')
    } finally {
      setLoading(false)
    }
  }

  const handleGoToDashboard = () => {
    router.push('/dashboard')
  }

  const handleManageSubscription = () => {
    router.push('/account/subscription')
  }

  if (loading) => {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Verifying your subscription...
          </h2>
          <p className="text-gray-600">
            Please wait while we confirm your payment and activate your subscription.
          </p>
        </div>
      </div>
    )
  }

  if (error) => {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Subscription Verification Failed
          </h2>
          <p className="text-gray-600 mb-6">
            {error}
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => router.push('/subscribe')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/contact')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-8">
      <div className="text-center mb-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
          <CheckCircleIcon className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to {subscriptionData?.plan?.name || 'Premium'}!
        </h1>
        <p className="text-gray-600">
          Your subscription has been activated successfully. You now have access to all premium features.
        </p>
      </div>

      {subscriptionData && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Subscription Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Plan</div>
              <div className="font-medium">{subscriptionData.plan?.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Tokens</div>
              <div className="font-medium">{subscriptionData.plan?.tokens?.toLocaleString()} per {subscriptionData.plan?.interval}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Amount</div>
              <div className="font-medium">${subscriptionData.plan?.price} per {subscriptionData.plan?.interval}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <div className="font-medium text-green-600 capitalize">{subscriptionData.status}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
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
    </div>
  )
}