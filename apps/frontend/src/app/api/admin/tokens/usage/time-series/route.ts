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

    // Get time series data
    const series = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${groupBy}, "createdAt")::date as date,
        SUM("tokensConsumed") as tokens,
        COUNT(DISTINCT "userId") as users,
        COUNT(*) as operations
      FROM "TokenUsage"
      WHERE "createdAt" >= ${new Date(startDate)} 
        AND "createdAt" <= ${new Date(endDate)}
      GROUP BY DATE_TRUNC(${groupBy}, "createdAt")::date
      ORDER BY date ASC
    ` as Array<{
      date: Date;
      tokens: number;
      users: number;
      operations: number;
    }>;

    const processedSeries = series.map(item => ({
      date: item.date.toISOString().split('T')[0],
      tokens: Number(item.tokens),
      users: Number(item.users),
      operations: Number(item.operations)
    }));

    return NextResponse.json({
      series: processedSeries
    });
  } catch (error) {
    console.error('Token usage time series error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}