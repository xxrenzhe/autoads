import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('QueryOptimizer');

/**
 * 查询性能监控和优化服务
 */
export class QueryOptimizer {
  private static queryStats = new Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    maxTime: number;
    minTime: number;
    slowQueries: Array<{
      timestamp: Date;
      duration: number;
      params?: any;
    }>;
  }>();

  private static readonly SLOW_QUERY_THRESHOLD = 1000; // 1秒
  private static readonly STATS_RETENTION_HOURS = 24;

  /**
   * 记录查询性能
   */
  static recordQuery(
    queryName: string,
    duration: number,
    params?: any
  ) {
    const stats = this.queryStats.get(queryName) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      minTime: Infinity,
      slowQueries: []
    };

    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.minTime = Math.min(stats.minTime, duration);

    // 记录慢查询
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      stats.slowQueries.push({
        timestamp: new Date(),
        duration,
        params
      });

      // 只保留最近100个慢查询
      if (stats.slowQueries.length > 100) {
        stats.slowQueries = stats.slowQueries.slice(-100);
      }

      logger.warn(`Slow query detected: ${queryName} took ${duration}ms`, {
        queryName,
        duration,
        params
      });
    }

    this.queryStats.set(queryName, stats);

    // 定期清理旧数据
    this.cleanupOldStats();
  }

  /**
   * 获取查询统计
   */
  static getQueryStats() {
    const stats = Array.from(this.queryStats.entries()).map(([name, data]: any) => ({
      name,
      ...data,
      slowQueryRate: data.slowQueries.length / data.count
    }));

    // 按平均执行时间排序
    return stats.sort((a, b) => b.avgTime - a.avgTime);
  }

  /**
   * 获取性能建议
   */
  static getPerformanceRecommendations() {
    const recommendations: string[] = [];
    const stats = this.getQueryStats();

    // 分析慢查询
    const slowQueries = stats.filter((s: any) => s.avgTime > 500);
    if (slowQueries.length > 0) {
      recommendations.push(
        `发现 ${slowQueries.length} 个慢查询，建议添加索引或优化SQL`
      );
      slowQueries.forEach((query: any) => {
        recommendations.push(
          `- ${query.name}: 平均执行时间 ${query.avgTime.toFixed(2)}ms`
        );
      });
    }

    // 分析高频查询
    const frequentQueries = stats.filter((s: any) => s.count > 1000);
    if (frequentQueries.length > 0) {
      recommendations.push(
        `发现 ${frequentQueries.length} 个高频查询，建议考虑缓存`
      );
    }

    // 分析查询分布
    const totalQueries = stats.reduce((sum, s: any) => sum + s.count, 0);
    const top10Queries = stats.slice(0, 10);
    const top10Ratio = top10Queries.reduce((sum, s: any) => sum + s.count, 0) / totalQueries;

    if (top10Ratio > 0.8) {
      recommendations.push(
        `前10个查询占总查询量的 ${(top10Ratio * 100).toFixed(1)}%，建议重点优化这些查询`
      );
    }

    return recommendations;
  }

  /**
   * 清理旧统计数据
   */
  private static cleanupOldStats() {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.STATS_RETENTION_HOURS);

    for (const [queryName, stats] of this.queryStats.entries()) {
      stats.slowQueries = stats.slowQueries.filter(
        q => q.timestamp > cutoff
      );

      if (stats.slowQueries.length === 0 && stats.count === 0) {
        this.queryStats.delete(queryName);
      }
    }
  }

  /**
   * 查询装饰器
   */
  static monitorQuery<T extends (...args: any[]) => Promise<any>>(
    queryName: string,
    options: {
      logParams?: boolean;
      sampleRate?: number;
    } = {}
  ) {
    const { logParams = false, sampleRate = 1 } = options;

    return function (
      target: any,
      propertyName: string,
      descriptor: TypedPropertyDescriptor<T>
    ) {
      const method = descriptor.value!;

      descriptor.value = (async function (this: any, ...args: Parameters<T>) {
        const startTime = Date.now();

        try {
          const result = await method.apply(this, args);
          const duration = Date.now() - startTime;

          // 根据采样率记录
          if (Math.random() < sampleRate) {
            QueryOptimizer.recordQuery(
              queryName,
              duration,
              logParams ? args : undefined
            );
          }

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error(`Query failed: ${queryName}`, {
            error: error instanceof Error ? {
              name: error.name,
              message: error.message,
              stack: error.stack
            } : String(error),
            duration,
            params: logParams ? args : undefined
          });
          throw error;
        }
      }) as any;

      return descriptor;
    };
  }
}

