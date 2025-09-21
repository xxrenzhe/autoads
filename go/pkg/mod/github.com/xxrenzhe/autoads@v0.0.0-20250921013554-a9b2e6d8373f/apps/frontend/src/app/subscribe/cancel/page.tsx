import { Metadata } from 'next'
import SubscriptionCancel from '@/components/subscription/SubscriptionCancel'

export const metadata: Metadata = {
  title: 'Subscription Cancelled',
  description: 'Your subscription process was cancelled',
}

export default function SubscribeCancelPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <SubscriptionCancel />
      </div>
    </div>
  )
}