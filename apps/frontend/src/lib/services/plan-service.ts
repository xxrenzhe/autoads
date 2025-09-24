import { prisma } from '@/lib/db'
// Removed Prisma types; service should use BFF endpoints instead of direct DB access

type Plan = any

export interface CreatePlanData {
  name: string
  displayName: string
  description: string
  price: number
  currency: string
  interval: 'MONTH' | 'YEAR'
  billingPeriod: number
  tokenQuota: number
  features: {
    siterank: boolean
    batchopen: boolean
    adscenter: boolean
    analytics: boolean
    support: 'none' | 'email' | 'priority'
  }
  trialDays?: number
  isActive?: boolean
}

export interface UpdatePlanData {
  name?: string
  displayName?: string
  description?: string
  price?: number
  currency?: string
  interval?: 'MONTH' | 'YEAR'
  billingPeriod?: number
  tokenQuota?: number
  features?: {
    siterank: boolean
    batchopen: boolean
    adscenter: boolean
    analytics: boolean
    support: 'none' | 'email' | 'priority'
  }
  trialDays?: number
  isActive?: boolean
}

export class PlanService {
  /**
   * Get all plans
   */
  static async getAllPlans(includeInactive: boolean = false): Promise<Plan[]> {
    const whereClause = includeInactive ? {} : { isActive: true }
    
    return await prisma.plan.findMany({
      where: whereClause,
      orderBy: [
        { price: 'asc' },
        { createdAt: 'asc' }
      ]
    })
  }

  /**
   * Get plan by ID
   */
  static async getPlanById(planId: string): Promise<Plan | null> {
    return await prisma.plan.findUnique({
      where: { id: planId }
    })
  }

  /**
   * Create new plan
   */
  static async createPlan(data: CreatePlanData, userId?: string): Promise<{ success: boolean; plan?: Plan; error?: string }> {
    try {
      // Validate plan data
      const validation = this.validatePlanData(data)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        }
      }

