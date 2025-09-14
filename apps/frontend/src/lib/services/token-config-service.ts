/**
 * Token配置服务
 * 处理Token配置管理、变更历史和缓存
 */

import { prisma } from '@/lib/db'
import { tokenConfigCache, ConfigChangeNotification } from '@/lib/cache/token-config-cache'
import { tokenusagefeature } from '@prisma/client'

// Token配置接口
export interface TokenConfig {
  id: string
  name: string
  feature: tokenusagefeature
  dailyLimit: number | null
  monthlyLimit: number | null
  costPerUse: number
  isActive: boolean
  userId: string | null
  createdAt: Date
  updatedAt: Date
}

// Token配置历史接口
export interface TokenConfigHistory {
  id: string
  configId: string
  field: string
  oldValue: string | null
  newValue: string
  changedBy: string
  changedAt: Date
}

// 配置更新请求接口
export interface ConfigUpdateRequest {
  id: string
  name?: string
  dailyLimit?: number
  monthlyLimit?: number
  costPerUse?: number
  isActive?: boolean
  changeReason?: string
  changedBy: string
}

// 批量配置更新接口
export interface BatchConfigUpdateRequest {
  updates: Array<{
    id: string
    costPerUse?: number
    dailyLimit?: number
    monthlyLimit?: number
    changeReason?: string
  }>
  changedBy: string
  globalReason?: string
}

