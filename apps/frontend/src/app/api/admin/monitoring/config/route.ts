import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { prisma } from '@/lib/prisma';

const logger = createLogger('APIMonitoringConfig');

// 监控配置接口
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

    // 返回监控配置信息
    const config = {
      // 告警阈值配置
      thresholds: {
        errorRate: 5, // 5%
        responseTime: 2000, // 2秒
        requestsPerMinute: 1000,
        databaseConnectionUsage: 80, // 80%
        failedTasks: 10
      },

      // 监控间隔配置
      intervals: {
        metricsCollection: 5000, // 5秒
        healthCheck: 30000, // 30秒
        reportGeneration: 3600000, // 1小时
        dataRetention: 86400000 // 24小时
      },

      // 监控功能开关
      features: {
        apiMonitoring: true,
        databaseMonitoring: true,
        taskQueueMonitoring: true,
        sessionMonitoring: true,
        realTimeAlerts: true,
        automatedReports: true
      },

      // 通知配置
      notifications: {
        email: {
          enabled: false,
          recipients: [],
          severityLevels: ['critical', 'high']
        },
        webhook: {
          enabled: false,
          url: '',
          secret: ''
        },
        slack: {
          enabled: false,
          webhookUrl: '',
          channel: '#alerts'
        }
      },

      // 数据保留策略
      retention: {
        metrics: 7, // 天
        logs: 30, // 天
        alerts: 90 // 天
      }
    };

    return NextResponse.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Failed to fetch monitoring config', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to fetch monitoring configuration'
      },
      { status: 500 }
    );
  }
}

// 更新监控配置
export async function PUT(request: NextRequest) {
  try {
    // 检查管理员权限
    const session = await auth();
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // 验证配置数据
    const allowedFields = [
      'thresholds', 'intervals', 'features', 
      'notifications', 'retention'
    ];
    
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // 将配置保存到数据库（system_configs 表中）
    const configValue = JSON.stringify({
      ...(await (async () => {
        const existing = await prisma.systemConfig.findUnique({ where: { key: 'monitoring_config' } })
        try { return existing ? JSON.parse(existing.value) : {} } catch { return {} }
      })()),
      ...updates
    })

    await prisma.systemConfig.upsert({
      where: { key: 'monitoring_config' },
      update: { value: configValue, updatedBy: session.user.id },
      create: {
        key: 'monitoring_config',
        value: configValue,
        category: 'monitoring',
        description: '系统监控配置',
        createdBy: session.user.id
      }
    })

    logger.info('Monitoring configuration updated', { userId: session.user.id });

    return NextResponse.json({
      success: true,
      message: 'Monitoring configuration updated successfully',
      data: updates
    });

  } catch (error) {
    logger.error('Failed to update monitoring config', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to update monitoring configuration'
      },
      { status: 500 }
    );
  }
}
