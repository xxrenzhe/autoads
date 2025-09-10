import { Metadata } from 'next'
import { Suspense } from 'react'
import SubscriptionFlow from '@/components/subscription/SubscriptionFlow'

export const metadata: Metadata = {
  title: 'Subscribe - Choose Your Plan',
  description: 'Subscribe to unlock premium features and get more tokens',
}

export default function SubscribePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600">
            Select the perfect plan for your needs and start using premium features
          </p>
        </div>
        
        <Suspense fallback={
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        }>
          <SubscriptionFlow />
        </Suspense>
      </div>
    </div>
  )
}