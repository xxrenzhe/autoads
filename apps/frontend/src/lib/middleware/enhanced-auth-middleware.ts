import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { PermissionService } from '@/lib/services/permission-service'
import { prisma } from '@/lib/db'

export interface AuthContext {
  userId: string
  user: {
    id: string
    email: string
    name: string | null
    role: string
    status: string
    isActive: boolean
    tokenBalance: number
  }
  session: any
}

export interface PermissionOptions {
  resource: string
  action: string
  allowSelf?: boolean // Allow users to access their own resources
  resourceIdParam?: string // Parameter name for resource ID (e.g., 'userId')
  requireTokens?: number // Minimum tokens required
}

export interface RoleOptions {
  roles: string[]
  strict?: boolean // If true, user must have exact role. If false, higher roles are allowed
}

/**
 * Enhanced authentication middleware with three-level role system
 */
export async function requireAuth(request: NextRequest): Promise<{
  success: boolean
  context?: AuthContext
  response?: NextResponse
}> {
  try {
    const session = await auth()
    
    if (!session?.userId) {
      return {
        success: false,
        response: NextResponse.json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }, { status: 401 })
      }
    }

    // Get user details with enhanced fields
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tokenBalance: true,
        emailVerified: true,
      }
    })

    if (!user) {
      return {
        success: false,
        response: NextResponse.json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        }, { status: 401 })
      }
    }

    // Check if user account is active
    if (user.status !== 'ACTIVE') {
      return {
        success: false,
        response: NextResponse.json({ 
          error: 'Account is not active',
          status: user.status,
          code: 'ACCOUNT_INACTIVE'
        }, { status: 403 })
      }
    }

    // Check email verification
    if (!user.emailVerified) {
      return {
        success: false,
        response: NextResponse.json({ 
          error: 'Email verification required',
          code: 'EMAIL_NOT_VERIFIED'
        }, { status: 403 })
      }
    }

    return {
      success: true,
      context: {
        userId: user.id,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          isActive: user.status === 'ACTIVE',
          tokenBalance: user.tokenBalance,
        },
        session
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error)
    return {
      success: false,
      response: NextResponse.json({ 
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      }, { status: 500 })
    }
  }
}

/**
 * Enhanced permission middleware with resource and action-based permissions
 */
export async function requirePermission(
  request: NextRequest,
  options: PermissionOptions
): Promise<{
  success: boolean
  context?: AuthContext
  response?: NextResponse
}> {
  // First check authentication
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult
  }

  const { context } = authResult
  const { resource, action, allowSelf, resourceIdParam, requireTokens } = options

  try {
    // Check token balance if required
    if (requireTokens && context.user.tokenBalance < requireTokens) {
      return {
        success: false,
        response: NextResponse.json({
          error: 'Insufficient token balance',
          required: requireTokens,
          current: context.user.tokenBalance,
          code: 'INSUFFICIENT_TOKENS'
        }, { status: 402 })
      }
    }

    // Check if user has the required permission
    const hasPermission = await PermissionService.hasPermission(
      context.userId,
      resource,
      action
    )

    if (hasPermission) {
      return { success: true, context }
    }

    // If permission denied but allowSelf is true, check if accessing own resource
    if (allowSelf && resourceIdParam) {
      const url = new URL(request.url)
      const pathSegments = url.pathname.split('/')
      
      // Find resource ID in path
      let resourceId: string | undefined
      const paramName = resourceIdParam.replace('[', '').replace(']', '')
      
      for (let i = 0; i < pathSegments.length; i++) {
        if (pathSegments[i] === paramName && pathSegments[i + 1]) {
          resourceId = pathSegments[i + 1]
          break
        }
      }

      if (resourceId === context.userId) {
        return { success: true, context }
      }
    }

    return {
      success: false,
      response: NextResponse.json({ 
        error: 'Insufficient permissions',
        required: `${resource}:${action}`,
        userRole: context.user.role,
        code: 'INSUFFICIENT_PERMISSIONS'
      }, { status: 403 })
    }
  } catch (error) {
    console.error('Permission middleware error:', error)
    return {
      success: false,
      response: NextResponse.json({ 
        error: 'Permission check failed',
        code: 'PERMISSION_ERROR'
      }, { status: 500 })
    }
  }
}

/**
 * Enhanced role-based middleware with hierarchical role support
 */
