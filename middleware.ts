import { NextRequest, NextResponse } from 'next/server';
import { getDomainConfig, detectEnvironment, isDomainAllowed } from '@/lib/domain-config';
import { httpAccessLogger } from '@/lib/middleware/http-access-logger';

export async function middleware(request: NextRequest) {
    // Handle OPTIONS requests for CORS preflight
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token',
                'Access-Control-Allow-Credentials': 'true',
            },
        });
    }

    // For API routes, apply HTTP access logging and handle CORS
    if (request.nextUrl.pathname.startsWith('/api/')) {
        // 记录API路由的HTTP访问日志
        httpAccessLogger(request);
        
        const response = NextResponse.next();
        
        // For auth routes, ensure proper CORS and cookie handling
        if (request.nextUrl.pathname.startsWith('/api/auth/')) {
            const origin = request.headers.get('origin');
            const host = request.headers.get('host');
            
            // Allow same-origin requests and configured origins
            if (origin && (origin.includes(host || '') || 
                          origin.includes('localhost') || 
                          origin.includes('autoads.dev') || 
                          origin.includes('urlchecker.dev') ||
                          origin.includes('www.urlchecker.dev'))) {
                response.headers.set('Access-Control-Allow-Origin', origin);
            }
            
            response.headers.set('Access-Control-Allow-Credentials', 'true');
            response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
            response.headers.set('Vary', 'Origin');
            
            // Ensure proper cache control for auth endpoints
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            response.headers.set('Pragma', 'no-cache');
        }
        
        return response;
    }
    
    // 记录HTTP访问日志（包含增强的用户信息）
    httpAccessLogger(request);
    
    const hostname = request.headers.get('host') || '';
    const url = request.nextUrl.clone();
    
    // 获取环境配置
    const config = getDomainConfig();
    const env = detectEnvironment();
    
    // 开发环境特殊处理
    if (env === 'development') {
        // 本地开发环境，跳过所有重定向
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
            console.log('[Middleware] Development localhost detected, skipping redirects:', hostname);
            const response = NextResponse.next();
            return response;
        }
    }
    
    // 检查是否已经是 HTTPS（通过代理或HSTS）
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const forwardedPort = request.headers.get('x-forwarded-port');
    const xForwardedSsl = request.headers.get('x-forwarded-ssl');
    
    // 由于HSTS，浏览器可能强制HTTPS但URL仍显示http:
    // 通过多个头部判断实际的协议
    const isSecure = forwardedProto === 'https' || 
                    forwardedPort === '443' ||
                    xForwardedSsl === 'on' ||
                    request.nextUrl.protocol === 'https:';
    
    // 移除所有域名重定向逻辑，允许所有访问
    // 域名验证已禁用，任何域名都可以访问
    
    // 移除所有 www 重定向逻辑，避免重定向循环
    
    // 移除 HTTPS 强制重定向，让代理处理 HTTPS
    // HTTPS 重定向现在由 ClawCloud 负载均衡器处理

    const response = NextResponse.next();

    // 设置环境信息
    response.cookies.set('deployment-version', env, {
        maxAge: 24 * 60 * 60 * 1000, // 24小时
        httpOnly: false,
        secure: config.secureCookies,
        sameSite: 'lax'
    });

    // 添加环境信息到响应头
    response.headers.set('x-environment', env);
    response.headers.set('x-deployment-domain', hostname);
    response.headers.set('x-is-local', config.isLocal.toString());
    response.headers.set('x-is-https', config.isHttps.toString());
    
    // 添加构建信息
    response.headers.set('x-build-hash', process.env.NEXT_PUBLIC_BUILD_HASH || 'unknown');
    response.headers.set('x-build-time', process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString());
    response.headers.set('x-deployment-platform', process.env.DEPLOYMENT_PLATFORM || 'unknown');
    response.headers.set('x-deployment-env', process.env.DEPLOYMENT_ENV || 'unknown');
    response.headers.set('x-deployment-domain', process.env.DEPLOYMENT_DOMAIN || 'unknown');

    // 添加安全头
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-Powered-By', 'AutoAds.dev');
    
    // 生产环境和预发环境添加 CSP
    if (!config.isLocal) {
        response.headers.set(
            'Content-Security-Policy',
            [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https: blob: https://www.google.com https://www.google-analytics.com",
                "font-src 'self'",
                "connect-src 'self' https://api.google.com https://accounts.google.com https://googleads.googleapis.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://www.urlchecker.dev https://urlchecker.dev https://autoads.dev https://www.autoads.dev https://ipapi.co",
                "frame-src 'self' https://accounts.google.com",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
            ].join('; ')
        );
    }

    // 为非生产版本添加特殊标识
    if (env !== 'production') {
        response.headers.set('x-version-warning', `This is a ${env} environment`);
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};