import { Redis } from 'ioredis';
import { createLogger } from './utils/security/secure-logger';

const logger = createLogger('CacheDecorators');

// Redis客户端
let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
}

// 缓存选项
export interface CacheOptions {
  ttl?: number; // 过期时间（秒）
  keyPrefix?: string; // 键前缀
  namespace?: string; // 命名空间
  hash?: boolean; // 是否使用hash存储
}

// 缓存结果装饰器
export function cache<T extends (...args: any[]) => Promise<any>>(
  options: CacheOptions = {}
) {
  const {
    ttl = 300, // 默认5分钟
    keyPrefix = 'cache',
    namespace,
    hash = false
  } = options;

  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;

    descriptor.value = (async function (this: any, ...args: any[]): Promise<any> {
      if (!redis) {
        // 如果没有Redis，直接执行方法
        return method.apply(this, args);
      }

      // 生成缓存键
      const cacheKey = generateCacheKey(keyPrefix, namespace, propertyName, args);
      
      try {
        // 尝试从缓存获取
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit', { key: cacheKey });
          return JSON.parse(cached);
        }

        // 缓存未命中，执行方法
        const result = await method.apply(this, args);
        
        // 存入缓存
        await redis.setex(cacheKey, ttl, JSON.stringify(result));
        logger.debug('Cache set', { key: cacheKey, ttl });
        
        return result;
      } catch (error) {
        logger.error('Cache operation failed', { key: cacheKey, error });
        // 缓存失败时，直接执行方法
        return method.apply(this, args);
      }
    }) as any as T;

    return descriptor;
  };
}

// 带版本控制的缓存装饰器
export function cacheWithVersion<T extends (...args: any[]) => Promise<any>>(
  getVersion: () => Promise<string> | string,
  options: CacheOptions = {}
) {
  const { ttl = 300, keyPrefix = 'cache:versioned' } = options;

  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;

    descriptor.value = (async function (this: any, ...args: any[]): Promise<any> {
      if (!redis) {
        return method.apply(this, args);
      }

      // 获取版本号
      const version = await getVersion();
      const cacheKey = `${keyPrefix}:${propertyName}:${version}:${generateKeyFromArgs(args)}`;
      
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }

        const result = await method.apply(this, args);
        await redis.setex(cacheKey, ttl, JSON.stringify(result));
        
        return result;
      } catch (error) {
        logger.error('Versioned cache operation failed', { key: cacheKey, error });
        return method.apply(this, args);
      }
    }) as any as T;

    return descriptor;
  };
}

// 缓存失效装饰器
export function invalidateCache(
  keyPrefix: string,
  namespace?: string,
  pattern?: string
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>
  ) {
    const method = descriptor.value!;

    descriptor.value = (async function (this: any, ...args: any[]): Promise<any> {
      const result = await method.apply(this, args);

      if (!redis) {
        return result;
      }

      try {
        // 生成要失效的缓存键模式
        const invalidationPattern = pattern || 
          `${keyPrefix}${namespace ? `:${namespace}` : ''}:${propertyName}:*`;
        
        // 查找并删除匹配的键
        const keys = await redis.keys(invalidationPattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.info('Cache invalidated', { pattern, keysCount: keys.length });
        }
      } catch (error) {
        logger.error('Cache invalidation failed', { pattern, error });
      }

      return result;
    }) as any as (...args: any[]) => Promise<any>;

    return descriptor;
  };
}

// 手动缓存工具
export class CacheHelper {
  static async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get failed', { key, error });
      return null;
    }
  }

  static async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!redis) return;
    
    try {
      if (ttl) {
        await redis.setex(key, ttl, JSON.stringify(value));
      } else {
        await redis.set(key, JSON.stringify(value));
      }
    } catch (error) {
      logger.error('Cache set failed', { key, error });
    }
  }

  static async del(key: string | string[]): Promise<void> {
    if (!redis) return;
    
    try {
      const keys = Array.isArray(key) ? key : [key];
      await redis.del(...keys);
    } catch (error) {
      logger.error('Cache delete failed', { key, error });
    }
  }

  static async invalidatePattern(pattern: string): Promise<number> {
    if (!redis) return 0;
    
    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;
      
      const deleted = await redis.del(...keys);
      logger.info('Cache pattern invalidated', { pattern, keysCount: deleted });
      return deleted;
    } catch (error) {
      logger.error('Cache pattern invalidation failed', { pattern, error });
      return 0;
    }
  }
}

// 生成缓存键的辅助函数
function generateCacheKey(prefix: string, namespace: string | undefined, methodName: string, args: any[]): string {
  const namespacePart = namespace ? `:${namespace}` : '';
  const argsPart = generateKeyFromArgs(args);
  return `${prefix}${namespacePart}:${methodName}:${argsPart}`;
}

// 从参数生成键
function generateKeyFromArgs(args: any[]): string {
  return args
    .map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return JSON.stringify(arg);
      }
      return String(arg);
    })
    .join(':');
}