/**
 * Token消耗服务
 * 处理Token消耗记录、批量操作合并和统计功能
 */

import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { tokenusagefeature } from '@prisma/client'

// Token消耗记录接口
export interface TokenUsageRecord {
  id: string
  userId: string
  feature: tokenusagefeature
  operation: string
  tokensConsumed: number
  itemCount: number
  batchId?: string | null
  isBatch: boolean
  metadata?: any
  createdAt: Date
}

// 批量操作接口
export interface BatchOperation {
  batchId: string
  userId: string
  feature: tokenusagefeature
  operation: string
  operations: Array<{
    metadata: any
    tokensConsumed: number
    description?: string
  }>
  description?: string
}

// Token消耗统计接口
export interface TokenUsageStats {
  totalTokens: number
  totalOperations: number
  byFeature: Record<string, {
    tokens: number
    operations: number
    lastUsed: Date
  }>
  byDate: Record<string, {
    tokens: number
    operations: number
  }>
  batchOperations: {
    count: number
    totalTokens: number
    avgBatchSize: number
  }
}

// 查询选项接口
export interface TokenUsageQueryOptions {
  userId: string
  feature?: tokenusagefeature
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
  includeBatchDetails?: boolean
}

// 批量操作详情接口
export interface BatchOperationDetails {
  batchId: string
  feature: tokenusagefeature
  operation: string
  totalTokensConsumed: number
  operationCount: number
  createdAt: Date
  operations: Array<{
    metadata: any
    tokensConsumed: number
    description: string
  }>
  summary: {
    totalTokens: number
    averageTokensPerOperation: number
    operationTypes: Record<string, number>
  }
}

export class TokenConsumptionService {
  /**
   * 记录单个Token消耗
   */
  static async recordUsage({
    userId,
    feature,
    operation,
    tokensConsumed,
    itemCount = 1,
    metadata = {}
  }: {
    userId: string
    feature: tokenusagefeature
    operation: string
    tokensConsumed: number
    itemCount?: number
    metadata?: any
  }): Promise<TokenUsageRecord> {
    try {
      const usage = await prisma.token_usage.create({
        data: {
          userId,
          feature,
          operation,
          tokensConsumed,
          itemCount,
          isBatch: false,
          metadata: {
            type: 'single_operation',
            feature,
            operation,
            description: `${feature}单个操作 - 消耗 ${tokensConsumed} Token`,
            timestamp: new Date().toISOString(),
            source: 'token_consumption_service'
          },
          // Required fields
          tokensRemaining: 0, // Will be updated by token service
          planId: 'default' // Should be fetched from user's current plan
        }
      })

      return usage as TokenUsageRecord
    } catch (error) {
      console.error('记录Token消耗失败:', error)
      throw new Error('Failed to record token usage')
    }
  }

