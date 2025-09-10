import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionQuotaService } from '@/lib/services/subscription-quota-service';
import { auth } from '@/lib/auth';

/**
 * Middleware to enforce subscription quotas
 */
export async function quotaMiddleware(request: NextRequest) {
  // Skip quota check for certain paths
  const skipPaths = [
    '/api/auth',
    '/api/invitation',
    '/api/webhooks',
    '/_next',
    '/static',
    '/favicon.ico'
  ];

  if (skipPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  try {
    // Get user session
    const session = await auth();
    
    if (!session?.user?.id) {
      // For unauthenticated users, use basic rate limiting
      return NextResponse.next();
    }

    const userId = session.user.id;
    const endpoint = request.nextUrl.pathname;

    // Check rate limit
    const rateLimit = await SubscriptionQuotaService.checkRateLimit(userId, endpoint);
    
    if (!rateLimit.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000)
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Add rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toISOString());

    return response;

  } catch (error) {
    console.error('Quota middleware error:', error);
    return NextResponse.next();
  }
}

/**
 * Higher-order function to wrap API handlers with quota checks
 */
export function withQuotaCheck(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    const session = await auth();
    
    if (!session?.user?.id) {
      return handler(request, ...args);
    }

    const userId = session.user.id;
    const endpoint = request.nextUrl.pathname;

    // Check API call quota
    const apiQuota = await SubscriptionQuotaService.checkQuota(
      userId,
      SubscriptionQuotaService.QUOTA_TYPES.API_CALLS
    );

    if (!apiQuota.hasQuota) {
      return NextResponse.json(
        {
          error: 'API quota exceeded',
          message: 'You have exceeded your monthly API call limit.',
          quota: apiQuota
        },
        { status: 403 }
      );
    }

    // Proceed with the handler
    const result = await handler(request, ...args);

    // If this was a successful API call, consume quota
    if (result instanceof NextResponse && result.status < 400) {
      await SubscriptionQuotaService.consumeQuota(
        userId,
        SubscriptionQuotaService.QUOTA_TYPES.API_CALLS
      );
    }

    // Add quota headers
    if (result instanceof NextResponse) {
      result.headers.set('X-API-Quota-Limit', apiQuota.limit.toString());
      result.headers.set('X-API-Quota-Remaining', (apiQuota.remaining - 1).toString());
      result.headers.set('X-API-Quota-Reset', apiQuota.resetDate?.toISOString() || '');
    }

    return result;
  };
}