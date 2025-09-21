// Minimal Stripe type shims to keep strong typing without installing stripe package

export interface ApiList<T> {
  object?: string;
  data: T[];
  has_more?: boolean;
  url?: string;
  [key: string]: any;
}

export interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: {
    object: any;
  };
  [key: string]: any;
}

export interface StripeSubscriptionItem {
  id?: string;
  price: { id: string } | any;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer?: string | any;
  items: { data: StripeSubscriptionItem[] };
  cancel_at_period_end?: boolean;
  trial_end?: number | null;
  metadata?: Record<string, any>;
  current_period_start?: number;
  current_period_end?: number;
  [key: string]: any;
}

export interface StripeInvoiceStatusTransitions {
  paid_at?: number | null;
}

export interface StripeInvoice {
  id: string;
  customer?: string | any;
  subscription?: string | null;
  currency: string;
  total?: number;
  amount_paid?: number;
  amount_due?: number;
  due_date?: number | null;
  status?: string;
  hosted_invoice_url?: string | null;
  status_transitions?: StripeInvoiceStatusTransitions;
  [key: string]: any;
}

export interface StripeCheckoutSession {
  id?: string;
  mode?: string;
  subscription?: string | null;
  [key: string]: any;
}

export interface BillingPortalSession {
  id: string;
  url?: string;
  [key: string]: any;
}

export interface InvoiceItem {
  id: string;
  [key: string]: any;
}

