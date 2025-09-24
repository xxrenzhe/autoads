import { prisma } from '@/lib/db'
import { getRedisClient } from '@/lib/cache/redis-client'
import { getRemoteConfig, getConfigValue } from '@/lib/config/remote-config'

// Lightweight rule engine focused on AdsCenter (a.k.a. AdsCenter legacy)

export type AdsCenterOperation = 'extract_link' | 'update_ad'

export interface AdsCenterRuleConfig {
  extract_link: {
    costPerItem: number
  }
  update_ad: {
    costPerItem: number
  }
  batchMultiplier: number // 0-1 for discounts, default 1 (no discount)
}

const DEFAULT_RULES: AdsCenterRuleConfig = {
  extract_link: { costPerItem: 1 },
  update_ad: { costPerItem: 3 },
  batchMultiplier: 1,
}

const CACHE_KEY = 'token:rules:adscenter'
const CACHE_TTL_SECONDS = 300

export class TokenRuleEngine {
  // Load AdsCenter rules from configuration_items with fallback defaults
  static async getAdsCenterRules(): Promise<AdsCenterRuleConfig> {
    try {
      const redis = getRedisClient()
      const cached = await redis.get(CACHE_KEY)
      if (cached) return JSON.parse(cached)
      const rules: AdsCenterRuleConfig = { ...DEFAULT_RULES }

      // 1) 优先从远端聚合配置读取（只读，带 ETag 缓存）
      try {
        const snap = await getRemoteConfig()
        const v1 = getConfigValue<number>('token.adscenter.extract_link.costPerItem', snap)
        const v2 = getConfigValue<number>('token.adscenter.update_ad.costPerItem', snap)
        const v3 = getConfigValue<number>('token.adscenter.batchMultiplier', snap)
        if (typeof v1 === 'number' && Number.isFinite(v1)) rules.extract_link.costPerItem = v1
        if (typeof v2 === 'number' && Number.isFinite(v2)) rules.update_ad.costPerItem = v2
        if (typeof v3 === 'number' && Number.isFinite(v3)) rules.batchMultiplier = Math.max(0, Math.min(1, v3))
      } catch {
        // 2) 兜底：读取数据库中的 systemConfig（向后兼容）
        const keys = [
          'token.adscenter.extract_link.costPerItem',
          'token.adscenter.update_ad.costPerItem',
          'token.adscenter.batchMultiplier',
        ]
        const rows = await prisma.systemConfig.findMany({
          where: { key: { in: keys } },
          select: { key: true, value: true },
        })
        for (const row of rows) {
          const key = row.key
          const num = Number(row.value)
          const val = Number.isFinite(num) ? num : row.value
          if (key.endsWith('extract_link.costPerItem') && typeof val === 'number') {
            rules.extract_link.costPerItem = val
          } else if (key.endsWith('update_ad.costPerItem') && typeof val === 'number') {
            rules.update_ad.costPerItem = val
          } else if (key.endsWith('batchMultiplier') && typeof val === 'number') {
            rules.batchMultiplier = Math.max(0, Math.min(1, val))
          }
        }
      }

      await redis.setex(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(rules))
      return rules
    } catch {
      return { ...DEFAULT_RULES }
    }
  }

  // Calculate total tokens for an AdsCenter operation
  static async calcAdsCenterCost(op: AdsCenterOperation, itemCount = 1, isBatch = false) {
    const rules = await this.getAdsCenterRules()
    const unit = op === 'extract_link' ? rules.extract_link.costPerItem : rules.update_ad.costPerItem
    let total = unit * Math.max(1, itemCount)
    if (isBatch && rules.batchMultiplier < 1) {
      total = Math.ceil(total * rules.batchMultiplier)
    }
    return total
  }
}
