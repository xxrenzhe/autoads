// Removed Prisma types; cache works independently of DB layer

// TokenConfig interface - table not in schema
interface TokenConfig {
  id: string
  name: string
  feature: string
  dailyLimit: number | null
  monthlyLimit: number | null
  costPerUse: number
  isActive: boolean
  userId: string | null
  createdAt: Date
  updatedAt: Date
}

interface CacheEntry {
  data: TokenConfig[]
  timestamp: number
  ttl: number
}

interface ConfigChangeNotification {
  type: 'create' | 'update' | 'delete' | 'batch_update'
  configId?: string
  configIds?: string[]
  feature?: string
  action?: string
  oldValue?: any
  newValue?: any
  changedBy: string
  timestamp: number
}

class TokenConfigCache {
  private cache = new Map<string, CacheEntry>()
  private subscribers = new Set<(notification: ConfigChangeNotification) => void>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5分钟

  // 获取缓存的配置
  get(key: string = 'all'): TokenConfig[] | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    // 检查是否过期
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  // 设置缓存
  set(key: string = 'all', data: TokenConfig[], ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  // 清除缓存
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  // 根据功能清除相关缓存
  clearByFeature(feature: string): void {
    const keysToDelete: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      // 检查缓存中是否包含该功能的配置
      if (entry.data.some(config => config.feature === feature)) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach((key: any) => this.cache.delete(key))
  }

  // 订阅配置变更通知
  subscribe(callback: (notification: ConfigChangeNotification) => void): () => void {
    this.subscribers.add(callback)
    
    // 返回取消订阅函数
    return () => {
      this.subscribers.delete(callback)
    }
  }

  // 发布配置变更通知
  notify(notification: ConfigChangeNotification): void {
    // 清除相关缓存
    this.clearRelatedCache(notification)
    
    // 通知所有订阅者
    this.subscribers.forEach((callback: any) => {
      try {
        callback(notification)
      } catch (error) {
        console.error('配置变更通知回调错误:', error)
      }
    })
  }

  // 清除相关缓存
  private clearRelatedCache(notification: ConfigChangeNotification): void {
    switch (notification.type) {
      case 'create':
      case 'update':
      case 'delete':
        if (notification.feature) {
          this.clearByFeature(notification.feature)
        }
        this.clear('all')
        break
      
      case 'batch_update':
        // 批量更新时清除所有缓存
        this.clear()
        break
    }
  }

  // 获取缓存统计信息
  getStats(): {
    totalEntries: number
    totalSize: number
    entries: Array<{
      key: string
      size: number
      age: number
      ttl: number
    }>
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]: any) => ({
      key,
      size: entry.data.length,
      age: Date.now() - entry.timestamp,
      ttl: entry.ttl
    }))

    return {
      totalEntries: this.cache.size,
      totalSize: entries.reduce((sum, entry: any) => sum + entry.size, 0),
      entries
    }
  }

  // 预热缓存
  async warmup(fetchFunction: () => Promise<TokenConfig[]>): Promise<void> {
    try {
      const configs = await fetchFunction()
      this.set('all', configs)
      
      // 按功能分组缓存
      const byFeature = configs.reduce((acc, config: any) => {
        if (!acc[config.feature]) {
          acc[config.feature] = []
        }
        acc[config.feature].push(config)
        return acc
      }, {} as Record<string, TokenConfig[]>)
      
      Object.entries(byFeature).forEach(([feature, featureConfigs]: any) => {
        this.set(`feature:${feature}`, featureConfigs as TokenConfig[])
      })
      
    } catch (error) {
      console.error('缓存预热失败:', error)
    }
  }
}

// 单例实例
export const tokenConfigCache = new TokenConfigCache()

// 配置变更影响分析
export class ConfigChangeImpactAnalyzer {
  // 分析配置变更的影响
  static analyzeImpact(notification: ConfigChangeNotification): {
    severity: 'low' | 'medium' | 'high'
    affectedFeatures: string[]
    estimatedUsers: number
    recommendations: string[]
  } {
    const { type, feature, oldValue, newValue } = notification
    
    let severity: 'low' | 'medium' | 'high' = 'low'
    const affectedFeatures: string[] = []
    let estimatedUsers = 0
    const recommendations: string[] = []

    if (feature) {
      affectedFeatures.push(feature)
    }

    // 分析变更类型的影响
    switch (type) {
      case 'create':
        severity = 'low'
        recommendations.push('新配置已创建，请确保相关功能正常工作')
        break
        
      case 'delete':
        severity = 'high'
        estimatedUsers = 100 // 估算值，实际应从数据库查询
        recommendations.push('配置已删除，可能影响现有用户的功能使用')
        recommendations.push('建议通知相关用户并提供替代方案')
        break
        
      case 'update':
        if (oldValue && newValue) {
          // 分析具体变更内容
          if (oldValue.cost !== newValue.cost) {
            const costChange = ((newValue.cost - oldValue.cost) / oldValue.cost) * 100
            if (Math.abs(costChange) > 50) {
              severity = 'high'
              recommendations.push(`Token消耗变更幅度较大 (${costChange > 0 ? '+' : ''}${costChange.toFixed(1)}%)`)
            } else if (Math.abs(costChange) > 20) {
              severity = 'medium'
            }
          }
          
          if (oldValue.isActive !== newValue.isActive) {
            severity = newValue.isActive ? 'medium' : 'high'
            recommendations.push(
              newValue.isActive 
                ? '功能已启用，用户可以开始使用' 
                : '功能已禁用，现有用户将无法使用'
            )
          }
        }
        break
        
      case 'batch_update':
        severity = 'high'
        recommendations.push('批量配置更新可能影响多个功能')
        recommendations.push('建议监控系统性能和用户反馈')
        break
    }

    return {
      severity,
      affectedFeatures,
      estimatedUsers,
      recommendations
    }
  }

  // 生成影响报告
  static generateImpactReport(notifications: ConfigChangeNotification[]): {
    summary: {
      totalChanges: number
      highImpactChanges: number
      affectedFeatures: string[]
    }
    details: Array<{
      notification: ConfigChangeNotification
      impact: ReturnType<typeof ConfigChangeImpactAnalyzer.analyzeImpact>
    }>
  } {
    const details = notifications?.filter(Boolean)?.map((notification: any) => ({
      notification,
      impact: this.analyzeImpact(notification)
    }))

    const affectedFeatures = Array.from(
      new Set(details.flatMap(d => d.impact.affectedFeatures))
    )

    const highImpactChanges = details.filter((d: any) => d.impact.severity === 'high').length

    return {
      summary: {
        totalChanges: notifications.length,
        highImpactChanges,
        affectedFeatures
      },
      details
    }
  }
}

export type { ConfigChangeNotification }
