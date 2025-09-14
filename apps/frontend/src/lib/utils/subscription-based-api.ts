import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { dbPool } from '@/lib/db-pool';
import { getRedisClient } from '@/lib/cache/redis-client';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { FeaturePermissionService } from '@/lib/services/feature-permission-service';
import { PlanFeaturesService } from '@/lib/services/plan-features-service';

const logger = createLogger('SubscriptionBasedAPIAccess');

// API端点功能映射
const API_FEATURE_MAPPING: Record<string, string> = {
  '/api/batchopen': 'batchopen_basic',
  '/api/siterank': 'siterank_basic',
  '/api/adscenter': 'adscenter_pro',
  '/api/user/tokens': 'api_access',
  '/api/subscription': 'api_access',
  '/api/admin': 'api_access_max'
};

// 速率限制配置（基于套餐）
const PLAN_RATE_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  free: { requests: 100, windowMs: 60000 },    // 100 req/min
  pro: { requests: 1000, windowMs: 60000 },   // 1000 req/min
  max: { requests: 5000, windowMs: 60000 }    // 5000 req/min
};

export interface SubscriptionAPIContext {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    [key: string]: any;
  };
  subscription: {
    id?: string;
    plan?: {
      name: string;
      features?: any[];
      [key: string]: any;
    };
    status?: string;
    currentPeriodEnd?: Date;
    [key: string]: any;
  } | null;
  features: any[];
  limits: Record<string, any>;
  rateLimit: {
    remaining: number;
    reset: number;
    limit: number;
  };
}

/**
 * 创建基于订阅的API处理器
 */
