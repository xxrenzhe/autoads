import { NextRequest, NextResponse } from 'next/server';
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware';
import { withMinimalSecurity, SecurityEventHelper } from '@/lib/security/minimal-security-middleware';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { TokenService } from '@/lib/services/token-service';
import { getRedisClient } from '@/lib/cache/redis-client';
import { withApiProtection } from '@/lib/api-utils';

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

        // 预检余额（不扣费）
        if (userId) {
          const required = domains.length;
          const check = await TokenService.checkTokenBalance(userId, required);
          if (!check.sufficient) {
            return NextResponse.json({
              error: 'Insufficient token balance',
              code: 'INSUFFICIENT_TOKENS',
              required: check.required,
              balance: check.currentBalance
            }, { status: 402 });
          }
        }

        // 这里调用实际的SiteRank服务（演示返回）
        const t0 = Date.now();
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

        const response = NextResponse.json({
          success: true,
          data: results
        });

        // 设置缓存命中提示头（非契约）
        try {
          const redis = getRedisClient();
          const keys = domains.map((d: string) => `siterank:v1:${String(d).trim().toLowerCase()}`);
          const hit = await (redis as any).exists(...keys);
          response.headers.set('X-Cache-Hit', `${hit}/${domains.length}`);
          response.headers.set('X-RateLimit-Limit', '5');
          // 简化提示：剩余配额仅用于提示，不做契约保证
          response.headers.set('X-RateLimit-Remaining', `${Math.max(0, 5 - domains.length)}`);
          response.headers.set('Server-Timing', `upstream;dur=${Date.now() - t0}`);
        } catch {}

        // 成功后扣费
        try {
          if (userId) {
            await TokenService.consumeTokens(userId, 'siterank', 'batch_analysis', {
              batchSize: domains.length,
              metadata: { endpoint: '/api/siterank/batch' }
            });
          }
        } catch {}

        return response;
      } catch (error) {
        logger.error('SiteRank批量查询失败:', error as Error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
  },
  {
      featureId: 'siterank_basic'
  }
  ),
  {
    enableEventTracking: true,
    trackSuccess: true,
    trackErrors: true
  }
);

export const POST = withApiProtection('siteRank')(handler as any) as any;
