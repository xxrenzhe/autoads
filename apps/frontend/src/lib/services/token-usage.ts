import { prisma } from '@/lib/db'

export interface TokenUsageOptions {
  userId: string
  feature: 'BATCHOPEN' | 'SITERANK' | 'CHANGELINK'
  operation: string
  tokensUsed: number
  itemCount?: number
  description?: string
  metadata?: Record<string, any>
  isBatch?: boolean
  batchId?: string
}

/**
 * 记录Token使用情况
 */
export async function recordTokenUsage(options: TokenUsageOptions) {
  try {
    // 检查用户Token余额和当前套餐
    const user = await prisma.user.findUnique({
      where: { id: options.userId },
      select: { 
        tokenBalance: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          select: { planId: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!user) {
      console.error(`User not found in database. ID: ${options.userId}`)
      throw new Error('User not found')
    }

    if (user.tokenBalance < options.tokensUsed) {
      throw new Error('Insufficient token balance')
    }

    // 使用事务确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      // 扣除用户Token余额
      const updatedUser = await tx.user.update({
        where: { id: options.userId },
        data: {
          tokenBalance: {
            decrement: options.tokensUsed
          },
          tokenUsedThisMonth: {
            increment: options.tokensUsed
          }
        }
      })

      // 记录Token使用日志
      const remainingBalance = updatedUser.tokenBalance
      
      // 获取用户的订阅信息
      const userWithSubscription = await tx.user.findUnique({
        where: { id: options.userId },
        select: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })
      const planId = userWithSubscription?.subscriptions?.[0]?.planId || ''
      const token_usage = await tx.token_usage.create({
        data: {
          userId: options.userId,
          feature: options.feature,
          operation: options.operation,
          tokensConsumed: options.tokensUsed,
          tokensRemaining: remainingBalance,
          planId,
          itemCount: options.itemCount || 1,
          metadata: {
            ...(options.metadata || {}),
            description: options.description || `${options.operation} - ${options.feature}`
          },
          isBatch: options.isBatch || false,
          batchId: options.batchId
        }
      })

      return { updatedUser, token_usage }
    })

    return {
      success: true,
      remainingBalance: result.updatedUser.tokenBalance,
      usageRecord: result.token_usage
    }
  } catch (error) {
    console.error('Failed to record token usage:', error)
    throw error
  }
}

/**
 * 批量记录Token使用（用于批量操作）
 */
export async function recordBatchTokenUsage(
  userId: string,
  feature: 'BATCHOPEN' | 'SITERANK' | 'CHANGELINK',
  operation: string,
  items: Array<{
    tokensUsed: number
    description?: string
    metadata?: Record<string, any>
  }>
) {
  try {
    // 计算总Token消耗
    const totalTokens = items.reduce((sum, item) => sum + item.tokensUsed, 0)

    // 生成批次ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 检查用户Token余额和当前套餐
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        tokenBalance: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          select: { planId: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    if (user.tokenBalance < totalTokens) {
      throw new Error('Insufficient token balance')
    }

    // 使用事务处理
    const result = await prisma.$transaction(async (tx) => {
      // 更新用户Token余额
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          tokenBalance: {
            decrement: totalTokens
          },
          tokenUsedThisMonth: {
            increment: totalTokens
          }
        }
      })

      // 批量创建使用记录
      let remainingTokens = updatedUser.tokenBalance
      const planId = user.subscriptions?.[0]?.planId || ''
      const usageRecords = await tx.token_usage.createMany({
        data: items.map((item, index) => {
          remainingTokens -= item.tokensUsed
          return {
            userId,
            feature,
            operation,
            tokensConsumed: item.tokensUsed,
            tokensRemaining: remainingTokens,
            planId,
            itemCount: 1,
            metadata: {
              ...(item.metadata || {}),
              description: item.description || `${operation} - ${feature} (${index + 1}/${items.length})`
            },
            isBatch: true,
            batchId
          }
        })
      })

      // 创建批次汇总记录
      await tx.token_usage.create({
        data: {
          userId,
          feature,
          operation,
          tokensConsumed: totalTokens,
          tokensRemaining: updatedUser.tokenBalance,
          planId,
          itemCount: items.length,
          metadata: {
            batchId,
            itemCount: items.length,
            averageTokensPerItem: totalTokens / items.length,
            description: `Batch ${operation} - ${feature}`
          },
          isBatch: true,
          batchId
        }
      })

      return { updatedUser, batchId, recordCount: usageRecords.count }
    })

    return {
      success: true,
      remainingBalance: result.updatedUser.tokenBalance,
      batchId: result.batchId,
      recordCount: result.recordCount
    }
  } catch (error) {
    console.error('Failed to record batch token usage:', error)
    throw error
  }
}

/**
 * 获取用户Token使用统计
 */
export async function getTokenUsageStats(userId: string, days: number = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const [totalUsage, featureBreakdown, dailyUsage] = await Promise.all([
    // 总使用量
    prisma.token_usage.aggregate({
      where: {
        userId,
        createdAt: { gte: startDate }
      },
      _sum: { tokensConsumed: true },
      _count: true
    }),

    // 按功能分组
    prisma.token_usage.groupBy({
      by: ['feature'],
      where: {
        userId,
        createdAt: { gte: startDate }
      },
      _sum: { tokensConsumed: true },
      _count: true
    }),

    // 每日使用趋势
    (await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        SUM(tokens_consumed) as tokens,
        COUNT(*) as operations
      FROM token_usages
      WHERE 
        user_id = ${userId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `) as Array<{ date: string; tokens: number; operations: number }>
  ])

  return {
    totalTokens: totalUsage._sum.tokensConsumed || 0,
    totalOperations: totalUsage._count,
    featureBreakdown: featureBreakdown.map(item => ({
      feature: item.feature,
      tokens: item._sum.tokensConsumed || 0,
      operations: item._count
    })),
    dailyUsage
  }
}