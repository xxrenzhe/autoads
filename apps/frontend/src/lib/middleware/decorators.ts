import { NextRequest, NextResponse } from 'next/server'
import { 
  requireAuth, 
  requirePermission, 
  requireRole, 
  requireAdmin, 
  requireSuperAdmin,
  requireFeatureAccess,
  logApiAccess,
  rateLimit,
  AuthContext,
  PermissionOptions
} from './enhanced-auth-middleware'
// Prisma $Enums not available in current client version; use string union instead
type TokenUsageFeature = string;

/**
 * Type for API handler functions
 */
export type ApiHandler = (
  request: NextRequest,
  context: { params?: any },
  authContext?: AuthContext
) => Promise<NextResponse>

/**
 * Type for middleware configuration
 */
export interface MiddlewareConfig {
  auth?: boolean
  permission?: PermissionOptions
  roles?: string[]
  admin?: boolean
  superAdmin?: boolean
  feature?: TokenUsageFeature
  rateLimit?: {
    windowMs: number
    maxRequests: number
    keyGenerator?: (context: AuthContext) => string
  }
  logging?: boolean
}

/**
 * Decorator function that applies middleware to API handlers
 */
export function withMiddleware(config: MiddlewareConfig) {
  return function (handler: ApiHandler) {
    return async function (request: NextRequest, context: { params?: any }) {
      const startTime = Date.now()
      let authContext: AuthContext | undefined
      let response: NextResponse

      try {
        // Apply authentication if required
        if (config.auth || config.permission || config.roles || config.admin || config.superAdmin || config.feature) {
          const authResult = await requireAuth(request)
          if (!authResult.success) {
            return authResult.response!
          }
          authContext = authResult.context!
        }

        // Apply permission checks
        if (config.permission && authContext) {
          const permResult = await requirePermission(request, config.permission)
          if (!permResult.success) {
            return permResult.response!
          }
        }

        // Apply role checks
        if (config.roles && authContext) {
          const roleResult = await requireRole(request, { roles: config.roles })
          if (!roleResult.success) {
            return roleResult.response!
          }
        }

        // Apply admin check
        if (config.admin && authContext) {
          const adminResult = await requireAdmin(request)
          if (!adminResult.success) {
            return adminResult.response!
          }
        }

        // Apply super admin check
        if (config.superAdmin && authContext) {
          const superAdminResult = await requireSuperAdmin(request)
          if (!superAdminResult.success) {
            return superAdminResult.response!
          }
        }

        // Apply feature access check
        if (config.feature && authContext) {
          const featureResult = await requireFeatureAccess(request, config.feature)
          if (!featureResult.success) {
            return featureResult.response!
          }
        }

        // Apply rate limiting
        if (config.rateLimit && authContext) {
          const rateLimitResult = await rateLimit(request, config.rateLimit.maxRequests, config.rateLimit.windowMs)
          // Rate limit function returns boolean, not an object with success/response
          if (!rateLimitResult) {
            return NextResponse.json(
              { error: 'Rate limit exceeded' },
              { status: 429 }
            )
          }
        }

        // Call the actual handler
        response = await handler(request, context, authContext)

        // Log API access if enabled
        if (config.logging && authContext) {
          const responseTime = Date.now() - startTime
          await logApiAccess(request, 'api_call', request.url)
        }

        return response

      } catch (error) {
        console.error('Middleware error:', error)
        response = NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        )

        // Still log the error if logging is enabled
        if (config.logging && authContext) {
          const responseTime = Date.now() - startTime
          await logApiAccess(request, 'api_error', request.url)
        }

        return response
      }
    }
  }
}

/**
 * Convenience decorators for common middleware combinations
 */

// Authentication only
export const withAuth = withMiddleware({ auth: true, logging: true })

// Admin authentication
export const withAdmin = withMiddleware({ 
  auth: true, 
  admin: true, 
  logging: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100 // 100 requests per minute for admins
  }
})

// Super admin authentication
export const withSuperAdmin = withMiddleware({ 
  auth: true, 
  superAdmin: true, 
  logging: true,
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 200 // Higher limit for super admins
  }
})

// User management permissions
export const withUserManagement = withMiddleware({
  auth: true,
  permission: { resource: 'users', action: 'read' },
  logging: true
})

