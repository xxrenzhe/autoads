#!/bin/bash

echo "⚡ Implementing Performance Optimization and Caching Strategy"
echo "============================================================"

# 1. Create Redis-based caching service
echo "1. Creating Redis caching service..."
cat > src/lib/cache/RedisCacheService.ts << 'EOF'
import redis from '@/lib/redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
}

export class RedisCacheService {
  private defaultTTL: number = 3600; // 1 hour
  private keyPrefix: string;

  constructor(keyPrefix: string = 'cache:') {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.generateKey(key);
      const value = await redis.get(fullKey);
      
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.generateKey(key);
      const ttl = options.ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);
      
      await redis.set(fullKey, serialized, 'EX', ttl);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.generateKey(key);
      await redis.del(fullKey);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear all cache with prefix
   */
  async clear(): Promise<void> {
    try {
      const keys = await redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(key, value, options);
    return value;
  }
}

// Create cache instances for different purposes
export const apiCache = new RedisCacheService('api:');
export const dbCache = new RedisCacheService('db:');
export const configCache = new RedisCacheService('config:');
EOF

# 2. Create response caching middleware
echo "2. Creating response caching middleware..."
cat > src/lib/middleware/cache-middleware.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache/RedisCacheService';

export interface CacheMiddlewareOptions {
  ttl?: number;
  keyPrefix?: string;
  varyBy?: string[];
  skip?: (req: NextRequest) => boolean;
}

export function withCache(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = 60, // 1 minute default
    keyPrefix = 'response:',
    varyBy = [],
    skip,
  } = options;

  return async (req: NextRequest, handler: () => Promise<NextResponse>) => {
    // Skip caching if conditions met
    if (skip?.(req)) {
      return handler();
    }

    // Generate cache key
    const url = new URL(req.url);
    const cacheKey = `${keyPrefix}${url.pathname}${url.search}`;

    // Check Vary headers
    const varyValues = varyBy
      .map(header => req.headers.get(header))
      .filter(Boolean)
      .join(':');
    
    const fullKey = varyValues ? `${cacheKey}:${varyValues}` : cacheKey;

    // Try to get cached response
    const cached = await apiCache.get(fullKey);
    if (cached) {
      const response = NextResponse.json(cached.data, {
        status: cached.status,
        headers: cached.headers,
      });
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    // Get fresh response
    const response = await handler();
    
    // Only cache successful GET requests
    if (req.method === 'GET' && response.status === 200) {
      const data = await response.json();
      await apiCache.set(fullKey, {
        data,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      }, { ttl });
    }

    response.headers.set('X-Cache', 'MISS');
    return response;
  };
}
EOF

# 3. Create database query optimization
echo "3. Creating database query optimization..."
cat > src/lib/db/query-optimizer.ts << 'EOF'
import { Prisma } from '@prisma/client';

export interface QueryOptions {
  include?: Record<string, any>;
  select?: Record<string, any>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  take?: number;
  skip?: number;
  where?: Record<string, any>;
}

export class QueryOptimizer {
  /**
   * Optimize pagination queries
   */
  static paginate<T extends Prisma.Args<any>>(
    query: T,
    page: number,
    pageSize: number
  ) {
    const skip = (page - 1) * pageSize;
    return {
      ...query,
      skip,
      take: pageSize,
    };
  }

  /**
   * Add only necessary fields (projection)
   */
  static only<T extends Prisma.Args<any>>(query: T, fields: string[]) {
    const select: Record<string, boolean> = {};
    fields.forEach(field => {
      select[field] = true;
    });
    
    return {
      ...query,
      select,
    };
  }

  /**
   * Add count for pagination
   */
  static withCount<T extends Prisma.Args<any>>(query: T) {
    return {
      ...query,
      include: {
        ...query.include,
        _count: {
          select: {
            id: true,
          },
        },
      },
    };
  }

  /**
   * Optimize for large datasets with cursor-based pagination
   */
  static cursor<T extends Prisma.Args<any>>(
    query: T,
    cursor: string | null,
    take: number
  ) {
    if (!cursor) {
      return {
        ...query,
        take,
      };
    }

    return {
      ...query,
      take,
      skip: 1, // Skip the cursor itself
      cursor: {
        id: cursor,
      },
    };
  }
}
EOF

# 4. Create performance monitoring
echo "4. Creating performance monitoring..."
cat > src/lib/performance/monitor.ts << 'EOF'
export interface PerformanceMetrics {
  requestCount: number;
  responseTime: number[];
  errorRate: number;
  cacheHitRate: number;
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();

