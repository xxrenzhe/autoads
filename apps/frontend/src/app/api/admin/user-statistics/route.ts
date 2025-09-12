import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'day';

    // Set default date range to last 30 days if not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);

    // Format dates to start and end of day
    const startOfDay = new Date(start);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);

    // Get daily user registration statistics
    const userRegistrations = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${groupBy}, "createdAt")::date as date,
        COUNT(*)::int as total_users,
        COUNT(CASE WHEN "emailVerified" = true THEN 1 END)::int as verified_users,
        COUNT(CASE WHEN "isActive" = true THEN 1 END)::int as active_users
      FROM "User"
      WHERE "createdAt" >= ${startOfDay} 
        AND "createdAt" <= ${endOfDay}
      GROUP BY DATE_TRUNC(${groupBy}, "createdAt")::date
      ORDER BY date ASC
    ` as Array<{
      date: Date;
      total_users: number;
      verified_users: number;
      active_users: number;
    }>;

    // Get subscription statistics by plan
    const subscriptionStats = await prisma.subscription.groupBy({
      by: ['planId'],
      _count: {
        _all: true,
      },
      where: {
        status: 'ACTIVE',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Get plan details
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
      },
    });

    // Create plan statistics map
    const planStatsMap = new Map();
    plans.forEach(plan => {
      planStatsMap.set(plan.id, {
        planName: plan.name,
        price: plan.price,
        count: 0,
      });
    });

    // Map subscription counts to plans
    subscriptionStats.forEach(stat => {
      const planStat = planStatsMap.get(stat.planId);
      if (planStat) {
        planStat.count = stat._count._all;
      }
    });

    // Convert to array and sort by count
    const subscriptionByPlan = Array.from(planStatsMap.values())
      .filter(stat => stat.count > 0)
      .sort((a, b) => b.count - a.count);

    // Calculate cumulative statistics
    const totalRegistrations = userRegistrations.reduce((sum, day) => sum + day.total_users, 0);
    const totalActiveSubscriptions = subscriptionByPlan.reduce((sum, plan) => sum + plan.count, 0);

    // Get user growth trend
    const userGrowth = await prisma.user.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    return NextResponse.json({
      dailyRegistrations: userRegistrations.map(item => ({
        date: item.date.toISOString().split('T')[0],
        totalUsers: item.total_users,
        verifiedUsers: item.verified_users,
        activeUsers: item.active_users,
      })),
      subscriptionByPlan,
      summary: {
        totalRegistrations,
        totalActiveSubscriptions,
        newSubscriptions: subscriptionStats.reduce((sum, stat) => sum + stat._count._all, 0),
        averageDailyRegistrations: Math.round(totalRegistrations / Math.max(1, userRegistrations.length)),
      },
      userGrowth: userGrowth.map(item => ({
        status: item.status,
        count: item._count._all,
      })),
    });
  } catch (error) {
    console.error('User statistics API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}