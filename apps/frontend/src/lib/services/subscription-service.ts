import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ResponseCode } from '@/lib/api/response'
import { Stripe } from 'stripe'

// Helper function to get Stripe instance
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not defined')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-07-30.basil'
  })
}

/**
 * 订阅管理服务
 */
export class SubscriptionService {
  /**
   * 获取用户当前订阅
   */
  static async getUserSubscription(userId: string) {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          currentPeriodEnd: { gt: new Date() }
        },
        include: {
          plan: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })

      return subscription
    } catch (error) {
      console.error('Error getting user subscription:', error)
      throw error
    }
  }

  /**
   * 获取可升级的计划
   */
  static async getAvailablePlans(currentPlanId?: string) {
    try {
      const plans = await prisma.plan.findMany({
        where: {
          isActive: true,
          id: { not: currentPlanId }
        },
        orderBy: { sortOrder: 'asc' }
      })

      return plans
    } catch (error) {
      console.error('Error getting available plans:', error)
      throw error
    }
  }

  /**
   * 创建升级/降级订单
   */
  static async createSubscriptionChange(
    userId: string,
    newPlanId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ) {
    try {
      // 获取当前订阅
      const currentSubscription = await this.getUserSubscription(userId)
      
      // 获取新计划
      const newPlan = await prisma.plan.findUnique({
        where: { id: newPlanId }
      })

      if (!newPlan) {
        throw new Error('Plan not found')
      }

      // 检查是否为同一计划
      if (currentSubscription?.planId === newPlanId) {
        throw new Error('Already subscribed to this plan')
      }

      // 计算价格调整
      const priceAdjustment = await this.calculatePriceAdjustment(
        currentSubscription,
        newPlan,
        billingCycle
      )

      // 创建 Stripe payment intent
      const stripe = getStripe()
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(priceAdjustment.amount * 100), // 转换为分
        currency: 'usd',
        metadata: {
          userId,
          newPlanId,
          billingCycle,
          type: 'subscription_change',
          currentSubscriptionId: currentSubscription?.id || null
        }
      })

      // Note: subscriptionChange table doesn't exist in schema, so we skip creating that record
      // Instead, we'll rely on the payment intent metadata to track the change

      return {
        clientSecret: paymentIntent.client_secret,
        priceAdjustment,
        newPlan
      }
    } catch (error) {
      console.error('Error creating subscription change:', error)
      throw error
    }
  }

  /**
   * 确认订阅变更
   */
  static async confirmSubscriptionChange(
    userId: string,
    paymentIntentId: string
  ) {
    try {
      // 验证支付
      const stripe = getStripe()
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Payment not completed')
      }

      const { newPlanId, billingCycle, currentSubscriptionId } = paymentIntent.metadata

      // 取消当前订阅（如果存在）
      if (currentSubscriptionId) {
        await prisma.subscription.update({
          where: { id: currentSubscriptionId },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
            cancelAtPeriodEnd: false
          }
        })
      }

      // 创建新订阅
      const newSubscription = await prisma.subscription.create({
        data: {
          userId,
          planId: newPlanId,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: this.calculatePeriodEnd(
            billingCycle === 'yearly'
          ),
          provider: 'stripe',
          providerSubscriptionId: paymentIntent.id
        }
      })

      // 创建支付记录
      await prisma.payment.create({
        data: {
          userId,
          subscriptionId: newSubscription.id,
          amount: paymentIntent.amount / 100, // Convert from cents to dollars
          status: 'COMPLETED',
          provider: 'stripe',
          providerId: paymentIntentId,
          metadata: {
            type: 'subscription_change',
            billingCycle
          }
        }
      })

      // 调整用户令牌余额
      await this.adjustTokenBalance(userId, newPlanId)

      return newSubscription
    } catch (error) {
      console.error('Error confirming subscription change:', error)
      throw error
    }
  }

  /**
   * 取消订阅
   */
  static async cancelSubscription(userId: string, reason?: string) {
    try {
      const subscription = await this.getUserSubscription(userId)
      
      if (!subscription) {
        throw new Error('No active subscription found')
      }

      // 如果是 Stripe 订阅，取消 Stripe 订阅
      if (subscription.providerSubscriptionId) {
        const stripe = getStripe()
        await stripe.subscriptions.update(subscription.providerSubscriptionId, {
          cancel_at_period_end: true
        })
      }

      // 更新本地订阅状态
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          canceledAt: new Date()
        }
      })

      // 记录取消原因
      if (reason) {
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'subscription_canceled',
            resource: 'subscription',
            category: 'billing',
            severity: 'info',
            outcome: 'success',
            details: JSON.stringify({ reason })
          }
        })
      }

      return true
    } catch (error) {
      console.error('Error canceling subscription:', error)
      throw error
    }
  }

  /**
   * 恢复已取消的订阅
   */
  static async reactivateSubscription(userId: string) {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: { gt: new Date() }
        }
      })

      if (!subscription) {
        throw new Error('No cancellable subscription found')
      }

      // 如果是 Stripe 订阅，恢复 Stripe 订阅
      if (subscription.providerSubscriptionId) {
        const stripe = getStripe()
        await stripe.subscriptions.update(subscription.providerSubscriptionId, {
          cancel_at_period_end: false
        })
      }

      // 更新本地订阅状态
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: false,
          canceledAt: null
        }
      })

      return true
    } catch (error) {
      console.error('Error reactivating subscription:', error)
      throw error
    }
  }

  /**
   * 计算价格调整
   */
  private static async calculatePriceAdjustment(
    currentSubscription: any,
    newPlan: any,
    billingCycle: 'monthly' | 'yearly'
  ) {
    try {
      const newPrice = billingCycle === 'yearly' 
        ? (newPlan.stripeYearlyPriceId ? newPlan.price * 12 * 0.8 : newPlan.price * 12) // 年付8折
        : newPlan.price

      if (!currentSubscription) {
        // 新订阅
        return {
          amount: newPrice,
          type: 'new',
          prorated: false
        }
      }

      // 计算剩余天数
      const remainingDays = Math.ceil(
        (currentSubscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )

      if (remainingDays <= 0) {
        // 已过期，全新订阅
        return {
          amount: newPrice,
          type: 'renewal',
          prorated: false
        }
      }

      const currentPrice = currentSubscription.plan.price
      const dailyCurrentPrice = currentPrice / 30
      const dailyNewPrice = newPrice / 30

      const unusedAmount = dailyCurrentPrice * remainingDays
      const newAmount = dailyNewPrice * remainingDays

      const adjustment = newAmount - unusedAmount

      return {
        amount: Math.max(0, adjustment), // 最小为0
        type: adjustment > 0 ? 'upgrade' : 'downgrade',
        prorated: true,
        remainingDays,
        unusedAmount,
        newAmount
      }
    } catch (error) {
      console.error('Error calculating price adjustment:', error)
      throw error
    }
  }

  /**
   * 计算订阅周期结束时间
   */
  private static calculatePeriodEnd(isYearly: boolean): Date {
    const date = new Date()
    if (isYearly) {
      date.setFullYear(date.getFullYear() + 1)
    } else {
      date.setMonth(date.getMonth() + 1)
    }
    return date
  }

  /**
   * 调整用户令牌余额 - 使用新的统一Token系统
   */
  private static async adjustTokenBalance(userId: string, newPlanId: string) {
    try {
      const newPlan = await prisma.plan.findUnique({
        where: { id: newPlanId }
      })

      if (!newPlan) return

      // 计算应增加的令牌数
      const tokensToAdd = newPlan.tokenQuota || 0

      // 使用新的统一Token系统添加订阅Token
      if (tokensToAdd > 0) {
        const { TokenExpirationService } = await import('./token-expiration-service');
        await TokenExpirationService.addTokensWithExpiration(
          userId,
          tokensToAdd,
          'SUBSCRIPTION' as any,
          undefined, // 过期时间将根据订阅周期自动设置
          {
            source: 'subscription_upgrade',
            planId: newPlanId,
            planName: newPlan.name,
            description: `Token bonus for plan: ${newPlan.name}`
          }
        );
      }
    } catch (error) {
      console.error('Error adjusting token balance:', error)
      // 不抛出错误，避免影响订阅流程
    }
  }

  /**
   * 获取订阅变更历史 - 简化版本，不依赖subscriptionChange表
   */
  static async getSubscriptionHistory(userId: string) {
    try {
      // 获取用户的订阅历史
      const subscriptions = await prisma.subscription.findMany({
        where: { userId },
        include: {
          plan: true,
          payments: {
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      // 转换为历史记录格式
      const history = subscriptions.map(subscription => ({
        id: subscription.id,
        userId: subscription.userId,
        currentSubscriptionId: subscription.id,
        newSubscriptionId: subscription.id,
        newPlanId: subscription.planId,
        billingCycle: 'monthly', // Default value
        priceAdjustment: subscription.plan.price,
        status: subscription.status,
        stripePaymentIntentId: subscription.providerSubscriptionId,
        createdAt: subscription.createdAt,
        completedAt: subscription.currentPeriodEnd,
        currentSubscription: subscription,
        newSubscription: subscription,
        newPlan: subscription.plan
      }))

      return history
    } catch (error) {
      console.error('Error getting subscription history:', error)
      throw error
    }
  }
}