import { EventEmitter } from 'events'

export interface HotReloadEvent {
  type: 'config' | 'env' | 'rate_limit' | 'email'
  action: 'create' | 'update' | 'delete'
  key: string
  data?: any
  timestamp: number
}

export class HotReloadService extends EventEmitter {
  private static instance: HotReloadService
  private reloadQueue: Map<string, HotReloadEvent> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private readonly DEBOUNCE_TIME = 1000 // 1 second debounce

  private constructor() {
    super()
    this.setMaxListeners(100)
  }

  static getInstance(): HotReloadService {
    if (!HotReloadService.instance) {
      HotReloadService.instance = new HotReloadService()
    }
    return HotReloadService.instance
  }

  /**
   * Trigger hot reload for a configuration change
   */
  async triggerReload(event: HotReloadEvent): Promise<void> {
    const eventKey = `${event.type}:${event.key}`
    
    // Add to queue
    this.reloadQueue.set(eventKey, event)
    
    // Debounce multiple updates to the same config
    if (this.debounceTimers.has(eventKey)) {
      clearTimeout(this.debounceTimers.get(eventKey)!)
    }
    
    const timer = setTimeout(() => {
      this.processReload(eventKey)
    }, this.DEBOUNCE_TIME)
    
    this.debounceTimers.set(eventKey, timer)
    
    // Emit immediate event for UI updates
    this.emit('reload:queued', event)
  }

  private async processReload(eventKey: string): Promise<void> {
    const event = this.reloadQueue.get(eventKey)
    if (!event) return

    try {
      // Emit before reload event
      this.emit('reload:before', event)

      // Process based on type
      switch (event.type) {
        case 'config':
          await this.reloadConfig(event)
          break
        case 'env':
          await this.reloadEnv(event)
          break
        case 'rate_limit':
          await this.reloadRateLimit(event)
          break
        case 'email':
          await this.reloadEmail(event)
          break
      }

      // Emit success event
      this.emit('reload:success', event)
      
      // Clean up
      this.reloadQueue.delete(eventKey)
      this.debounceTimers.delete(eventKey)
      
    } catch (error) {
      console.error(`Hot reload failed for ${eventKey}:`, error)
      this.emit('reload:error', { ...event, error })
    }
  }

  private async reloadConfig(event: HotReloadEvent): Promise<void> {
    // Update runtime configuration cache
    if (globalThis.configCache) {
      if (event.action === 'delete') {
        delete globalThis.configCache[event.key]
      } else {
        globalThis.configCache[event.key] = event.data
      }
    }

    // Trigger specific config reloads
    if (event.key.startsWith('EMAIL_')) {
      await this.reloadEmailConfig()
    } else if (event.key.startsWith('RATE_')) {
      await this.reloadRateLimitConfig()
    } else if (event.key.startsWith('DATABASE_')) {
      await this.reloadDatabaseConfig()
    }

    console.log(`Configuration reloaded: ${event.key}`)
  }

  private async reloadEnv(event: HotReloadEvent): Promise<void> {
    // Update process.env for non-sensitive variables
    if (!event.key.includes('SECRET') && !event.key.includes('PASSWORD')) {
      process.env[event.key] = event.data?.value || ''
    }

    // Trigger specific environment reloads
    if (event.key === 'NODE_ENV') {
      // Handle environment change
      console.warn('NODE_ENV changed - restart recommended')
    } else if (event.key.startsWith('DATABASE_')) {
      await this.reloadDatabaseConfig()
    }

    console.log(`Environment variable reloaded: ${event.key}`)
  }

  private async reloadRateLimit(event: HotReloadEvent): Promise<void> {
    // Update in-memory rate limit stores
    if (globalThis.rateLimitStore) {
      globalThis.rateLimitStore.clear()
    }

    // Update rate limit configurations
    if (globalThis.rateLimitConfigs) {
      if (event.action === 'delete') {
        delete globalThis.rateLimitConfigs[event.key]
      } else {
        globalThis.rateLimitConfigs[event.key] = event.data
      }
    }

    console.log(`Rate limit reloaded: ${event.key}`)
  }

  private async reloadEmail(event: HotReloadEvent): Promise<void> {
    await this.reloadEmailConfig()
    console.log(`Email configuration reloaded: ${event.key}`)
  }

  private async reloadEmailConfig(): Promise<void> {
    // Reload email transporter configuration
    if (globalThis.emailTransporter) {
      // Recreate transporter with new config
      const { createTransporter } = await import('./email')
      globalThis.emailTransporter = await createTransporter()
    }
  }

  private async reloadRateLimitConfig(): Promise<void> {
    // Reload rate limiting configuration
    // Rate limiting is handled by individual rate limiters
    console.log('Rate limit configuration reloaded')
  }

  private async reloadDatabaseConfig(): Promise<void> {
    // For database config changes, we typically need a restart
    // But we can update connection pools for some changes
    console.warn('Database configuration changed - restart recommended for full effect')
  }

  /**
   * Get current reload queue status
   */
  getQueueStatus(): { pending: number; processing: string[] } {
    return {
      pending: this.reloadQueue.size,
      processing: Array.from(this.debounceTimers.keys())
    }
  }

  /**
   * Clear all pending reloads
   */
  clearQueue(): void {
    this.reloadQueue.clear()
    this.debounceTimers.forEach(timer => clearTimeout(timer))
    this.debounceTimers.clear()
  }
}

// Export singleton instance
export const hotReloadService = HotReloadService.getInstance()

// Type definitions for global scope
declare global {
  var configCache: Record<string, any>
  var rateLimitStore: Map<string, any> | undefined
  var rateLimitConfigs: Record<string, any> | undefined
  var emailTransporter: any | undefined
  var rateLimitMiddleware: any | undefined
}