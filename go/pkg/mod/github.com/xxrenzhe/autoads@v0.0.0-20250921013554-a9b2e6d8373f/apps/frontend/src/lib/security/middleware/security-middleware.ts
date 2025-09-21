import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { permissionManager } from '../rbac/permission-manager'
import { policyEngine } from '../rbac/policy-engine'
import { sessionManager } from '../session/session-manager'
import { threatDetector } from '../threat-detection/threat-detector'
import { auditLogger } from '../audit/audit-logger'

export interface SecurityMiddlewareConfig {
  enableThreatDetection: boolean
  enableAuditLogging: boolean
  enableRBAC: boolean
  enableSessionValidation: boolean
  bypassPaths: string[]
}

export class SecurityMiddleware {
  private config: SecurityMiddlewareConfig = {
    enableThreatDetection: true,
    enableAuditLogging: true,
    enableRBAC: true,
    enableSessionValidation: true,
    bypassPaths: [
      '/api/auth',
      '/api/health',
      '/favicon.ico',
      '/_next',
      '/public'
    ]
  }

  constructor(config?: Partial<SecurityMiddlewareConfig>) {
    this.config = { ...this.config, ...config }
  }

  /**
   * Main security middleware function
   */
  async handle(request: NextRequest): Promise<NextResponse | null> {
    const { pathname } = request.nextUrl

    // Skip security checks for bypass paths
    if (this.shouldBypass(pathname)) {
      return null
    }

    try {
      // Get client information
      const clientInfo = this.getClientInfo(request)

      // Check if IP is blocked
      if (this.config.enableThreatDetection) {
        const isBlocked = await threatDetector.isIPBlocked(clientInfo.ipAddress)
        if (isBlocked) {
          await this.logSecurityEvent('blocked_ip_access', 'failure', clientInfo)
          return new NextResponse('Access Denied', { status: 403 })
        }
      }

      // Get user session
      const token = await getToken({ req: request })
      
      if (token?.sub) {
        // Validate session if enabled
        if (this.config.enableSessionValidation) {
          const sessionValid = await this.validateUserSession(token.sub, clientInfo)
          if (!sessionValid) {
            return new NextResponse('Session Invalid', { status: 401 })
          }
        }

        // Check permissions for protected routes
        if (this.isProtectedRoute(pathname)) {
          const hasPermission = await this.checkPermissions(
            token.sub,
            pathname,
            request.method,
            clientInfo
          )

          if (!hasPermission) {
            await this.logSecurityEvent('unauthorized_access', 'failure', {
              ...clientInfo,
              userId: token.sub,
              resource: pathname,
              action: request.method
            })
            return new NextResponse('Unauthorized', { status: 403 })
          }
        }

        // Threat detection
        if (this.config.enableThreatDetection) {
          await this.performThreatDetection(token.sub, clientInfo, pathname, request.method)
        }

        // Audit logging
        if (this.config.enableAuditLogging) {
          await this.logAuditEvent(token.sub, pathname, request.method, clientInfo)
        }
      } else if (this.requiresAuthentication(pathname)) {
        // Redirect to login for protected routes
        const loginUrl = new URL('/auth/signin', request.url)
        loginUrl.searchParams.set('callbackUrl', request.url)
        return NextResponse.redirect(loginUrl)
      }

      return null // Continue to next middleware/handler
    } catch (error) {
      console.error('Security middleware error:', error)
      
      // Log the error but don't block the request unless it's critical
      await this.logSecurityEvent('middleware_error', 'error', {
        error: error instanceof Error ? error.message : "Unknown error" as any,
        pathname
      })

      return null
    }
  }

  /**
   * Check if path should bypass security checks
   */
  private shouldBypass(pathname: string): boolean {
    return this.config.bypassPaths.some(path => pathname.startsWith(path))
  }

  /**
   * Get client information from request
   */
  private getClientInfo(request: NextRequest) {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwarded?.split(',')[0] || realIp || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    return {
      ipAddress,
      userAgent,
      timestamp: new Date()
    }
  }

  /**
   * Validate user session
   */
  private async validateUserSession(userId: string, clientInfo: any): Promise<boolean> {
    try {
      // Check for suspicious activity
      const suspiciousActivity = await sessionManager.monitorSuspiciousActivity(
        userId,
        clientInfo.ipAddress,
        clientInfo.userAgent
      )

      if (suspiciousActivity.isSuspicious) {
        await this.logSecurityEvent('suspicious_activity', 'failure', {
          ...clientInfo,
          userId,
          reason: suspiciousActivity.reason
        })
        return false
      }

      return true
    } catch (error) {
      console.error('Session validation error:', error)
      return false
    }
  }