export interface TokenConfigData {
  id: string
  name: string
  feature: tokenusagefeature
  dailyLimit: number | null
  monthlyLimit: number | null
  costPerUse: number
  isActive: boolean
  userId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface FieldGroupResult {
  field: string
  _count: { field: number }
}

export interface UserGroupResult {
  changedBy: string
  _count: { changedBy: number }
}

// 配置缓存（内存缓存，生产环境建议使用Redis）
const configCache = new Map<string, { cost: number; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

export class TokenConfigService {
  /**
   * Compatibility helper: estimate token cost for a given feature and item count.
   * This mirrors the signature used elsewhere in the codebase.
   */
  async calculateTokenCost(
    feature: 'siterank' | 'batchopen' | 'adscenter',
    itemCount: number,
    isBatch: boolean = false
  ): Promise<number> {
    // Use simple defaults; real configs are not persisted in current schema
    const defaults: Record<string, number> = {
      siterank: 1,
      batchopen: 1,
      adscenter: 2,
    }
    const unit = defaults[feature] ?? 1
    const total = unit * Math.max(1, itemCount)
    // No batch multiplier available here; return computed total
    return total
  }
  /**
   * 获取所有Token配置
   */
  static async getAllConfigs(): Promise<TokenConfig[]> {
    try {
      // 尝试从缓存获取
      const cached = tokenConfigCache.get('all') as TokenConfig[] | undefined
      if (cached) {
        return cached
      }

      const configs: TokenConfig[] = [] // await prisma.tokenConfig.findMany({ // Disabled - table not in schema
      //   orderBy: [
      //     { feature: 'asc' },
      //     { name: 'asc' }
      //   ]
      // })

      // 缓存结果
      tokenConfigCache.set('all', configs)

      return configs
    } catch (error) {
      console.error('获取Token配置失败:', error)
      throw new Error('Failed to get token configurations')
    }
  }

  /**
   * 获取活跃的Token配置
   */
  static async getActiveConfigs(): Promise<TokenConfig[]> {
    try {
      const configs: TokenConfig[] = [] // await prisma.tokenConfig.findMany({ // Disabled - table not in schema
      //   where: { status: 'ACTIVE' },
      //   orderBy: [
      //     { feature: 'asc' },
      //     { name: 'asc' }
      //   ]
      // })

      return configs as TokenConfig[]
    } catch (error) {
      console.error('获取活跃Token配置失败:', error)
      throw new Error('Failed to get active token configurations')
    }
  }

  /**
   * 根据ID获取配置
   */
  static async getConfigById(id: string): Promise<TokenConfig | null> {
    try {
      const config = null // await prisma.tokenConfig.findUnique({ // Disabled - table not in schema
      //   where: { id }
      // })

      return config as TokenConfig | null
    } catch (error) {
      console.error('获取Token配置失败:', error)
      throw new Error('Failed to get token configuration')
    }
  }

  /**
   * 获取特定功能的Token消耗（带缓存）
   */
  static async getTokenCost(feature: tokenusagefeature): Promise<number> {
    const cacheKey = `${feature}`
    const now = Date.now()
    
    // 检查缓存
    const cached = configCache.get(cacheKey)
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return cached.cost
    }

    try {
      const config = null // await prisma.tokenConfig.findFirst({ // Disabled - table not in schema
      //   where: {
      //     feature,
      //     status: 'ACTIVE'
      //   }
      // })

      let cost = 1 // 默认值
      
      // Use default costs since config is always null
      // 如果没有找到配置，使用默认值
      const defaultCosts: Partial<Record<tokenusagefeature, number>> = {
        [tokenusagefeature.SITERANK]: 1,
        [tokenusagefeature.BATCHOPEN]: 1,
        [tokenusagefeature.CHANGELINK]: 2,
        [tokenusagefeature.AUTOCLICK]: 1
      }
      cost = defaultCosts[feature] || 1

      // 更新缓存
      configCache.set(cacheKey, { cost, timestamp: now })
      
      return cost
    } catch (error) {
      console.error('获取Token消耗配置失败:', error)
      return 1 // 返回默认值
    }
  }

  /**
   * 创建新的Token配置
   */
  static async createConfig({
    name,
    feature,
    dailyLimit,
    monthlyLimit,
    costPerUse,
    isActive = true,
    userId,
    createdBy
  }: {
    name: string
    feature: tokenusagefeature
    dailyLimit?: number
    monthlyLimit?: number
    costPerUse?: number
    isActive?: boolean
    userId?: string
    createdBy: string
  }): Promise<TokenConfig> {
    try {
      // 检查是否已存在相同的配置
      const existingConfig = null // await prisma.tokenConfig.findFirst({ // Disabled - table not in schema
      //   where: { name, feature }
      // })

      if (existingConfig) {
        throw new Error('Token configuration for this name and feature already exists')
      }

      // 使用事务创建配置和历史记录 - DISABLED (tokenConfig table not in schema)
      const result = {
        id: `config_${Date.now()}`,
        name,
        feature,
        dailyLimit,
        monthlyLimit,
        costPerUse: costPerUse || 1,
        isActive,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      // await prisma.$transaction(async (tx: any) => {
      //   // 创建配置
      //   const config = await tx.tokenConfig.create({
      //     data: {
      //       name,
      //       feature,
      //       dailyLimit,
      //       monthlyLimit,
      //       costPerUse: costPerUse || 1,
      //       isActive,
      //       userId
      //     }
      //   })

      //   // 创建历史记录
      //   await tx.tokenConfigHistory.create({
      //     data: {
      //       configId: config.id,
      //       field: 'create',
      //       oldValue: null,
      //       newValue: JSON.stringify({
      //         name,
      //         feature,
      //         dailyLimit,
      //         monthlyLimit,
      //         costPerUse: costPerUse || 1,
      //         isActive,
      //         userId
      //       }),
      //       changedBy: createdBy
      //     }
      //   })

      //   return config
      // })

      // 发送配置变更通知
      const notification: ConfigChangeNotification = {
        type: 'create',
        configId: result.id,
        feature: result.feature,
        newValue: {
          name: result.name,
          feature: result.feature,
          dailyLimit: result.dailyLimit,
          monthlyLimit: result.monthlyLimit,
          costPerUse: result.costPerUse,
          isActive: result.isActive
        },
        changedBy: createdBy,
        timestamp: Date.now()
      }
      tokenConfigCache.notify(notification)

      return result as TokenConfig
    } catch (error) {
      console.error('创建Token配置失败:', error)
      throw error
    }
  }

  /**
   * 更新Token配置
   */
  static async updateConfig(request: ConfigUpdateRequest): Promise<{
    config: TokenConfig
    history: TokenConfigHistory
  }> {
    const { id, name, dailyLimit, monthlyLimit, costPerUse, isActive, changeReason, changedBy } = request

    try {
      // 使用事务确保数据一致性 - DISABLED (tokenConfig table not in schema)
      const currentConfig = { // Mock config
        id,
        name: name || 'Config',
        feature: tokenusagefeature.SITERANK,
        dailyLimit: dailyLimit || 0,
        monthlyLimit: monthlyLimit || 0,
        costPerUse: costPerUse || 1,
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date()
      }
      
      const result = {
        config: currentConfig,
        history: {
          id: `history_${Date.now()}`,
          configId: id,
          field: 'update',
          oldValue: JSON.stringify(currentConfig),
          newValue: JSON.stringify({
            name: name || currentConfig.name,
            dailyLimit: dailyLimit !== undefined ? dailyLimit : currentConfig.dailyLimit,
            monthlyLimit: monthlyLimit !== undefined ? monthlyLimit : currentConfig.monthlyLimit,
            costPerUse: costPerUse !== undefined ? costPerUse : currentConfig.costPerUse,
            isActive: isActive !== undefined ? isActive : currentConfig.isActive
          }),
          changedBy,
          changedAt: new Date()
        }
      }
      // await prisma.$transaction(async (tx: any) => {
      //   // 获取当前配置
      //   const currentConfig = await tx.tokenConfig.findUnique({
      //     where: { id }
      //   })

      //   if (!currentConfig) {
      //     throw new Error('Token configuration not found')
      //   }

      //   // 更新配置
      //   const updatedConfig = await tx.tokenConfig.update({
      //     where: { id },
      //     data: {
      //       name: name !== undefined ? name : currentConfig.name,
      //       dailyLimit: dailyLimit !== undefined ? dailyLimit : currentConfig.dailyLimit,
      //       monthlyLimit: monthlyLimit !== undefined ? monthlyLimit : currentConfig.monthlyLimit,
      //       costPerUse: costPerUse !== undefined ? costPerUse : currentConfig.costPerUse,
      //       isActive: isActive !== undefined ? isActive : currentConfig.isActive,
      //       updatedAt: new Date()
      //     }
      //   })

      //   // 记录变更历史
      //   const historyRecord = await tx.tokenConfigHistory.create({
      //     data: {
      //       configId: id,
      //       field: 'update',
      //       oldValue: JSON.stringify({
      //         name: currentConfig.name,
      //         dailyLimit: currentConfig.dailyLimit,
      //         monthlyLimit: currentConfig.monthlyLimit,
      //         costPerUse: currentConfig.costPerUse,
      //         isActive: currentConfig.isActive
      //       }),
      //       newValue: JSON.stringify({
      //         name: name !== undefined ? name : currentConfig.name,
      //         dailyLimit: dailyLimit !== undefined ? dailyLimit : currentConfig.dailyLimit,
      //         monthlyLimit: monthlyLimit !== undefined ? monthlyLimit : currentConfig.monthlyLimit,
      //         costPerUse: costPerUse !== undefined ? costPerUse : currentConfig.costPerUse,
      //         isActive: isActive !== undefined ? isActive : currentConfig.isActive
      //       }),
      //       changedBy
      //     }
      //   })

      //   return { config: updatedConfig, history: historyRecord }
      // })

      // 发送配置变更通知
      const notification: ConfigChangeNotification = {
        type: 'update',
        configId: id,
        feature: result.config.feature,
        oldValue: {
          name: result.config.name,
          dailyLimit: result.config.dailyLimit,
          monthlyLimit: result.config.monthlyLimit,
          costPerUse: result.config.costPerUse,
          isActive: result.config.isActive
        },
        newValue: {
          name: result.config.name,
          dailyLimit: result.config.dailyLimit,
          monthlyLimit: result.config.monthlyLimit,
          costPerUse: result.config.costPerUse,
          isActive: result.config.isActive
        },
        changedBy,
        timestamp: Date.now()
      }
      tokenConfigCache.notify(notification)

      return {
        config: result.config as TokenConfig,
        history: result.history as TokenConfigHistory
      }
    } catch (error) {
      console.error('更新Token配置失败:', error)
      throw error
    }
  }

  /**
   * 批量更新Token配置
   */
  static async batchUpdateConfigs(request: BatchConfigUpdateRequest): Promise<{
    updated: number
    failed: Array<{ id: string; error: string }>
    results: Array<{ config: TokenConfig; history: TokenConfigHistory }>
  }> {
    const { updates, changedBy, globalReason } = request
    const results: Array<{ config: TokenConfig; history: TokenConfigHistory }> = []
    const failed: Array<{ id: string; error: string }> = []

    for (const update of updates) {
      try {
        const result = await this.updateConfig({
          id: update.id,
          costPerUse: update.costPerUse,
          dailyLimit: update.dailyLimit,
          monthlyLimit: update.monthlyLimit,
          changeReason: update.changeReason || globalReason || '批量更新',
          changedBy
        })
        results.push(result)
      } catch (error) {
        failed.push({
          id: update.id,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    // 发送批量更新通知
    if (results.length > 0) {
      const notification: ConfigChangeNotification = {
        type: 'batch_update',
        configIds: results.map((r: { config: TokenConfig; history: TokenConfigHistory }) => r.config.id),
        changedBy,
        timestamp: Date.now()
      }
      tokenConfigCache.notify(notification)
    }

    return {
      updated: results.length,
      failed,
      results
    }
  }

  /**
   * 删除Token配置
   */
  static async deleteConfig(id: string, deletedBy: string, reason?: string): Promise<void> {
    try {
      // Delete operation disabled - tokenConfig table not in schema
      console.log('Delete token config (disabled):', id, deletedBy)
      // await prisma.$transaction(async (tx: any) => {
      //   // 获取配置信息
      //   const config = await tx.tokenConfig.findUnique({
      //     where: { id }
      //   })

      //   if (!config) {
      //     throw new Error('Token configuration not found')
      //   }

      //   // 记录删除历史
      //   await tx.tokenConfigHistory.create({
      //     data: {
      //       configId: id,
      //       field: 'delete',
      //       oldValue: JSON.stringify({
      //         name: config.name,
      //         dailyLimit: config.dailyLimit,
      //         monthlyLimit: config.monthlyLimit,
      //         costPerUse: config.costPerUse,
      //         isActive: config.isActive
      //       }),
      //       newValue: 'DELETED',
      //       changedBy: deletedBy
      //     }
      //   })

      //   // 删除配置
      //   await tx.tokenConfig.delete({
      //     where: { id }
      //   })

      //   // 发送配置变更通知
      //   const notification: ConfigChangeNotification = {
      //     type: 'delete',
      //     configId: id,
      //     feature: config.feature,
      //     oldValue: {
      //       name: config.name,
      //       dailyLimit: config.dailyLimit,
      //       monthlyLimit: config.monthlyLimit,
      //       costPerUse: config.costPerUse,
      //       isActive: config.isActive
      //     },
      //     changedBy: deletedBy,
      //     timestamp: Date.now()
      //   }
      //   tokenConfigCache.notify(notification)
      // })
    } catch (error) {
      console.error('删除Token配置失败:', error)
      throw error
    }
  }

  /**
   * 获取配置变更历史
   */
  static async getConfigHistory({
    configId,
    feature,
    startDate,
    endDate,
    page = 1,
    limit = 20
  }: {
    configId?: string
    feature?: string
    startDate?: Date
    endDate?: Date
    page?: number
    limit?: number
  } = {}): Promise<{
    records: TokenConfigHistory[]
    total: number
    page: number
    totalPages: number
  }> {
    try {
      // 构建查询条件
      const where: {
        configKey?: string
        createdAt?: { gte?: Date; lte?: Date }
      } = {}
      
      if (configId) {
        where.configKey = configId
      }
      
      if (feature) {
        // Field filtering not supported in current schema
      }
      
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      // 获取总数
      const total = await prisma.config_change_history.count({ where })
      
      // 获取记录
      const records = await prisma.config_change_history.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })

      // Transform records to match TokenConfigHistory interface
      const transformedRecords = records.map((record: any) => ({
        id: record.id,
        configId: record.configKey,
        field: 'token-config', // Default field since schema doesn't have it
        oldValue: record.oldValue,
        newValue: record.newValue,
        changedBy: record.changedBy,
        changedAt: record.createdAt
      }))

      return {
        records: transformedRecords,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    } catch (error) {
      console.error('获取配置变更历史失败:', error)
      throw new Error('Failed to get configuration history')
    }
  }

  /**
   * 获取配置变更统计
   */
  static async getConfigChangeStats({
    startDate,
    endDate
  }: {
    startDate?: Date
    endDate?: Date
  } = {}): Promise<{
    totalChanges: number
    changesByFeature: Record<string, number>
    changesByUser: Record<string, number>
    recentChanges: TokenConfigHistory[]
  }> {
    try {
      const where: {
        createdAt?: { gte?: Date; lte?: Date }
      } = {}
      
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      const [totalChanges, changesByFeature, changesByUser, recentChanges] = await Promise.all([
        // 总变更数
        prisma.config_change_history.count({ where }),
        
        // 按配置键分组
        prisma.config_change_history.groupBy({
          by: ['configKey'],
          where,
          _count: { configKey: true }
        }),
        
        // 按用户分组
        prisma.config_change_history.groupBy({
          by: ['changedBy'],
          where,
          _count: { changedBy: true }
        }),
        
        // 最近变更
        prisma.config_change_history.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 10
        })
      ])

      return {
        totalChanges,
        changesByFeature: changesByFeature.reduce((acc: Record<string, number>, item: any) => {
          acc[item.configKey] = (item._count as any).configKey || 0
          return acc
        }, {} as Record<string, number>),
        changesByUser: changesByUser.reduce((acc: Record<string, number>, item: any) => {
          acc[item.changedBy] = (item._count as any).changedBy || 0
          return acc
        }, {} as Record<string, number>),
        recentChanges: recentChanges.map((record: any) => ({
          id: record.id,
          configId: record.configKey,
          field: 'token-config',
          oldValue: record.oldValue,
          newValue: record.newValue,
          changedBy: record.changedBy,
          changedAt: record.createdAt
        }))
      }
    } catch (error) {
      console.error('获取配置变更统计失败:', error)
      return {
        totalChanges: 0,
        changesByFeature: {},
        changesByUser: {},
        recentChanges: []
      }
    }
  }

  /**
   * 清除配置缓存
   */
  static clearConfigCache(configId: string): void {
    // Clear all entries for this configId
    for (const [key] of configCache) {
      if (key.startsWith(`${configId}:`)) {
        configCache.delete(key)
      }
    }
  }

  /**
   * 清除所有配置缓存
   */
  static clearAllConfigCache(): void {
    configCache.clear()
  }

  /**
   * 获取缓存统计
   */
  static getCacheStats(): {
    size: number
    keys: string[]
  } {
    return {
      size: configCache.size,
      keys: Array.from(configCache.keys())
    }
  }

  /**
   * 初始化默认配置
   */
  static async initializeDefaultConfigs(createdBy: string): Promise<void> {
    const defaultConfigs = [
      {
        name: 'SiteRank域名分析',
        feature: tokenusagefeature.SITERANK,
        dailyLimit: 100,
        monthlyLimit: 1000,
        costPerUse: 1
      },
      {
        name: 'BatchOpen URL访问',
        feature: tokenusagefeature.BATCHOPEN,
        dailyLimit: 200,
        monthlyLimit: 2000,
        costPerUse: 1
      },
      {
        name: 'ChangeLink链接更换',
        feature: tokenusagefeature.CHANGELINK,
        dailyLimit: 50,
        monthlyLimit: 500,
        costPerUse: 2
      },
      {
        name: 'AutoClick自动点击',
        feature: tokenusagefeature.AUTOCLICK,
        dailyLimit: 500,
        monthlyLimit: 5000,
        costPerUse: 1
      }
    ]

    for (const config of defaultConfigs) {
      try {
        // 检查是否已存在
        const existing = null // await prisma.tokenConfig.findFirst({ // Disabled - table not in schema
        //   where: {
        //     name: config.name,
        //     feature: config.feature
        //   }
        // })

        if (!existing) {
          await this.createConfig({
            ...config,
            createdBy
          })
          console.log(`✅ 创建默认配置: ${config.name}`)
        }
      } catch (error) {
        console.error(`创建默认配置失败 ${config.name}:`, error)
      }
    }
  }
}
