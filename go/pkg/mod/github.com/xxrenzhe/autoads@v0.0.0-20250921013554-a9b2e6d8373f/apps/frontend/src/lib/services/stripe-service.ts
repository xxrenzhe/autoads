// Stripe disabled: remove runtime dependency
import { prisma } from '@/lib/db'
import { PlanService } from './plan-service'
// Note: Notification service has been removed for performance optimization

// Initialize Stripe conditionally
let stripe: any = null

function getStripe(): any {
  throw new Error('Stripe integration is disabled')
}

export interface SubscriptionData {
  id: string
  userId: string
  planId: string
  stripeSubscriptionId: string
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

export interface PaymentData {
  id: string
  userId: string
  subscriptionId?: string
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  stripePaymentIntentId?: string
  metadata?: Record<string, any>
}

export class StripeService {
  /**
   * 创建订阅
   */
  static async createSubscription(
    userId: string,
    planId: string
  ): Promise<{
    success: boolean
    subscription?: SubscriptionData
    clientSecret?: string
    error?: string
  }> {
    try {
      // 获取用户信息
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          stripeCustomerId: true
        }
      })

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        }
      }

      // 获取套餐信息
      const plan = await PlanService.getPlanById(planId)
      if (!plan) {
        return {
          success: false,
          error: 'Plan not found'
        }
      }

      if (!plan.stripePriceId) {
        return {
          success: false,
          error: 'Plan does not have Stripe price ID configured'
        }
      }

      // 创建或获取Stripe客户
      let stripeCustomerId = user.stripeCustomerId
      if (!stripeCustomerId) {
        const customer = await getStripe().customers.create({
          email: user.email,
          name: user.name || undefined,
          metadata: {
            userId: user.id
          }
        })

        stripeCustomerId = customer.id

        // 更新用户的Stripe客户ID
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId }
        })
      }

      // 创建Stripe订阅
      const stripeSubscription = await getStripe().subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: plan.stripePriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId,
          planId
        }
      })

      // 创建本地订阅记录
      const subscription = await prisma.subscription.create({
        data: {
          userId,
          planId,
          status: stripeSubscription.status.toUpperCase() as any,
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: (stripeSubscription as any).cancel_at_period_end,
          providerSubscriptionId: stripeSubscription.id
        }
      })

      // 获取客户端密钥用于前端确认支付
      const invoice = stripeSubscription.latest_invoice as any
      const paymentIntent = (invoice as any).payment_intent as any

      return {
        success: true,
        subscription: {
          id: subscription.id,
          userId: subscription.userId,
          planId: subscription.planId,
          stripeSubscriptionId: stripeSubscription.id,
          status: subscription.status as any,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
        },
        clientSecret: paymentIntent.client_secret || undefined
      }
    } catch (error) {
      console.error('Failed to create subscription:', error)
      return {
        success: false,
        error: 'Failed to create subscription'
      }
    }
  }

  /**
   * 取消订阅
   */
  static async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<{
    success: boolean
    subscription?: SubscriptionData
    error?: string
  }> {
    try {
      // 获取本地订阅记录
      const localSubscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: {
            select: { id: true, email: true, name: true }
          },
          plan: {
            select: { name: true }
          }
        }
      })

      if (!localSubscription || !localSubscription.providerSubscriptionId) {
        return {
          success: false,
          error: 'Subscription not found'
        }
      }

      // 取消Stripe订阅
      const stripeSubscription = await getStripe().subscriptions.update(
        localSubscription.providerSubscriptionId,
        {
          cancel_at_period_end: cancelAtPeriodEnd
        }
      )

      // 更新本地订阅记录
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          cancelAtPeriodEnd,
          ...(stripeSubscription.status === 'canceled' && {
            status: 'CANCELED',
            canceledAt: new Date()
          })
        }
      })

      // 发送取消确认通知
      if (cancelAtPeriodEnd) {
        // await NotificationService.sendNotification({
        //   userId: localSubscription.user.id,
        //   template: 'SUBSCRIPTION_CANCELED',
        //   variables: {
        //     planName: localSubscription.plan.name,
        //     endDate: new Date((stripeSubscription as any).current_period_end * 1000).toLocaleDateString()
        //   }
        // })
      }

      return {
        success: true,
        subscription: {
          id: updatedSubscription.id,
          userId: updatedSubscription.userId,
          planId: updatedSubscription.planId,
          stripeSubscriptionId: stripeSubscription.id,
          status: updatedSubscription.status as any,
          currentPeriodStart: updatedSubscription.currentPeriodStart,
          currentPeriodEnd: updatedSubscription.currentPeriodEnd,
          cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd
        }
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      return {
        success: false,
        error: 'Failed to cancel subscription'
      }
    }
  }

  /**
   * 处理Stripe Webhook事件
   */
  static async handleWebhook(
    body: string,
    signature: string
  ): Promise<{
    success: boolean
    processed: boolean
    error?: string
  }> {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      if (!webhookSecret) {
        return {
          success: false,
          processed: false,
          error: 'Webhook secret not configured'
        }
      }

      // 验证webhook签名
      const event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)

      console.log(`Processing Stripe webhook: ${event.type}`)

      let processed = false

      switch (event.type) {
        case 'invoice.payment_succeeded':
          processed = await this.handlePaymentSucceeded(event.data.object as any)
          break

        case 'invoice.payment_failed':
          processed = await this.handlePaymentFailed(event.data.object as any)
          break

        case 'customer.subscription.updated':
          processed = await this.handleSubscriptionUpdated(event.data.object as any)
          break

        case 'customer.subscription.deleted':
          processed = await this.handleSubscriptionDeleted(event.data.object as any)
          break

        default:
          console.log(`Unhandled webhook event type: ${event.type}`)
          processed = false
      }

      return {
        success: true,
        processed
      }
    } catch (error) {
      console.error('Failed to handle webhook:', error)
      return {
        success: false,
        processed: false,
        error: 'Failed to process webhook'
      }
    }
  }

  /**
   * 处理支付成功事件
   */
  private static async handlePaymentSucceeded(invoice: any): Promise<boolean> {
    try {
      const subscriptionId = (invoice as any).subscription as string
      if (!subscriptionId) return false

      // 获取订阅信息
      const stripeSubscription = await getStripe().subscriptions.retrieve(subscriptionId)
      const userId = stripeSubscription.metadata.userId

      if (!userId) return false

      // 更新本地订阅状态
      await prisma.subscription.updateMany({
        where: {
          userId,
          providerSubscriptionId: subscriptionId
        },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000)
        }
      })

      // 获取套餐信息并重置Token余额
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          providerSubscriptionId: subscriptionId
        },
        include: { plan: true }
      })

      if (subscription) {
        // 重置用户Token余额到套餐配额
        await prisma.user.update({
          where: { id: userId },
          data: { tokenBalance: subscription.plan?.tokenQuota }
        })

        // 发送订阅确认通知
        // await NotificationService.sendNotification({
        //   userId,
        //   template: 'SUBSCRIPTION_CONFIRMED',
        //   variables: {
        //     planName: subscription.plan?.name,
        //     tokenQuota: subscription.plan?.tokenQuota,
        //     billingPeriod: subscription.plan?.interval === 'MONTH' ? 'Monthly' : 'Yearly',
        //     nextBillingDate: new Date((stripeSubscription as any).current_period_end * 1000).toLocaleDateString()
        //   }
        // })
      }

      // 记录支付记录
      await prisma.payment.create({
        data: {
          userId,
          subscriptionId: subscription?.id,
          amount: (invoice as any).amount_paid / 100, // Convert from cents
          currency: invoice.currency.toUpperCase(),
          status: 'COMPLETED',
          providerId: (invoice as any).payment_intent as string,
          metadata: {
            invoiceId: invoice.id,
            stripeSubscriptionId: subscriptionId
          }
        }
      })

      return true
    } catch (error) {
      console.error('Failed to handle payment succeeded:', error)
      return false
    }
  }

  /**
   * 处理支付失败事件
   */
  private static async handlePaymentFailed(invoice: any): Promise<boolean> {
    try {
      const subscriptionId = (invoice as any).subscription as string
      if (!subscriptionId) return false

      const stripeSubscription = await getStripe().subscriptions.retrieve(subscriptionId)
      const userId = stripeSubscription.metadata.userId

      if (!userId) return false

      // 更新订阅状态
      await prisma.subscription.updateMany({
        where: {
          userId,
          providerSubscriptionId: subscriptionId
        },
        data: {
          status: 'PAST_DUE'
        }
      })

      // 记录失败的支付
      await prisma.payment.create({
        data: {
          userId,
          amount: (invoice as any).amount_due / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'FAILED',
          providerId: (invoice as any).payment_intent as string,
          metadata: {
            invoiceId: invoice.id,
            stripeSubscriptionId: subscriptionId,
            failureReason: 'Payment failed'
          }
        }
      })

      // 发送支付失败通知
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          providerSubscriptionId: subscriptionId
        },
        include: { plan: true }
      })

      if (subscription) {
        // await NotificationService.sendNotification({
        //   userId,
        //   template: 'PAYMENT_FAILED',
        //   variables: {
        //     planName: subscription.plan?.name
        //   }
        // })
      }

      return true
    } catch (error) {
      console.error('Failed to handle payment failed:', error)
      return false
    }
  }

  /**
   * 处理订阅更新事件
   */
  private static async handleSubscriptionUpdated(subscription: any): Promise<boolean> {
    try {
      const userId = subscription.metadata.userId
      if (!userId) return false

      // 更新本地订阅记录
      await prisma.subscription.updateMany({
        where: {
          userId,
          providerSubscriptionId: subscription.id
        },
        data: {
          status: subscription.status.toUpperCase() as any,
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end
        }
      })

      return true
    } catch (error) {
      console.error('Failed to handle subscription updated:', error)
      return false
    }
  }

  /**
   * 处理订阅删除事件
   */
  private static async handleSubscriptionDeleted(subscription: any): Promise<boolean> {
    try {
      const userId = subscription.metadata.userId
      if (!userId) return false

      // 更新本地订阅状态
      await prisma.subscription.updateMany({
        where: {
          userId,
          providerSubscriptionId: subscription.id
        },
        data: {
          status: 'CANCELED',
          canceledAt: new Date()
        }
      })

      // 重置用户到免费套餐
      const freePlan = await PlanService.getPlanById('free')
      if (freePlan) {
        await prisma.user.update({
          where: { id: userId },
          data: { tokenBalance: freePlan.tokenQuota }
        })
      }

      return true
    } catch (error) {
      console.error('Failed to handle subscription deleted:', error)
      return false
    }
  }

  /**
   * 获取用户的订阅信息
   */
  static async getUserSubscription(userId: string): Promise<SubscriptionData | null> {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: { in: ['ACTIVE', 'PAST_DUE', 'PENDING'] }
        },
        orderBy: { createdAt: 'desc' }
      })

      if (!subscription || !subscription.providerSubscriptionId) {
        return null
      }

      return {
        id: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        stripeSubscriptionId: subscription.providerSubscriptionId,
        status: subscription.status.toLowerCase() as any,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      }
    } catch (error) {
      console.error('Failed to get user subscription:', error)
      return null
    }
  }

  /**
   * 创建支付意图（一次性支付）
   */
  static async createPaymentIntent(
    userId: string,
    amount: number,
    currency: string = 'usd',
    metadata?: Record<string, any>
  ): Promise<{
    success: boolean
    clientSecret?: string
    paymentIntentId?: string
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          stripeCustomerId: true
        }
      })

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        }
      }

      // 创建支付意图
      const paymentIntent = await getStripe().paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: user.stripeCustomerId || undefined,
        metadata: {
          userId,
          ...metadata
        }
      })

      // 记录支付意图
      await prisma.payment.create({
        data: {
          userId,
          amount,
          currency: currency.toUpperCase(),
          status: 'PENDING',
          providerId: paymentIntent.id,
          metadata: {
            paymentIntentId: paymentIntent.id,
            ...metadata
          }
        }
      })

      return {
        success: true,
        clientSecret: paymentIntent.client_secret || undefined,
        paymentIntentId: paymentIntent.id
      }
    } catch (error) {
      console.error('Failed to create payment intent:', error)
      return {
        success: false,
        error: 'Failed to create payment intent'
      }
    }
  }

  /**
   * 获取订阅统计信息
   */
  static async getSubscriptionStats(): Promise<{
    totalSubscriptions: number
    activeSubscriptions: number
    monthlyRevenue: number
    yearlyRevenue: number
    churnRate: number
    byPlan: Record<string, number>
  }> {
    try {
      const [
        totalSubs,
        activeSubs,
        revenueData,
        planStats
      ] = await Promise.all([
        prisma.subscription.count(),
        prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        prisma.subscription.findMany({
          where: { status: 'ACTIVE' },
          include: {
            plan: {
              select: { price: true, interval: true }
            }
          }
        }),
        prisma.subscription.groupBy({
          by: ['planId'],
          where: { status: 'ACTIVE' },
          _count: { planId: true }
        })
      ])

      // Calculate revenue
      let monthlyRevenue = 0
      let yearlyRevenue = 0

      revenueData.forEach((sub: {
        plan: {
          price: number;
          interval: string;
        };
      }) => {
        if (sub.plan.interval === 'MONTH') {
          monthlyRevenue += sub.plan.price
          yearlyRevenue += sub.plan.price * 12
        } else {
          yearlyRevenue += sub.plan.price
          monthlyRevenue += sub.plan.price / 12
        }
      })

      // Calculate churn rate (simplified)
      const churnRate = totalSubs > 0 ? ((totalSubs - activeSubs) / totalSubs) * 100 : 0

      // Plan distribution
      const byPlan = planStats.reduce((acc: Record<string, number>, stat: {
        planId: string;
        _count: { planId: number };
      }) => {
        acc[stat.planId] = stat._count.planId
        return acc
      }, {} as Record<string, number>)

      return {
        totalSubscriptions: totalSubs,
        activeSubscriptions: activeSubs,
        monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
        yearlyRevenue: Math.round(yearlyRevenue * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100,
        byPlan
      }
    } catch (error) {
      console.error('Failed to get subscription stats:', error)
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        monthlyRevenue: 0,
        yearlyRevenue: 0,
        churnRate: 0,
        byPlan: {}
      }
    }
  }

  /**
   * 同步Stripe价格到本地套餐
   */
  static async syncStripePrices(): Promise<{
    success: boolean
    synced: number
    error?: string
  }> {
    try {
      const prices = await getStripe().prices.list({
        active: true,
        limit: 100
      })

      let synced = 0

      for (const price of prices.data) {
        if (price.metadata.planName) {
          const planName = price.metadata.planName
          const interval = price.recurring?.interval === 'year' ? 'YEAR' : 'MONTH'

          const updateData: any = {}
          if (interval === 'MONTH') {
            updateData.stripePriceId = price.id
          } else {
            updateData.stripeYearlyPriceId = price.id
          }

          const updated = await prisma.plan.updateMany({
            where: { name: planName },
            data: updateData
          })

          if (updated.count > 0) {
            synced++
          }
        }
      }

      return {
        success: true,
        synced
      }
    } catch (error) {
      console.error('Failed to sync Stripe prices:', error)
      return {
        success: false,
        synced: 0,
        error: 'Failed to sync Stripe prices'
      }
    }
  }

  /**
   * 创建Stripe客户门户会话
   */
  static async createPortalSession(
    userId: string,
    returnUrl: string
  ): Promise<{
    success: boolean
    url?: string
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true }
      })

      if (!user?.stripeCustomerId) {
        return {
          success: false,
          error: 'User does not have a Stripe customer ID'
        }
      }

      const session = await getStripe().billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl
      })

      return {
        success: true,
        url: session.url
      }
    } catch (error) {
      console.error('Failed to create portal session:', error)
      return {
        success: false,
        error: 'Failed to create portal session'
      }
    }
  }

  /**
   * 检索 Checkout Session
   */
  static async retrieveCheckoutSession(sessionId: string): Promise<any | null> {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'payment_intent']
      })
      return session
    } catch (error) {
      console.error('Failed to retrieve checkout session:', error)
      return null
    }
  }

  /**
   * 检索订阅
   */
  static async retrieveSubscription(subscriptionId: string): Promise<any | null> {
    try {
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
      return subscription
    } catch (error) {
      console.error('Failed to retrieve subscription:', error)
      return null
    }
  }

  /**
   * 检索发票
   */
  static async retrieveInvoice(invoiceId: string): Promise<any | null> {
    try {
      const invoice = await getStripe().invoices.retrieve(invoiceId)
      return invoice
    } catch (error) {
      console.error('Failed to retrieve invoice:', error)
      return null
    }
  }

  /**
   * 列出发票
   */
  static async listInvoices(options: {
    customer?: string
    subscription?: string
    limit?: number
    starting_after?: string
  } = {}): Promise<{
    success: boolean
    data?: any[]
    error?: string
  }> {
    try {
      const invoices = await getStripe().invoices.list({
        customer: options.customer,
        subscription: options.subscription,
        limit: options.limit || 10,
        starting_after: options.starting_after
      })

      return {
        success: true,
        data: invoices.data
      }
    } catch (error) {
      console.error('Failed to list invoices:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 创建客户
   */
  static async createCustomer(data: {
    email: string
    name?: string
    metadata?: Record<string, string>
  }): Promise<any> {
    try {
      const customer = await getStripe().customers.create({
        email: data.email,
        name: data.name,
        metadata: data.metadata
      })
      return customer
    } catch (error) {
      console.error('Failed to create customer:', error)
      throw error
    }
  }

  /**
   * 创建发票
   */
  static async createInvoice(data: {
    customerId: string
    description?: string
    dueDate?: number
    metadata?: Record<string, string>
  }): Promise<any> {
    try {
      const invoice = await getStripe().invoices.create({
        customer: data.customerId,
        description: data.description,
        due_date: data.dueDate,
        metadata: data.metadata
      })
      return invoice
    } catch (error) {
      console.error('Failed to create invoice:', error)
      throw error
    }
  }

  /**
   * 创建发票项目
   */
  static async createInvoiceItem(data: {
    customerId: string
    invoiceId?: string
    amount: number
    currency: string
    description?: string
  }): Promise<any> {
    try {
      const invoiceItem = await getStripe().invoiceItems.create({
        customer: data.customerId,
        invoice: data.invoiceId,
        amount: data.amount,
        currency: data.currency,
        description: data.description
      })
      return invoiceItem
    } catch (error) {
      console.error('Failed to create invoice item:', error)
      throw error
    }
  }

  /**
   * 完成发票
   */
  static async finalizeInvoice(invoiceId: string): Promise<any> {
    try {
      const invoice = await getStripe().invoices.finalizeInvoice(invoiceId)
      return invoice
    } catch (error) {
      console.error('Failed to finalize invoice:', error)
      throw error
    }
  }
}
