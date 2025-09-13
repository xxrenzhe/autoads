import { PaymentProviderFactory } from './payment-provider'
import StripeProvider from './providers/stripe-provider'
import PayPalProvider from './providers/paypal-provider'

/**
 * Payment Provider Manager
 * 
 * This service manages the registration and initialization of payment providers.
 * It automatically registers available providers and provides utility methods
 * for working with multiple payment providers.
 */
export class PaymentProviderManager {
  private static initialized = false

  /**
   * Initialize all available payment providers
   */
  static initialize(): void {
    if (this.initialized) {
      return
    }

    // Register Stripe provider
    try {
      const stripeProvider = new StripeProvider()
      PaymentProviderFactory.register('stripe', stripeProvider)
      console.log('✅ Stripe payment provider registered')
    } catch (error) {
      console.warn('⚠️ Failed to register Stripe provider:', error)
    }

    // Register PayPal provider
    try {
      const paypalProvider = new PayPalProvider()
      PaymentProviderFactory.register('paypal', paypalProvider)
      console.log('✅ PayPal payment provider registered')
    } catch (error) {
      console.warn('⚠️ Failed to register PayPal provider:', error)
    }

    // Set default provider based on environment
    const defaultProvider = process.env.DEFAULT_PAYMENT_PROVIDER || 'stripe'
    try {
      PaymentProviderFactory.setDefault(defaultProvider)
      console.log(`✅ Default payment provider set to: ${defaultProvider}`)
    } catch (error) {
      console.warn(`⚠️ Failed to set default provider to ${defaultProvider}:`, error)
    }

    this.initialized = true
  }

  /**
   * Get the default payment provider
   */
  static getDefault() {
    this.initialize()
    return PaymentProviderFactory.get()
  }

  /**
   * Get a specific payment provider
   */
  static get(providerName: string) {
    this.initialize()
    return PaymentProviderFactory.get(providerName)
  }

  /**
   * List all available payment providers
   */
  static listProviders(): string[] {
    this.initialize()
    return PaymentProviderFactory.list()
  }

  /**
   * Check health of all payment providers
   */
  static async healthCheck(): Promise<Record<string, boolean>> {
    this.initialize()
    return PaymentProviderFactory.healthCheck()
  }

  /**
   * Get provider configuration status
   */
  static getProviderStatus(): Record<string, { configured: boolean; name: string; version: string }> {
    this.initialize()
    const providers = PaymentProviderFactory.list()
    const status: Record<string, { configured: boolean; name: string; version: string }> = {}

    for (const providerName of providers) {
      try {
        const provider = PaymentProviderFactory.get(providerName)
        status[providerName] = {
          configured: provider.isConfigured(),
          name: provider.name,
          version: provider.version
        }
      } catch (error) {
        status[providerName] = {
          configured: false,
          name: providerName,
          version: 'unknown'
        }
      }
    }

    return status
  }

  /**
   * Switch default payment provider
   */
  static switchDefault(providerName: string): boolean {
    this.initialize()
    try {
      PaymentProviderFactory.setDefault(providerName)
      return true
    } catch (error) {
      console.error(`Failed to switch default provider to ${providerName}:`, error)
      return false
    }
  }

  /**
   * Get provider recommendations based on configuration
   */
  static getRecommendations(): {
    recommended: string | null
    available: string[]
    configured: string[]
    issues: string[]
  } {
    this.initialize()
    const status = this.getProviderStatus()
    const available = Object.keys(status)
    const configured = available.filter((name: any) => status[name].configured)
    const issues: string[] = []

    // Check for common configuration issues
    if (configured.length === 0) {
      issues.push('No payment providers are properly configured')
    }

    if (!status.stripe?.configured) {
      issues.push('Stripe is not configured - most popular payment provider')
    }

    // Recommend Stripe if configured, otherwise first configured provider
    let recommended: string | null = null
    if (status.stripe?.configured) {
      recommended = 'stripe'
    } else if (configured.length > 0) {
      recommended = configured[0]
    }

    return {
      recommended,
      available,
      configured,
      issues
    }
  }

  /**
   * Validate provider configuration
   */
  static validateConfiguration(): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // Check if at least one provider is configured
    const status = this.getProviderStatus()
    const configured = Object.keys(status).filter((name: any) => status[name].configured)

    if (configured.length === 0) {
      errors.push('No payment providers are configured')
    }

    // Check default provider
    const defaultProvider = PaymentProviderFactory.getDefault()
    if (!defaultProvider) {
      errors.push('No default payment provider is set')
    } else if (!status[defaultProvider]?.configured) {
      errors.push(`Default payment provider '${defaultProvider}' is not properly configured`)
    }

    // Check for environment variables
    if (!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_PUBLISHABLE_KEY) {
      warnings.push('Stripe environment variables are not set')
    }

    if (!process.env.PAYPAL_CLIENT_ID && !process.env.PAYPAL_CLIENT_SECRET) {
      warnings.push('PayPal environment variables are not set')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Get environment-specific configuration
   */
  static getEnvironmentConfig(): {
    environment: string
    defaultProvider: string | null
    providers: Record<string, any>
  } {
    const environment = process.env.NODE_ENV || 'development'
    const defaultProvider = PaymentProviderFactory.getDefault()
    
    const providers: Record<string, any> = {}
    
    // Stripe configuration
    providers.stripe = {
      configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY),
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ? '***' + process.env.STRIPE_PUBLISHABLE_KEY.slice(-4) : null,
      webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET
    }

    // PayPal configuration
    providers.paypal = {
      configured: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      clientId: process.env.PAYPAL_CLIENT_ID ? '***' + process.env.PAYPAL_CLIENT_ID.slice(-4) : null,
      sandbox: process.env.PAYPAL_SANDBOX === 'true'
    }

    return {
      environment,
      defaultProvider,
      providers
    }
  }
}

// Auto-initialize when imported
PaymentProviderManager.initialize()

export default PaymentProviderManager