import { prisma } from '@/lib/prisma';
import { UserQueryService } from './optimized/user-query-service';
import { TokenQueryService } from './optimized/token-query-service';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { QueryOptimizer, cachedQuery } from '@/lib/database/query-optimizer';

// Types for usage stats data structures
interface UsageLogGroupResult {
  feature: string;
  _sum: { usage: number | null };
  _count: number;
}

interface DailyUsageTrendItem {
  date: string;
  totalUsage: number;
  uniqueFeatures: number;
}

interface UserGrowthTrendItem {
  date: string;
  registrations: number;
  cumulative: number;
}

const logger = createLogger('UsageStatsService');

/**
 * 使用统计服务
 * 提供高性能的数据统计和报表功能
 */
export class UsageStatsService {
  /**
   * 获取用户使用统计（缓存版）
   */
  @cachedQuery({ ttl: 300000 }) // 5分钟缓存
  static async getUserUsageStats(userId: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [usageLogs, apiUsage, behaviorAnalytics] = await Promise.all([
        // 功能使用统计
        prisma.usageLog.groupBy({
          by: ['feature'],
          where: {
            userId,
            date: { gte: startDate }
          },
          _sum: { usage: true },
          _count: true,
          orderBy: { _sum: { usage: 'desc' } }
        }),
        // API使用统计
        prisma.apiUsage.groupBy({
          by: ['endpoint'],
          where: {
            userId,
            timestamp: { gte: startDate }
          },
          _sum: { tokenConsumed: true },
          _count: true,
          _avg: { responseTime: true }
        }),
        // 行为分析统计
        prisma.userBehaviorAnalytics.groupBy({
          by: ['feature', 'action'],
          where: {
            userId,
            createdAt: { gte: startDate }
          },
          _sum: { tokensConsumed: true },
          _count: true,
          _avg: { duration: true }
        })
      ]);

      // 计算每日使用趋势
      const dailyUsage = await this.getDailyUsageTrend(userId, days);

      return {
        period: { days, startDate, endDate: new Date() },
        features: usageLogs.map((log: UsageLogGroupResult: any) => ({
          feature: log.feature,
          totalUsage: log._sum.usage || 0,
          usageCount: log._count
        })),
        apiEndpoints: apiUsage.map(((api: any) => ({
          endpoint: api.endpoint,
          totalTokens: api._sum.tokenConsumed || 0,
          callCount: api._count,
          avgResponseTime: api._avg.responseTime || 0
        })),
        behaviors: behaviorAnalytics.map(((behavior: any) => ({
          feature: behavior.feature,
          action: behavior.action,
          totalTokens: behavior._sum.tokensConsumed || 0,
          actionCount: behavior._count,
          avgDuration: behavior._avg.duration || 0
        })),
        dailyUsage
      };
    } catch (error) {
      logger.error('获取用户使用统计失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取每日使用趋势
   */
  @cachedQuery({ ttl: 600000 }) // 10分钟缓存
  private static async getDailyUsageTrend(userId: string, days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 使用原始SQL获取每日统计（性能更好）
    const dailyStats = await prisma.$queryRaw`
      SELECT 
        DATE(date) as date,
        SUM(usage) as total_usage,
        COUNT(DISTINCT feature) as unique_features
      FROM usage_logs 
      WHERE 
        user_id = ${userId} 
        AND date >= ${startDate}
      GROUP BY DATE(date)
      ORDER BY date DESC
    ` as Array<{
      date: Date;
      total_usage: BigInt;
      unique_features: number;
    }>;

    // 填充缺失的日期
    const trend: DailyUsageTrendItem[] = [];
    const currentDate = new Date();
    
    for (let i = 0; i < days; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const stat = dailyStats.find((s: any) => 
        s.date.toISOString().split('T')[0] === dateStr
      );
      
      trend.push({
        date: dateStr,
        totalUsage: stat ? Number(stat.total_usage) : 0,
        uniqueFeatures: stat?.unique_features || 0
      });
      
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return trend.reverse();
  }

  /**
   * 获取系统总体统计（管理员用）
   */
  @cachedQuery({ ttl: 180000 }) // 3分钟缓存
  static async getSystemStats() {
    try {
      const [userStats, tokenStats, subscriptionStats, apiStats] = await Promise.all([
        // 用户统计
        prisma.user.aggregate({
          _count: { id: true },
          _sum: { 
            subscriptionTokenBalance: true,
            activityTokenBalance: true,
            purchasedTokenBalance: true
          },
          where: { status: 'ACTIVE' }
        }),
        // Token统计
        prisma.tokenTransaction.aggregate({
          _sum: { amount: true },
          _count: true,
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 最近30天
            }
          }
        }),
        // 订阅统计
        prisma.subscription.groupBy({
          by: ['status'],
          _count: true
        }),
        // API性能统计
        prisma.apiUsage.aggregate({
          _count: true,
          _avg: { responseTime: true },
          _sum: { tokenConsumed: true },
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
            }
          }
        })
      ]);

      // 获取活跃用户数（最近7天有登录）
      const activeUsersCount = await prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          },
          status: 'ACTIVE'
        }
      });

      // 获取今日注册用户数
      const todayRegistrations = await prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });

      return {
        users: {
          total: userStats._count.id,
          active: activeUsersCount,
          newToday: todayRegistrations,
          totalTokenBalance: Number((userStats._sum.subscriptionTokenBalance || 0) + 
                               (userStats._sum.activityTokenBalance || 0) + 
                               (userStats._sum.purchasedTokenBalance || 0))
        },
        tokens: {
          totalTransactions: tokenStats._count,
          totalVolume: Number(tokenStats._sum.amount || 0)
        },
        subscriptions: subscriptionStats.reduce((acc: any, stat: any: any) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>),
        api: {
          totalRequests: apiStats._count,
          avgResponseTime: Math.round(apiStats._avg.responseTime || 0),
          totalTokensConsumed: Number(apiStats._sum.tokenConsumed || 0)
        }
      };
    } catch (error) {
      logger.error('获取系统统计失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取功能使用排行
   */
  @cachedQuery({ ttl: 360000 }) // 6分钟缓存
  static async getFeatureRanking(limit: number = 10) {
    try {
      const rankings = await prisma.usageLog.groupBy({
        by: ['feature'],
        _sum: { usage: true },
        _count: true,
        orderBy: { _sum: { usage: 'desc' } },
        take: limit
      });

      return rankings.map((item: any, index: any: any) => ({
        rank: index + 1,
        feature: item.feature,
        totalUsage: Number(item._sum.usage || 0),
        usageCount: item._count
      }));
    } catch (error) {
      logger.error('获取功能排行失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取用户增长趋势
   */
  @cachedQuery({ ttl: 1800000 }) // 30分钟缓存
  static async getUserGrowthTrend(days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 使用SQL获取每日注册用户数
      const dailyRegistrations = await prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM users 
        WHERE 
          created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      ` as Array<{
        date: Date;
        count: number;
      }>;

      // 填充所有日期
      const trend: UserGrowthTrendItem[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= new Date()) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayData = dailyRegistrations.find((d: any) => 
          d.date.toISOString().split('T')[0] === dateStr
        );
        
        trend.push({
          date: dateStr,
          registrations: dayData?.count || 0,
          cumulative: trend.length > 0 
            ? trend[trend.length - 1].cumulative + (dayData?.count || 0)
            : (dayData?.count || 0)
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return trend;
    } catch (error) {
      logger.error('获取用户增长趋势失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取Token使用分布
   */
  @cachedQuery({ ttl: 300000 }) // 5分钟缓存
  static async getTokenUsageDistribution() {
    try {
      const [byType, byPlan, byFeature] = await Promise.all([
        // 按Token类型统计
        prisma.tokenTransaction.groupBy({
          by: ['type'],
          _sum: { amount: true },
          _count: true,
          where: {
            amount: { gt: 0 }, // 只统计收入
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        // 按套餐统计
        prisma.$queryRaw`
          SELECT 
            p.name as plan_name,
            SUM(u.usage) as total_usage,
            COUNT(DISTINCT u.user_id) as unique_users
          FROM usage_logs u
          JOIN subscriptions s ON u.user_id = s.user_id 
            AND s.status = 'ACTIVE'
            AND s.current_period_end >= NOW()
          JOIN plans p ON s.plan_id = p.id
          WHERE u.date >= NOW() - INTERVAL '30 days'
          GROUP BY p.name
          ORDER BY total_usage DESC
        ` as Array<{
          plan_name: string;
          total_usage: BigInt;
          unique_users: number;
        }>,
        // 按功能统计
        prisma.usageLog.groupBy({
          by: ['feature'],
          _sum: { usage: true },
          _count: { distinct: ['userId'] },
          where: {
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      return {
        byType: byType.map(((t: any) => ({
          type: t.type,
          totalAmount: Number(t._sum.amount || 0),
          count: t._count
        })),
        byPlan: byPlan.map((p: any) => ({
          plan: p.plan_name,
          totalUsage: Number(p.total_usage),
          uniqueUsers: p.unique_users
        })),
        byFeature: byFeature.map(((f: any) => ({
          feature: f.feature,
          totalUsage: Number(f._sum.usage || 0),
          uniqueUsers: f._count.userId
        }))
      };
    } catch (error) {
      logger.error('获取Token使用分布失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取性能指标
   */
  static async getPerformanceMetrics() {
    try {
      const [apiPerformance, dbPerformance, cacheStats] = await Promise.all([
        // API性能统计
        prisma.apiPerformanceLog.aggregate({
          _count: true,
          _avg: { responseTime: true },
          _max: { responseTime: true },
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }),
        // 数据库查询统计（从优化器获取）
        QueryOptimizer.getQueryStats(),
        // 缓存统计
        this.getCacheStats()
      ]);

      return {
        api: {
          totalRequests: apiPerformance._count,
          avgResponseTime: Math.round(apiPerformance._avg.responseTime || 0),
          maxResponseTime: apiPerformance._max.responseTime || 0
        },
        database: {
          totalQueries: dbPerformance.length,
          slowQueries: dbPerformance.filter((q: any) => q.avgTime > 1000).length,
          avgQueryTime: dbPerformance.reduce((sum, q: any) => sum + q.avgTime, 0) / dbPerformance.length || 0
        },
        cache: cacheStats
      };
    } catch (error) {
      logger.error('获取性能指标失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取缓存统计
   */
  private static async getCacheStats() {
    // 这里应该从实际的缓存服务获取统计
    return {
      hitRate: 0.85, // 示例值
      totalSize: 1000,
      memoryUsage: '50MB'
    };
  }

  /**
   * 清除相关缓存
   */
  static invalidateCache(userId?: string) {
    if (userId) {
      // 清除特定用户的缓存
      // 实际实现应根据缓存键的规则
    } else {
      // 清除所有统计缓存
      // 实际实现应调用缓存服务的清除方法
    }
  }
}