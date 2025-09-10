'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowUp,
  ArrowDown,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Calendar,
  Zap,
  Users,
  Shield
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export interface SubscriptionUpgradeProps {
  currentPlan: {
    id: string
    name: string
    price: number
    currency: string
    interval: string
    features: string[]
  }
  availablePlans: Array<{
    id: string
    name: string
    price: number
    currency: string
    interval: string
    features: string[]
    popular?: boolean
  }>
  onUpgrade?: (planId: string) => void
  onDowngrade?: (planId: string) => void
  className?: string
}

export function SubscriptionUpgrade({ 
  currentPlan, 
  availablePlans, 
  onUpgrade, 
  onDowngrade,
  className 
}: SubscriptionUpgradeProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [changeType, setChangeType] = useState<'upgrade' | 'downgrade'>('upgrade')
  const queryClient = useQueryClient()

  const upgradeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to upgrade subscription')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription'] })
      setShowConfirmation(false)
      setSelectedPlan(null)
    },
  })

  const downgradeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch('/api/subscription/downgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to downgrade subscription')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription'] })
      setShowConfirmation(false)
      setSelectedPlan(null)
    },
  })

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(price / 100)
  }

  const isUpgrade = (planPrice: number) => planPrice > currentPlan.price
  const isDowngrade = (planPrice: number) => planPrice < currentPlan.price

  const handlePlanSelect = (planId: string, planPrice: number) => {
    setSelectedPlan(planId)
    setChangeType(isUpgrade(planPrice) ? 'upgrade' : 'downgrade')
    setShowConfirmation(true)
  }

  const handleConfirmChange = () => {
    if (!selectedPlan) return

    if (changeType === 'upgrade') {
      upgradeMutation.mutate(selectedPlan)
      onUpgrade?.(selectedPlan)
    } else {
      downgradeMutation.mutate(selectedPlan)
      onDowngrade?.(selectedPlan)
    }
  }

  const getSelectedPlanDetails = () => {
    return availablePlans.find(plan => plan.id === selectedPlan)
  }

  const calculateProration = (newPlanPrice: number) => {
    const priceDifference = newPlanPrice - currentPlan.price
    const daysInMonth = 30
    const remainingDays = 15 // This would be calculated based on current period
    
    return (priceDifference * remainingDays) / daysInMonth / 100
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Current Plan */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
              Current Plan
            </span>
            <Badge variant="secondary">Active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {currentPlan.name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {formatPrice(currentPlan.price, currentPlan.currency)} / {currentPlan.interval}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center">
              <Zap className="h-4 w-4 text-blue-500 mr-2" />
              <span className="text-sm">Current features</span>
            </div>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 text-green-500 mr-2" />
              <span className="text-sm">Active billing</span>
            </div>
            <div className="flex items-center">
              <Shield className="h-4 w-4 text-purple-500 mr-2" />
              <span className="text-sm">Full access</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Available Plans
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availablePlans
            .filter(plan => plan.id !== currentPlan.id)
            .map((plan) => {
              const isUpgradePlan = isUpgrade(plan.price)
              const isDowngradePlan = isDowngrade(plan.price)
              
              return (
                <Card 
                  key={plan.id}
                  className={`relative transition-all hover:shadow-lg ${
                    plan.popular ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-600 text-white">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center">
                    <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
                      {plan.name}
                    </CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        {formatPrice(plan.price, plan.currency)}
                      </span>
                      <span className="text-gray-500 ml-1">/{plan.interval}</span>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Price Comparison */}
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          vs Current Plan:
                        </span>
                        <div className={`flex items-center ${
                          isUpgradePlan ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {isUpgradePlan ? (
                            <ArrowUp className="h-3 w-3 mr-1" />
                          ) : (
                            <ArrowDown className="h-3 w-3 mr-1" />
                          )}
                          <span className="font-medium">
                            {formatPrice(Math.abs(plan.price - currentPlan.price), plan.currency)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-6">
                      {plan.features?.slice(0, 4).map((feature, index) => (
                        <li key={index} className="flex items-center text-sm">
                          <CheckCircle className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                      {plan.features?.length > 4 && (
                        <li className="text-sm text-gray-500">
                          +{plan.features?.length - 4} more features
                        </li>
                      )}
                    </ul>

                    {/* Action Button */}
                    <Button
                      onClick={() => handlePlanSelect(plan.id, plan.price)}
                      className="w-full"
                      variant={isUpgradePlan ? 'default' : 'outline'}
                    >
                      {isUpgradePlan ? (
                        <>
                          <ArrowUp className="h-4 w-4 mr-2" />
                          Upgrade to {plan.name}
                        </>
                      ) : (
                        <>
                          <ArrowDown className="h-4 w-4 mr-2" />
                          Downgrade to {plan.name}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center">
                {changeType === 'upgrade' ? (
                  <ArrowUp className="h-5 w-5 text-green-600 mr-2" />
                ) : (
                  <ArrowDown className="h-5 w-5 text-orange-600 mr-2" />
                )}
                Confirm {changeType === 'upgrade' ? 'Upgrade' : 'Downgrade'}
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              {(() => {
                const selectedPlanDetails = getSelectedPlanDetails()
                if (!selectedPlanDetails) return null

                const proration = calculateProration(selectedPlanDetails.price)
                
                return (
                  <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Current Plan:
                        </span>
                        <span className="font-medium">{currentPlan.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          New Plan:
                        </span>
                        <span className="font-medium">{selectedPlanDetails.name}</span>
                      </div>
                    </div>

                    {changeType === 'upgrade' && proration > 0 && (
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <div className="flex items-start">
                          <CreditCard className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-blue-800">
                              Prorated Charge
                            </p>
                            <p className="text-sm text-blue-600">
                              You'll be charged {formatPrice(proration * 100, selectedPlanDetails.currency)} 
                              today for the remaining billing period.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {changeType === 'downgrade' && (
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                        <div className="flex items-start">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800">
                              Downgrade Notice
                            </p>
                            <p className="text-sm text-yellow-600">
                              Your plan will be downgraded at the end of your current billing period.
                              You'll keep access to current features until then.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-3">
                      <Button
                        onClick={handleConfirmChange}
                        disabled={upgradeMutation.isPending || downgradeMutation.isPending}
                        className="flex-1"
                      >
                        {upgradeMutation.isPending || downgradeMutation.isPending
                          ? 'Processing...'
                          : `Confirm ${changeType === 'upgrade' ? 'Upgrade' : 'Downgrade'}`
                        }
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowConfirmation(false)
                          setSelectedPlan(null)
                        }}
                        disabled={upgradeMutation.isPending || downgradeMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default SubscriptionUpgrade