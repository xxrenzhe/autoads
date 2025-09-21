import { getRedisClient } from '@/lib/cache/redis-client'

/**
 * Cache Management System
 * 
 * This module provides a comprehensive caching solution with Redis backend,
 * supporting various cache strategies and performance optimization.
 */

export interface CacheConfig {
  defaultTTL: number // seconds
  maxMemory: string
  evictionPolicy: 'allkeys-lru' | 'volatile-lru' | 'allkeys-lfu' | 'volatile-lfu'
  enableCompression: boolean
  enableMetrics: boolean
}

export interface CacheMetrics {
  hits: number
  misses: number
  hitRate: number
  totalKeys: number
  memoryUsage: number
  evictions: number
}

export interface CacheEntry<T = any> {
  value: T
  ttl: number
  createdAt: Date
  accessCount: number
  lastAccessed: Date
}

export class CacheManager {
  private redis: any
  private metrics: CacheMetrics
  private config: CacheConfig

  private static readonly DEFAULT_CONFIG: CacheConfig = {
    defaultTTL: 3600, // 1 hour
    maxMemory: '256mb',
    evictionPolicy: 'allkeys-lru',
    enableCompression: true,
    enableMetrics: true
  }

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...CacheManager.DEFAULT_CONFIG, ...config }
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0,
      evictions: 0
    }

    // Use the resilient Redis client
    this.redis = getRedisClient();

    this.setupRedisConfig()
    this.setupEventHandlers()
  }

  /**
   * Setup Redis configuration
   */
  private async setupRedisConfig(): Promise<void> {
    if (!this.redis) return;
    
    try {
      await this.redis.config('SET', 'maxmemory', this.config.maxMemory)
      await this.redis.config('SET', 'maxmemory-policy', this.config.evictionPolicy)
    } catch (error) {
      console.error('Failed to configure Redis:', error)
    }
  }

  /**
   * Setup event handlers for metrics
   */
  private setupEventHandlers(): void {
    if (!this.redis) return;
    
    if (this.config.enableMetrics) {
      this.redis.on('connect', () => {
        console.log('✅ Cache: Connected to Redis')
      })

      this.redis.on('error', (error) => {
        console.error('❌ Cache: Redis error:', error)
      })

      this.redis.on('close', () => {
        console.log('⚠️  Cache: Redis connection closed')
      })
    }
  }

  /**
   * Create a mock Redis client for build environments
   */
  private createMockRedisClient(): any {
    return {
      get: async () => null,
      set: async () => 'OK',
      setex: async () => 'OK',
      del: async () => 0,
      exists: async () => 0,
      keys: async () => [],
      flushdb: async () => 'OK',
      config: async () => 'OK',
      info: async () => 'mock_redis_info',
      pipeline: () => ({
        exec: async () => []
      }),
      on: () => {},
      once: () => {},
      emit: () => {}
    };
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(this.formatKey(key))
      
      if (value === null) {
        this.updateMetrics('miss')
        return null
      }

      this.updateMetrics('hit')
      return this.deserialize<T>(value)
    } catch (error) {
      console.error('Cache get error:', error)
      this.updateMetrics('miss')
      return null
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string, 
    value: T, 
    ttl: number = this.config.defaultTTL
  ): Promise<boolean> {
    try {
      const serializedValue = this.serialize(value)
      const result = await this.redis.setex(this.formatKey(key), ttl, serializedValue)
      return result === 'OK'
    } catch (error) {
      console.error('Cache set error:', error)
      return false
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(this.formatKey(key))
      return result > 0
    } catch (error) {
      console.error('Cache delete error:', error)
      return false
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.formatKey(key))
      return result === 1
    } catch (error) {
      console.error('Cache exists error:', error)
      return false
    }
  }

  /**
   * Get multiple values
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      const formattedKeys = keys?.filter(Boolean)?.map((key) => this.formatKey(key))
      const values = await this.redis.mget(...formattedKeys)
      
      return values?.filter(Boolean)?.map((value) => {
        if (value === null) {
          this.updateMetrics('miss')
          return null
        }
        this.updateMetrics('hit')
        return this.deserialize<T>(value)
      })
    } catch (error) {
      console.error('Cache mget error:', error)
      return keys.map(() => null)
    }
  }

  /**
   * Set multiple values
   */
  async mset<T = any>(
    entries: Array<{ key: string; value: T; ttl?: number }>
  ): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline()
      
      for (const entry of entries) {
        const ttl = entry.ttl || this.config.defaultTTL
        const serializedValue = this.serialize(entry.value)
        pipeline.setex(this.formatKey(entry.key), ttl, serializedValue)
      }
      
      const results = await pipeline.exec()
      return results?.every(result => result[1] === 'OK') || false
    } catch (error) {
      console.error('Cache mset error:', error)
      return false
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T = any>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = this.config.defaultTTL
  ): Promise<T | null> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key)
      if (cached !== null) {
        return cached
      }

      // Generate value using factory function
      const value = await factory()
      if (value !== null && value !== undefined) {
        await this.set(key, value, ttl)
      }

      return value
    } catch (error) {
      console.error('Cache getOrSet error:', error)
      return null
    }
  }

  /**
   * Increment numeric value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(this.formatKey(key), amount)
    } catch (error) {
      console.error('Cache increment error:', error)
      return 0
    }
  }

  /**
   * Set expiration for key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(this.formatKey(key), ttl)
      return result === 1
    } catch (error) {
      console.error('Cache expire error:', error)
      return false
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(this.formatKey(key))
    } catch (error) {
      console.error('Cache ttl error:', error)
      return -1
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      await this.redis.flushdb()
      return true
    } catch (error) {
      console.error('Cache clear error:', error)
      return false
    }
  }

  /**
   * Get cache metrics
   */
  async getMetrics(): Promise<CacheMetrics> {
    try {
      const info = await this.redis.info('memory')
      const stats = await this.redis.info('stats')
      
      // Parse Redis info
      const memoryUsage = this.parseRedisInfo(info, 'used_memory')
      const evictions = this.parseRedisInfo(stats, 'evicted_keys')
      const totalKeys = await this.redis.dbsize()

      this.metrics.totalKeys = totalKeys
      this.metrics.memoryUsage = memoryUsage
      this.metrics.evictions = evictions
      this.metrics.hitRate = this.metrics.hits + this.metrics.misses > 0 
        ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100 
        : 0

      return { ...this.metrics }
    } catch (error) {
      console.error('Cache metrics error:', error)
      return this.metrics
    }
  }

  /**
   * Get cache health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean
    latency: number
    memoryUsage: number
    connectionStatus: string
  }> {
    try {
      const start = Date.now()
      await this.redis.ping()
      const latency = Date.now() - start

      const info = await this.redis.info('memory')
      const memoryUsage = this.parseRedisInfo(info, 'used_memory')

      return {
        isHealthy: true,
        latency,
        memoryUsage,
        connectionStatus: 'connected'
      }
    } catch (error) {
      return {
        isHealthy: false,
        latency: -1,
        memoryUsage: 0,
        connectionStatus: 'disconnected'
      }
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(this.formatKey(pattern))
      if (keys.length === 0) return 0

      const result = await this.redis.del(...keys)
      return result
    } catch (error) {
      console.error('Cache invalidate pattern error:', error)
      return 0
    }
  }

  /**
   * Cache warming - preload frequently accessed data
   */
  async warmCache(entries: Array<{
    key: string
    factory: () => Promise<any>
    ttl?: number
  }>): Promise<void> {
    try {
      const pipeline = this.redis.pipeline()
      
      for (const entry of entries) {
        try {
          const value = await entry.factory()
          const ttl = entry.ttl || this.config.defaultTTL
          const serializedValue = this.serialize(value)
          pipeline.setex(this.formatKey(entry.key), ttl, serializedValue)
        } catch (error) {
          console.error(`Cache warm error for key ${entry.key}:`, error)
        }
      }
      
      await pipeline.exec()
      console.log(`✅ Cache warmed with ${entries.length} entries`)
    } catch (error) {
      console.error('Cache warming error:', error)
    }
  }

  /**
   * Format cache key with prefix
   */
  private formatKey(key: string): string {
    const prefix = process.env.CACHE_PREFIX || 'app'
    return `${prefix}:${key}`
  }

  /**
   * Serialize value for storage
   */
  private serialize<T>(value: T): string {
    try {
      const serialized = JSON.stringify(value)
      
      if (this.config.enableCompression && serialized.length > 1024) {
        // For large values, you could implement compression here
        // For now, just return the JSON string
        return serialized
      }
      
      return serialized
    } catch (error) {
      console.error('Serialization error:', error)
      return JSON.stringify(null)
    }
  }

  /**
   * Deserialize value from storage
   */
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value)
    } catch (error) {
      console.error('Deserialization error:', error)
      return null as T
    }
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(type: 'hit' | 'miss'): void {
    if (!this.config.enableMetrics) return

    if (type === 'hit') {
      this.metrics.hits++
    } else {
      this.metrics.misses++
    }
  }

  /**
   * Parse Redis info string
   */
  private parseRedisInfo(info: string, key: string): number {
    const lines = info.split('\r\n')
    const line = lines.find((l) => l.startsWith(`${key}:`))
    if (line) {
      const value = line.split(':')[1]
      return parseInt(value) || 0
    }
    return 0
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit()
    } catch (error) {
      console.error('Cache close error:', error)
    }
  }
}

