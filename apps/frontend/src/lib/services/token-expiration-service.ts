import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { TokenTransactionService } from './token-transaction-service';

type TokenType = any;

// Cleanup interval reference
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Service for managing unified token system with selective expiration
 */
export class TokenExpirationService {
  /**
   * Add tokens with selective expiration based on source
   */
  static async addTokensWithExpiration(
    userId: string,
    amount: number,
    type: TokenType,
    expiresAt?: Date,
    metadata?: any
  ) {
    // Determine expiration based on token source
    let finalExpiresAt = expiresAt;
    
    if (!finalExpiresAt) {
      switch (type) {
        case 'SUBSCRIPTION':
          // Subscription tokens expire when subscription ends
          const subscription = await prisma.subscription.findFirst({
            where: {
              userId,
              status: 'ACTIVE'
            },
            orderBy: {
              currentPeriodEnd: 'desc'
            }
          });
          if (subscription) {
            finalExpiresAt = subscription.currentPeriodEnd;
          }
          break;
        case 'PURCHASED':
        case 'ACTIVITY':
        case 'BONUS':
        default:
          // These tokens don't expire
          finalExpiresAt = undefined;
          break;
      }
    }

    // Atomic add + transaction record
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // read balance before within tx
      const beforeRow = await tx.user.findUnique({ where: { id: userId }, select: { tokenBalance: true } })
      if (!beforeRow) throw new Error('User not found');
      const balanceBefore = beforeRow.tokenBalance || 0

      await tx.user.update({
        where: { id: userId },
        data: { tokenBalance: { increment: amount } }
      })

      await TokenTransactionService.recordTransaction({
        userId,
        type,
        amount,
        balanceBefore,
        balanceAfter: balanceBefore + amount,
        source: metadata?.source || 'token_addition',
        description: metadata?.description || `Added ${type} tokens`,
        metadata: {
          ...metadata,
          expiresAt: finalExpiresAt,
          tokenSource: type,
          hasExpiration: !!finalExpiresAt
        }
      }, tx)
    })

    // Note: Token expiration tracking is handled through metadata in token transactions
    // No separate TokenExpiration model needed for now

    return {
      userId,
      amount,
      type,
      expiresAt: finalExpiresAt
    };
  }

  /**
   * Process expired subscription tokens
   */
  static async processExpiredSubscriptionTokens() {
    const now = new Date();
    
    // Find expired subscription tokens
    const expiredSubscriptionTokens = await prisma.tokenTransaction.findMany({
      where: {
        type: 'SUBSCRIPTION' as any,
        metadata: {
          path: ['expiresAt'],
          lt: now.toISOString()
        }
      },
      include: {
        user: {
          select: {
            id: true,
            tokenBalance: true
          }
        }
      }
    });

    const processed: any[] = [];
    
    for (const tokenRecord of expiredSubscriptionTokens) {
      try {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // read balance before in tx
          const beforeRow = await tx.user.findUnique({ where: { id: tokenRecord.userId }, select: { tokenBalance: true } })
          if (!beforeRow) throw new Error('User not found')
          const balanceBefore = beforeRow.tokenBalance

          await tx.user.update({
            where: { id: tokenRecord.userId },
            data: { tokenBalance: { decrement: tokenRecord.amount } }
          })

          await TokenTransactionService.recordTransaction({
            userId: tokenRecord.userId,
            type: 'SUBSCRIPTION' as any,
            amount: -tokenRecord.amount,
            balanceBefore,
            balanceAfter: balanceBefore - tokenRecord.amount,
            source: 'subscription_expired',
            description: `Expired subscription tokens removed`,
            metadata: {
              originalTransactionId: tokenRecord.id,
              expiredAt: now.toISOString()
            }
          }, tx)
        })

        processed.push({
          userId: tokenRecord.userId,
          amount: tokenRecord.amount,
          expiredAt: now
        });
      } catch (error) {
        console.error(`Failed to process expired tokens for user ${tokenRecord.userId}:`, error);
      }
    }
    
    return {
      processed,
      count: processed.length
    };
  }

  /**
   * Get user's token balances by source
   */
  static async getUserTokenBalances(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tokenBalance: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get token breakdown by source from transactions
    const tokensBySource = await prisma.tokenTransaction.groupBy({
      by: ['type'],
      where: {
        userId,
        amount: { gt: 0 } // Only positive transactions (additions)
      },
      _sum: {
        amount: true
      }
    });

    // Get upcoming subscription token expirations
    const upcomingExpirations = await prisma.tokenTransaction.findMany({
      where: {
        userId,
        type: 'SUBSCRIPTION' as any,
        amount: { gt: 0 },
        metadata: {
          path: ['expiresAt'],
          not: null
        }
      },
      select: {
        amount: true,
        metadata: true
      }
    });

    const breakdown = tokensBySource.reduce((acc: Record<string, number>, item: any) => {
      acc[item.type.toLowerCase()] = item._sum.amount || 0;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: user.tokenBalance,
      breakdown,
      upcomingExpirations: upcomingExpirations.map((exp: any) => ({
        amount: exp.amount,
        expiresAt: exp.metadata?.expiresAt
      }))
    };
  }

  /**
   * Clear subscription tokens when subscription ends
   */
  static async clearSubscriptionTokens(userId: string, subscriptionId: string) {
    // Find all subscription tokens that should expire with this subscription
    const subscriptionTokens = await prisma.tokenTransaction.findMany({
      where: {
        userId,
        type: 'SUBSCRIPTION' as any,
        amount: { gt: 0 },
        metadata: {
          path: ['subscriptionId'],
          equals: subscriptionId
        }
      }
    });

    if (subscriptionTokens.length === 0) {
      return;
    }

    const totalToRemove = subscriptionTokens.reduce((sum: number, token: any) => sum + token.amount, 0);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const beforeRow = await tx.user.findUnique({ where: { id: userId }, select: { tokenBalance: true } })
      if (!beforeRow) throw new Error('User not found')
      const balanceBefore = beforeRow.tokenBalance

      await tx.user.update({
        where: { id: userId },
        data: { tokenBalance: { decrement: totalToRemove } }
      })

      await TokenTransactionService.recordTransaction({
        userId,
        type: 'SUBSCRIPTION' as any,
        amount: -totalToRemove,
        balanceBefore,
        balanceAfter: balanceBefore - totalToRemove,
        source: 'subscription_ended',
        description: `Removed ${totalToRemove} subscription tokens (subscription ended)`,
        metadata: {
          subscriptionId,
          endedAt: new Date().toISOString(),
          removedTokens: totalToRemove
        }
      }, tx)
    })

    console.log(`Removed ${totalToRemove} subscription tokens for user ${userId} (subscription ${subscriptionId} ended)`);
  }

  /**
   * Get expiring tokens summary (for admin)
   */
  static async getExpiringTokensSummary(days: number = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    // Find subscription tokens expiring within the specified days
    const expiringSoon = await prisma.tokenTransaction.findMany({
      where: {
        type: 'SUBSCRIPTION' as any,
        amount: { gt: 0 },
        metadata: {
          path: ['expiresAt'],
          lte: futureDate.toISOString()
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return {
      days,
      expiringSoon: expiringSoon.map((token: any) => ({
        userId: token.userId,
        userEmail: token.user.email,
        amount: token.amount,
        expiresAt: token.metadata?.expiresAt,
        subscriptionId: token.metadata?.subscriptionId
      }))
    };
  }

  /**
   * Start token cleanup process
   */
  static startTokenCleanup() {
    if (cleanupInterval) {
      return; // Already running
    }

    // Run cleanup every hour
    cleanupInterval = setInterval(async () => {
      try {
        await this.processExpiredTokens();
      } catch (error) {
        console.error('Error in token cleanup:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    console.log('Token cleanup process started');
  }

  /**
   * Stop token cleanup process
   */
  static stopTokenCleanup() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
      console.log('Token cleanup process stopped');
    }
  }

  /**
   * Process expired tokens
   */
  private static async processExpiredTokens() {
    const now = new Date();
    
    // Find and mark expired tokens
    const expiredTokens = await prisma.token.findMany({
      where: {
        AND: [
          {
            status: 'ACTIVE'
          },
          {
            metadata: {
              path: ['expiresAt'],
              lte: now.toISOString()
            }
          }
        ]
      }
    });

    for (const token of expiredTokens) {
      await prisma.token.update({
        where: { id: token.id },
        data: { status: 'EXPIRED' }
      });
    }

    if (expiredTokens.length > 0) {
      console.log(`Processed ${expiredTokens.length} expired tokens`);
    }
  }
}
