/**
 * Rate Limiting Middleware
 * Provides configurable rate limiting for API endpoints
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

interface RateLimitData {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private store: Map<string, RateLimitData> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Check if request is allowed
   */
  async check(
    req: NextRequest,
    windowMs: number,
    maxRequests: number,
    keyGenerator?: (req: NextRequest) => string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    // Generate key for rate limiting
    const key = keyGenerator ? keyGenerator(req) : this.getDefaultKey(req);
    
    // Get current time
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create rate limit data
    let data = this.store.get(key);
    
    if (!data || data.resetTime < windowStart) {
      // New window
      data = {
        count: 1,
        resetTime: now + windowMs
      };
      this.store.set(key, data);
      
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: data.resetTime
      };
    }
    
    // Check if limit exceeded
    if (data.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: data.resetTime
      };
    }
    
    // Increment count
    data.count++;
    this.store.set(key, data);
    
    return {
      allowed: true,
      remaining: maxRequests - data.count,
      resetTime: data.resetTime
    };
  }

  /**
   * Get default rate limit key
   */
  private getDefaultKey(req: NextRequest): string {
    // Use IP address as default key
    const ip = req.ip || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    // For authenticated requests, include user ID
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      return `${ip}:${authHeader.substring(0, 10)}`;
    }
    
    return ip;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (data.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Get current rate limit status
   */
  getStatus(key: string): { count: number; resetTime: number } | null {
    const data = this.store.get(key);
    return data ? { count: data.count, resetTime: data.resetTime } : null;
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

/**
 * Database-backed rate limiter for distributed systems
 */
export class DatabaseRateLimiter {
  /**
   * Check rate limit using database
   */
  static async check(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = new Date(now - windowMs);
    
    // Count requests in the current window
    const count = await prisma.apiUsage.count({
      where: {
        endpoint: key,
        timestamp: {
          gte: windowStart
        }
      }
    });
    
    if (count >= maxRequests) {
      // Find when the window resets
      const oldestRequest = await prisma.apiUsage.findFirst({
        where: {
          endpoint: key,
          timestamp: {
            gte: windowStart
          }
        },
        orderBy: {
          timestamp: 'asc'
        }
      });
      
      const resetTime = oldestRequest 
        ? oldestRequest.timestamp.getTime() + windowMs 
        : now + windowMs;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }
    
    // Record this request
    try {
      await prisma.apiUsage.create({
        data: {
          userId: key, // Use the key as userId for anonymous rate limiting
          endpoint: key,
          method: 'RATE_LIMIT',
          statusCode: 200,
          responseTime: 0,
          tokenConsumed: 0,
          timestamp: new Date(now)
        }
      });
    } catch (error) {
      console.error('Failed to record rate limit:', error);
    }
    
    return {
      allowed: true,
      remaining: maxRequests - count - 1,
      resetTime: now + windowMs
    };
  }
}

/**
 * Pre-configured rate limiters
 */
export const rateLimits = {
  // General API limits
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100
  },
  
  // Auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5
  },
  
  // Sensitive operations
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10
  },
  
  // File uploads
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5
  },
  
  // Email/SMS services
  notification: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20
  }
};

/**
 * Create rate limit key generator for specific endpoints
 */
export function createKeyGenerator(prefix: string) {
  return (req: NextRequest): string => {
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    const path = new URL(req.url).pathname;
    return `${prefix}:${ip}:${path}`;
  };
}