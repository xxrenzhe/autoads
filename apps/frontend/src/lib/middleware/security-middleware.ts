import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { SecurityHeadersManager } from '@/lib/security/security-headers'
import { SessionSecurityManager } from '@/lib/security/session-security'
import { PasswordPolicyManager } from '@/lib/security/password-policy'
import { getCacheManager } from '@/lib/cache/cache-manager'

/**
 * Security Middleware
 * 
 * This middleware provides comprehensive security features including
 * rate limiting, security headers, session validation, and threat detection.
 */

export interface SecurityMiddlewareConfig {
  enableSecurityHeaders: boolean
  enableRateLimiting: boolean
  enableSessionValidation: boolean
  enableThreatDetection: boolean
  enableAuditLogging: boolean
  rateLimitWindow: number // seconds
  rateLimitMax: number
  excludePaths: string[]
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

export interface ThreatDetectionResult {
  isThreat: boolean
  threatType?: 'brute_force' | 'sql_injection' | 'xss' | 'suspicious_pattern'
  severity: 'low' | 'medium' | 'high' | 'critical'
  reason: string
  shouldBlock: boolean
}

export class SecurityMiddleware {
  private config: SecurityMiddlewareConfig
  private cache = getCacheManager()

  private static readonly DEFAULT_CONFIG: SecurityMiddlewareConfig = {
    enableSecurityHeaders: true,
    enableRateLimiting: true,
    enableSessionValidation: true,
    enableThreatDetection: true,
    enableAuditLogging: true,
    rateLimitWindow: 900, // 15 minutes
    rateLimitMax: 100,
    excludePaths: ['/api/health', '/api/metrics', '/_next', '/favicon.ico']
  }

  constructor(config: Partial<SecurityMiddlewareConfig> = {}) {
    this.config = { ...SecurityMiddleware.DEFAULT_CONFIG, ...config }
  }

  /**
   * Main middleware handler
   */
  async handle(request: NextRequest): Promise<NextResponse> {
    const response = NextResponse.next()
    const pathname = request.nextUrl.pathname
    const clientIP = this.getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''

    // Skip middleware for excluded paths
    if (this.shouldSkipPath(pathname)) {
      return response
    }

    try {
      // 1. Apply security headers
      if (this.config.enableSecurityHeaders) {
        SecurityHeadersManager.applySecurityHeaders(response)
      }

      // 2. Rate limiting
      if (this.config.enableRateLimiting) {
        const rateLimitResult = await this.checkRateLimit(clientIP, pathname)
        if (!rateLimitResult.allowed) {
          return this.createRateLimitResponse(rateLimitResult.info!)
        }
        this.addRateLimitHeaders(response, rateLimitResult.info!)
      }

      // 3. Threat detection
      if (this.config.enableThreatDetection) {
        const threatResult = await this.detectThreats(request, clientIP, userAgent)
        if (threatResult.shouldBlock) {
          await this.logSecurityEvent(
            'threat_detected',
            threatResult.severity,
            `${threatResult.threatType}: ${threatResult.reason}`,
            clientIP,
            userAgent,
            pathname
          )
          return this.createThreatBlockResponse(threatResult)
        }
      }

      // 4. Session validation for authenticated routes
      if (this.config.enableSessionValidation && this.requiresAuth(pathname)) {
        const session = await auth()
        if (session?.user) {
          const sessionValidation = await SessionSecurityManager.validateSession(
            session.user.id,
            session.user.id,
            clientIP,
            userAgent
          )

          if (!sessionValidation.isValid) {
            return NextResponse.redirect(new URL('/auth/signin', request.url))
          }

          if (sessionValidation.requiresReauth) {
            return NextResponse.redirect(new URL('/auth/reauth', request.url))
          }

          // Add security warnings to response headers
          if (sessionValidation.securityWarnings.length > 0) {
            response.headers.set(
              'X-Security-Warnings',
              sessionValidation.securityWarnings.join(', ')
            )
          }
        }
      }

      // 5. Audit logging
      if (this.config.enableAuditLogging) {
        await this.logRequest(request, clientIP, userAgent)
      }

      return response
    } catch (error) {
      console.error('Security middleware error:', error)
      return response
    }
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(
    clientIP: string,
    pathname: string
  ): Promise<{
    allowed: boolean
    info?: RateLimitInfo
  }> {
    try {
      const key = `rate_limit:${clientIP}:${pathname}`
      const window = this.config.rateLimitWindow
      const max = this.config.rateLimitMax

      // Get current count
      const current = await this.cache.get<number>(key) || 0
      const remaining = Math.max(0, max - current - 1)
      const reset = Math.floor(Date.now() / 1000) + window

      if (current >= max) {
        return {
          allowed: false,
          info: {
            limit: max,
            remaining: 0,
            reset,
            retryAfter: window
          }
        }
      }

      // Increment counter
      await this.cache.increment(key, 1)
      if (current === 0) {
        await this.cache.expire(key, window)
      }

      return {
        allowed: true,
        info: {
          limit: max,
          remaining,
          reset
        }
      }
    } catch (error) {
      console.error('Rate limit check error:', error)
      return { allowed: true }
    }
  }

  /**
   * Detect security threats
   */
  private async detectThreats(
    request: NextRequest,
    clientIP: string,
    userAgent: string
  ): Promise<ThreatDetectionResult> {
    const url = request.nextUrl.toString()
    const method = request.method
    const headers = Object.fromEntries(request.headers.entries())

    // SQL Injection detection
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\'|\"|;|--|\*|\|)/,
      /(\bOR\b|\bAND\b).*(\=|\<|\>)/i
    ]

    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(url) || pattern.test(JSON.stringify(headers))) {
        return {
          isThreat: true,
          threatType: 'sql_injection',
          severity: 'high',
          reason: 'SQL injection pattern detected',
          shouldBlock: true
        }
      }
    }

