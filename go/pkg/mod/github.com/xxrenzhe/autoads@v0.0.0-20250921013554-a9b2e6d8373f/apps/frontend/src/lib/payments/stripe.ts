import type {
  StripeEvent,
  StripeSubscription as StripeSubscriptionLite,
  StripeInvoice as StripeInvoiceLite,
  StripeCheckoutSession as StripeCheckoutSessionLite,
  BillingPortalSession,
  ApiList as StripeApiList,
  InvoiceItem as StripeInvoiceItemLite,
} from '../../types/stripe-lite'
import { prisma } from '@/lib/db'

// Initialize Stripe conditionally
let stripe: any | null = null

function getStripe(): any {
  return stripe as any
}

export interface StripeCustomerData {
  email: string
  name?: string
  phone?: string
  // Relax type to avoid namespace/type issues across TS configs
  address?: any
  metadata?: Record<string, string>
}

export interface StripeSubscriptionData {
  customerId: string
  priceId: string
  trialPeriodDays?: number
  couponId?: string
  metadata?: Record<string, string>
}

export interface StripeCheckoutSessionData {
  customerId?: string
  customerEmail?: string
  priceId: string
  successUrl: string
  cancelUrl: string
  trialPeriodDays?: number
  couponId?: string
  allowPromotionCodes?: boolean
  metadata?: Record<string, string>
}

export interface StripeInvoiceData {
  customerId: string
  description?: string
  metadata?: Record<string, string>
  dueDate?: number
}

export class StripeService {
  /**
   * Customer Management
   */
  
