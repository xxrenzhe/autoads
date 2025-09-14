import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { TokenService } from '@/lib/services/token-service';
import { $Enums } from '@prisma/client';

type TokenType = $Enums.TokenType;

/**
 * POST /api/webhooks/stripe/tokens
 * Handle Stripe webhook for token purchases
 */
export async function POST(request: NextRequest) {
  // Stripe integration disabled
  try {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 501 });
  } catch (error) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 501 });
  }
}

/*
// Previous implementation kept for reference
export async function POST_OLD(request: NextRequest) {
  try {
    const signature = request.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TOKENS;

    if (!signature || !webhookSecret) {
      return NextResponse.json(
        { error: 'Missing signature or webhook secret' },
        { status: 400 }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-07-30.basil',
    });

    // Verify webhook signature and construct event
    const event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret
    );

    // Handle payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;
      const metadata = paymentIntent.metadata;

      // Check if this is a token purchase
      if (metadata.type === 'token_purchase' && metadata.purchaseId) {
        // Complete the token purchase
        const purchase = await prisma.tokenPurchase.update({
          where: { id: metadata.purchaseId },
          data: {
            status: 'COMPLETED',
            providerId: paymentIntent.id,
            metadata: {
              ...metadata,
              paymentIntentId: paymentIntent.id,
              receivedAt: new Date().toISOString()
            }
          }
        });

        // Add tokens to user balance with expiration handling
        const { TokenExpirationService } = await import('@/lib/services/token-expiration-service');
        await TokenExpirationService.addTokensWithExpiration(
          metadata.userId,
          parseInt(metadata.tokens),
          $Enums.TokenType.PURCHASED,
          undefined, // Purchased tokens don't expire
          {
            purchaseId: metadata.purchaseId,
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount / 100
          }
        );

        console.log(`Token purchase completed: ${metadata.purchaseId}`);
      }
    }

    // Handle payment_intent.payment_failed event
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as any;
      const metadata = paymentIntent.metadata;

      if (metadata.type === 'token_purchase' && metadata.purchaseId) {
        await prisma.tokenPurchase.update({
          where: { id: metadata.purchaseId },
          data: {
            status: 'FAILED',
            providerId: paymentIntent.id,
            metadata: {
              ...metadata,
              paymentIntentId: paymentIntent.id,
              failureReason: paymentIntent.last_payment_error?.message,
              failedAt: new Date().toISOString()
            }
          }
        });

        console.log(`Token purchase failed: ${metadata.purchaseId}`);
      }
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
*/
