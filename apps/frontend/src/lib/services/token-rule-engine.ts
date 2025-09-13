import { prisma } from '@/lib/prisma'
import { redisService } from '@/lib/redis-config'

// Lightweight rule engine focused on ChangeLink (aka AdsCenter/Chengelink)

export type ChangeLinkOperation = 'extract_link' | 'update_ad'

export interface ChangeLinkRuleConfig {
  extract_link: {
    costPerItem: number
  }
  update_ad: {
    costPerItem: number
  }
  batchMultiplier: number // 0-1 for discounts, default 1 (no discount)
}

const DEFAULT_RULES: ChangeLinkRuleConfig = {
  extract_link: { costPerItem: 1 },
  update_ad: { costPerItem: 3 },
  batchMultiplier: 1,
}

const CACHE_KEY = 'token:rules:changelink'
const CACHE_TTL_SECONDS = 300

export class TokenRuleEngine {
  // Load ChangeLink rules from configuration_items with fallback defaults
  static async getChangeLinkRules(): Promise<ChangeLinkRuleConfig> {
    try {
      const cached = await redisService.get(CACHE_KEY)
      if (cached) return JSON.parse(cached)

      // Read config keys if present
      const keys = [
        'token.changelink.extract_link.costPerItem',
        'token.changelink.update_ad.costPerItem',
        'token.changelink.batchMultiplier',
        // Backward-compat aliases (adscenter)
        'token.adscenter.extract_link.costPerItem',
        'token.adscenter.update_ad.costPerItem',
        'token.adscenter.batchMultiplier',
      ]

      const rows = await prisma.configuration_items.findMany({
        where: { key: { in: keys } },
        select: { key: true, type: true, value: true },
      })

      const rules: ChangeLinkRuleConfig = { ...DEFAULT_RULES }
      for (const row of rows) {
        const key = row.key
        const val = row.type === 'number' ? Number(row.value) : row.value
        if (key.endsWith('extract_link.costPerItem') && typeof val === 'number') {
          rules.extract_link.costPerItem = val
        } else if (key.endsWith('update_ad.costPerItem') && typeof val === 'number') {
          rules.update_ad.costPerItem = val
        } else if (key.endsWith('batchMultiplier') && typeof val === 'number') {
          rules.batchMultiplier = Math.max(0, Math.min(1, val))
        }
      }

      await redisService.setex(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(rules))
      return rules
    } catch {
      return { ...DEFAULT_RULES }
    }
  }

  // Calculate total tokens for a ChangeLink operation
  static async calcChangeLinkCost(op: ChangeLinkOperation, itemCount = 1, isBatch = false) {
    const rules = await this.getChangeLinkRules()
    const unit = op === 'extract_link' ? rules.extract_link.costPerItem : rules.update_ad.costPerItem
    let total = unit * Math.max(1, itemCount)
    if (isBatch && rules.batchMultiplier < 1) {
      total = Math.ceil(total * rules.batchMultiplier)
    }
    return total
  }
}