  // Create a Stripe customer
  static async createCustomer(data: StripeCustomerData): Promise<any> {
    try {
      const customer = await getStripe().customers.create({
        email: data.email,
        name: data.name,
        phone: data.phone,
        address: data.address,
        metadata: data.metadata || {}
      })
      return customer
    } catch (error) {
      throw new Error(`Failed to create Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Update a Stripe customer
  static async updateCustomer(customerId: string, data: Partial<StripeCustomerData>): Promise<any> {
    try {
      const customer = await getStripe().customers.update(customerId, {
        email: data.email,
        name: data.name,
        phone: data.phone,
        address: data.address,
        metadata: data.metadata
      })
      return customer
    } catch (error) {
      throw new Error(`Failed to update Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Retrieve a customer
  static async retrieveCustomer(customerId: string): Promise<any> {
    try {
      const customer = await getStripe().customers.retrieve(customerId) as any
      return customer
    } catch (error) {
      throw new Error(`Failed to retrieve Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Delete a customer
  static async deleteCustomer(customerId: string): Promise<any> {
    try {
      return await getStripe().customers.del(customerId)
    } catch (error) {
      throw new Error(`Failed to delete Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Product and Price Management
   */

  // Create a product in Stripe
  static async createProduct(name: string, description?: string, metadata?: Record<string, string>): Promise<any> {
    try {
      const product = await getStripe().products.create({
        name,
        description,
        metadata: metadata || {}
      })
      return product
    } catch (error) {
      throw new Error(`Failed to create Stripe product: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Update a product
  static async updateProduct(productId: string, updates: Partial<{
    name: string
    description: string
    active: boolean
    metadata: Record<string, string>
  }>): Promise<any> {
    try {
      return await getStripe().products.update(productId, updates)
    } catch (error) {
      throw new Error(`Failed to update Stripe product: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Create a price for a product
  static async createPrice(
    productId: string, 
    amount: number, 
    currency: string = 'usd', 
    interval: 'month' | 'year' = 'month',
    metadata?: Record<string, string>
  ): Promise<any> {
    try {
      const price = await getStripe().prices.create({
        product: productId,
        unit_amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        recurring: {
          interval,
        },
        metadata: metadata || {}
      })
      return price
    } catch (error) {
      throw new Error(`Failed to create Stripe price: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Create a one-time price
  static async createOneTimePrice(
    productId: string,
    amount: number,
    currency: string = 'usd',
    metadata?: Record<string, string>
  ): Promise<any> {
    try {
      const price = await getStripe().prices.create({
        product: productId,
        unit_amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        metadata: metadata || {}
      })
      return price
    } catch (error) {
      throw new Error(`Failed to create one-time Stripe price: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Subscription Management
   */

  // Create a subscription
  static async createSubscription(data: StripeSubscriptionData): Promise<StripeSubscriptionLite> {
    try {
      const subscriptionData: any = {
        customer: data.customerId,
        items: [{ price: data.priceId }],
        metadata: data.metadata || {}
      }

      if (data.trialPeriodDays) {
        subscriptionData.trial_period_days = data.trialPeriodDays
      }

      if (data.couponId) {
        subscriptionData.discounts = [{ coupon: data.couponId }]
      }

      const subscription = await getStripe().subscriptions.create(subscriptionData)
      return subscription
    } catch (error) {
      throw new Error(`Failed to create Stripe subscription: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Retrieve a subscription
  static async retrieveSubscription(subscriptionId: string): Promise<StripeSubscriptionLite> {
    try {
      return await getStripe().subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method', 'customer', 'items.data.price.product']
      })
    } catch (error) {
      throw new Error(`Failed to retrieve Stripe subscription: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Update a subscription
  static async updateSubscription(subscriptionId: string, updates: any): Promise<StripeSubscriptionLite> {
    try {
      return await getStripe().subscriptions.update(subscriptionId, updates)
    } catch (error) {
      throw new Error(`Failed to update Stripe subscription: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Cancel a subscription
  static async cancelSubscription(subscriptionId: string, immediately = false): Promise<StripeSubscriptionLite> {
    try {
      if (immediately) {
        return await getStripe().subscriptions.cancel(subscriptionId)
      } else {
        return await getStripe().subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        })
      }
    } catch (error) {
      throw new Error(`Failed to cancel Stripe subscription: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Resume a subscription
  static async resumeSubscription(subscriptionId: string): Promise<StripeSubscriptionLite> {
    try {
      return await getStripe().subscriptions.update(subscriptionId, {
        cancel_at_period_end: false
      })
    } catch (error) {
      throw new Error(`Failed to resume Stripe subscription: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Change subscription plan with options
  static async changeSubscriptionPlan(
    subscriptionId: string, 
    newPriceId: string, 
    options?: {
      prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
      billingCycleAnchor?: 'unchanged' | 'now'
      couponId?: string
    }
  ): Promise<StripeSubscriptionLite> {
    try {
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId)

      const updateParams: any = {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId
        }],
        proration_behavior: options?.prorationBehavior || 'create_prorations'
      }

      if (options?.billingCycleAnchor) {
        updateParams.billing_cycle_anchor = options.billingCycleAnchor
      }

      if (options?.couponId) {
        updateParams.discounts = [{ coupon: options.couponId }]
      }

      return await getStripe().subscriptions.update(subscriptionId, updateParams)
    } catch (error) {
      throw new Error(`Failed to change subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Preview invoice for subscription changes
  static async previewInvoice(options: {
    subscriptionId: string
    subscriptionItems: Array<{
      id: string
      priceId: string
    }>
    prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
    couponId?: string
  }): Promise<StripeInvoiceLite> {
    try {
      const previewParams: any = {
        subscription: options.subscriptionId,
        subscription_items: options.subscriptionItems?.filter(Boolean)?.map((item: any) => ({
          id: item.id,
          price: item.priceId
        })),
        subscription_proration_behavior: options.prorationBehavior || 'create_prorations'
      }

      if (options.couponId) {
        previewParams.coupon = options.couponId
      }

      // Use retrieveUpcoming to preview invoice for subscription changes
      return await getStripe().invoices.retrieveUpcoming(previewParams)
    } catch (error) {
      throw new Error(`Failed to preview invoice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get upcoming invoice for subscription
  static async getUpcomingInvoice(subscriptionId: string): Promise<StripeInvoiceLite> {
    try {
      return await getStripe().invoices.retrieveUpcoming({ subscription: subscriptionId })
    } catch (error) {
      throw new Error(`Failed to get upcoming invoice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Schedule subscription cancellation
  static async scheduleSubscriptionCancellation(subscriptionId: string, cancelAt: number): Promise<StripeSubscriptionLite> {
    try {
      return await getStripe().subscriptions.update(subscriptionId, {
        cancel_at: cancelAt
      })
    } catch (error) {
      throw new Error(`Failed to schedule subscription cancellation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Update subscription trial
  static async updateSubscriptionTrial(subscriptionId: string, trialEnd: number): Promise<StripeSubscriptionLite> {
    try {
      return await getStripe().subscriptions.update(subscriptionId, {
        trial_end: trialEnd
      })
    } catch (error) {
      throw new Error(`Failed to update subscription trial: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // List customer subscriptions
  static async listCustomerSubscriptions(customerId: string): Promise<StripeApiList<StripeSubscriptionLite>> {
    try {
      return await getStripe().subscriptions.list({
        customer: customerId,
        status: 'all',
        expand: ['data.default_payment_method', 'data.items.data.price.product']
      })
    } catch (error) {
      throw new Error(`Failed to list customer subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Checkout and Payment Sessions
   */

  // Create a subscription checkout session
  static async createCheckoutSession(data: StripeCheckoutSessionData): Promise<StripeCheckoutSessionLite> {
    try {
      const sessionData: any = {
        payment_method_types: ['card'],
        line_items: [{
          price: data.priceId,
          quantity: 1
        }],
        mode: 'subscription',
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        metadata: data.metadata || {},
        allow_promotion_codes: data.allowPromotionCodes || false
      }

      if (data.customerId) {
        sessionData.customer = data.customerId
      } else if (data.customerEmail) {
        sessionData.customer_email = data.customerEmail
      }

      if (data.trialPeriodDays) {
        sessionData.subscription_data = {
          trial_period_days: data.trialPeriodDays
        }
      }

      if (data.couponId) {
        sessionData.discounts = [{
          coupon: data.couponId
        }]
      }

      const session = await getStripe().checkout.sessions.create(sessionData)
      return session
    } catch (error) {
      throw new Error(`Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Create a one-time payment session
  static async createOneTimePaymentSession(
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    customerId?: string,
    customerEmail?: string
  ): Promise<StripeCheckoutSessionLite> {
    try {
      const sessionData: any = {
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl
      }

      if (customerId) {
        sessionData.customer = customerId
      } else if (customerEmail) {
        sessionData.customer_email = customerEmail
      }

      return await getStripe().checkout.sessions.create(sessionData)
    } catch (error) {
      throw new Error(`Failed to create one-time payment session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Create a portal session for managing subscriptions
  static async createPortalSession(customerId: string, returnUrl: string): Promise<BillingPortalSession> {
    try {
      const session = await getStripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
      })
      return session
    } catch (error) {
      throw new Error(`Failed to create portal session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Invoice Management
   */

  // Create an invoice
  static async createInvoice(data: StripeInvoiceData): Promise<StripeInvoiceLite> {
    try {
      const invoiceData: any = {
        customer: data.customerId,
        description: data.description,
        metadata: data.metadata || {}
      }

      if (data.dueDate) {
        invoiceData.due_date = data.dueDate
      }

      return await getStripe().invoices.create(invoiceData)
    } catch (error) {
      throw new Error(`Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Finalize and send an invoice
  static async finalizeInvoice(invoiceId: string): Promise<StripeInvoiceLite> {
    try {
      return await getStripe().invoices.finalizeInvoice(invoiceId)
    } catch (error) {
      throw new Error(`Failed to finalize invoice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Pay an invoice
  static async payInvoice(invoiceId: string): Promise<StripeInvoiceLite> {
    try {
      return await getStripe().invoices.pay(invoiceId)
    } catch (error) {
      throw new Error(`Failed to pay invoice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // List invoices
  static async listInvoices(options: {
    customer?: string
    limit?: number
    status?: string
  }): Promise<{ success: boolean; data?: StripeApiList<StripeInvoiceLite>; error?: string }> {
    try {
      const invoices = await getStripe().invoices.list({
        customer: options.customer,
        limit: options.limit || 10,
        status: options.status as any
      })
      return { success: true, data: invoices }
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to list invoices: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  // Create an invoice item
  static async createInvoiceItem(data: {
    customerId: string
    invoiceId?: string
    amount: number
    currency: string
    description?: string
  }): Promise<StripeInvoiceItemLite> {
    try {
      // Cast to any to avoid TS complaining about instance typing under bundler resolution
      return await (getStripe() as any).invoiceItems.create({
        customer: data.customerId,
        invoice: data.invoiceId,
        amount: data.amount,
        currency: data.currency,
        description: data.description
      })
    } catch (error) {
      throw new Error(`Failed to create invoice item: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Coupon and Discount Management
   */

  // Create a coupon
  static async createCoupon(
    id: string,
    percentOff?: number,
    amountOff?: number,
    currency?: string,
    duration: 'forever' | 'once' | 'repeating' = 'once',
    durationInMonths?: number
  ): Promise<any> {
    try {
      const couponData: any = {
        id,
        duration
      }

      if (percentOff) {
        couponData.percent_off = percentOff
      } else if (amountOff && currency) {
        couponData.amount_off = Math.round(amountOff * 100)
        couponData.currency = currency.toLowerCase()
      } else {
        throw new Error('Either percentOff or both amountOff and currency must be provided')
      }

      if (duration === 'repeating' && durationInMonths) {
        couponData.duration_in_months = durationInMonths
      }

      return await (getStripe() as any).coupons.create(couponData)
    } catch (error) {
      throw new Error(`Failed to create coupon: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Webhook Handling
   */

  // Handle webhook events
  static async handleWebhook(signature: string, payload: Buffer): Promise<StripeEvent> {
    try {
      const event = getStripe().webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
      return event
    } catch (error) {
      throw new Error(`Failed to handle webhook: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Process webhook event
  static async processWebhookEvent(event: StripeEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.handleSubscriptionEvent(event)
          break
        
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
          await this.handleInvoiceEvent(event)
          break
        
        case 'checkout.session.completed':
          await this.handleCheckoutEvent(event)
          break
        
        default:
          console.log(`Unhandled event type: ${event.type}`)
      }
    } catch (error) {
      console.error(`Error processing webhook event ${event.type}:`, error)
      throw error
    }
  }

  // Handle subscription events
  private static async handleSubscriptionEvent(event: StripeEvent): Promise<void> {
    const subscription = event.data.object as StripeSubscriptionLite
    const customerId = subscription.customer as string

    // Find user by Stripe customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    })

    if (!user) {
      console.error(`User not found for Stripe customer: ${customerId}`)
      return
    }

    // Update subscription in database
    const subscriptionData = {
      userId: user.id,
      status: this.mapStripeStatusToPrisma(subscription.status),
      providerSubscriptionId: subscription.id,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000)
    }

    if (event.type === 'customer.subscription.created') {
      // Find the plan based on the price ID
      const priceId = subscription.items.data[0]?.price.id
      const plan = await prisma.plan.findFirst({
        where: {
          OR: [
            { stripePriceId: priceId },
            { stripeYearlyPriceId: priceId }
          ]
        }
      })

      if (plan) {
        await prisma.subscription.create({
          data: {
            ...subscriptionData,
            planId: plan.id
          }
        })
      }
    } else {
      // Update existing subscription
      await prisma.subscription.updateMany({
        where: {
          userId: user.id,
          providerSubscriptionId: subscription.id
        },
        data: subscriptionData
      })
    }
  }

  // Handle invoice events
  private static async handleInvoiceEvent(event: StripeEvent): Promise<void> {
    const invoice = event.data.object as StripeInvoiceLite
    const customerId = invoice.customer as string

    // Find user by Stripe customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    })

    if (!user) {
      console.error(`User not found for Stripe customer: ${customerId}`)
      return
    }

    // Record payment
    await prisma.payment.create({
      data: {
        userId: user.id,
        amount: (invoice.amount_paid || 0) / 100, // Convert from cents
        currency: invoice.currency.toUpperCase(),
        status: event.type === 'invoice.payment_succeeded' ? 'COMPLETED' : 'FAILED',
        provider: 'stripe',
        providerId: invoice.id,
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: (invoice as any).subscription || null,
          eventType: event.type
        }
      }
    })
  }

  // Handle checkout events
  private static async handleCheckoutEvent(event: StripeEvent): Promise<void> {
    const session = event.data.object as StripeCheckoutSessionLite
    
    if (session.mode === 'subscription' && session.subscription) {
      // Subscription checkout completed
      const subscription = await getStripe().subscriptions.retrieve(session.subscription as string)
      await this.handleSubscriptionEvent({
        ...event,
        type: 'customer.subscription.created',
        data: { object: subscription }
      } as any)
    }
  }

  // Map Stripe subscription status to Prisma enum
  private static mapStripeStatusToPrisma(stripeStatus: string): 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'PENDING' | 'PAST_DUE' {
    switch (stripeStatus) {
      case 'active':
      case 'trialing':
        return 'ACTIVE'
      case 'canceled':
        return 'CANCELED'
      case 'incomplete_expired':
        return 'EXPIRED'
      case 'incomplete':
        return 'PENDING'
      case 'past_due':
        return 'PAST_DUE'
      default:
        return 'PENDING'
    }
  }

  /**
   * Utility Methods
   */

  // Test Stripe connection
  static async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await getStripe().accounts.retrieve()
      return { success: true, message: 'Stripe connection successful' }
    } catch (error) {
      return {
        success: false,
        message: `Stripe connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Get Stripe account info
  static async getAccountInfo(): Promise<any> {
    try {
      return await getStripe().accounts.retrieve()
    } catch (error) {
      throw new Error(`Failed to get account info: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
