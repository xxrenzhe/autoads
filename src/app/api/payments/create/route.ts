import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subscriptionId, amount, currency } = await request.json()

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true }
    })

    if (!subscription || subscription.userId !== session.user?.id) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId: session.user?.id,
        subscriptionId,
        amount,
        currency: currency || 'USD',
        status: 'PENDING',
        provider: 'wise',
        metadata: {
          description: `Payment for ${subscription.plan?.name} subscription`,
          callbackUrl: `${process.env.NEXTAUTH_URL}/api/payments/wise/webhook`
        }
      }
    })

    // Here you would integrate with Wise API
    // For now, we'll simulate a successful payment
    // In production, you would:
    // 1. Create a Wise transfer
    // 2. Get the redirect URL
    // 3. Return the redirect URL to the client

    // Simulate Wise API response
    const redirectUrl = `https://wise.com/pay/${payment.id}` // This would come from Wise API

    return NextResponse.json({
      paymentId: payment.id,
      redirectUrl,
      status: 'pending'
    })

  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}