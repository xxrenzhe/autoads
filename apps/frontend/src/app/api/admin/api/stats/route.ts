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

    // Get current date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get basic stats
    const [
      totalRequests,
      successRequests,
      totalResponseTime,
      endpoints,
      hourlyUsage,
      dailyUsage,
      statusCodes
    ] = await Promise.all([
      // Total requests in last 24 hours
      prisma.apiUsage.count({
        where: { timestamp: { gte: today } }
      }),
      // Successful requests (2xx)
      prisma.apiUsage.count({
        where: { 
          timestamp: { gte: today },
          statusCode: { gte: 200, lt: 300 }
        }
      }),
      // Average response time
      prisma.apiUsage.aggregate({
        where: { timestamp: { gte: today } },
        _avg: { responseTime: true }
      }),
      // Endpoint statistics
      prisma.apiUsage.groupBy({
        by: ['endpoint'],
        where: { timestamp: { gte: today } },
        _count: { id: true },
        _avg: { responseTime: true },
        orderBy: { _count: { id: 'desc' } }
      }),
      // Hourly usage for the last 24 hours
      prisma.$queryRaw`
        SELECT 
          EXTRACT(HOUR FROM timestamp) as hour,
          COUNT(*) as requests
        FROM api_usage
        WHERE timestamp >= ${today}
        GROUP BY EXTRACT(HOUR FROM timestamp)
        ORDER BY hour
      ` as unknown as Array<{ hour: string; requests: number }>,
      // Daily usage for the last 7 days
      prisma.$queryRaw`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as requests
        FROM api_usage
        WHERE timestamp >= ${sevenDaysAgo}
        GROUP BY DATE(timestamp)
        ORDER BY date
      ` as unknown as Array<{ date: string; requests: number }>,
      // Status code distribution
      prisma.$queryRaw`
        SELECT 
          statusCode,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM api_usage
        WHERE timestamp >= ${today}
        GROUP BY statusCode
        ORDER BY count DESC
      ` as unknown as Array<{ statusCode: number; count: number; percentage: number }>
    ]);

    // Calculate success rate
    const successRate = totalRequests > 0 
      ? (successRequests / totalRequests) * 100 
      : 0;

    // Format hourly data with all hours
    const formattedHourlyUsage = Array.from({ length: 24 }, (_, i) => {
      const hourData = hourlyUsage.find(((h: any) => parseInt(h.hour) === i);
      return {
        hour: `${i}:00`,
        requests: hourData?.requests || 0
      };
    });

    // Process endpoint data
    const endpointStats = endpoints.map(((endpoint: any) => ({
      endpoint: endpoint.endpoint,
      count: endpoint._count.id,
      avgResponseTime: Math.round(endpoint._avg.responseTime || 0),
      successRate: 0 // Would need additional query
    }));

    return NextResponse.json({
      totalRequests,
      successRate,
      avgResponseTime: Math.round(totalResponseTime._avg.responseTime || 0),
      endpoints: endpointStats,
      hourlyUsage: formattedHourlyUsage,
      dailyUsage,
      statusCodes: statusCodes.map(((sc: any) => ({
        code: sc.statusCode,
        count: sc.count,
        percentage: sc.percentage
      }))
    });
  } catch (error) {
    console.error('API stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}