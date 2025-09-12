import { logger } from '../logging/LoggingService'

export interface CacheConfig {
  ttl?: number
  maxSize?: number
  strategy?: 'lru' | 'fifo' | 'lfu'
}

// Alias for CacheConfig for backward compatibility
export type CacheOptions = CacheConfig

export interface CacheStats {
  hits: number
  misses: number
  size: number
  hitRate: number
  responseTime: {
    l1: number
    l2: number
    l3: number
    l4: number
  }
}

export class UnifiedCacheManager {
  private static instance: UnifiedCacheManager
  private cache: Map<string, { value: any; expiry: number; metadata?: any }>
  private config: CacheConfig
  private stats: CacheStats

  private constructor(config: CacheConfig = {}) {
    this.cache = new Map()
    this.config = {
      ttl: config.ttl || 3600000, // 1 hour default
      maxSize: config.maxSize || 1000,
      strategy: config.strategy || 'lru'
    }
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      hitRate: 0,
      responseTime: {
        l1: 0,
        l2: 0,
        l3: 0,
        l4: 0
      }
    }
  }

  public static getInstance(config?: CacheConfig): UnifiedCacheManager {
    if (!UnifiedCacheManager.instance) {
      UnifiedCacheManager.instance = new UnifiedCacheManager(config)
    }
    return UnifiedCacheManager.instance
  }

  public async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key)
    
    if (!item) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      this.stats.size--
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    this.stats.hits++
    this.updateHitRate()
    logger.debug(`Cache hit for key: ${key}`)
    return item.value
  }

  public async set<T>(key: string, value: T, ttl?: number, metadata?: any): Promise<void> {
    // Check if we need to evict items
    if (this.cache.size >= this.config.maxSize!) {
      this.evict()
    }

    const expiry = Date.now() + (ttl || this.config.ttl!)
    this.cache.set(key, { value, expiry, metadata })
    this.stats.size++
    
    logger.debug(`Cache set for key: ${key}, TTL: ${ttl || this.config.ttl}`)
  }

  public async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.stats.size--
      logger.debug(`Cache deleted for key: ${key}`)
    }
    return deleted
  }

  public async clear(): Promise<void> {
    this.cache.clear()
    this.stats.size = 0
    this.stats.hits = 0
    this.stats.misses = 0
    this.updateHitRate()
    logger.info('Cache cleared')
  }

  public async has(key: string): Promise<boolean> {
    const item = this.cache.get(key)
    if (!item) return false
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      this.stats.size--
      return false
    }
    
    return true
  }

  public async keys(): Promise<string[]> {
    return Array.from(this.cache.keys())
  }

  public getStats(): CacheStats {
    return { ...this.stats }
  }

  private evict(): void {
    const keys = Array.from(this.cache.keys())
    
    switch (this.config.strategy) {
      case 'lru':
        // Simple LRU: delete the first item
        if (keys.length > 0) {
          this.cache.delete(keys[0])
          this.stats.size--
        }
        break
      case 'fifo':
        // FIFO: delete the first item
        if (keys.length > 0) {
          this.cache.delete(keys[0])
          this.stats.size--
        }
        break
      case 'lfu':
        // For LFU, we'd need to track access frequency
        // For now, fall back to LRU
        if (keys.length > 0) {
          this.cache.delete(keys[0])
          this.stats.size--
        }
        break
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0
  }

  // Cleanup expired items
  public async cleanup(): Promise<number> {
    let cleaned = 0
    const now = Date.now()
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key)
        cleaned++
        this.stats.size--
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired cache items`)
    }
    
    return cleaned
  }

  // Start automatic cleanup interval
  public startAutoCleanup(intervalMs: number = 300000): NodeJS.Timeout {
    logger.info(`Starting auto cleanup with interval: ${intervalMs}ms`)
    return setInterval(() => this.cleanup(), intervalMs)
  }

  // Stop auto cleanup
  public stopAutoCleanup(intervalId: NodeJS.Timeout): void {
    clearInterval(intervalId)
    logger.info('Stopped auto cleanup')
  }

  // Get detailed statistics (alias for getStats)
  public getStatistics(): CacheStats {
    return this.getStats()
  }

  // Get cache health status
  public getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical'
    message: string
    recommendations: string[]
  } {
    const stats = this.getStats()
    const health = {
      status: 'healthy' as 'healthy' | 'warning' | 'critical',
      message: '',
      recommendations: [] as string[]
    }

    if (stats.hitRate < 50) {
      health.status = 'warning'
      health.message = 'Cache hit rate is low'
      health.recommendations.push('Consider increasing TTL values')
    }

    if (stats.size > this.config.maxSize! * 0.9) {
      health.status = health.status === 'warning' ? 'critical' : 'warning'
      health.message += ' Cache is nearly full'
      health.recommendations.push('Consider increasing cache size')
    }

    if (health.status === 'healthy') {
      health.message = 'Cache is operating normally'
    }

    return health
  }

  // Clear all cache entries (alias for clear)
  public async clearAll(): Promise<void> {
    await this.clear()
  }

  // Invalidate cache entries (alias for delete)
  public async invalidate(key: string): Promise<boolean> {
    return await this.delete(key)
  }
}

// Create a global instance
export const globalCacheManager = UnifiedCacheManager.getInstance()