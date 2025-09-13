'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard, 
  Calendar,
  ArrowUp,
  ArrowDown,
  Pause,
  Play,
  X,
  Download,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { useUserSubscription } from '../hooks/useUserSubscription'

export interface SubscriptionManagerProps {
  userId: string
  onPlanChange?: (newPlanId: string) => void
  onCancel?: () => void
}

export function SubscriptionManager({ userId, onPlanChange, onCancel }: SubscriptionManagerProps) {
  const {
    subscription,
    availablePlans,
    billingHistory,
    isLoading,
    error,
    upgradeSubscription,
    downgradeSubscription,
    cancelSubscription,
    pauseSubscription,
    resumeSubscription,
    updatePaymentMethod,
    downloadInvoice,
    isUpgrading,
    isDowngrading,
    isCancelling,
    isPausing,
    isResuming
  } = useUserSubscription(userId)

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false)

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'trialing': return 'warning'
      case 'past_due': return 'destructive'
      case 'canceled': return 'destructive'
      case 'paused': return 'secondary'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle
      case 'trialing': return Clock
      case 'past_due': return AlertTriangle
      case 'canceled': return X
      case 'paused': return Pause
      default: return CreditCard
    }
  }

  const handleUpgrade = async (planId: string) => {
    try {
      await upgradeSubscription(planId)
      onPlanChange?.(planId)
      setShowUpgradeOptions(false)
    } catch (error) {
      console.error('Error upgrading subscription:', error)
    }
  }

  const handleDowngrade = async (planId: string) => {
    try {
      await downgradeSubscription(planId)
      onPlanChange?.(planId)
    } catch (error) {
      console.error('Error downgrading subscription:', error)
    }
  }

  const handleCancel = async () => {
    try {
      await cancelSubscription()
      onCancel?.()
      setShowCancelConfirm(false)
    } catch (error) {
      console.error('Error cancelling subscription:', error)
    }
  }

  const handlePause = async () => {
    try {
      await pauseSubscription()
    } catch (error) {
      console.error('Error pausing subscription:', error)
    }
  }

  const handleResume = async () => {
    try {
      await resumeSubscription()
    } catch (error) {
      console.error('Error resuming subscription:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600">Loading subscription...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-6">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>Error loading subscription: {error}</p>
      </div>
    )
  }

  if (!subscription) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Active Subscription
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You're currently on the free plan. Upgrade to unlock premium features.
          </p>
          <Button onClick={((: any): any) => setShowUpgradeOptions(true)}>
            <ArrowUp className="h-4 w-4 mr-2" />
            View Plans
          </Button>
        </CardContent>
      </Card>
    )
  }

  const StatusIcon = getStatusIcon(subscription.status)

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Current Subscription
            </div>
            <Badge variant={getStatusColor(subscription.status) as any}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {subscription.status.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {subscription.plan?.name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {subscription.plan?.description}
              </p>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Price:</span>
                  <span className="text-sm font-medium">
                    {subscription.plan ? formatCurrency(subscription.plan?.price, subscription.plan?.currency) : 'N/A'} / {subscription.plan?.interval}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Current Period:</span>
                  <span className="text-sm font-medium">
                    {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
                {subscription.trialEnd && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Trial Ends:</span>
                    <span className="text-sm font-medium">
                      {new Date(subscription.trialEnd).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {subscription.cancelAtPeriodEnd && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                      <span className="text-sm text-yellow-800">
                        Subscription will cancel on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Plan Features
              </h4>
              <ul className="space-y-2">
                {subscription.plan?.features.slice(0, 5).map((feature: any, index: number: any) => (
                  <li key={index} className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    {feature}
                  </li>
                ))}
                {subscription.plan && subscription.plan?.features?.length > 5 && (
                  <li className="text-sm text-gray-500">
                    +{subscription.plan?.features?.length - 5} more features
                  </li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button
          variant="outline"
          onClick={((: any): any) => setShowUpgradeOptions(true)}
          disabled={isUpgrading}
        >
          <ArrowUp className="h-4 w-4 mr-2" />
          Upgrade Plan
        </Button>
        
        <Button
          variant="outline"
          onClick={((: any): any) => subscription.plan?.id ? handleDowngrade(subscription.plan.id) : undefined}
          disabled={isDowngrading}
        >
          <ArrowDown className="h-4 w-4 mr-2" />
          Downgrade Plan
        </Button>
        
        {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
          <Button
            variant="outline"
            onClick={handlePause}
            disabled={isPausing}
          >
            <Pause className="h-4 w-4 mr-2" />
            Pause Subscription
          </Button>
        )}
        
        {subscription.status === 'cancelled' && (
          <Button
            variant="outline"
            onClick={handleResume}
            disabled={isResuming}
          >
            <Play className="h-4 w-4 mr-2" />
            Resume Subscription
          </Button>
        )}
        
        {!subscription.cancelAtPeriodEnd && (
          <Button
            variant="destructive"
            onClick={((: any): any) => setShowCancelConfirm(true)}
            disabled={isCancelling}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel Subscription
          </Button>
        )}
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {billingHistory && billingHistory.length > 0 ? (
            <div className="space-y-4">
              {billingHistory.slice(0, 5).map((invoice: any: any) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {invoice.description}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(invoice.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                      <Badge variant={invoice.status === 'paid' ? 'success' : 'destructive'}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={((: any): any) => downloadInvoice(invoice.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">No billing history available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center text-red-600">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Cancel Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your current billing period.
              </p>
              <div className="flex items-center justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={((: any): any) => setShowCancelConfirm(false)}
                >
                  Keep Subscription
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default SubscriptionManager