import { prisma } from '@/lib/prisma'
import redis from '@/lib/redis'
import { z } from 'zod'

// Token configuration schema
const TokenConfigSchema = z.object({
  siterank: z.object({
    costPerDomain: z.number().min(0),
    batchMultiplier: z.number().min(0).max(1).default(1),
    description: z.string().optional()
  }),
  batchopen: z.object({
    costPerUrl: z.number().min(0),
    batchMultiplier: z.number().min(0).max(1).default(1),
    description: z.string().optional()
  }),
  adscenter: z.object({
    costPerLinkChange: z.number().min(0),
    batchMultiplier: z.number().min(0).max(1).default(1),
    description: z.string().optional()
  })
})

export type TokenConfig = z.infer<typeof TokenConfigSchema>

export interface TokenUsageRecord {
  id: string
  userId: string
  feature: 'siterank' | 'batchopen' | 'adscenter'
  operation: string
  tokensConsumed: number
  itemCount: number
  isBatch: boolean
  batchId?: string
  metadata?: any
  createdAt: Date
}

export interface TokenAnalytics {
  totalConsumed: number
  byFeature: Record<string, number>
  byPeriod: Record<string, number>
  averageDaily: number
  projectedMonthly: number
  efficiency: number
}

export class TokenConfigService {
  private static readonly CACHE_KEY = 'token:config'
  private static readonly CACHE_TTL = 300 // 5 minutes

  /**
   * Get current token configuration
   */
  async getTokenConfig(): Promise<TokenConfig> {
    // Try cache first
    const cached = await redis.get(TokenConfigService.CACHE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }

    // Get from database
    const configs = await prisma.configuration_items.findMany({
      where: {
        key: {
          in: [
            'token.siterank.costPerDomain',
            'token.siterank.batchMultiplier',
            'token.batchopen.costPerUrl', 
            'token.batchopen.batchMultiplier',
            'token.adscenter.costPerLinkChange',
            'token.adscenter.batchMultiplier'
          ]
        }
      }
    })

    // Build config object with defaults
    const config: TokenConfig = {
      siterank: {
        costPerDomain: 1,
        batchMultiplier: 1,
        description: 'Cost per domain ranking analysis'
      },
      batchopen: {
        costPerUrl: 1,
        batchMultiplier: 1,
        description: 'Cost per URL in batch opening'
      },
      adscenter: {
        costPerLinkChange: 2,
        batchMultiplier: 1,
        description: 'Cost per link change operation'
      }
    }

    // Apply database values
    configs.forEach((item: any: any) => {
      const [, feature, setting] = item.key.split('.')
      if (feature && setting && config[feature as keyof TokenConfig]) {
        const value = item.type === 'number' ? parseFloat(item.value) : item.value
        ;(config[feature as keyof TokenConfig] as any)[setting] = value
      }
    })

    // Cache the result
    await redis.setex(
      TokenConfigService.CACHE_KEY,
      TokenConfigService.CACHE_TTL,
      JSON.stringify(config)
    )

    return config
  }

  /**
   * Update token configuration
   */
  async updateTokenConfig(
    config: Partial<TokenConfig>,
    updatedBy: string,
    reason?: string
  ): Promise<TokenConfig> {
    const currentConfig = await this.getTokenConfig()
    const newConfig = { ...currentConfig, ...config }

    // Validate the new configuration
    const validated = TokenConfigSchema.parse(newConfig)

    // Update database
    const updates: Array<{
      key: string;
      value: string;
      type: string;
    }> = []
    
    if (config.siterank) {
      if (config.siterank.costPerDomain !== undefined) {
        updates.push({
          key: 'token.siterank.costPerDomain',
          value: config.siterank.costPerDomain.toString(),
          type: 'number'
        })
      }
      if (config.siterank.batchMultiplier !== undefined) {
        updates.push({
          key: 'token.siterank.batchMultiplier',
          value: config.siterank.batchMultiplier.toString(),
          type: 'number'
        })
      }
    }

    if (config.batchopen) {
      if (config.batchopen.costPerUrl !== undefined) {
        updates.push({
          key: 'token.batchopen.costPerUrl',
          value: config.batchopen.costPerUrl.toString(),
          type: 'number'
        })
      }
      if (config.batchopen.batchMultiplier !== undefined) {
        updates.push({
          key: 'token.batchopen.batchMultiplier',
          value: config.batchopen.batchMultiplier.toString(),
          type: 'number'
        })
      }
    }

    if (config.adscenter) {
      if (config.adscenter.costPerLinkChange !== undefined) {
        updates.push({
          key: 'token.adscenter.costPerLinkChange',
          value: config.adscenter.costPerLinkChange.toString(),
          type: 'number'
        })
      }
      if (config.adscenter.batchMultiplier !== undefined) {
        updates.push({
          key: 'token.adscenter.batchMultiplier',
          value: config.adscenter.batchMultiplier.toString(),
          type: 'number'
        })
      }
    }

    // Perform database updates
    for (const update of updates) {
      await prisma.configuration_items.upsert({
        where: { key: update.key },
        create: {
          key: update.key,
          value: update.value,
          type: update.type,
          category: 'token',
          description: `Token configuration for ${update.key}`,
          updatedBy
        },
        update: {
          value: update.value,
          updatedBy
        }
      })

      // Record change history
      await prisma.configurationHistory.create({
        data: {
          configKey: update.key,
          newValue: update.value,
          changedBy: updatedBy,
          reason: reason || 'Token configuration update'
        }
      })
    }

    // Clear cache
    await redis.del(TokenConfigService.CACHE_KEY)

    return validated
  }

