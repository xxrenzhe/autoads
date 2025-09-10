import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { simpleMonitor } from '@/lib/simple-monitor';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('SimpleMonitoringAPI');

// 简化的监控数据端点
export async function GET(request: NextRequest) {
  try {
    // 检查管理员权限
    const session = await auth();
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取统计数据
    const stats = simpleMonitor.getStats();
    const errorRate = simpleMonitor.getErrorRate();
    const topEndpoints = simpleMonitor.getTopEndpoints(10);

    // 返回简化的监控数据
    return NextResponse.json({
      timestamp: stats.lastUpdated,
      summary: {
        totalRequests: stats.totalRequests,
        totalErrors: stats.totalErrors,
        errorRate: `${errorRate}%`,
        averageResponseTime: stats.averageResponseTime
      },
      features: {
        siterank: {
          requests: stats.featureStats.siterank.requests,
          tokens: stats.featureStats.siterank.tokens
        },
        batchopen: {
          requests: stats.featureStats.batchopen.requests,
          tokens: stats.featureStats.batchopen.tokens
        },
        adscenter: {
          requests: stats.featureStats.adscenter.requests,
          tokens: stats.featureStats.adscenter.tokens
        }
      },
      statusCodes: stats.statusCodes,
      topEndpoints: topEndpoints.slice(0, 5),
      alerts: {
        highErrorRate: errorRate > 5,
        slowResponse: stats.averageResponseTime > 2000
      }
    });

  } catch (error) {
    logger.error('Failed to get monitoring data', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// 重置统计数据
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    simpleMonitor.reset();
    
    logger.info('Monitoring stats reset by admin', {
      adminId: session.user.id
    });

    return NextResponse.json({ message: 'Statistics reset successfully' });

  } catch (error) {
    logger.error('Failed to reset monitoring data', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}