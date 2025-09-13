import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { TokenExpirationService } from '../token-expiration-service';

const logger = createLogger('TokenQueryService');

/**
 * Token查询优化服务 - 使用统一Token系统
 * 针对高频Token操作进行优化
 */
export class TokenQueryService {
  /**
   * 获取用户有效Token余额（优化版）
   */
  static async getUserTokenBalances(userId: string) {
    try {
      const [user, effectiveBalance] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            tokenBalance: true,
            tokenUsedThisMonth: true
          }
        }),
        TokenExpirationService.getUserTokenBalances(userId)
      ]);

      if (!user) {
        throw new Error('用户不存在');
      }

      return {
        ...effectiveBalance.breakdown,
        total: effectiveBalance.total,
        usedThisMonth: user.tokenUsedThisMonth,
        available: effectiveBalance.total
      };
    } catch (error) {
      logger.error('获取用户Token余额失败', error as Error);
      throw error;
    }
  }

  /**
   * 检查用户是否有足够的有效Token
   */
  static async checkTokenBalance(userId: string, requiredAmount: number): Promise<{
    hasEnough: boolean;
    balances: {
      subscription: number;
      activity: number;
      purchased: number;
      referral: number;
      bonus: number;
      total: number;
    };
  }> {
    try {
      const balances = await this.getUserTokenBalances(userId);
      
      return {
        hasEnough: balances.available >= requiredAmount,
        balances
      };
    } catch (error) {
      logger.error('检查Token余额失败', error as Error);
      throw error;
    }
  }

  /**
   * 扣减Token（使用统一Token系统）
   */
  static async consumeTokens(
    userId: string,
    amount: number,
    source: string,
    description?: string
  ): Promise<{
    success: boolean;
    remainingBalances: {
      subscription: number;
      activity: number;
      purchased: number;
      referral: number;
      bonus: number;
      total: number;
    };
    transactionId?: string;
  }> {
    try {
      // 检查有效余额
      const { total: availableTokens } = 
        await TokenExpirationService.getUserTokenBalances(userId);

      if (availableTokens < amount) {
        const balances = await this.getUserTokenBalances(userId);
        return {
          success: false,
          remainingBalances: balances
        };
      }

      // 使用统一Token系统进行消费
      const result = await prisma.$transaction(async (tx: any) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            tokenBalance: true,
            tokenUsedThisMonth: true
          }
        });

        if (!user) {
          throw new Error('用户不存在');
        }

        const newBalance = user.tokenBalance - amount;

        // 更新用户余额
        await tx.user.update({
          where: { id: userId },
          data: {
            tokenBalance: newBalance,
            tokenUsedThisMonth: {
              increment: amount
            }
          }
        });

        // 记录交易
        const transaction = await tx.tokenTransaction.create({
          data: {
            userId,
            type: 'DEBIT',
            amount: -amount,
            balanceBefore: user.tokenBalance,
            balanceAfter: newBalance,
            source,
            description: description || `${source} operation`,
            metadata: {
              consumedAt: new Date().toISOString()
            }
          }
        });

        return { transactionId: transaction.id, newBalance };
      });

      // 获取更新后的余额分解
      const updatedBalances = await this.getUserTokenBalances(userId);

      return {
        success: true,
        remainingBalances: updatedBalances,
        transactionId: result.transactionId
      };
    } catch (error) {
      logger.error('扣减Token失败', error as Error);
      throw error;
    }
  }

  /**
   * 增加Token（使用统一Token系统）
   */
  static async addTokens(
    userId: string,
    amount: number,
    type: 'PURCHASED' | 'SUBSCRIPTION' | 'ACTIVITY' | 'REFERRAL' | 'BONUS',
    source: string,
    description?: string
  ): Promise<{
    success: boolean;
    newBalances: {
      subscription: number;
      activity: number;
      purchased: number;
      referral: number;
      bonus: number;
      total: number;
    };
  }> {
    try {
      // 使用新的统一Token系统添加Token
      await TokenExpirationService.addTokensWithExpiration(
        userId,
        amount,
        type as any,
        undefined, // 过期时间根据类型自动设置
        {
          source,
          description: description || `Added ${amount} ${type.toLowerCase()} tokens`,
          timestamp: new Date().toISOString()
        }
      );

      // 获取更新后的余额
      const newBalances = await this.getUserTokenBalances(userId);

      return {
        success: true,
        newBalances
      };
    } catch (error) {
      logger.error('增加Token失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取Token交易记录（分页）
   */
  static async getTokenTransactions(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const {
      page = 1,
      limit = 20,
      type,
      startDate,
      endDate
    } = options;

    const skip = (page - 1) * limit;

    try {
      const whereClause: any = { userId };
      
      if (type) {
        whereClause.type = type as any;
      }
      
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      const [transactions, total] = await Promise.all([
        prisma.tokenTransaction.findMany({
          where: whereClause,
          select: {
            id: true,
            type: true,
            amount: true,
            balanceBefore: true,
            balanceAfter: true,
            source: true,
            description: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.tokenTransaction.count({ where: whereClause })
      ]);

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('获取Token交易记录失败', error as Error);
      throw error;
    }
  }



  /**
   * 获取Token使用统计
   */
  static async getTokenUsageStats(userId: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [transactions, usageByFeature] = await Promise.all([
        // 获取交易统计
        prisma.tokenTransaction.groupBy({
          by: ['type'],
          where: {
            userId,
            createdAt: { gte: startDate }
          },
          _sum: {
            amount: true
          },
          _count: true
        }),
        // 获取按功能使用统计
        prisma.usageLog.groupBy({
          by: ['feature'],
          where: {
            userId,
            date: { gte: startDate }
          },
          _sum: {
            usage: true
          }
        })
      ]);

      return {
        period: {
          days,
          startDate,
          endDate: new Date()
        },
        transactions: transactions.map((t: any: any) => ({
          type: t.type,
          totalAmount: t._sum.amount || 0,
          count: t._count
        })),
        usageByFeature: usageByFeature.map((u: any: any) => ({
          feature: u.feature,
          totalUsage: u._sum.usage || 0
        }))
      };
    } catch (error) {
      logger.error('获取Token使用统计失败', error as Error);
      throw error;
    }
  }
}