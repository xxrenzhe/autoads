import { getRedisClient } from '@/lib/cache/redis-client';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
}

export class RedisCacheService {
  private defaultTTL: number = 3600; // 1 hour
  private keyPrefix: string;

  constructor(keyPrefix: string = 'cache:') {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.generateKey(key);
      const redis = getRedisClient();
      const value = await redis.get(fullKey);
      
      if (!value) return null as any;
      
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null as any;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.generateKey(key);
      const ttl = options.ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);
      
      const redis = getRedisClient();
      await redis.set(fullKey, serialized, { EX: ttl });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.generateKey(key);
      const redis = getRedisClient();
      await redis.del(fullKey);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear all cache with prefix
   */
  async clear(): Promise<void> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        for (const key of keys) {
          await redis.del(key);
        }
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(key, value, options);
    return value;
  }
}

// Create cache instances for different purposes
export const apiCache = new RedisCacheService('api:');
export const dbCache = new RedisCacheService('db:');
export const configCache = new RedisCacheService('config:');
