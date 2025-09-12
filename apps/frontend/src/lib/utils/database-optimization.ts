/**
 * Database Query Optimization Utilities
 * Provides optimized query patterns and caching for database operations
 */

import { prisma } from '@/lib/db';
import { queryCache, measurePerformance, requestDeduplicator } from '@/lib/utils/performance';

/**
 * Optimized query builder with caching
 */
export class OptimizedQueryBuilder {
  private cacheKey: string;
  private ttl: number;
  
  constructor(cacheKey: string, ttl: number = 5 * 60 * 1000) {
    this.cacheKey = cacheKey;
    this.ttl = ttl;
  }
  
  /**
   * Execute query with caching
   */
  async execute<T>(
    queryFn: () => Promise<T>,
    options: {
      useCache?: boolean;
      cacheKey?: string;
      ttl?: number;
    } = {}
  ): Promise<T> {
    const { useCache = true, cacheKey, ttl } = options;
    
    const finalCacheKey = cacheKey || this.cacheKey;
    
    if (useCache) {
      const cached = queryCache.get(finalCacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const result = await queryFn();
    
    if (useCache) {
      queryCache.set(finalCacheKey, result, ttl || this.ttl);
    }
    
    return result;
  }
}

/**
 * Batch operations utility
 */
export class BatchOperations {
  /**
   * Bulk update with chunking to prevent transaction timeouts
   */
  static async bulkUpdate<T>(
    model: any,
    updates: Array<{ where: any; data: any }>,
    options: {
      chunkSize?: number;
      delay?: number;
    } = {}
  ): Promise<void> {
    const { chunkSize = 100, delay = 10 } = options;
    
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      
      const promises = chunk.map(({ where, data }) => 
        model.update({ where, data })
      );
      
      await Promise.all(promises);
      
      // Small delay between chunks to prevent database overload
      if (i + chunkSize < updates.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  /**
   * Bulk create with chunking
   */
  static async bulkCreate<T>(
    model: any,
    data: any[],
    options: {
      chunkSize?: number;
      delay?: number;
      skipDuplicates?: boolean;
    } = {}
  ): Promise<T[]> {
    const { chunkSize = 100, delay = 10, skipDuplicates = false } = options;
    const results: T[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      try {
        if (skipDuplicates) {
          // Create one by one to skip duplicates
          for (const item of chunk) {
            try {
              const result = await model.create({ data: item });
              results.push(result);
            } catch (error: any) {
              if (error.code !== 'P2002') { // Not a unique constraint error
                throw error;
              }
            }
          }
        } else {
          const chunkResults = await model.createMany({
            data: chunk,
            skipDuplicates: true
          });
          
          // For createMany, we don't get the created objects back
          // So we'll need to fetch them if needed
          results.push(...chunkResults);
        }
      } catch (error) {
        console.error('Bulk create chunk failed:', error);
        throw error;
      }
      
      // Small delay between chunks
      if (i + chunkSize < data.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return results;
  }
}

/**
 * Pagination helper with optimized queries
 */
export class OptimizedPagination {
  /**
   * Paginated query with cursor-based pagination for better performance
   */
  static async cursorPaginate<T>(
    model: any,
    options: {
      where?: any;
      orderBy?: any;
      cursor?: string;
      take?: number;
      select?: any;
      include?: any;
    }
  ): Promise<{
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const { where, orderBy = { id: 'asc' }, cursor, take = 20, select, include } = options;
    
    const query: any = {
      where,
      orderBy,
      take: take + 1, // Take one extra to check if there are more
    };
    
    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1; // Skip the cursor
    }
    
    if (select) query.select = select;
    if (include) query.include = include;
    
    const items = await model.findMany(query);
    
    const hasMore = items.length > take;
    if (hasMore) {
      items.pop(); // Remove the extra item
    }
    
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
      hasMore
    };
  }
  
  /**
   * Offset pagination with total count optimization
   */
  static async offsetPaginate<T>(
    model: any,
    options: {
      where?: any;
      orderBy?: any;
      page?: number;
      limit?: number;
      select?: any;
      include?: any;
    }
  ): Promise<{
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const { where, orderBy = { id: 'asc' }, page = 1, limit = 20, select, include } = options;
    const skip = (page - 1) * limit;
    
    // Use Promise.all to parallelize queries
    const [items, total] = await Promise.all([
      model.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select,
        include
      }),
      model.count({ where })
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }
}

/**
 * Analytics query optimizer
 */
export class AnalyticsQueryOptimizer {
  /**
   * Time series aggregation with date truncation
   */
  static async getTimeSeriesData(
    model: any,
    options: {
      where?: any;
      dateField?: string;
      groupBy?: 'day' | 'week' | 'month' | 'hour';
      aggregations?: Record<string, 'sum' | 'count' | 'avg'>;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const {
      where = {},
      dateField = 'createdAt',
      groupBy = 'day',
      aggregations = { count: 'count' },
      startDate,
      endDate
    } = options;
    
    const dateTrunc = {
      day: 'day',
      week: 'week',
      month: 'month',
      hour: 'hour'
    }[groupBy];
    
    // Build aggregation selects
    const selects = Object.entries(aggregations).map(([alias, type]) => {
      switch (type) {
        case 'sum':
          return `SUM(COALESCE("${alias}", 0)) as "${alias}"`;
        case 'count':
          return 'COUNT(*) as count';
        case 'avg':
          return `AVG(COALESCE("${alias}", 0)) as "${alias}"`;
        default:
          return `COUNT(*) as "${alias}"`;
      }
    }).join(', ');
    
    const query = `
      SELECT 
        DATE_TRUNC('${dateTrunc}', "${dateField}")::date as period,
        ${selects}
      FROM "${model}"
      WHERE 
        1=1
        ${startDate ? `AND "${dateField}" >= '${startDate.toISOString()}'` : ''}
        ${endDate ? `AND "${dateField}" <= '${endDate.toISOString()}'` : ''}
        ${Object.keys(where).length > 0 ? this.buildWhereClause(where) : ''}
      GROUP BY DATE_TRUNC('${dateTrunc}', "${dateField}")
      ORDER BY period ASC
    `;
    
    return prisma.$queryRawUnsafe(query);
  }
  
  private static buildWhereClause(where: any): string {
    const conditions = Object.entries(where).map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        const val = value as Record<string, any>;
        if (val.gte) return `"${key}" >= '${val.gte}'`;
        if (val.lte) return `"${key}" <= '${val.lte}'`;
        if (val.in) return `"${key}" IN (${val.in.map((v: any) => `'${v}'`).join(', ')})`;
        if (val.contains) return `"${key}" ILIKE '%${val.contains}%'`;
      }
      return `"${key}" = '${value}'`;
    });
    
    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }
}

/**
 * User analytics optimized queries
 */
export class UserAnalyticsQueries {
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Get user token usage analytics with caching
   */
  static async getTokenUsage(userId: string, startDate: Date, endDate: Date) {
    const cacheKey = `token-usage:${userId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    return requestDeduplicator.get(cacheKey, async () => {
      const builder = new OptimizedQueryBuilder(cacheKey, this.CACHE_TTL);
      
      return builder.execute(async () => {
        const [usage, byFeature, dailyTotals] = await Promise.all([
          // Total usage
          prisma.token_usage.aggregate({
            where: {
              userId,
              createdAt: { gte: startDate, lte: endDate }
            },
            _sum: { tokensConsumed: true, itemCount: true },
            _count: { _all: true }
          }),
          
          // By feature breakdown
          prisma.token_usage.groupBy({
            by: ['feature'],
            where: {
              userId,
              createdAt: { gte: startDate, lte: endDate }
            },
            _sum: { tokensConsumed: true, itemCount: true },
            _count: true,
            orderBy: { feature: 'asc' }
          }),
          
          // Daily totals for time series
          AnalyticsQueryOptimizer.getTimeSeriesData('token_usages', {
            where: { userId, createdAt: { gte: startDate, lte: endDate } },
            aggregations: { tokensConsumed: 'sum', itemCount: 'sum' },
            groupBy: 'day'
          })
        ]);
        
        return {
          total: usage._sum?.tokensConsumed || 0,
          items: usage._sum?.itemCount || 0,
          operations: usage._count || 0,
          byFeature: byFeature.map((f: any) => ({
            feature: f.feature,
            tokens: f._sum.tokensConsumed || 0,
            items: f._sum.itemCount || 0,
            operations: f._count || 0
          })),
          dailyTotals
        };
      });
    });
  }
  
  /**
   * Get user activity summary
   */
  static async getActivitySummary(userId: string, days: number = 30) {
    const cacheKey = `activity-summary:${userId}:${days}`;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return requestDeduplicator.get(cacheKey, async () => {
      const builder = new OptimizedQueryBuilder(cacheKey, this.CACHE_TTL);
      
      return builder.execute(async () => {
        const [totalActions, uniqueActions, lastActivity] = await Promise.all([
          prisma.userActivity.count({
            where: {
              userId,
              timestamp: { gte: startDate }
            }
          }),
          
          prisma.userActivity.groupBy({
            by: ['action'],
            where: {
              userId,
              timestamp: { gte: startDate }
            },
            _count: true,
            orderBy: { _count: { action: 'desc' } },
            take: 10
          }),
          
          prisma.userActivity.findFirst({
            where: { userId },
            orderBy: { timestamp: 'desc' },
            select: { timestamp: true }
          })
        ]);
        
        return {
          totalActions,
          topActions: uniqueActions,
          lastActivity: lastActivity?.timestamp || null,
          activeDays: await this.getActiveDaysCount(userId, startDate)
        };
      });
    });
  }
  
  private static async getActiveDaysCount(userId: string, startDate: Date) {
    const result = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT DATE_TRUNC('day', timestamp))::int as count
      FROM user_activities
      WHERE 
        userId = ${userId}::text
        AND timestamp >= ${startDate}
    ` as any[];
    
    return result[0]?.count || 0;
  }
}

/**
 * Performance monitoring decorator for database queries
 */
export function monitorQuery(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    const queryName = `${target.constructor.name}.${propertyKey}`;
    
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      
      // Log slow queries (> 100ms)
      if (duration > 100) {
        console.warn(`[DB-SLOW] ${queryName} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`[DB-ERROR] ${queryName} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  };
}