import { prisma } from '@/lib/prisma'
import { SubscriptionHelper } from './subscription-helper'

/**
 * 试用期管理服务
 */
export class TrialService {
  // Pro计划的默认配置
  private static readonly PRO_PLAN_CONFIG = {
    name: 'Pro',
    price: 298,
    tokenQuota: 10000,
    features: {
      siterank: {
        enabled: true,
        maxQueriesPerBatch: 500
      },
      batchopen: {
        enabled: true,
        maxUrlsPerBatch: 500,
        proxyRotation: true,
        automatedVersion: true
      },
      adscenter: {
        enabled: true,
        maxAccountsManaged: 10
      }
    }
  }

  /**
   * 为新用户分配14天Pro试用期
   */
  static async assignTrialToNewUser(userId: string): Promise<any> {
    try {
      // 检查用户是否已经有试用期或订阅
      const hasActiveSubscription = await SubscriptionHelper.hasActiveSubscription(userId);
      
      if (hasActiveSubscription) {
        console.log(`User ${userId} already has active subscription or trial`);
        return null;
      }

      // 获取或创建Pro计划
      const proPlan = await this.getOrCreateProPlan();

      // 创建14天试用期订阅（这会自动添加token）
      const trialSubscription = await SubscriptionHelper.createTrialSubscription(userId, proPlan.id);

      // 记录审计日志
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'trial_assigned',
          resource: 'subscription',
          category: 'billing',
          severity: 'info',
          outcome: 'success',
          details: JSON.stringify({
            planId: proPlan.id,
            planName: proPlan.name,
            trialDays: 14,
            trialEnd: trialSubscription.currentPeriodEnd.toISOString(),
            subscriptionId: trialSubscription.id
          })
        }
      });

      console.log(`Trial assigned to user ${userId}: ${trialSubscription.id}`);
      return trialSubscription;

    } catch (error) {
      console.error('Error assigning trial to user:', error);
      
      // 记录错误日志
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'trial_assignment_failed',
          resource: 'subscription',
          category: 'billing',
          severity: 'error',
          outcome: 'failure',
          details: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error" as any
          })
        }
      }).catch(console.error);

      throw error;
    }
  }

  /**
   * 检查并处理过期的试用期
   */
  static async checkTrialExpiration(): Promise<void> {
    try {
      // 使用SubscriptionHelper处理所有过期的订阅
      const results = await SubscriptionHelper.processExpiredSubscriptions();
      
      const trialResults = results.filter(result => 
        result.status === 'expired' || result.status === 'error'
      );

      console.log(`Processed ${trialResults.length} expired subscriptions`);

      // 为过期的试用用户创建免费订阅
      for (const result of trialResults) {
        if (result.status === 'expired') {
          try {
            await this.convertTrialToFree(result.userId);
          } catch (error) {
            console.error(`Failed to convert trial to free for user ${result.userId}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Error checking trial expiration:', error);
      throw error;
    }
  }

  /**
   * 将试用期用户转换为免费计划
   */
  static async convertTrialToFree(userId: string): Promise<void> {
    try {
      // 获取用户当前的试用期订阅
      const trialSubscription = await prisma.subscription.findFirst({
        where: {
          userId,
          provider: 'system',
          status: 'ACTIVE'
        },
        include: {
          plan: true
        }
      })

      if (!trialSubscription) {
        console.log(`No active trial found for user ${userId}`)
        return
      }

      // 获取或创建免费计划
      const freePlan = await this.getOrCreateFreePlan()

      // 使用事务处理转换
      await prisma.$transaction(async (tx: any) => {
        // 取消试用期订阅
        await tx.subscription.update({
          where: { id: trialSubscription.id },
          data: {
            status: 'EXPIRED',
            canceledAt: new Date(),
            cancelAtPeriodEnd: true
          }
        })

        // 创建免费计划订阅
        await tx.subscription.create({
          data: {
            userId,
            planId: freePlan.id,
            status: 'ACTIVE',
            provider: 'system',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1年后过期
          }
        })

        // 调整用户token余额（移除Pro试用期的额外token）
        await this.adjustTokenBalanceAfterTrialExpiry(tx, userId, trialSubscription.plan.tokenQuota, freePlan.tokenQuota)

        // 记录审计日志
        await tx.auditLog.create({
          data: {
            userId,
            action: 'trial_expired',
            resource: 'subscription',
            category: 'billing',
            severity: 'info',
            outcome: 'success',
            details: JSON.stringify({
              trialSubscriptionId: trialSubscription.id,
              newPlanId: freePlan.id,
              newPlanName: freePlan.name
            })
          }
        })
      })

      console.log(`Converted trial to free for user ${userId}`)

    } catch (error) {
      console.error('Error converting trial to free:', error)
      throw error
    }
  }

  /**
   * 获取用户的试用期状态
   */
  static async getTrialStatus(userId: string): Promise<{
    hasTrial: boolean
    isActive: boolean
    daysRemaining: number
    trialEnd?: Date
    planName?: string
  }> {
    try {
      const currentSubscription = await SubscriptionHelper.getCurrentSubscription(userId);

      if (!currentSubscription || currentSubscription.provider !== 'trial') {
        return {
          hasTrial: false,
          isActive: false,
          daysRemaining: 0
        };
      }

      const now = new Date();
      const trialEnd = currentSubscription.currentPeriodEnd;
      const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        hasTrial: true,
        isActive: daysRemaining > 0,
        daysRemaining,
        trialEnd,
        planName: currentSubscription.plan.name
      };

    } catch (error) {
      console.error('Error getting trial status:', error);
      throw error;
    }
  }

  /**
   * 获取或创建Pro计划
   */
  private static async getOrCreateProPlan() {
    let proPlan = await prisma.plan.findFirst({
      where: { name: 'Pro', status: 'ACTIVE' }
    })

    if (!proPlan) {
      proPlan = await prisma.plan.create({
        data: {
          name: this.PRO_PLAN_CONFIG.name,
          description: '高级套餐 - 14天免费试用',
          price: this.PRO_PLAN_CONFIG.price,
          currency: 'CNY',
          interval: 'MONTH',
          tokenQuota: this.PRO_PLAN_CONFIG.tokenQuota,
          features: this.PRO_PLAN_CONFIG.features,
          status: 'ACTIVE',
          sortOrder: 1,
          metadata: {
            type: 'pro',
            trialEligible: true
          }
        }
      })
    }

    return proPlan
  }

  /**
   * 获取或创建免费计划
   */
  private static async getOrCreateFreePlan() {
    let freePlan = await prisma.plan.findFirst({
      where: { name: 'Free', status: 'ACTIVE' }
    })

    if (!freePlan) {
      freePlan = await prisma.plan.create({
        data: {
          name: 'Free',
          description: '免费套餐',
          price: 0,
          currency: 'CNY',
          interval: 'MONTH',
          tokenQuota: 1000,
          features: {
            siterank: {
              enabled: true,
              maxQueriesPerBatch: 100
            },
            batchopen: {
              enabled: true,
              maxUrlsPerBatch: 200,
              basicVersion: true,
              silentVersion: true
            }
          },
          status: 'ACTIVE',
          sortOrder: 0,
          metadata: {
            type: 'free'
          }
        }
      })
    }

    return freePlan
  }

  /**
   * 为试用期用户调整token余额
   */
  private static async adjustTokenBalanceForTrial(userId: string, tokenQuota: number) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionTokenBalance: true }
      })

      if (!user) return

      const balanceBefore = user.subscriptionTokenBalance || 0
      const balanceAfter = balanceBefore + tokenQuota

      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTokenBalance: balanceAfter
        }
      })

      // 记录token交易
      await prisma.tokenTransaction.create({
        data: {
          userId,
          type: 'SUBSCRIPTION',
          amount: tokenQuota,
          balanceBefore,
          balanceAfter,
          source: 'trial_assignment',
          description: `14-day Pro trial token bonus: ${tokenQuota} tokens`
        }
      })

    } catch (error) {
      console.error('Error adjusting token balance for trial:', error)
      // 不抛出错误，避免影响试用期分配流程
    }
  }

  /**
   * 试用期过期后调整token余额
   */
  private static async adjustTokenBalanceAfterTrialExpiry(
    tx: any,
    userId: string,
    trialTokenQuota: number,
    freeTokenQuota: number
  ) {
    try {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { subscriptionTokenBalance: true }
      })

      if (!user) return

      const balanceBefore = user.subscriptionTokenBalance || 0
      
      // 计算需要移除的token数量（试用期额外获得的token）
      const tokensToRemove = Math.min(balanceBefore, trialTokenQuota - freeTokenQuota)
      const balanceAfter = Math.max(0, balanceBefore - tokensToRemove)

      await tx.user.update({
        where: { id: userId },
        data: {
          subscriptionTokenBalance: balanceAfter
        }
      })

      // 记录token交易
      if (tokensToRemove > 0) {
        await tx.tokenTransaction.create({
          data: {
            userId,
            type: 'SUBSCRIPTION',
            amount: -tokensToRemove,
            balanceBefore,
            balanceAfter,
            source: 'trial_expiry',
            description: `Trial expired - removed ${tokensToRemove} tokens`
          }
        })
      }

    } catch (error) {
      console.error('Error adjusting token balance after trial expiry:', error)
      throw error
    }
  }

  /**
   * 获取即将过期的试用期（用于发送提醒）
   */
  static async getExpiringTrials(daysBeforeExpiry: number = 3): Promise<any[]> {
    try {
      const reminderDate = new Date()
      reminderDate.setDate(reminderDate.getDate() + daysBeforeExpiry)

      const expiringTrials = await prisma.subscription.findMany({
        where: {
          provider: 'system',
          status: 'ACTIVE',
          currentPeriodEnd: {
            gte: new Date(),
            lte: reminderDate
          }
        },
        include: {
          user: true,
          plan: true
        }
      })

      return expiringTrials

    } catch (error) {
      console.error('Error getting expiring trials:', error)
      throw error
    }
  }
}