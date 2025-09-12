import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/enhanced-auth-middleware'
import { StripeService } from '@/lib/services/stripe-service'
import { PlanService } from '@/lib/services/plan-service'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * POST /api/subscription/subscribe - Subscribe to a plan
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult.response!
  }

  try {
    const body = await request.json()
    const { planId, paymentMethodId } = body

    if (!planId) {
      return NextResponse.json({
        success: false,
        error: 'planId is required'
      }, { status: 400 })
    }

    // Check if plan exists and is active
    const plan = await PlanService.getPlanById(planId)
    if (!plan || !plan.isActive) {
      return NextResponse.json({
        success: false,
        error: 'Plan not found or inactive'
      }, { status: 404 })
    }

    // Check if user already has an active subscription
    const existingSubscription = await StripeService.getUserSubscription(authResult.context.userId)
    if (existingSubscription && ['active', 'trialing'].includes(existingSubscription.status)) {
      return NextResponse.json({
        success: false,
        error: 'User already has an active subscription. Please cancel or upgrade existing subscription.'
      }, { status: 409 })
    }

    // Create subscription
    const result = await StripeService.createSubscription(
      authResult.context.userId,
      planId
    )

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        subscription: result.subscription,
        clientSecret: result.clientSecret,
        plan: plan
      },
      message: 'Subscription created successfully'
    })
  } catch (error) {
    console.error('Failed to create subscription:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create subscription'
    }, { status: 500 })
  }
}