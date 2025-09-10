import { NextRequest, NextResponse } from 'next/server';
import { similarWebService } from '@/lib/siterank/similarweb-service';
import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
import { ipRateLimitManager, batchIpRateLimitManager } from '@/lib/security/ip-rate-limit';
import { getClientIP, getUserAgent, isValidIP } from '@/lib/utils/ip-utils';
import { validateBatchQueryCount, getSiteRankConfig } from '@/lib/config/siterank';
import { withTokenConsumption, siteRankTokenConfig } from '@/lib/middleware/token-consumption-middleware';
import { prisma } from '@/lib/prisma';

// 域名验证函数
function isValidDomainFormat(domain: string): Promise<boolean> {
  if (!domain || typeof domain !== 'string') {
    return Promise.resolve(false);
  }
  
  // 基本清理
  domain = domain.trim().toLowerCase();
  
  // 长度检查
  if (domain.length === 0 || domain.length > 253) {
    return Promise.resolve(false);
  }
  
  // 检查是否包含协议或路径
  if (domain.includes('://') || domain.includes('/') || domain.includes('?') || domain.includes('#')) {
    return Promise.resolve(false);
  }
  
  // 域名格式正则验证
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!domainRegex.test(domain)) {
    return Promise.resolve(false);
  }
  
  // 检查是否以点开头或结尾
  if (domain.startsWith('.') || domain.endsWith('.')) {
    return Promise.resolve(false);
  }
  
  // 检查是否有连续的点
  if (domain.includes('..')) {
    return Promise.resolve(false);
  }
  
  // 检查顶级域名
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return Promise.resolve(false);
  }
  
  return Promise.resolve(true);
}

// 获取用户的批量查询限制
async function getUserBatchLimit(userId?: string): Promise<number> {
  if (!userId) {
    // 未登录用户使用默认限制
    const config = getSiteRankConfig();
    return config.batchQueryLimit;
  }

  try {
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

    // Check cache first (if not forcing refresh)
    let cachedResult: { status: string; [key: string]: any } | null = null;
    if (!forceRefresh) {
      try {
        // Simple in-memory cache check - in production you'd use Redis or similar
        // For now, we'll just set cachedResult to null to avoid the undefined error
        cachedResult = null;
      } catch (error) {
        logger.warn(`Cache check failed for ${domain}: ${error instanceof Error ? error.message : String(error)}`);
        cachedResult = null;
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
    
    if (cachedResult && typeof cachedResult === 'object' && 'status' in cachedResult && (cachedResult as any).status === 'success' && !forceRefresh) {
      // 使用缓存结果
      result = cachedResult;
      fromCache = true;
      logger.info(`返回缓存数据: ${domain}`);
    } else {
      // 执行实际查询 - 都使用SimilarWeb API
      result = await similarWebService.queryDomainData(domain, {
        forceRefresh
      });
    }

    logger.info(`SiteRank查询完成: ${domain}`, { 
      status: result.status,
      source: result.source,
      fromCache,
      retries: (result as any).retries,
      ...('globalRank' in result && result.globalRank && { globalRank: result.globalRank }),
      ...('monthlyVisits' in result && result.monthlyVisits && { monthlyVisits: result.monthlyVisits }),
      error: result.error 
    });

    return NextResponse.json({ 
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
    const invalidDomains = domains.filter(domain => !isValidDomainFormat(domain));
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

    // 都使用SimilarWeb API批量查询
    const results = await similarWebService.queryMultipleDomains(domains, {
      concurrency
    });

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    return NextResponse.json({ 
      success: true,
      data: results,
      type: 'similarweb',
      total: results.length,
      successful,
      failed,
      successRate: results.length > 0 ? ((successful / results.length) * 100).toFixed(1) + '%' : '0%'
    });
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
import { withFeatureGuard, createBatchTokenCostExtractor } from '@/lib/middleware/feature-guard-middleware';

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

// SiteRank GET处理器包装
const GETwithFeatureGuard = withFeatureGuard(
  handleGET,
  {
    featureId: 'siterank_basic', // 基础功能，实际在运行时确定
    requireToken: true,
    getTokenCost: () => 1 // 单个查询消耗1个Token
  }
);

// SiteRank POST处理器包装
const POSTwithFeatureGuard = withFeatureGuard(
  handlePOST,
  {
    featureId: 'siterank_basic', // 基础功能，实际在运行时确定
    requireToken: true,
    getTokenCost: createBatchTokenCostExtractor('domains')
  }
);

// 导出最终的处理器
export const GET = async (request: NextRequest, ...args: any[]) => {
  // 动态确定功能ID
  const userId = args[0];
  const featureId = await getSiteRankFeatureId(userId);
  
  // 创建动态处理器
  const dynamicHandler = withFeatureGuard(handleGET, {
    featureId,
    requireToken: true,
    getTokenCost: () => 1
  });
  
  return dynamicHandler(request, ...args);
};

export const POST = async (request: NextRequest, ...args: any[]) => {
  // 动态确定功能ID
  const userId = args[0];
  const featureId = await getSiteRankFeatureId(userId);
  
  // 创建动态处理器
  const dynamicHandler = withFeatureGuard(handlePOST, {
    featureId,
    requireToken: true,
    getTokenCost: createBatchTokenCostExtractor('domains')
  });
  
  return dynamicHandler(request, ...args);
};