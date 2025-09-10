/**
 * Enhanced Caching Layer - Multi-level caching with Redis support
 * Provides intelligent caching strategies for API responses and data
 */

import { Cache, MemoryCacheBackend, CacheBackend } from '@/lib/core/Cache';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('EnhancedCache');

export interface EnhancedCacheConfig {
  defaultTTL: number;
  maxSize: number;
  cleanupInterval: number;
  enableCompression: boolean;
  enableRedis: boolean;
  redisConfig?: {
    url: string;
    password?: string;
    db: number;
    connectTimeout?: number;
  };
}

export interface EnhancedCacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
  metadata?: Record<string, any>;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  totalSize: number;
  averageResponseTime: number;
  lastCleanup: number;
}

/**
 * Enhanced Cache Service with multi-level caching
 */
export class EnhancedCache {
  private memoryCache: Map<string, EnhancedCacheEntry>;
  private diskCache: Cache;
  private redisCache?: any; // Redis client
  private config: EnhancedCacheConfig;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<EnhancedCacheConfig> = {}) {
    // Auto-detect Redis configuration if not explicitly provided
    const autoRedisConfig = !config.enableRedis && !config.redisConfig && process.env.REDIS_URL ? {
      enableRedis: true,
      redisConfig: {
        url: process.env.REDIS_URL,
        db: 0,
        connectTimeout: 30000
      }
    } : {};

    this.config = {
      defaultTTL: 300000, // 5 minutes
      maxSize: 1000,
      cleanupInterval: 60000, // 1 minute
      enableCompression: true,
      enableRedis: false,
      ...autoRedisConfig,
      ...config
    };

    this.memoryCache = new Map();
    this.diskCache = new Cache(new MemoryCacheBackend() as CacheBackend, { 
      defaultTTL: this.config.defaultTTL,
      maxSize: this.config.maxSize 
    });
    
    this.stats = {
      totalEntries: 0,
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      totalSize: 0,
      averageResponseTime: 0,
      lastCleanup: Date.now()
    };

    this.initializeRedis();
    this.startCleanup();
  }

  /**
   * Initialize Redis connection if enabled
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config.enableRedis || !this.config.redisConfig || !this.config.redisConfig.url) {
      logger.warn('Redis disabled: no configuration or URL provided');
      this.config.enableRedis = false;
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    while (retryCount < maxRetries) {
      try {
        // Dynamic import to avoid including Redis in bundle if not used
        const redis = await import('redis');
        const { createClient } = redis;
        
        // Log Redis connection attempt (without sensitive data)
        const redisUrl = this.config.redisConfig.url;
        const maskedUrl = redisUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
        
        logger.info(`Attempting Redis connection (attempt ${retryCount + 1}/${maxRetries}):`, { 
          maskedUrl,
          db: this.config.redisConfig.db,
          ...(this.config.redisConfig.connectTimeout && { connectTimeout: this.config.redisConfig.connectTimeout })
        });
        
        const redisConfig = {
          ...this.config.redisConfig,
          socket: {
            connectTimeout: this.config.redisConfig.connectTimeout || 10000,
            reconnectStrategy: (retries: number) => {
              if (retries > 5) {
                logger.error('Redis reconnection failed after 5 attempts');
                return false; // Stop trying to reconnect
              }
              return Math.min(retries * 1000, 5000); // Exponential backoff
            }
          }
        };
        
        this.redisCache = createClient(redisConfig);
        
        this.redisCache.on('error', (err: Error) => {
          // Only log if it's not a connection error during initialization
          if (retryCount >= maxRetries || !err.message.includes('ECONNREFUSED')) {
            logger.error('Redis connection error:', new EnhancedError('Redis connection error', { 
              message: err.message, 
              stack: err.stack,
              maskedUrl
            }));
          }
        });

        this.redisCache.on('connect', () => {
          logger.info('Redis client connected');
        });

        this.redisCache.on('reconnecting', () => {
          logger.warn('Redis client reconnecting...');
        });

        this.redisCache.on('ready', () => {
          logger.info('Redis client ready');
        });

        await this.redisCache.connect();
        logger.info('Redis cache connected successfully');
        return; // Success, exit the retry loop
        
      } catch (error) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const maskedUrl = this.config.redisConfig.url.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
          
          logger.error('Failed to initialize Redis after all retries, falling back to local cache:', new EnhancedError('Failed to initialize Redis', { 
            errorMessage,
            retryCount,
            maskedUrl
          }));
          
          this.config.enableRedis = false;
          
          // Clean up the failed client
          if (this.redisCache) {
            try {
              await this.redisCache.quit();
            } catch (e) {
              // Ignore quit errors
            }
            this.redisCache = undefined;
          }
          return;
        }
        
        // Wait before retrying
        logger.warn(`Redis connection attempt ${retryCount} failed, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Generate cache key with namespace
   */
  private generateKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  /**
   * Calculate data size
   */
  private calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }

  /**
   * Compress data if enabled
   */
  private async compressData<T>(data: T): Promise<T> {
    if (!this.config.enableCompression) {
      return data;
    }

    try {
      // Simple compression for large objects
      if (typeof data === 'object' && data !== null) {
        const compressed = { ...data };
        // Remove redundant metadata for compression
        delete (compressed as any)._compressed;
        return compressed;
      }
      return data;
    } catch (error) {
      logger.warn('Failed to compress data:', { error: error instanceof Error ? error.message : String(error) });
      return data;
    }
  }

  /**
   * Get data from cache with multi-level fallback
   */
  async get<T>(key: string, namespace?: string): Promise<T | null> {
    const cacheKey = this.generateKey(key, namespace);
    const startTime = performance.now();

    try {
      // Level 1: Memory cache
      const memoryEntry = this.memoryCache.get(cacheKey);
      if (memoryEntry && Date.now() - memoryEntry.timestamp < memoryEntry.ttl) {
        memoryEntry.hits++;
        this.stats.totalHits++;
        this.updateStats(performance.now() - startTime);
        return memoryEntry.data as T;
      }

      // Level 2: Disk cache
      const diskEntry = await this.diskCache.get<EnhancedCacheEntry<T>>(cacheKey);
      if (diskEntry && diskEntry.timestamp && diskEntry.ttl) {
        const entry = diskEntry as EnhancedCacheEntry<T>;
        if (Date.now() - entry.timestamp < entry.ttl) {
          // Promote to memory cache
          this.memoryCache.set(cacheKey, entry);
          entry.hits++;
          this.stats.totalHits++;
          this.updateStats(performance.now() - startTime);
          return entry.data;
        }
      }

      // Level 3: Redis cache
      if (this.config.enableRedis && this.redisCache) {
        try {
          const redisData = await this.redisCache.get(cacheKey);
          if (redisData) {
            const entry = JSON.parse(redisData);
            if (Date.now() - entry.timestamp < entry.ttl) {
              // Promote to memory and disk cache
              this.memoryCache.set(cacheKey, entry);
              await this.diskCache.set(cacheKey, entry);
              entry.hits++;
              this.stats.totalHits++;
              this.updateStats(performance.now() - startTime);
              return entry.data as T;
            }
          }
        } catch (error) {
          logger.warn('Redis cache get failed:', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      this.stats.totalMisses++;
      this.updateStats(performance.now() - startTime);
      return null as any;
    } catch (error) {
      logger.error('Cache get error:', new EnhancedError('Cache get error:', { error: error instanceof Error ? error.message : String(error)  }));
      this.stats.totalMisses++;
      return null as any;
    }
  }

  /**
   * Set data in cache with multi-level storage
   */
  async set<T>(
    key: string,
    data: T,
    ttl: number = this.config.defaultTTL,
    namespace?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const cacheKey = this.generateKey(key, namespace);
    const compressedData = await this.compressData(data);
    const size = this.calculateSize(compressedData);

    const entry: EnhancedCacheEntry<T> = {
      data: compressedData,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size,
      metadata
    };

    try {
      // Check memory cache size limit
      if (this.memoryCache.size >= this.config.maxSize) {
        this.evictLRU();
      }

      // Level 1: Memory cache
      this.memoryCache.set(cacheKey, entry);

      // Level 2: Disk cache
      await this.diskCache.set(cacheKey, entry);

      // Level 3: Redis cache
      if (this.config.enableRedis && this.redisCache) {
        try {
          await this.redisCache.setEx(cacheKey, Math.ceil(ttl / 1000), JSON.stringify(entry));
        } catch (error) {
          logger.warn('Redis cache set failed:', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      this.stats.totalEntries++;
      this.stats.totalSize += size;
    } catch (error) {
      logger.error('Cache set error:', new EnhancedError('Cache set error:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  }

  /**
   * Delete data from cache
   */
  async delete(key: string, namespace?: string): Promise<void> {
    const cacheKey = this.generateKey(key, namespace);

    try {
      this.memoryCache.delete(cacheKey);
      await this.diskCache.delete(cacheKey);

      if (this.config.enableRedis && this.redisCache) {
        try {
          await this.redisCache.del(cacheKey);
        } catch (error) {
          logger.warn('Redis cache delete failed:', { error: error instanceof Error ? error.message : String(error) });
        }
      }
    } catch (error) {
      logger.error('Cache delete error:', new EnhancedError('Cache delete error:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(namespace?: string): Promise<void> {
    try {
      if (namespace) {
        // Clear specific namespace
        const pattern = this.generateKey('*', namespace);
        await this.clearByPattern(pattern);
      } else {
        // Clear all cache
        this.memoryCache.clear();
        await this.diskCache.clear();

        if (this.config.enableRedis && this.redisCache) {
          try {
            await this.redisCache.flushDb();
          } catch (error) {
            logger.warn('Redis cache clear failed:', { error: error instanceof Error ? error.message : String(error) });
          }
        }
      }

      this.stats.totalEntries = 0;
      this.stats.totalSize = 0;
    } catch (error) {
      logger.error('Cache clear error:', new EnhancedError('Cache clear error:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  }

  /**
   * Clear cache by pattern
   */
  private async clearByPattern(pattern: string): Promise<void> {
    // Memory cache
    for (const key of this.memoryCache.keys()) {
      if (await this.matchPattern(key, pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Disk cache (would need pattern matching implementation)
    // For now, clear all disk cache
    await this.diskCache.clear();

    // Redis cache
    if (this.config.enableRedis && this.redisCache) {
      try {
        const keys = await this.redisCache.keys(pattern);
        if (keys.length > 0) {
          await this.redisCache.del(keys);
        }
      } catch (error) {
        logger.warn('Redis pattern clear failed:', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /**
   * Simple pattern matching
   */
  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].hits - b[1].hits);

    const evictCount = Math.floor(this.config.maxSize * 0.2); // Evict 20%
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      this.memoryCache.delete(entries[i][0]);
    }
  }

  /**
   * Cleanup expired entries
   */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    try {
      // Memory cache cleanup
      for (const [key, entry] of this.memoryCache.entries()) {
        if (now - entry.timestamp >= entry.ttl) {
          this.memoryCache.delete(key);
          cleanedCount++;
        }
      }

      // Disk cache cleanup (would need custom implementation)
      // For now, rely on Cache class's built-in cleanup

      // Redis cache cleanup (handled by Redis TTL)

      this.stats.lastCleanup = now;
      
      if (cleanedCount > 0) {
        logger.info(`Cache cleanup completed: ${cleanedCount} entries removed`);
      }
    } catch (error) {
      logger.error('Cache cleanup error:', new EnhancedError('Cache cleanup error:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(responseTime: number): void {
    const totalRequests = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRate = totalRequests > 0 ? this.stats.totalHits / totalRequests : 0;
    
    // Update average response time
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache keys by pattern
   */
  async getKeys(pattern?: string): Promise<string[]> {
    const keys: string[] = [];

    // Memory cache keys
    for (const key of this.memoryCache.keys()) {
      if (!pattern || await this.matchPattern(key, pattern)) {
        keys.push(key);
      }
    }

    // Redis cache keys
    if (this.config.enableRedis && this.redisCache) {
      try {
        const redisKeys = await this.redisCache.keys(pattern || '*');
        keys.push(...redisKeys);
      } catch (error) {
        logger.warn('Redis keys retrieval failed:', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return [...new Set(keys)]; // Remove duplicates
  }

  /**
   * Check if key exists
   */
  async has(key: string, namespace?: string): Promise<boolean> {
    const cacheKey = this.generateKey(key, namespace);
    
    // Check memory cache
    if (this.memoryCache.has(cacheKey)) {
      return true;
    }

    // Check disk cache
    const diskEntry = await this.diskCache.get(cacheKey);
    if (diskEntry) {
      return true;
    }

    // Check Redis cache
    if (this.config.enableRedis && this.redisCache) {
      try {
        const exists = await this.redisCache.exists(cacheKey);
        return exists > 0;
      } catch (error) {
        logger.warn('Redis exists check failed:', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return false;
  }

  /**
   * Get or set pattern (useful for expensive operations)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = this.config.defaultTTL,
    namespace?: string
  ): Promise<T> {
    const cached = await this.get<T>(key, namespace);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    await this.set(key, data, ttl, namespace);
    return data;
  }

  /**
   * Destroy cache instance
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.redisCache) {
      try {
        await this.redisCache.quit();
      } catch (error) {
        logger.warn('Redis quit failed:', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    this.memoryCache.clear();
    await this.diskCache.clear();
  }
}

/**
 * Cache manager for different cache strategies
 */
export class CacheManager {
  private static instances: Map<string, EnhancedCache> = new Map();

  static getInstance(name: string = 'default', config?: Partial<EnhancedCacheConfig>): EnhancedCache {
    if (!this.instances.has(name)) {
      this.instances.set(name, new EnhancedCache(config));
    }
    return this.instances.get(name)!;
  }

  static async destroyAll(): Promise<void> {
    for (const [name, cache] of this.instances) {
      await cache.destroy();
    }
    this.instances.clear();
  }
}

// Default instance with Redis configuration
export const defaultCache = CacheManager.getInstance('default', {
  enableRedis: !!process.env.REDIS_URL,
  redisConfig: process.env.REDIS_URL ? {
    url: process.env.REDIS_URL,
    db: 0,
    connectTimeout: 30000
  } : undefined
});

// Default export
export default EnhancedCache;