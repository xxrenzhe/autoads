import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { requireIdempotencyKey } from '@/lib/utils/idempotency';
import { TokenService } from '@/lib/services/token-service';
import { ensureNextWriteAllowed } from '@/lib/utils/writes-guard'
import { forwardToGo } from '@/lib/bff/forward'

/**
 * POST /api/user/tokens/purchase
 * Create a token purchase request
 */
export async function POST(request: NextRequest) {
  try {
    ensureNextWriteAllowed()
    requireIdempotencyKey(request as any)
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tokens, amount, currency = 'USD', provider = 'stripe', packageId, orderId } = body;

    // Prefer Go authoritative purchase when packageId/orderId provided
    try {
      if (packageId && orderId) {
        const resp = await forwardToGo(new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({ package_id: packageId, order_id: orderId }) }), { targetPath: '/api/v1/tokens/purchase', method: 'POST', appendSearch: false })
        if (resp.ok) return resp
      }
    } catch {}

    if (!tokens || !amount || tokens <= 0 || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid tokens or amount' },
        { status: 400 }
      );
    }

    // Get user's current plan to check if extra tokens are allowed
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: 'ACTIVE'
      },
      include: {
        plan: true
      }
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    if (!subscription.plan.allowExtraTokens) {
      return NextResponse.json(
        { error: 'Extra token purchases not allowed for your plan' },
        { status: 400 }
      );
    }

    // Create token purchase record
    const purchase = await prisma.tokenPurchase.create({
      data: {
        userId: session.user.id,
        tokens,
        amount,
        currency,
        provider,
        status: 'PENDING'
      }
    });

    // If using Stripe, create payment intent
    if (provider === 'stripe') {
      const { StripeService } = await import('@/lib/services/stripe-service');
      const paymentIntent = await StripeService.createPaymentIntent(
        session.user.id,
        Math.round(amount * 100), // Convert to cents
        currency.toLowerCase(),
        {
          type: 'token_purchase',
          purchaseId: purchase.id,
          tokens: tokens.toString()
        }
      );

      return NextResponse.json({
        purchaseId: purchase.id,
        clientSecret: paymentIntent.clientSecret,
        amount: purchase.amount,
        tokens: purchase.tokens,
        currency: purchase.currency
      });
    }

    return NextResponse.json({
      purchaseId: purchase.id,
      amount: purchase.amount,
      tokens: purchase.tokens,
      currency: purchase.currency,
      status: purchase.status
    });

  } catch (error) {
    console.error('Token purchase error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/tokens/purchase
 * Get user's token purchase history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [purchases, total] = await Promise.all([
      prisma.tokenPurchase.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.tokenPurchase.count({
        where: { userId: session.user.id }
      })
    ]);

    return NextResponse.json({
      purchases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get token purchases error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