  /**
   * 记录批量Token消耗
   */
  static async recordBatchUsage(batchOperation: BatchOperation): Promise<TokenUsageRecord> {
    const { batchId, userId, feature, operation, operations, description } = batchOperation
    
    try {
      // 计算总消耗和批量大小
      const totalTokensConsumed = operations.reduce((sum: number, op: {
        metadata: any;
        tokensConsumed: number;
        description?: string;
      }) => sum + op.tokensConsumed, 0)
      const itemCount = operations.length
      
      // 分析操作类型
      const operationTypes = operations.reduce((acc: Record<string, number>, op: {
        metadata: any;
        tokensConsumed: number;
        description?: string;
      }) => {
        const type = op.metadata?.type || 'unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      // 合并所有操作的metadata
      const combinedMetadata = {
        batchInfo: {
          totalOperations: itemCount,
          totalTokens: totalTokensConsumed,
          averageTokensPerOperation: totalTokensConsumed / itemCount,
          operationTypes
        },
        operations: operations.map((op: {
          metadata: any;
          tokensConsumed: number;
          description?: string;
        }, index: number) => ({
          index,
          tokensConsumed: op.tokensConsumed,
          metadata: op.metadata,
          description: op.description || `操作 ${index + 1}`
        }))
      }
      
      // 创建批量操作记录
      const batchUsage = await prisma.token_usage.create({
        data: {
          userId,
          feature,
          operation,
          tokensConsumed: totalTokensConsumed,
          itemCount,
          batchId,
          isBatch: true,
          metadata: combinedMetadata,
          // Required fields
          tokensRemaining: 0, // Will be updated by token service
          planId: 'default' // Should be fetched from user's current plan
        }
      })

      return batchUsage as TokenUsageRecord
    } catch (error) {
      console.error('记录批量Token消耗失败:', error)
      throw new Error('Failed to record batch token usage')
    }
  }

  /**
   * 生成批量操作ID
   */
  static generateBatchId(feature: tokenusagefeature, userId: string): string {
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    return `batch_${feature}_${userId.substring(0, 8)}_${timestamp}_${randomSuffix}`
  }

  /**
   * 开始批量操作
   */
  static async startBatchOperation({
    userId,
    feature,
    operation,
    expectedSize
  }: {
    userId: string
    feature: tokenusagefeature
    operation: string
    expectedSize?: number
  }): Promise<string> {
    const batchId = this.generateBatchId(feature, userId)
    
    console.log(`开始批量操作: ${batchId}, 用户: ${userId}, 功能: ${feature}, 操作: ${operation}, 预期大小: ${expectedSize}`)
    
    return batchId
  }

  /**
   * 完成批量操作
   */
  static async completeBatchOperation({
    batchId,
    userId,
    feature,
    operation,
    operations,
    description
  }: {
    batchId: string
    userId: string
    feature: tokenusagefeature
    operation: string
    operations: Array<{ metadata: any; tokensConsumed: number; description?: string }>
    description?: string
  }): Promise<TokenUsageRecord> {
    return this.recordBatchUsage({
      batchId,
      userId,
      feature,
      operation,
      operations,
      description
    })
  }

  /**
   * 获取用户Token消耗记录（支持批量合并显示）
   */
  static async getUserUsageHistory(options: TokenUsageQueryOptions): Promise<{
    records: TokenUsageRecord[]
    total: number
    page: number
    totalPages: number
    hasMore: boolean
  }> {
    const {
      userId,
      feature,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      includeBatchDetails = false
    } = options

    try {
      // 构建查询条件
      const where: any = { userId }
      
      if (feature) {
        where.feature = feature
      }
      
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      // 获取总数
      const total = await prisma.token_usage.count({ where })
      
      // 获取记录
      const records = await prisma.token_usage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })

      // 如果不包含批量详情，则过滤掉批量操作的详细信息
      const processedRecords = records.map((record: {
        id: string;
        userId: string;
        feature: string;
        operation: string | null;
        tokensConsumed: number;
        itemCount: number | null;
        batchId: string | null;
        isBatch: boolean;
        metadata: any;
        createdAt: Date;
      }) => {
        if (!includeBatchDetails && record.isBatch) {
          return {
            ...record,
            metadata: {
              batchInfo: (record.metadata as any)?.batchInfo,
              operationCount: record.itemCount
            }
          }
        }
        return record
      }) as TokenUsageRecord[]

      const totalPages = Math.ceil(total / limit)

      return {
        records: processedRecords,
        total,
        page,
        totalPages,
        hasMore: page < totalPages
      }
    } catch (error) {
      console.error('获取用户Token消耗记录失败:', error)
      throw new Error('Failed to get user usage history')
    }
  }

  /**
   * 获取批量操作详情
   */
  static async getBatchOperationDetails(batchId: string, userId: string): Promise<BatchOperationDetails | null> {
    try {
      const batchRecord = await prisma.token_usage.findFirst({
        where: {
          batchId,
          userId,
          isBatch: true
        }
      })

      if (!batchRecord) {
        return null
      }

      const metadata = batchRecord.metadata as any

      return {
        batchId,
        feature: batchRecord.feature as tokenusagefeature,
        operation: batchRecord.operation || '',
        totalTokensConsumed: batchRecord.tokensConsumed,
        operationCount: batchRecord.itemCount || 0,
        createdAt: batchRecord.createdAt,
        operations: metadata?.operations || [],
        summary: metadata?.batchInfo || {
          totalTokens: batchRecord.tokensConsumed,
          averageTokensPerOperation: batchRecord.itemCount ? batchRecord.tokensConsumed / batchRecord.itemCount : 0,
          operationTypes: metadata?.batchInfo?.operationTypes || {}
        }
      }
    } catch (error) {
      console.error('获取批量操作详情失败:', error)
      throw new Error('Failed to get batch operation details')
    }
  }

