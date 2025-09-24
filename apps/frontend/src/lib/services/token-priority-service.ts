import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { TokenTransactionService } from './token-transaction-service';
import { TokenExpirationService } from './token-expiration-service';
type TokenUsageFeature = string;

/**
 * Service for handling token consumption using unified token system
 */
export class TokenPriorityService {
  /**
   * Consume tokens using unified token system
   */
  static async consumeTokensWithPriority(
    userId: string,
    requiredAmount: number,
    source: string,
    description?: string,
    metadata?: any
  ) {
    // Get effective token balance
    const { total: availableTokens, breakdown } = 
      await TokenExpirationService.getUserTokenBalances(userId);
    
    if (availableTokens < requiredAmount) {
      throw new Error(`Insufficient token balance. Required: ${requiredAmount}, Available: ${availableTokens}`);
    }

    // Get current user for balance update
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tokenBalance: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Update user balance and create transaction record
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 原子扣减，确保余额不会为负
      const affected: number = await tx.$executeRaw`UPDATE users SET tokenBalance = tokenBalance - ${requiredAmount} WHERE id = ${userId} AND tokenBalance >= ${requiredAmount}`
      if (!affected || affected === 0) {
        throw new Error(`Insufficient token balance. Required: ${requiredAmount}`)
      }

      // 扣减后查询当前余额，并推导扣减前余额（after + requiredAmount）
      const afterRow = await tx.user.findUnique({ where: { id: userId }, select: { tokenBalance: true } })
      const afterBalance = afterRow?.tokenBalance ?? 0
      const beforeBalance = afterBalance + requiredAmount

      // Record consumption transaction
      await tx.tokenTransaction.create({
        data: {
          userId,
          type: 'DEBIT' as any,
          amount: -requiredAmount,
          balanceBefore: beforeBalance,
          balanceAfter: afterBalance,
          source,
          description: description || `${source} operation`,
          metadata: {
            ...metadata,
            consumedAt: new Date().toISOString(),
            effectiveBreakdown: breakdown // Record what types of tokens were conceptually consumed
          }
        }
      });

      // Record token usage
      await tx.token_usage.create({
        data: {
          userId,
          feature: source.toUpperCase() as TokenUsageFeature,
          operation: description || 'consume',
          tokensConsumed: requiredAmount,
          tokensRemaining: afterBalance,
          planId: metadata?.planId || 'default-plan'
        }
      });
    });

    const newBalance = availableTokens - requiredAmount
    return {
      success: true,
      consumed: requiredAmount,
      breakdown, // Return the effective breakdown for reference
      newBalance
    };
  }



  /**
   * Check if user has enough effective tokens
   */
  static async checkTokenAvailability(userId: string, requiredAmount: number) {
    try {
      const { total, breakdown } = 
        await TokenExpirationService.getUserTokenBalances(userId);

      const available = total >= requiredAmount;

      return {
        available,
        total,
        requiredAmount,
        shortage: available ? 0 : requiredAmount - total,
        breakdown
      };
    } catch (error) {
      return {
        available: false,
        total: 0,
        requiredAmount,
        shortage: requiredAmount,
        breakdown: {
          subscription: 0,
          activity: 0,
          purchased: 0,
          referral: 0,
          bonus: 0
        }
      };
    }
  }

  /**
   * Get token consumption breakdown for a user
   */
  static async getTokenConsumptionBreakdown(userId: string) {
    const [effectiveBalance, recentTransactions] = await Promise.all([
      TokenExpirationService.getUserTokenBalances(userId),
      prisma.tokenTransaction.findMany({
        where: {
          userId,
          amount: {
            lt: 0 // Consumption only
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50,
        select: {
          type: true,
          amount: true,
          source: true,
          createdAt: true
        }
      })
    ]);

    // Aggregate consumption by type
      const consumptionByType = recentTransactions.reduce((acc: Record<string, { count: number; totalAmount: number }>, tx: { type: any; amount: number }) => {
      const type = tx.type;
      if (!acc[type]) {
        acc[type] = { count: 0, totalAmount: 0 };
      }
      acc[type].count++;
      acc[type].totalAmount += Math.abs(tx.amount);
      return acc;
    }, {});

    return {
      balances: {
        ...effectiveBalance.breakdown,
        total: effectiveBalance.total
      },
      recentConsumption: consumptionByType,
      recentTransactions: recentTransactions.map((tx: { type: any; amount: number; source: string; createdAt: Date }) => ({
        type: tx.type,
        amount: Math.abs(tx.amount),
        source: tx.source,
        timestamp: tx.createdAt
      }))
    };
  }

  /**
   * Simulate token consumption to show breakdown
   */
  static async simulateConsumption(userId: string, requiredAmount: number) {
    const availability = await this.checkTokenAvailability(userId, requiredAmount);

    if (!availability.available) {
      return {
        success: false,
        error: 'Insufficient tokens',
        requiredAmount,
        availableAmount: availability.total,
        shortage: availability.shortage
      };
    }

    // In unified system, we just show the current breakdown and what would remain
      const remainingBalance = availability.total - requiredAmount;

    return {
      success: true,
      requiredAmount,
      currentBreakdown: availability.breakdown,
      remainingBalance,
      note: 'Tokens will be consumed from unified balance. Breakdown shows current token sources.'
    };
  }
}