  /**
   * Check if route is protected
   */
  private isProtectedRoute(pathname: string): boolean {
    const protectedPaths = ['/admin', '/dashboard', '/api/user']

    return protectedPaths.some(path => pathname.startsWith(path))
  }

  /**
   * Check if route requires authentication
   */
  private requiresAuthentication(pathname: string): boolean {
    const authRequiredPaths = [
      '/dashboard',
      '/admin',
      '/profile',
      '/settings'
    ]

    return authRequiredPaths.some(path => pathname.startsWith(path))
  }

  /**
   * Check user permissions
   */
  private async checkPermissions(
    userId: string,
    pathname: string,
    method: string,
    clientInfo: any
  ): Promise<boolean> {
    if (!this.config.enableRBAC) return true

    try {
      const { resource, action } = this.mapRouteToPermission(pathname, method)
      
      // Use policy engine for comprehensive evaluation
      const evaluation = await policyEngine.evaluate(userId, resource, action, {
        userId,
        userRole: 'USER', // Would get from user session
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        sessionId: 'current', // Would get from session
        timestamp: new Date(clientInfo.timestamp || Date.now())
      })

      return evaluation.allowed
    } catch (error) {
      console.error('Permission check error:', error)
      return false
    }
  }

  /**
   * Map route to resource and action
   */
  private mapRouteToPermission(pathname: string, method: string): { resource: string; action: string } {
    // Admin routes
    if (pathname.startsWith('/admin') || pathname.startsWith('/ops')) {
      if (pathname.includes('/users')) return { resource: 'users', action: method.toLowerCase() }
      if (pathname.includes('/config')) return { resource: 'config', action: method.toLowerCase() }
      if (pathname.includes('/tokens')) return { resource: 'tokens', action: 'configure' }
      if (pathname.includes('/security')) return { resource: 'security', action: 'read' }
      return { resource: 'admin', action: method.toLowerCase() }
    }

    // User routes
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/user')) {
      if (pathname.includes('/profile')) return { resource: 'profile', action: method.toLowerCase() }
      if (pathname.includes('/tokens')) return { resource: 'tokens', action: 'read' }
      if (pathname.includes('/subscription')) return { resource: 'subscription', action: method.toLowerCase() }
      return { resource: 'user', action: method.toLowerCase() }
    }

    // Feature routes
    if (pathname.includes('/siterank')) return { resource: 'siterank', action: 'use' }
    if (pathname.includes('/batchopen')) return { resource: 'batchopen', action: 'use' }
    if (pathname.includes('/adscenter')) return { resource: 'adscenter', action: 'use' }

    return { resource: 'general', action: method.toLowerCase() }
  }

  /**
   * Perform threat detection
   */
  private async performThreatDetection(
    userId: string,
    clientInfo: any,
    pathname: string,
    method: string
  ): Promise<void> {
    try {
      await threatDetector.analyzeThreat(
        userId,
        clientInfo.ipAddress,
        clientInfo.userAgent,
        `${method} ${pathname}`,
        { pathname, method }
      )
    } catch (error) {
      console.error('Threat detection error:', error)
    }
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    userId: string,
    pathname: string,
    method: string,
    clientInfo: any
  ): Promise<void> {
    try {
      const category = pathname.startsWith('/admin') ? 'admin' : 
                     pathname.startsWith('/api') ? 'data_access' : 'user'

      await auditLogger.log({
        userId,
        action: `${method} ${pathname}`,
        resource: pathname,
        category: category as any,
        severity: 'low',
        outcome: 'success',
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent
      })
    } catch (error) {
      console.error('Audit logging error:', error)
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    eventType: string,
    outcome: 'success' | 'failure' | 'error',
    details: any
  ): Promise<void> {
    try {
      await auditLogger.logSecurity(
        eventType,
        outcome,
        details,
        details.userId,
        details.ipAddress,
        details.userAgent
      )
    } catch (error) {
      console.error('Security event logging error:', error)
    }
  }
}

// Export singleton instance
export const securityMiddleware = new SecurityMiddleware()

// Export factory function for custom configuration
export function createSecurityMiddleware(config?: Partial<SecurityMiddlewareConfig>) {
  return new SecurityMiddleware(config)
}
