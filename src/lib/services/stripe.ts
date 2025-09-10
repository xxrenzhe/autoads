import Stripe from 'stripe';

export interface StripeConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  mode: 'test' | 'live';
  currency: string;
  supportedPaymentMethods: string[];
}

export class StripeService {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-07-30.basil',
    });
  }

  /**
   * 创建支付意图
   */
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    customerId?: string;
    paymentMethodTypes?: string[];
    metadata?: Record<string, string>;
  }) {
    return await this.stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100), // 转换为分
      currency: params.currency.toLowerCase(),
      customer: params.customerId,
      payment_method_types: params.paymentMethodTypes || ['card'],
      metadata: params.metadata,
    });
  }

  /**
   * 创建客户
   */
  async createCustomer(params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }) {
    return await this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });
  }

  /**
   * 创建订阅
   */
  async createSubscription(params: {
    customerId: string;
    priceId: string;
    trialPeriodDays?: number;
    metadata?: Record<string, string>;
  }) {
    return await this.stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      trial_period_days: params.trialPeriodDays,
      metadata: params.metadata,
    });
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(subscriptionId: string, immediate = false) {
    if (immediate) {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  /**
   * 创建产品
   */
  async createProduct(params: {
    name: string;
    description?: string;
    metadata?: Record<string, string>;
  }) {
    return await this.stripe.products.create({
      name: params.name,
      description: params.description,
      metadata: params.metadata,
    });
  }

  /**
   * 创建价格
   */
  async createPrice(params: {
    productId: string;
    unitAmount: number;
    currency: string;
    interval: 'day' | 'week' | 'month' | 'year';
    intervalCount?: number;
    metadata?: Record<string, string>;
  }) {
    return await this.stripe.prices.create({
      product: params.productId,
      unit_amount: Math.round(params.unitAmount * 100),
      currency: params.currency.toLowerCase(),
      recurring: {
        interval: params.interval,
        interval_count: params.intervalCount,
      },
      metadata: params.metadata,
    });
  }

  /**
   * 验证 webhook 签名
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string) {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  /**
   * 获取支付意图
   */
  async retrievePaymentIntent(paymentIntentId: string) {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * 确认支付意图
   */
  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId: string) {
    return await this.stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });
  }

  /**
   * 创建退款
   */
  async createRefund(params: {
    paymentIntentId: string;
    amount?: number;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
    metadata?: Record<string, string>;
  }) {
    return await this.stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amount ? Math.round(params.amount * 100) : undefined,
      reason: params.reason,
      metadata: params.metadata,
    });
  }

  /**
   * 获取余额
   */
  async retrieveBalance() {
    return await this.stripe.balance.retrieve();
  }

  /**
   * 获取账户信息
   */
  async retrieveAccount() {
    return await this.stripe.accounts.retrieve();
  }

  /**
   * 创建支付链接
   */
  async createPaymentLink(params: {
    priceId: string;
    quantity?: number;
    metadata?: Record<string, string>;
  }) {
    return await this.stripe.paymentLinks.create({
      line_items: [
        {
          price: params.priceId,
          quantity: params.quantity || 1,
        },
      ],
      metadata: params.metadata,
    });
  }

  /**
   * 初始化 Stripe 产品和价格
   */
  async initializeProductsAndPrices(plans: Array<{
    name: string;
    description: string;
    price: number;
    currency: string;
    interval: 'day' | 'week' | 'month' | 'year';
    metadata?: Record<string, string>;
  }>) {
    const results = [];

    for (const plan of plans) {
      try {
        // 创建产品
        const product = await this.createProduct({
          name: plan.name,
          description: plan.description,
          metadata: plan.metadata,
        });

        // 创建价格
        const price = await this.createPrice({
          productId: product.id,
          unitAmount: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          metadata: plan.metadata,
        });

        results.push({
          plan: plan.name,
          productId: product.id,
          priceId: price.id,
          success: true,
        });
      } catch (error) {
        results.push({
          plan: plan.name,
          error: error instanceof Error ? error.message : "Unknown error" as any,
          success: false,
        });
      }
    }

    return results;
  }
}