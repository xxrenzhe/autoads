import { rateLimiters } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestIp } from '@/lib/utils/request-ip'
import { createLogger } from '@/lib/utils/security/secure-logger'

const apiLogger = createLogger('API');

// 创建API路由的速率限制包装器
export function withRateLimit(
  limiterKey: keyof typeof rateLimiters,
  getKeyFn?: (req: NextRequest) => string
) {
  return function <T extends (req: NextRequest, ...args: any[]) => any>(
    handler: T
  ): T {
    return (async function(this: any, req: NextRequest, ...args: any[]) {
      // 获取速率限制标识符
      const identifier = getKeyFn 
        ? getKeyFn(req)
        : getDefaultKey(req);
      
      // 检查速率限制
      const rateLimitResult = await rateLimiters[limiterKey].check(identifier);
      
      // 如果被限制，返回429
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            error: 'Too Many Requests',
            message: '请求过于频繁，请稍后再试',
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': rateLimitResult.total.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
              'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
            }
          }
        );
      }
      
      // 添加速率限制头到响应
      const response = await handler.apply(this, [req, ...args]);
      
      if (response instanceof NextResponse) {
        response.headers.set('X-RateLimit-Limit', rateLimitResult.total.toString());
        response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
        response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
      }
      
      return response;
    } as unknown) as T;
  };
}

// 获取默认的速率限制键
function getDefaultKey(req: NextRequest): string {
  // 1. 优先使用用户ID（如果有认证）
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // 这里可以解析JWT获取用户ID
    // 简化处理，使用token作为key
    return `user:${authHeader.substring(7)}`;
  }
  
  // 2. 使用IP地址
  const ip = getRequestIp(req);
  if (ip) {
    return `ip:${ip}`;
  }
  
  // 3. 最后使用session ID
  const sessionCookie = req.cookies.get('next-auth.session-token')?.value;
  if (sessionCookie) {
    return `session:${sessionCookie}`;
  }
  
  // 4. 默认使用请求源
  return `anonymous:${req.headers.get('origin') || 'unknown'}`;
}

// 错误处理包装器
export function withErrorHandler<T extends (req: NextRequest, ...args: any[]) => any>(
  handler: T
): T {
  return (async function(this: any, req: NextRequest, ...args: any[]) {
    try {
      return await handler.apply(this, [req, ...args]);
    } catch (error) {
      console.error('API Error:', error);
      
      // 根据错误类型返回不同的状态码
      if (error instanceof Error) {
        if (error.name === 'ValidationError') {
          return NextResponse.json(
            { error: 'Validation Error', message: error.message },
            { status: 400 }
          );
        }
        
        if (error.name === 'UnauthorizedError') {
          return NextResponse.json(
            { error: 'Unauthorized', message: error.message },
            { status: 401 }
          );
        }
        
        if (error.name === 'ForbiddenError') {
          return NextResponse.json(
            { error: 'Forbidden', message: error.message },
            { status: 403 }
          );
        }
      }
      
      // 默认服务器错误
      return NextResponse.json(
        { error: 'Internal Server Error', message: '服务器内部错误' },
        { status: 500 }
      );
    }
  } as unknown) as T;
}

// 组合多个装饰器
export function compose<T extends (...args: any[]) => any>(
  ...decorators: Array<(handler: T) => T>
): (handler: T) => T {
  return (handler: T) => {
    return decorators.reduceRight((decorated, decorator) => {
      return decorator(decorated);
    }, handler);
  };
}

// 常用的组合装饰器
export const withApiProtection = (limiterKey?: keyof typeof rateLimiters) => {
  return <T extends (req: NextRequest, ...args: any[]) => any>(handler: T): T => {
    const protectedHandler = withErrorHandler(async (req: NextRequest, ...args: any[]) => {
      const start = Date.now();
      const res = await (handler as any)(req, ...args);
      const dur = Date.now() - start;
      // Ensure headers: X-Request-Id, Server-Timing
      if (res instanceof NextResponse) {
        const reqId = req.headers.get('x-request-id') || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
        try { res.headers.set('X-Request-Id', reqId) } catch (_e) {}
        const existingTiming = res.headers.get('server-timing');
        const timing = `app;dur=${dur}`;
        try { res.headers.set('Server-Timing', existingTiming ? `${existingTiming}, ${timing}` : timing) } catch (_e) {}
        // Structured log (unified fields)
        const ip = getRequestIp(req) || 'unknown';
        const ua = req.headers.get('user-agent') || undefined;
        const feature = detectFeatureFromPath(new URL(req.url).pathname);
        const cacheHit = res.headers.get('X-Cache-Hit') || undefined;
        apiLogger.info('api_call', {
          request_id: reqId,
          user_id: extractUserId(req) || 'anonymous',
          feature,
          latency_ms: dur,
          tokens: undefined,
          cache_hit: cacheHit,
          method: req.method,
          path: new URL(req.url).pathname,
          ip,
          user_agent: ua
        });
      }
      return res;
    }) as any;
    return limiterKey ? withRateLimit(limiterKey)(protectedHandler as any) : (protectedHandler as any);
  };
};

function detectFeatureFromPath(path: string): string {
  if (path.includes('/siterank')) return 'siterank';
  if (path.includes('/batchopen')) return 'batchopen';
  if (path.includes('/adscenter') || path.includes('/changelink')) return 'adscenter';
  if (path.includes('/token')) return 'token';
  if (path.includes('/user')) return 'user';
  if (path.includes('/admin') || path.includes('/console')) return 'admin';
  return 'unknown';
}

function extractUserId(req: NextRequest): string | null {
  // Prefer internal header if present
  const h = req.headers.get('x-user-id');
  if (h) return h;
  // Otherwise attempt to parse from Authorization (opaque)
  const auth = req.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) return null; // Avoid leaking tokens
  return null;
}
