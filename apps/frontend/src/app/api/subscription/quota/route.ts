import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SubscriptionQuotaService } from '@/lib/services/subscription-quota-service';

/**
 * GET /api/subscription/quota
 * Get user's current quota usage
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get quota summary
    const quotaSummary = await SubscriptionQuotaService.getUserQuotaSummary(userId);
    
    // Get quota alerts
    const alerts = await SubscriptionQuotaService.getQuotaAlerts(userId);

    // Get user's subscription info
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gt: new Date()
        }
      },
      include: {
        plan: {
          select: {
            name: true,
            description: true,
            price: true,
            currency: true,
            interval: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        subscription: subscription ? {
          planName: subscription.plan.name,
          planDescription: subscription.plan.description,
          price: subscription.plan.price,
          currency: subscription.plan.currency,
          interval: subscription.plan.interval,
          currentPeriodEnd: subscription.currentPeriodEnd,
          source: subscription.source
        } : null,
        quotas: quotaSummary,
        alerts,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching quota information:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quota information' },
      { status: 500 }
    );
  }
}