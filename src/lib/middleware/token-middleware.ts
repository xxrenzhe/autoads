import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthContext } from './enhanced-auth-middleware'
import { TokenService } from '@/lib/services/token-service'

export interface TokenMiddlewareOptions {
  feature: string
  tokenCost?: number
  consumeTokens?: boolean
  allowFreeAccess?: boolean
  freeAccessLimit?: number
}

/**
 * Token-aware middleware that checks and optionally consumes tokens
 */
export async function requireTokens(
  request: NextRequest,
  options: TokenMiddlewareOptions
): Promise<{
  success: boolean
  context?: AuthContext
  response?: NextResponse
  tokenInfo?: {
    consumed: number
    remaining: number
  }
}> {
  const { feature, tokenCost = 1, consumeTokens = false, allowFreeAccess = false } = options

  // If free access is allowed, handle unauthenticated users
  if (allowFreeAccess) {
    try {
      const authResult = await requireAuth(request)
      
      // If authentication fails but free access is allowed, provide limited access
      if (!authResult.success) {
        return {
          success: true,
          context: undefined, // No user context for free access
          tokenInfo: {
            consumed: 0,
            remaining: 0
          }
        }
      }

      // User is authenticated, proceed with token checking
      const context = authResult.context!
      
      if (consumeTokens) {
        const tokenResult = await TokenService.checkAndConsumeTokens(context.userId, feature, 'api_access')
        
        if (!tokenResult.success) {
          return {
            success: false,
            response: NextResponse.json({
              success: false,
              error: tokenResult.error,
              feature,
              code: 'INSUFFICIENT_TOKENS'
            }, { status: 402 })
          }
        }

        return {
          success: true,
          context,
          tokenInfo: {
            consumed: tokenResult.consumed,
            remaining: tokenResult.newBalance || 0
          }
        }
      } else {
        // Just check balance without consuming
        const balanceCheck = await TokenService.checkTokenBalance(context.userId, tokenCost)
        
        if (!balanceCheck.sufficient) {
          return {
            success: false,
            response: NextResponse.json({
              success: false,
              error: `Insufficient token balance. Required: ${tokenCost}, Available: ${balanceCheck.currentBalance}`,
              feature,
              required: tokenCost,
              current: balanceCheck.currentBalance,
              code: 'INSUFFICIENT_TOKENS'
            }, { status: 402 })
          }
        }

        return {
          success: true,
          context,
          tokenInfo: {
            consumed: 0,
            remaining: balanceCheck.currentBalance
          }
        }
      }
    } catch (error) {
      console.error('Token middleware error:', error)
      return {
        success: false,
        response: NextResponse.json({
          success: false,
          error: 'Token check failed',
          code: 'TOKEN_CHECK_ERROR'
        }, { status: 500 })
      }
    }
  }

  // Standard authenticated access with token checking
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult
  }

  const context = authResult.context

  try {
    if (consumeTokens) {
      const tokenResult = await TokenService.checkAndConsumeTokens(context.userId, feature, 'api_access')
      
      if (!tokenResult.success) {
        return {
          success: false,
          response: NextResponse.json({
            success: false,
            error: tokenResult.error,
            feature,
            code: 'INSUFFICIENT_TOKENS'
          }, { status: 402 })
        }
      }

      return {
        success: true,
        context,
        tokenInfo: {
          consumed: tokenResult.consumed,
          remaining: tokenResult.newBalance || 0
        }
      }
    } else {
      // Just check balance without consuming
      const balanceCheck = await TokenService.checkTokenBalance(context.userId, tokenCost)
      
      if (!balanceCheck.sufficient) {
        return {
          success: false,
          response: NextResponse.json({
            success: false,
            error: `Insufficient token balance. Required: ${tokenCost}, Available: ${balanceCheck.currentBalance}`,
            feature,
            required: tokenCost,
            current: balanceCheck.currentBalance,
            code: 'INSUFFICIENT_TOKENS'
          }, { status: 402 })
        }
      }

      return {
        success: true,
        context,
        tokenInfo: {
          consumed: 0,
          remaining: balanceCheck.currentBalance
        }
      }
    }
  } catch (error) {
    console.error('Token middleware error:', error)
    return {
      success: false,
      response: NextResponse.json({
        success: false,
        error: 'Token check failed',
        code: 'TOKEN_CHECK_ERROR'
      }, { status: 500 })
    }
  }
}

/**
 * Utility function to create token middleware for specific features
 */
export const createTokenMiddleware = (feature: string, options?: Partial<TokenMiddlewareOptions>) =>
  (request: NextRequest) => requireTokens(request, { feature, ...options })

/**
 * Pre-configured middleware for common features
 */
export const siterankTokenMiddleware = createTokenMiddleware('siterank', {
  tokenCost: 1,
  allowFreeAccess: true
})

export const batchopenTokenMiddleware = createTokenMiddleware('batchopen', {
  tokenCost: 2,
  consumeTokens: true
})

export const adscenterTokenMiddleware = createTokenMiddleware('adscenter', {
  tokenCost: 3,
  consumeTokens: true
})

/**
 * Middleware for checking if user has sufficient tokens without consuming them
 */
export async function checkTokenBalance(
  request: NextRequest,
  feature: string,
  requiredTokens: number = 1
): Promise<{
  success: boolean
  context?: AuthContext
  response?: NextResponse
  balance?: number
}> {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult
  }

  try {
    const balanceCheck = await TokenService.checkTokenBalance(
      authResult.context.userId,
      requiredTokens
    )

    if (!balanceCheck.sufficient) {
      return {
        success: false,
        response: NextResponse.json({
          success: false,
          error: 'Insufficient token balance',
          feature,
          required: requiredTokens,
          current: balanceCheck.currentBalance,
          code: 'INSUFFICIENT_TOKENS'
        }, { status: 402 })
      }
    }

    return {
      success: true,
      context: authResult.context,
      balance: balanceCheck.currentBalance
    }
  } catch (error) {
    console.error('Token balance check error:', error)
    return {
      success: false,
      response: NextResponse.json({
        success: false,
        error: 'Token balance check failed',
        code: 'TOKEN_CHECK_ERROR'
      }, { status: 500 })
    }
  }
}

/**
 * Utility to add token information to API responses
 */
export function addTokenInfoToResponse(
  data: any,
  tokenInfo?: {
    consumed: number
    remaining: number
  }
): any {
  if (!tokenInfo) {
    return data
  }

  return {
    ...data,
    tokenInfo: {
      consumed: tokenInfo.consumed,
      remaining: tokenInfo.remaining
    }
  }
}