import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { SubscriptionService } from '@/lib/services/subscription-service'
import { requireIdempotencyKey } from '@/lib/utils/idempotency'
import { ensureNextWriteAllowed } from '@/lib/utils/writes-guard'
import { forwardToGo } from '@/lib/bff/forward'
import { errorResponse, successResponse, ResponseCode } from '@/lib/api/response'

/**
 * GET /api/user/subscription/change/plans
 * 获取可变更的计划列表
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', undefined, 401)
    }

    const currentSubscription = await SubscriptionService.getUserSubscription(session.user.id)
    const availablePlans = await SubscriptionService.getAvailablePlans(
      currentSubscription?.planId
    )

    return successResponse({
      currentSubscription,
      availablePlans
    })
  } catch (error) {
    console.error('Error getting subscription plans:', error)
    return errorResponse('Failed to get subscription plans', 'INTERNAL_ERROR')
  }
}

/**
 * POST /api/user/subscription/change
 * 创建订阅变更请求
 */
export async function POST(request: NextRequest) {
  try {
    requireIdempotencyKey(request as any)
    const session = await auth()
    
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', undefined, 401)
    }

    const body = await request.json()
    const { newPlanId, billingCycle } = body

    if (!newPlanId) {
      return errorResponse('New plan ID is required', 'BAD_REQUEST')
    }

    try {
      const resp = await forwardToGo(new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({ new_plan_id: newPlanId, billing_cycle: billingCycle }) }), { targetPath: '/api/v1/user/subscription/change', method: 'POST', appendSearch: false })
      if (resp.ok) return resp
    } catch {}

    ensureNextWriteAllowed()
    const result = await SubscriptionService.createSubscriptionChange(session.user.id, newPlanId, billingCycle)
    return successResponse(result, 'Subscription change created')
  } catch (error) {
    console.error('Error creating subscription change:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to create subscription change',
      'INTERNAL_ERROR'
    )
  }
}
