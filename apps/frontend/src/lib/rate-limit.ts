import Redis from 'ioredis';
import { createLogger } from './utils/security/secure-logger';

const logger = createLogger('RateLimit');

// Redis客户端（使用现有的REDIS_URL）
let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
  redis.on('error', (err) => {
    logger.error('Redis connection error:', err);
  });
}

export interface RateLimitOptions {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  keyPrefix?: string; // 键前缀
  skipSuccessfulRequests?: boolean; // 是否跳过成功请求
  skipFailedRequests?: boolean; // 是否跳过失败请求
}

export class RateLimiter {
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.options = {
      keyPrefix: 'rate_limit',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...options
    };
  }

  async check(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    total: number;
  }> {
    if (!redis) {
      // 如果没有Redis，默认允许所有请求
      return { allowed: true, remaining: this.options.maxRequests, resetTime: 0, total: this.options.maxRequests };
    }

    const key = `${this.options.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    try {
      // 使用Redis的滑动窗口算法
      const pipeline = redis.pipeline();
      
      // 移除过期的记录
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // 获取当前窗口内的请求数
      pipeline.zcard(key);
      
      // 设置过期时间
      pipeline.expire(key, Math.ceil(this.options.windowMs / 1000));
      
      const results = await pipeline.exec();
      const currentCount = results?.[1]?.[1] as number || 0;

      if (currentCount >= this.options.maxRequests) {
        // 获取窗口重置时间
        const earliest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const resetTime = earliest.length > 0 ? parseInt(earliest[1][1]) + this.options.windowMs : now + this.options.windowMs;
        
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          total: this.options.maxRequests
        };
      }

      // 记录当前请求
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      
      return {
        allowed: true,
        remaining: this.options.maxRequests - currentCount - 1,
        resetTime: now + this.options.windowMs,
        total: this.options.maxRequests
      };
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      // Redis出错时，默认允许请求
      return { allowed: true, remaining: this.options.maxRequests, resetTime: 0, total: this.options.maxRequests };
    }
  }
}

// 预定义的速率限制器
export const rateLimiters = {
  // API通用限制：每分钟100次
  api: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'rate_limit:api'
  }),
  
  // 批量打开限制：每分钟10次
  batchOpen: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'rate_limit:batchopen'
  }),
  
  // 站点排名限制：每分钟30次
  siteRank: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'rate_limit:siterank'
  }),
  
  // 登录限制：每分钟5次
  auth: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'rate_limit:auth'
  })
};

// 创建速率限制中间件的辅助函数
export function createRateLimitMiddleware(limiter: RateLimiter, getKeyFn: (req: any) => string) {
  return async (req: any, res: any, next: () => void) => {
    const key = getKeyFn(req);
    const result = await limiter.check(key);
    
    // 在响应头中添加速率限制信息
    res.setHeader('X-RateLimit-Limit', result.total.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', result.resetTime.toString());
    
    if (!result.allowed) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
    }
    
    next();
  };
}