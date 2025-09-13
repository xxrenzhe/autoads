import { prisma } from '@/lib/db'
import { PrismaClient, Prisma } from '../types/prisma-types'

type SystemConfig = Prisma.SystemConfigGetPayload<{
  include: {}
}>

export interface ConfigValue {
  key: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'json'
  description: string
  isHotReloadable: boolean
  updatedAt: Date
}

export interface ConfigFilter {
  search?: string
  type?: string
  hotReloadable?: boolean
}

export interface ConfigChangeLog {
  id: string
  action: string
  key: string
  oldValue: any
  newValue: any
  userId: string
  userName: string
  timestamp: Date
}

class ConfigService {
  private configCache = new Map<string, ConfigValue>()
  private cacheExpiry = new Map<string, number>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get a configuration value by key
   */
  async get(key: string): Promise<any> {
    // Check cache first
    if (this.isValidCache(key)) {
      return this.configCache.get(key)?.value
    }

    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key }
      })

      if (!config) {
        return null
      }

      const parsedValue = this.parseConfigValue(config.value, 'string')
      
      // Cache the result
      this.setCache(key, {
        key: config.key,
        value: parsedValue,
        type: 'string' as any,
        description: config.description || '',
        isHotReloadable: true,
        updatedAt: config.updatedAt
      })

      return parsedValue
    } catch (error) {
      console.error(`Error getting config ${key}:`, error)
      return null
    }
  }

  /**
   * Set a configuration value
   */
  async set(
    key: string,
    value: any,
    userId: string,
    options?: {
      type?: 'string' | 'number' | 'boolean' | 'json'
      description?: string
      isHotReloadable?: boolean
    }
  ): Promise<SystemConfig> {
    const stringValue = this.stringifyConfigValue(value, options?.type || 'string')
    
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key }
    })

    let config: SystemConfig

    if (existingConfig) {
      // Update existing configuration
      config = await prisma.systemConfig.update({
        where: { key },
        data: {
          value: stringValue,
          description: options?.description ?? existingConfig.description,
          updatedBy: userId,
          updatedAt: new Date()
        }
      })

      // Log the change
      await this.logConfigChange(userId, 'UPDATE', key, existingConfig.value, stringValue)
    } else {
      // Create new configuration
      config = await prisma.systemConfig.create({
        data: {
          key,
          value: stringValue,
          category: 'general',
          description: options?.description || `Configuration for ${key}`,
          isSecret: false,
          updatedBy: userId,
          createdBy: userId
        }
      })

      // Log the creation
      await this.logConfigChange(userId, 'CREATE', key, null, stringValue)
    }

    // Update cache
    this.setCache(key, {
      key: config.key,
      value: this.parseConfigValue(config.value, 'string'),
      type: 'string' as any,
      description: config.description || '',
      isHotReloadable: true,
      updatedAt: config.updatedAt
    })

    // Apply hot reload if enabled
    if (true) {
      await this.applyHotReload(key, config.value)
    }

    return config
  }

  /**
   * Get all configurations with optional filtering
   */
  async getAll(filter?: ConfigFilter): Promise<SystemConfig[]> {
    const where: any = {}

    if (filter?.search) {
      where.OR = [
        { key: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } }
      ]
    }

    if (filter?.type) {
      where.category = filter.type
    }

    
    return await prisma.systemConfig.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { key: 'asc' }
    })
  }

  /**
   * Delete a configuration
   */
  async delete(key: string, userId: string): Promise<void> {
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key }
    })

    if (!existingConfig) {
      throw new Error('Configuration not found')
    }

    await prisma.systemConfig.delete({
      where: { key }
    })

    // Remove from cache
    this.configCache.delete(key)
    this.cacheExpiry.delete(key)

    // Log the deletion
    await this.logConfigChange(userId, 'DELETE', key, existingConfig.value, null)
  }

  /**
   * Reload all hot-reloadable configurations
   */
  async reloadAll(): Promise<{ success: number; failed: number; errors: string[] }> {
    const hotReloadableConfigs = await prisma.systemConfig.findMany()

    let success = 0
    let failed = 0
    const errors: string[] = []

    for (const config of hotReloadableConfigs) {
      try {
        await this.applyHotReload(config.key, config.value)
        success++
      } catch (error) {
        failed++
        errors.push(`${config.key}: ${error instanceof Error ? error.message : "Unknown error" as any}`)
      }
    }

    // Clear cache to force reload
    this.configCache.clear()
    this.cacheExpiry.clear()

    return { success, failed, errors }
  }

  /**
   * Get configuration change logs
   */
  async getChangeLogs(limit = 50): Promise<ConfigChangeLog[]> {
    const logs = await prisma.adminLog.findMany({
      where: {
        action: {
          startsWith: 'CONFIG_'
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return logs?.filter(Boolean)?.map((log: any) => ({
      id: log.id,
      action: log.action,
      key: (log.details as any)?.key || '',
      oldValue: (log.details as any)?.oldValue,
      newValue: (log.details as any)?.newValue,
      userId: log.userId,
      userName: log.user.name || log.user.email,
      timestamp: log.createdAt
    }))
  }

  /**
   * Validate configuration value
   */
  validateValue(value: string, type: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        switch (type) {
          case 'string':
            resolve(true)
            break
          case 'number':
            resolve(!isNaN(parseFloat(value)))
            break
          case 'boolean':
            resolve(['true', 'false'].includes(value.toLowerCase()))
            break
          case 'json':
            JSON.parse(value)
            resolve(true)
            break
          default:
            resolve(false)
        }
      } catch {
        resolve(false)
      }
    })
  }

  /**
   * Get default configurations for initialization
   */
  getDefaultConfigs(): Array<{
    key: string
    value: string
    type: string
    description: string
    isHotReloadable: boolean
  }> {
    return [
      {
        key: 'rate_limit_default',
        value: '100',
        type: 'number',
        description: 'Default rate limit per minute for API calls',
        isHotReloadable: true
      },
      {
        key: 'token_cost_siterank',
        value: '1',
        type: 'number',
        description: 'Token cost for siterank feature',
        isHotReloadable: true
      },
      {
        key: 'token_cost_batchopen',
        value: '5',
        type: 'number',
        description: 'Token cost for batchopen feature',
        isHotReloadable: true
      },
      {
        key: 'token_cost_adscenter',
        value: '2',
        type: 'number',
        description: 'Token cost for adscenter feature',
        isHotReloadable: true
      },
      {
        key: 'feature_flags',
        value: '{"maintenance_mode": false, "new_user_registration": true}',
        type: 'json',
        description: 'Feature flags for system functionality',
        isHotReloadable: true
      },
      {
        key: 'notification_settings',
        value: '{"email_enabled": true, "sms_enabled": false}',
        type: 'json',
        description: 'Notification system settings',
        isHotReloadable: true
      },
      {
        key: 'system_maintenance_message',
        value: 'System is under maintenance. Please try again later.',
        type: 'string',
        description: 'Message displayed during maintenance mode',
        isHotReloadable: true
      }
    ]
  }

  // Private helper methods
  private isValidCache(key: string): boolean {
    const expiry = this.cacheExpiry.get(key)
    return expiry ? Date.now() < expiry : false
  }

  private setCache(key: string, value: ConfigValue): void {
    this.configCache.set(key, value)
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL)
  }

  private parseConfigValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value)
      case 'boolean':
        return value.toLowerCase() === 'true'
      case 'json':
        return JSON.parse(value)
      default:
        return value
    }
  }

  private stringifyConfigValue(value: any, type: string): string {
    switch (type) {
      case 'json':
        return JSON.stringify(value)
      default:
        return String(value)
    }
  }

  private async logConfigChange(
    userId: string,
    action: string,
    key: string,
    oldValue: string | null,
    newValue: string | null
  ): Promise<void> {
    await prisma.adminLog.create({
      data: {
        action: `CONFIG_${action}`,
        details: {
          key,
          oldValue,
          newValue,
          timestamp: new Date().toISOString()
        },
        userId
      }
    })
  }

  /**
   * Refresh configuration cache
   */
  async refresh(key?: string): Promise<void> {
    if (key) {
      this.configCache.delete(key)
      this.cacheExpiry.delete(key)
    } else {
      this.configCache.clear()
      this.cacheExpiry.clear()
    }
  }

  /**
   * Refresh all configurations
   */
  async refreshAll(): Promise<void> {
    this.configCache.clear()
    this.cacheExpiry.clear()
  }

  /**
   * Get configurations by category
   */
  async getByCategory(category: string): Promise<SystemConfig[]> {
    return await prisma.systemConfig.findMany({
      where: { category }
    })
  }

  /**
   * Get many configurations by keys
   */
  async getMany(keys: string[]): Promise<SystemConfig[]> {
    return await prisma.systemConfig.findMany({
      where: { key: { in: keys } }
    })
  }

  /**
   * Get configuration with metadata
   */
  async getWithMetadata(key: string): Promise<SystemConfig | null> {
    return await prisma.systemConfig.findUnique({
      where: { key }
    })
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    totalKeys: number;
    expiredKeys: number;
    memoryUsage: number;
    hitRate?: number;
  } {
    const now = Date.now()
    const expiredKeys = Array.from(this.cacheExpiry.entries())
      .filter(([, expiry]: any) => expiry < now).length

    return {
      size: this.configCache.size,
      keys: Array.from(this.configCache.keys()),
      totalKeys: this.configCache.size,
      expiredKeys,
      memoryUsage: JSON.stringify(Array.from(this.configCache.entries())).length
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.configCache.clear()
    this.cacheExpiry.clear()
  }

  private async applyHotReload(key: string, value: string): Promise<void> {
    // This method would integrate with your application's configuration system
    console.log(`Hot reloading configuration: ${key} = ${value}`)
    
    // Example implementations for different config types:
    switch (key) {
      case 'rate_limit_default':
        // Update rate limiting configuration in Redis or memory
        break
      case 'feature_flags':
        // Update feature flags in cache
        break
      case 'token_costs':
        // Update token cost configuration
        break
      case 'notification_settings':
        // Update notification service settings
        break
      default:
        // Generic configuration update
        break
    }
  }
}

export const configService = new ConfigService()