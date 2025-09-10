import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { dbPool } from '@/lib/db-pool'
import { tokenConfigService } from '@/lib/services/token-config'
import { z } from 'zod'
import { createAuthHandler } from '@/lib/utils/api-route-protection'
import { withConnection, withTransaction } from '@/lib/utils/db-migration-helper'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

const TopUpSchema = z.object({
  amount: z.number().min(1).max(10000),
  paymentMethodId: z.string().optional(),
  reason: z.string().optional()
})

async function handleGET(request: NextRequest, context: any) {
  const { user } = context;
  
  const userData = await withConnection('get_user_token_balance', (prisma) =>
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        tokenBalance: true,
        subscriptions: {
          select: {
            plan: {
              select: {
                name: true,
                tokenQuota: true
              }
            },
            status: true
          },
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    })
  )

  if (!userData) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    )
  }

  // Get usage analytics for the current month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const analytics = await tokenConfigService.getTokenAnalytics(
    user.id,
    startOfMonth
  )

  // Get forecast for next 30 days
  const forecast = await tokenConfigService.getTokenForecast(user.id, 30)

  const planTokenQuota = userData.subscriptions?.[0]?.plan?.tokenQuota || 0
  const usagePercentage = planTokenQuota > 0 
    ? (analytics.totalConsumed / planTokenQuota) * 100 
    : 0

  return NextResponse.json({
    success: true,
    data: {
      currentBalance: userData.tokenBalance,
      monthlyUsage: analytics.totalConsumed,
      planQuota: planTokenQuota,
      usagePercentage,
      remainingQuota: Math.max(0, planTokenQuota - analytics.totalConsumed),
      forecast: {
        projectedUsage: forecast.projectedUsage,
        confidence: forecast.confidence,
        willExceedQuota: forecast.projectedUsage > (planTokenQuota - analytics.totalConsumed),
        daysUntilDepletion: userData.tokenBalance > 0 && analytics.averageDaily > 0
          ? Math.floor(userData.tokenBalance / analytics.averageDaily)
          : null
      },
      analytics: {
        averageDaily: analytics.averageDaily,
        byFeature: analytics.byFeature,
        efficiency: analytics.efficiency
      }
    }
  })
}

async function handlePOST(request: NextRequest, context: any) {
  const { user } = context;
  const body = await request.json();
  const { amount, paymentMethodId, reason } = TopUpSchema.parse(body);

  // For now, we'll implement a simple top-up without payment processing
  // In a real implementation, this would integrate with Stripe or other payment providers
  
  const result = await withTransaction(async (prisma) => {
    // Get current balance
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenBalance: true }
    });
    
    if (!currentUser) {
      throw new Error('User not found');
    }
    
    // Update user balance
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        tokenBalance: {
          increment: amount
        }
      },
      select: {
        tokenBalance: true
      }
    });

    // Record the top-up transaction
    await prisma.tokenTransaction.create({
      data: {
        userId: user.id,
        type: 'PURCHASED',
        amount,
        balanceBefore: currentUser.tokenBalance,
        balanceAfter: updatedUser.tokenBalance,
        source: 'manual_topup',
        description: reason || `Token top-up: ${amount} tokens`,
        metadata: {
          paymentMethodId,
          reason
        }
      }
    });
    
    return updatedUser;
  });

  return NextResponse.json({
    success: true,
    data: {
      newBalance: result.tokenBalance,
      topUpAmount: amount,
      message: `Successfully added ${amount} tokens to your account`
    }
  })
}

// 使用新的安全处理器
export const GET = createAuthHandler(handleGET, {
  rateLimit: true,
  requiredPermissions: ['read:own-data']
});

export const POST = createAuthHandler(async (request: NextRequest, context: any) => {
  const result = await handlePOST(request, context);
  return result;
}, {
  rateLimit: true,
  requiredPermissions: ['update:profile']
});