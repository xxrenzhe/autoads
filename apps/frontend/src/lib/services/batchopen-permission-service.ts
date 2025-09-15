import { prisma } from '@/lib/db'
import getCacheService from '@/lib/cache'

export interface BatchOpenVersion {
  id: 'basic' | 'silent' | 'autoclick' | 'automated'
  name: string
  description: string
  maxUrls: number
  maxConcurrent: number
  features: string[]
}

export const BATCHOPEN_VERSIONS: Record<string, BatchOpenVersion> = {
  basic: {
    id: 'basic',
    name: '基础版',
    description: '基础的批量URL打开功能',
    maxUrls: 50,
    maxConcurrent: 5,
    features: ['批量打开URL', '基础代理支持', '简单界面操作']
  },
  silent: {
    id: 'silent',
    name: '静默版',
    description: '后台批量打开，无浏览器界面',
    maxUrls: 200,
    maxConcurrent: 20,
    features: ['后台静默打开', '无浏览器界面', '高效资源利用']
  },
  automated: {
    id: 'automated',
    name: '自动化版',
    description: '支持定时任务和脚本控制',
    maxUrls: -1, // 无限制
    maxConcurrent: 50,
    features: ['定时任务', 'API控制', '脚本自动化', '高级代理管理']
  },
  autoclick: {
    id: 'autoclick',
    name: '自动化版',
    description: '支持定时任务和脚本控制（autoclick）',
    maxUrls: -1,
    maxConcurrent: 50,
    features: ['定时任务', 'API控制', '脚本自动化', '高级代理管理']
  }
}

export class BatchOpenPermissionService {
  /**
   * 获取用户的 BatchOpen 版本权限
   */
  static async getUserVersions(userId: string): Promise<{
    available: string[]
    highest: string | null
    versions: Record<string, boolean>
  }> {
    const cacheKey = `batchopen:versions:${userId}`
    const cacheService = getCacheService()
    
    // 尝试从缓存获取
    const cached = await cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    // 获取用户的订阅信息
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: ['ACTIVE', 'PENDING', 'PAST_DUE']
        }
      },
      include: {
        plan: true
      }
    })

    if (!subscription) {
      const result = {
        available: [],
        highest: null,
        versions: { basic: false, silent: false, automated: false, autoclick: false } as any
      }
      await cacheService.set(cacheKey, result, { ttl: 300 }) // 缓存5分钟
      return result
    }

    // 从套餐的 limits 中获取版本权限
    const limits = subscription.plan.limits as any
    const allowedVersions = limits?.batchopen?.versions || []

    const versions: any = {
      basic: allowedVersions.includes('basic'),
      silent: allowedVersions.includes('silent'),
      automated: allowedVersions.includes('automated') || allowedVersions.includes('platinum'), // 兼容旧的 platinum
      autoclick: allowedVersions.includes('autoclick') || allowedVersions.includes('automated') // 别名兼容
    }

    const available = Object.entries(versions)
      .filter(([_, hasAccess]) => hasAccess)
      .map(([version]) => version)

    const highest = available.includes('autoclick')
      ? 'autoclick'
      : available.includes('automated') 
      ? 'automated' 
      : available.includes('silent') 
        ? 'silent' 
        : available.includes('basic') 
          ? 'basic' 
          : null

    const result = {
      available,
      highest,
      versions
    }

    await cacheService.set(cacheKey, result, { ttl: 300 }) // 缓存5分钟
    return result
  }

  /**
   * 检查用户是否有特定版本的权限
   */
  static async hasVersionAccess(userId: string, version: string): Promise<boolean> {
    const { versions } = await this.getUserVersions(userId)
    return versions[version as keyof typeof versions] || false
  }

  /**
   * 获取版本详情
   */
  static getVersionInfo(version: string): BatchOpenVersion | null {
    return BATCHOPEN_VERSIONS[version] || null
  }

  /**
   * 清除用户权限缓存
   */
  static async clearCache(userId: string): Promise<void> {
    const cacheService = getCacheService()
    await cacheService.delete(`batchopen:versions:${userId}`)
  }

  /**
   * 获取所有版本信息（用于展示）
   */
  static getAllVersions(): BatchOpenVersion[] {
    return Object.values(BATCHOPEN_VERSIONS)
  }
}
