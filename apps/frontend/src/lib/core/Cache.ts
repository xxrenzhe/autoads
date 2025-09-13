import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createLogger('Cache');

export interface CacheConfig {
  defaultTTL?: number;
  maxSize?: number;
  strategy?: 'lru' | 'lfu' | 'fifo';
  enableStats?: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  hitRate: number;
}

export abstract class CacheBackend {
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttl?: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract clear(): Promise<void>;
  abstract has(key: string): Promise<boolean>;
  abstract keys(): Promise<string[]>;
  abstract size(): Promise<number>;
}

export class MemoryCacheBackend extends CacheBackend {
  private store = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null as any;
    }

    // Check if expired
    if (Date.now() > entry.createdAt + entry.ttl) {
      this.store.delete(key);
      this.stats.misses++;
      return null as any;
    }

    // Update access info
    entry.accessedAt = Date.now();
    entry.accessCount++;
    this.stats.hits++;

    return entry.value;
  }

  async set<T>(key: string, value: T, ttl: number = 300000): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      value,
      ttl,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0
    };

    this.store.set(key, entry);
    this.stats.sets++;
  }

  async delete(key: string): Promise<void> {
    if (this.store.delete(key)) {
      this.stats.deletes++;
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() > entry.createdAt + entry.ttl) {
      this.store.delete(key);
      return false;
    }
    
    return true;
  }

  async keys(): Promise<string[]> {
    const keys: string[] = [];
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (now <= entry.createdAt + entry.ttl) {
        keys.push(key);
      } else {
        this.store.delete(key);
      }
    }

    return keys;
  }

  async size(): Promise<number> {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now <= entry.createdAt + entry.ttl) {
        count++;
      } else {
        this.store.delete(key);
      }
    }

    return count;
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setex(key: string, seconds: number, value: string): Promise<void>;
  del(...keys: string[]): Promise<void>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  flushdb(): Promise<void>;
}

export class RedisCacheBackend extends CacheBackend {
  private redis: RedisClient;
  private prefix: string;

