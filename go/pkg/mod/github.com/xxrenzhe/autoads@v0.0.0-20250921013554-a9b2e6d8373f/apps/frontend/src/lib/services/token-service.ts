import { prisma } from '@/lib/db'
import { PermissionService } from './permission-service'
import { TokenConsumptionService } from './token-consumption-service'
import { TokenConfigService } from './token-config-service'
import { TokenPriorityService } from './token-priority-service'
import { TokenRuleEngine } from './token-rule-engine'
import { getRedisClient } from '@/lib/cache/redis-client'
import { $Enums } from '@prisma/client'

type TokenType = $Enums.TokenType
type TokenUsageFeature = $Enums.tokenusagefeature

export interface TokenBalance {
  userId: string
  balance: number
  lastUpdated: Date
}

export interface TokenConsumption {
  userId: string
  feature: string
  amount: number
  success: boolean
  timestamp: Date
}

export interface TokenUsageStats {
  totalConsumed: number
  byFeature: Record<string, number>
  recentUsage: TokenConsumption[]
}

export interface TokenResetRequest {
  userId: string
  newBalance: number
  reason: string
  resetBy: string
}

export interface TokenTransaction {
  id: string
  userId: string
  feature: string
  action: string
  amount: number
  balance: number
  timestamp: Date
  metadata?: any
}

export interface FeatureUsageResult {
  feature: string
  _sum: { amount: number | null }
}

export interface UserUsageResult {
  userId: string
  _sum: { amount: number | null }
}

export interface TokenUsageRecord {
  feature: string
  operation: string | null
  tokensConsumed: number
  createdAt: Date
  itemCount: number | null
  metadata: any
}

export interface LowBalanceUser {
  id: string
  email: string
  name: string | null
  tokenBalance: number
  token_usage: { createdAt: Date }[]
}

export class TokenService {
  // Standard error codes for token deductions
  static readonly ErrorCodes = {
    INSUFFICIENT_TOKENS: 'INSUFFICIENT_TOKENS',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    TOKEN_CONSUME_FAILED: 'TOKEN_CONSUME_FAILED',
  } as const

  // Normalize incoming feature strings to Prisma enum-compatible values
  private static normalizeFeature(feature: string): TokenUsageFeature {
    const f = (feature || '').toLowerCase()
    // 显式映射，统一特征标识
    const map: Record<string, TokenUsageFeature> = {
      siterank: 'SITERANK',
      batchopen: 'BATCHOPEN',
      adscenter: 'CHANGELINK',
    }
    return map[f] || 'OTHER'
  }