  /**
   * Calculate token cost for an operation
   */
  async calculateTokenCost(
    feature: 'siterank' | 'batchopen' | 'adscenter',
    itemCount: number,
    isBatch: boolean = false
  ): Promise<number> {
    const config = await this.getTokenConfig()
    const featureConfig = config[feature]

    let baseCost: number
    switch (feature) {
      case 'siterank':
        baseCost = (featureConfig as any).costPerDomain * itemCount
        break
      case 'batchopen':
        baseCost = (featureConfig as any).costPerUrl * itemCount
        break
      case 'adscenter':
        baseCost = (featureConfig as any).costPerLinkChange * itemCount
        break
      default:
        throw new Error(`Unknown feature: ${feature}`)
    }

    // Apply batch multiplier if it's a batch operation
    if (isBatch && featureConfig.batchMultiplier < 1) {
      baseCost = Math.ceil(baseCost * featureConfig.batchMultiplier)
    }

    return Math.max(1, baseCost) // Minimum 1 token
  }

  /**
   * Record token usage
   */
  async recordTokenUsage(
    userId: string,
    feature: 'siterank' | 'batchopen' | 'adscenter',
    operation: string,
    itemCount: number,
    tokensConsumed: number,
    isBatch: boolean = false,
    batchId?: string,
    metadata?: any
  ): Promise<void> {
    // Record in token usage table
    await prisma.token_usage.create({
      data: {
        userId,
        feature,
        operation,
        tokensConsumed,
        itemCount,
        isBatch,
        batchId,
        metadata
      }
    })

    // Update user token balance
    await prisma.user.update({
      where: { id: userId },
      data: {
        tokenBalance: {
          decrement: tokensConsumed
        }
      }
    })

    // Clear user analytics cache
    await redis.del(`token:analytics:${userId}`)
  }

  /**
   * Get token usage analytics for a user
   */
  async getTokenAnalytics(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TokenAnalytics> {
    const cacheKey = `token:analytics:${userId}:${startDate?.getTime() || 'all'}:${endDate?.getTime() || 'all'}`
    
    // Try cache first
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const whereClause: any = { userId }
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) whereClause.createdAt.gte = startDate
      if (endDate) whereClause.createdAt.lte = endDate
    }

    const usageRecords = await prisma.token_usage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    })

    const totalConsumed = usageRecords.reduce((sum: number, record: any: any) => sum + record.tokensConsumed, 0)
    
    const byFeature = usageRecords.reduce((acc: Record<string, number>, record: any: any) => {
      acc[record.feature] = (acc[record.feature] || 0) + record.tokensConsumed
      return acc
    }, {} as Record<string, number>)

    // Group by day for period analysis
    const byPeriod = usageRecords.reduce((acc: Record<string, number>, record: any: any) => {
      const date = record.createdAt.toISOString().split('T')[0]
      acc[date] = (acc[date] || 0) + record.tokensConsumed
      return acc
    }, {} as Record<string, number>)

    const days = Object.keys(byPeriod).length || 1
    const averageDaily = totalConsumed / days
    const projectedMonthly = averageDaily * 30

    // Calculate efficiency (tokens per item)
    const totalItems = usageRecords.reduce((sum: number, record: any: any) => sum + record.itemCount, 0)
    const efficiency = totalItems > 0 ? totalConsumed / totalItems : 0

    const analytics: TokenAnalytics = {
      totalConsumed,
      byFeature,
      byPeriod,
      averageDaily,
      projectedMonthly,
      efficiency
    }

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(analytics))

    return analytics
  }

  /**
   * Get token usage forecast
   */
  async getTokenForecast(userId: string, days: number = 30): Promise<{
    projectedUsage: number
    confidence: number
    breakdown: Record<string, number>
  }> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const analytics = await this.getTokenAnalytics(userId, thirtyDaysAgo)
    
    const projectedUsage = analytics.averageDaily * days
    
    // Simple confidence calculation based on data consistency
    const dailyValues = Object.values(analytics.byPeriod)
    const mean = dailyValues.reduce((sum, val: any) => sum + val, 0) / dailyValues.length
    const variance = dailyValues.reduce((sum, val: any) => sum + Math.pow(val - mean, 2), 0) / dailyValues.length
    const confidence = Math.max(0.1, Math.min(0.9, 1 - (variance / (mean * mean))))

    const breakdown = Object.entries(analytics.byFeature).reduce((acc, [feature, usage]: any) => {
      const ratio = usage / analytics.totalConsumed
      acc[feature] = projectedUsage * ratio
      return acc
    }, {} as Record<string, number>)

    return {
      projectedUsage,
      confidence,
      breakdown
    }
  }
}

export const tokenConfigService = new TokenConfigService()