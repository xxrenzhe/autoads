import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { simpleMonitor } from '@/lib/simple-monitor';
import { dbPool } from '@/lib/db-pool';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('SimpleAPIMonitoring');

// 获取简化的API监控统计
export async function GET(request: NextRequest) {
  try {
    // 检查管理员权限
    const session = await auth();
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin access required' },
        { status: 401 }
      );
    }

    // 获取简化后的统计数据
    const stats = simpleMonitor.getStats();
    const errorRate = simpleMonitor.getErrorRate();
    
    // 获取数据库连接池状态
    const poolStats = dbPool.getStats();

    // 构建简化的响应数据
    const monitoringData = {
      // API性能指标
      api: {
        totalRequests: stats.totalRequests,
        averageResponseTime: stats.averageResponseTime,
        errorRate: errorRate,
        totalErrors: stats.totalErrors,
        statusCodes: stats.statusCodes,
        features: stats.featureStats
      },

      // 系统资源指标
      system: {
        database: {
          totalConnections: poolStats.total,
          activeConnections: poolStats.active,
          idleConnections: poolStats.idle,
          maxConnections: poolStats.max
        }
      },

      // 告警状态
      alerts: {
        highErrorRate: errorRate > 5,
        slowResponse: stats.averageResponseTime > 2000,
        highDatabaseUsage: poolStats.active / poolStats.max > 0.8
      },

      // 时间信息
      meta: {
        generatedAt: stats.lastUpdated.toISOString(),
        uptime: process.uptime()
      }
    };

    return NextResponse.json({
      success: true,
      data: monitoringData
    });

  } catch (error) {
    logger.error('Failed to fetch API monitoring data', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to fetch monitoring data'
      },
      { status: 500 }
    );
  }
}