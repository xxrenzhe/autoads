import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware/enhanced-auth-middleware'
import { PlanService } from '@/lib/services/plan-service'
import { PlanAnalyticsService } from '@/lib/services/plan-analytics-service'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/plans - Get all plans with statistics
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.success || !authResult.context) {
    return authResult.response!
  }

  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const action = searchParams.get('action') || 'list'

    switch (action) {
      case 'list':
        const plans = await PlanService.getAllPlans(includeInactive)
        
        // Get real plan comparison data
        const comparison = await PlanAnalyticsService.getAllPlansComparison()
        
        // Get overall analytics
        const analytics = await PlanAnalyticsService.getOverallAnalytics()
        
        return NextResponse.json({
          success: true,
          data: {
            plans,
            comparison,
            analytics
          },
          message: 'Plans retrieved successfully'
        })

      case 'stats':
        const stats = await PlanService.getPlanStats()
        return NextResponse.json({
          success: true,
          data: stats,
          message: 'Plan statistics retrieved successfully'
        })

      case 'initialize':
        // Only SUPER_ADMIN can initialize default plans
        if (authResult.context.session?.user.role !== 'SUPER_ADMIN') {
          return NextResponse.json({
            success: false,
            error: 'Only SUPER_ADMIN can initialize default plans'
          }, { status: 403 })
        }

        const initResult = await PlanService.initializeDefaultPlans()
        return NextResponse.json({
          success: initResult.success,
          data: { created: initResult.plans?.length || 0 },
          message: initResult.message
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action parameter'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Failed to handle plans request:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to handle plans request'
    }, { status: 500 })
  }
}

/**
 * POST /api/admin/plans - Create a new plan
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.success || !authResult.context) {
    return authResult.response!
  }

  try {
    const body = await request.json()
    const {
      name,
      displayName,
      description,
      price,
      currency = 'USD',
      interval = 'MONTH',
      billingPeriod,
      tokenQuota,
      rateLimit,
      features,
      stripePriceId,
      stripeYearlyPriceId,
      isActive = true
    } = body

    // Validate required fields
    if (!name || !description || price === undefined || !tokenQuota || !rateLimit || !features) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: name, description, price, tokenQuota, rateLimit, features'
      }, { status: 400 })
    }

    // Validate price
    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json({
        success: false,
        error: 'Price must be a non-negative number'
      }, { status: 400 })
    }

    // Validate token quota and rate limit
    if (typeof tokenQuota !== 'number' || tokenQuota < 0) {
      return NextResponse.json({
        success: false,
        error: 'Token quota must be a non-negative number'
      }, { status: 400 })
    }

    if (typeof rateLimit !== 'number' || rateLimit < 1) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit must be a positive number'
      }, { status: 400 })
    }

    const planData = {
      name: name.toLowerCase().replace(/\s+/g, '_'),
      displayName: displayName || name,
      description,
      price,
      currency,
      interval: interval as 'MONTH' | 'YEAR',
      billingPeriod: billingPeriod || (interval === 'YEAR' ? 'YEARLY' : 'MONTHLY'),
      tokenQuota,
      rateLimit,
      features,
      stripePriceId,
      stripeYearlyPriceId,
      isActive
    }

    const result = await PlanService.createPlan(planData, authResult.context.userId)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: result.plan,
      message: 'Plan created successfully'
    })
  } catch (error) {
    console.error('Failed to create plan:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create plan'
    }, { status: 500 })
  }
}