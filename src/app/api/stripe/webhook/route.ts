import { NextRequest, NextResponse } from 'next/server'
import { StripeService } from '@/lib/services/stripe-service'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/webhook - Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({
        success: false,
        error: 'Missing Stripe signature'
      }, { status: 400 })
    }

    const result = await StripeService.handleWebhook(body, signature)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      message: 'Webhook processed successfully'
    })
  } catch (error) {
    console.error('Failed to handle Stripe webhook:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook'
    }, { status: 500 })
  }
}