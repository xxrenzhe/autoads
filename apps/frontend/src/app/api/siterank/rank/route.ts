import { NextRequest, NextResponse } from 'next/server';
// 使用统一的 SimilarWeb 服务（含全局缓存与错误TTL）
import { similarWebService } from '@/lib/siterank/unified-similarweb-service';
import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
import { ipRateLimitManager, batchIpRateLimitManager } from '@/lib/security/ip-rate-limit';
import { getClientIP, getUserAgent, isValidIP } from '@/lib/utils/ip-utils';
import { validateBatchQueryCount, getSiteRankConfig } from '@/lib/config/siterank';
import { prisma } from '@/lib/prisma';
import { TokenService } from '@/lib/services/token-service';
import { withApiProtection } from '@/lib/api-utils';
import { getRedisClient } from '@/lib/cache/redis-client';

// 域名验证函数（同步）
function isValidDomainFormat(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  // 基本清理
  domain = domain.trim().toLowerCase();

  // 长度检查
  if (domain.length === 0 || domain.length > 253) {
    return false;
  }

  // 检查是否包含协议或路径
  if (domain.includes('://') || domain.includes('/') || domain.includes('?') || domain.includes('#')) {
    return false;
  }

  // 域名格式正则验证
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!domainRegex.test(domain)) {
    return false;
  }

  // 检查是否以点开头或结尾
  if (domain.startsWith('.') || domain.endsWith('.')) {
    return false;
  }

  // 检查是否有连续的点
  if (domain.includes('..')) {
    return false;
  }

  // 检查顶级域名
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return false;
  }

  return true;
}

// 获取用户的批量查询限制
async function getUserBatchLimit(userId?: string): Promise<number> {
  if (!userId) {
    // 未登录用户使用默认限制
    const config = getSiteRankConfig();
    return config.batchQueryLimit;
  }

  try {
    const reqId = request.headers.get('x-request-id') || '';
    // 获取用户的活跃订阅
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: { gt: new Date() }
      },
      include: {
        plan: true
      }
    });

    if (!subscription) {
      // 免费用户限制
      return 100;
    }

    // 使用订阅中的自定义限制或套餐限制
    const limits = subscription.customLimits || subscription.plan.limits;
    return limits?.siterank?.batchLimit || 100;
  } catch (error) {
    console.error('Error getting user batch limit:', error);
    // 出错时使用默认限制
    const config = getSiteRankConfig();
    return config.batchQueryLimit;
  }
}

// 验证批量查询数量（基于用户订阅）
async function validateBatchQueryCountWithSubscription(domains: string[], userId?: string): Promise<{ valid: boolean; error?: string }> {
  const batchLimit = await getUserBatchLimit(userId);
  
  if (domains.length > batchLimit) {
    return {
      valid: false,
      error: `域名列表不能超过${batchLimit}个`
    };
  }
  
  return { valid: true };
}

// 强制动态渲染，避免静态优化错误
export const dynamic = 'force-dynamic';

const logger = createLogger('SiteRankAPI');

