import { Metadata } from 'next'
import { Suspense } from 'react'
import SubscriptionManagement from '@/components/subscription/SubscriptionManagement'

export const metadata: Metadata = {
  title: '订阅管理 - ChangeLink',
  description: '管理您的订阅计划、查看使用情况和账单历史',
}

export default function SubscriptionManagePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">订阅管理</h1>
          <p className="text-gray-600 mt-2">
            管理您的订阅计划、查看使用情况和账单历史
          </p>
        </div>
        
        <Suspense fallback={<div className="text-center">加载中...</div>}>
          <SubscriptionManagement />
        </Suspense>
      </div>
    </div>
  )
}