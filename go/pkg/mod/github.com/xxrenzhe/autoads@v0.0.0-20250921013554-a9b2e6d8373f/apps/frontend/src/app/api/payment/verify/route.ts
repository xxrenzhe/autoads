import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { TokenService } from '@/lib/services/token-service';
import { TokenTransactionService } from '@/lib/services/token-transaction-service';
import { requireIdempotencyKey } from '@/lib/utils/idempotency';
import { ensureNextWriteAllowed } from '@/lib/utils/writes-guard'
import { forwardToGo } from '@/lib/bff/forward'

/**
 * POST /api/payment/verify
 * Verify payment completion and credit tokens to user account
 */
export async function POST(request: NextRequest) {
  try {
    // enforce idempotency header for write endpoint
    requireIdempotencyKey(request as any)
    const session = await auth();
    
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { purchaseId, paymentMethod } = await request.json();

    if (!purchaseId) {
      return NextResponse.json(
        { error: 'Missing purchase ID' },
        { status: 400 }
      );
    }

    // Get purchase record
    const purchase = await prisma.tokenPurchase.findUnique({
      where: { id: purchaseId },
      include: {
        user: true
      }
    });

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase not found' },
        { status: 404 }
      );
    }

    if (purchase.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (purchase.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Payment already processed' },
        { status: 400 }
      );
    }

    // Prefer Go authoritative verify (token purchase)
    try {
      const resp = await forwardToGo(new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({ purchase_id: purchaseId, payment_method: paymentMethod }) }), { targetPath: '/api/v1/payments/token-purchase/verify', method: 'POST', appendSearch: false })
      if (resp.ok) return resp
    } catch {}

    // Fallback to Next-side implementation (dev only)
    ensureNextWriteAllowed()
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Snapshot user's balance inside the transaction for consistency
      const userBefore = await tx.user.findUnique({
        where: { id: purchase.userId },
        select: { tokenBalance: true }
      })

      // Update purchase status
      await tx.tokenPurchase.update({
        where: { id: purchaseId },
        data: {
          status: 'COMPLETED'
        }
      });

      // Credit tokens to user
      if (purchase.tokens > 0) {
        await tx.user.update({
          where: { id: purchase.userId },
          data: {
            purchasedTokenBalance: {
              increment: purchase.tokens
            },
            tokenBalance: {
              increment: purchase.tokens
            }
          }
        });

        // Compute balances using the snapshot to ensure atomicity in records
        const balanceBefore = userBefore?.tokenBalance ?? 0
        const balanceAfter = balanceBefore + purchase.tokens

        // Record token transaction within the same transaction
        await TokenTransactionService.recordTransaction({
          userId: purchase.userId,
          type: 'PURCHASED',
          amount: purchase.tokens,
          balanceBefore,
          balanceAfter,
          source: 'token_purchase',
          description: `Token purchase: ${purchase.provider}`,
          metadata: {
            purchaseId: purchase.id,
            paymentMethod,
            amount: purchase.amount
          }
        }, tx);
      }

      // Credit bonus tokens if any (from request metadata)
      const bonusTokens = 0; // Bonus tokens are handled separately through metadata
      if (bonusTokens > 0) {
        await tx.user.update({
          where: { id: purchase.userId },
          data: {
            activityTokenBalance: {
              increment: bonusTokens
            },
            tokenBalance: {
              increment: bonusTokens
            }
          }
        });

        // Record bonus transaction
        const bonusBefore = (userBefore?.tokenBalance ?? 0) + (purchase.tokens || 0)
        const bonusAfter = bonusBefore + bonusTokens
        await TokenTransactionService.recordTransaction({
          userId: purchase.userId,
          type: 'BONUS',
          amount: bonusTokens,
          balanceBefore: bonusBefore,
          balanceAfter: bonusAfter,
          source: 'purchase_bonus',
          description: `Purchase bonus: ${purchase.provider}`,
          metadata: {
            purchaseId: purchase.id,
            originalPurchase: purchase.tokens
          }
        }, tx);
      }

      return {
        success: true,
        tokensCredited: purchase.tokens + bonusTokens,
        purchaseId: purchase.id
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = (error as any)?.status || 500
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: (status === 400 ? 'Missing Idempotency-Key header' : 'Internal server error') },
      { status }
    );
  }
}
