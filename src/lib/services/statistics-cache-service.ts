import { prisma } from '@/lib/db';

/**
 * Statistics cache service for optimized user activity queries
 */
export class StatisticsCacheService {
  private static instance: StatisticsCacheService;
  private cache = new Map<string, any>();
  private cacheExpiry = new Map<string, number>();
  
  // Cache TTL in milliseconds
  private readonly CACHE_TTL = {
    coreMetrics: 5 * 60 * 1000,      // 5 minutes
    userActivity: 10 * 60 * 1000,    // 10 minutes
    featureStats: 15 * 60 * 1000,    // 15 minutes
    historicalData: 60 * 60 * 1000   // 1 hour
  };

  static getInstance(): StatisticsCacheService {
    if (!StatisticsCacheService.instance) {
      StatisticsCacheService.instance = new StatisticsCacheService();
    }
    return StatisticsCacheService.instance;
  }

  /**
   * Get cached data or fetch from database
   */
  async getCachedData<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl: number = this.CACHE_TTL.coreMetrics
  ): Promise<T> {
    const now = Date.now();
    const expiry = this.cacheExpiry.get(key);
    
    // Return cached data if still valid
    if (expiry && now < expiry && this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Fetch fresh data
    const data = await fetcher();
    
    // Cache the data
    this.cache.set(key, data);
    this.cacheExpiry.set(key, now + ttl);
    
    return data;
  }

  /**
   * Get core metrics with caching
   */
  async getCoreMetrics(timeRange: string) {
    const cacheKey = `coreMetrics:${timeRange}`;
    
    return this.getCachedData(
      cacheKey,
      async () => {
        const startDate = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const [totalUsers, activeUsers, totalTokens, totalActivities] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { status: 'ACTIVE' } }),
          prisma.tokenTransaction.aggregate({
            where: {
              type: 'DEBIT',
              createdAt: { gte: startDate, lte: endDate }
            },
            _sum: { amount: true }
          }),
          prisma.userBehaviorAnalytics.count({
            where: { createdAt: { gte: startDate, lte: endDate } }
          })
        ]);

        return {
          totalUsers,
          activeUsers,
          totalTokensConsumed: Math.abs(totalTokens._sum.amount || 0),
          totalActivities,
          averageTokensPerUser: totalUsers > 0 ? Math.abs(totalTokens._sum.amount || 0) / totalUsers : 0
        };
      },
      this.CACHE_TTL.coreMetrics
    );
  }

  /**
   * Get simplified usage statistics
   */
  async getUsageStatistics(filters: any) {
    const cacheKey = `usageStats:${JSON.stringify(filters)}`;
    
    return this.getCachedData(
      cacheKey,
      async () => {
        const startDate = new Date(filters.startDate);
        const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

        // Get overall trends using Token transactions (more accurate)
        const overallTrends = await prisma.$queryRaw`
          SELECT 
            DATE_TRUNC(${filters.groupBy || 'day'}, "createdAt") as period,
            COUNT(*) as "usageCount",
            COUNT(DISTINCT "userId") as "uniqueUsers",
            ABS(SUM("amount")) as "totalTokens"
          FROM "TokenTransaction"
          WHERE "type" = 'DEBIT' 
            AND "createdAt" >= ${startDate} 
            AND "createdAt" <= ${endDate}
            ${filters.features?.length > 0 ? `AND "metadata"->>'feature' = ANY(${filters.features}::text[])` : ''}
          GROUP BY DATE_TRUNC(${filters.groupBy || 'day'}, "createdAt")
          ORDER BY period ASC
        `;

        // Get feature popularity from Token transactions
        const featurePopularity = await prisma.tokenTransaction.groupBy({
          by: ['metadata'],
          where: {
            type: 'DEBIT',
            createdAt: { gte: startDate, lte: endDate },
            metadata: {
              path: ['feature'],
              not: undefined
            }
          },
          _count: { id: true },
          _sum: { amount: true },
          orderBy: { _count: { id: 'desc' } }
        });

        // Get top users by Token consumption
        const topUsers = await prisma.tokenTransaction.groupBy({
          by: ['userId'],
          where: {
            type: 'DEBIT',
            createdAt: { gte: startDate, lte: endDate }
          },
          _count: { id: true },
          _sum: { amount: true },
          orderBy: { _sum: { amount: 'asc' } }, // Most negative (highest consumption)
          take: 10
        });

        // Get user details for top users
        const topUsersWithDetails = await Promise.all(
          topUsers.map(async (user) => {
            const userDetails = await prisma.user.findUnique({
              where: { id: user.userId },
              select: { name: true, email: true }
            });
            return {
              name: userDetails?.name || userDetails?.email || 'Unknown User',
              totalTokens: Math.abs(user._sum.amount || 0),
              totalTransactions: user._count.id
            };
          })
        );

        return {
          overallTrends: overallTrends as any[],
          featurePopularity: featurePopularity.map(fp => ({
            feature: (fp.metadata as any)?.feature || 'unknown',
            _count: { id: fp._count?.id || 0 },
            totalTokens: Math.abs(fp._sum?.amount || 0)
          })),
          topUsers: topUsersWithDetails
        };
      },
      this.CACHE_TTL.userActivity
    );
  }

  /**
   * Get simplified behavior analytics
   */
  async getBehaviorAnalytics(filters: any) {
    const cacheKey = `behaviorStats:${JSON.stringify(filters)}`;
    
    return this.getCachedData(
      cacheKey,
      async () => {
        const startDate = new Date(filters.startDate);
        const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

        // Simplified hourly activity pattern
        const hourlyActivity = await prisma.$queryRaw`
          SELECT 
            EXTRACT(HOUR FROM "createdAt") as hour,
            COUNT(*) as "activityCount"
          FROM "TokenTransaction"
          WHERE "type" = 'DEBIT' 
            AND "createdAt" >= ${startDate} 
            AND "createdAt" <= ${endDate}
          GROUP BY EXTRACT(HOUR FROM "createdAt")
          ORDER BY hour ASC
        `;

        // Simplified user engagement segments
        const userSegments = await prisma.$queryRaw`
          WITH user_activity AS (
            SELECT 
              "userId",
              COUNT(*) as activity_count,
              ABS(SUM("amount")) as total_tokens
            FROM "TokenTransaction"
            WHERE "type" = 'DEBIT' 
              AND "createdAt" >= ${startDate} 
              AND "createdAt" <= ${endDate}
            GROUP BY "userId"
          )
          SELECT 
            CASE 
              WHEN activity_count >= 20 THEN 'Active'
              WHEN activity_count >= 1 THEN 'Casual'
              ELSE 'Inactive'
            END as "engagementLevel",
            COUNT(*) as "userCount",
            ROUND(AVG(activity_count), 2) as "avgActivity",
            ROUND(AVG(total_tokens), 2) as "avgTokens"
          FROM user_activity
          GROUP BY 
            CASE 
              WHEN activity_count >= 20 THEN 'Active'
              WHEN activity_count >= 1 THEN 'Casual'
              ELSE 'Inactive'
            END
          ORDER BY "userCount" DESC
        `;

        // Feature engagement from Token transactions
        const featureEngagement = await prisma.tokenTransaction.groupBy({
          by: ['metadata'],
          where: {
            type: 'DEBIT',
            createdAt: { gte: startDate, lte: endDate },
            metadata: {
              path: ['feature'],
              not: undefined
            }
          },
          _count: { id: true },
          _avg: { amount: true },
          _sum: { amount: true }
        });

        return {
          activityPatterns: {
            hourlyActivity: hourlyActivity as any[]
          },
          behaviorSegments: {
            userSegments: userSegments as any[]
          },
          featureEngagement: {
            featureStats: featureEngagement.map(fe => ({
              feature: (fe.metadata as any)?.feature || 'unknown',
              totalUsage: fe._count?.id || 0,
              avgTokensPerUse: Math.round(Math.abs(fe._avg?.amount || 0)),
              totalTokens: Math.abs(fe._sum?.amount || 0)
            }))
          }
        };
      },
      this.CACHE_TTL.userActivity
    );
  }

  /**
   * Invalidate cache for specific keys or patterns
   */
  invalidateCache(pattern?: string) {
    if (!pattern) {
      // Clear all cache
      this.cache.clear();
      this.cacheExpiry.clear();
      return;
    }
    
    // Clear cache entries matching pattern
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now >= expiry) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }
}

// Export singleton instance
export const statisticsCacheService = StatisticsCacheService.getInstance();