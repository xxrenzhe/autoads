import { EnhancedError } from '@/lib/utils/error-handling';
import { NextRequest, NextResponse  } from 'next/server';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { 
  ApplicationError, 
  RateLimitError, 
  createErrorResponse, 
  formatErrorForLogging,
  createSecureErrorMessage 
} from '@/lib/utils/error-handling';

const logger = createLogger('APIMiddleware');

// Rate limiting store (in-memory for demo, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration for different endpoints
const RATE_LIMITS = {
  DEFAULT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 150, // balanced limit for general API usage
  },
  PROXY_VALIDATE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // updated limit for proxy validation
  },
  SILENT_START: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // updated limit for task creation
  },
  SILENT_PROGRESS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300, // lenient limit for progress polling (frequent client requests)
  }
};

// Get rate limit configuration for the current path
function getRateLimitConfig(pathname: string) {
  if (pathname.includes('/proxy-validate')) {
    return RATE_LIMITS.PROXY_VALIDATE;
  }
  if (pathname.includes('/silent-start')) {
    return RATE_LIMITS.SILENT_START;
  }
  if (pathname.includes('/silent-progress')) {
    return RATE_LIMITS.SILENT_PROGRESS;
  }
  return RATE_LIMITS.DEFAULT;
}

/**
 * Middleware for API routes with error handling, rate limiting, and security headers
 */
export async function apiMiddleware(request: NextRequest, handler: () => Promise<NextResponse>) {
  const startTime = Date.now();
  const { pathname } = request.nextUrl;
  
  try {
    // Request validation - check for suspicious headers or paths
    const suspiciousHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-forwarded-host',
      'x-originating-ip',
      'x-remote-ip',
      'x-remote-addr'
    ];
    
    // Check for multiple proxy headers that might indicate IP spoofing
    const proxyHeaderCount = suspiciousHeaders.filter((header: any) => 
      request.headers.get(header)
    ).length;
    
    // Check for common legitimate proxy combinations
    const headers = Array.from(request.headers.entries()).filter(([key]: any) => 
      suspiciousHeaders.includes(key.toLowerCase())
    );
    
    const headerKeys = headers.map(([key]: any) => key.toLowerCase());
    
    // Common legitimate combinations from hosting providers (Vercel, Cloudflare, etc.)
    const legitimateCombinations = [
      ['x-forwarded-for', 'x-forwarded-host'], // Vercel standard
      ['x-forwarded-for', 'x-forwarded-host', 'x-real-ip'], // Vercel with additional headers
      ['x-forwarded-for', 'cf-connecting-ip'], // Cloudflare
      ['x-forwarded-for', 'x-forwarded-proto'], // Standard proxy
    ];
    
    // Check if the current combination matches any legitimate pattern
    const isLegitimateCombination = legitimateCombinations.some(legitCombo => 
      legitCombo.every(header => headerKeys.includes(header)) || 
      headerKeys.every(header => legitCombo.includes(header))
    );
    
    // Only flag as suspicious if:
    // 1. More than 4 proxy headers (higher threshold for legitimate use)
    // 2. OR it's not a recognized legitimate combination with more than 2 headers
    const isSuspicious = proxyHeaderCount > 4 || (proxyHeaderCount > 2 && !isLegitimateCombination);
    
    if (isSuspicious) {
      const error = new RateLimitError('请求被拒绝');
      logger.warn('Suspicious request detected', { 
        ip: request.ip || 'unknown',
        path: pathname,
        proxyHeaderCount,
        headerKeys,
        isLegitimateCombination,
        headers
      });
      
      return NextResponse.json(
        createErrorResponse(error),
        { status: 429 }
      );
    }
    
    // Validate request size
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      const maxSize = pathname.includes('/silent-start') ? 1024 * 1024 : 1024 * 100; // 1MB for task creation, 100KB for others
      
      if (size > maxSize) {
        const error = new ApplicationError('请求体过大', 'INVALID_INPUT', 413);
        logger.warn('Request size exceeded', { 
          ip: request.ip || 'unknown',
          path: pathname,
          size,
          maxSize
        });
        
        return NextResponse.json(
          createErrorResponse(error),
          { status: 413 }
        );
      }
    }
    
    // Apply rate limiting
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `${clientIp}:${pathname}`;
    const rateLimitConfig = getRateLimitConfig(pathname);
    
    const now = Date.now();
    const rateLimitData = rateLimitStore.get(rateLimitKey);
    
    if (!rateLimitData || now > rateLimitData.resetTime) {
      // New window
      rateLimitStore.set(rateLimitKey, {
        count: 1,
        resetTime: now + rateLimitConfig.windowMs
      });
    } else {
      // Increment count
      rateLimitData.count++;
      
      if (rateLimitData.count > rateLimitConfig.maxRequests) {
        const error = new RateLimitError('请求过于频繁，请稍后重试');
        logger.warn('Rate limit exceeded', { 
          ip: clientIp, 
          path: pathname,
          error: formatErrorForLogging(error)
        });
        
        return NextResponse.json(
          createErrorResponse(error),
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimitData.resetTime.toString(),
              'Retry-After': Math.ceil((rateLimitData.resetTime - now) / 1000).toString()
            }
          }
        );
      }
    }
    
    // Add security headers
    const securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Permitted-Cross-Domain-Policies': 'none',
      'X-Download-Options': 'noopen'
    };
    
    // Add CORS headers with proper origin validation
    const allowedOrigins = process.env.NEXT_PUBLIC_BASE_URL 
      ? [process.env.NEXT_PUBLIC_BASE_URL, 'http://localhost:3000']
      : ['http://localhost:3000'];
    
    const origin = request.headers.get('origin');
    const isAllowedOrigin = origin && allowedOrigins.includes(origin);
    
    const corsHeaders = request.method === 'OPTIONS' ? {
      ...(isAllowedOrigin ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    } : {};
    
    // Handle OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { 
        status: 200,
        headers: { ...securityHeaders, ...corsHeaders } as HeadersInit
      });
    }
    
    // Call the handler
    const response = await handler();
    
    // Add headers to response
    Object.entries(securityHeaders).forEach(([key, value]: any) => {
      response.headers.set(key, value);
    });
    
    // Add CORS headers for allowed origins only
    if (isAllowedOrigin && origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    
    // Add rate limit headers
    const currentRateLimit = rateLimitStore.get(rateLimitKey);
    if (currentRateLimit) {
      response.headers.set('X-RateLimit-Limit', rateLimitConfig.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', Math.max(0, rateLimitConfig.maxRequests - currentRateLimit.count).toString());
      response.headers.set('X-RateLimit-Reset', currentRateLimit.resetTime.toString());
    }
    
    // Add performance header
    const duration = Date.now() - startTime;
    response.headers.set('X-Response-Time', `${duration}ms`);
    
    return response;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const appError = error instanceof ApplicationError 
      ? error 
      : new ApplicationError(
          createSecureErrorMessage(error as Error),
          'INTERNAL_ERROR',
          500,
          { originalError: error }
        );
    
    logger.error('API middleware error:', new EnhancedError('API middleware error:', { 
      path: pathname,
      error: formatErrorForLogging(appError),
      duration 
     }));
    
    // Return error response
    return NextResponse.json(
      createErrorResponse(appError),
      { 
        status: appError.statusCode,
        headers: {
          'X-Response-Time': `${duration}ms`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  }
}

/**
 * Wrapper function to apply middleware to API routes
 */
export function withMiddleware(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    return apiMiddleware(request, () => handler(request));
  };
}