import { Metadata } from 'next'
import { Suspense } from 'react'
import SubscriptionSuccess from '@/components/subscription/SubscriptionSuccess'

export const metadata: Metadata = {
  title: '订阅成功 - ChangeLink',
  description: '感谢您的订阅，欢迎使用 ChangeLink 高级功能',
}

export default function SubscriptionSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
        <SubscriptionSuccess />
      </Suspense>
    </div>
  )
}