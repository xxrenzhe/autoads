import { Cache } from '@/lib/core/Cache';

// Create a cache instance for database operations
const dbCache = new Cache();

export interface QueryCacheOptions {
  ttl?: number;
  tags?: string[];
  keyGenerator?: (...args: any[]) => string;
}

export function withQueryCache(options: QueryCacheOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // Generate cache key
      const cacheKey = options.keyGenerator 
        ? options.keyGenerator(...args)
        : `query:${target.constructor.name}.${propertyName}:${JSON.stringify(args)}`;
      
      try {
        // Try to get cached result
        const cached = await dbCache.get(cacheKey);
        if (cached !== null) {
          return cached;
        }
        
        // Execute original method
        const result = await method.apply(this, args);
        
        // Cache the result
        await dbCache.set(cacheKey, result, options.ttl || 300); // 5 minutes default
        return result;
        
      } catch (error) {
        console.error('Query cache error:', error);
        // Fallback to original method
        return method.apply(this, args);
      }
    };
  };
}

// Utility function for generating cache keys
export function generateQueryKey(
  tableName: string,
  operation: string,
  params: Record<string, any> = {}
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = params[key];
      return sorted;
    }, {} as Record<string, any>);
    
  return `db:${tableName}:${operation}:${JSON.stringify(sortedParams)}`;
}

// Cache invalidation helpers
export async function invalidateTableCache(tableName: string): Promise<void> {
  await dbCache.flushTag(`table:${tableName}`);
}

export async function invalidateUserCache(userId: string): Promise<void> {
  await dbCache.flushTag(`user:${userId}`);
}