import { rateLimiters } from './rate-limit';
import { NextRequest, NextResponse } from 'next/server';

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
  const ip = req.ip || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
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
    const protectedHandler = withErrorHandler(handler);
    return limiterKey ? withRateLimit(limiterKey)(protectedHandler) : protectedHandler;
  };
};