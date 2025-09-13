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

    // Get user usage data
    const users = await prisma.user.findMany({
      where: {
        token_usage: {
          some: {
            createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
          }
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        token_usage: {
          where: {
            createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
          },
          select: {
            tokensConsumed: true,
            feature: true,
            createdAt: true,
            isBatch: true,
            itemCount: true
          }
        },
        behaviorAnalytics: {
          where: {
            action: 'feature_usage',
            createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
          },
          select: {
            feature: true,
            duration: true
          }
        }
      },
      orderBy: {
        tokenUsage: {
          _sum: {
            tokensConsumed: 'desc'
          }
        }
      } as any
    });

    const processedUsers = users.map((user: any) => {
      const totalTokens = user.token_usage.reduce((sum: number, usage: any) => sum + usage.tokensConsumed, 0);
      const operations = user.token_usage.length;
      const batchOperations = user.token_usage.filter((usage: any) => usage.isBatch).length;
      
      // Calculate preferred features
      const featureCount = new Map<string, number>();
      user.token_usage.forEach((usage: any) => {
        featureCount.set(usage.feature, (featureCount.get(usage.feature) || 0) + 1);
      });
      
      const preferredFeatures = Array.from(featureCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([feature]) => feature);

      return {
        userId: user.id,
        userName: user.name || user.email,
        userEmail: user.email,
        totalTokens,
        operations,
        averageTokens: operations > 0 ? totalTokens / operations : 0,
        batchUsageRate: operations > 0 ? (batchOperations / operations * 100) : 0,
        preferredFeatures,
        activityPattern: totalTokens > 1000 ? 'heavy' : totalTokens > 100 ? 'moderate' : 'light',
        lastActivity: user.token_usage.length > 0 
          ? user.token_usage.reduce((latest: Date, usage: any) => 
              usage.createdAt > latest ? usage.createdAt : latest, 
              user.token_usage[0].createdAt
            ).toISOString()
          : null
      };
    });

    return NextResponse.json({
      users: processedUsers
    });
  } catch (error) {
    console.error('Token usage by user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