/**
 * 查询缓存装饰器
 */
export function cachedQuery<T extends (...args: any[]) => Promise<any>>(
  options: {
    keyPrefix?: string;
    ttl?: number;
    hashArgs?: boolean;
  } = {}
) {
  const { keyPrefix = '', ttl = 300000, hashArgs = true } = options; // 默认5分钟

  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    const cache = new Map<string, { value: any; expiry: number }>();

    descriptor.value = (async function (this: any, ...args: Parameters<T>) {
      // 生成缓存键
      let cacheKey = keyPrefix + propertyName;
      if (hashArgs && args.length > 0) {
        cacheKey += ':' + JSON.stringify(args);
      }

      // 检查缓存
      const cached = cache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.value;
      }

      // 执行查询
      const result = await method.apply(this, args);

      // 缓存结果
      cache.set(cacheKey, {
        value: result,
        expiry: Date.now() + ttl
      });

      // 清理过期缓存
      if (cache.size > 1000) {
        const now = Date.now();
        for (const [key, value] of cache.entries()) {
          if (value.expiry <= now) {
            cache.delete(key);
          }
        }
      }

      return result;
    }) as any;

    return descriptor;
  };
}

/**
 * 分页查询优化器
 */
export class PaginationOptimizer {
  /**
   * 优化分页查询（使用游标分页替代OFFSET）
   */
  static async cursorPaginate<T>(
    query: any,
    options: {
      first?: number;
      after?: string;
      last?: number;
      before?: string;
      orderBy: any;
    }
  ): Promise<{
    items: T[];
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string;
      endCursor?: string;
    };
  }> {
    const { first, after, last, before, orderBy } = options;

    // 构建查询条件
    let where = {};
    
    if (after) {
      const cursor = this.decodeCursor(after);
      where = { ...this.buildCursorCondition(cursor, orderBy, 'gt') };
    }
    
    if (before) {
      const cursor = this.decodeCursor(before);
      where = { ...where, ...this.buildCursorCondition(cursor, orderBy, 'lt') };
    }

    // 执行查询
    const take = first || last || 20;
    const items = await query({
      where,
      orderBy,
      take: take + 1, // 多取一条用于判断是否有下一页
    });

    // 判断是否有更多数据
    const hasMore = items.length > take;
    if (hasMore) {
      items.pop();
    }

    // 构建分页信息
    const pageInfo = {
      hasNextPage: first ? hasMore : false,
      hasPreviousPage: last ? hasMore : false,
      startCursor: items.length > 0 ? this.encodeCursor(items[0]) : undefined,
      endCursor: items.length > 0 ? this.encodeCursor(items[items.length - 1]) : undefined,
    };

    return { items, pageInfo };
  }

  /**
   * 编码游标
   */
  private static encodeCursor(item: any): string {
    return Buffer.from(JSON.stringify(item)).toString('base64');
  }

  /**
   * 解码游标
   */
  private static decodeCursor(cursor: string): any {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  }

  /**
   * 构建游标条件
   */
  private static buildCursorCondition(cursor: any, orderBy: any, operator: 'gt' | 'lt'): any {
    // 简化实现，实际应根据orderBy字段构建条件
    return { id: { [operator]: cursor.id } };
  }
}

/**
 * 查询结果缓存管理器
 */
export class QueryCacheManager {
  private static caches = new Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
    tags: string[];
  }>();

  /**
   * 设置缓存
   */
  static set(
    key: string,
    data: any,
    options: {
      ttl?: number;
      tags?: string[];
    } = {}
  ) {
    const { ttl = 300000, tags = [] } = options;
    
    this.caches.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      tags
    });

    // 定期清理
    this.cleanup();
  }

  /**
   * 获取缓存
   */
  static get<T = any>(key: string): T | null {
    const cached = this.caches.get(key);
    
    if (!cached) {
      return null as any;
    }

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.caches.delete(key);
      return null as any;
    }

    return cached.data;
  }

  /**
   * 按标签清除缓存
   */
  static invalidateByTag(tag: string) {
    for (const [key, cached] of this.caches.entries()) {
      if (cached.tags.includes(tag)) {
        this.caches.delete(key);
      }
    }
  }

  /**
   * 清理过期缓存
   */
  private static cleanup() {
    const now = Date.now();
    
    for (const [key, cached] of this.caches.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.caches.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计
   */
  static getStats() {
    let totalSize = 0;
    let hitCount = 0;
    let missCount = 0;

    // 简化统计
    return {
      size: this.caches.size,
      estimatedMemorySize: totalSize,
      hitRate: hitCount / (hitCount + missCount) || 0
    };
  }
}