export async function requireRole(
  request: NextRequest,
  options: RoleOptions
): Promise<{
  success: boolean
  context?: AuthContext
  response?: NextResponse
}> {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult
  }

  const { context } = authResult
  const { roles, strict = false } = options

  // Define role hierarchy (higher index = higher privilege)
  const roleHierarchy = ['USER', 'ADMIN']
  const userRoleIndex = roleHierarchy.indexOf(context.user.role)
  
  if (userRoleIndex === -1) {
    return {
      success: false,
      response: NextResponse.json({ 
        error: 'Invalid user role',
        userRole: context.user.role,
        code: 'INVALID_ROLE'
      }, { status: 403 })
    }
  }

  let hasRequiredRole = false

  if (strict) {
    // Exact role match required
    hasRequiredRole = roles.includes(context.user.role)
  } else {
    // Hierarchical role check - higher roles can access lower role resources
    const minRequiredRoleIndex = Math.min(...roles?.filter(Boolean)?.map((role: any) => roleHierarchy.indexOf(role)))
    hasRequiredRole = userRoleIndex >= minRequiredRoleIndex
  }

  if (!hasRequiredRole) {
    return {
      success: false,
      response: NextResponse.json({ 
        error: 'Insufficient role permissions',
        required: roles,
        current: context.user.role,
        code: 'INSUFFICIENT_ROLE'
      }, { status: 403 })
    }
  }

  return { success: true, context }
}

/**
 * Admin middleware - requires ADMIN role
 */
export async function requireAdmin(request: NextRequest): Promise<{
  success: boolean
  context?: AuthContext
  response?: NextResponse
}> {
  return requireRole(request, { roles: ['ADMIN'] })
}

/**
 * Super Admin middleware - removed; ADMIN is the highest role
 */
export async function requireSuperAdmin(request: NextRequest): Promise<{ success: boolean; context?: AuthContext; response?: NextResponse }> { return requireRole(request, { roles: ['ADMIN'] }) }

/**
 * Free access middleware - allows unauthenticated users with limited access
 */
export async function allowFreeAccess(
  request: NextRequest,
  options: {
    features: string[] // Features available to unauthenticated users
    rateLimit?: number // Rate limit for free users
  }
): Promise<{
  success: boolean
  context?: AuthContext | null
  response?: NextResponse
}> {
  try {
    const session = await auth()
    
    // If user is authenticated, use normal auth flow
    if (session?.userId) {
      const authResult = await requireAuth(request)
      return authResult
    }

    // For unauthenticated users, check if requested feature is in free tier
    const url = new URL(request.url)
    const path = url.pathname
    
    // Extract feature from path (e.g., /api/siterank -> siterank)
    const pathSegments = path.split('/').filter(Boolean)
    const feature = pathSegments[pathSegments.length - 1]
    
    if (!options.features.includes(feature)) {
      return {
        success: false,
        response: NextResponse.json({
          error: 'Authentication required for this feature',
          feature,
          availableFeatures: options.features,
          code: 'AUTH_REQUIRED_FOR_FEATURE'
        }, { status: 401 })
      }
    }

    // Apply rate limiting for free users
    if (options.rateLimit) {
      const ip = request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown'
      
      const rateLimitResult = await checkFreeUserRateLimit(ip, options.rateLimit)
      if (!rateLimitResult.success) {
        return {
          success: false,
          response: NextResponse.json({
            error: 'Rate limit exceeded for free users',
            retryAfter: rateLimitResult.retryAfter,
            code: 'FREE_RATE_LIMIT_EXCEEDED'
          }, { status: 429 })
        }
      }
    }

    return {
      success: true,
      context: null // No user context for free access
    }
  } catch (error) {
    console.error('Free access middleware error:', error)
    return {
      success: false,
      response: NextResponse.json({ 
        error: 'Access check failed',
        code: 'ACCESS_ERROR'
      }, { status: 500 })
    }
  }
}

/**
 * Feature access middleware - checks subscription and token balance
 */
