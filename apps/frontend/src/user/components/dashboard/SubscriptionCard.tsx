'use client'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/shared/components/ui/ProgressBar'
import { 
  CreditCard, 
  Calendar,
  Zap,
  ArrowUp,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react'

export interface SubscriptionInfo {
  plan: string
  status: 'active' | 'cancelled' | 'expired' | 'trial'
  expiresAt?: string
  features: string[]
  billing: {
    amount: number
    currency: string
    interval: 'month' | 'year'
    nextBillingDate?: string
  }
}

export interface TokenUsage {
  used: number
  limit: number
  resetDate: string
}

export interface SubscriptionCardProps {
  subscription?: SubscriptionInfo | null
  usage?: TokenUsage
  onUpgrade?: () => void
  onManage?: () => void
}

export function SubscriptionCard({ 
  subscription, 
  usage, 
  onUpgrade, 
  onManage 
}: .*Props) {
  const getStatusColor = (status: string) => {
    switch (status) => {
      case 'active': return 'success'
      case 'trial': return 'warning'
      case 'cancelled': return 'destructive'
      case 'expired': return 'destructive'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) => {
      case 'active': return CheckCircle
      case 'trial': return Clock
      case 'cancelled': return AlertTriangle
      case 'expired': return AlertTriangle
      default: return CreditCard
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100)
  }

  const getDaysUntilExpiry = () => {
    if (!subscription?.expiresAt) return null
    const expiryDate = new Date(subscription.expiresAt)
    const now = new Date()
    const diffTime = expiryDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getDaysUntilReset = () => {
    if (!usage?.resetDate) return null
    const resetDate = new Date(usage.resetDate)
    const now = new Date()
    const diffTime = resetDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const usagePercentage = usage ? (usage.used / usage.limit) * 100 : 0
  const daysUntilExpiry = getDaysUntilExpiry()
  const daysUntilReset = getDaysUntilReset()

  // Free plan case
  if (!subscription) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Free Plan
            </div>
            <Badge variant="secondary">FREE</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              You're currently on the free plan with limited features.
            </p>
            
            {usage && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Token Usage</span>
                  <span className="text-sm text-gray-500">
                    {usage.used} / {usage.limit}
                  </span>
                </div>
                <Progress 
                  value={usagePercentage} 
                  className={`h-2 ${usagePercentage > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                />
                {daysUntilReset && (
                  <p className="text-xs text-gray-500 mt-1">
                    Resets in {daysUntilReset} day{daysUntilReset !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            <div className="pt-4 border-t">
              <Button onClick={onUpgrade} className="w-full">
                <ArrowUp className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const StatusIcon = getStatusIcon(subscription.status)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            {subscription.plan} Plan
          </div>
          <Badge variant={getStatusColor(subscription.status) as any}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {subscription.status.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Billing Information */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(subscription.billing.amount, subscription.billing.currency)}
              </p>
              <p className="text-sm text-gray-500">
                per {subscription.billing.interval}
              </p>
            </div>
            {subscription.billing.nextBillingDate && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Next billing</p>
                <p className="text-sm font-medium">
                  {new Date(subscription.billing.nextBillingDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Expiry Warning */}
          {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-800">
                  {daysUntilExpiry <= 0 
                    ? 'Your subscription has expired'
                    : `Your subscription expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`
                  }
                </span>
              </div>
            </div>
          )}

          {/* Token Usage */}
          {usage && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <Zap className="h-4 w-4 mr-1 text-blue-500" />
                  <span className="text-sm font-medium">Token Usage</span>
                </div>
                <span className="text-sm text-gray-500">
                  {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={usagePercentage} 
                className={`h-3 ${
                  usagePercentage > 90 ? 'bg-red-500' : 
                  usagePercentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">
                  {usagePercentage.toFixed(1)}% used
                </span>
                {daysUntilReset && (
                  <span className="text-xs text-gray-500">
                    Resets in {daysUntilReset} day{daysUntilReset !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Features */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Plan Features
            </h4>
            <div className="space-y-1">
              {subscription.features.slice(0, 4).map((feature, index: any) => (
                <div key={index} className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                  {feature}
                </div>
              ))}
              {subscription.features.length > 4 && (
                <p className="text-xs text-gray-500 mt-1">
                  +{subscription.features.length - 4} more features
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t space-y-2">
            {subscription.status === 'active' && (
              <Button variant="outline" onClick={onManage} className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Manage Subscription
              </Button>
            )}
            
            {subscription.status === 'cancelled' && (
              <Button onClick={onUpgrade} className="w-full">
                <ArrowUp className="h-4 w-4 mr-2" />
                Reactivate Subscription
              </Button>
            )}
            
            {subscription.status === 'expired' && (
              <Button onClick={onUpgrade} className="w-full">
                <ArrowUp className="h-4 w-4 mr-2" />
                Renew Subscription
              </Button>
            )}
            
            {subscription.status === 'trial' && (
              <Button onClick={onUpgrade} className="w-full">
                <ArrowUp className="h-4 w-4 mr-2" />
                Upgrade Now
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default SubscriptionCard