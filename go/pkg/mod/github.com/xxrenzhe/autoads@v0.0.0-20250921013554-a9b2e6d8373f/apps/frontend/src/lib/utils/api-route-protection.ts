import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { createLogger } from '../utils/security/secure-logger';
import { dbPool } from '../db-pool';
import { getRedisClient } from '../redis-config';

const logger = createLogger('APIRouteProtection');

// 角色权限映射
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['*'],
  MANAGER: ['read:users', 'read:analytics', 'manage:content'],
  USER: ['read:profile', 'update:profile', 'read:own-data']
};

// API路由权限配置
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // '/ops/api/v1/console' is proxied to backend; backend enforces admin auth
  '/api/users': ['ADMIN', 'MANAGER'],
  '/api/tokens': ['USER', 'ADMIN', 'MANAGER'],
  '/api/subscription': ['USER', 'ADMIN', 'MANAGER'],
  '/api/batchopen': ['USER', 'ADMIN', 'MANAGER'],
  '/api/siterank': ['USER', 'ADMIN', 'MANAGER']
};

// 速率限制配置
const RATE_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  // '/ops/api/v1/console': { requests: 100, windowMs: 60000 },
  '/api/batchopen': { requests: 1000, windowMs: 60000 }, // 1000 requests per minute
  '/api/siterank': { requests: 500, windowMs: 60000 }, // 500 requests per minute
  '/api/auth': { requests: 5, windowMs: 60000 }, // 5 requests per minute
  default: { requests: 100, windowMs: 60000 } // 100 requests per minute
};

export interface APIRouteContext {
  user: any;
  request: NextRequest;
  permissions: string[];
  rateLimit: {
    remaining: number;
    reset: number;
  };
}

/**
 * 创建受保护的API路由处理器
 */
export function createSecureHandler<T = any>(
  handler: (request: NextRequest, context: APIRouteContext) => Promise<T>,
  options: {
    requiredRoles?: string[];
    requiredPermissions?: string[];
    rateLimit?: boolean;
    authRequired?: boolean;
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const { pathname } = new URL(request.url);
    let authUser: any = null;
    
    try {
      // 1. 速率限制检查
      if (options.rateLimit !== false) {
        const rateLimitResult = await checkRateLimit(request, pathname);
        if (rateLimitResult.blocked) {
          logger.warn('Rate limit exceeded', {
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            path: pathname,
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

      // 2. 认证检查
      let permissions: string[] = [];
      
      if (options.authRequired !== false) {
        const session = await auth();
        
        if (!session?.user) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          );
        }
        
        authUser = session.user;
        
        // 3. 角色检查
        if (options.requiredRoles && options.requiredRoles.length > 0) {
          const userRole = authUser.role || 'USER';
          if (!options.requiredRoles.includes(userRole)) {
            logger.warn('Unauthorized access attempt', {
              userId: authUser.id,
              userRole,
              requiredRoles: options.requiredRoles,
              path: pathname
            });
            
            return NextResponse.json(
              { error: 'Insufficient permissions' },
              { status: 403 }
            );
          }
        }
        
        // 4. 权限检查
        permissions = ROLE_PERMISSIONS[authUser.role] || [];
        if (options.requiredPermissions && options.requiredPermissions.length > 0) {
          const hasAllPermissions = options.requiredPermissions.every(perm => 
            permissions.includes(perm) || permissions.includes('*')
          );
          
          if (!hasAllPermissions) {
            logger.warn('Permission denied', {
              userId: authUser.id,
              userPermissions: permissions,
              requiredPermissions: options.requiredPermissions,
              path: pathname
            });
            
            return NextResponse.json(
              { error: 'Insufficient permissions' },
              { status: 403 }
            );
          }
        }
      }

      // 5. 构建上下文
      const rateLimit = await getRateLimitInfo(request, pathname);
      const context: APIRouteContext = {
        user: authUser,
        request,
        permissions,
        rateLimit
      };

      // 6. 执行处理器
      const result = await handler(request, context);
      
      // 7. 记录成功访问
      const responseTime = Date.now() - startTime;
      await logAPIAccess(request, {
        userId: authUser?.id,
        success: true,
        responseTime,
        statusCode: 200
      });

      // 8. 添加响应头
      const response = result instanceof NextResponse ? result : NextResponse.json(result);
      
      // 添加速率限制头
      if (options.rateLimit !== false) {
        response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
        response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
        response.headers.set('X-RateLimit-Reset', rateLimit.reset.toString());
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
        userId: authUser?.id,
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
 * 检查速率限制
 */
async function checkRateLimit(request: NextRequest, path: string): Promise<{
  blocked: boolean;
  limit: number;
  remaining: number;
  reset: number;
  resetAfter?: number;
}> {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'anonymous';
  
  // 查找匹配的速率限制配置
  let config = RATE_LIMITS.default;
  for (const [routePath, routeConfig] of Object.entries(RATE_LIMITS)) {
    if (path.startsWith(routePath)) {
      config = routeConfig;
      break;
    }
  }
  
  const key = `rate_limit:${ip}:${userId}:${path}`;
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const windowKey = `${key}:${windowStart}`;
  
  try {
    // 使用Redis进行分布式速率限制
    const redisClient = getRedisClient();
    const current = parseInt(await redisClient.get(windowKey) || '0');
    
    if (current >= config.requests) {
      // 获取重置时间
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
    logger.error('Rate limit check failed', { error, path });
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
async function getRateLimitInfo(request: NextRequest, path: string): Promise<{
  limit: number;
  remaining: number;
  reset: number;
}> {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'anonymous';
  
  // 查找匹配的速率限制配置
  let config = RATE_LIMITS.default;
  for (const [routePath, routeConfig] of Object.entries(RATE_LIMITS)) {
    if (path.startsWith(routePath)) {
      config = routeConfig;
      break;
    }
  }
  
  const key = `rate_limit:${ip}:${userId}:${path}`;
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const windowKey = `${key}:${windowStart}`;
  
  try {
    const redisClient = getRedisClient();
    const current = parseInt(await redisClient.get(windowKey) || '0');
    
    return {
      limit: config.requests,
      remaining: Math.max(0, config.requests - current),
      reset: windowStart + config.windowMs
    };
  } catch (error) {
    return {
      limit: config.requests,
      remaining: config.requests,
      reset: now + config.windowMs
    };
  }
}

/**
 * 记录API访问日志
 */
async function logAPIAccess(
  request: NextRequest,
  data: {
    userId?: string;
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
      ip: request.ip || request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      success: data.success,
      responseTime: data.responseTime,
      statusCode: data.statusCode,
      error: data.error,
      timestamp: new Date().toISOString()
    };
    
    // 异步记录到数据库（不阻塞响应）
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
 * 创建管理员专用的安全处理器
 */
export function createAdminSecureHandler<T = any>(
  handler: (request: NextRequest, context: APIRouteContext) => Promise<T>,
  options: Omit<Parameters<typeof createSecureHandler>[1], 'requiredRoles'> = {}
) {
  return createSecureHandler(handler, {
    ...options,
    requiredRoles: ['ADMIN'],
    authRequired: true,
    rateLimit: true
  });
}

/**
 * 创建需要认证的处理器
 */
export function createAuthHandler<T = any>(
  handler: (request: NextRequest, context: APIRouteContext) => Promise<T>,
  options: Omit<Parameters<typeof createSecureHandler>[1], 'authRequired'> = {}
) {
  return createSecureHandler(handler, {
    ...options,
    authRequired: true,
    rateLimit: true
  });
}
