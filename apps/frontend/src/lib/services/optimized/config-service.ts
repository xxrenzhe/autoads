// 优化后的配置服务
import { prisma } from '@/lib/db'

export interface OptimizedConfiguration {
  id: string
  key: string
  value: string
  type: 'string' | 'number' | 'boolean' | 'json'
  category: 'system' | 'features' | 'security'
  description?: string
  isSecret: boolean
  isHotReload: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy?: string
}

// 简化的配置分类
export const CONFIG_CATEGORIES = {
  system: '系统配置',
  features: '功能配置',
  security: '安全配置'
} as const

// 简化的验证类型
export type ValidationType = 'email' | 'url' | 'port' | 'percentage' | 'none'

// 基础验证规则
const basicValidationRules = {
  string: (value: any) => typeof value === 'string',
  number: (value: any) => typeof value === 'number' && !isNaN(value),
  boolean: (value: any) => typeof value === 'boolean',
  json: (value: any) => {
    try {
      JSON.parse(typeof value === 'string' ? value : JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }
}

// 预定义验证规则
const predefinedValidations = {
  email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  url: (value: string) => /^https?:\/\/.+/.test(value),
  port: (value: number) => value >= 1 && value <= 65535,
  percentage: (value: number) => value >= 0 && value <= 100
}

// 配置缓存管理器
class ConfigCacheManager {
  private memoryCache = new Map<string, { value: any; timestamp: number }>()
  private readonly CACHE_TTL = 10 * 60 * 1000 // 10分钟

  get(key: string): any | null {
    const cached = this.memoryCache.get(key)
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.memoryCache.delete(key)
      return null
    }
    
    return cached.value
  }

  set(key: string, value: any): void {
    this.memoryCache.set(key, { value, timestamp: Date.now() })
  }

  invalidate(key: string): void {
    this.memoryCache.delete(key)
  }

  clear(): void {
    this.memoryCache.clear()
  }
}

const cacheManager = new ConfigCacheManager()

// 批量热重载管理器
class BatchHotReloadManager {
  private pendingReloads = new Set<string>()
  private reloadTimer: NodeJS.Timeout | null = null

  scheduleReload(configKey: string): void {
    this.pendingReloads.add(configKey)
    
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer)
    }
    
    this.reloadTimer = setTimeout(() => {
      this.executeBatchReload()
    }, 1000) // 1秒内的变更合并处理
  }

  private async executeBatchReload(): Promise<void> {
    if (this.pendingReloads.size === 0) return
    
    const configsToReload = Array.from(this.pendingReloads)
    this.pendingReloads.clear()
    
    // 只对关键配置执行热重载
    const hotReloadableConfigs = configsToReload.filter((key: any) => 
      /^features\./.test(key) || 
      /^limits\./.test(key) || 
      /^cache\./.test(key)
    )
    
    if (hotReloadableConfigs.length > 0) {
      console.log(`热重载配置: ${hotReloadableConfigs.join(', ')}`)
      // TODO: 实现实际的热重载逻辑
    }
  }
}

const hotReloadManager = new BatchHotReloadManager()

export class OptimizedConfigurationService {
  // 获取配置（带缓存）
  async getConfig(key: string): Promise<OptimizedConfiguration | null> {
    const cached = cacheManager.get(key)
    if (cached) return cached

    const config = await prisma.systemConfig.findUnique({
      where: { key }
    })

    if (!config) return null

    const result = this.mapToOptimizedConfig(config)
    cacheManager.set(key, result)
    return result
  }

  // 获取所有配置或按分类获取
  async getConfigs(category?: string): Promise<OptimizedConfiguration[]> {
    const where = category ? { category } : {}
    
    const configs = await prisma.systemConfig.findMany({
      where,
      orderBy: { key: 'asc' }
    })

    return configs.map((config: any) => {
      const result = this.mapToOptimizedConfig(config)
      cacheManager.set(config.key, result)
      return result
    })
  }

  // 创建配置
  async createConfig(
    data: {
      key: string
      value: string
      type: 'string' | 'number' | 'boolean' | 'json'
      category: 'system' | 'features' | 'security'
      description?: string
      isSecret?: boolean
      isHotReload?: boolean
      validationType?: ValidationType
    },
    userId: string
  ): Promise<void> {
    // 验证配置值
    if (!this.validateConfigValue(data.value, data.type, data.validationType)) {
      throw new Error('配置值验证失败')
    }

    await prisma.systemConfig.create({
      data: {
        key: data.key,
        value: data.value,
        category: data.category,
        description: data.description,
        isSecret: data.isSecret || false,
        validation: data.validationType || 'none',
        createdBy: userId
      }
    })

    // 如果需要热重载
    if (data.isHotReload) {
      hotReloadManager.scheduleReload(data.key)
    }
  }