  /**
   * Record request metrics
   */
  recordRequest(endpoint: string, responseTime: number, isError: boolean, cacheHit: boolean): void {
    const existing = this.metrics.get(endpoint) || {
      requestCount: 0,
      responseTime: [],
      errorRate: 0,
      cacheHitRate: 0,
    };

    existing.requestCount++;
    existing.responseTime.push(responseTime);

    // Keep only last 100 response times
    if (existing.responseTime.length > 100) {
      existing.responseTime = existing.responseTime.slice(-100);
    }

    // Update error rate
    if (isError) {
      existing.errorRate = ((existing.errorRate * (existing.requestCount - 1)) + 1) / existing.requestCount;
    } else {
      existing.errorRate = (existing.errorRate * (existing.requestCount - 1)) / existing.requestCount;
    }

    // Update cache hit rate
    if (cacheHit) {
      existing.cacheHitRate = ((existing.cacheHitRate * (existing.requestCount - 1)) + 1) / existing.requestCount;
    } else {
      existing.cacheHitRate = (existing.cacheHitRate * (existing.requestCount - 1)) / existing.requestCount;
    }

    this.metrics.set(endpoint, existing);
  }

  /**
   * Get metrics for endpoint
   */
  getMetrics(endpoint: string): PerformanceMetrics | null {
    return this.metrics.get(endpoint) || null;
  }

  /**
   * Get average response time
   */
  getAverageResponseTime(endpoint: string): number {
    const metrics = this.getMetrics(endpoint);
    if (!metrics || metrics.responseTime.length === 0) return 0;

    const sum = metrics.responseTime.reduce((a, b) => a + b, 0);
    return sum / metrics.responseTime.length;
  }

  /**
   * Get system health score (0-100)
   */
  getHealthScore(): number {
    if (this.metrics.size === 0) return 100;

    let totalScore = 0;
    let weight = 0;

    this.metrics.forEach(metrics => {
      // Response time score (lower is better)
      const avgResponseTime = this.getAverageResponseTime(
        Array.from(this.metrics.keys())[0] || ''
      );
      const responseTimeScore = Math.max(0, 100 - (avgResponseTime / 10));
      
      // Error rate score (lower is better)
      const errorRateScore = 100 - (metrics.errorRate * 100);
      
      // Cache hit rate score (higher is better)
      const cacheHitScore = metrics.cacheHitRate * 100;

      totalScore += (responseTimeScore * 0.4) + (errorRateScore * 0.4) + (cacheHitScore * 0.2);
      weight++;
    });

    return weight > 0 ? totalScore / weight : 100;
  }
}

export const performanceMonitor = new PerformanceMonitor();
EOF

# 5. Create memory optimization
echo "5. Creating memory optimization..."
cat > src/lib/performance/memory-optimizer.ts << 'EOF'
export interface MemoryUsage {
  rss: number; // Resident Set Size
  heapTotal: number;
  heapUsed: number;
  external: number;
  percentage: number;
}

export class MemoryOptimizer {
  private threshold: number = 0.8; // 80% threshold
  private gcInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      percentage: usage.heapUsed / totalMemory,
    };
  }

  /**
   * Check if memory usage is high
   */
  isMemoryHigh(): boolean {
    const usage = this.getMemoryUsage();
    return usage.percentage > this.threshold;
  }

  /**
   * Force garbage collection if available
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Clear unused caches
   */
  async clearCaches(): Promise<void> {
    try {
      // Clear various caches
      const { apiCache, dbCache, configCache } = await import('@/lib/cache/RedisCacheService');
      await Promise.all([
        apiCache.clear(),
        dbCache.clear(),
        configCache.clear(),
      ]);
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    this.gcInterval = setInterval(() => {
      const usage = this.getMemoryUsage();
      
      if (this.isMemoryHigh()) {
        console.warn('Memory usage high:', Math.round(usage.percentage * 100), '%');
        this.forceGC();
        this.clearCaches();
      }
    }, 60000); // Check every minute
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
  }
}

export const memoryOptimizer = new MemoryOptimizer();
EOF

# 6. Create API rate limiting
echo "6. Creating API rate limiting..."
cat > src/lib/middleware/rate-limit.ts << 'EOF'
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
    const validRequests = requests.filter(time => time > windowStart);
    
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
EOF

# 7. Create performance optimization script
echo "7. Creating performance optimization script..."
cat > scripts/optimize-performance.sh << 'EOF'
#!/bin/bash

echo "⚡ Performance Optimization Script"
echo "================================="

# 1. Enable Node.js performance monitoring
export NODE_OPTIONS="--max-old-space-size=4096 --inspect=0.0.0.0:9229"

# 2. Check memory usage
echo "Memory Usage:"
node -e "console.log(process.memoryUsage())"

# 3. Enable production optimizations
export NODE_ENV=production

# 4. Set optimal worker count
CPU_COUNT=$(nproc)
export UV_THREADPOOL_SIZE=$((CPU_COUNT * 2))

echo "CPU Count: $CPU_COUNT"
echo "Thread Pool Size: $UV_THREADPOOL_SIZE"

# 5. Start application with optimizations
echo "Starting application with performance optimizations..."
npm run dev

echo "✅ Performance optimizations applied!"
EOF

chmod +x scripts/optimize-performance.sh

echo "✅ Performance optimization and caching strategy implemented!"
echo ""
echo "Components created:"
echo "- Redis Cache Service"
echo "- Response Caching Middleware"
echo "- Database Query Optimizer"
echo "- Performance Monitor"
echo "- Memory Optimizer"
echo "- API Rate Limiting"
echo ""
echo "To apply optimizations: ./scripts/optimize-performance.sh"
EOF