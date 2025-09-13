import { prisma, SubscriptionStatus } from '@/lib/db';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('UserQueryService');

/**
 * 用户查询优化服务
 * 针对高频用户查询进行优化
 */
export class UserQueryService {
  /**
   * 获取用户基本信息（带缓存）
   */
  static async getUserBasicInfo(userId: string) {
    try {
      // 使用select只查询需要的字段，减少数据传输
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          // 统一Token余额
          tokenBalance: true,
          tokenUsedThisMonth: true,
          // 关联的订阅信息
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE },
            select: {
              id: true,
              planId: true,
              status: true,
              currentPeriodEnd: true,
              plan: {
                select: {
                  name: true,
                  features: true,
                  limits: true,
                  rateLimit: true
                }
              }
            },
            take: 1 // 只取一个有效订阅
          }
        }
      });

      return user;
    } catch (error) {
      logger.error('获取用户基本信息失败', error as Error);
      throw error;
    }
  }

  /**
   * 批量获取用户基本信息
   */
  static async getMultipleUsersBasicInfo(userIds: string[]) {
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
          tokenBalance: true
        }
      });

      // 创建映射以便快速查找
      const userMap = new Map(users.map((user: any: any) => [user.id, user]));
      return userMap;
    } catch (error) {
      logger.error('批量获取用户信息失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取用户Token使用统计
   */
  static async getUserTokenStats(userId: string, startDate?: Date, endDate?: Date) {
    try {
      const whereClause: any = {
        userId
      };

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      const [transactions, usageLogs] = await Promise.all([
        // Token交易记录
        prisma.tokenTransaction.findMany({
          where: whereClause,
          select: {
            type: true,
            amount: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1000 // 限制返回数量
        }),
        // 使用日志
        prisma.usageLog.findMany({
          where: whereClause,
          select: {
            feature: true,
            usage: true,
            date: true
          },
          orderBy: { date: 'desc' },
          take: 1000
        })
      ]);

      // 计算统计数据
      const tokenStats = {
        totalEarned: 0,
        totalUsed: 0,
        byType: {} as Record<string, number>,
        byFeature: {} as Record<string, number>,
        dailyUsage: [] as Array<{ date: string; usage: number }>
      };

      // 处理交易记录
      transactions.forEach((tx: any: any) => {
        if (tx.amount > 0) {
          tokenStats.totalEarned += tx.amount;
          tokenStats.byType[tx.type] = (tokenStats.byType[tx.type] || 0) + tx.amount;
        } else {
          tokenStats.totalUsed += Math.abs(tx.amount);
        }
      });

      // 处理使用日志
      const dailyUsageMap = new Map<string, number>();
      usageLogs.forEach((log: any: any) => {
        const dateStr = log.date.toISOString().split('T')[0];
        dailyUsageMap.set(dateStr, (dailyUsageMap.get(dateStr) || 0) + log.usage);
        tokenStats.byFeature[log.feature] = (tokenStats.byFeature[log.feature] || 0) + log.usage;
        tokenStats.totalUsed += log.usage;
      });

      // 转换每日使用量为数组
      tokenStats.dailyUsage = Array.from(dailyUsageMap.entries())
        .map(([date, usage]: any) => ({ date, usage }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30); // 只返回最近30天

      return tokenStats;
    } catch (error) {
      logger.error('获取用户Token统计失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取活跃用户列表（用于管理后台）
   */
  static async getActiveUsers(options: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      sortBy = 'lastLoginAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;

    try {
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: {
            ...(role && { role: role as any }),
            ...(status && { status: status as any }),
            status: 'ACTIVE'
          },
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            role: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
            loginCount: true,
            tokenBalance: true,
            // 只获取活跃订阅
            subscriptions: {
              where: { status: SubscriptionStatus.ACTIVE },
              select: {
                plan: {
                  select: {
                    name: true,
                    price: true
                  }
                }
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        prisma.user.count({
          where: {
            ...(role && { role: role as any }),
            ...(status && { status: status as any }),
            status: 'ACTIVE'
          }
        })
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('获取活跃用户列表失败', error as Error);
      throw error;
    }
  }

  /**
   * 更新用户最后登录信息
   */
  static async updateLastLogin(userId: string) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastLoginAt: new Date(),
          loginCount: {
            increment: 1
          }
        }
      });
    } catch (error) {
      logger.error('更新用户登录信息失败', error as Error);
      // 不抛出错误，避免影响登录流程
    }
  }
}