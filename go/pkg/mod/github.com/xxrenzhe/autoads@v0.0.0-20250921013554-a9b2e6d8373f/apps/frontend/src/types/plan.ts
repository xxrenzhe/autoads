export interface Plan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  interval: string
  tokenQuota: number
  features: Record<string, any> | string[]
  isActive: boolean
  stripePriceId: string | null
  stripeYearlyPriceId: string | null
  createdAt: Date | string
  updatedAt: Date | string
  isPopular: boolean
  subscriberCount: number
  revenue: number
  _count?: {
    subscriptions: number
  }
}