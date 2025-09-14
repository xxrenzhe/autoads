import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { simpleMonitor } from '@/lib/simple-monitor';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('SimpleDashboardAPI');

// 简化的仪表盘统计
export async function GET(request: NextRequest) {
  try {
    // 检查管理员权限
    const session = await auth();
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取监控统计数据
    const stats = simpleMonitor.getStats();
    const errorRate = simpleMonitor.getErrorRate();

    // 获取用户统计
    const [totalUsersResult, activeUsersResult] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } })
    ]);

    // 获取订阅统计
    const [subscriptions, trials] = await Promise.all([
      prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: { plan: true }
      }),
      prisma.subscription.count({
        where: { 
          plan: { name: 'Trial' },
          status: 'ACTIVE'
        }
      })
    ]);

    // 计算总收入
    const monthlyRevenue = subscriptions.reduce((sum: number, sub: any) => {
      return sum + (sub.plan?.price || 0);
    }, 0);

    // 计算功能使用统计
    const siterankUsage = stats.featureStats.siterank.requests;
    const batchopenUsage = stats.featureStats.batchopen.requests;
    const adscenterUsage = stats.featureStats.adscenter.requests;

    // 返回简化的数据结构（带 ETag 缓存）
    const payload = {
      // 基础统计
      totalUsers: totalUsersResult,
      activeUsers: activeUsersResult,
      totalSubscriptions: subscriptions.length,
      trialUsers: trials,
      monthlyRevenue: monthlyRevenue,

      // 功能使用统计（核心功能）
      featureUsage: {
        siterank: siterankUsage,
        batchopen: batchopenUsage,
        adscenter: adscenterUsage
      },

      // Token消耗统计（按功能）
      tokenConsumption: {
        siterank: stats.featureStats.siterank.tokens,
        batchopen: stats.featureStats.batchopen.tokens,
        adscenter: stats.featureStats.adscenter.tokens,
        total: Object.values(stats.featureStats).reduce((sum: number, f: any) => sum + (f as any).tokens, 0)
      },

      // API性能
      apiStats: {
        totalRequests: stats.totalRequests,
        errorRate: errorRate,
        averageResponseTime: stats.averageResponseTime
      },

      // 订阅分布
      subscriptionByPlan: subscriptions.reduce((acc, sub: any) => {
        const planName = sub.plan?.name || 'Unknown';
        acc[planName] = (acc[planName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),

      // 更新时间
      lastUpdated: stats.lastUpdated
    };

    const etag = `W/"${Buffer.from(JSON.stringify(payload)).toString('base64')}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers: { 'ETag': etag, 'Cache-Control': 'private, max-age=30' } });
    }
    const res = NextResponse.json(payload);
    res.headers.set('ETag', etag);
    res.headers.set('Cache-Control', 'private, max-age=30');
    return res;

  } catch (error) {
    logger.error('Failed to fetch dashboard stats', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
