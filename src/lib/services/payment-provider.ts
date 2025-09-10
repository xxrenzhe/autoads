/**
 * Payment Provider Abstraction Layer
 * 
 * This module provides a unified interface for different payment providers
 * allowing easy switching between Stripe, PayPal, and other payment systems.
 */

export interface PaymentMethod {
  id: string
  type: 'card' | 'bank_account' | 'paypal' | 'apple_pay' | 'google_pay'
  last4?: string
  brand?: string
  expiryMonth?: number
  expiryYear?: number
  isDefault: boolean
  metadata?: Record<string, any>
}

export interface Customer {
  id: string
  email: string
  name?: string
  metadata?: Record<string, any>
}

export interface Subscription {
  id: string
  customerId: string
  planId: string
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEnd?: Date
  metadata?: Record<string, any>
}

export interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'canceled'
  clientSecret?: string
  metadata?: Record<string, any>
}

export interface Invoice {
  id: string
  customerId: string
  subscriptionId?: string
  amount: number
  currency: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  dueDate?: Date
  paidAt?: Date
  url?: string
  metadata?: Record<string, any>
}

export interface WebhookEvent {
  id: string
  type: string
  data: any
  created: Date
}

export interface CreateSubscriptionParams {
  customerId: string
  planId: string
  paymentMethodId?: string
  trialDays?: number
  metadata?: Record<string, any>
}

export interface CreatePaymentIntentParams {
  amount: number
  currency: string
  customerId?: string
  paymentMethodId?: string
  metadata?: Record<string, any>
}

export interface CreateCustomerParams {
  email: string
  name?: string
  paymentMethodId?: string
  metadata?: Record<string, any>
}

export interface PaymentProviderResult<T = any> {
  success: boolean
  data?: T
  error?: string
  providerError?: any
}

export abstract class PaymentProvider {
  abstract readonly name: string
  abstract readonly version: string

  // Customer Management
  abstract createCustomer(params: CreateCustomerParams): Promise<PaymentProviderResult<Customer>>
  abstract getCustomer(customerId: string): Promise<PaymentProviderResult<Customer>>
  abstract updateCustomer(customerId: string, params: Partial<CreateCustomerParams>): Promise<PaymentProviderResult<Customer>>
  abstract deleteCustomer(customerId: string): Promise<PaymentProviderResult<void>>

  // Payment Methods
  abstract attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentProviderResult<PaymentMethod>>
  abstract detachPaymentMethod(paymentMethodId: string): Promise<PaymentProviderResult<void>>
  abstract listPaymentMethods(customerId: string): Promise<PaymentProviderResult<PaymentMethod[]>>
  abstract setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentProviderResult<void>>

  // Subscriptions
  abstract createSubscription(params: CreateSubscriptionParams): Promise<PaymentProviderResult<Subscription>>
  abstract getSubscription(subscriptionId: string): Promise<PaymentProviderResult<Subscription>>
  abstract updateSubscription(subscriptionId: string, params: Partial<CreateSubscriptionParams>): Promise<PaymentProviderResult<Subscription>>
  abstract cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<PaymentProviderResult<Subscription>>
  abstract pauseSubscription(subscriptionId: string): Promise<PaymentProviderResult<Subscription>>
  abstract resumeSubscription(subscriptionId: string): Promise<PaymentProviderResult<Subscription>>

  // Payment Intents
  abstract createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentProviderResult<PaymentIntent>>
  abstract confirmPaymentIntent(paymentIntentId: string, paymentMethodId?: string): Promise<PaymentProviderResult<PaymentIntent>>
  abstract cancelPaymentIntent(paymentIntentId: string): Promise<PaymentProviderResult<PaymentIntent>>

  // Invoices
  abstract createInvoice(customerId: string, amount: number, currency: string, description?: string): Promise<PaymentProviderResult<Invoice>>
  abstract getInvoice(invoiceId: string): Promise<PaymentProviderResult<Invoice>>
  abstract payInvoice(invoiceId: string): Promise<PaymentProviderResult<Invoice>>
  abstract voidInvoice(invoiceId: string): Promise<PaymentProviderResult<Invoice>>
  abstract listInvoices(customerId: string, limit?: number): Promise<PaymentProviderResult<Invoice[]>>

  // Webhooks
  abstract verifyWebhook(payload: string, signature: string, secret: string): Promise<PaymentProviderResult<WebhookEvent>>
  abstract processWebhook(event: WebhookEvent): Promise<PaymentProviderResult<boolean>>

  // Utility Methods
  abstract formatAmount(amount: number): number // Convert to provider's expected format (e.g., cents)
  abstract parseAmount(amount: number): number // Convert from provider's format to standard format
  abstract isConfigured(): boolean
  abstract healthCheck(): Promise<PaymentProviderResult<boolean>>
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code?: string,
    public originalError?: any
  ) {
    super(message)
    this.name = 'PaymentProviderError'
  }
}

export class PaymentProviderFactory {
  private static providers: Map<string, PaymentProvider> = new Map()
  private static defaultProvider: string | null = null

  static register(name: string, provider: PaymentProvider): void {
    this.providers.set(name, provider)
    
    // Set as default if it's the first provider or explicitly configured
    if (!this.defaultProvider || name === process.env.DEFAULT_PAYMENT_PROVIDER) {
      this.defaultProvider = name
    }
  }

  static get(name?: string): PaymentProvider {
    const providerName = name || this.defaultProvider
    
    if (!providerName) {
      throw new PaymentProviderError('No payment provider specified and no default provider set', 'factory')
    }

    const provider = this.providers.get(providerName)
    
    if (!provider) {
      throw new PaymentProviderError(`Payment provider '${providerName}' not found`, 'factory')
    }

    if (!provider.isConfigured()) {
      throw new PaymentProviderError(`Payment provider '${providerName}' is not properly configured`, providerName)
    }

    return provider
  }

  static list(): string[] {
    return Array.from(this.providers.keys())
  }

  static setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new PaymentProviderError(`Cannot set default provider: '${name}' not found`, 'factory')
    }
    this.defaultProvider = name
  }

  static getDefault(): string | null {
    return this.defaultProvider
  }

  static async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}
    
    for (const [name, provider] of this.providers) {
      try {
        const result = await provider.healthCheck()
        results[name] = result.success && !!result.data
      } catch (error) {
        results[name] = false
      }
    }
    
    return results
  }
}

// Utility functions for common operations
export class PaymentUtils {
  static formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100)
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  static validateAmount(amount: number): boolean {
    return amount > 0 && Number.isFinite(amount)
  }

  static validateCurrency(currency: string): boolean {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']
    return validCurrencies.includes(currency.toUpperCase())
  }

  static generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  static sanitizeMetadata(metadata: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {}
    
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = String(value)
      }
    }
    
    return sanitized
  }
}

export default PaymentProvider