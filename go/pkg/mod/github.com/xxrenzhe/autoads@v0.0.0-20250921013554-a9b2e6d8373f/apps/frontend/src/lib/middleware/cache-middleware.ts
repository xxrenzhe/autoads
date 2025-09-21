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
      .map((header: any) => req.headers.get(header))
      .filter(Boolean)
      .join(':');
    
    const fullKey = varyValues ? `${cacheKey}:${varyValues}` : cacheKey;

    // Try to get cached response
    const cached = await apiCache.get<any>(fullKey);
    if (cached && typeof cached === 'object' && cached.data) {
      const response = NextResponse.json(cached.data, {
        status: cached.status || 200,
        headers: cached.headers || {},
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