// 原始的GET处理器（不包含Token消耗逻辑）
async function handleGET(request: NextRequest, userId?: string) {
  try {
    // 获取客户端信息
    const clientIP = getClientIP(request);
    const userAgent = getUserAgent(request);
    
    // Get domain parameter first
    const searchParams = request.nextUrl.searchParams;
    const domain = searchParams.get('domain');
    
    if (!domain) {
      return NextResponse.json(
        { error: '域名参数是必需的' },
        { status: 400 }
      );
    }
    
    // 进行速率限制检查
    const rateLimitResult = await ipRateLimitManager.checkRateLimit(
        clientIP, 
        '/api/siterank/rank', 
        typeof userAgent === 'string' ? userAgent : undefined
      );
    
    if (!rateLimitResult.allowed) {
      logger.warn(`IP超过速率限制: ${clientIP}`, {
        endpoint: '/api/siterank/rank',
        totalRequests: rateLimitResult.totalRequests,
        banInfo: rateLimitResult.banInfo
      });
      
      return NextResponse.json(
        { 
          error: rateLimitResult.banInfo 
            ? `IP已被封禁: ${rateLimitResult.banInfo.reason}` 
            : '请求过于频繁，请稍后再试',
          resetTime: rateLimitResult.resetTime,
          banInfo: rateLimitResult.banInfo
        },
        { 
          status: rateLimitResult.banInfo ? 403 : 429,
          headers: {
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
    }

    // 只使用similarweb类型
const type = 'similarweb';
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // 如果请求强制刷新，则清除统一缓存（L1+L2）
    if (forceRefresh) {
      try {
        similarWebService.clearCache();
        const redis = getRedisClient();
        await (redis as any).del(
          `siterank:v1:${domain.trim().toLowerCase()}`,
          `siterank:v1:err:${domain.trim().toLowerCase()}`
        );
      } catch (e) {
        logger.warn('Force refresh cache clear failed', { message: e instanceof Error ? e.message : String(e) });
      }
    }

    // API 层面的域名验证
    if (!isValidDomainFormat(domain)) {
      logger.warn(`API层检测到无效域名格式: ${domain}`, { ip: clientIP });
      
      // 记录无效请求
      await ipRateLimitManager.recordInvalidRequest(
        clientIP, 
        '/api/siterank/rank', 
        domain, 
        typeof userAgent === 'string' ? userAgent : undefined
      );
      
      return NextResponse.json(
        { error: '无效的域名格式' },
        { status: 400 }
      );
    }

    logger.info(`开始查询域名数据: ${domain}, 类型: ${type}`, {
      forceRefresh,
      ip: isValidIP(clientIP) ? clientIP : 'anonymous',
      fromCache: !!cachedResult
    });

    let result: { status: string; source?: string; [key: string]: any };
    let fromCache = false;
    // 预检余额（不扣费）：单域名 = 1 Token
    if (userId) {
      const check = await TokenService.checkTokenBalance(userId, 1);
      if (!check.sufficient) {
        return NextResponse.json({
          error: 'Insufficient token balance',
          code: 'INSUFFICIENT_TOKENS',
          required: check.required,
          balance: check.currentBalance
        }, { status: 402 });
      }
    }
    
    // 统计缓存命中（查询前）用于提示
    let cacheHit = 0;
    try {
      const redis = getRedisClient();
      const key = `siterank:v1:${domain.trim().toLowerCase()}`;
      cacheHit = await (redis as any).exists(key);
    } catch {}

    // 执行统一查询（内部自带缓存/错误TTL）
    const t0 = Date.now();
    result = await (similarWebService as any).queryDomainData(domain);
    const t1 = Date.now();

    logger.info(`SiteRank查询完成: ${domain}`, { 
      status: result.status,
      source: result.source,
      fromCache,
      retries: (result as any).retries,
      ...('globalRank' in result && result.globalRank && { globalRank: result.globalRank }),
      ...('monthlyVisits' in result && result.monthlyVisits && { monthlyVisits: result.monthlyVisits }),
      error: result.error 
    });

    // fromCache 以 Redis 命中为准（提示用途）
    fromCache = cacheHit > 0;
    const response = NextResponse.json({ 
      success: true,
      data: result,
      type,
      fromCache,
      rateLimitInfo: {
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime,
        totalRequests: rateLimitResult.totalRequests
      }
    });
    // 设置提示头：X-Cache-Hit 与 X-RateLimit-*
    try { response.headers.set('X-Cache-Hit', `${cacheHit}/1`); } catch {}
    try {
      response.headers.set('X-RateLimit-Limit', '30');
      response.headers.set('X-RateLimit-Remaining', `${rateLimitResult.remaining}`);
      response.headers.set('X-RateLimit-Reset', `${rateLimitResult.resetTime}`);
    } catch {}
    try { if (reqId) response.headers.set('X-Request-Id', reqId); } catch {}
    try { response.headers.set('Server-Timing', `upstream;dur=${t1 - t0}`); } catch {}
    // 成功后扣费（单域名）
    try {
      if (userId) {
        await TokenService.consumeTokens(userId, 'siterank', 'single_analysis', {
          batchSize: 1,
          metadata: { endpoint: '/api/siterank/rank', domain }
        });
      }
    } catch {}
    return response;
  } catch (error) { 
    logger.error('SiteRank查询API错误:', new EnhancedError('SiteRank查询API错误', { error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json(
      { 
        error: '查询失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

// 原始的POST处理器（不包含Token消耗逻辑）
async function handlePOST(request: NextRequest, userId?: string) {
  try {
    // 获取客户端信息
    const clientIP = getClientIP(request);
    const userAgent = getUserAgent(request);
    
    // 批量查询使用更严格的速率限制
    const rateLimitResult = await batchIpRateLimitManager.checkRateLimit(
      clientIP, 
      '/api/siterank/rank/batch', 
      typeof userAgent === 'string' ? userAgent : undefined
    );
    
    if (!rateLimitResult.allowed) {
      logger.warn(`IP超过批量查询速率限制: ${clientIP}`, {
        endpoint: '/api/siterank/rank/batch',
        totalRequests: rateLimitResult.totalRequests,
        banInfo: rateLimitResult.banInfo
      });
      
      return NextResponse.json(
        { 
          error: rateLimitResult.banInfo 
            ? `IP已被封禁: ${rateLimitResult.banInfo.reason}` 
            : '批量查询过于频繁，请稍后再试',
          resetTime: rateLimitResult.resetTime,
          banInfo: rateLimitResult.banInfo
        },
        { 
          status: rateLimitResult.banInfo ? 403 : 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
    }

    const body = await request.json();
    const { domains, concurrency = 3 } = body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        { error: '域名列表参数是必需的' },
        { status: 400 }
      );
    }

    // 验证批量查询数量（基于用户订阅）
    const validation = await validateBatchQueryCountWithSubscription(domains, userId);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || '批量查询数量超过限制' },
        { status: 400 }
      );
    }

    // API 层面的域名验证
    const invalidDomains = domains.filter((domain: any) => !isValidDomainFormat(domain));
    if (invalidDomains.length > 0) {
      logger.warn(`API层批量查询检测到 ${invalidDomains.length} 个无效域名: ${invalidDomains.slice(0, 5).join(', ')}${invalidDomains.length > 5 ? '...' : ''}`, { 
        ip: isValidIP(clientIP) ? clientIP : 'anonymous' 
      });
      
      // 记录无效请求
      for (const invalidDomain of invalidDomains.slice(0, 10)) { // 最多记录10个
        await batchIpRateLimitManager.recordInvalidRequest(
          clientIP, 
          '/api/siterank/rank/batch', 
          invalidDomain, 
          typeof userAgent === 'string' ? userAgent : undefined
        );
      }
    }

    logger.info(`开始批量查询 ${domains.length} 个域名的SiteRank数据`, {
      concurrency,
      ip: isValidIP(clientIP) ? clientIP : 'anonymous'
    });

    // 预检余额（不扣费）：按域名数计费
    const requiredTokens = domains.length;
    if (userId) {
      const check = await TokenService.checkTokenBalance(userId, requiredTokens);
      if (!check.sufficient) {
        return NextResponse.json({
          error: 'Insufficient token balance',
          code: 'INSUFFICIENT_TOKENS',
          required: check.required,
          balance: check.currentBalance
        }, { status: 402 });
      }
    }

    // 都使用SimilarWeb API批量查询
    const t0b = Date.now();
    const results = await similarWebService.queryMultipleDomains(domains, { concurrency });
    const t1b = Date.now();

    const successful = results.filter((r: any) => r.status === 'success').length;
    const failed = results.filter((r: any) => r.status === 'error').length;

    const response = NextResponse.json({ 
      success: true,
      data: results,
      type: 'similarweb',
      total: results.length,
      successful,
      failed,
      successRate: results.length > 0 ? ((successful / results.length) * 100).toFixed(1) + '%' : '0%'
    });

    // 扣费（成功路径）；附加缓存命中提示（非契约）
    try {
      // 计算缓存命中
      try {
        const redis = getRedisClient();
        const keys = domains.map((d: string) => `siterank:v1:${String(d).trim().toLowerCase()}`);
        const exists = (await (redis as any).exists(...keys)) as number;
        response.headers.set('X-Cache-Hit', `${exists}/${domains.length}`);
      } catch {}
      // 设置速率限制提示头（与批量限额保持一致）
      try {
        response.headers.set('X-RateLimit-Limit', '5');
        response.headers.set('X-RateLimit-Remaining', `${rateLimitResult.remaining}`);
        response.headers.set('X-RateLimit-Reset', `${rateLimitResult.resetTime}`);
      } catch {}
      try { if (reqId) response.headers.set('X-Request-Id', reqId); } catch {}
      try { response.headers.set('Server-Timing', `upstream;dur=${t1b - t0b}`); } catch {}
      if (userId) {
        await TokenService.consumeTokens(userId, 'siterank', 'batch_analysis', {
          batchSize: requiredTokens,
          metadata: { endpoint: '/api/siterank/rank', domainsCount: requiredTokens }
        });
      }
    } catch {}

    return response;
  } catch (error) { 
    logger.error('SiteRank批量查询API错误:', new EnhancedError('SiteRank批量查询API错误', { error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json(
      { 
        error: '批量查询失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

// 导出包装了Token消耗和功能权限的处理器
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware';

// 根据用户套餐确定功能ID
async function getSiteRankFeatureId(userId?: string): Promise<string> {
  if (!userId) return 'siterank_basic';
  
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: { gt: new Date() }
      },
      include: {
        plan: {
          select: { id: true }
        }
      }
    });
    
    if (!subscription) return 'siterank_basic';
    
    // 根据套餐返回对应的功能ID
    switch (subscription.plan.id) {
      case 'max': return 'siterank_max';
      case 'pro': return 'siterank_pro';
      default: return 'siterank_basic';
    }
  } catch {
    return 'siterank_basic';
  }
}

// 导出最终的处理器（使用动态特性解析）
export const GET = withFeatureGuard(
  withApiProtection('siteRank')(handleGET as any) as any,
  { featureIdResolver: async (session: any) => await getSiteRankFeatureId(session?.user?.id) }
);

export const POST = withFeatureGuard(
  withApiProtection('siteRank')(handlePOST as any) as any,
  { featureIdResolver: async (session: any) => await getSiteRankFeatureId(session?.user?.id) }
);
