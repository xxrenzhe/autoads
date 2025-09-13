import { MultiLevelCacheService, CacheOptions } from './multi-level-cache';

export interface CacheDecoratorOptions {
  keyPrefix?: string;
  ttl?: number;
  tags?: string[];
  strategy?: 'l1' | 'l2' | 'both';
  keyGenerator?: (...args: any[]) => string;
  condition?: (...args: any[]) => boolean;
}

/**
 * 缓存装饰器工厂函数
 */
export function cache(options: CacheDecoratorOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // 检查缓存条件
      if (options.condition && !options.condition(...args)) {
        return method.apply(this, args);
      }
      
      // 生成缓存键
      const key = options.keyGenerator 
        ? options.keyGenerator(...args)
        : generateDefaultKey(target.constructor.name, propertyName, args);
      
      const cacheOptions: CacheOptions = {
        ttl: options.ttl || 3600,
        tags: options.tags || [options.keyPrefix || 'default'],
        strategy: options.strategy || 'both'
      };
      
      // 获取或设置缓存
      return MultiLevelCacheService.getOrSet(key, () => {
        return method.apply(this, args);
      }, cacheOptions);
    };
    
    return descriptor;
  };
}

/**
 * 清除缓存装饰器
 */
export function clearCache(options: {
  tags?: string[];
  keyGenerator?: (...args: any[]) => string;
} = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      // 清除缓存
      if (options.tags && options.tags.length > 0) {
        await MultiLevelCacheService.deleteByTags(options.tags);
      } else if (options.keyGenerator) {
        const key = options.keyGenerator(...args);
        await MultiLevelCacheService.delete(key);
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * 生成默认缓存键
 */
function generateDefaultKey(
  className: string,
  methodName: string,
  args: any[]
): string {
  const serializedArgs = args.map((arg: any) => {
    if (typeof arg === 'object' && arg !== null) {
      return JSON.stringify(arg);
    }
    return String(arg);
  }).join(':');
  
  return `${className}:${methodName}:${serializedArgs}`;
}

/**
 * 基于用户ID的缓存键生成器
 */
export function createUserKeyGenerator(prefix: string) {
  return function (userId: string, ...args: any[]): string {
    const serializedArgs = args.map((arg: any) => {
      if (typeof arg === 'object' && arg !== null) {
        return JSON.stringify(arg);
      }
      return String(arg);
    }).join(':');
    
    return `${prefix}:${userId}:${serializedArgs}`;
  };
}

/**
 * 基于时间段的缓存键生成器
 */
export function createTimeBasedKeyGenerator(prefix: string) {
  return function (...args: any[]): string {
    const now = new Date();
    const timeKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const serializedArgs = args.map((arg: any) => {
      if (typeof arg === 'object' && arg !== null) {
        return JSON.stringify(arg);
      }
      return String(arg);
    }).join(':');
    
    return `${prefix}:${timeKey}:${serializedArgs}`;
  };
}