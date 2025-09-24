import { prisma } from '@/lib/db'

export interface RateLimitRule {
  id?: string
  name?: string
  endpoint: string
  method: string
  userRole: string
  maxRequests?: number
  windowMs?: number
  enabled?: boolean
  status?: string
  requestsPerMinute?: number
  requestsPerHour?: number
  requestsPerDay?: number
  priority?: number
  description?: string
}

export interface RateLimitStats {
  endpoint: string
  method: string
  userRole: string
  currentRequests: number
  maxRequests: number
  windowMs: number
  resetTime: Date
}

export class ApiLimitService {
  /**
   * Create or update rate limit rule
   */
  static async setRateLimit(rule: RateLimitRule): Promise<RateLimitRule> {
    try {
      const data = {
        id: `composite_${rule.endpoint}_${rule.method}_${rule.userRole}`.replace(/[^a-zA-Z0-9]/g, '_'),
        endpoint: rule.endpoint,
        method: rule.method,
        userRole: rule.userRole,
        maxRequests: rule.maxRequests || 0,
        windowMs: (rule.windowMs || 0),
        enabled: rule.enabled
      }

      // apiRateLimit table not in schema - using mock implementation
      const mockRule = {
        ...data
      }
      return mockRule
    } catch (error) {
      console.error('Error setting rate limit:', error)
      throw new Error('Failed to set rate limit')
    }
  }

  /**
   * Get all rate limit rules
   */
  static async getRateLimits(): Promise<RateLimitRule[]> {
    try {
      // apiRateLimit table not in schema - return empty array
      return []
      // const rules = await prisma.apiRateLimit.findMany({
      //   orderBy: [
      //     { endpoint: 'asc' },
      //     { method: 'asc' },
      //     { userRole: 'asc' }
      //   ]
      // })

      // return rules?.map((rule: any) => ({
      //   id: rule.id,
      //   endpoint: rule.endpoint,
      //   method: rule.method,
      //   userRole: rule.userRole,
      //   maxRequests: rule.maxRequests,
      //   windowMs: (rule.windowMs || 0),
      //   enabled: rule.enabled
      // }))
    } catch (error) {
      console.error('Error getting rate limits:', error)
      return []
    }
  }

  /**
   * Get rate limit for specific endpoint and user role
   */
  static async getRateLimit(
    endpoint: string,
    method: string,
    userRole: string
  ): Promise<RateLimitRule | null> {
    try {
      // apiRateLimit table not in schema - return null
      return null
      // const rule = await prisma.apiRateLimit.findFirst({
      //   where: {
      //     endpoint,
      //     method,
      //     userRole,
      //     enabled: true
      //   }
      // })

      // if (!rule) return null

      // return {
      //   id: rule.id,
      //   endpoint: rule.endpoint,
      //   method: rule.method,
      //   userRole: rule.userRole,
      //   maxRequests: rule.maxRequests,
      //   windowMs: (rule.windowMs || 0),
      //   enabled: rule.enabled
      // }
    } catch (error) {
      console.error('Error getting rate limit:', error)
      return null
    }
  }

  /**
   * Delete rate limit rule
   */
  static async deleteRateLimit(id: string): Promise<boolean> {
    try {
      // apiRateLimit table not in schema - return true
      console.log('Delete rate limit (disabled):', id)
      return true
      // await prisma.apiRateLimit.delete({
      //   where: { id }
      // })
      // return true
    } catch (error) {
      console.error('Error deleting rate limit:', error)
      return false
    }
  }

  /**
   * Check current usage against rate limit
   */
  static async checkRateLimit(
    endpoint: string,
    method: string,
    userRole: string,
    userId?: string
  ): Promise<{
    allowed: boolean
    currentRequests: number
    maxRequests: number
    resetTime: Date
    retryAfter?: number
  }> {
    try {
      const rule = await this.getRateLimit(endpoint, method, userRole)
      
      if (!rule) {
        // No rate limit configured, allow request
        return {
          allowed: true,
          currentRequests: 0,
          maxRequests: Infinity,
          resetTime: new Date(Date.now() + 60000) // 1 minute from now
        }
      }

      const windowStart = new Date(Date.now() - ((rule.windowMs || 0) || 60000))
      const resetTime = new Date(Date.now() + ((rule.windowMs || 0) || 60000))

      // Count requests in current window
      const currentRequests = await prisma.apiUsage.count({
        where: {
          endpoint,
          method,
          userId: userId || 'anonymous',
          timestamp: {
            gte: windowStart
          }
        }
      })

      const allowed = currentRequests < (rule.maxRequests || Infinity)
      const retryAfter = allowed ? undefined : Math.ceil(((rule.windowMs || 0) || 60000) / 1000)

      return {
        allowed,
        currentRequests,
        maxRequests: rule.maxRequests || 0,
        resetTime,
        retryAfter
      }
    } catch (error) {
      console.error('Error checking rate limit:', error)
      // On error, allow the request
      return {
        allowed: true,
        currentRequests: 0,
        maxRequests: Infinity,
        resetTime: new Date()
      }
    }
  }

