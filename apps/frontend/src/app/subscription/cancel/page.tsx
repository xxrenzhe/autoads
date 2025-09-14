import { Metadata } from 'next'
import { Suspense } from 'react'
import SubscriptionCancel from '@/components/subscription/SubscriptionCancel'

export const metadata: Metadata = {
  title: '订阅取消 - AdsCenter',
  description: '订阅流程已取消，您可以随时重新开始',
}

export default function SubscriptionCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
        <SubscriptionCancel />
      </Suspense>
    </div>
  )
}
