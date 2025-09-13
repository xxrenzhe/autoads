import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's active subscription with plan features
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
        currentPeriodEnd: { gt: new Date() }
      },
      include: {
        plan: {
          include: {
            planFeatures: true
          }
        }
      }
    });

    // Default limits for free users
    const defaultLimits = {
      siterank: { batchLimit: 100 },
      batchopen: { versions: ['basic', 'silent'] },
      adscenter: { maxCampaigns: 0 },
      api: { rateLimit: 30 }
    };

    if (!subscription) {
      return NextResponse.json({
        limits: defaultLimits,
        planName: 'Free',
        planId: 'free'
      });
    }

    // Build limits from plan features
    const limits = {
      siterank: { 
        batchLimit: subscription.plan.planFeatures.find((f: any) => f.featureName === 'WEBSITE_RANKING_BATCH_LIMIT')?.limit || 100 
      },
      batchopen: { 
        versions: [
          ...(subscription.plan.planFeatures.find((f: any) => f.featureName === 'REAL_CLICK_BASIC')?.enabled ? ['basic'] : []),
          ...(subscription.plan.planFeatures.find((f: any) => f.featureName === 'REAL_CLICK_SILENT')?.enabled ? ['silent'] : []),
          ...(subscription.plan.planFeatures.find((f: any) => f.featureName === 'REAL_CLICK_AUTOMATED')?.enabled ? ['automated', 'autoclick'] : [])
        ].filter(Boolean)
      },
      adscenter: { 
        maxCampaigns: subscription.plan.planFeatures.find((f: any) => f.featureName === 'ADS_ACCOUNT_LIMIT')?.limit || 0 
      },
      api: { 
        rateLimit: subscription.plan.rateLimit || 30 
      }
    };

    return NextResponse.json({
      limits,
      planName: subscription.plan.name,
      planId: subscription.plan.id,
      subscriptionId: subscription.id
    });
  } catch (error) {
    console.error('Error fetching subscription limits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription limits' },
      { status: 500 }
    );
  }
}