    // XSS detection
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi
    ]

    for (const pattern of xssPatterns) {
      if (pattern.test(url)) {
        return {
          isThreat: true,
          threatType: 'xss',
          severity: 'high',
          reason: 'XSS pattern detected',
          shouldBlock: true
        }
      }
    }

    // Brute force detection
    const recentRequests = await this.cache.get<number>(`brute_force:${clientIP}`) || 0
    if (recentRequests > 50) { // More than 50 requests in the window
      return {
        isThreat: true,
        threatType: 'brute_force',
        severity: 'medium',
        reason: 'Excessive request rate detected',
        shouldBlock: true
      }
    }

    // Suspicious user agent patterns
    const suspiciousUserAgents = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i
    ]

    const isSuspiciousUserAgent = suspiciousUserAgents.some(pattern => pattern.test(userAgent))
    if (isSuspiciousUserAgent && !this.isAllowedBot(userAgent)) {
      return {
        isThreat: true,
        threatType: 'suspicious_pattern',
        severity: 'low',
        reason: 'Suspicious user agent detected',
        shouldBlock: false // Log but don't block
      }
    }

    // Path traversal detection
    if (url.includes('../') || url.includes('..\\')) {
      return {
        isThreat: true,
        threatType: 'suspicious_pattern',
        severity: 'medium',
        reason: 'Path traversal attempt detected',
        shouldBlock: true
      }
    }

    return {
      isThreat: false,
      severity: 'low',
      reason: 'No threats detected',
      shouldBlock: false
    }
  }

  /**
   * Check if bot is allowed
   */
  private isAllowedBot(userAgent: string): boolean {
    const allowedBots = [
      /googlebot/i,
      /bingbot/i,
      /slurp/i,
      /duckduckbot/i,
      /baiduspider/i,
      /yandexbot/i,
      /facebookexternalhit/i,
      /twitterbot/i,
      /linkedinbot/i
    ]

    return allowedBots.some(pattern => pattern.test(userAgent))
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfConnectingIP = request.headers.get('cf-connecting-ip')

    if (cfConnectingIP) return cfConnectingIP
    if (realIP) return realIP
    if (forwarded) return forwarded.split(',')[0].trim()

    return (request as any).ip || request.headers.get('x-forwarded-for') || 'unknown'
  }

  /**
   * Check if path should be skipped
   */
  private shouldSkipPath(pathname: string): boolean {
    return this.config.excludePaths.some(path => pathname.startsWith(path))
  }

  /**
   * Check if path requires authentication
   */
  private requiresAuth(pathname: string): boolean {
    const authRequiredPaths = ['/admin', '/api/admin', '/dashboard', '/profile']
    return authRequiredPaths.some(path => pathname.startsWith(path))
  }

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(response: NextResponse, info: RateLimitInfo): void {
    response.headers.set('X-RateLimit-Limit', info.limit.toString())
    response.headers.set('X-RateLimit-Remaining', info.remaining.toString())
    response.headers.set('X-RateLimit-Reset', info.reset.toString())
  }

  /**
   * Create rate limit response
   */
  private createRateLimitResponse(info: RateLimitInfo): NextResponse {
    const response = NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later',
        retryAfter: info.retryAfter
      },
      { status: 429 }
    )

    this.addRateLimitHeaders(response, info)
    if (info.retryAfter) {
      response.headers.set('Retry-After', info.retryAfter.toString())
    }

    return response
  }

  /**
   * Create threat block response
   */
  private createThreatBlockResponse(threat: ThreatDetectionResult): NextResponse {
    return NextResponse.json(
      {
        error: 'Security threat detected',
        message: 'Request blocked for security reasons',
        threatType: threat.threatType,
        severity: threat.severity
      },
      { status: 403 }
    )
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    ipAddress?: string,
    userAgent?: string,
    pathname?: string
  ): Promise<void> {
    try {
      // For now, log to console. In production, this would go to the database
      console.warn(`🚨 Security Event: ${eventType} (${severity}) - ${description}`, {
        ipAddress,
        userAgent,
        pathname,
        timestamp: new Date().toISOString()
      })

      // Store in cache for rate limiting and analysis
      if (ipAddress) {
        const key = `security_events:${ipAddress}`
        await this.cache.increment(key, 1)
        await this.cache.expire(key, 3600) // 1 hour
      }
    } catch (error) {
      console.error('Error logging security event:', error)
    }
  }

  /**
   * Log request for audit purposes
   */
  private async logRequest(
    request: NextRequest,
    clientIP: string,
    userAgent: string
  ): Promise<void> {
    try {
      const logData = {
        method: request.method,
        url: request.nextUrl.toString(),
        ip: clientIP,
        userAgent,
        timestamp: new Date().toISOString(),
        headers: Object.fromEntries(request.headers.entries())
      }

      // In production, this would be sent to a logging service
      if (process.env.NODE_ENV === 'development') {
        console.log('📝 Request Log:', logData)
      }
    } catch (error) {
      console.error('Error logging request:', error)
    }
  }

  /**
   * Create middleware function for Next.js
   */
  static create(config?: Partial<SecurityMiddlewareConfig>) {
    const middleware = new SecurityMiddleware(config)
    return (request: NextRequest) => middleware.handle(request)
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(): Promise<{
    totalRequests: number
    blockedRequests: number
    threatsByType: Record<string, number>
    topIPs: Array<{ ip: string; requests: number }>
    rateLimitHits: number
  }> {
    try {
      // This would typically come from a proper metrics store
      // For now, return mock data
      return {
        totalRequests: 0,
        blockedRequests: 0,
        threatsByType: {},
        topIPs: [],
        rateLimitHits: 0
      }
    } catch (error) {
      console.error('Error getting security metrics:', error)
      return {
        totalRequests: 0,
        blockedRequests: 0,
        threatsByType: {},
        topIPs: [],
        rateLimitHits: 0
      }
    }
  }
}

// Export middleware instance
export const securityMiddleware = SecurityMiddleware.create()

// Export configuration helpers
export function createSecurityConfig(
  overrides: Partial<SecurityMiddlewareConfig> = {}
): SecurityMiddlewareConfig {
  return {
    ...SecurityMiddleware['DEFAULT_CONFIG'],
    ...overrides
  }
}

// Export rate limiting utilities
export class RateLimiter {
  private cache = getCacheManager()

  async checkLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number; reset: number }> {
    try {
      const current = await this.cache.get<number>(key) || 0
      const remaining = Math.max(0, limit - current - 1)
      const reset = Math.floor(Date.now() / 1000) + window

      if (current >= limit) {
        return { allowed: false, remaining: 0, reset }
      }

      await this.cache.increment(key, 1)
      if (current === 0) {
        await this.cache.expire(key, window)
      }

      return { allowed: true, remaining, reset }
    } catch (error) {
      console.error('Rate limiter error:', error)
      return { allowed: true, remaining: limit, reset: 0 }
    }
  }
}
