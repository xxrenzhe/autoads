import { Metadata } from 'next'
import { Suspense } from 'react'
import SubscriptionSuccess from '@/components/subscription/SubscriptionSuccess'

export const metadata: Metadata = {
  title: 'Subscription Successful',
  description: 'Your subscription has been activated successfully',
}

export default function SubscribeSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Suspense fallback={
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        }>
          <SubscriptionSuccess />
        </Suspense>
      </div>
    </div>
  )
}