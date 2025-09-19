import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { requireIdempotencyKey } from '@/lib/utils/idempotency'
import { ensureNextWriteAllowed } from '@/lib/utils/writes-guard'
import { forwardToGo } from '@/lib/bff/forward'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    requireIdempotencyKey(request as any)
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

    // Prefer Go authoritative payments
    try {
      const resp = await forwardToGo(new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({ subscription_id: subscriptionId, amount, currency: currency || 'USD', provider: 'wise' }) }), { targetPath: '/api/v1/payments/create', method: 'POST', appendSearch: false })
      if (resp.ok) return resp
    } catch {}

    // Fallback (dev only)
    ensureNextWriteAllowed()
    const payment = await prisma.payment.create({ data: { userId: session.user?.id, subscriptionId, amount, currency: currency || 'USD', status: 'PENDING', provider: 'wise', metadata: { description: `Payment for ${subscription.plan?.name} subscription`, callbackUrl: `${process.env.NEXTAUTH_URL}/api/payments/wise/webhook` } } })
    const redirectUrl = `https://wise.com/pay/${payment.id}`
    return NextResponse.json({ paymentId: payment.id, redirectUrl, status: 'pending' })

  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