  // 更新配置
  async updateConfig(
    key: string,
    value: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    const config = await prisma.systemConfig.findUnique({ where: { key } })
    if (!config) {
      throw new Error(`配置 ${key} 不存在`)
    }

    // 验证配置值
    const type = this.inferType(value)
    if (!this.validateConfigValue(value, type, config.validation as ValidationType)) {
      throw new Error('配置值验证失败')
    }

    await prisma.systemConfig.update({
      where: { key },
      data: {
        value,
        updatedBy: userId
      }
    })

    // 清除缓存
    cacheManager.invalidate(key)
    
    // 检查是否需要热重载
    if (this.isHotReloadable(key)) {
      hotReloadManager.scheduleReload(key)
    }

    // 记录审计日志
    await this.auditConfigChange('UPDATE', key, config.value, value, userId, reason)
  }

  // 批量更新配置（使用事务）
  async bulkUpdateConfigs(
    updates: Array<{ key: string; value: string }>,
    userId: string,
    reason?: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        const config = await tx.systemConfig.findUnique({
          where: { key: update.key }
        })
        
        if (!config) {
          throw new Error(`配置 ${update.key} 不存在`)
        }

        await tx.systemConfig.update({
          where: { key: update.key },
          data: {
            value: update.value,
            updatedBy: userId
          }
        })

        // 清除缓存
        cacheManager.invalidate(update.key)
        
        // 检查是否需要热重载
        if (this.isHotReloadable(update.key)) {
          hotReloadManager.scheduleReload(update.key)
        }
      }
    })
  }

  // 删除配置
  async deleteConfig(key: string, userId: string): Promise<void> {
    const config = await prisma.systemConfig.findUnique({ where: { key } })
    if (!config) {
      throw new Error(`配置 ${key} 不存在`)
    }

    await prisma.systemConfig.delete({
      where: { key }
    })

    // 清除缓存
    cacheManager.invalidate(key)
    
    // 记录审计日志
    await this.auditConfigChange('DELETE', key, config.value, null, userId)
  }

  // 获取配置统计
  async getConfigStatistics(): Promise<{
    total: number
    categories: Record<string, number>
    secretConfigs: number
    hotReloadConfigs: number
    lastUpdated: Date
  }> {
    const configs = await prisma.systemConfig.findMany({
      select: {
        key: true,
        category: true,
        isSecret: true,
        updatedAt: true
      }
    })

    const categories = configs.reduce((acc, config: any) => {
      acc[config.category] = (acc[config.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const hotReloadConfigs = configs.filter((config: any) => 
      this.isHotReloadable(config.key)
    ).length

    return {
      total: configs.length,
      categories,
      secretConfigs: configs.filter((c: any) => c.isSecret).length,
      hotReloadConfigs,
      lastUpdated: configs.reduce((latest, config: any) => 
        config.updatedAt > latest ? config.updatedAt : latest, 
        new Date(0)
      )
    }
  }

  // 私有方法
  private mapToOptimizedConfig(config: any): OptimizedConfiguration {
    return {
      id: config.id,
      key: config.key,
      value: config.value,
      type: this.inferType(config.value),
      category: config.category,
      description: config.description,
      isSecret: config.isSecret,
      isHotReload: this.isHotReloadable(config.key),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      createdBy: config.createdBy,
      updatedBy: config.updatedBy
    }
  }

  private inferType(value: string): 'string' | 'number' | 'boolean' | 'json' {
    if (value === 'true' || value === 'false') return 'boolean'
    if (!isNaN(Number(value)) && value.trim() !== '') return 'number'
    try {
      JSON.parse(value)
      return 'json'
    } catch {
      return 'string'
    }
  }

  private validateConfigValue(
    value: string, 
    type: string, 
    validationType?: ValidationType
  ): boolean {
    // 基础类型验证
    let typedValue: any = value
    if (type === 'number') typedValue = Number(value)
    if (type === 'boolean') typedValue = value === 'true'
    
    if (!basicValidationRules[type as keyof typeof basicValidationRules]?.(typedValue)) {
      return false
    }

    // 预定义验证
    if (validationType && validationType !== 'none') {
      const validationFn = predefinedValidations[validationType as keyof typeof predefinedValidations]
      if (!validationFn) return true
      
      // Type guard for validation function parameters
      if (validationType === 'email' || validationType === 'url') {
        const emailUrlFn = validationFn as (value: string) => boolean
        return emailUrlFn(typedValue as string)
      } else {
        const numberFn = validationFn as (value: number) => boolean
        return numberFn(typedValue as number)
      }
    }

    return true
  }

  private isHotReloadable(key: string): boolean {
    const hotReloadPatterns = [
      /^features\./,  // 功能开关
      /^limits\./,    // 限制配置
      /^cache\./      // 缓存配置
    ]
    
    return hotReloadPatterns.some(pattern => pattern.test(key))
  }

  private async auditConfigChange(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    key: string,
    oldValue: string | null,
    newValue: string | null,
    userId: string,
    reason?: string
  ): Promise<void> {
    await prisma.adminLog.create({
      data: {
        action: `${action}_CONFIG`,
        details: {
          key,
          oldValue,
          newValue,
          reason
        },
        userId
      }
    })
  }
}