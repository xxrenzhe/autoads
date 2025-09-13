'use client'
import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface SubscriptionPlan {
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
  createdAt: string
  updatedAt: string
}

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
}

export interface SubscriptionAnalytics {
  totalRevenue: number
  monthlyRecurringRevenue: number
  activeSubscriptions: number
  churnRate: number
  averageRevenuePerUser: number
  lifetimeValue: number
  conversionRate: number
  trialConversionRate: number
}

export function useSubscriptionManagement() {
  const queryClient = useQueryClient()

  // Fetch all plans
  const {
    data: plans = [],
    isLoading,
    error,
    refetch: refetchPlans
  } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const response = await fetch('/api/subscription/plans')
      if (!response.ok) {
        throw new Error('Failed to fetch subscription plans')
      }
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch subscription analytics
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
    error: analyticsError
  } = useQuery({
    queryKey: ['subscription-analytics'],
    queryFn: async (): Promise<SubscriptionAnalytics> => {
      const response = await fetch('/api/admin/subscription/analytics')
      if (!response.ok) {
        throw new Error('Failed to fetch subscription analytics')
      }
      return response.json()
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  })

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (planData: Partial<SubscriptionPlan>) => {
      const response = await fetch('/api/admin/subscription/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planData),
      })
      if (!response.ok) {
        throw new Error('Failed to create plan')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-analytics'] })
    },
  })

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, planData }: { planId: string; planData: Partial<SubscriptionPlan> }) => {
      const response = await fetch(`/api/admin/subscription/plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planData),
      })
      if (!response.ok) {
        throw new Error('Failed to update plan')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-analytics'] })
    },
  })

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch(`/api/admin/subscription/plans/${planId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete plan')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-analytics'] })
    },
  })

  // Toggle plan status mutation
  const togglePlanStatusMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch(`/api/admin/subscription/plans/${planId}/toggle`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to toggle plan status')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
    },
  })

  // Subscribe to plan mutation
  const subscribeToPlanMutation = useMutation({
    mutationFn: async ({ planId, paymentMethodId }: { planId: string; paymentMethodId?: string }) => {
      const response = await fetch('/api/subscription/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId, paymentMethodId }),
      })
      if (!response.ok) {
        throw new Error('Failed to subscribe to plan')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscription'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-analytics'] })
    },
  })

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({ subscriptionId, immediate }: { subscriptionId: string; immediate?: boolean }) => {
      const response = await fetch(`/api/subscription/${subscriptionId}/cancel`, {
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
      queryClient.invalidateQueries({ queryKey: ['user-subscription'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-analytics'] })
    },
  })

  // Helper functions
  const getPlanById = useCallback((planId: string): SubscriptionPlan | undefined => {
    return plans.find((plan: any) => plan.id === planId)
  }, [plans])

  const getActivePlans = useCallback((): SubscriptionPlan[] => {
    return plans.filter((plan: any) => plan.active)
  }, [plans])

  const getPopularPlan = useCallback((): SubscriptionPlan | undefined => {
    return plans.find((plan: any) => plan.popular && plan.active)
  }, [plans])

  const getPlansByPrice = useCallback((): SubscriptionPlan[] => {
    return [...plans].sort((a, b) => a.price - b.price)
  }, [plans])

  const getFreePlan = useCallback((): SubscriptionPlan | undefined => {
    return plans.find((plan: any) => plan.price === 0)
  }, [plans])

  const calculateAnnualSavings = useCallback((monthlyPrice: number, yearlyPrice: number): number => {
    const annualMonthlyPrice = monthlyPrice * 12
    return ((annualMonthlyPrice - yearlyPrice) / annualMonthlyPrice) * 100
  }, [])

  const isPlanUpgrade = useCallback((currentPlanId: string, newPlanId: string): boolean => {
    const currentPlan = getPlanById(currentPlanId)
    const newPlan = getPlanById(newPlanId)
    
    if (!currentPlan || !newPlan) return false
    
    return newPlan.price > currentPlan.price
  }, [getPlanById])

  const isPlanDowngrade = useCallback((currentPlanId: string, newPlanId: string): boolean => {
    const currentPlan = getPlanById(currentPlanId)
    const newPlan = getPlanById(newPlanId)
    
    if (!currentPlan || !newPlan) return false
    
    return newPlan.price < currentPlan.price
  }, [getPlanById])

  const getRecommendedPlan = useCallback((usage: { tokens: number; users: number; apiCalls: number }): SubscriptionPlan | undefined => {
    const activePlans = getActivePlans().sort((a, b) => a.price - b.price)
    
    return activePlans.find((plan: any) => 
      plan.limits.tokens >= usage.tokens &&
      plan.limits.users >= usage.users &&
      plan.limits.apiCalls >= usage.apiCalls
    )
  }, [getActivePlans])

  // Action functions
  const createPlan = useCallback(async (planData: Partial<SubscriptionPlan>) => {
    return createPlanMutation.mutateAsync(planData)
  }, [createPlanMutation])

  const updatePlan = useCallback(async (planId: string, planData: Partial<SubscriptionPlan>) => {
    return updatePlanMutation.mutateAsync({ planId, planData })
  }, [updatePlanMutation])

  const deletePlan = useCallback(async (planId: string) => {
    return deletePlanMutation.mutateAsync(planId)
  }, [deletePlanMutation])

  const togglePlanStatus = useCallback(async (planId: string) => {
    return togglePlanStatusMutation.mutateAsync(planId)
  }, [togglePlanStatusMutation])

  const subscribeToPlan = useCallback(async (planId: string, paymentMethodId?: string) => {
    return subscribeToPlanMutation.mutateAsync({ planId, paymentMethodId })
  }, [subscribeToPlanMutation])

  const cancelSubscription = useCallback(async (subscriptionId: string, immediate?: boolean) => {
    return cancelSubscriptionMutation.mutateAsync({ subscriptionId, immediate })
  }, [cancelSubscriptionMutation])

  const refreshPlans = useCallback(() => {
    refetchPlans()
  }, [refetchPlans])

  return {
    // Data
    plans,
    analytics,
    
    // Loading states
    isLoading,
    isAnalyticsLoading,
    isCreating: createPlanMutation.isPending,
    isUpdating: updatePlanMutation.isPending,
    isDeleting: deletePlanMutation.isPending,
    isTogglingStatus: togglePlanStatusMutation.isPending,
    isSubscribing: subscribeToPlanMutation.isPending,
    isCancelling: cancelSubscriptionMutation.isPending,
    
    // Errors
    error: error?.message || null,
    analyticsError: analyticsError?.message || null,
    createError: createPlanMutation.error?.message || null,
    updateError: updatePlanMutation.error?.message || null,
    deleteError: deletePlanMutation.error?.message || null,
    toggleError: togglePlanStatusMutation.error?.message || null,
    subscribeError: subscribeToPlanMutation.error?.message || null,
    cancelError: cancelSubscriptionMutation.error?.message || null,
    
    // Actions
    createPlan,
    updatePlan,
    deletePlan,
    togglePlanStatus,
    subscribeToPlan,
    cancelSubscription,
    refreshPlans,
    
    // Helpers
    getPlanById,
    getActivePlans,
    getPopularPlan,
    getPlansByPrice,
    getFreePlan,
    calculateAnnualSavings,
    isPlanUpgrade,
    isPlanDowngrade,
    getRecommendedPlan,
  }
}

export default useSubscriptionManagement