import { NextResponse } from 'next/server'

/**
 * Security Headers Configuration
 * 
 * This module provides security headers configuration for enhanced application security.
 * It implements various security measures including CSP, HSTS, and other security headers.
 */

export interface SecurityConfig {
  contentSecurityPolicy?: boolean
  strictTransportSecurity?: boolean
  xFrameOptions?: boolean
  xContentTypeOptions?: boolean
  referrerPolicy?: boolean
  permissionsPolicy?: boolean
  crossOriginEmbedderPolicy?: boolean
  crossOriginOpenerPolicy?: boolean
  crossOriginResourcePolicy?: boolean
}

export class SecurityHeadersManager {
  private static readonly DEFAULT_CONFIG: SecurityConfig = {
    contentSecurityPolicy: true,
    strictTransportSecurity: true,
    xFrameOptions: true,
    xContentTypeOptions: true,
    referrerPolicy: true,
    permissionsPolicy: true,
    crossOriginEmbedderPolicy: false, // Can break some integrations
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true
  }

  /**
   * Apply security headers to response
   */
  static applySecurityHeaders(
    response: NextResponse, 
    config: SecurityConfig = this.DEFAULT_CONFIG
  ): NextResponse {
    // Content Security Policy
    if (config.contentSecurityPolicy) {
      const csp = this.buildContentSecurityPolicy()
      response.headers.set('Content-Security-Policy', csp)
    }

    // HTTP Strict Transport Security
    if (config.strictTransportSecurity) {
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      )
    }

    // X-Frame-Options
    if (config.xFrameOptions) {
      response.headers.set('X-Frame-Options', 'DENY')
    }

    // X-Content-Type-Options
    if (config.xContentTypeOptions) {
      response.headers.set('X-Content-Type-Options', 'nosniff')
    }

    // Referrer Policy
    if (config.referrerPolicy) {
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    }

    // Permissions Policy
    if (config.permissionsPolicy) {
      const permissionsPolicy = this.buildPermissionsPolicy()
      response.headers.set('Permissions-Policy', permissionsPolicy)
    }

    // Cross-Origin Embedder Policy
    if (config.crossOriginEmbedderPolicy) {
      response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
    }

    // Cross-Origin Opener Policy
    if (config.crossOriginOpenerPolicy) {
      response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    }

    // Cross-Origin Resource Policy
    if (config.crossOriginResourcePolicy) {
      response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
    }

    // Additional security headers
    response.headers.set('X-DNS-Prefetch-Control', 'off')
    response.headers.set('X-Download-Options', 'noopen')
    response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')

    return response
  }

  /**
   * Build Content Security Policy
   */
  private static buildContentSecurityPolicy(): string {
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    const directives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for Next.js
        "'unsafe-eval'", // Required for development
        'https://js.stripe.com',
        'https://checkout.stripe.com',
        ...(isDevelopment ? ["'unsafe-eval'"] : [])
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for styled-components and CSS-in-JS
        'https://fonts.googleapis.com'
      ],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https:',
        'http:' // Allow HTTP images in development
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'data:'
      ],
      'connect-src': [
        "'self'",
        'https://api.stripe.com',
        'https://api.similarweb.com',
        'https://api.sendgrid.com',
        'https://api.twilio.com',
        ...(isDevelopment ? ['ws:', 'wss:'] : [])
      ],
      'frame-src': [
        "'self'",
        'https://js.stripe.com',
        'https://hooks.stripe.com'
      ],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': []
    }

    return Object.entries(directives)
      .map(([directive, sources]) => 
        sources.length > 0 
          ? `${directive} ${sources.join(' ')}`
          : directive
      )
      .join('; ')
  }

  /**
   * Build Permissions Policy
   */
  private static buildPermissionsPolicy(): string {
    const policies = {
      'accelerometer': '()',
      'ambient-light-sensor': '()',
      'autoplay': '()',
      'battery': '()',
      'camera': '()',
      'cross-origin-isolated': '()',
      'display-capture': '()',
      'document-domain': '()',
      'encrypted-media': '()',
      'execution-while-not-rendered': '()',
      'execution-while-out-of-viewport': '()',
      'fullscreen': '()',
      'geolocation': '()',
      'gyroscope': '()',
      'keyboard-map': '()',
      'magnetometer': '()',
      'microphone': '()',
      'midi': '()',
      'navigation-override': '()',
      'payment': '(self)',
      'picture-in-picture': '()',
      'publickey-credentials-get': '()',
      'screen-wake-lock': '()',
      'sync-xhr': '()',
      'usb': '()',
      'web-share': '()',
      'xr-spatial-tracking': '()'
    }

    return Object.entries(policies)
      .map(([feature, allowlist]) => `${feature}=${allowlist}`)
      .join(', ')
  }

  /**
   * Create security headers middleware
   */
  static createMiddleware(config?: SecurityConfig) {
    return (response: NextResponse) => {
      return this.applySecurityHeaders(response, config)
    }
  }

  /**
   * Validate security configuration
   */
  static validateSecurityConfig(): {
    isSecure: boolean
    warnings: string[]
    recommendations: string[]
  } {
    const warnings: string[] = []
    const recommendations: string[] = []

    // Check HTTPS configuration
    if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL?.startsWith('https://')) {
      warnings.push('NEXTAUTH_URL should use HTTPS in production')
    }

    // Check session secret
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
      warnings.push('NEXTAUTH_SECRET should be at least 32 characters long')
    }

    // Check database URL security
    if (process.env.DATABASE_URL?.includes('sslmode=disable')) {
      warnings.push('Database connection should use SSL in production')
    }

    // Check encryption key
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
      warnings.push('ENCRYPTION_KEY should be at least 32 characters long')
    }

    // Recommendations
    if (process.env.NODE_ENV === 'production') {
      recommendations.push('Enable HSTS preload for enhanced security')
      recommendations.push('Consider implementing Certificate Transparency monitoring')
      recommendations.push('Set up security monitoring and alerting')
      recommendations.push('Regularly update dependencies for security patches')
    }

    return {
      isSecure: warnings.length === 0,
      warnings,
      recommendations
    }
  }
}