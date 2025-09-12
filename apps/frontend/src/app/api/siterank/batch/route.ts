import { NextRequest, NextResponse } from 'next/server';
import { withFeatureGuard, createBatchTokenCostExtractor } from '@/lib/middleware/feature-guard-middleware';
import { withSecurityIntegration } from '@/lib/security/security-integration';
import { SecurityMonitor } from '@/lib/security/security-integration';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('SiteRankAPI');

// 使用安全集成中间件包装处理器
const handler = withSecurityIntegration(
  // 使用功能守卫包装
  withFeatureGuard(
    async (request: NextRequest, userId?: string) => {
      try {
        const body = await request.json();
        const { domains } = body;

        if (!Array.isArray(domains) || domains.length === 0) {
          return NextResponse.json(
            { error: 'Invalid domains parameter' },
            { status: 400 }
          );
        }

        // 检查批量大小限制
        if (domains.length > 100) {
          return NextResponse.json(
            { error: 'Batch size cannot exceed 100 domains' },
            { status: 400 }
          );
        }

        // 监控批量操作
        if (userId) {
          await SecurityMonitor.monitorBatchOperation(
            userId,
            'siterank_query',
            domains.length,
            {
              endpoint: '/api/siterank/batch',
              batchSize: domains.length
            }
          );
        }

        // 这里应该调用实际的SiteRank服务
        // 为了演示，我们返回模拟数据
        const results = domains.map(domain => ({
          domain,
          globalRank: Math.floor(Math.random() * 1000000),
          monthlyVisits: Math.floor(Math.random() * 10000000),
          status: 'success',
          timestamp: new Date(),
          source: 'similarweb-api'
        }));

        logger.info(`SiteRank批量查询完成`, {
          userId,
          domainCount: domains.length,
          processingTime: Date.now()
        });

        return NextResponse.json({
          success: true,
          data: results,
          metadata: {
            totalDomains: domains.length,
            processedAt: new Date(),
            version: '1.0'
          }
        });
      } catch (error) {
        logger.error('SiteRank批量查询失败:', error as Error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      featureId: 'siterank_basic',
      requireToken: true,
      getTokenCost: createBatchTokenCostExtractor('domains')
    }
  ),
  {
    enableSuspiciousDetection: true,
    enableBehaviorAnalysis: true,
    enableRealTimeAlerts: true,
    riskThreshold: 70
  }
);

export { handler as POST };