// Analytics permissions
export const withAnalytics = withMiddleware({
  auth: true,
  permission: { resource: 'analytics', action: 'read' },
  logging: true
})

// Feature-specific decorators
export const withSiteRankAccess = withMiddleware({
  auth: true,
  feature: 'SITERANK',
  logging: true,
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 60 // 1 request per second
  }
})

export const withBatchOpenAccess = withMiddleware({
  auth: true,
  feature: 'BATCHOPEN',
  logging: true,
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 30 // 30 requests per minute
  }
})

export const withAdsCenterAccess = withMiddleware({
  auth: true,
  feature: 'CHANGELINK',
  logging: true,
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 10 // 10 requests per minute (more expensive feature)
  }
})

/**
 * Custom permission decorator factory
 */
export function withPermission(resource: string, action: string, options?: {
  allowSelf?: boolean
  resourceIdParam?: string
  rateLimit?: {
    windowMs: number
    maxRequests: number
  }
}) {
  return withMiddleware({
    auth: true,
    permission: {
      resource,
      action,
      allowSelf: options?.allowSelf,
      resourceIdParam: options?.resourceIdParam
    },
    logging: true,
    rateLimit: options?.rateLimit
  })
}

/**
 * Custom role decorator factory
 */
export function withRoles(roles: string[], options?: {
  rateLimit?: {
    windowMs: number
    maxRequests: number
  }
}) {
  return withMiddleware({
    auth: true,
    roles,
    logging: true,
    rateLimit: options?.rateLimit
  })
}

/**
 * Custom feature decorator factory
 */
export function withFeature(feature: TokenUsageFeature, options?: {
  rateLimit?: {
    windowMs: number
    maxRequests: number
  }
}) {
  return withMiddleware({
    auth: true,
    feature,
    logging: true,
    rateLimit: options?.rateLimit
  })
}

/**
 * Rate limiting decorator factory
 */
export function withRateLimit(windowMs: number, maxRequests: number, keyGenerator?: (context: AuthContext) => string) {
  return withMiddleware({
    auth: true,
    logging: true,
    rateLimit: {
      windowMs,
      maxRequests,
      keyGenerator
    }
  })
}

/**
 * Utility function to extract user ID from request params
 */
export function extractUserId(request: NextRequest, paramName: string = 'userId'): string | null {
  const url = new URL(request.url)
  const pathSegments = url.pathname.split('/')
  const userIdIndex = pathSegments.findIndex(segment => segment === paramName)
  
  if (userIdIndex !== -1 && userIdIndex + 1 < pathSegments.length) {
    return pathSegments[userIdIndex + 1]
  }
  
  return null
}

/**
 * Utility function to check if user is accessing their own resource
 */
export function isSelfAccess(authContext: AuthContext, resourceUserId: string): boolean {
  return authContext.userId === resourceUserId
}

/**
 * Error response helpers
 */
export const ErrorResponses = {
  unauthorized: () => NextResponse.json(
    { error: 'Authentication required' },
    { status: 401 }
  ),
  
  forbidden: (message?: string) => NextResponse.json(
    { error: message || 'Access forbidden' },
    { status: 403 }
  ),
  
  notFound: (resource?: string) => NextResponse.json(
    { error: `${resource || 'Resource'} not found` },
    { status: 404 }
  ),
  
  rateLimited: (retryAfter: number) => NextResponse.json(
    { error: 'Rate limit exceeded', retryAfter },
    { 
      status: 429,
      headers: { 'Retry-After': retryAfter.toString() }
    }
  ),
  
  badRequest: (message?: string) => NextResponse.json(
    { error: message || 'Bad request' },
    { status: 400 }
  ),
  
  internalError: (message?: string) => NextResponse.json(
    { error: message || 'Internal server error' },
    { status: 500 }
  )
}

/**
 * Success response helpers
 */
export const SuccessResponses = {
  ok: (data?: any) => NextResponse.json(
    { success: true, ...data },
    { status: 200 }
  ),
  
  created: (data?: any) => NextResponse.json(
    { success: true, ...data },
    { status: 201 }
  ),
  
  noContent: () => new NextResponse(null, { status: 204 })
}
