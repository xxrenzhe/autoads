import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/users/[userId]/subscription/history
 * 
 * Admin endpoint to get a user's subscription history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const userId = params.userId;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get the user to verify they exist
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get subscription history
    const [subscriptions, totalCount] = await Promise.all([
      prisma.subscription.findMany({
        where: { userId },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
              currency: true,
              interval: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.subscription.count({
        where: { userId }
      })
    ]);

    // Format the subscription history
    const subscriptionHistory = subscriptions.map((sub: any) => ({
      id: sub.id,
      plan: {
        id: sub.plan.id,
        name: sub.plan.name,
        price: sub.plan.price,
        currency: sub.plan.currency,
        interval: sub.plan.interval
      },
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      source: sub.source,
      changeReason: sub.changeReason,
      cancelledAt: sub.cancelledAt,
      createdAt: sub.createdAt,
      metadata: sub.metadata
    }));

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      subscriptions: subscriptionHistory,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching subscription history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
