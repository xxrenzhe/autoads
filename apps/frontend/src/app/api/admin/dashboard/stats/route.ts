import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { tokenusagefeature } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get user statistics
    const [
      totalUsers,
      activeUsers,
      totalSubscriptions,
      monthlyRevenue,
      lastMonthRevenue,
      todayTokenUsage,
      monthTokenUsage,
      lastMonthTokenUsage,
      todayApiUsage,
      monthApiUsage,
      lastMonthApiUsage,
      subscriptionStats,
      trialUsers,
      newUsersThisMonth,
      newUsersLastMonth
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { 
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lt: startOfMonth
          }
        },
        _sum: { amount: true }
      }),
      prisma.token_usage.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { tokensConsumed: true }
      }),
      prisma.token_usage.aggregate({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { tokensConsumed: true }
      }),
      prisma.token_usage.aggregate({
        where: { 
          createdAt: { 
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lt: startOfMonth
          }
        },
        _sum: { tokensConsumed: true }
      }),
      prisma.apiUsage.count({ where: { timestamp: { gte: today } } }),
      prisma.apiUsage.count({ where: { timestamp: { gte: startOfMonth, lte: endOfMonth } } }),
      prisma.apiUsage.count({ 
        where: { 
          timestamp: { 
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lt: startOfMonth
          }
        }
      }),
      prisma.subscription.groupBy({
        by: ['planId'],
        _count: true,
        where: { status: 'ACTIVE' }
      }),
      prisma.subscription.count({
        where: {
          provider: 'system',
          status: 'ACTIVE',
          currentPeriodEnd: { gt: now }
        }
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: startOfMonth }
        }
      }),
      prisma.user.count({
        where: {
          createdAt: { 
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lt: startOfMonth
          }
        }
      })
    ]);

    // Get plan details for subscription stats
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    });

    // Map subscription stats by plan name
    const subscriptionByPlan = subscriptionStats.reduce((acc, stat) => {
      const plan = plans.find(p => p.id === stat.planId);
      if (plan) {
        acc[plan.name] = stat._count;
      }
      return acc;
    }, {} as Record<string, number>);

    // Add trial users to subscription stats
    subscriptionByPlan['Trial'] = trialUsers;

    // Calculate growth rates
    const userGrowth = newUsersLastMonth > 0 
      ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
      : newUsersThisMonth > 0 ? 100 : 0;

    const revenueGrowth = (lastMonthRevenue._sum?.amount || 0) > 0
      ? Math.round((((monthlyRevenue._sum?.amount || 0) - (lastMonthRevenue._sum?.amount || 0)) / (lastMonthRevenue._sum?.amount || 0)) * 100)
      : (monthlyRevenue._sum?.amount || 0) > 0 ? 100 : 0;

    const tokenGrowth = (lastMonthTokenUsage._sum?.tokensConsumed || 0) > 0
      ? Math.round((((monthTokenUsage._sum?.tokensConsumed || 0) - (lastMonthTokenUsage._sum?.tokensConsumed || 0)) / (lastMonthTokenUsage._sum?.tokensConsumed || 0)) * 100)
      : (monthTokenUsage._sum?.tokensConsumed || 0) > 0 ? 100 : 0;

    const apiGrowth = lastMonthApiUsage > 0
      ? Math.round(((monthApiUsage - lastMonthApiUsage) / lastMonthApiUsage) * 100)
      : monthApiUsage > 0 ? 100 : 0;

    // Get SiteRank usage today
    const todaySiteRankUsage = await prisma.userBehaviorAnalytics.count({
      where: {
        action: 'feature_usage',
        feature: tokenusagefeature.SITERANK,
        createdAt: { gte: today }
      }
    });

    // Get BatchOpen usage today
    const todayBatchOpenUsage = await prisma.userBehaviorAnalytics.count({
      where: {
        action: 'feature_usage',
        feature: tokenusagefeature.BATCHOPEN,
        createdAt: { gte: today }
      }
    });

    // Get ChangeLink usage today (if exists)
    const todayChangeLinkUsage = await prisma.userBehaviorAnalytics.count({
      where: {
        action: 'feature_usage',
        feature: tokenusagefeature.CHANGELINK,
        createdAt: { gte: today }
      }
    });

    // Get feature-specific token consumption
    const [
      siterankTokensToday,
      batchopenTokensToday,
      adscenterTokensToday,
      siterankTokensMonth,
      batchopenTokensMonth,
      adscenterTokensMonth
    ] = await Promise.all([
      prisma.token_usage.aggregate({
        where: {
          feature: tokenusagefeature.SITERANK,
          createdAt: { gte: today }
        },
        _sum: { tokensConsumed: true }
      }),
      prisma.token_usage.aggregate({
        where: {
          feature: tokenusagefeature.BATCHOPEN,
          createdAt: { gte: today }
        },
        _sum: { tokensConsumed: true }
      }),
      prisma.token_usage.aggregate({
        where: {
          feature: tokenusagefeature.CHANGELINK,
          createdAt: { gte: today }
        },
        _sum: { tokensConsumed: true }
      }),
      prisma.token_usage.aggregate({
        where: {
          feature: tokenusagefeature.SITERANK,
          createdAt: { gte: startOfMonth, lte: endOfMonth }
        },
        _sum: { tokensConsumed: true }
      }),
      prisma.token_usage.aggregate({
        where: {
          feature: tokenusagefeature.BATCHOPEN,
          createdAt: { gte: startOfMonth, lte: endOfMonth }
        },
        _sum: { tokensConsumed: true }
      }),
      prisma.token_usage.aggregate({
        where: {
          feature: tokenusagefeature.CHANGELINK,
          createdAt: { gte: startOfMonth, lte: endOfMonth }
        },
        _sum: { tokensConsumed: true }
      })
    ]);

    // Get detailed API statistics
    const [
      todayApiSuccess,
      todayApiErrors,
      monthApiSuccess,
      monthApiErrors,
      avgResponseTimeToday,
      avgResponseTimeMonth,
      topEndpointsToday,
      topEndpointsMonth
    ] = await Promise.all([
      prisma.apiUsage.count({
        where: {
          timestamp: { gte: today },
          statusCode: { gte: 200, lt: 400 }
        }
      }),
      prisma.apiUsage.count({
        where: {
          timestamp: { gte: today },
          statusCode: { gte: 400 }
        }
      }),
      prisma.apiUsage.count({
        where: {
          timestamp: { gte: startOfMonth, lte: endOfMonth },
          statusCode: { gte: 200, lt: 400 }
        }
      }),
      prisma.apiUsage.count({
        where: {
          timestamp: { gte: startOfMonth, lte: endOfMonth },
          statusCode: { gte: 400 }
        }
      }),
      prisma.apiUsage.aggregate({
        where: { timestamp: { gte: today } },
        _avg: { responseTime: true }
      }),
      prisma.apiUsage.aggregate({
        where: { timestamp: { gte: startOfMonth, lte: endOfMonth } },
        _avg: { responseTime: true }
      }),
      prisma.apiUsage.groupBy({
        by: ['endpoint'],
        where: { timestamp: { gte: today } },
        _count: true,
        orderBy: { _count: { endpoint: 'desc' } },
        take: 5
      }),
      prisma.apiUsage.groupBy({
        by: ['endpoint'],
        where: { timestamp: { gte: startOfMonth, lte: endOfMonth } },
        _count: true,
        orderBy: { _count: { endpoint: 'desc' } },
        take: 5
      })
    ]);

    // Get trial statistics
    const [
      totalTrialsAssigned,
      activeTrials,
      expiredTrials,
      expiringThisWeek
    ] = await Promise.all([
      prisma.subscription.count({
        where: {
          provider: 'system'
        }
      }),
      prisma.subscription.count({
        where: {
          provider: 'system',
          status: 'ACTIVE'
        }
      }),
      prisma.subscription.count({
        where: {
          provider: 'system',
          status: 'EXPIRED'
        }
      }),
      prisma.subscription.count({
        where: {
          provider: 'system',
          status: 'ACTIVE',
          currentPeriodEnd: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
          }
        }
      })
    ]);

    // Calculate conversion rate
    const conversionRate = expiredTrials > 0 
      ? ((totalSubscriptions - trialUsers) / expiredTrials) * 100 
      : 0;

    return NextResponse.json({
      totalUsers,
      activeUsers,
      totalSubscriptions,
      trialUsers,
      monthlyRevenue: monthlyRevenue._sum?.amount || 0,
      tokenConsumption: {
        today: todayTokenUsage._sum?.tokensConsumed || 0,
        thisMonth: monthTokenUsage._sum?.tokensConsumed || 0,
        lastMonth: lastMonthTokenUsage._sum?.tokensConsumed || 0,
        byFeature: {
          today: {
            siterank: siterankTokensToday._sum?.tokensConsumed || 0,
            batchopen: batchopenTokensToday._sum?.tokensConsumed || 0,
            adscenter: adscenterTokensToday._sum?.tokensConsumed || 0
          },
          thisMonth: {
            siterank: siterankTokensMonth._sum?.tokensConsumed || 0,
            batchopen: batchopenTokensMonth._sum?.tokensConsumed || 0,
            adscenter: adscenterTokensMonth._sum?.tokensConsumed || 0
          }
        }
      },
      apiUsage: {
        today: todayApiUsage,
        thisMonth: monthApiUsage,
        lastMonth: lastMonthApiUsage,
        successRate: {
          today: todayApiUsage > 0 ? (todayApiSuccess / todayApiUsage) * 100 : 0,
          thisMonth: monthApiUsage > 0 ? (monthApiSuccess / monthApiUsage) * 100 : 0
        },
        errorRate: {
          today: todayApiUsage > 0 ? (todayApiErrors / todayApiUsage) * 100 : 0,
          thisMonth: monthApiUsage > 0 ? (monthApiErrors / monthApiUsage) * 100 : 0
        },
        avgResponseTime: {
          today: avgResponseTimeToday._avg?.responseTime || 0,
          thisMonth: avgResponseTimeMonth._avg?.responseTime || 0
        },
        topEndpoints: {
          today: topEndpointsToday.map(ep => ({
            endpoint: ep.endpoint,
            count: ep._count
          })),
          thisMonth: topEndpointsMonth.map(ep => ({
            endpoint: ep.endpoint,
            count: ep._count
          }))
        }
      },
      featureUsage: {
        siterank: todaySiteRankUsage,
        batchopen: todayBatchOpenUsage,
        adscenter: todayChangeLinkUsage
      },
      subscriptionByPlan,
      growth: {
        userGrowth,
        revenueGrowth,
        tokenGrowth,
        apiGrowth
      },
      trialStats: {
        totalTrialsAssigned,
        activeTrials,
        expiredTrials,
        conversionRate,
        expiringThisWeek
      },
      newUsers: {
        thisMonth: newUsersThisMonth,
        lastMonth: newUsersLastMonth
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}