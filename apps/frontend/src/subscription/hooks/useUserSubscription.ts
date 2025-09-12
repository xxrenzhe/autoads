'use client'
import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface UserSubscription {
  id: string
  userId: string
  planId: string
  status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'trialing'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialEnd?: string
  stripeSubscriptionId?: string
  createdAt: string
  updatedAt: string
  plan?: {
    id: string
    name: string
    description: string
    price: number
    currency: string
    interval: 'month' | 'year'
    features: string[]
    limits: {
      tokens: number
      users: number
      apiCalls: number
      storage: number
    }
    popular: boolean
    active: boolean
    trialDays?: number
    stripePriceId?: string
  }
}

export interface BillingHistoryItem {
  id: string
  subscriptionId: string
  amount: number
  currency: string
  status: 'succeeded' | 'failed' | 'pending'
  description: string
  createdAt: string
  invoiceUrl?: string
}

export function useUserSubscription(userId: string) {
  const queryClient = useQueryClient()

  // Fetch user's subscription
  const {
    data: subscription,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['user-subscription', userId],
    queryFn: async (): Promise<UserSubscription | null> => {
      const response = await fetch('/api/subscriptions')
      if (!response.ok) {
        throw new Error('Failed to fetch user subscription')
      }
      const result = await response.json()
      return result.success ? result.data : null
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch available plans
  const {
    data: availablePlans = [],
    isLoading: isPlansLoading,
    error: plansError
  } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const response = await fetch('/api/subscription/plans')
      if (!response.ok) {
        throw new Error('Failed to fetch subscription plans')
      }
      const result = await response.json()
      return result.success ? result.data : []
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch billing history
  const {
    data: billingHistory = [],
    isLoading: isBillingLoading,
    error: billingError
  } = useQuery({
    queryKey: ['billing-history', userId],
    queryFn: async (): Promise<BillingHistoryItem[]> => {
      const response = await fetch('/api/subscriptions/billing-history')
      if (!response.ok) {
        return []
      }
      const result = await response.json()
      return result.success ? result.data : []
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  })

  // Upgrade subscription mutation
  const upgradeSubscriptionMutation = useMutation({
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription', userId] })
    },
  })

  // Downgrade subscription mutation
  const downgradeSubscriptionMutation = useMutation({
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription', userId] })
    },
  })

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({ immediate }: { immediate?: boolean } = {}) => {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ immediate }),
      })
      if (!response.ok) {
        throw new Error('Failed to cancel subscription')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription', userId] })
    },
  })

  // Pause subscription mutation
  const pauseSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/subscriptions/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        throw new Error('Failed to pause subscription')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription', userId] })
    },
  })

  // Resume subscription mutation
  const resumeSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/subscriptions/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        throw new Error('Failed to resume subscription')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription', userId] })
    },
  })

  // Update payment method mutation
  const updatePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await fetch('/api/subscriptions/payment-method', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentMethodId }),
      })
      if (!response.ok) {
        throw new Error('Failed to update payment method')
      }
    },
  })

  // Download invoice mutation
  const downloadInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/subscriptions/invoices/${invoiceId}/download`)
      if (!response.ok) {
        throw new Error('Failed to download invoice')
      }
      return response.blob()
    },
  })

  // Action functions
  const upgradeSubscription = useCallback(async (planId: string) => {
    return upgradeSubscriptionMutation.mutateAsync(planId)
  }, [upgradeSubscriptionMutation])

  const downgradeSubscription = useCallback(async (planId: string) => {
    return downgradeSubscriptionMutation.mutateAsync(planId)
  }, [downgradeSubscriptionMutation])

  const cancelSubscription = useCallback(async (immediate = false) => {
    return cancelSubscriptionMutation.mutateAsync({ immediate })
  }, [cancelSubscriptionMutation])

  const pauseSubscription = useCallback(async () => {
    return pauseSubscriptionMutation.mutateAsync()
  }, [pauseSubscriptionMutation])

  const resumeSubscription = useCallback(async () => {
    return resumeSubscriptionMutation.mutateAsync()
  }, [resumeSubscriptionMutation])

  const updatePaymentMethod = useCallback(async (paymentMethodId: string) => {
    return updatePaymentMethodMutation.mutateAsync(paymentMethodId)
  }, [updatePaymentMethodMutation])

  const downloadInvoice = useCallback(async (invoiceId: string) => {
    return downloadInvoiceMutation.mutateAsync(invoiceId)
  }, [downloadInvoiceMutation])

  return {
    // Data
    subscription,
    availablePlans,
    billingHistory,
    
    // Loading states
    isLoading,
    isPlansLoading,
    isBillingLoading,
    isUpgrading: upgradeSubscriptionMutation.isPending,
    isDowngrading: downgradeSubscriptionMutation.isPending,
    isCancelling: cancelSubscriptionMutation.isPending,
    isPausing: pauseSubscriptionMutation.isPending,
    isResuming: resumeSubscriptionMutation.isPending,
    
    // Errors
    error: error?.message || null,
    plansError: plansError?.message || null,
    billingError: billingError?.message || null,
    
    // Actions
    upgradeSubscription,
    downgradeSubscription,
    cancelSubscription,
    pauseSubscription,
    resumeSubscription,
    updatePaymentMethod,
    downloadInvoice,
    
    // Helpers
    refetch,
  }
}

export default useUserSubscription