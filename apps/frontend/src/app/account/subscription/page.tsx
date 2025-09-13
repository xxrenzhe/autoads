import { Metadata } from 'next'
import { Suspense } from 'react'
import SubscriptionManagement from '@/components/subscription/SubscriptionManagement'

export const metadata: Metadata = {
  title: 'Manage Subscription',
  description: 'Manage your subscription, billing, and payment methods',
}

export default function SubscriptionManagementPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Subscription Management
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your subscription, billing information, and payment methods
          </p>
        </div>

        <Suspense fallback={
          <div className="space-y-6">
            {[...Array(3)].map((_, i: any) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-32 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        }>
          <SubscriptionManagement />
        </Suspense>
      </div>
    </div>
  )
}