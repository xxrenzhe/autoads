import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SubscriptionExpirationService } from '@/lib/services/subscription-expiration-service';

/**
 * POST /api/admin/subscriptions/check-expired
 * 
 * Admin endpoint to manually trigger subscription expiration check
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentUser || !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get stats before processing
    const statsBefore = await SubscriptionExpirationService.getExpiringStats();

    // Trigger expiration check
    const results = await SubscriptionExpirationService.triggerExpirationCheck();

    // Get stats after processing
    const statsAfter = await SubscriptionExpirationService.getExpiringStats();

    return NextResponse.json({
      message: 'Subscription expiration check completed',
      results: {
        processedSubscriptions: results.length,
        successful: results.filter((r: any) => r.status === 'expired_and_downgraded').length,
        errors: results.filter((r: any) => r.status === 'error').length
      },
      stats: {
        before: statsBefore,
        after: statsAfter
      },
      details: results
    });

  } catch (error) {
    console.error('Error triggering subscription expiration check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/subscriptions/expiring-stats
 * 
 * Admin endpoint to get statistics about expiring subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentUser || !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get expiring subscriptions stats
    const stats = await SubscriptionExpirationService.getExpiringStats();

    return NextResponse.json({
      stats
    });

  } catch (error) {
    console.error('Error getting expiring subscriptions stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}