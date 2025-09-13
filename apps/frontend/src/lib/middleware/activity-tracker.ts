import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { AnalyticsService } from '@/lib/services/analytics-service'

export interface ActivityTrackingOptions {
  action?: string
  resource?: string
  metadata?: Record<string, any>
  skipTracking?: boolean
}

export class ActivityTracker {
  private static instance: ActivityTracker

  static getInstance(): ActivityTracker {
    if (!ActivityTracker.instance) {
      ActivityTracker.instance = new ActivityTracker()
    }
    return ActivityTracker.instance
  }

  /**
   * Track user activity
   */
  async trackActivity(
    request: NextRequest,
    options: ActivityTrackingOptions = {}
  ): Promise<void> {
    try {
      if (options.skipTracking) {
        return
      }

      // Get user session
      const session = await auth()
      if (!session?.user?.id) {
        return // Don't track anonymous users for now
      }

      const url = new URL(request.url)
      const pathname = url.pathname
      const method = request.method

      // Determine action and resource
      const action = options.action || this.extractActionFromPath(pathname, method)
      const resource = options.resource || this.extractResourceFromPath(pathname)

      // Skip tracking for certain paths
      if (this.shouldSkipPath(pathname)) {
        return Promise.resolve()
      }

      // Collect metadata
      const metadata = {
        ...options.metadata,
        method,
        pathname,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        ip: this.getClientIP(request),
        timestamp: new Date().toISOString()
      }

      // Record the activity
      await AnalyticsService.recordActivity({
        userId: session.user.id,
        action,
        resource,
        metadata,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error tracking activity:', error)
      // Don't throw error to avoid breaking the main request
    }
  }

  /**
   * Extract action from URL path and method
   */
  private extractActionFromPath(pathname: string, method: string): string {
    // Remove leading slash and split by slash
    const segments = pathname.replace(/^\//, '').split('/')

    // Handle API routes
    if (segments[0] === 'api') {
      if (segments[1] === 'admin') {
        return `admin_${segments[2] || 'unknown'}_${method.toLowerCase()}`
      }
      return `api_${segments[1] || 'unknown'}_${method.toLowerCase()}`
    }

    // Handle admin routes
    if (segments[0] === 'admin') {
      return `admin_${segments[1] || 'dashboard'}_view`
    }

    // Handle main application routes
    switch (segments[0]) {
      case '':
      case 'dashboard':
        return 'dashboard_view'
      case 'siterank':
        return 'siterank_use'
      case 'batchopen':
        return 'batchopen_use'
      case 'adscenter':
        return 'adscenter_use'
      case 'pricing':
        return 'pricing_view'
      case 'account':
        return 'account_view'
      case 'auth':
        return `auth_${segments[1] || 'unknown'}`
      default:
        return `${segments[0]}_view`
    }
  }

  /**
   * Extract resource from URL path
   */
  private extractResourceFromPath(pathname: string): string {
    // Remove query parameters and fragments
    const cleanPath = pathname.split('?')[0].split('#')[0]
    
    // Replace dynamic segments with placeholders
    let resource = cleanPath
      .replace(/\/[a-f0-9]{24,}/g, '/:id') // MongoDB-style IDs
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:id') // Other IDs
      .replace(/\/\d+/g, '/:id') // Numeric IDs

    return resource || '/'
  }

  /**
   * Check if path should be skipped from tracking
   */
  private shouldSkipPath(pathname: string): boolean {
    const skipPatterns = [
      '/api/auth',
      '/api/health',
      '/api/admin/analytics', // Don't track analytics API calls
      '/_next',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml'
    ]

    return skipPatterns.some(pattern => pathname.startsWith(pattern))
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    // Try various headers for IP address
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const clientIP = request.headers.get('x-client-ip')

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    if (realIP) {
      return realIP
    }
    if (clientIP) {
      return clientIP
    }

    return 'unknown'
  }

  /**
   * Track specific user action
   */
  async trackUserAction(
    userId: string,
    action: string,
    resource: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await AnalyticsService.recordActivity({
        userId,
        action,
        resource,
        metadata: {
          ...metadata,
          source: 'manual_tracking'
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error tracking user action:', error)
    }
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(
    userId: string,
    feature: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.trackUserAction(userId, `feature_${feature}`, `/features/${feature}`, {
      ...metadata,
      featureType: 'usage'
    })
  }

  /**
   * Track page view
   */
  async trackPageView(
    userId: string,
    page: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.trackUserAction(userId, 'page_view', page, {
      ...metadata,
      eventType: 'page_view'
    })
  }

  /**
   * Track user engagement events
   */
  async trackEngagement(
    userId: string,
    engagementType: 'login' | 'logout' | 'signup' | 'subscription' | 'payment',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.trackUserAction(userId, `user_${engagementType}`, `/user/${engagementType}`, {
      ...metadata,
      eventType: 'engagement',
      engagementType
    })
  }

  /**
   * Batch track multiple activities
   */
  async batchTrackActivities(
    activities: Array<{
      userId: string
      action: string
      resource: string
      metadata?: Record<string, any>
    }>
  ): Promise<void> {
    try {
      const activitiesWithTimestamp = activities?.filter(Boolean)?.map((activity: any) => ({
        userId: activity.userId,
        action: activity.action,
        resource: activity.resource,
        metadata: {
          ...activity.metadata,
          source: 'batch_tracking'
        },
        timestamp: new Date().toISOString()
      }))

      await AnalyticsService.recordActivities(activitiesWithTimestamp)
    } catch (error) {
      console.error('Error batch tracking activities:', error)
    }
  }
}

export const activityTracker = ActivityTracker.getInstance()

/**
 * Higher-order function to wrap API routes with activity tracking
 */
export function withActivityTracking(
  handler: (request: NextRequest, ...args: any[]) => Promise<Response>,
  options: ActivityTrackingOptions = {}
) {
  return async (request: NextRequest, ...args: any[]): Promise<Response> => {
    // Track the activity before processing the request
    await activityTracker.trackActivity(request, options)
    
    // Execute the original handler
    return await handler(request, ...args)
  }
}

/**
 * Middleware for tracking page views in Next.js pages
 */
export async function trackPageView(
  request: NextRequest,
  options: ActivityTrackingOptions = {}
): Promise<void> {
  await activityTracker.trackActivity(request, {
    ...options,
    action: options.action || 'page_view'
  })
}