  constructor(redisClient: RedisClient, prefix: string = 'cache:') {
    super();
    this.redis = redisClient;
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(this.getKey(key));
      return value ? JSON.parse(value) as T : null;
    } catch (error) { 
      logger.error('Redis get error:', new EnhancedError('Redis get error:', { error: error instanceof Error ? error.message : String(error)  }));
      return null as any;
    }
  }

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl > 0) {
        await this.redis.setex(this.getKey(key), ttl, serialized);
      } else {
        await this.redis.set(this.getKey(key), serialized);
      }
    } catch (error) { 
      logger.error('Redis set error:', new EnhancedError('Redis set error:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(this.getKey(key));
    } catch (error) { 
      logger.error('Redis delete error:', new EnhancedError('Redis delete error:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) { 
      logger.error('Redis clear error:', new EnhancedError('Redis clear error:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      try {

      return await this.redis.exists(this.getKey(key)) === 1;

      } catch (error) {

        console.error(error);

        return false;

      }
    } catch (error) { 
      logger.error('Redis has error:', new EnhancedError('Redis has error:', { error: error instanceof Error ? error.message : String(error)  }));
      return false;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const keys = await this.redis.keys(`${this.prefix}*`);
      return keys.map((key: string: any) => key.replace(this.prefix, ''));
    } catch (error) {
      logger.error('Redis keys error:', new EnhancedError('Redis keys error:', { error: error instanceof Error ? error.message : String(error)  }));
      return [];
    }
  }

  async size(): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.prefix}*`);
      return keys.length;
    } catch (error) { 
      logger.error('Redis size error:', new EnhancedError('Redis size error:', { error: error instanceof Error ? error.message : String(error)  }));
      return 0;
    }
  }
}

export class Cache {
  private backend: CacheBackend;
  private config: CacheConfig;
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0, hitRate: 0 };

  constructor(backend?: CacheBackend, config?: CacheConfig) {
    this.backend = backend || new MemoryCacheBackend() as CacheBackend;
    this.config = {
      defaultTTL: 300,
      maxSize: 1000,
      strategy: 'lru',
      enableStats: true,
      ...config
    };
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.backend.get<T>(key);
    
    if (this.config.enableStats) {
      if (value !== null) {
        this.stats.hits++;
      } else {
        this.stats.misses++;
      }
      this.updateHitRate();
    }

    return value;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.backend.set(key, value, (ttl || this.config.defaultTTL!) * 1000);
    
    if (this.config.enableStats) {
      this.stats.sets++;
    }
  }

  async delete(key: string): Promise<void> {
    await this.backend.delete(key);
    
    if (this.config.enableStats) {
      this.stats.deletes++;
    }
  }

  async clear(): Promise<void> {
    await this.backend.clear();
    
    if (this.config.enableStats) {
      this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0, hitRate: 0 };
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return await this.backend.has(key);
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async keys(): Promise<string[]> {
    try {

    return await this.backend.keys();

    } catch (error) {

      console.error(error);

      return [];

    }
  }

  async size(): Promise<number> {
    const size = await this.backend.size();
    
    if (this.config.enableStats) {
      this.stats.size = size;
    }
    
    return size;
  }

  // Advanced Cache Operations
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    
    for (const key of keys) {
      results.push(await this.get<T>(key));
    }
    
    return results;
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async mdelete(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }

  // Cache Patterns
  async remember<T>(
    key: string,
    ttl: number,
    factory: () => Promise<T>
  ): Promise<T> {
    return this.getOrSet(key, factory, ttl);
  }

  async forget(key: string): Promise<void> {
    try {
      await this.delete(key);
    } catch (error) {
      console.error('Error in forget:', error);
      throw error;
    }
  }

  async flush(): Promise<void> {
    try {
      await this.clear();
    } catch (error) {
      console.error('Error in flush:', error);
      throw error;
    }
  }

  // Cache Tags (for grouped invalidation)
  private tagStore = new Map<string, Set<string>>();

  async tag(key: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        if (!this.tagStore.has(tag)) {
          this.tagStore.set(tag, new Set());
        }
        this.tagStore.get(tag)!.add(key);
      }
    } catch (error) {
      console.error('Error in tag:', error);
      throw error;
    }
  }

  async flushTag(tag: string): Promise<void> {
    try {
      const keys = this.tagStore.get(tag);
      if (keys) {
        await this.mdelete(Array.from(keys));
        this.tagStore.delete(tag);
      }
    } catch (error) {
      console.error('Error in flushTag:', error);
      throw error;
    }
  }

  async flushTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        await this.flushTag(tag);
      }
    } catch (error) {
      console.error('Error in flushTags:', error);
      throw error;
    }
  }

  // Statistics
  getStats(): CacheStats {
    if (this.config.enableStats) {
      return { ...this.stats };
    }
    
    if (this.backend instanceof MemoryCacheBackend) {
      return this.backend.getStats();
    }
    
    return { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0, hitRate: 0 };
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  // Cache Warming
  async warm(keys: string[], factory: (key: string) => Promise<unknown>): Promise<void> {
    const promises = keys?.filter(Boolean)?.map(async (key) => {
      try {
        const value = await factory(key);
        await this.set(key, value);
      } catch (error) {
        logger.error('Failed to warm cache for key ${key}:', new EnhancedError('Failed to warm cache for key ${key}:', { error: error instanceof Error ? error.message : String(error)  }));
      }
    });

    await Promise.allSettled(promises);
  }

  // Cache Health Check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: unknown }> {
    try {
      const testKey = '__health_check__';
      const testValue = { timestamp: Date.now() };
      
      await this.set(testKey, testValue, 1);
      const retrieved = await this.get(testKey);
      
      if (retrieved && (retrieved as any).timestamp === testValue.timestamp) {
        return { 
          status: 'healthy', 
          details: { 
            backend: this.backend.constructor.name,
            stats: this.getStats()
          } 
        };
      } else {
        return { 
          status: 'unhealthy', 
          details: { error: 'Cache read/write test failed' } 
        };
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        details: { error: error instanceof Error ? error.message : String(error) } 
      };
    }
  }
}