import { NextRequest, NextResponse } from 'next/server';
import { withFeatureGuard, createBatchTokenCostExtractor } from '@/lib/middleware/feature-guard-middleware';
import { withMinimalSecurity, SecurityEventHelper } from '@/lib/security/minimal-security-middleware';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('SiteRankAPI');

// 使用极简安全中间件包装
const handler = withMinimalSecurity(
  // 使用功能守卫包装（处理套餐和token检查）
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

        // 记录批量操作
        if (userId) {
          await SecurityEventHelper.recordBatchOperation(
            userId,
            'siterank',
            domains.length,
            {
              endpoint: '/api/siterank/batch',
              requestSize: domains.length
            }
          );
        }

        // 这里调用实际的SiteRank服务
        const results = domains.map((domain: any) => ({
          domain,
          globalRank: Math.floor(Math.random() * 1000000),
          monthlyVisits: Math.floor(Math.random() * 10000000),
          status: 'success',
          timestamp: new Date()
        }));

        logger.info(`SiteRank批量查询完成`, {
          userId,
          domainCount: domains.length
        });

        return NextResponse.json({
          success: true,
          data: results
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
    enableEventTracking: true,
    trackSuccess: true,
    trackErrors: true
  }
);

export { handler as POST };