export function createSubscriptionHandler<T = any>(
  featureId: string,
  handler: (request: NextRequest, context: SubscriptionAPIContext) => Promise<T>,
  options: {
    checkQuota?: boolean;
    requireActiveSubscription?: boolean;
    customRateLimit?: boolean;
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const { pathname } = new URL(request.url);
    let user: any = null;
    
    try {
      // 1. 认证检查
      const session = await auth();
      
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      user = session.user;
      
      // 2. 获取用户订阅信息
      const subscription = await getUserSubscription(user.id);
      
      if (options.requireActiveSubscription !== false && !subscription) {
        return NextResponse.json(
          { error: 'Active subscription required' },
          { status: 403 }
        );
      }
      
      // 3. 检查功能权限
      const featureAccess = await FeaturePermissionService.checkFeatureAccess(
        user.id,
        featureId
      );
      
      if (!featureAccess.hasAccess) {
        logger.warn('Feature access denied', {
          userId: user.id,
          featureId,
          reason: featureAccess.reason
        });
        
        return NextResponse.json(
          { error: featureAccess.reason || 'Feature not available in your plan' },
          { status: 403 }
        );
      }
      
      // 4. 速率限制检查（基于套餐）
      if (options.customRateLimit !== false) {
        const rateLimitResult = await checkSubscriptionRateLimit(
          request,
          user.id,
          subscription?.plan?.name || 'free'
        );
        
        if (rateLimitResult.blocked) {
          logger.warn('Rate limit exceeded', {
            userId: user.id,
            plan: subscription?.plan?.name,
            rateLimit: rateLimitResult
          });
          
          return NextResponse.json(
            { error: 'Too many requests', retryAfter: rateLimitResult.resetAfter },
            { 
              status: 429,
              headers: {
                'X-RateLimit-Limit': rateLimitResult.limit.toString(),
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                'X-RateLimit-Reset': rateLimitResult.reset.toString(),
                ...(rateLimitResult.resetAfter ? { 'Retry-After': rateLimitResult.resetAfter.toString() } : {})
              }
            }
          );
        }
      }
      
      // 5. 检查配额（如果需要）
      if (options.checkQuota) {
        const quotaCheck = await checkFeatureQuota(user.id, featureId, featureAccess.limits);
        
        if (!quotaCheck.hasQuota) {
          return NextResponse.json(
            { error: quotaCheck.reason || 'Quota exceeded' },
            { status: 429 }
          );
        }
      }
      
      // 6. 构建上下文
      const rateLimit = await getSubscriptionRateLimitInfo(request, user.id);
      const userFeatures = await FeaturePermissionService.getUserFeatures(user.id);
      
      const context: SubscriptionAPIContext = {
        user,
        subscription,
        features: userFeatures.features,
        limits: userFeatures.limits,
        rateLimit
      };
      
      // 7. 执行处理器
      const result = await handler(request, context);
      
      // 8. 记录成功访问
      const responseTime = Date.now() - startTime;
      await logAPIAccess(request, {
        userId: user.id,
        subscriptionId: subscription?.id,
        featureId,
        success: true,
        responseTime,
        statusCode: 200
      });
      
      // 9. 添加响应头
      const response = result instanceof NextResponse ? result : NextResponse.json(result);
      
      // 添加速率限制头
      if (options.customRateLimit !== false) {
        response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
        response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
        response.headers.set('X-RateLimit-Reset', rateLimit.reset.toString());
      }
      
      // 添加功能限制头
      if (featureAccess.limits) {
        response.headers.set('X-Feature-Limits', JSON.stringify(featureAccess.limits));
      }
      
      // 添加性能监控头
      response.headers.set('X-Response-Time', responseTime.toString());
      
      return response;
      
    } catch (error) {
      // 错误处理
      const responseTime = Date.now() - startTime;
      
      logger.error('API route error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: pathname,
        responseTime
      });
      
      await logAPIAccess(request, {
        userId: user?.id,
        featureId,
        success: false,
        responseTime,
        statusCode: 500,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * 获取用户订阅信息
 */
async function getUserSubscription(userId: string) {
  const cacheKey = `user_subscription:${userId}`;
  
  try {
    const redisClient = getRedisClient();
    // 尝试从缓存获取
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 从数据库获取
    const subscription = await dbPool.executeQuery('get_user_subscription', async (prisma) => {
      return prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          currentPeriodEnd: { gt: new Date() }
        },
        include: {
          plan: true
        },
        orderBy: { createdAt: 'desc' }
      });
    });
    
    // 缓存结果（5分钟）
    if (subscription) {
      await redisClient.setex(cacheKey, 300, JSON.stringify(subscription));
    }
    
    return subscription;
  } catch (error) {
    logger.error('Failed to get user subscription', { userId, error });
    return null;
  }
}

/**
 * 检查基于套餐的速率限制
 */
async function checkSubscriptionRateLimit(
  request: NextRequest,
  userId: string,
  planName: string
): Promise<{
  blocked: boolean;
  limit: number;
  remaining: number;
  reset: number;
  resetAfter?: number;
}> {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const path = new URL(request.url).pathname;
  
  // 获取套餐的速率限制配置
  const config = PLAN_RATE_LIMITS[planName.toLowerCase()] || PLAN_RATE_LIMITS.free;
  
  const key = `subscription_rate_limit:${userId}:${planName}:${path}`;
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const windowKey = `${key}:${windowStart}`;
  
  try {
    const redisClient = getRedisClient();
    // 使用Redis进行分布式速率限制
    const current = parseInt(await redisClient.get(windowKey) || '0');
    
    if (current >= config.requests) {
      const resetTime = windowStart + config.windowMs;
      return {
        blocked: true,
        limit: config.requests,
        remaining: 0,
        reset: resetTime,
        resetAfter: Math.ceil((resetTime - now) / 1000)
      };
    }
    
    // 增加计数器
    await redisClient.incr(windowKey);
    await redisClient.expire(windowKey, Math.ceil(config.windowMs / 1000));
    
    return {
      blocked: false,
      limit: config.requests,
      remaining: config.requests - current - 1,
      reset: windowStart + config.windowMs
    };
    
  } catch (error) {
    logger.error('Rate limit check failed', { error, userId, planName });
    // 如果Redis失败，允许请求通过
    return {
      blocked: false,
      limit: config.requests,
      remaining: config.requests,
      reset: now + config.windowMs
    };
  }
}

/**
 * 获取速率限制信息
 */
async function getSubscriptionRateLimitInfo(
  request: NextRequest,
  userId: string
): Promise<{
  limit: number;
  remaining: number;
  reset: number;
}> {
  // 简化实现，返回默认值
  return {
    limit: 1000,
    remaining: 999,
    reset: Date.now() + 60000
  };
}

/**
 * 检查功能配额
 */
async function checkFeatureQuota(
  userId: string,
  featureId: string,
  limits?: Record<string, any>
): Promise<{
  hasQuota: boolean;
  reason?: string;
}> {
  if (!limits) {
    return { hasQuota: true };
  }
  
  // 根据不同功能类型检查配额
  switch (featureId.split('_')[0]) {
    case 'siterank':
      // 检查批量查询限制
      if (limits.batchLimit) {
        // TODO: 实现具体的配额检查逻辑
        return { hasQuota: true };
      }
      break;
      
    case 'batchopen':
      // 检查批量打开限制
      if (limits.versions) {
        // TODO: 实现具体的配额检查逻辑
        return { hasQuota: true };
      }
      break;
      
    case 'adscenter':
      // 检查广告系列限制
      if (limits.maxCampaigns) {
        // TODO: 实现具体的配额检查逻辑
        return { hasQuota: true };
      }
      break;
  }
  
  return { hasQuota: true };
}

/**
 * 记录API访问日志
 */
async function logAPIAccess(
  request: NextRequest,
  data: {
    userId?: string;
    subscriptionId?: string;
    featureId?: string;
    success: boolean;
    responseTime: number;
    statusCode: number;
    error?: string;
  }
) {
  try {
    const { pathname } = new URL(request.url);
    
    const logData = {
      path: pathname,
      method: request.method,
      userId: data.userId || 'anonymous',
      subscriptionId: data.subscriptionId,
      featureId: data.featureId,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent'),
      success: data.success,
      responseTime: data.responseTime,
      statusCode: data.statusCode,
      error: data.error,
      timestamp: new Date().toISOString()
    };
    
    // 异步记录到数据库
    // Note: apiLog table doesn't exist in current schema
    // dbPool.executeQuery('log_api_access', async (prisma) => {
    //   await prisma.apiLog.create({
    //     data: logData
    //   });
    // }).catch(error => {
    //   logger.debug('Failed to log API access', error);
    // });
    
    // 记录到监控系统
    logger.info('API Access', logData);
    
  } catch (error) {
    logger.debug('Failed to log API access', error);
  }
}

/**
 * 创建需要特定功能的处理器
 */
export function requireFeature<T = any>(
  featureId: string,
  handler: (request: NextRequest, context: SubscriptionAPIContext) => Promise<T>,
  options?: Parameters<typeof createSubscriptionHandler>[2]
) {
  return createSubscriptionHandler(featureId, handler, options);
}

/**
 * 创建管理员专用处理器（需要管理员权限）
 */
export function createAdminSubscriptionHandler<T = any>(
  handler: (request: NextRequest, context: SubscriptionAPIContext) => Promise<T>,
  options?: Parameters<typeof createSubscriptionHandler>[2]
) {
  return requireFeature('admin', handler, {
    ...options,
    requireActiveSubscription: false
  });
}
