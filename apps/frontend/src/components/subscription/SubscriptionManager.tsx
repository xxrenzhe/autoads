'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, ExternalLink, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface Subscription {
  id: string
  status: string
  plan: {
    name: string
    price: number
    currency: string
    interval: string
  }
  currentPeriodStart: string
  currentPeriodEnd: string
  provider: string
  cancelAtPeriodEnd?: boolean
}

interface SubscriptionManagerProps {
  subscription: Subscription | null
}

export default function SubscriptionManager({ subscription }: .*Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleCancelSubscription = async () => {
    if (!subscription) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.id, immediately: false })
      })

      if (response.ok) => {
        setMessage({ type: 'success', text: '订阅将在当前计费周期结束后取消' })
        // Refresh the page to show updated status
        setTimeout(() => window.location.reload(), 2000)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.message || '取消订阅失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '取消订阅失败，请稍后重试' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST'
      })

      if (response.ok) => {
        const { url } = await response.json()
        window.location.href = url
      } else {
        setMessage({ type: 'error', text: '无法打开订阅管理页面' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '无法打开订阅管理页面' })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string, cancelAtPeriodEnd?: boolean) => {
    if (cancelAtPeriodEnd) => {
      return <Badge variant="outline">即将取消</Badge>
    }
    
    switch (status) => {
      case 'ACTIVE':
        return <Badge variant="default">活跃</Badge>
      case 'PENDING':
        return <Badge variant="secondary">待处理</Badge>
      case 'CANCELED':
        return <Badge variant="destructive">已取消</Badge>
      case 'PAST_DUE':
        return <Badge variant="destructive">逾期</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  if (!subscription) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            订阅管理
          </CardTitle>
          <CardDescription>
            您当前没有活跃的订阅
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/pricing">查看套餐</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          订阅管理
        </CardTitle>
        <CardDescription>
          管理您的订阅计划和付款方式
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">当前套餐</span>
            <span className="font-medium">{subscription.plan?.name}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">订阅状态</span>
            {getStatusBadge(subscription.status, subscription.cancelAtPeriodEnd)}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">费用</span>
            <span className="font-medium">
              ${subscription.plan?.price}/{subscription.plan?.interval === 'month' ? '月' : '年'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">当前周期</span>
            <span className="text-sm">
              {format(new Date(subscription.currentPeriodStart), 'yyyy-MM-dd')} - {' '}
              {format(new Date(subscription.currentPeriodEnd), 'yyyy-MM-dd')}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">支付方式</span>
            <span className="text-sm capitalize">{subscription.provider}</span>
          </div>
        </div>

        {subscription.cancelAtPeriodEnd && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              您的订阅将在 {format(new Date(subscription.currentPeriodEnd), 'yyyy-MM-dd')} 后取消。
              在此之前您仍可使用所有功能。
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleManageSubscription}
            disabled={isLoading}
            variant="outline"
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            管理订阅
          </Button>
          
          {!subscription.cancelAtPeriodEnd && subscription.status === 'ACTIVE' && (
            <Button
              onClick={handleCancelSubscription}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              取消订阅
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}