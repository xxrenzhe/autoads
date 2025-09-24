import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';

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
      const payload = {
        limits: defaultLimits,
        planName: 'Free',
        planId: 'free'
      };
      const etag = `W/"${Buffer.from(JSON.stringify(payload)).toString('base64')}"`;
      const ifNoneMatch = request.headers.get('if-none-match');
      if (ifNoneMatch === etag) {
        return new NextResponse(null, { status: 304, headers: { 'ETag': etag, 'Cache-Control': 'private, max-age=60' } });
      }
      const res = NextResponse.json(payload);
      res.headers.set('ETag', etag);
      res.headers.set('Cache-Control', 'private, max-age=60');
      return res;
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

    const payload = {
      limits,
      planName: subscription.plan.name,
      planId: subscription.plan.id,
      subscriptionId: subscription.id
    };
    const etag = `W/"${Buffer.from(JSON.stringify(payload)).toString('base64')}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers: { 'ETag': etag, 'Cache-Control': 'private, max-age=60' } });
    }
    const res = NextResponse.json(payload);
    res.headers.set('ETag', etag);
    res.headers.set('Cache-Control', 'private, max-age=60');
    return res;
  } catch (error) {
    console.error('Error fetching subscription limits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription limits' },
      { status: 500 }
    );
  }
}