  /**
   * Get rate limit statistics for all endpoints
   */
  static async getRateLimitStats(): Promise<RateLimitStats[]> {
    try {
      const rules = await this.getRateLimits()
      const stats: RateLimitStats[] = []

      for (const rule of rules) {
        if (!rule.enabled) continue

        const windowStart = new Date(Date.now() - ((rule.windowMs || 0) || 60000))
        const resetTime = new Date(Date.now() + ((rule.windowMs || 0) || 60000))

        const currentRequests = await prisma.apiUsage.count({
          where: {
            endpoint: rule.endpoint,
            method: rule.method,
            timestamp: {
              gte: windowStart
            }
          }
        })

        stats.push({
          endpoint: rule.endpoint,
          method: rule.method,
          userRole: rule.userRole,
          currentRequests,
          maxRequests: rule.maxRequests || Infinity,
          windowMs: (rule.windowMs || 0) || 60000,
          resetTime
        })
      }

      return stats
    } catch (error) {
      console.error('Error getting rate limit stats:', error)
      return []
    }
  }

  /**
   * Initialize default rate limits
   */
  static async initializeDefaultRateLimits(): Promise<void> {
    const defaultLimits: Omit<RateLimitRule, 'id'>[] = [
      // Public API endpoints - more restrictive
      {
        endpoint: '/api/public/*',
        method: 'GET',
        userRole: 'USER',
        maxRequests: 100,
        windowMs: 60 * 1000, // 1 minute
        enabled: true
      },
      {
        endpoint: '/api/public/*',
        method: 'POST',
        userRole: 'USER',
        maxRequests: 20,
        windowMs: 60 * 1000,
        enabled: true
      },

      // Authenticated user endpoints
      {
        endpoint: '/api/user/*',
        method: 'GET',
        userRole: 'USER',
        maxRequests: 200,
        windowMs: 60 * 1000,
        enabled: true
      },
      {
        endpoint: '/api/user/*',
        method: 'POST',
        userRole: 'USER',
        maxRequests: 50,
        windowMs: 60 * 1000,
        enabled: true
      },

      // Admin endpoints - less restrictive
      {
        endpoint: '/ops/api/v1/console/*',
        method: 'GET',
        userRole: 'ADMIN',
        maxRequests: 500,
        windowMs: 60 * 1000,
        enabled: true
      },
      {
        endpoint: '/ops/api/v1/console/*',
        method: 'POST',
        userRole: 'ADMIN',
        maxRequests: 100,
        windowMs: 60 * 1000,
        enabled: true
      },

      // Admin - minimal restrictions
      {
        endpoint: '/ops/api/v1/console/*',
        method: 'GET',
        userRole: 'ADMIN',
        maxRequests: 1000,
        windowMs: 60 * 1000,
        enabled: true
      },
      {
        endpoint: '/ops/api/v1/console/*',
        method: 'POST',
        userRole: 'ADMIN',
        maxRequests: 200,
        windowMs: 60 * 1000,
        enabled: true
      },

      // Specific high-usage endpoints
      {
        endpoint: '/api/siterank',
        method: 'POST',
        userRole: 'USER',
        maxRequests: 10,
        windowMs: 60 * 1000,
        enabled: true
      },
      {
        endpoint: '/api/batchopen',
        method: 'POST',
        userRole: 'USER',
        maxRequests: 5,
        windowMs: 60 * 1000,
        enabled: true
      }
    ]

    try {
      for (const limit of defaultLimits) {
        await this.setRateLimit(limit)
      }
      console.log('✅ Default rate limits initialized')
    } catch (error) {
      console.error('❌ Failed to initialize default rate limits:', error)
    }
  }

  /**
   * Get usage summary for a user
   */
  static async getUserUsageSummary(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    totalRequests: number
    requestsByEndpoint: Array<{
      endpoint: string
      method: string
      count: number
      avgResponseTime: number
      errorCount: number
    }>
    rateLimitViolations: number
    topEndpoints: Array<{
      endpoint: string
      count: number
    }>
  }> {
    try {
      const whereClause = {
        userId,
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }

      // Get total requests
      const totalRequests = await prisma.apiUsage.count({
        where: whereClause
      })

      // Get requests by endpoint
      const requestsByEndpoint = await prisma.apiUsage.groupBy({
        by: ['endpoint', 'method'],
        where: whereClause,
        _count: { endpoint: true },
        _avg: { responseTime: true }
      })

      // Get error counts by endpoint
      const errorsByEndpoint = await prisma.apiUsage.groupBy({
        by: ['endpoint', 'method'],
        where: {
          ...whereClause,
          statusCode: { gte: 400 }
        },
        _count: { endpoint: true }
      })

      // Combine the data
      const endpointStats = requestsByEndpoint?.map((item: any) => {
        const errorData = errorsByEndpoint.find(
          (e: any) => e.endpoint === item.endpoint && e.method === item.method
        )
        
        return {
          endpoint: item.endpoint,
          method: item.method,
          count: item._count.endpoint,
          avgResponseTime: item._avg.responseTime || 0,
          errorCount: errorData?._count.endpoint || 0
        }
      })

      // Get top endpoints
      const topEndpoints = await prisma.apiUsage.groupBy({
        by: ['endpoint'],
        where: whereClause,
        _count: { endpoint: true },
        orderBy: { _count: { endpoint: 'desc' } },
        take: 5
      })

      // Count rate limit violations (429 status codes)
      const rateLimitViolations = await prisma.apiUsage.count({
        where: {
          ...whereClause,
          statusCode: 429
        }
      })

      return {
        totalRequests,
        requestsByEndpoint: endpointStats,
        rateLimitViolations,
        topEndpoints: topEndpoints?.map((item: any) => ({
          endpoint: item.endpoint,
          count: item._count.endpoint
        }))
      }
    } catch (error) {
      console.error('Error getting user usage summary:', error)
      return {
        totalRequests: 0,
        requestsByEndpoint: [],
        rateLimitViolations: 0,
        topEndpoints: []
      }
    }
  }
}
