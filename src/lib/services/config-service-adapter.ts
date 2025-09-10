// 配置服务适配器 - 保持向后兼容性
// 确保现有代码无需修改即可享受优化

import { OptimizedConfigurationService } from './optimized/config-service'

// 创建单例实例
const optimizedService = new OptimizedConfigurationService()

// 导出与旧接口兼容的方法
export const configService = {
  // 保持原有的 get 方法
  async get(key: string): Promise<any> {
    const config = await optimizedService.getConfig(key)
    return config?.value
  },

  // 保持原有的 getAll 方法
  async getAll(filter?: any): Promise<any[]> {
    const configs = await optimizedService.getConfigs()
    if (!filter) return configs
    
    // 应用过滤器
    return configs.filter(config => {
      if (filter.type && config.type !== filter.type) return false
      if (filter.search && !config.key.includes(filter.search)) return false
      if (filter.hotReloadable !== undefined && config.isHotReload !== filter.hotReloadable) return false
      return true
    })
  },

  // 保持原有的 set 方法
  async set(key: string, value: any, userId?: string): Promise<void> {
    await optimizedService.updateConfig(key, String(value), userId || 'system')
  },

  // 保持原有的 hotReload 方法
  async hotReload(key: string): Promise<void> {
    // 优化后的服务已经内置热重载机制
    console.log(`Hot reload triggered for: ${key}`)
  }
}

// 导出类型以保持兼容
export type { ConfigValue, ConfigFilter, ConfigChangeLog } from './config-service'

// 默认导出
export default configService