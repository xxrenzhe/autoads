'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, Shield, CheckCircle } from 'lucide-react'

interface Subscription {
  id: string
  status: string
  plan: {
    name: string
    description: string
    price: number
    currency: string
    interval: string
    features: string
  }
}

export default function PaymentPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    fetchSubscription()
  }, [status, router, params.id])

  const fetchSubscription = async () => {
    try {
      const response = await fetch(`/api/subscriptions/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setSubscription(data)
      }
    } catch (error) {
      console.error('Error fetching subscription:', error)
    }
  }

  const handlePayment = async () => {
    setLoading(true)
    setPaymentStatus('processing')

    try {
      // Create Wise payment
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: params.id,
          amount: subscription?.plan.price,
          currency: subscription?.plan.currency,
        }),
      })

      if (response.ok) {
        const payment = await response.json()
        
        // Redirect to Wise payment page
        if (payment.redirectUrl) {
          window.location.href = payment.redirectUrl
        } else {
          setPaymentStatus('completed')
          // Redirect to success page after a delay
          setTimeout(() => {
            router.push('/payment/success')
          }, 2000)
        }
      } else {
        setPaymentStatus('failed')
      }
    } catch (error) {
      console.error('Error processing payment:', error)
      setPaymentStatus('failed')
    } finally {
      setLoading(false)
    }
  }

  const parseFeatures = (features: string) => {
    try {
      return JSON.parse(features)
    } catch {
      return []
    }
  }

  if (!subscription) {
    return <div>Loading...</div>
  }

  const features = parseFeatures(subscription.plan?.features)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            完成支付
          </h1>
          <p className="text-gray-600">
            您正在订阅 {subscription.plan?.name} 套餐
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>订单摘要</CardTitle>
              <CardDescription>请确认您的订阅详情</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">套餐</span>
                <Badge variant="outline">{subscription.plan?.name}</Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">价格</span>
                <span className="text-2xl font-bold">
                  ${subscription.plan?.price}/{subscription.plan?.interval === 'MONTH' ? '月' : '年'}
                </span>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">包含功能：</h4>
                <ul className="space-y-2">
                  {features.map((feature: any, idx: number: any) => (
                    <li key={idx} className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      {typeof feature === 'object' ? feature.name : feature}
                      {typeof feature === 'object' && feature.value && (
                        <span className="text-blue-600 font-medium ml-1">
                          ({feature.value} {feature.unit})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                支付信息
              </CardTitle>
              <CardDescription>
                安全支付，由 Wise 处理
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentStatus === 'completed' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    支付成功！正在跳转...
                  </AlertDescription>
                </Alert>
              )}

              {paymentStatus === 'failed' && (
                <Alert variant="destructive">
                  <AlertDescription>
                    支付失败，请重试
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Shield className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-900">安全支付保障</span>
                </div>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 使用 Wise 安全支付网关</li>
                  <li>• 支持多种支付方式</li>
                  <li>• 7天无理由退款</li>
                </ul>
              </div>

              <Button 
                onClick={handlePayment}
                disabled={loading || paymentStatus === 'processing'}
                className="w-full"
                size="lg"
              >
                {loading ? '处理中...' : paymentStatus === 'processing' ? '正在处理...' : `支付 $${subscription.plan?.price}`}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                点击支付即表示您同意我们的服务条款和隐私政策
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}