  // Resolve total cost for an action; applies rule engine for AdsCenter
  private static async resolveTotalCost(
    feature: TokenUsageFeature,
    action: string,
    batchSize: number,
    customAmount?: number,
    hasExplicitOperations?: boolean
  ): Promise<{ total: number; unit: number }>{
    // If explicit per-op amounts are provided by caller, trust them
    if (!Number.isNaN(customAmount as number) && customAmount !== undefined) {
      return { total: (customAmount as number) * Math.max(1, batchSize), unit: customAmount as number }
    }

    const isBatch = batchSize > 1
    if (feature === 'CHANGELINK') {
      const per = await TokenRuleEngine.calcAdsCenterCost((action as any) || 'update_ad', 1, false)
      const total = hasExplicitOperations ? per * Math.max(1, batchSize) : await TokenRuleEngine.calcAdsCenterCost((action as any) || 'update_ad', Math.max(1, batchSize), isBatch)
      return { total, unit: per }
    }

    // Fallback to generic token config for known features
    const cfg = new TokenConfigService()
    // Map enum -> config feature keys
    const featureKey = feature === 'SITERANK' ? 'siterank' : feature === 'BATCHOPEN' ? 'batchopen' : 'adscenter'
    const per = await cfg.calculateTokenCost(featureKey as any, 1, false)
    const total = await cfg.calculateTokenCost(featureKey as any, Math.max(1, batchSize), isBatch)
    return { total, unit: per }
  }
  /**
   * 获取用户Token余额
   */
  static async getTokenBalance(userId: string): Promise<TokenBalance | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          tokenBalance: true,
          updatedAt: true
        }
      })

      if (!user) {
        return null
      }

      return {
        userId: user.id,
        balance: user.tokenBalance,
        lastUpdated: user.updatedAt
      }
    } catch (error) {
      console.error('Failed to get token balance:', error)
      return null
    }
  }

  /**
   * 检查Token余额是否足够
   */
  static async checkTokenBalance(userId: string, requiredAmount: number): Promise<{
    sufficient: boolean
    currentBalance: number
    required: number
  }> {
    try {
      const balance = await this.getTokenBalance(userId)
      
      if (!balance) {
        return {
          sufficient: false,
          currentBalance: 0,
          required: requiredAmount
        }
      }

      return {
        sufficient: balance.balance >= requiredAmount,
        currentBalance: balance.balance,
        required: requiredAmount
      }
    } catch (error) {
      console.error('Failed to check token balance:', error)
      return {
        sufficient: false,
        currentBalance: 0,
        required: requiredAmount
      }
    }
  }

  /**
   * 消耗Token（支持批量操作）
   */
  static async consumeTokens(
    userId: string,
    feature: string,
    action: string,
    options: {
      batchSize?: number
      metadata?: any
      customAmount?: number
      batchId?: string
      operations?: Array<{ metadata: any; amount: number; description?: string }>
    } = {}
  ): Promise<{
    success: boolean
    newBalance?: number
    tokensConsumed?: number
    batchId?: string
    error?: string
    errorCode?: string
  }> {
    try {
      // Normalize feature to Prisma enum
      const featureEnum = this.normalizeFeature(feature)

      const batchSize = options.batchSize || (options.operations ? options.operations.length : 1)
      const { total: totalAmount, unit: unitCost } = await this.resolveTotalCost(
        featureEnum,
        action,
        batchSize,
        options.customAmount,
        !!options.operations
      )

      // 检查余额
      const balanceCheck = await this.checkTokenBalance(userId, totalAmount)
      
      if (!balanceCheck.sufficient) {
        // 记录失败的消耗尝试
        await this.logTokenUsage(userId, feature, action, totalAmount, balanceCheck.currentBalance, false, options)
        
        return {
          success: false,
          error: `Insufficient token balance. Required: ${totalAmount}, Available: ${balanceCheck.currentBalance}`,
          errorCode: this.ErrorCodes.INSUFFICIENT_TOKENS
        }
      }

      // 使用TokenPriorityService按优先级消耗Token
      const priorityResult = await TokenPriorityService.consumeTokensWithPriority(
        userId,
        totalAmount,
        featureEnum.toLowerCase(),
        action,
        options.metadata
      )

      const result = priorityResult.newBalance

      // 判断是否为批量操作并记录相应的使用记录
      let batchId: string | undefined
      
      if (batchSize > 1 || options.operations) {
        // 批量操作
        batchId = options.batchId || TokenConsumptionService.generateBatchId(featureEnum, userId)
        
        let operations: Array<{ metadata: any; tokensConsumed: number; description?: string }>
        if (options.operations) {
          operations = options.operations.map((op) => ({
            metadata: op.metadata,
            tokensConsumed: op.amount,
            description: op.description
          }))
        } else {
          // 根据总额平摊到每个子操作，确保合计=总扣减
          const base = Math.floor(totalAmount / batchSize)
          const remainder = totalAmount - base * batchSize
          operations = Array.from({ length: batchSize }).map((_, i) => ({
            metadata: { ...options.metadata, index: i + 1 },
            tokensConsumed: base + (i < remainder ? 1 : 0),
            description: `${feature}操作 ${i + 1}`
          }))
        }
        
        // 此时 operations 的 tokensConsumed 求和等于 totalAmount

        await TokenConsumptionService.recordBatchUsage({
          batchId,
          userId,
          feature: featureEnum,
          operation: action,
          operations
        })
      } else {
        // 单个操作
        await TokenConsumptionService.recordUsage({
          userId,
          feature: featureEnum,
          operation: action,
          tokensConsumed: totalAmount,
          metadata: options.metadata
        })
      }

      // 记录成功的消耗
      await this.logTokenUsage(userId, feature, action, totalAmount, result, true, options)

      // 检查是否需要发送低余额通知
      await this.checkAndNotifyLowBalance(userId, result)

      // 发布事件：余额已更新（事件驱动刷新）
      try {
        try { const redis = getRedisClient(); await redis.publish('token:balance:updated', JSON.stringify({ userId, balance: result, consumed: totalAmount })); } catch {}
      } catch {}

      return {
        success: true,
        newBalance: result,
        tokensConsumed: totalAmount,
        batchId
      }
    } catch (error) {
      console.error('Failed to consume tokens:', error)
      return {
        success: false,
        error: 'Failed to consume tokens',
        errorCode: this.ErrorCodes.TOKEN_CONSUME_FAILED
      }
    }
  }

  /**
   * 获取用户套餐信息
   */
  private static async getUserPlanInfo(userId: string) {
    try {
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

      return {
        currentBalance: user.tokenBalance,
        planId: user.subscriptions?.[0]?.planId || ''
      }
    } catch (error) {
      console.error('Failed to get user plan info:', error)
      return {
        currentBalance: 0,
        planId: ''
      }
    }
  }

  /**
   * 添加Token（管理员功能）
   */
  static async addTokens(
    userId: string,
    amount: number,
    reason: string,
    addedBy: string,
    tokenType: TokenType = 'BONUS'
  ): Promise<{
    success: boolean
    newBalance?: number
    error?: string
  }> {
    try {
      // 检查操作者权限
      const hasPermission = await PermissionService.hasPermission(addedBy, 'users', 'write')
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to add tokens'
        }
      }

      // Use TokenExpirationService to add tokens with proper expiration handling
      const { TokenExpirationService } = await import('./token-expiration-service');
      await TokenExpirationService.addTokensWithExpiration(
        userId,
        amount,
        tokenType,
        undefined,
        {
          reason,
          addedBy,
          timestamp: new Date().toISOString()
        }
      );

      // Get updated user and plan info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tokenBalance: true }
      });

      const planInfo = await this.getUserPlanInfo(userId)

      // 记录Token添加
      await prisma.token_usage.create({
        data: {
          userId,
          feature: 'ADMIN',
          operation: 'admin_add',
          tokensConsumed: amount,
          tokensRemaining: user?.tokenBalance || 0,
          planId: planInfo.planId,
          itemCount: 1,
          metadata: {
            action: 'add_tokens',
            reason,
            addedBy,
            tokenType,
            timestamp: new Date().toISOString()
          }
        }
      })

      // 记录管理员操作
      await prisma.userActivity.create({
        data: {
          userId,
          action: 'tokens_added',
          resource: 'tokens',
          metadata: {
            amount,
            reason,
            addedBy,
            tokenType,
            newBalance: user?.tokenBalance || 0,
            timestamp: new Date().toISOString()
          }
        }
      })

      // 事件通知：余额更新
      try {
        try { const redis = getRedisClient(); await redis.publish('token:balance:updated', JSON.stringify({ userId, balance: user?.tokenBalance || 0 })); } catch {}
      } catch {}

      return {
        success: true,
        newBalance: user?.tokenBalance || 0
      }
    } catch (error) {
      console.error('Failed to add tokens:', error)
      return {
        success: false,
        error: 'Failed to add tokens'
      }
    }
  }

  /**
   * 重置Token余额（管理员功能）
   */
  static async resetTokenBalance(request: TokenResetRequest): Promise<{
    success: boolean
    newBalance?: number
    error?: string
  }> {
    try {
      // 检查操作者权限
      const hasPermission = await PermissionService.hasPermission(request.resetBy, 'users', 'write')
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to reset token balance'
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: request.userId },
        data: {
          tokenBalance: request.newBalance
        },
        select: { tokenBalance: true }
      })

      const planInfo = await this.getUserPlanInfo(request.userId)

      // 记录Token重置
      await prisma.token_usage.create({
        data: {
          userId: request.userId,
          feature: 'ADMIN',
          operation: 'reset_balance',
          tokensConsumed: request.newBalance,
          tokensRemaining: updatedUser.tokenBalance,
          planId: planInfo.planId,
          itemCount: 1,
          metadata: {
            reason: request.reason,
            resetBy: request.resetBy,
            timestamp: new Date().toISOString()
          }
        }
      })

      // 记录管理员操作
      await prisma.userActivity.create({
        data: {
          userId: request.userId,
          action: 'tokens_reset',
          resource: 'tokens',
          metadata: {
            newBalance: request.newBalance,
            reason: request.reason,
            resetBy: request.resetBy,
            timestamp: new Date().toISOString()
          }
        }
      })

      // 事件通知：余额更新
      try {
        try { const redis = getRedisClient(); await redis.publish('token:balance:updated', JSON.stringify({ userId: request.userId, balance: updatedUser.tokenBalance })); } catch {}
      } catch {}

      return {
        success: true,
        newBalance: updatedUser.tokenBalance
      }
    } catch (error) {
      console.error('Failed to reset token balance:', error)
      return {
        success: false,
        error: 'Failed to reset token balance'
      }
    }
  }

  /**
   * 获取Token使用统计
   */
  static async getTokenUsageStats(
    userId: string,
    timeRange?: {
      start: Date
      end: Date
    }
  ): Promise<TokenUsageStats> {
    try {
      const whereClause: {
        userId: string
        timestamp?: { gte: Date; lte: Date }
      } = { userId }
      
      if (timeRange) {
        whereClause.timestamp = {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }

      const [totalUsage, featureUsage, recentUsage] = await Promise.all([
        // 总消耗量
        prisma.token_usage.aggregate({
          where: whereClause,
          _sum: { tokensConsumed: true }
        }),
        
        // 按功能分组的使用量
        prisma.token_usage.groupBy({
          by: ['feature'],
          where: whereClause,
          _sum: { tokensConsumed: true }
        }),
        
        // 最近的使用记录
        prisma.token_usage.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            feature: true,
            operation: true,
            tokensConsumed: true,
            createdAt: true,
            itemCount: true,
            metadata: true
          }
        })
      ])

      // 转换功能使用数据
      const byFeature = featureUsage.reduce((acc, item) => {
        acc[item.feature] = item._sum.tokensConsumed || 0
        return acc
      }, {} as Record<string, number>)

      // 转换最近使用数据
      const recentConsumption: TokenConsumption[] = recentUsage.map((usage) => ({
        userId,
        feature: usage.feature,
        amount: usage.tokensConsumed,
        success: true,
        timestamp: usage.createdAt
      }))

      return {
        totalConsumed: totalUsage._sum?.tokensConsumed || 0,
        byFeature,
        recentUsage: recentConsumption
      }
    } catch (error) {
      console.error('Failed to get token usage stats:', error)
      return {
        totalConsumed: 0,
        byFeature: {},
        recentUsage: []
      }
    }
  }

  /**
   * 获取系统Token使用统计（管理员功能）
   */
  static async getSystemTokenStats(
    timeRange?: {
      start: Date
      end: Date
    }
  ): Promise<{
    totalUsers: number
    totalConsumed: number
    averagePerUser: number
    topFeatures: Array<{ feature: string; usage: number }>
    topUsers: Array<{ userId: string; usage: number }>
  }> {
    try {
      const whereClause: {
        createdAt?: { gte: Date; lte: Date }
      } = {}
      
      if (timeRange) {
        whereClause.createdAt = {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }

      const [totalStats, featureStats, userStats, uniqueUsers] = await Promise.all([
        // 总统计
        prisma.token_usage.aggregate({
          where: whereClause,
          _sum: { tokensConsumed: true },
          _count: { userId: true }
        }),
        
        // 功能统计
        prisma.token_usage.groupBy({
          by: ['feature'],
          where: whereClause,
          _sum: { tokensConsumed: true },
          orderBy: { _sum: { tokensConsumed: 'desc' } },
          take: 10
        }),
        
        // 用户统计
        prisma.token_usage.groupBy({
          by: ['userId'],
          where: whereClause,
          _sum: { tokensConsumed: true },
          orderBy: { _sum: { tokensConsumed: 'desc' } },
          take: 10
        }),
        
        // 唯一用户数
        prisma.token_usage.findMany({
          where: whereClause,
          select: { userId: true },
          distinct: ['userId']
        })
      ])

      const totalConsumed = totalStats._sum?.tokensConsumed || 0
      const totalUsers = uniqueUsers.length
      const averagePerUser = totalUsers > 0 ? totalConsumed / totalUsers : 0

      const topFeatures = featureStats.map((item) => ({
        feature: item.feature,
        usage: item._sum?.tokensConsumed || 0
      }))

      const topUsers = userStats.map((item) => ({
        userId: item.userId,
        usage: item._sum?.tokensConsumed || 0
      }))

      return {
        totalUsers,
        totalConsumed,
        averagePerUser,
        topFeatures,
        topUsers
      }
    } catch (error) {
      console.error('Failed to get system token stats:', error)
      return {
        totalUsers: 0,
        totalConsumed: 0,
        averagePerUser: 0,
        topFeatures: [],
        topUsers: []
      }
    }
  }

  /**
   * 获取Token消耗配置（从数据库读取）
   */
  static async getTokenCosts(): Promise<Record<string, Record<string, number>>> {
    try {
      // tokenConfig model doesn't exist in schema - using default costs
      const configs: any[] = []

      const costs: Record<string, Record<string, number>> = {}
      
      configs.forEach((config) => {
        if (!costs[config.feature]) {
          costs[config.feature] = {}
        }
        costs[config.feature][config.action] = config.cost
      })

      // 如果没有配置，返回默认值
      if (Object.keys(costs).length === 0) {
        return {
          siterank: { domain_analysis: 1 },
          batchopen: { url_access: 1 },
          adscenter: { link_replace: 2 }
        }
      }

      return costs
    } catch (error) {
      console.error('Failed to get token costs:', error)
      // 返回默认配置
      return {
        siterank: { domain_analysis: 1 },
        batchopen: { url_access: 1 },
        adscenter: { link_replace: 2 }
      }
    }
  }

  /**
   * 获取特定功能和操作的Token消耗
   */
  static async getTokenCost(feature: string, action: string): Promise<number> {
    // Deprecated in favor of resolveTotalCost; keep minimal compatibility
    const featureEnum = this.normalizeFeature(feature)
    const { unit } = await this.resolveTotalCost(featureEnum, action, 1)
    return unit
  }

  /**
   * 获取所有功能的Token消耗配置
   */
  static getFeatureTokenCosts(): Record<string, number> {
    // Default token costs for different features
    return {
      siterank: 1,
      batchopen: 2,
      adscenter: 1,
      analytics: 1,
      monitoring: 1,
      backup: 5,
      export: 2,
      import: 3
    }
  }

  /**
   * 检查功能Token消耗并扣除
   */
  static async checkAndConsumeTokens(
    userId: string,
    feature: string,
    action: string,
    options: {
      batchSize?: number
      metadata?: any
    } = {}
  ): Promise<{
    success: boolean
    consumed: number
    newBalance?: number
    batchId?: string
    error?: string
    errorCode?: string
  }> {
    const result = await this.consumeTokens(userId, feature, action, options)
    
    return {
      success: result.success,
      consumed: result.tokensConsumed || 0,
      newBalance: result.newBalance,
      batchId: result.batchId,
      error: result.error,
      errorCode: result.errorCode
    }
  }

  /**
   * 批量操作Token消耗
   */
  static async consumeBatchTokens(
    userId: string,
    feature: string,
    action: string,
    operations: Array<{
      metadata: any
      description?: string
    }>
  ): Promise<{
    success: boolean
    batchId?: string
    totalConsumed: number
    newBalance?: number
    error?: string
    errorCode?: string
  }> {
    try {
      // 获取单位消耗
      const unitCost = await this.getTokenCost(feature, action)
      
      // 准备批量操作数据
      const batchOperations = operations.map((op: {
        metadata: any;
        description?: string;
      }) => ({
        ...op,
        amount: unitCost
      }))
      
      const result = await this.consumeTokens(userId, feature, action, {
        batchSize: operations.length,
        operations: batchOperations
      })

      return {
        success: result.success,
        batchId: result.batchId,
        totalConsumed: result.tokensConsumed || 0,
        newBalance: result.newBalance,
        error: result.error,
        errorCode: result.errorCode
      }
    } catch (error) {
      console.error('批量Token消耗失败:', error)
      return {
        success: false,
        totalConsumed: 0,
        error: 'Failed to consume batch tokens',
        errorCode: this.ErrorCodes.TOKEN_CONSUME_FAILED
      }
    }
  }

  /**
   * 获取用户Token使用历史（使用新的TokenConsumptionService）
   */
  static async getUserTokenHistory(
    userId: string,
    options: {
      feature?: string
      startDate?: Date
      endDate?: Date
      page?: number
      limit?: number
      includeBatchDetails?: boolean
    } = {}
  ) {
    // Convert string feature to TokenUsageFeature enum if provided
    const featureEnum = options.feature ? options.feature.toUpperCase() as TokenUsageFeature : undefined
    
    return TokenConsumptionService.getUserUsageHistory({
      userId,
      feature: featureEnum,
      startDate: options.startDate,
      endDate: options.endDate,
      page: options.page,
      limit: options.limit,
      includeBatchDetails: options.includeBatchDetails
    })
  }

  /**
   * 获取批量操作详情
   */
  static async getBatchOperationDetails(batchId: string, userId: string) {
    return TokenConsumptionService.getBatchOperationDetails(batchId, userId)
  }

  /**
   * 记录Token使用日志
   */
  private static async logTokenUsage(
    userId: string,
    feature: string,
    action: string,
    amount: number,
    balance: number,
    success: boolean,
    options: {
      batchSize?: number
      metadata?: any
    } = {}
  ): Promise<void> {
    try {
      await prisma.userActivity.create({
        data: {
          userId,
          action: success ? 'token_consumed' : 'token_consumption_failed',
          resource: 'tokens',
          metadata: {
            feature,
            tokenAction: action,
            amount,
            balance,
            success,
            batchSize: options.batchSize,
            operationMetadata: options.metadata,
            timestamp: new Date().toISOString()
          }
        }
      })
    } catch (error) {
      console.error('Failed to log token usage:', error)
    }
  }

  /**
   * 批量重置用户Token（管理员功能）
   */
  static async batchResetTokens(
    userIds: string[],
    newBalance: number,
    reason: string,
    resetBy: string
  ): Promise<{
    success: boolean
    updated: number
    failed: string[]
    error?: string
  }> {
    try {
      // 检查操作者权限
      const hasPermission = await PermissionService.hasPermission(resetBy, 'users', 'admin')
      if (!hasPermission) {
        return {
          success: false,
          updated: 0,
          failed: userIds,
          error: 'Insufficient permissions for batch token reset'
        }
      }

      const failed: string[] = []
      let updated = 0

      for (const userId of userIds) {
        try {
          const result = await this.resetTokenBalance({
            userId,
            newBalance,
            reason,
            resetBy
          })

          if (result.success) {
            updated++
          } else {
            failed.push(userId)
          }
        } catch (error) {
          console.error(`Failed to reset tokens for user ${userId}:`, error)
          failed.push(userId)
        }
      }

      return {
        success: failed.length === 0,
        updated,
        failed
      }
    } catch (error) {
      console.error('Failed to batch reset tokens:', error)
      return {
        success: false,
        updated: 0,
        failed: userIds,
        error: 'Batch token reset failed'
      }
    }
  }

  /**
   * 检查单个用户的余额并发送通知（如果需要）
   */
  private static async checkAndNotifyLowBalance(userId: string, currentBalance: number): Promise<void> {
    try {
      const lowBalanceThreshold = 5 // 当余额低于5时发送通知
      const depletedThreshold = 0   // 当余额为0时发送耗尽通知

      if (currentBalance === depletedThreshold) {
        // 发送Token耗尽通知 - notification system removed for performance optimization
        // const { NotificationService } = await import('./notification-service')
        // await NotificationService.sendNotification({
        //   userId,
        //   template: 'TOKEN_DEPLETED'
        // })
      } else if (currentBalance <= lowBalanceThreshold) {
        // 获取用户邮箱用于查询通知
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true }
        })

        if (!user) return

        // 检查是否最近已经发送过低余额通知
        const recentNotification = await prisma.notification_logs.findFirst({
          where: {
            notification_templates: {
              name: 'LOW_TOKEN_BALANCE'
            },
            users: {
              email: user.email
            },
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时内
            }
          }
        })

        if (!recentNotification) {
          // Notification system removed for performance optimization
          // const { NotificationService } = await import('./notification-service')
          // await NotificationService.sendNotification({
          //   userId,
          //   template: 'LOW_TOKEN_BALANCE'
          // })
        }
      }
    } catch (error) {
      console.error('Failed to check and notify low balance:', error)
      // 不要让通知失败影响主要的Token消耗流程
    }
  }

  /**
   * 获取低Token余额用户列表（管理员功能）
   */
  static async getLowBalanceUsers(threshold: number = 10): Promise<Array<{
    userId: string
    email: string
    name: string | null
    balance: number
    lastUsed: Date | null
  }>> {
    try {
      const users = await prisma.user.findMany({
        where: {
          tokenBalance: {
            lte: threshold
          },
          status: 'ACTIVE'
        },
        select: {
          id: true,
          email: true,
          name: true,
          tokenBalance: true,
          token_usage: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true }
          }
        },
        orderBy: { tokenBalance: 'asc' }
      })

      return users.map((user) => ({
        userId: user.id,
        email: user.email,
        name: user.name,
        balance: user.tokenBalance,
        lastUsed: (user as any).token_usage?.[0]?.createdAt || null
      }))
    } catch (error) {
      console.error('Failed to get low balance users:', error)
      return []
    }
  }

  /**
   * 授予Token（管理员功能）
   */
  static async grantTokens(
    userId: string,
    amount: number,
    reason: string = 'Admin grant',
    grantedBy: string
  ): Promise<{
    success: boolean
    newBalance?: number
    error?: string
  }> {
    try {
      if (amount <= 0) {
        return {
          success: false,
          error: 'Amount must be positive'
        }
      }

      const result = await this.addTokens(userId, amount, reason, grantedBy)
      return result
    } catch (error) {
      console.error('Failed to grant tokens:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      }
    }
  }

  /**
   * 补充Token（重置到指定数量或添加指定数量）
   */
  static async replenishTokens(
    userId: string,
    amount?: number,
    resetToAmount?: number
  ): Promise<{
    success: boolean
    newBalance?: number
    error?: string
  }> {
    try {
      if (resetToAmount !== undefined) {
        // 重置到指定数量
        const result = await this.resetTokenBalance({
          userId,
          newBalance: resetToAmount,
          reason: 'Token replenishment (reset)',
          resetBy: 'system'
        })
        return result
      } else if (amount !== undefined && amount > 0) {
        // 添加指定数量
        const result = await this.addTokens(userId, amount, 'Token replenishment (add)', 'system')
        return result
      } else {
        return {
          success: false,
          error: 'Either amount or resetToAmount must be specified'
        }
      }
    } catch (error) {
      console.error('Failed to replenish tokens:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      }
    }
  }
}
