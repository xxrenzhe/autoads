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
    const dimension = searchParams.get('dimension') || 'feature';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing date parameters' }, { status: 400 });
    }

    // Get overall summary
    const [totalTokens, totalOperations, activeUsers, userGrowth] = await Promise.all([
      prisma.token_usage.aggregate({
        where: {
          createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
        },
        _sum: { tokensConsumed: true }
      }),
      
      prisma.token_usage.count({
        where: {
          createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
        }
      }),
      
      prisma.user.count({
        where: {
          status: 'ACTIVE',
          token_usage: {
            some: {
              createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
            }
          }
        }
      }),
      
      // Calculate growth compared to previous period
      prisma.token_usage.aggregate({
        where: {
          createdAt: {
            gte: new Date(new Date(startDate).getTime() - (new Date(endDate).getTime() - new Date(startDate).getTime())),
            lte: new Date(startDate)
          }
        },
        _sum: { tokensConsumed: true }
      })
    ]);

    const currentTotal = totalTokens._sum.tokensConsumed || 0;
    const previousTotal = userGrowth._sum.tokensConsumed || 0;
    const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100) : 0;

    // Get usage by dimension
    let byDimension: any[] = [];
    
    if (dimension === 'feature') {
      byDimension = await prisma.token_usage.groupBy({
        by: ['feature'],
        where: {
          createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
        },
        _sum: { tokensConsumed: true },
        _count: { _all: true },
        orderBy: { _sum: { tokensConsumed: 'desc' } }
      } as any);
    } else if (dimension === 'user') {
      byDimension = await prisma.user.findMany({
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
          token_usage: {
            select: {
              tokensConsumed: true,
            }
          }
        }
      });
    }

    // Get top users
    const topUsers = await prisma.user.findMany({
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
          select: {
            tokensConsumed: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        token_usage: {
          _sum: { tokensConsumed: 'desc' }
        }
      } as any,
      take: 10
    });

    // Get feature usage
    const featureUsage = await prisma.token_usage.groupBy({
      by: ['feature'],
      where: {
        createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
      },
      _sum: { tokensConsumed: true },
      _count: { _all: true },
      orderBy: { _sum: { tokensConsumed: 'desc' } }
    });

    const totalUsers = await prisma.user.count({ where: { status: 'ACTIVE' } });

    return NextResponse.json({
      summary: {
        totalTokens: currentTotal,
        totalOperations,
        activeUsers,
        activeUserPercentage: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
        averageTokensPerOperation: totalOperations > 0 ? currentTotal / totalOperations : 0,
        growth: Math.round(growth * 100) / 100,
        efficiency: 0 // TODO: Calculate batch operation efficiency
      },
      byDimension: dimension === 'feature' 
        ? byDimension.map((item: any) => ({
            dimension: item.feature,
            totalTokens: item._sum.tokensConsumed || 0,
            totalOperations: item._count._all,
            averageTokensPerOperation: item._count._all > 0 ? (item._sum.tokensConsumed || 0) / item._count._all : 0,
            growth: 0
          }))
        : byDimension.map((user: any) => ({
            dimension: user.email,
            totalTokens: user.token_usage.reduce((sum: number, usage: any) => sum + usage.tokensConsumed, 0),
            totalOperations: user.token_usage.length,
            averageTokensPerOperation: user.token_usage.length > 0 
              ? user.token_usage.reduce((sum: number, usage: any) => sum + usage.tokensConsumed, 0) / user.token_usage.length 
              : 0,
            growth: 0
          })),
      topUsers: topUsers.map((user: any) => ({
        userId: user.id,
        userName: user.name || user.email,
        userEmail: user.email,
        totalTokens: user.token_usage.reduce((sum: number, usage: any) => sum + usage.tokensConsumed, 0),
        operations: user.token_usage.length,
        averageTokens: user.token_usage.length > 0 
          ? user.token_usage.reduce((sum: number, usage: any) => sum + usage.tokensConsumed, 0) / user.token_usage.length 
          : 0,
        lastActivity: user.token_usage.length > 0 
          ? user.token_usage.reduce((latest: Date, usage: any) => 
              usage.createdAt > latest ? usage.createdAt : latest, 
              user.token_usage[0].createdAt
            ).toISOString()
          : null
      })),
      featureUsage: featureUsage.map((item: any) => ({
        feature: item.feature,
        totalTokens: item._sum.tokensConsumed || 0,
        operations: item._count._all,
        averageCost: item._count._all > 0 ? (item._sum.tokensConsumed || 0) / item._count._all : 0,
        percentage: currentTotal > 0 ? ((item._sum.tokensConsumed || 0) / currentTotal * 100) : 0
      }))
    });
  } catch (error) {
    console.error('Token usage overview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
