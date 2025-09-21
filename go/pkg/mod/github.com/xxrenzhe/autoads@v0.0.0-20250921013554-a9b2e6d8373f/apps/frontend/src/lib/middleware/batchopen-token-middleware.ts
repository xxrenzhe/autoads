/**
 * BatchOpen Token消耗中间件
 * 为BatchOpen功能添加增强的Token消耗记录，同时保持现有功能不变
 */

import { NextRequest, NextResponse } from 'next/server'
import { TokenService } from '@/lib/services/token-service'
import { auth } from '@/lib/auth/v5-config'

export interface BatchOpenTokenOptions {
  extractUrlCount?: (request: NextRequest, body?: any) => number | Promise<number>
  extractCycleCount?: (request: NextRequest, body?: any) => number | Promise<number>
  extractMetadata?: (request: NextRequest, body?: any) => any | Promise<any>
  skipTokenConsumption?: (request: NextRequest, body?: any) => boolean | Promise<boolean>
  onTokenConsumed?: (result: any, tokenResult: any) => void | Promise<void>
  onTokenError?: (error: any) => void | Promise<void>
}

/**
 * 为BatchOpen API添加Token消耗记录的中间件
 * 注意：这个中间件不会阻止现有功能，只是记录Token消耗
 */
export function withBatchOpenTokenTracking(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  options: BatchOpenTokenOptions = {}
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

      // 提取URL数量
      let urlCount = 1
      if (options.extractUrlCount) {
        urlCount = await options.extractUrlCount(request, body)
      } else if (body?.urls && Array.isArray(body.urls)) {
        urlCount = body.urls.length
      }

      // 提取循环次数
      let cycleCount = 1
      if (options.extractCycleCount) {
        cycleCount = await options.extractCycleCount(request, body)
      } else if (body?.cycleCount && typeof body.cycleCount === 'number') {
        cycleCount = body.cycleCount
      }

      // 计算总操作数（URL数量 × 循环次数）
      const totalOperations = urlCount * cycleCount

      // 提取元数据
      let metadata: any = {}
      if (options.extractMetadata) {
        metadata = await options.extractMetadata(request, body)
      } else {
        metadata = {
          urlCount,
          cycleCount,
          totalOperations,
          proxyUrl: body?.proxyUrl,
          refererOption: body?.refererOption,
          accessMode: body?.accessMode || 'http'
        }
      }

      // 记录Token消耗（使用批量操作记录）
      if (totalOperations > 1) {
        // 批量操作
        const operations: Array<{ metadata: any; description: string }> = []
        for (let cycle = 1; cycle <= cycleCount; cycle++) {
          for (let urlIndex = 0; urlIndex < urlCount; urlIndex++) {
            operations.push({
              metadata: {
                ...metadata,
                cycle,
                urlIndex,
                url: body?.urls?.[urlIndex] || `URL-${urlIndex + 1}`,
                timestamp: new Date().toISOString()
              },
              description: `BatchOpen访问 - 第${cycle}轮 URL${urlIndex + 1}`
            })
          }
        }

        tokenResult = await TokenService.consumeBatchTokens(
          userId,
          'batchopen',
          'url_access',
          operations
        )
      } else {
        // 单个操作
        tokenResult = await TokenService.checkAndConsumeTokens(
          userId,
          'batchopen',
          'url_access',
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
        console.warn('BatchOpen Token消耗失败，但继续执行以保持兼容性:', tokenResult.error)
        
        if (options.onTokenError) {
          await options.onTokenError(tokenResult.error)
        }
      } else {
        console.log('BatchOpen Token消耗成功:', {
          consumed: tokenResult.consumed || tokenResult.totalConsumed,
          newBalance: tokenResult.newBalance,
          batchId: tokenResult.batchId
        })
        
        if (options.onTokenConsumed) {
          await options.onTokenConsumed({}, tokenResult)
        }
      }

    } catch (error) {
      console.error('BatchOpen Token消耗中间件错误:', error)
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

    // 扣减失败时，附加统一错误码响应头，供前端引导充值/续订
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
 * 从请求体中提取URL数量
 */
export function extractBatchOpenUrlCount(request: NextRequest, body: any): number {
  if (!body || !Array.isArray(body.urls)) {
    return 0
  }
  return body.urls.length
}

/**
 * 从请求体中提取循环次数
 */
export function extractBatchOpenCycleCount(request: NextRequest, body: any): number {
  if (!body || typeof body.cycleCount !== 'number') {
    return 1
  }
  return Math.max(1, body.cycleCount)
}

/**
 * 从请求体中提取BatchOpen元数据
 */
export function extractBatchOpenMetadata(request: NextRequest, body: any): any {
  const metadata: any = {
    endpoint: request.url,
    method: request.method,
    userAgent: request.headers.get('user-agent')
  }

  if (body) {
    metadata.taskId = body.taskId
    metadata.proxyUrl = body.proxyUrl
    metadata.refererOption = body.refererOption
    metadata.selectedSocialMedia = body.selectedSocialMedia
    metadata.customReferer = body.customReferer
    metadata.accessMode = body.accessMode || 'http'
    metadata.enableConcurrentExecution = body.enableConcurrentExecution
    metadata.maxConcurrency = body.maxConcurrency
    metadata.enableAdvancedOptimization = body.enableAdvancedOptimization
    metadata.optimizationPreset = body.optimizationPreset
    
    // 只记录URL的数量和前几个URL（避免存储过多数据）
    if (Array.isArray(body.urls)) {
      metadata.urlCount = body.urls.length
      metadata.sampleUrls = body.urls.slice(0, 3) // 只记录前3个URL作为样本
    }
  }

  return metadata
}

/**
 * 预定义的BatchOpen Token消耗配置
 */
export const batchOpenTokenTrackingConfig: BatchOpenTokenOptions = {
  extractUrlCount: extractBatchOpenUrlCount,
  extractCycleCount: extractBatchOpenCycleCount,
  extractMetadata: extractBatchOpenMetadata,
  skipTokenConsumption: (request, body) => {
    // 如果没有URL或URL数量为0，跳过Token消耗
    return !body || !Array.isArray(body.urls) || body.urls.length === 0
  },
  onTokenConsumed: async (result, tokenResult) => {
    console.log('BatchOpen Token消耗记录:', {
      consumed: tokenResult.consumed || tokenResult.totalConsumed,
      batchId: tokenResult.batchId,
      timestamp: new Date().toISOString()
    })
  },
  onTokenError: async (error) => {
    console.warn('BatchOpen Token消耗失败:', error)
  }
}
