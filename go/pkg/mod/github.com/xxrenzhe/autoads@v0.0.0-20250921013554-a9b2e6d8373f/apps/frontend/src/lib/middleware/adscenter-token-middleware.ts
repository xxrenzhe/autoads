/**
 * AdsCenter Token消耗中间件（兼容旧 AdsCenter 名称）
 * 为 AdsCenter 功能添加增强的 Token 消耗记录，同时保持现有功能不变
 */

import { NextRequest, NextResponse } from 'next/server'
import { TokenService } from '@/lib/services/token-service'
import { auth } from '@/lib/auth/v5-config'

export interface AdsCenterTokenOptions {
  extractLinkCount?: (request: NextRequest, body?: any) => number | Promise<number>
  extractOperationType?: (request: NextRequest, body?: any) => string | Promise<string>
  extractMetadata?: (request: NextRequest, body?: any) => any | Promise<any>
  skipTokenConsumption?: (request: NextRequest, body?: any) => boolean | Promise<boolean>
  onTokenConsumed?: (result: any, tokenResult: any) => void | Promise<void>
  onTokenError?: (error: any) => void | Promise<void>
}

/**
 * 为 AdsCenter API 添加 Token 消耗记录的中间件
 * 注意：这个中间件不会阻止现有功能，只是记录Token消耗
 */
export function withAdsCenterTokenTracking(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  options: AdsCenterTokenOptions = {}
) {
  return async function(request: NextRequest, ...args: any[]): Promise<NextResponse> {
    let tokenResult: any = null
    
    try {
      // 获取用户会话
      const session = await auth()
      
      // 如果没有会话，直接调用原始处理器
      if (!session?.user?.id) {
        return handler(request, ...args)
      }

      const userId = session.user.id
      let body: any = null
      
      // 如果是POST请求，尝试解析body
      if (request.method === 'POST') {
        try {
          const clonedRequest = request.clone()
          body = await clonedRequest.json()
        } catch (error) {
          // 如果解析失败，继续执行
        }
      }

      // 检查是否跳过Token消耗
      if (options.skipTokenConsumption) {
        const shouldSkip = await options.skipTokenConsumption(request, body)
        if (shouldSkip) {
          return handler(request, ...args)
        }
      }

      // 提取操作类型（规则式：extract_link / update_ad）
      let operationType: 'extract_link' | 'update_ad' = 'update_ad'
      if (options.extractOperationType) {
        operationType = (await options.extractOperationType(request, body)) as 'extract_link' | 'update_ad'
      } else if (body?.type) {
        // 尝试从URL或body推断：只分两类 extract_link / update_ad
        try {
          const url = new URL(request.url)
          const action = (url.searchParams.get('action') || body.action || '').toString().toLowerCase()
          const type = (body.type || '').toString().toLowerCase()
          const looksLikeExtract = action.includes('extract') || type.includes('extract') || Array.isArray(body?.data?.originalLinks)
          operationType = looksLikeExtract ? 'extract_link' : 'update_ad'
        } catch {
          operationType = 'update_ad'
        }
      }

      // 提取链接数量或操作数量
      let operationCount = 1
      if (options.extractLinkCount) {
        operationCount = await options.extractLinkCount(request, body)
      } else if (body) {
        // 根据不同的操作类型计算操作数量
        if (body.type === 'configuration' && body.data?.originalLinks) {
          operationCount = Array.isArray(body.data.originalLinks) ? body.data.originalLinks.length : 1
        } else if (body.type === 'association' && body.data?.affiliateLinkId) {
          operationCount = 1 // 关联操作算作1个操作
        } else if (body.data?.adMappingConfig && Array.isArray(body.data.adMappingConfig)) {
          // 广告映射配置中的链接数量
          operationCount = body.data.adMappingConfig.length
        }
      }

      // 提取元数据
      let metadata: any = {}
      if (options.extractMetadata) {
        metadata = await options.extractMetadata(request, body)
      } else {
        metadata = {
          operationType: body?.type || 'unknown',
          action: body?.action || 'unknown',
          operationCount,
          endpoint: request.url,
          method: request.method,
          userAgent: request.headers.get('user-agent'),
          timestamp: new Date().toISOString()
        }

        // 添加具体的操作信息
        if (body) {
          if (body.type === 'configuration') {
            metadata.configurationName = body.data?.name
            metadata.environmentId = body.data?.environmentId
            metadata.repeatCount = body.data?.repeatCount
          } else if (body.type === 'association') {
            metadata.googleAdsAccountId = body.data?.googleAdsAccountId
            metadata.affiliateLinkId = body.data?.affiliateLinkId
            metadata.adsPowerEnvironmentId = body.data?.adsPowerEnvironmentId
          } else if (body.type === 'test-connection') {
            metadata.testType = body.action
            metadata.targetId = body.data?.accountId || body.data?.environmentId || body.data?.linkId
          }
        }
      }

      // 记录Token消耗
      if (operationCount > 1) {
        // 批量操作
        const operations: Array<{ metadata: any; description: string }> = []
        for (let i = 0; i < operationCount; i++) {
          operations.push({
            metadata: {
              ...metadata,
              operationIndex: i,
              operationDescription: `AdsCenter操作 ${i + 1}/${operationCount}`,
              timestamp: new Date().toISOString()
            },
            description: `AdsCenter ${operationType} - 操作 ${i + 1}/${operationCount}`
          })
        }

        tokenResult = await TokenService.consumeBatchTokens(
          userId,
          'adscenter',
          operationType,
          operations
        )
      } else {
        // 单个操作
        tokenResult = await TokenService.checkAndConsumeTokens(
          userId,
          'adscenter',
          operationType,
          {
            metadata: {
              ...metadata,
              endpoint: request.url,
              method: request.method,
              userAgent: request.headers.get('user-agent'),
              timestamp: new Date().toISOString()
            }
          }
        )
      }

      // 如果Token消耗失败，记录但不阻止执行（保持向后兼容）
      if (!tokenResult.success) {
        console.warn('AdsCenter Token消耗失败，但继续执行以保持兼容性:', tokenResult.error)
        
        if (options.onTokenError) {
          await options.onTokenError(tokenResult.error)
        }
      } else {
        console.log('AdsCenter Token消耗成功:', {
          consumed: tokenResult.consumed || tokenResult.totalConsumed,
          newBalance: tokenResult.newBalance,
          batchId: tokenResult.batchId,
          operationType,
          operationCount
        })
        
        if (options.onTokenConsumed) {
          await options.onTokenConsumed({}, tokenResult)
        }
      }

    } catch (error) {
      console.error('AdsCenter Token消耗中间件错误:', error)
      // 不阻止原始功能执行
    }

    // 调用原始处理器
    const response = await handler(request, ...args)
    
    // 在响应头中添加Token信息（如果Token消耗成功）
    if (tokenResult?.success) {
      const headers = new Headers(response.headers)
      headers.set('X-Tokens-Consumed', (tokenResult.consumed || tokenResult.totalConsumed || 0).toString())
      headers.set('X-Token-Balance', tokenResult.newBalance?.toString() || '0')
      if (tokenResult.batchId) {
        headers.set('X-Batch-Id', tokenResult.batchId)
      }

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    }

    // 扣减失败时，附加统一错误码便于前端引导购买/续订
    if (tokenResult && !tokenResult.success && tokenResult.errorCode) {
      const headers = new Headers(response.headers)
      headers.set('X-Error-Code', tokenResult.errorCode)
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    }

    return response
  }
}