  /**
   * 获取用户Token消耗统计
   */
  static async getUserUsageStats({
    userId,
    startDate,
    endDate
  }: {
    userId: string
    startDate?: Date
    endDate?: Date
  }): Promise<TokenUsageStats> {
    try {
      // 构建查询条件
      const where: any = { userId }
      
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      // 获取所有记录
      const records = await prisma.token_usage.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      })

      // 计算统计数据
      const stats: TokenUsageStats = {
        totalTokens: 0,
        totalOperations: 0,
        byFeature: {},
        byDate: {},
        batchOperations: {
          count: 0,
          totalTokens: 0,
          avgBatchSize: 0
        }
      }

      let batchSizeSum = 0
      let batchCount = 0

      records.forEach((record: {
        id: string;
        userId: string;
        feature: string;
        operation: string | null;
        tokensConsumed: number;
        itemCount: number | null;
        batchId: string | null;
        isBatch: boolean;
        metadata: any;
        createdAt: Date;
      }) => {
        // 总统计
        stats.totalTokens += record.tokensConsumed
        stats.totalOperations += record.isBatch ? (record.itemCount || 0) : 1

        // 按功能统计
        if (!stats.byFeature[record.feature]) {
          stats.byFeature[record.feature] = {
            tokens: 0,
            operations: 0,
            lastUsed: record.createdAt
          }
        }
        
        stats.byFeature[record.feature].tokens += record.tokensConsumed
        stats.byFeature[record.feature].operations += record.isBatch ? (record.itemCount || 0) : 1
        
        if (record.createdAt > stats.byFeature[record.feature].lastUsed) {
          stats.byFeature[record.feature].lastUsed = record.createdAt
        }

        // 按日期统计
        const dateKey = record.createdAt.toISOString().split('T')[0]
        if (!stats.byDate[dateKey]) {
          stats.byDate[dateKey] = {
            tokens: 0,
            operations: 0
          }
        }
        
        stats.byDate[dateKey].tokens += record.tokensConsumed
        stats.byDate[dateKey].operations += record.isBatch ? (record.itemCount || 0) : 1

        // 批量操作统计
        if (record.isBatch) {
          batchCount++
          stats.batchOperations.totalTokens += record.tokensConsumed
          batchSizeSum += record.itemCount || 0
        }
      })

      // 计算批量操作平均值
      stats.batchOperations.count = batchCount
      stats.batchOperations.avgBatchSize = batchCount > 0 ? batchSizeSum / batchCount : 0

      return stats
    } catch (error) {
      console.error('获取用户Token消耗统计失败:', error)
      return {
        totalTokens: 0,
        totalOperations: 0,
        byFeature: {},
        byDate: {},
        batchOperations: {
          count: 0,
          totalTokens: 0,
          avgBatchSize: 0
        }
      }
    }
  }

  /**
   * 检查是否应该合并为批量操作
   */
  static shouldMergeToBatch(operations: Array<{ feature: string; operation: string; createdAt: Date }>): boolean {
    if (operations.length < 2) return false
    
    // 检查是否是相同功能和操作
    const firstOp = operations[0]
    const sameFeatureAction = operations.every((op: { feature: string; operation: string; createdAt: Date }) => 
      op.feature === firstOp.feature && op.operation === firstOp.operation
    )
    
    if (!sameFeatureAction) return false
    
    // 检查时间间隔（5分钟内的操作可以合并）
    const timeWindow = 5 * 60 * 1000 // 5分钟
    const timestamps = operations.map((op: { feature: string; operation: string; createdAt: Date }) => op.createdAt.getTime()).sort()
    const timeSpan = timestamps[timestamps.length - 1] - timestamps[0]
    
    return timeSpan <= timeWindow
  }

  /**
   * 格式化使用记录描述
   */
  static formatUsageDescription(record: TokenUsageRecord): string {
    if (record.isBatch && record.itemCount) {
      const featureNames: Record<string, string> = {
        'siterank': 'SiteRank域名分析',
        'batchopen': 'BatchOpen批量访问',
        'adscenter': 'AdsCenter链接替换'
      }
      
      const featureName = featureNames[record.feature] || record.feature
      return `${featureName} - 批量操作 ${record.itemCount} 项，消耗 ${record.tokensConsumed} Token`
    }
    
    const metadata = record.metadata as any
    return metadata?.description || `${record.feature}操作 - 消耗 ${record.tokensConsumed} Token`
  }
}
