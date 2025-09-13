import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache/RedisCacheService';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RateLimiter {
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.options = {
      keyGenerator: (req) => req.ip || 'unknown',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...options,
    };
  }

  /**
   * Check if request is allowed
   */
  async isAllowed(req: NextRequest): Promise<{ allowed: boolean; remaining: number }> {
    const key = this.options.keyGenerator(req);
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    // Get current requests
    const requests = await apiCache.get<number[]>(key) || [];
    
    // Filter out old requests
    const validRequests = requests.filter((time: any) => time > windowStart);
    
    // Check if limit exceeded
    if (validRequests.length >= this.options.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
      };
    }

    // Add new request
    validRequests.push(now);
    await apiCache.set(key, validRequests, {
      ttl: Math.ceil(this.options.windowMs / 1000),
    });

    return {
      allowed: true,
      remaining: this.options.maxRequests - validRequests.length,
    };
  }

  /**
   * Create middleware
   */
  middleware() {
    return async (req: NextRequest, handler: () => Promise<NextResponse>) => {
      const { allowed, remaining } = await this.isAllowed(req);

      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': this.options.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': (Date.now() + this.options.windowMs).toString(),
            },
          }
        );
      }

      const response = await handler();
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', this.options.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', (Date.now() + this.options.windowMs).toString());

      return response;
    };
  }
}

// Pre-configured rate limiters
export const strictRateLimit = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 10,
});

export const normalRateLimit = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100,
});

export const apiRateLimit = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 1000,
});
