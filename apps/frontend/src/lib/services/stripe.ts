// Stripe integration disabled: lightweight stubs
export interface StripeConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  mode: 'test' | 'live';
  currency: string;
  supportedPaymentMethods: string[];
}

export class StripeService {
  constructor(secretKey: string) {
    // Stripe disabled
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
    throw new Error('Stripe is disabled');
  }

  /**
   * 创建客户
   */
  async createCustomer(params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }) {
    throw new Error('Stripe is disabled');
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
    throw new Error('Stripe is disabled');
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(subscriptionId: string, immediate = false) {
    throw new Error('Stripe is disabled');
  }

  /**
   * 创建产品
   */
  async createProduct(params: {
    name: string;
    description?: string;
    metadata?: Record<string, string>;
  }) {
    throw new Error('Stripe is disabled');
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
    throw new Error('Stripe is disabled');
  }

  /**
   * 验证 webhook 签名
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string) {
    throw new Error('Stripe is disabled');
  }

  /**
   * 获取支付意图
   */
  async retrievePaymentIntent(paymentIntentId: string) {
    throw new Error('Stripe is disabled');
  }

  /**
   * 确认支付意图
   */
  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId: string) {
    throw new Error('Stripe is disabled');
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
    throw new Error('Stripe is disabled');
  }

  /**
   * 获取余额
   */
  async retrieveBalance() {
    throw new Error('Stripe is disabled');
  }

  /**
   * 获取账户信息
   */
  async retrieveAccount() {
    throw new Error('Stripe is disabled');
  }

  /**
   * 创建支付链接
   */
  async createPaymentLink(params: {
    priceId: string;
    quantity?: number;
    metadata?: Record<string, string>;
  }) {
    throw new Error('Stripe is disabled');
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
    const results: any[] = [];

    for (const plan of plans) {
      try {
        // 创建产品
        throw new Error('Stripe is disabled');
      } catch (error) {
        results.push({
          plan: plan.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        });
      }
    }

    return results;
  }
}
