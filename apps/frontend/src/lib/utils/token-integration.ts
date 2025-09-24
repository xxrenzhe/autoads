import { tokenConfigService } from '@/lib/services/token-config'
import { prisma } from '@/lib/db'
import { TokenTransactionService } from '@/lib/services/token-transaction-service'
import { Prisma } from '@prisma/client'

/**
 * Utility functions to integrate token consumption into existing features
 */

export interface TokenConsumptionResult {
  success: boolean
  tokensConsumed: number
  remainingBalance: number
  error?: string
}

/**
 * Check if user has sufficient tokens for an operation
 */
export async function checkTokenBalance(
  userId: string,
  feature: 'siterank' | 'batchopen' | 'adscenter',
  itemCount: number,
  isBatch: boolean = false
): Promise<{ hasBalance: boolean; requiredTokens: number; currentBalance: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenBalance: true }
  })

  if (!user) {
    throw new Error('User not found')
  }

  const requiredTokens = await tokenConfigService.calculateTokenCost(feature, itemCount, isBatch)

  return {
    hasBalance: user.tokenBalance >= requiredTokens,
    requiredTokens,
    currentBalance: user.tokenBalance
  }
}

/**
 * Consume tokens for an operation
 */
export async function consumeTokens(
  userId: string,
  feature: 'siterank' | 'batchopen' | 'adscenter',
  operation: string,
  itemCount: number,
  isBatch: boolean = false,
  batchId?: string,
  metadata?: any
): Promise<TokenConsumptionResult> {
  try {
    // Check balance first
    const balanceCheck = await checkTokenBalance(userId, feature, itemCount, isBatch)
    
    if (!balanceCheck.hasBalance) {
      return {
        success: false,
        tokensConsumed: 0,
        remainingBalance: balanceCheck.currentBalance,
        error: `Insufficient tokens. Required: ${balanceCheck.requiredTokens}, Available: ${balanceCheck.currentBalance}`
      }
    }

    // Record token usage and update balance
    await tokenConfigService.recordTokenUsage(
      userId,
      feature,
      operation,
      itemCount,
      balanceCheck.requiredTokens,
      isBatch,
      batchId,
      metadata
    )

    return {
      success: true,
      tokensConsumed: balanceCheck.requiredTokens,
      remainingBalance: balanceCheck.currentBalance - balanceCheck.requiredTokens
    }
  } catch (error) {
    console.error('Error consuming tokens:', error)
    return {
      success: false,
      tokensConsumed: 0,
      remainingBalance: 0,
      error: error instanceof Error ? error.message : "Unknown error" as any
    }
  }
}

/**
 * Wrapper for SiteRank operations
 */
export async function consumeTokensForSiteRank(
  userId: string,
  domains: string[],
  isBatch: boolean = false,
  batchId?: string
): Promise<TokenConsumptionResult> {
  return consumeTokens(
    userId,
    'siterank',
    'domain_analysis',
    domains.length,
    isBatch,
    batchId,
    { domains: isBatch ? domains.length : domains }
  )
}

/**
 * Wrapper for BatchOpen operations
 */
export async function consumeTokensForBatchOpen(
  userId: string,
  urls: string[],
  isBatch: boolean = true,
  batchId?: string
): Promise<TokenConsumptionResult> {
  return consumeTokens(
    userId,
    'batchopen',
    'url_opening',
    urls.length,
    isBatch,
    batchId,
    { urls: isBatch ? urls.length : urls }
  )
}

/**
 * Wrapper for AdsCenter operations (backward compatible alias)
 */
export async function consumeTokensForChangeLink(
  userId: string,
  linkChanges: any[],
  isBatch: boolean = false,
  batchId?: string
): Promise<TokenConsumptionResult> {
  return consumeTokens(
    userId,
    'adscenter',
    'link_replacement',
    linkChanges.length,
    isBatch,
    batchId,
    { changes: isBatch ? linkChanges.length : linkChanges }
  )
}

// Prefer new alias for clarity; keep old function for compatibility
export const consumeTokensForAdsCenter = consumeTokensForChangeLink

/**
 * Get user's current token balance and usage summary
 */
export async function getUserTokenSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tokenBalance: true,
      subscription: {
        select: {
          plan: {
            select: {
              name: true,
              tokenQuota: true
            }
          }
        }
      }
    }
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Get current month usage
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const monthlyUsage = await prisma.token_usage.aggregate({
    where: {
      userId,
      createdAt: {
        gte: startOfMonth
      }
    },
    _sum: {
      tokensConsumed: true
    }
  })

  const planQuota = user.subscription?.plan?.tokenQuota || 0
  const usedThisMonth = monthlyUsage._sum.tokensConsumed || 0

  return {
    currentBalance: user.tokenBalance,
    planQuota,
    usedThisMonth,
    remainingQuota: Math.max(0, planQuota - usedThisMonth),
    usagePercentage: planQuota > 0 ? (usedThisMonth / planQuota) * 100 : 0,
    planName: user.subscription?.plan?.name || 'Free'
  }
}

/**
 * Middleware function to check tokens before API operations
 */
export function withTokenCheck(
  feature: 'siterank' | 'batchopen' | 'adscenter',
  getItemCount: (req: any) => number,
  getIsBatch: (req: any) => boolean = () => false
) {
  return async (req: any, userId: string) => {
    const itemCount = getItemCount(req)
    const isBatch = getIsBatch(req)
    
    const balanceCheck = await checkTokenBalance(userId, feature, itemCount, isBatch)
    
    if (!balanceCheck.hasBalance) {
      throw new Error(
        `Insufficient tokens. Required: ${balanceCheck.requiredTokens}, Available: ${balanceCheck.currentBalance}`
      )
    }
    
    return balanceCheck
  }
}

/**
 * Refund tokens for failed operations
 */
export async function refundTokens(
  userId: string,
  feature: 'siterank' | 'batchopen' | 'adscenter',
  tokensToRefund: number,
  reason: string
): Promise<void> {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const before = await tx.user.findUnique({ where: { id: userId }, select: { tokenBalance: true } })
    const beforeBal = before?.tokenBalance ?? 0

    await tx.user.update({
      where: { id: userId },
      data: { tokenBalance: { increment: tokensToRefund } }
    })

    await TokenTransactionService.recordTransaction({
      userId,
      type: 'REFUND' as any,
      amount: tokensToRefund,
      balanceBefore: beforeBal,
      balanceAfter: beforeBal + tokensToRefund,
      source: 'token_refund',
      description: `Token refund: ${reason}`,
      metadata: {
        feature,
        reason,
        refundedAt: new Date().toISOString()
      }
    }, tx)
  })
}