      const plan = await prisma.plan.create({
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          currency: data.currency,
          interval: data.interval as any,
          billingPeriod: String(data.billingPeriod),
          tokenQuota: data.tokenQuota,
          features: {
            ...data.features,
            displayName: data.displayName
          },
          isActive: data.isActive ?? true
        }
      })

      return {
        success: true,
        plan
      }
    } catch (error) {
      console.error('Error creating plan:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      }
    }
  }

  /**
   * Create new plan (legacy method for backward compatibility)
   */
  static async createPlanDirect(data: CreatePlanData): Promise<Plan> {
    return await prisma.plan.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        currency: data.currency,
          interval: data.interval as any,
        billingPeriod: String(data.billingPeriod),
        tokenQuota: data.tokenQuota,
        features: {
          ...data.features,
          displayName: data.displayName
        },
        isActive: data.isActive ?? true
      }
    })
  }

  /**
   * Update plan
   */
  static async updatePlan(planId: string, data: UpdatePlanData): Promise<Plan | null> {
    try {
      // Get current plan to merge features
      const currentPlan = await prisma.plan.findUnique({ where: { id: planId } })
      if (!currentPlan) return null

      const currentFeatures = currentPlan.features as any
      
      return await prisma.plan.update({
        where: { id: planId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description && { description: data.description }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.currency && { currency: data.currency }),
          ...(data.interval && { interval: data.interval as any }),
          ...(data.billingPeriod && { billingPeriod: String(data.billingPeriod) }),
          ...(data.tokenQuota !== undefined && { tokenQuota: data.tokenQuota }),
          ...(data.features && { 
            features: {
              ...currentFeatures,
              ...data.features,
              ...(data.displayName && { displayName: data.displayName })
            }
          }),
          ...(data.trialDays !== undefined && { trialDays: data.trialDays }),
          ...(data.isActive !== undefined && { isActive: data.isActive })
        }
      })
    } catch (error) {
      console.error('Error updating plan:', error)
      return null
    }
  }

  /**
   * Delete plan
   */
  static async deletePlan(planId: string): Promise<boolean> {
    try {
      await prisma.plan.delete({
        where: { id: planId }
      })
      return true
    } catch (error) {
      console.error('Error deleting plan:', error)
      return false
    }
  }

  /**
   * Check if plan has active subscriptions
   */
  static async hasActiveSubscriptions(planId: string): Promise<boolean> {
    const count = await prisma.subscription.count({
      where: {
        planId: planId,
        status: {
          in: ['ACTIVE', 'PENDING']
        }
      }
    })
    
    return count > 0
  }

  /**
   * Get plans by currency
   */
  static async getPlansByCurrency(currency: string, includeInactive: boolean = false): Promise<Plan[]> {
    const whereClause = {
      currency: currency,
      ...(includeInactive ? {} : { isActive: true })
    }
    
    return await prisma.plan.findMany({
      where: whereClause,
      orderBy: [
        { price: 'asc' },
        { createdAt: 'asc' }
      ]
    })
  }

  /**
   * Get plans by interval
   */
  static async getPlansByInterval(interval: 'MONTH' | 'YEAR', includeInactive: boolean = false): Promise<Plan[]> {
    const whereClause = {
      interval: interval as any,
      ...(includeInactive ? {} : { isActive: true })
    }
    
    return await prisma.plan.findMany({
      where: whereClause,
      orderBy: [
        { price: 'asc' },
        { createdAt: 'asc' }
      ]
    })
  }

  /**
   * Get free plans
   */
  static async getFreePlans(): Promise<Plan[]> {
    return await prisma.plan.findMany({
      where: {
        price: 0,
        isActive: true
      },
      orderBy: { createdAt: 'asc' }
    })
  }

  /**
   * Get popular plan
   */
  static async getPopularPlan(): Promise<Plan | null> {
    // For now, we'll consider the "pro" plan as popular
    // This could be enhanced with actual popularity metrics
    return await prisma.plan.findFirst({
      where: {
        name: {
          contains: 'pro',
          mode: 'insensitive'
        },
        isActive: true
      }
    })
  }

  /**
   * Search plans
   */
  static async searchPlans(query: string, includeInactive: boolean = false): Promise<Plan[]> {
    const whereClause = {
      OR: [
        {
          name: {
            contains: query,
            mode: 'insensitive' as const
          }
        },
        {
          displayName: {
            contains: query,
            mode: 'insensitive' as const
          }
        },
        {
          description: {
            contains: query,
            mode: 'insensitive' as const
          }
        }
      ],
      ...(includeInactive ? {} : { isActive: true })
    }
    
    return await prisma.plan.findMany({
      where: whereClause,
      orderBy: [
        { price: 'asc' },
        { createdAt: 'asc' }
      ]
    })
  }

  /**
   * Get plan statistics (alias for getPlanStatistics)
   */
  static async getPlanStats() {
    return await this.getPlanStatistics()
  }

  /**
   * Get plan statistics
   */
  static async getPlanStatistics() {
    const [
      totalPlans,
      activePlans,
      inactivePlans,
      plansByInterval,
      plansByPrice
    ] = await Promise.all([
      prisma.plan.count(),
      prisma.plan.count({ where: { isActive: true } }),
      prisma.plan.count({ where: { isActive: false } }),
      prisma.plan.groupBy({
        by: ['interval'],
        _count: { id: true },
        where: { isActive: true }
      }),
      prisma.plan.aggregate({
        _avg: { price: true },
        _min: { price: true },
        _max: { price: true },
        where: { isActive: true }
      })
    ])

    return {
      totalPlans,
      activePlans,
      inactivePlans,
      plansByInterval,
      averagePrice: plansByPrice._avg.price || 0,
      minPrice: plansByPrice._min.price || 0,
      maxPrice: plansByPrice._max.price || 0
    }
  }

  /**
   * Initialize default plans
   */
  static async initializeDefaultPlans(): Promise<{ success: boolean; message: string; plans?: Plan[] }> {
    try {
      // Check if plans already exist
      const existingPlans = await prisma.plan.count()
      if (existingPlans > 0) {
        return {
          success: false,
          message: 'Plans already exist. Use reset to reinitialize.'
        }
      }

      // Default plans configuration
      const defaultPlans: CreatePlanData[] = [
        {
          name: 'free',
          displayName: 'Free Plan',
          description: 'Basic features for getting started',
          price: 0,
          currency: 'USD',
          interval: 'MONTH',
          billingPeriod: 1,
          tokenQuota: 100,
          features: {
            siterank: true,
            batchopen: false,
            adscenter: false,
            analytics: false,
            support: 'none'
          },
          isActive: true
        },
        {
          name: 'pro',
          displayName: 'Pro Plan',
          description: 'Advanced features for professionals',
          price: 29.99,
          currency: 'USD',
          interval: 'MONTH',
          billingPeriod: 1,
          tokenQuota: 1000,
          features: {
            siterank: true,
            batchopen: true,
            adscenter: true,
            analytics: true,
            support: 'email'
          },
          isActive: true
        },
        {
          name: 'enterprise',
          displayName: 'Enterprise Plan',
          description: 'Full features for large organizations',
          price: 99.99,
          currency: 'USD',
          interval: 'MONTH',
          billingPeriod: 1,
          tokenQuota: 10000,
          features: {
            siterank: true,
            batchopen: true,
            adscenter: true,
            analytics: true,
            support: 'priority'
          },
          isActive: true
        }
      ]

      // Create plans
      const createdPlans: Plan[] = []
      for (const planData of defaultPlans) {
        const plan = await this.createPlanDirect(planData)
        createdPlans.push(plan)
      }

      return {
        success: true,
        message: `Successfully created ${createdPlans.length} default plans`,
        plans: createdPlans
      }
    } catch (error) {
      console.error('Error initializing default plans:', error)
      return {
        success: false,
        message: `Failed to initialize default plans: ${error instanceof Error ? error.message : "Unknown error" as any}`
      }
    }
  }

  /**
   * Validate plan data
   */
  static validatePlanData(data: CreatePlanData | UpdatePlanData): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if ('name' in data && data.name && data.name.length < 1) {
      errors.push('Plan name is required')
    }

    if ('price' in data && data.price !== undefined && data.price < 0) {
      errors.push('Plan price cannot be negative')
    }

    if ('currency' in data && data.currency && data.currency.length !== 3) {
      errors.push('Currency must be a 3-letter code')
    }

    if ('interval' in data && data.interval && !['MONTH', 'YEAR'].includes(data.interval)) {
      errors.push('Interval must be MONTH or YEAR')
    }

    if ('billingPeriod' in data && data.billingPeriod !== undefined && data.billingPeriod < 1) {
      errors.push('Billing period must be at least 1')
    }

    if ('tokenQuota' in data && data.tokenQuota !== undefined && data.tokenQuota < 0) {
      errors.push('Token quota cannot be negative')
    }

    if ('trialDays' in data && data.trialDays !== undefined && data.trialDays < 0) {
      errors.push('Trial days cannot be negative')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

export default PlanService
