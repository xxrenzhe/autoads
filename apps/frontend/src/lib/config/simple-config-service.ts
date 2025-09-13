// 简化的配置服务
import { prisma } from '@/lib/db'

export interface Configuration {
  id: string
  key: string
  value: string
  isSecret: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy?: string
}

export class SimpleConfigurationService {
  async getAllConfigurations(): Promise<Configuration[]> {
    try {
      const configs = await prisma.environmentVariable.findMany({
        orderBy: { key: 'asc' }
      })
      
      return configs.map((config: any) => ({
        id: config.id,
        key: config.key,
        value: config.value,
        isSecret: config.isSecret,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        createdBy: config.createdBy,
        updatedBy: config.updatedBy || undefined
      }))
    } catch (error) {
      console.error('Failed to fetch configurations:', error)
      return []
    }
  }

  async getByCategory(category: string): Promise<Configuration[]> {
    // Since Prisma schema doesn't have category field, return all configs
    // In a real implementation, you might want to parse the key or use a naming convention
    return this.getAllConfigurations()
  }

  async create(
    key: string,
    value: string,
    type: string,
    category: string,
    description: string,
    options: {
      isSecret?: boolean
      isHotReload?: boolean
      validationRule?: string
      defaultValue?: string
    } = {},
    userId: string
  ): Promise<void> {
    await prisma.environmentVariable.create({
      data: {
        key,
        value,
        isSecret: options.isSecret || false,
        createdBy: userId
      }
    })
  }

  async bulkUpdate(updates: any[], userId: string, reason?: string): Promise<void> {
    for (const update of updates) {
      await prisma.environmentVariable.update({
        where: { key: update.key },
        data: { value: update.value }
      })
    }
  }

  async getStatistics() {
    const all = await this.getAllConfigurations()
    
    return {
      total: all.length,
      categories: 1, // Since category is not in schema, default to 1
      secretConfigs: all.filter((c: any) => c.isSecret).length,
      hotReloadConfigs: 0, // Since isHotReload is not in schema
      lastUpdated: all.reduce((latest, config: any) => 
        config.updatedAt > latest ? config.updatedAt : latest, 
        new Date(0)
      )
    }
  }
}