export async function requireFeatureAccess(
  request: NextRequest,
  feature: string,
  options?: {
    tokenCost?: number
    consumeTokens?: boolean
  }
): Promise<{
  success: boolean
  context?: AuthContext
  response?: NextResponse
}> {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult
  }

  const { context } = authResult
  const { tokenCost = 1, consumeTokens = false } = options || {}

  try {
    const access = await PermissionService.checkFeatureAccess(context.userId, feature)
    
    if (!access.hasAccess) {
      return {
        success: false,
        response: NextResponse.json({
          error: 'Feature access denied',
          reason: access.reason,
          feature,
          code: 'FEATURE_ACCESS_DENIED'
        }, { status: 403 })
      }
    }

    // Check token cost
    if (tokenCost > 0 && context.user.tokenBalance < tokenCost) {
      return {
        success: false,
        response: NextResponse.json({
          error: 'Insufficient tokens',
          required: tokenCost,
          current: context.user.tokenBalance,
          feature,
          code: 'INSUFFICIENT_TOKENS'
        }, { status: 402 })
      }
    }

    // Consume tokens if requested
    if (consumeTokens && tokenCost > 0) {
      await prisma.user.update({
        where: { id: context.userId },
        data: {
          tokenBalance: {
            decrement: tokenCost
          }
        }
      })

      // Log token usage
      await prisma.token_usage.create({
        data: {
          userId: context.userId,
          feature: feature as any,
          operation: 'consume',
          tokensConsumed: tokenCost,
          tokensRemaining: context.user.tokenBalance - tokenCost,
          planId: 'default', // No planId in user context, use default
          itemCount: 1,
          metadata: {
            balance: context.user.tokenBalance - tokenCost,
          }
        }
      })

      // Update context with new balance
      context.user.tokenBalance -= tokenCost
    }

    return { success: true, context }
  } catch (error) {
    console.error('Feature access check error:', error)
    return {
      success: false,
      response: NextResponse.json({ 
        error: 'Feature access check failed',
        code: 'FEATURE_ACCESS_ERROR'
      }, { status: 500 })
    }
  }
}

/**
 * Rate limiting for free users based on IP
 */
async function checkFreeUserRateLimit(ip: string, maxRequests: number): Promise<{
  success: boolean
  retryAfter?: number
}> {
  try {
    const windowMs = 60 * 60 * 1000 // 1 hour window
    const now = Date.now()
    const windowStart = new Date(now - windowMs)

    // Count recent requests from this IP
    const recentRequests = await prisma.apiUsage.count({
      where: {
        userId: ip, // Use IP as userId for anonymous users
        timestamp: {
          gte: windowStart
        }
      }
    })

    if (recentRequests >= maxRequests) {
      return {
        success: false,
        retryAfter: Math.ceil(windowMs / 1000)
      }
    }

    // Log the request
    await prisma.apiUsage.create({
      data: {
        userId: ip,
        endpoint: 'free-access',
        method: 'GET',
        statusCode: 200,
        responseTime: 0,
        tokenConsumed: 0,
      }
    })

    return { success: true }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // Don't fail the request if rate limiting fails
    return { success: true }
  }
}

/**
 * Middleware composer for combining multiple middleware functions
 */
export function composeMiddleware(
  ...middlewares: Array<(request: NextRequest) => Promise<{
    success: boolean
    context?: AuthContext | null
    response?: NextResponse
  }>>
) {
  return async (request: NextRequest) => {
    let context: AuthContext | null = null

    for (const middleware of middlewares) {
      const result = await middleware(request)
      if (!result.success) {
        return result
      }
      if (result.context) {
        context = result.context
      }
    }

    return { success: true, context }
  }
}

/**
 * Utility functions for creating specific middleware
 */
export const createPermissionMiddleware = (resource: string, action: string, options?: Partial<PermissionOptions>) =>
  (request: NextRequest) => requirePermission(request, { resource, action, ...options })

export const createRoleMiddleware = (roles: string[], strict?: boolean) =>
  (request: NextRequest) => requireRole(request, { roles, strict })

export const createFeatureMiddleware = (feature: string, options?: { tokenCost?: number; consumeTokens?: boolean }) =>
  (request: NextRequest) => requireFeatureAccess(request, feature, options)

export const createFreeAccessMiddleware = (features: string[], rateLimit?: number) =>
  (request: NextRequest) => allowFreeAccess(request, { features, rateLimit })

// Missing exports for compatibility
export const withAuth = requireAuth
export const logApiAccess = async (request: NextRequest, action: string, resource?: string) => {
  // Log API access for audit purposes
  console.log(`API Access: ${action} on ${resource || 'unknown'} by ${request.headers.get('user-agent')}`)
}
export const rateLimit = async (request: NextRequest, limit: number, window: number) => {
  // Simple rate limiting implementation
  return true // Allow all requests for now
}
