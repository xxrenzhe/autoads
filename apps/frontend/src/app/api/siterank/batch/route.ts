import { NextRequest, NextResponse } from 'next/server';
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware';
import { withSecurityIntegration } from '@/lib/security/security-integration';
import { SecurityMonitor } from '@/lib/security/security-integration';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { UnifiedSimilarWebService } from '@/lib/siterank/unified-similarweb-service';
import { TokenService } from '@/lib/services/token-service';
import { getRedisClient } from '@/lib/cache/redis-client';
import { withApiProtection } from '@/lib/api-utils';

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

        // 预检余额（不扣费）
        const requiredTokens = domains.length;
        if (userId) {
          const balance = await TokenService.checkTokenBalance(userId, requiredTokens);
          if (!balance.sufficient) {
            return NextResponse.json({
              error: 'Insufficient token balance',
              code: 'INSUFFICIENT_TOKENS',
              required: balance.required,
              balance: balance.currentBalance
            }, { status: 402 });
          }
        }

        // 统计缓存命中（全局7天缓存，跨用户）
        let cacheHit = 0;
        try {
          const redis = getRedisClient();
          const keys = domains.map((d: string) => `siterank:v1:${String(d).trim().toLowerCase()}`);
          // ioredis.exists 支持多 key，返回存在的键数量
          cacheHit = await (redis as any).exists(...keys);
        } catch {}

        // 调用统一的 SiteRank 服务（含全局缓存）
        const service = new UnifiedSimilarWebService();
        const t0 = Date.now();
        const results = await service.queryMultipleDomains(domains);
        const dur = Date.now() - t0;

        logger.info(`SiteRank批量查询完成`, {
          userId,
          domainCount: domains.length,
          processingTime: Date.now()
        });

        const response = NextResponse.json({
          success: true,
          data: results,
          metadata: {
            totalDomains: domains.length,
            processedAt: new Date(),
            version: '1.0'
          }
        });

        // 设置缓存命中提示头与速率限制头（非契约，仅提示）
        try { 
          response.headers.set('X-Cache-Hit', `${cacheHit}/${domains.length}`);
          response.headers.set('X-RateLimit-Limit', '5');
          response.headers.set('X-RateLimit-Remaining', `${Math.max(0, 5 - domains.length)}`);
          response.headers.set('Server-Timing', `upstream;dur=${dur}`);
        } catch {}

        // 成功后扣费（依然全额扣费，包括命中缓存的项）
        try {
          if (userId) {
            await TokenService.consumeTokens(userId, 'siterank', 'batch_analysis', {
              batchSize: requiredTokens,
              metadata: { endpoint: '/api/siterank/batch', domainsCount: requiredTokens }
            });
          }
        } catch (e) {
          logger.warn('Post-success token consumption failed', { message: e instanceof Error ? e.message : String(e) });
        }

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
    enableSuspiciousDetection: true,
    enableBehaviorAnalysis: true,
    enableRealTimeAlerts: true,
    riskThreshold: 70
  }
);

export const POST = withApiProtection('siteRank')(handler as any) as any;
