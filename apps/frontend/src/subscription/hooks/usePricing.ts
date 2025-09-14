'use client'
import { useQuery } from '@tanstack/react-query'
import { http } from '@/shared/http/client'

export interface PricingPlan {
  id: string
  name: string
  description: string
  price: {
    monthly: number
    yearly: number
    currency: string
  }
  features: Array<{
    name: string
    included: boolean
    limit?: string
  }>
  popular?: boolean
  recommended?: boolean
  buttonText: string
  buttonVariant: 'default' | 'outline' | 'secondary'
}

export function usePricing() {
  const {
    data: plans = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async (): Promise<PricingPlan[]> => {
      return http.get<PricingPlan[]>('/pricing/plans')
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  })

  return {
    plans,
    isLoading,
    error: error?.message || null
  }
}

export default usePricing
