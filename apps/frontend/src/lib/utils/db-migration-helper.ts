// Removed Prisma types; frontend does not run migrations.
import { dbPool, dbQuery, dbTransaction } from '../db-pool';
import { createLogger } from './security/secure-logger';
import { getRedisClient } from '../redis-config';
import { prisma } from '../db';

const logger = createLogger('DatabaseMigrationHelper');

/**
 * 数据库操作迁移辅助工具
 * 将直接使用 Prisma 的代码迁移到使用 dbPool
 */

// 统一使用全局单例 Prisma 实例（用于兼容性）
export { prisma };

/**
 * 执行查询的包装器，自动使用连接池
 */
export async function withConnection<T>(
  operation: string,
  fn: (prisma: any) => Promise<T>
): Promise<T> {
  return dbQuery(operation, fn);
}

/**
 * 执行事务的包装器
 */
export async function withTransaction<T>(
  fn: (prisma: any) => Promise<T>
): Promise<T> {
  return dbTransaction(fn);
}

/**
 * 批量操作包装器
 */
export async function withBatch<T>(
  operations: Array<(prisma: any) => Promise<T>>
): Promise<T[]> {
  return dbPool.executeBatch(operations);
}

/**
 * 带重试的查询执行
 */
export async function withRetry<T>(
  operation: string,
  fn: (prisma: any) => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await dbQuery(operation, fn);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 如果是连接错误且还有重试次数
      if (attempt < maxRetries && isConnectionError(lastError!)) {
        logger.warn(`Database operation failed, retrying (${attempt}/${maxRetries})`, {
          operation,
          error: lastError.message
        });
        
        // 指数退避
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError!;
}

/**
 * 检查是否为连接错误
 */
function isConnectionError(error: Error): boolean {
  const connectionErrorMessages = [
    'Connection refused',
    'Connection timeout',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'Connection terminated',
    'Too many connections'
  ];
  
  return connectionErrorMessages.some(msg => 
    error.message.includes(msg)
  );
}

/**
 * 缓存查询结果
 */
export async function withCache<T>(
  key: string,
  fn: (prisma: any) => Promise<T>,
  options: {
    ttl?: number; // 缓存时间（秒）
    useCache?: boolean; // 是否使用缓存
  } = {}
): Promise<T> {
  const { ttl = 300, useCache = true } = options;
  
  if (!useCache) {
    return dbQuery(key, fn);
  }
  
  try {
    // 尝试从缓存获取
    const redisClient = getRedisClient();
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 执行查询
    const result = await dbQuery(key, fn);
    
    // 缓存结果
    await redisClient.setex(key, ttl, JSON.stringify(result));
    
    return result;
  } catch (error) {
    logger.debug('Cache operation failed', { key, error });
    // 缓存失败时直接查询数据库
    return dbQuery(key, fn);
  }
}

/**
 * 分页查询辅助函数
 */
export async function paginate<T>(
  model: string,
  options: {
    where?: Record<string, any>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    page?: number;
    pageSize?: number;
    include?: Record<string, any>;
    select?: Record<string, any>;
  }
): Promise<{
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const { 
    where = {}, 
    orderBy = {}, 
    page = 1, 
    pageSize = 20,
    include = {},
    select = {}
  } = options;
  
  const skip = (page - 1) * pageSize;
  
  return withTransaction(async (prisma) => {
    const [data, totalCount] = await Promise.all([
      (prisma[model as any] as any).findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include,
        select
      }),
      (prisma[model as any] as any).count({ where })
    ]);
    
    return {
      data,
      total: totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    };
  });
}

/**
 * 批量插入优化
 */
export async function bulkInsert<T>(
  model: string,
  data: T[],
  options: {
    batchSize?: number;
    skipDuplicates?: boolean;
  } = {}
): Promise<{ count: number; errors: any[] }> {
  const { batchSize = 1000, skipDuplicates = false } = options;
  const errors: Array<{data?: any, error: string, batchStart?: number, batchEnd?: number}> = [];
  let inserted = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    try {
      const result = await withConnection(
        `bulk_insert_${model}`,
        async (prisma) => {
          if (skipDuplicates) {
            // 使用 createMany 并忽略重复错误
            return (prisma[model as any] as any).createMany({
              data: batch,
              skipDuplicates: true
            });
          } else {
            // 逐个插入以捕获错误
            const results = await Promise.allSettled(
              batch.map((item: any) => (prisma[model as any] as any).create({ data: item }))
            );
            
            const successful = results.filter((r: any) => r.status === 'fulfilled');
            const failed = results.filter((r: any) => r.status === 'rejected');
            
            failed.forEach((f: any) => {
              errors.push({
                data: batch[results.indexOf(f)],
                error: (f.reason as Error).message
              });
            });
            
            return { count: successful.length };
          }
        }
      );
      
      inserted += result.count;
    } catch (error) {
      logger.error('Bulk insert batch failed', {
        model,
        batchSize: batch.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      errors.push({
        batchStart: i,
        batchEnd: i + batch.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return { count: inserted, errors };
}

/**
 * 查询性能监控装饰器
 */
export function monitorQuery(operation: string) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: object,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    
    descriptor.value = (async function(this: any, ...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        // 记录慢查询
        if (duration > 1000) {
          logger.warn('Slow query detected', {
            operation,
            method: propertyName,
            duration,
            args: args.length
          });
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error('Query failed', {
          operation,
          method: propertyName,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        throw error;
      }
    }) as unknown as T;
    
    return descriptor;
  };
}

// 为了向后兼容，保留原有的查询方式
export const withQuery = withConnection;
export const withTx = withTransaction;
