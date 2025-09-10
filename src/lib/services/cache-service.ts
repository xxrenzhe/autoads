import { Redis } from 'ioredis'

interface CacheConfig {
  host: string
  port: number
  password?: string
  db?: number
  keyPrefix?: string
  retryDelayOnFailover?: number
  maxRetriesPerRequest?: number
}

interface CacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[] // Cache tags for invalidation
  compress?: boolean // Whether to compress large values
}

interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  totalMemory: number
  usedMemory: number
  connectedClients: number
}

class CacheService {
  private redis: Redis | null = null
  private isConnected = false
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    totalMemory: 0,
    usedMemory: 0,
    connectedClients: 0
  }
  private config: CacheConfig
  private fallbackCache = new Map<string, { value: any; expires: number; tags?: string[] }>()

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'app:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      ...config
    }

    // Check if we're in a build environment
    const isBuildEnvironment = process.env.NEXT_TELEMETRY_DISABLED === '1' && 
                              process.env.NODE_ENV === 'production' && 
                              process.env.DOCKER_ENV === 'true';

    if (isBuildEnvironment) {
      console.log('Build environment detected, skipping Redis initialization');
      return;
    }

    this.initializeRedis()
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        lazyConnect: true
      })

      this.redis.on('connect', () => {
        console.log('Redis connected')
        this.isConnected = true
      })

      this.redis.on('error', (error) => {
        console.error('Redis error:', error)
        this.isConnected = false
        this.stats.errors++
      })

      this.redis.on('close', () => {
        console.log('Redis connection closed')
        this.isConnected = false
      })

      // Test connection
      await this.redis.connect()
      await this.redis.ping()
      
    } catch (error) {
      console.error('Failed to initialize Redis:', error)
      this.redis = null
      this.isConnected = false
    }
  }

  private getKey(key: string): string {
    return key.startsWith(this.config.keyPrefix || '') ? key : `${this.config.keyPrefix}${key}`
  }

  private async useFallback(): Promise<boolean> {
    return !this.redis || !this.isConnected
  }

  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.getKey(key)

    try {
      if (await this.useFallback()) {
        return this.getFallback<T>(key)
      }

      const value = await this.redis!.get(fullKey)
      
      if (value === null) {
        this.stats.misses++
        return null
      }

      this.stats.hits++
      
      try {
        return JSON.parse(value)
      } catch {
        return value as T
      }
    } catch (error) {
      console.error('Cache get error:', error)
      this.stats.errors++
      return this.getFallback<T>(key)
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.getKey(key)
    const { ttl = 3600, tags = [], compress = false } = options

    try {
      if (await this.useFallback()) {
        return this.setFallback(key, value, ttl, tags)
      }

      let serializedValue: string
      
      if (typeof value === 'string') {
        serializedValue = value
      } else {
        serializedValue = JSON.stringify(value)
      }

      // Compress large values if requested
      if (compress && serializedValue.length > 1024) {
        // In a real implementation, you'd use a compression library like zlib
        // For now, we'll just store as-is
      }

      let result: string
      if (ttl > 0) {
        result = await this.redis!.setex(fullKey, ttl, serializedValue)
      } else {
        result = await this.redis!.set(fullKey, serializedValue)
      }

      // Store tags for cache invalidation
      if (tags.length > 0) {
        await this.addTags(fullKey, tags)
      }

      this.stats.sets++
      return result === 'OK'
    } catch (error) {
      console.error('Cache set error:', error)
      this.stats.errors++
      return this.setFallback(key, value, ttl, tags)
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this.getKey(key)

    try {
      if (await this.useFallback()) {
        return this.deleteFallback(key)
      }

      const result = await this.redis!.del(fullKey)
      this.stats.deletes++
      return result > 0
    } catch (error) {
      console.error('Cache delete error:', error)
      this.stats.errors++
      return this.deleteFallback(key)
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getKey(key)

    try {
      if (await this.useFallback()) {
        return this.existsFallback(key)
      }

      const result = await this.redis!.exists(fullKey)
      return result === 1
    } catch (error) {
      console.error('Cache exists error:', error)
      this.stats.errors++
      return this.existsFallback(key)
    }
  }

  async increment(key: string, amount = 1): Promise<number> {
    const fullKey = this.getKey(key)

    try {
      if (await this.useFallback()) {
        return this.incrementFallback(key, amount)
      }

      return await this.redis!.incrby(fullKey, amount)
    } catch (error) {
      console.error('Cache increment error:', error)
      this.stats.errors++
      return this.incrementFallback(key, amount)
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const fullKey = this.getKey(key)

    try {
      if (await this.useFallback()) {
        return this.expireFallback(key, ttl)
      }

      const result = await this.redis!.expire(fullKey, ttl)
      return result === 1
    } catch (error) {
      console.error('Cache expire error:', error)
      this.stats.errors++
      return this.expireFallback(key, ttl)
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    try {
      if (await this.useFallback()) {
        return this.invalidateByTagFallback(tag)
      }

      const tagKey = `tags:${tag}`
      const keys = await this.redis!.smembers(tagKey)
      
      if (keys.length === 0) {
        return 0
      }

      // Delete all keys with this tag
      const pipeline = this.redis!.pipeline()
      keys.forEach(key => pipeline.del(key))
      pipeline.del(tagKey) // Remove the tag set itself
      
      const results = await pipeline.exec()
      return results?.length || 0
    } catch (error) {
      console.error('Cache invalidate by tag error:', error)
      this.stats.errors++
      return this.invalidateByTagFallback(tag)
    }
  }

  async clear(): Promise<boolean> {
    try {
      if (await this.useFallback()) {
        this.fallbackCache.clear()
        return true
      }

      await this.redis!.flushdb()
      return true
    } catch (error) {
      console.error('Cache clear error:', error)
      this.stats.errors++
      this.fallbackCache.clear()
      return false
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      if (this.redis && this.isConnected) {
        const info = await this.redis.info('memory')
        const clients = await this.redis.info('clients')
        
        // Parse Redis info
        const memoryMatch = info.match(/used_memory:(\d+)/)
        const totalMemoryMatch = info.match(/total_system_memory:(\d+)/)
        const clientsMatch = clients.match(/connected_clients:(\d+)/)

        this.stats.usedMemory = memoryMatch ? parseInt(memoryMatch[1]) : 0
        this.stats.totalMemory = totalMemoryMatch ? parseInt(totalMemoryMatch[1]) : 0
        this.stats.connectedClients = clientsMatch ? parseInt(clientsMatch[1]) : 0
      }
    } catch (error) {
      console.error('Error getting cache stats:', error)
    }

    return { ...this.stats }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      if (!this.redis || !this.isConnected) {
        return {
          status: 'unhealthy',
          details: {
            connected: false,
            error: 'Redis not connected',
            fallbackActive: true
          }
        }
      }

      const start = Date.now()
      await this.redis.ping()
      const latency = Date.now() - start

      const info = await this.redis.info('server')
      const versionMatch = info.match(/redis_version:([^\r\n]+)/)
      
      return {
        status: 'healthy',
        details: {
          connected: true,
          latency,
          version: versionMatch ? versionMatch[1] : 'unknown',
          fallbackActive: false
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : "Unknown error" as any,
          fallbackActive: true
        }
      }
    }
  }

  // Fallback methods for when Redis is unavailable
  private getFallback<T>(key: string): T | null {
    const item = this.fallbackCache.get(key)
    if (!item) {
      this.stats.misses++
      return null
    }

    if (item.expires > 0 && Date.now() > item.expires) {
      this.fallbackCache.delete(key)
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return item.value
  }

  private setFallback(key: string, value: any, ttl: number, tags: string[]): boolean {
    const expires = ttl > 0 ? Date.now() + (ttl * 1000) : 0
    this.fallbackCache.set(key, { value, expires, tags })
    this.stats.sets++
    return true
  }

  private deleteFallback(key: string): boolean {
    const existed = this.fallbackCache.has(key)
    this.fallbackCache.delete(key)
    if (existed) this.stats.deletes++
    return existed
  }

  private existsFallback(key: string): boolean {
    const item = this.fallbackCache.get(key)
    if (!item) return false
    
    if (item.expires > 0 && Date.now() > item.expires) {
      this.fallbackCache.delete(key)
      return false
    }
    
    return true
  }

  private incrementFallback(key: string, amount: number): number {
    const current = this.getFallback<number>(key) || 0
    const newValue = current + amount
    this.setFallback(key, newValue, 0, [])
    return newValue
  }

  private expireFallback(key: string, ttl: number): boolean {
    const item = this.fallbackCache.get(key)
    if (!item) return false
    
    item.expires = Date.now() + (ttl * 1000)
    return true
  }

  private invalidateByTagFallback(tag: string): number {
    let count = 0
    for (const [key, item] of this.fallbackCache.entries()) {
      if (item.tags?.includes(tag)) {
        this.fallbackCache.delete(key)
        count++
      }
    }
    return count
  }

  private async addTags(key: string, tags: string[]): Promise<void> {
    if (!this.redis || !this.isConnected) return

    const pipeline = this.redis.pipeline()
    tags.forEach(tag => {
      pipeline.sadd(`tags:${tag}`, key)
    })
    await pipeline.exec()
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
      this.redis = null
      this.isConnected = false
    }
  }

  get client() {
    return this.redis
  }
}

// Singleton instance
let cacheService: CacheService | null = null

export function getCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService()
  }
  return cacheService
}

export { CacheService }
export type { CacheConfig, CacheOptions, CacheStats }