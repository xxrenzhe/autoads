import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { TokenService } from '@/lib/services/token-service';
import { TokenTransactionService } from '@/lib/services/token-transaction-service';

/**
 * POST /api/payment/verify
 * Verify payment completion and credit tokens to user account
 */
export async function POST(request: NextRequest) {
  try {
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

    // In a real implementation, you would verify the payment with the payment provider
    // For demo purposes, we'll simulate successful payment
    
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
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

        // Record token transaction
        await TokenTransactionService.recordTransaction({
          userId: purchase.userId,
          type: 'PURCHASED',
          amount: purchase.tokens,
          balanceBefore: purchase.user.tokenBalance,
          balanceAfter: purchase.user.tokenBalance + purchase.tokens,
          source: 'token_purchase',
          description: `Token purchase: ${purchase.provider}`,
          metadata: {
            purchaseId: purchase.id,
            paymentMethod,
            amount: purchase.amount
          }
        });
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
        await TokenTransactionService.recordTransaction({
          userId: purchase.userId,
          type: 'BONUS',
          amount: bonusTokens,
          balanceBefore: purchase.user.tokenBalance + purchase.tokens,
          balanceAfter: purchase.user.tokenBalance + purchase.tokens + bonusTokens,
          source: 'purchase_bonus',
          description: `Purchase bonus: ${purchase.provider}`,
          metadata: {
            purchaseId: purchase.id,
            originalPurchase: purchase.tokens
          }
        });
      }

      return {
        success: true,
        tokensCredited: purchase.tokens + bonusTokens,
        purchaseId: purchase.id
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}