import { getRedisClient } from './redis-client';

export interface CacheOptions {
  ttl?: number; // 过期时间（秒）
  tags?: string[]; // 缓存标签，用于批量清除
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * 简化的 Redis 缓存服务
 * 只使用 Redis 作为缓存存储，移除复杂的内存缓存层
 */
export class SimpleCacheService {
  // 缓存统计
  private static stats = {
    hits: 0,
    misses: 0
  };
  
  /**
   * 获取缓存值
   */
  static async get<T>(key: string): Promise<T | null> {
    // 如果没有配置Redis，直接返回null（跳过缓存）
    if (!process.env.REDIS_URL) {
      this.stats.misses++;
      return null as any;
    }
    
    const redis = getRedisClient();
    try {
      const value = await redis.get(key);
      if (value) {
        this.stats.hits++;
        return JSON.parse(value);
      } else {
        this.stats.misses++;
        return null as any;
      }
    } catch (error) {
      console.error('Redis get error:', error);
      this.stats.misses++;
      return null as any;
    }
  }
  
  /**
   * 设置缓存值
   */
  static async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    // 如果没有配置Redis，直接返回（跳过缓存）
    if (!process.env.REDIS_URL) {
      return;
    }
    
    const redis = getRedisClient();
    try {
      const serialized = JSON.stringify(value);
      const ttl = options.ttl || 3600; // 默认1小时
      
      // 设置值
      await redis.setex(key, ttl, serialized);
      
      // 设置标签索引（如果需要）
      if (options.tags && options.tags.length > 0) {
        const pipeline = redis.pipeline();
        options.tags.forEach((tag: any) => {
          pipeline.sadd(`tag:${tag}`, key);
          // 标签索引也设置过期时间
          pipeline.expire(`tag:${tag}`, ttl);
        });
        await pipeline.exec();
      }
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }
  
  /**
   * 删除缓存
   */
  static async delete(key: string): Promise<void> {
    const redis = getRedisClient();
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }
  
  /**
   * 通过标签删除缓存
   */
  static async deleteByTags(tags: string[]): Promise<void> {
    const redis = getRedisClient();
    try {
      // 获取所有带标签的key
      const pipeline = redis.pipeline();
      tags.forEach((tag: any) => {
        pipeline.smembers(`tag:${tag}`);
      });
      
      const results = await pipeline.exec();
      const keysToDelete = new Set<string>();
      
      if (results) {
        results.forEach(([error, keys]: [Error | null, any]: any) => {
          if (!error && Array.isArray(keys)) {
            keys.forEach((key: any) => keysToDelete.add(key));
          }
        });
      }
      
      // 批量删除
      if (keysToDelete.size > 0) {
        await redis.del(...Array.from(keysToDelete));
        
        // 删除标签索引
        tags.forEach((tag: any) => {
          redis.del(`tag:${tag}`);
        });
      }
    } catch (error) {
      console.error('Redis delete by tags error:', error);
    }
  }
  
  /**
   * 获取或设置缓存（模式）
   */
  static async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // 生成新值
    const value = await factory();
    
    // 设置缓存
    await this.set(key, value, options);
    
    return value;
  }
  
  /**
   * 清空所有缓存
   */
  static async clear(): Promise<void> {
    const redis = getRedisClient();
    try {
      await redis.flushdb();
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }
  
  /**
   * 获取缓存统计
   */
  static getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate
    };
  }
  
  /**
   * 重置统计信息
   */
  static resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }
}