import { getCacheService } from './cache-service';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum number of requests allowed
  keyGenerator?: (req: any) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  onLimitReached?: (key: string, limit: RateLimitInfo) => void; // Callback when limit is reached
}

export interface RateLimitInfo {
  key: string;
  current: number;
  max: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

/**
 * Distributed Rate Limiting Service using Redis
 * Provides consistent rate limiting across multiple server instances
 */
export class DistributedRateLimitService {
  private cache = getCacheService();
  private defaultOptions: Partial<RateLimitOptions> = {
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  };

  /**
   * Check if request is allowed
   */
  async checkLimit(key: string, options: RateLimitOptions): Promise<{
    allowed: boolean;
    info: RateLimitInfo;
  }> {
    const {
      windowMs,
      maxRequests,
      skipSuccessfulRequests,
      skipFailedRequests,
      onLimitReached
    } = { ...this.defaultOptions, ...options };

    const now = Date.now();
    const windowStart = now - windowMs;
    const resetTime = now + windowMs;

    // Use Redis sorted set for sliding window
    const redisKey = `rate_limit:${key}`;
    
    try {
      // Remove old entries
      await this.cache.client?.zremrangebyscore(redisKey, 0, windowStart);

      // Get current count
      const current = await this.cache.client?.zcard(redisKey) || 0;

      // Check if limit exceeded
      if (current >= maxRequests) {
        const info: RateLimitInfo = {
          key,
          current,
          max: maxRequests,
          remaining: 0,
          resetTime,
          retryAfter: windowMs
        };

        if (onLimitReached) {
          onLimitReached(key, info);
        }

        return { allowed: false, info };
      }

      // Add current request
      await this.cache.client?.zadd(redisKey, now, `${now}-${Math.random()}`);
      
      // Set expiration
      await this.cache.client?.expire(redisKey, Math.ceil(windowMs / 1000));

      const info: RateLimitInfo = {
        key,
        current: current + 1,
        max: maxRequests,
        remaining: maxRequests - current - 1,
        resetTime,
        retryAfter: 0
      };

      return { allowed: true, info };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        info: {
          key,
          current: 0,
          max: maxRequests,
          remaining: maxRequests,
          resetTime,
          retryAfter: 0
        }
      };
    }
  }

  /**
   * Middleware for Express/Next.js
   */
  middleware(options: RateLimitOptions) {
    return async (req: any, res: any, next: any) => {
      const key = options.keyGenerator 
        ? options.keyGenerator(req)
        : this.getDefaultKey(req);

      const result = await this.checkLimit(key, options);

      // Add rate limit headers
      res.set('X-RateLimit-Limit', result.info.max.toString());
      res.set('X-RateLimit-Remaining', result.info.remaining.toString());
      res.set('X-RateLimit-Reset', result.info.resetTime.toString());

      if (!result.allowed) {
        res.set('Retry-After', result.info.retryAfter.toString());
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded',
          retryAfter: result.info.retryAfter
        });
        return;
      }

      // Track request success/failure if configured
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        originalEnd.call(this, chunk, encoding);

        const isSuccess = res.statusCode < 400;
        
        if ((options.skipSuccessfulRequests && isSuccess) ||
            (options.skipFailedRequests && !isSuccess)) {
          // Remove this request from count
          // This is complex with sliding window, so we'll just adjust the count
          DistributedRateLimitService.getInstance().adjustCount(key, -1);
        }
      };

      next();
    };
  }

  /**
   * Adjust the count for a key (useful for removing successful/failed requests)
   */
  private async adjustCount(key: string, amount: number): Promise<void> {
    const redisKey = `rate_limit:${key}`;
    try {
      if (amount < 0) {
        // Remove the oldest request
        await this.cache.client?.zpopmin(redisKey);
      }
    } catch (error) {
      console.error('Rate limit adjust error:', error);
    }
  }

  /**
   * Get current rate limit info without checking/incrementing
   */
  async getInfo(key: string, options: RateLimitOptions): Promise<RateLimitInfo | null> {
    const { windowMs, maxRequests } = options;
    const now = Date.now();
    const windowStart = now - windowMs;
    const resetTime = now + windowMs;

    try {
      const redisKey = `rate_limit:${key}`;
      
      // Remove old entries
      await this.cache.client?.zremrangebyscore(redisKey, 0, windowStart);

      // Get current count
      const current = await this.cache.client?.zcard(redisKey) || 0;

      return {
        key,
        current,
        max: maxRequests,
        remaining: Math.max(0, maxRequests - current),
        resetTime,
        retryAfter: current >= maxRequests ? windowMs : 0
      };
    } catch (error) {
      console.error('Rate limit info error:', error);
      return null as any;
    }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    try {
      const redisKey = `rate_limit:${key}`;
      await this.cache.delete(redisKey);
    } catch (error) {
      console.error('Rate limit reset error:', error);
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  async cleanup(): Promise<void> {
    try {
      const keys = await this.cache.client?.keys('rate_limit:*') || [];
      
      for (const key of keys) {
        const ttl = await this.cache.client?.ttl(key);
        if (ttl === -1) { // Key exists but has no expiry
          const now = Date.now();
          const oldest = await this.cache.client?.zrange(key, 0, 0, 'WITHSCORES');
          
          if (oldest && oldest.length > 0) {
            const timestamp = parseInt(oldest[1]);
            const age = now - timestamp;
            
            // If oldest entry is older than 24 hours, remove the key
            if (age > 24 * 60 * 60 * 1000) {
              await this.cache.delete(key);
            }
          }
        }
      }
    } catch (error) {
      console.error('Rate limit cleanup error:', error);
    }
  }

  private getDefaultKey(req: any): string {
    // Use IP address and optionally user ID
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userId = req.user?.id;
    
    return userId ? `${ip}:${userId}` : ip;
  }

  // Singleton pattern
  private static instance: DistributedRateLimitService;

  static getInstance(): DistributedRateLimitService {
    if (!DistributedRateLimitService.instance) {
      DistributedRateLimitService.instance = new DistributedRateLimitService();
    }
    return DistributedRateLimitService.instance;
  }
}

// Export singleton instance
export const distributedRateLimit = DistributedRateLimitService.getInstance();

/**
 * Common rate limit configurations
 */
export const RateLimitConfigs = {
  // API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (req: any) => `api:${req.user?.id || req.ip}`
  },
  
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (req: any) => `auth:${req.ip}`
  },
  
  // Token consumption
  tokenConsume: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    keyGenerator: (req: any) => `token:${req.user?.id}`
  },
  
  // File upload
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyGenerator: (req: any) => `upload:${req.user?.id}`
  },
  
  // Email sending
  email: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 100,
    keyGenerator: (req: any) => `email:${req.user?.id}`
  }
} as const;