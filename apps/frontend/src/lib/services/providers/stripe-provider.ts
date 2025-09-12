import Stripe from 'stripe'
import {
  PaymentProvider,
  PaymentProviderResult,
  PaymentProviderError,
  Customer,
  PaymentMethod,
  Subscription,
  PaymentIntent,
  Invoice,
  WebhookEvent,
  CreateCustomerParams,
  CreateSubscriptionParams,
  CreatePaymentIntentParams,
  PaymentUtils
} from '../payment-provider'

export class StripeProvider extends PaymentProvider {
  readonly name = 'stripe'
  readonly version = '1.0.0'
  
  private stripe: Stripe | null = null

  constructor() {
    super()
    this.initializeStripe()
  }

  private initializeStripe(): void {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-07-30.basil',
      })
    }
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new PaymentProviderError('Stripe not initialized', this.name)
    }
    return this.stripe
  }

  isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PUBLISHABLE_KEY
  }

  async healthCheck(): Promise<PaymentProviderResult<boolean>> {
    try {
      const stripe = this.getStripe()
      await stripe.accounts.retrieve()
      return { success: true, data: true }
    } catch (error) {
      return {
        success: false,
        error: 'Stripe health check failed',
        providerError: error
      }
    }
  }

  formatAmount(amount: number): number {
    return Math.round(amount * 100) // Convert to cents
  }

  parseAmount(amount: number): number {
    return amount / 100 // Convert from cents
  }

  // Customer Management
  async createCustomer(params: CreateCustomerParams): Promise<PaymentProviderResult<Customer>> {
    try {
      const stripe = this.getStripe()
      
      const customerData: Stripe.CustomerCreateParams = {
        email: params.email,
        name: params.name,
        metadata: PaymentUtils.sanitizeMetadata(params.metadata || {})
      }

      if (params.paymentMethodId) {
        customerData.payment_method = params.paymentMethodId
        customerData.invoice_settings = {
          default_payment_method: params.paymentMethodId
        }
      }

      const customer = await stripe.customers.create(customerData)

      return {
        success: true,
        data: {
          id: customer.id,
          email: customer.email!,
          name: customer.name || undefined,
          metadata: customer.metadata
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create customer: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async getCustomer(customerId: string): Promise<PaymentProviderResult<Customer>> {
    try {
      const stripe = this.getStripe()
      const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer

      return {
        success: true,
        data: {
          id: customer.id,
          email: customer.email!,
          name: customer.name || undefined,
          metadata: customer.metadata
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to get customer: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async updateCustomer(customerId: string, params: Partial<CreateCustomerParams>): Promise<PaymentProviderResult<Customer>> {
    try {
      const stripe = this.getStripe()
      
      const updateData: Stripe.CustomerUpdateParams = {}
      if (params.email) updateData.email = params.email
      if (params.name) updateData.name = params.name
      if (params.metadata) updateData.metadata = PaymentUtils.sanitizeMetadata(params.metadata)

      const customer = await stripe.customers.update(customerId, updateData)

      return {
        success: true,
        data: {
          id: customer.id,
          email: customer.email!,
          name: customer.name || undefined,
          metadata: customer.metadata
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update customer: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async deleteCustomer(customerId: string): Promise<PaymentProviderResult<void>> {
    try {
      const stripe = this.getStripe()
      await stripe.customers.del(customerId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete customer: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  // Payment Methods
  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentProviderResult<PaymentMethod>> {
    try {
      const stripe = this.getStripe()
      
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      })

      return {
        success: true,
        data: this.mapStripePaymentMethod(paymentMethod)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to attach payment method: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<PaymentProviderResult<void>> {
    try {
      const stripe = this.getStripe()
      await stripe.paymentMethods.detach(paymentMethodId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Failed to detach payment method: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async listPaymentMethods(customerId: string): Promise<PaymentProviderResult<PaymentMethod[]>> {
    try {
      const stripe = this.getStripe()
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      })

      return {
        success: true,
        data: paymentMethods.data?.filter(Boolean)?.map(pm => this.mapStripePaymentMethod(pm))
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to list payment methods: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentProviderResult<void>> {
    try {
      const stripe = this.getStripe()
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Failed to set default payment method: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  // Subscriptions
  async createSubscription(params: CreateSubscriptionParams): Promise<PaymentProviderResult<Subscription>> {
    try {
      const stripe = this.getStripe()
      
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: params.customerId,
        items: [{ price: params.planId }],
        metadata: PaymentUtils.sanitizeMetadata(params.metadata || {})
      }

      if (params.paymentMethodId) {
        subscriptionData.default_payment_method = params.paymentMethodId
      }

      if (params.trialDays) {
        subscriptionData.trial_period_days = params.trialDays
      }

      const subscription = await stripe.subscriptions.create(subscriptionData)

      return {
        success: true,
        data: this.mapStripeSubscription(subscription)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create subscription: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async getSubscription(subscriptionId: string): Promise<PaymentProviderResult<Subscription>> {
    try {
      const stripe = this.getStripe()
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)

      return {
        success: true,
        data: this.mapStripeSubscription(subscription)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to get subscription: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async updateSubscription(subscriptionId: string, params: Partial<CreateSubscriptionParams>): Promise<PaymentProviderResult<Subscription>> {
    try {
      const stripe = this.getStripe()
      
      const updateData: Stripe.SubscriptionUpdateParams = {}
      if (params.planId) {
        const currentSub = await stripe.subscriptions.retrieve(subscriptionId)
        updateData.items = [{
          id: currentSub.items.data[0].id,
          price: params.planId
        }]
      }
      if (params.metadata) updateData.metadata = PaymentUtils.sanitizeMetadata(params.metadata)

      const subscription = await stripe.subscriptions.update(subscriptionId, updateData)

      return {
        success: true,
        data: this.mapStripeSubscription(subscription)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update subscription: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<PaymentProviderResult<Subscription>> {
    try {
      const stripe = this.getStripe()
      
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd
      })

      return {
        success: true,
        data: this.mapStripeSubscription(subscription)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to cancel subscription: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async pauseSubscription(subscriptionId: string): Promise<PaymentProviderResult<Subscription>> {
    try {
      const stripe = this.getStripe()
      
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        pause_collection: {
          behavior: 'keep_as_draft'
        }
      })

      return {
        success: true,
        data: this.mapStripeSubscription(subscription)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to pause subscription: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<PaymentProviderResult<Subscription>> {
    try {
      const stripe = this.getStripe()
      
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        pause_collection: null
      })

      return {
        success: true,
        data: this.mapStripeSubscription(subscription)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to resume subscription: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  // Payment Intents
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentProviderResult<PaymentIntent>> {
    try {
      const stripe = this.getStripe()
      
      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: this.formatAmount(params.amount),
        currency: params.currency.toLowerCase(),
        metadata: PaymentUtils.sanitizeMetadata(params.metadata || {})
      }

      if (params.customerId) {
        paymentIntentData.customer = params.customerId
      }

      if (params.paymentMethodId) {
        paymentIntentData.payment_method = params.paymentMethodId
        paymentIntentData.confirmation_method = 'manual'
        paymentIntentData.confirm = true
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentData)

      return {
        success: true,
        data: this.mapStripePaymentIntent(paymentIntent)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create payment intent: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId?: string): Promise<PaymentProviderResult<PaymentIntent>> {
    try {
      const stripe = this.getStripe()
      
      const confirmData: Stripe.PaymentIntentConfirmParams = {}
      if (paymentMethodId) {
        confirmData.payment_method = paymentMethodId
      }

      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, confirmData)

      return {
        success: true,
        data: this.mapStripePaymentIntent(paymentIntent)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to confirm payment intent: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentProviderResult<PaymentIntent>> {
    try {
      const stripe = this.getStripe()
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId)

      return {
        success: true,
        data: this.mapStripePaymentIntent(paymentIntent)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to cancel payment intent: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  // Invoices
  async createInvoice(customerId: string, amount: number, currency: string, description?: string): Promise<PaymentProviderResult<Invoice>> {
    try {
      const stripe = this.getStripe()
      
      // Create invoice item first
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: this.formatAmount(amount),
        currency: currency.toLowerCase(),
        description
      })

      // Create and finalize invoice
      const invoice = await stripe.invoices.create({
        customer: customerId,
        auto_advance: true
      })

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id!)

      return {
        success: true,
        data: this.mapStripeInvoice(finalizedInvoice)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create invoice: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async getInvoice(invoiceId: string): Promise<PaymentProviderResult<Invoice>> {
    try {
      const stripe = this.getStripe()
      const invoice = await stripe.invoices.retrieve(invoiceId)

      return {
        success: true,
        data: this.mapStripeInvoice(invoice)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to get invoice: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async payInvoice(invoiceId: string): Promise<PaymentProviderResult<Invoice>> {
    try {
      const stripe = this.getStripe()
      const invoice = await stripe.invoices.pay(invoiceId)

      return {
        success: true,
        data: this.mapStripeInvoice(invoice)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to pay invoice: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async voidInvoice(invoiceId: string): Promise<PaymentProviderResult<Invoice>> {
    try {
      const stripe = this.getStripe()
      const invoice = await stripe.invoices.voidInvoice(invoiceId)

      return {
        success: true,
        data: this.mapStripeInvoice(invoice)
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to void invoice: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async listInvoices(customerId: string, limit: number = 10): Promise<PaymentProviderResult<Invoice[]>> {
    try {
      const stripe = this.getStripe()
      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit
      })

      return {
        success: true,
        data: invoices.data?.filter(Boolean)?.map(invoice => this.mapStripeInvoice(invoice))
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to list invoices: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  // Webhooks
  async verifyWebhook(payload: string, signature: string, secret: string): Promise<PaymentProviderResult<WebhookEvent>> {
    try {
      const stripe = this.getStripe()
      const event = stripe.webhooks.constructEvent(payload, signature, secret)

      return {
        success: true,
        data: {
          id: event.id,
          type: event.type,
          data: event.data,
          created: new Date(event.created * 1000)
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to verify webhook: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  async processWebhook(event: WebhookEvent): Promise<PaymentProviderResult<boolean>> {
    try {
      // This would contain the business logic for processing different webhook events
      // For now, we'll just return success
      console.log(`Processing Stripe webhook: ${event.type}`)
      return { success: true, data: true }
    } catch (error) {
      return {
        success: false,
        error: `Failed to process webhook: ${error instanceof Error ? error.message : "Unknown error" as any}`,
        providerError: error
      }
    }
  }

  // Helper methods to map Stripe objects to our interface
  private mapStripePaymentMethod(pm: Stripe.PaymentMethod): PaymentMethod {
    return {
      id: pm.id,
      type: pm.type as any,
      last4: pm.card?.last4,
      brand: pm.card?.brand,
      expiryMonth: pm.card?.exp_month,
      expiryYear: pm.card?.exp_year,
      isDefault: false, // This would need to be determined from customer data
      metadata: pm.metadata || undefined
    }
  }

  private mapStripeSubscription(sub: Stripe.Subscription): Subscription {
    return {
      id: sub.id,
      customerId: sub.customer as string,
      planId: sub.items.data[0]?.price?.id || '',
      status: sub.status as any,
      currentPeriodStart: new Date((sub as any).current_period_start * 1000),
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : undefined,
      metadata: sub.metadata
    }
  }

  private mapStripePaymentIntent(pi: Stripe.PaymentIntent): PaymentIntent {
    return {
      id: pi.id,
      amount: this.parseAmount(pi.amount),
      currency: pi.currency.toUpperCase(),
      status: pi.status as any,
      clientSecret: pi.client_secret || undefined,
      metadata: pi.metadata
    }
  }

  private mapStripeInvoice(invoice: Stripe.Invoice): Invoice {
    return {
      id: invoice.id!,
      customerId: invoice.customer as string || '',
      subscriptionId: (invoice as any).subscription as string || undefined,
      amount: this.parseAmount(invoice.total),
      currency: invoice.currency.toUpperCase(),
      status: invoice.status as any,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
      paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : undefined,
      url: invoice.hosted_invoice_url || undefined,
      metadata: invoice.metadata || {}
    }
  }
}

export default StripeProvider