// Singleton instance
let cacheManager: CacheManager | null = null

export function getCacheManager(): CacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager()
  }
  return cacheManager
}

// Cache decorators for common patterns
export function cached(ttl: number = 3600) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const cache = getCacheManager()

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`
      
      return await cache.getOrSet(
        cacheKey,
        () => method.apply(this, args),
        ttl
      )
    }
  }
}

// Cache strategies
export class CacheStrategies {
  private cache: CacheManager

  constructor(cache: CacheManager) {
    this.cache = cache
  }

  /**
   * Cache-aside pattern
   */
  async cacheAside<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T | null> {
    return await this.cache.getOrSet(key, factory, ttl)
  }

  /**
   * Write-through pattern
   */
  async writeThrough<T>(
    key: string,
    value: T,
    persistFn: (value: T) => Promise<void>,
    ttl?: number
  ): Promise<boolean> {
    try {
      await persistFn(value)
      return await this.cache.set(key, value, ttl)
    } catch (error) {
      console.error('Write-through error:', error)
      return false
    }
  }

  /**
   * Write-behind pattern
   */
  async writeBehind<T>(
    key: string,
    value: T,
    persistFn: (value: T) => Promise<void>,
    ttl?: number
  ): Promise<boolean> {
    try {
      const success = await this.cache.set(key, value, ttl)
      
      // Persist asynchronously
      setImmediate(async () => {
        try {
          await persistFn(value)
        } catch (error) {
          console.error('Write-behind persist error:', error)
        }
      })
      
      return success
    } catch (error) {
      console.error('Write-behind error:', error)
      return false
    }
  }

  /**
   * Refresh-ahead pattern
   */
  async refreshAhead<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = 3600,
    refreshThreshold: number = 0.8
  ): Promise<T | null> {
    try {
      const cached = await this.cache.get<T>(key)
      const keyTtl = await this.cache.ttl(key)
      
      // If cache hit and TTL is above threshold, return cached value
      if (cached !== null && keyTtl > ttl * refreshThreshold) {
        return cached
      }
      
      // If cache hit but TTL is below threshold, refresh asynchronously
      if (cached !== null && keyTtl > 0) {
        setImmediate(async () => {
          try {
            const newValue = await factory()
            await this.cache.set(key, newValue, ttl)
          } catch (error) {
            console.error('Refresh-ahead error:', error)
          }
        })
        return cached
      }
      
      // Cache miss or expired, fetch synchronously
      const value = await factory()
      if (value !== null) {
        await this.cache.set(key, value, ttl)
      }
      
      return value
    } catch (error) {
      console.error('Refresh-ahead error:', error)
      return null
    }
  }
}
