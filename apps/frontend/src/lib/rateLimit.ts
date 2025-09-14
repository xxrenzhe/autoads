import { NextRequest, NextResponse } from 'next/server';
import { getRequestIp } from '@/lib/utils/request-ip'
import { createHash } from 'crypto';

interface RateLimitData {
  count: number;
  resetTime: number;
}

// 简单的内存存储（生产环境建议使用 Redis）
const rateLimitStore = new Map<string, RateLimitData>();

// 清理过期的记录
const cleanupExpired = () => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
};

// 每分钟清理一次
setInterval(cleanupExpired, 60 * 1000);

export interface RateLimitOptions {
  windowMs?: number; // 时间窗口（毫秒）
  maxRequests?: number; // 最大请求数
  keyGenerator?: (req: NextRequest) => string; // 生成限制键的函数
  skipSuccessfulRequests?: boolean; // 是否跳过成功的请求
  skipFailedRequests?: boolean; // 是否跳过失败的请求
}

export function createRateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60 * 1000, // 默认1分钟
    maxRequests = 100, // 默认100次请求
    keyGenerator = (req: NextRequest) => {
      // 默认使用 IP + User-Agent 作为键
      const ip = getRequestIp(req) || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';
      return createHash('md5').update(`${ip}:${userAgent}`).digest('hex');
    },
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return async function rateLimit(req: NextRequest) {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // 获取或创建限制数据
    let data = rateLimitStore.get(key);
    if (!data || now > data.resetTime) {
      data = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, data);
    }

    // 检查是否超过限制
    if (data.count >= maxRequests) {
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: data.resetTime,
      };
    }

    // 增加计数
    data.count++;

    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - data.count,
      reset: data.resetTime,
    };
  };
}

// 预定义的限制器
export const logApiRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 30, // 每分钟最多30次请求
  keyGenerator: (req: NextRequest) => {
    // 对日志API使用更严格的限制键
    const ip = getRequestIp(req) || 'unknown';
    const path = req.nextUrl.pathname;
    return createHash('md5').update(`${ip}:${path}`).digest('hex');
  },
});

// 通用的API限制器
export const generalApiRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 100, // 每分钟最多100次请求
});

// 导出统一的限制器集合，便于通过 key 选择
export const rateLimiters = {
  general: generalApiRateLimit,
  log: logApiRateLimit,
};

// 创建速率限制中间件
export function withRateLimit(
  limiter: ReturnType<typeof createRateLimit>,
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any) => {
    const result = await limiter(req);
    
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // 在响应头中添加速率限制信息
    const response = await handler(req, context);
    
    if (response.headers) {
      response.headers.set('X-RateLimit-Limit', result.limit.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.reset.toString());
    }
    
    return response;
  };
}