/**
 * 从请求体中提取链接数量
 */
export function extractAdsCenterCount(request: NextRequest, body: any): number {
  if (!body) return 1

  // 根据操作类型计算操作数量
  if (body.type === 'configuration' && body.data?.originalLinks) {
    return Array.isArray(body.data.originalLinks) ? body.data.originalLinks.length : 1
  }
  
  if (body.data?.adMappingConfig && Array.isArray(body.data.adMappingConfig)) {
    return body.data.adMappingConfig.length
  }

  return 1
}

/**
 * 从请求体中提取操作类型
 */
export function extractAdsCenterOperationType(request: NextRequest, body: any): string {
  if (!body) return 'update_ad'
  try {
    const url = new URL(request.url)
    const action = (url.searchParams.get('action') || body.action || '').toString().toLowerCase()
    const type = (body.type || '').toString().toLowerCase()
    if (action.includes('extract') || type.includes('extract')) {
      return 'extract_link'
    }
  } catch {}
  return 'update_ad'
}

/**
 * 从请求体中提取 AdsCenter 元数据
 */
export function extractAdsCenterMetadata(request: NextRequest, body: any): any {
  const metadata: any = {
    endpoint: request.url,
    method: request.method,
    userAgent: request.headers.get('user-agent')
  }

  if (body) {
    metadata.operationType = body.type
    metadata.action = body.action
    metadata.id = body.id

    // 根据操作类型添加特定元数据
    switch (body.type) {
      case 'google-ads-account':
        metadata.accountName = body.data?.name
        metadata.customerId = body.data?.customerId
        break
      case 'affiliate-link':
        metadata.linkName = body.data?.name
        metadata.affiliateUrl = body.data?.affiliateUrl
        metadata.category = body.data?.category
        break
      case 'adspower-environment':
        metadata.environmentName = body.data?.name
        metadata.environmentId = body.data?.environmentId
        break
      case 'configuration':
        metadata.configurationName = body.data?.name
        metadata.environmentId = body.data?.environmentId
        metadata.repeatCount = body.data?.repeatCount
        metadata.linkCount = body.data?.originalLinks?.length || 0
        break
      case 'association':
        metadata.googleAdsAccountId = body.data?.googleAdsAccountId
        metadata.affiliateLinkId = body.data?.affiliateLinkId
        metadata.adsPowerEnvironmentId = body.data?.adsPowerEnvironmentId
        break
      case 'test-connection':
        metadata.testType = body.action
        metadata.targetId = body.data?.accountId || body.data?.environmentId || body.data?.linkId
        break
    }
  }

  return metadata
}

/**
 * 预定义的AdsCenter Token消耗配置
 */
export const adsCenterTokenTrackingConfig: AdsCenterTokenOptions = {
  extractLinkCount: extractAdsCenterCount,
  extractOperationType: extractAdsCenterOperationType,
  extractMetadata: extractAdsCenterMetadata,
  skipTokenConsumption: (request, body) => {
    // 跳过GET请求的Token消耗（只有写操作消耗Token）
    if (request.method === 'GET') {
      return true
    }
    
    // 跳过某些不需要消耗Token的操作
    if (body?.type === 'system-verification') {
      return true
    }
    
    return false
  },
  onTokenConsumed: async (result, tokenResult) => {
    console.log('AdsCenter Token消耗记录:', {
      consumed: tokenResult.consumed || tokenResult.totalConsumed,
      batchId: tokenResult.batchId,
      timestamp: new Date().toISOString()
    })
  },
  onTokenError: async (error) => {
    console.warn('AdsCenter Token消耗失败:', error)
  }
}
