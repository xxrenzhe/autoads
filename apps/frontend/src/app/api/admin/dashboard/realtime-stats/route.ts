import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { Redis } from 'ioredis';

// Initialize Redis client
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL as string) : null;

// Cache key for dashboard stats
const DASHBOARD_CACHE_KEY = 'admin:dashboard:stats';
const CACHE_TTL = 300; // 5 minutes

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalSubscriptions: number;
  monthlyRevenue: number;
  tokenConsumption: {
    today: number;
    thisMonth: number;
  };
  apiUsage: {
    today: number;
    thisMonth: number;
  };
  subscriptionByPlan: Record<string, number>;
  featureUsage: {
    siterank: number;
    batchopen: number;
  };
  growth: {
    userGrowth: number;
    revenueGrowth: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to get cached data
    if (redis) {
      const cachedStats = await redis.get(DASHBOARD_CACHE_KEY);
      if (cachedStats) {
        return NextResponse.json(JSON.parse(cachedStats));
      }
    }

    // Get current date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get all statistics in parallel
    const [
      totalUsers,
      activeUsers,
      totalSubscriptions,
      monthlyRevenue,
      lastMonthRevenue,
      todayTokenUsage,
      monthTokenUsage,
      todayApiUsage,
      monthApiUsage,
      subscriptionStats,
      thisMonthUsers,
      lastMonthUsers,
      todaySiteRankUsage,
      todayBatchOpenUsage
    ] = await Promise.all([
      // Basic counts
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      
      // Revenue
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true }
      }),
      
      // Last month revenue for growth calculation
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startOfLastMonth, lt: startOfMonth }
        },
        _sum: { amount: true }
      }),
      
      // Token usage
      prisma.token_usage.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { tokensConsumed: true }
      }),
      prisma.token_usage.aggregate({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { tokensConsumed: true }
      }),
      
      // API usage
      prisma.apiUsage.count({ where: { timestamp: { gte: today } } }),
      prisma.apiUsage.count({ where: { timestamp: { gte: startOfMonth, lte: endOfMonth } } }),
      
      // Subscription by plan
      prisma.subscription.groupBy({
        by: ['planId'],
        _count: true,
        where: { status: 'ACTIVE' }
      }),
      
      // User growth
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
      
      // Feature usage
      prisma.userBehaviorAnalytics.count({
        where: {
          action: 'feature_usage',
          feature: 'siterank',
          createdAt: { gte: today }
        }
      }),
      prisma.userBehaviorAnalytics.count({
        where: {
          action: 'feature_usage',
          feature: 'batchopen',
          createdAt: { gte: today }
        }
      })
    ]);

    // Get plan details
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    });

    // Map subscription stats by plan name
    const subscriptionByPlan = subscriptionStats.reduce((acc: any, stat: any) => {
      const plan = plans.find((p: any) => p.id === stat.planId);
      if (plan) {
        acc[plan.name] = stat._count;
      }
      return acc;
    }, {} as Record<string, number>);

    // Calculate growth rates
    const userGrowth = lastMonthUsers > 0 
      ? Math.round(((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100)
      : 0;
    
    const currentRevenue = monthlyRevenue._sum?.amount || 0;
    const lastRevenue = lastMonthRevenue._sum?.amount || 0;
    const revenueGrowth = lastRevenue > 0
      ? Math.round(((currentRevenue - lastRevenue) / lastRevenue) * 100)
      : 0;

    const stats: DashboardStats = {
      totalUsers,
      activeUsers,
      totalSubscriptions,
      monthlyRevenue: currentRevenue,
      tokenConsumption: {
        today: todayTokenUsage._sum?.tokensConsumed || 0,
        thisMonth: monthTokenUsage._sum?.tokensConsumed || 0
      },
      apiUsage: {
        today: todayApiUsage,
        thisMonth: monthApiUsage
      },
      subscriptionByPlan,
      featureUsage: {
        siterank: todaySiteRankUsage,
        batchopen: todayBatchOpenUsage
      },
      growth: {
        userGrowth,
        revenueGrowth
      }
    };

    // Cache the results
    if (redis) {
      await redis.setex(DASHBOARD_CACHE_KEY, CACHE_TTL, JSON.stringify(stats));
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
