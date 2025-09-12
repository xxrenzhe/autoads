import { getRedisClient } from './redis-client';

export interface CacheOptions {
  ttl?: number; // 过期时间（秒）
  tags?: string[]; // 缓存标签，用于批量清除
  compress?: boolean; // 是否压缩
  strategy?: 'l1' | 'l2' | 'both'; // 缓存策略
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

/**
 * 多级缓存服务
 * L1: 内存缓存（快速，但容量有限）
 * L2: Redis缓存（较慢，但容量大，可共享）
 */
export class MultiLevelCacheService {
  // L1缓存 - 内存缓存
  private static l1Cache = new Map<string, {
    value: unknown;
    expiry: number;
    tags: string[];
  }>();
  
  // 缓存统计
  private static stats = {
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l2Hits: 0
  };
  
  // 清理定时器
  private static cleanupInterval: NodeJS.Timeout;
  
  /**
   * 初始化缓存服务
   */
  static init() {
    // 启动定期清理过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000); // 每分钟清理一次
  }
  
  /**
   * 获取缓存值
   */
  static async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const strategy = options?.strategy || 'both';
    
    // 尝试L1缓存
    if (strategy === 'l1' || strategy === 'both') {
      const l1Result = this.getL1<T>(key);
      if (l1Result !== null) {
        this.stats.hits++;
        this.stats.l1Hits++;
        return l1Result;
      }
    }
    
    // 尝试L2缓存
    if (strategy === 'l2' || strategy === 'both') {
      const l2Result = await this.getL2<T>(key);
      if (l2Result !== null) {
        this.stats.hits++;
        this.stats.l2Hits++;
        
        // 回填L1缓存
        if (strategy === 'both') {
          this.setL1(key, l2Result, options ?? {});
        }
        
        return l2Result;
      }
    }
    
    this.stats.misses++;
    return null as any;
  }
  
  /**
   * 设置缓存值
   */
  static async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const strategy = options.strategy || 'both';
    const ttl = options.ttl || 3600; // 默认1小时
    
    // 设置L1缓存
    if (strategy === 'l1' || strategy === 'both') {
      this.setL1(key, value, options);
    }
    
    // 设置L2缓存
    if (strategy === 'l2' || strategy === 'both') {
      await this.setL2(key, value, { ...options, ttl });
    }
  }
  
  /**
   * 删除缓存
   */
  static async delete(key: string, strategy: 'l1' | 'l2' | 'both' = 'both'): Promise<void> {
    if (strategy === 'l1' || strategy === 'both') {
      this.l1Cache.delete(key);
    }
    
    if (strategy === 'l2' || strategy === 'both') {
      const redis = getRedisClient();
      try {
        await redis.del(key);
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }
  }
  
  /**
   * 通过标签删除缓存
   */
  static async deleteByTags(tags: string[]): Promise<void> {
    // L1缓存处理
    const entries = Array.from(this.l1Cache.entries());
    for (const [key, entry] of entries) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.l1Cache.delete(key);
      }
    }
    
    // L2缓存处理
    const redis = getRedisClient();
    try {
      // 获取所有带标签的key
      const pipeline = redis.pipeline();
      tags.forEach(tag => {
        pipeline.smembers(`tag:${tag}`);
      });
      
      const results = await pipeline.exec();
      const keysToDelete = new Set<string>();
      
      results?.forEach(([error, keys]: [any, any]) => {
        if (!error && Array.isArray(keys)) {
          keys.forEach(key => keysToDelete.add(key));
        }
      });
      
      // 批量删除
      if (keysToDelete.size > 0) {
        await redis.del(...Array.from(keysToDelete));
        
        // 删除标签索引
        tags.forEach(tag => {
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
    const cached = await this.get<T>(key, options);
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
    this.l1Cache.clear();
    
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
      hitRate,
      size: this.l1Cache.size
    };
  }
  
  /**
   * L1缓存操作
   */
  private static getL1<T>(key: string): T | null {
    const entry = this.l1Cache.get(key);
    if (!entry) return null as any;
    
    if (Date.now() > entry.expiry) {
      this.l1Cache.delete(key);
      return null as any;
    }
    
    return entry.value as T;
  }
  
  private static setL1<T>(key: string, value: T, options: CacheOptions): void {
    const ttl = options.ttl || 3600;
    const expiry = Date.now() + ttl * 1000;
    
    this.l1Cache.set(key, {
      value,
      expiry,
      tags: options.tags || []
    });
    
    // L1缓存大小限制
    if (this.l1Cache.size > 1000) {
      this.evictLRU();
    }
  }
  
  /**
   * L2缓存操作
   */
  private static async getL2<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) as T : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null as any;
    }
  }
  
  private static async setL2<T>(
    key: string,
    value: T,
    options: CacheOptions
  ): Promise<void> {
    const redis = getRedisClient();
    try {
      const serialized = JSON.stringify(value);
      
      // 设置值
      await redis.setex(key, options.ttl || 3600, serialized);
      
      // 设置标签索引
      if (options.tags && options.tags.length > 0) {
        const pipeline = redis.pipeline();
        options.tags.forEach(tag => {
          pipeline.sadd(`tag:${tag}`, key);
          // 标签索引也设置过期时间
          pipeline.expire(`tag:${tag}`, options.ttl || 3600);
        });
        await pipeline.exec();
      }
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }
  
  /**
   * 清理过期缓存
   */
  private static cleanupExpired(): void {
    const now = Date.now();
    const entries = Array.from(this.l1Cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiry) {
        this.l1Cache.delete(key);
      }
    }
  }
  
  /**
   * LRU淘汰算法
   */
  private static evictLRU(): void {
    // 简单实现：删除第一个（可以优化为真正的LRU）
    const firstKey = this.l1Cache.keys().next().value;
    if (firstKey) {
      this.l1Cache.delete(firstKey);
    }
  }
  
  /**
   * 停止缓存服务
   */
  static stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    const redis = getRedisClient();
    if (redis) {
      redis.disconnect();
    }
  }
}

// 初始化缓存服务
MultiLevelCacheService.init();