'use client'

import { useRouter } from 'next/navigation'
import { 
  XCircleIcon,
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'

export default function SubscriptionCancel() {
  const router = useRouter()

  const handleBackToPlans = () => {
    router.push('/pricing')
  }

  const handleContactSupport = () => {
    router.push('/contact')
  }

  const handleGoHome = () => {
    router.push('/')
  }

  return (
    <div className="bg-white rounded-lg shadow p-8">
      <div className="text-center mb-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
          <XCircleIcon className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Subscription Cancelled
        </h1>
        <p className="text-gray-600">
          Your subscription process was cancelled. No payment has been charged to your account.
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-yellow-800 mb-2">
          What happened?
        </h3>
        <p className="text-sm text-yellow-700">
          You cancelled the subscription process before completing the payment. 
          This could happen if you closed the payment window, clicked the back button, 
          or decided not to proceed with the subscription.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          Still interested in subscribing?
        </h3>
        <p className="text-sm text-blue-700 mb-3">
          You can return to our pricing page to choose a plan that works for you. 
          If you have any questions or need help, our support team is here to assist.
        </p>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Compare all available plans and features</li>
          <li>• Get help choosing the right plan for your needs</li>
          <li>• Contact support if you experienced any issues</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <button
          onClick={handleBackToPlans}
          className="flex-1 flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <ArrowLeftIcon className="mr-2 h-5 w-5" />
          Back to Pricing
        </button>
        
        <button
          onClick={handleContactSupport}
          className="flex-1 flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <ChatBubbleLeftRightIcon className="mr-2 h-5 w-5" />
          Contact Support
        </button>
      </div>

      <div className="text-center">
        <button
          onClick={handleGoHome}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Return to Home Page
        </button>
      </div>
    </div>
  )
}