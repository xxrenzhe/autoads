import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'day';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing date parameters' }, { status: 400 });
    }

    // Get feature usage data
    const features = await prisma.token_usage.groupBy({
      by: ['feature'],
      where: {
        createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
      },
      _sum: { tokensConsumed: true },
      _count: { _all: true },
      _avg: { tokensConsumed: true },
      orderBy: { _sum: { tokensConsumed: 'desc' } }
    });

    const totalTokens = features.reduce((sum, feature: any) => sum + (feature._sum.tokensConsumed || 0), 0);

    // Get time series data for trends
    const timeSeries = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${groupBy}, "createdAt")::date as date,
        feature,
        SUM("tokensConsumed") as tokens,
        COUNT(*) as operations
      FROM "TokenUsage"
      WHERE "createdAt" >= ${new Date(startDate)} 
        AND "createdAt" <= ${new Date(endDate)}
      GROUP BY DATE_TRUNC(${groupBy}, "createdAt")::date, feature
      ORDER BY date ASC, feature ASC
    ` as Array<{
      date: Date;
      feature: string;
      tokens: number;
      operations: number;
    }>;

    // Process time series to get daily totals
    const processedTimeSeries: any[] = [];
    const dateMap = new Map<string, any>();
    
    timeSeries.forEach((item: any) => {
      const dateStr = item.date.toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, {
          date: dateStr,
          tokens: 0,
          operations: 0,
          users: new Set()
        });
      }
      
      const entry = dateMap.get(dateStr)!;
      entry.tokens += Number(item.tokens);
      entry.operations += Number(item.operations);
    });

    // Get unique users per day
    const dailyUsers = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${groupBy}, "createdAt")::date as date,
        COUNT(DISTINCT "userId") as users
      FROM "TokenUsage"
      WHERE "createdAt" >= ${new Date(startDate)} 
        AND "createdAt" <= ${new Date(endDate)}
      GROUP BY DATE_TRUNC(${groupBy}, "createdAt")::date
      ORDER BY date ASC
    ` as Array<{
      date: Date;
      users: number;
    }>;

    dailyUsers.forEach((item: any) => {
      const dateStr = item.date.toISOString().split('T')[0];
      const entry = dateMap.get(dateStr);
      if (entry) {
        entry.users = Number(item.users);
      }
    });

    processedTimeSeries.push(...Array.from(dateMap.values()));

    return NextResponse.json({
      features: features.map((feature: any) => ({
        feature: feature.feature,
        totalTokens: feature._sum.tokensConsumed || 0,
        operations: feature._count._all,
        averageCost: feature._avg.tokensConsumed || 0,
        percentage: totalTokens > 0 ? ((feature._sum.tokensConsumed || 0) / totalTokens * 100) : 0
      })),
      timeSeries: processedTimeSeries
    });
  } catch (error) {
    console.error('Token usage by feature error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}