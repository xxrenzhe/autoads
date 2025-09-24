import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { freeTierControl } from '@/lib/access-control/free-tier-control'

export interface AccessControlConfig {
  enableAccessControl: boolean
  protectedRoutes: Array<{
    path: string
    feature: string
    operation?: string
    requiresAuth?: boolean
  }>
  bypassPaths: string[]
}

export class AccessControlMiddleware {
  private config: AccessControlConfig = {
    enableAccessControl: true,
    protectedRoutes: [
      // API routes
      { path: '/api/features/siterank', feature: 'SITERANK', operation: 'analyze', requiresAuth: true },
      { path: '/api/features/batchopen', feature: 'BATCHOPEN', operation: 'batch', requiresAuth: true },
      { path: '/api/features/adscenter', feature: 'CHANGELINK', operation: 'change', requiresAuth: true },
      { path: '/api/user/tokens', feature: 'REPORT', requiresAuth: true },
      { path: '/api/user/export', feature: 'EXPORT', requiresAuth: true },
      
      // Page routes
      { path: '/dashboard', feature: 'ADMIN', requiresAuth: true },
      { path: '/features/siterank', feature: 'SITERANK', requiresAuth: true },
      { path: '/features/batchopen', feature: 'BATCHOPEN', requiresAuth: true },
      { path: '/features/adscenter', feature: 'CHANGELINK', requiresAuth: true }
    ],
    bypassPaths: [
      '/api/auth',
      '/api/health',
      '/api/user/access-control',
      '/pricing',
      '/auth',
      '/_next',
      '/favicon.ico'
    ]
  }

  constructor(config?: Partial<AccessControlConfig>) {
    this.config = { ...this.config, ...config }
  }

  /**
   * Main access control middleware function
   */
  async handle(request: NextRequest): Promise<NextResponse | null> {
    if (!this.config.enableAccessControl) {
      return null
    }

    const { pathname } = request.nextUrl

    // Skip access control for bypass paths
    if (this.shouldBypass(pathname)) {
      return null
    }

    // Find matching protected route
    const protectedRoute = this.findProtectedRoute(pathname)
    if (!protectedRoute) {
      return null // Not a protected route
    }

    try {
      // Get user token
      const token = await getToken({ req: request })

      // Check authentication requirement
      if (protectedRoute.requiresAuth && !token?.sub) {
        return this.redirectToAuth(request, pathname)
      }

      // Skip access control for unauthenticated users on non-auth-required routes
      if (!token?.sub) {
        return null
      }

      // Check feature access
      const access = await freeTierControl.checkFeatureAccess(
        token.sub,
        protectedRoute.feature,
        protectedRoute.operation
      )

      if (!access.hasAccess) {
        return this.handleAccessDenied(request, access, protectedRoute)
      }

      return null // Access granted
    } catch (error) {
      console.error('Access control middleware error:', error)
      return null // Allow access on error to prevent blocking
    }
  }

  /**
   * Check if path should bypass access control
   */
  private shouldBypass(pathname: string): boolean {
    return this.config.bypassPaths.some(path => pathname.startsWith(path))
  }

  /**
   * Find matching protected route
   */
  private findProtectedRoute(pathname: string) {
    return this.config.protectedRoutes.find((route: any) => 
      pathname.startsWith(route.path)
    )
  }

  /**
   * Redirect to authentication
   */
  private redirectToAuth(request: NextRequest, pathname: string): NextResponse {
    const loginUrl = new URL('/auth/signin', request.url)
    loginUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(loginUrl)
  }

  /**
   * Handle access denied scenarios
   */
  private handleAccessDenied(
    request: NextRequest, 
    access: any, 
    route: any
  ): NextResponse {
    const { pathname } = request.nextUrl

    // For API routes, return JSON error
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({
        error: 'Access denied',
        reason: access.reason,
        upgradeRequired: access.upgradeRequired,
        feature: access.feature
      }, { status: 403 })
    }

    // For page routes, redirect to upgrade page or show access denied
    if (access.upgradeRequired) {
      const upgradeUrl = new URL('/pricing', request.url)
      upgradeUrl.searchParams.set('feature', route.feature)
      upgradeUrl.searchParams.set('reason', 'upgrade_required')
      return NextResponse.redirect(upgradeUrl)
    }

    // For usage limits, redirect to dashboard with message
    if (access.usageLimit) {
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('message', 'usage_limit_reached')
      dashboardUrl.searchParams.set('feature', route.feature)
      return NextResponse.redirect(dashboardUrl)
    }

    // Default: redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  /**
   * Record feature usage (call this after successful access)
   */
  async recordUsage(
    userId: string,
    feature: string,
    operation: string = 'default',
    count: number = 1
  ): Promise<void> {
    try {
      await freeTierControl.recordUsage(userId, feature, count)
    } catch (error) {
      console.error('Error recording usage:', error)
    }
  }

  /**
   * Middleware wrapper for API routes
   */
  withAccessControl(
    feature: string,
    operation?: string,
    requiresAuth: boolean = true
  ) {
    return async (request: NextRequest, userId?: string) => {
      if (!this.config.enableAccessControl) {
        return null
      }

      if (requiresAuth && !userId) {
        throw new Error('Authentication required')
      }

      if (userId) {
        const access = await freeTierControl.checkFeatureAccess(
          userId,
          feature,
          operation
        )

        if (!access.hasAccess) {
          const error = new Error(access.reason || 'Access denied') as any
          error.statusCode = 403
          error.upgradeRequired = access.upgradeRequired
          error.feature = feature
          throw error
        }

        // Record usage
        await this.recordUsage(userId, feature, operation || 'api_call')
      }

      return null
    }
  }
}

// Export singleton instance
export const accessControlMiddleware = new AccessControlMiddleware()

// Export factory function for custom configuration
export function createAccessControlMiddleware(config?: Partial<AccessControlConfig>) {
  return new AccessControlMiddleware(config)
}

// Helper function for API route protection
export function requireFeatureAccess(
  feature: string,
  operation?: string
) {
  return accessControlMiddleware.withAccessControl(feature, operation)
}

// Helper function to check if user can access a feature
export async function canAccessFeature(
  userId: string,
  feature: string,
  operation?: string
): Promise<boolean> {
  try {
    const access = await freeTierControl.checkFeatureAccess(userId, feature, operation)
    return access.hasAccess
  } catch (error) {
    console.error('Error checking feature access:', error)
    return false
  }
}
