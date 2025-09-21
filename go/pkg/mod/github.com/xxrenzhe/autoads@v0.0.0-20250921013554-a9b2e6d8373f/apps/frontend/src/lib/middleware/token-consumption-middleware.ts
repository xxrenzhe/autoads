/**
 * Token消耗中间件
 * 为现有API添加Token消耗功能，同时保持向后兼容
 */

import { NextRequest, NextResponse } from 'next/server'
import { TokenService } from '@/lib/services/token-service'
import { auth } from '@/lib/auth/v5-config'
import { tokenusagefeature } from '@prisma/client'

export interface TokenConsumptionOptions {
  feature: tokenusagefeature
  action: string
  extractBatchSize?: (request: NextRequest, body?: any) => number | Promise<number>
  extractMetadata?: (request: NextRequest, body?: any) => any | Promise<any>
  skipTokenCheck?: (request: NextRequest, body?: any) => boolean | Promise<boolean>
  onSuccess?: (result: any, tokenResult: any) => void | Promise<void>
  onError?: (error: any) => void | Promise<void>
}

/**
 * 为API路由添加Token消耗功能的中间件
 */
export function withTokenConsumption(
  handler: (request: NextRequest, userId?: string, ...args: any[]) => Promise<NextResponse>,
  options: TokenConsumptionOptions
) {
  return async function(request: NextRequest, ...args: any[]): Promise<NextResponse> {
    try {
      // 获取用户会话
      const session = await auth()
      
      // 如果没有会话，直接调用原始处理器（可能是公开API）
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
          // 如果解析失败，继续执行，可能不是JSON请求
        }
      }

      // 检查是否跳过Token检查
      if (options.skipTokenCheck) {
        const shouldSkip = await options.skipTokenCheck(request, body)
        if (shouldSkip) {
          return handler(request, userId, ...args)
        }
      }

      // 提取批量大小
      let batchSize = 1
      if (options.extractBatchSize) {
        batchSize = await options.extractBatchSize(request, body)
      }

      // 提取元数据
      let metadata: any = {}
      if (options.extractMetadata) {
        metadata = await options.extractMetadata(request, body)
      }

      // 检查并消耗Token
      const tokenResult = await TokenService.checkAndConsumeTokens(
        userId,
        options.feature,
        options.action,
        {
          batchSize,
          metadata: {
            ...metadata,
            endpoint: request.url,
            method: request.method,
            userAgent: request.headers.get('user-agent'),
            timestamp: new Date().toISOString()
          }
        }
      )

      if (!tokenResult.success) {
        // Token不足，返回错误
        if (options.onError) {
          await options.onError(tokenResult.error)
        }

        const res = NextResponse.json(
          {
            success: false,
            error: tokenResult.error || 'Insufficient tokens',
            code: tokenResult.errorCode || 'INSUFFICIENT_TOKENS',
            tokenInfo: {
              required: batchSize,
              available: 0 // 这里可以优化为实际余额
            }
          },
          { status: 402 } // Payment Required
        )
        res.headers.set('X-Error-Code', tokenResult.errorCode || 'INSUFFICIENT_TOKENS')
        return res
      }

      // 调用原始处理器
      const response = await handler(request, userId, ...args)
      
      // 如果成功回调存在，调用它
      if (options.onSuccess && response.ok) {
        try {
          const responseData = await response.clone().json()
          await options.onSuccess(responseData, tokenResult)
        } catch (error) {
          // 忽略回调错误，不影响主要流程
          console.warn('Token consumption success callback failed:', error)
        }
      }

      // 在响应头中添加Token信息
      const headers = new Headers(response.headers)
      headers.set('X-Tokens-Consumed', tokenResult.consumed.toString())
      headers.set('X-Token-Balance', tokenResult.newBalance?.toString() || '0')
      if (tokenResult.batchId) {
        headers.set('X-Batch-Id', tokenResult.batchId)
      }

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })

    } catch (error) {
      console.error('Token consumption middleware error:', error)
      
      // 如果中间件出错，仍然调用原始处理器，确保功能不受影响
      return handler(request, undefined, ...args)
    }
  }
}

/**
 * 从URL参数中提取域名数量（用于SiteRank单个查询）
 */
export function extractSingleDomainBatchSize(request: NextRequest): number {
  const domain = request.nextUrl.searchParams.get('domain')
  return domain ? 1 : 0
}

/**
 * 从请求体中提取域名数量（用于SiteRank批量查询）
 */
export function extractDomainsBatchSize(request: NextRequest, body: any): number {
  if (!body || !Array.isArray(body.domains)) {
    return 0
  }
  return body.domains.length
}

/**
 * 从URL参数中提取SiteRank元数据
 */
export function extractSiteRankMetadata(request: NextRequest, body?: any): any {
  const searchParams = request.nextUrl.searchParams
  const metadata: any = {
    type: searchParams.get('type') || 'similarweb',
    forceRefresh: searchParams.get('forceRefresh') === 'true'
  }

  if (request.method === 'GET') {
    metadata.domain = searchParams.get('domain')
  } else if (body) {
    metadata.domains = body.domains
    metadata.concurrency = body.concurrency
  }

  return metadata
}

/**
 * 预定义的SiteRank Token消耗配置
 */
export const siteRankTokenConfig: TokenConsumptionOptions = {
  feature: tokenusagefeature.SITERANK,
  action: 'domain_analysis',
  extractBatchSize: (request, body) => {
    if (request.method === 'GET') {
      return extractSingleDomainBatchSize(request)
    } else {
      return extractDomainsBatchSize(request, body)
    }
  },
  extractMetadata: extractSiteRankMetadata,
  skipTokenCheck: (request, body) => {
    // 如果没有域名参数，跳过Token检查（可能是健康检查等）
    if (request.method === 'GET') {
      return !request.nextUrl.searchParams.get('domain')
    } else {
      return !body || !Array.isArray(body.domains) || body.domains.length === 0
    }
  }
}

/**
 * 预定义的BatchOpen Token消耗配置
 */
export const batchOpenTokenConfig: TokenConsumptionOptions = {
  feature: tokenusagefeature.BATCHOPEN,
  action: 'url_access',
  extractBatchSize: (request, body) => {
    if (!body || !Array.isArray(body.urls)) {
      return 0
    }
    return body.urls.length
  },
  extractMetadata: (request, body) => ({
    urls: body?.urls || [],
    options: body?.options || {}
  })
}

/**
 * 预定义的 AdsCenter Token 消耗配置
 */
export const adsCenterTokenConfig: TokenConsumptionOptions = {
  feature: tokenusagefeature.CHANGELINK,
  action: 'link_replace',
  extractBatchSize: (request, body) => {
    if (!body || !Array.isArray(body.links)) {
      return 0
    }
    return body.links.length
  },
  extractMetadata: (request, body) => ({
    links: body?.links || [],
    replacePattern: body?.replacePattern || {},
    options: body?.options || {}
  })
}
