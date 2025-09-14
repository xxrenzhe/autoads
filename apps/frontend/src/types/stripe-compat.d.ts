// Minimal augmentation for Stripe types to avoid missing members in strict mode
declare module 'stripe' {
  namespace Stripe {
    // Generic helpers
    type ApiList<T> = { data: T[]; has_more?: boolean; [k: string]: any }

    // Common entities used in codebase (loosely typed)
    interface PaymentIntent {
      id: string
      metadata: Record<string, any>
      amount: number
      last_payment_error?: { message?: string } | null
      [key: string]: any
    }
    interface Customer { id: string; [k: string]: any }
    interface DeletedCustomer { id: string; deleted: boolean; [k: string]: any }
    interface Price { id: string; [k: string]: any }
    interface Product { id: string; [k: string]: any }
    interface Subscription { id: string; items: { data: any[] }; status: string; [k: string]: any }
    interface Invoice { id: string; amount_paid?: number; currency: string; [k: string]: any }
    namespace Checkout { interface Session { id: string; url?: string | null; subscription?: string | null; [k: string]: any } }
    namespace BillingPortal { interface Session { id: string; url?: string | null; [k: string]: any } }

    // Param placeholders
    type AddressParam = any
    type SubscriptionCreateParams = any
    type SubscriptionUpdateParams = any
    type CheckoutSessionCreateParams = any
    type InvoiceCreateParams = any
  }
  // Default export class (runtime)
  export default class Stripe {
    constructor(secretKey: string, config?: any)
    customers: any
    prices: any
    products: any
    subscriptions: any
    invoices: any
    checkout: any
    billingPortal: any
    webhooks: any
    accounts: any
  }
}
