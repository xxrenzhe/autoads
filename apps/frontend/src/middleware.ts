/**
 * 增强的访问日志和环境初始化中间件
 * 集成认证、速率限制、安全监控和性能优化
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from "@/lib/utils/security/secure-logger";
import { auth } from "@/lib/auth/v5-config";
import { dbPool } from "@/lib/db-pool";
import { redisClient } from "@/lib/redis";

// 导入早期stdout捕获（确保在模块加载时立即执行）
import '@/lib/early-stdout-capture';

// 简单的事件队列（用于中间件环境）
const eventQueue: Array<() => Promise<void>> = [];

// 处理事件队列（在API路由中调用）
export async function processSecurityEventQueue() {
  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    if (event) {
      try {
        await event();
      } catch (error) {
        console.debug('Failed to process security event:', error);
      }
    }
  }
}

const logger = createLogger('AccessLogMiddleware');

// 全局变量，确保只初始化一次
let logRotationInitialized = false;

// 从请求中提取用户ID的辅助函数
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // 1. 尝试从Authorization头获取
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // 这里可以解析JWT token获取用户ID
      // 由于中间件限制，我们无法使用完整的auth逻辑
    }
    
    // 2. 尝试从cookie获取session
    const sessionCookie = request.cookies.get('next-auth.session-token') ||
                         request.cookies.get('__Secure-next-auth.session-token');
    
    if (sessionCookie) {
      // 注意：中间件中无法直接使用auth()函数
      // 这里只是示例，实际需要在API路由中处理
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// 异步记录安全事件（不阻塞请求）
async function recordSecurityEvent(request: NextRequest, userId: string | null, responseTime: number, response: NextResponse) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 只监控API路由
    if (!path.startsWith('/api/')) {
      return;
    }
    
    // 跳过一些非业务API
    const skippedPaths = [
      '/api/auth',
      '/api/admin/security-minimal', // 避免循环
      '/api/health',
      '/api/metrics'
    ];
    
    if (skippedPaths.some(skipPath => path.startsWith(skipPath))) {
      return;
    }
    
    // 在中间件环境中，我们只能将事件数据存储在请求头中
    // 让API路由来处理实际的记录逻辑
    const eventData = {
      userId: userId || 'anonymous',
      action: 'api_call' as const,
      endpoint: path,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: (request as any).ip || request.headers.get('x-forwarded-for') || undefined,
      timestamp: new Date().toISOString(),
      metadata: {
        method: request.method,
        responseTime,
        url: request.url,
        userAgent: request.headers.get('user-agent'),
        feature: getFeatureFromPath(path)
      }
    };
    
    // 将事件数据存储在响应头中，由API路由处理
    // 注意：这只是一个简化的实现，生产环境可能需要更复杂的方案
    response.headers.set('x-security-event', btoa(JSON.stringify(eventData)));
    
  } catch (error) {
    // 静默失败，不影响业务
    logger.debug('Security event recording failed', error instanceof Error ? error : new Error(String(error)));
  }
}

// 从路径推断功能类型
function getFeatureFromPath(path: string): string {
  if (path.includes('/siterank')) return 'siterank';
  if (path.includes('/batchopen')) return 'batchopen';
  if (path.includes('/changelink')) return 'changelink';
  if (path.includes('/token')) return 'token';
  if (path.includes('/user')) return 'user';
  if (path.includes('/admin')) return 'admin';
  return 'unknown';
}

export async function middleware(request: NextRequest) {
  const start = Date.now();
  const { pathname } = request.nextUrl;

  // 301 跳转到 www 子域（仅页面路由，避免影响 API/Cookies）
  const hostname = request.nextUrl.hostname;
  const isApiRoute = pathname.startsWith('/api/');
  if (!isApiRoute && (hostname === 'urlchecker.dev' || hostname === 'autoads.dev')) {
    const target = new URL(request.url);
    target.hostname = `www.${hostname}`;
    return NextResponse.redirect(target, 301);
  }

  // 管理员路由保护
  if (pathname.startsWith('/admin-dashboard') || pathname.startsWith('/api/admin')) {
    try {
      // 获取当前会话
      const session = await auth()
      
      // 如果没有会话或用户不是管理员，重定向到管理员登录页
      if (!session?.user || session.user.role !== 'ADMIN') {
        const signInUrl = new URL('/auth/admin-signin', request.url)
        signInUrl.searchParams.set('callbackUrl', pathname)
        
        return NextResponse.redirect(signInUrl)
      }
    } catch (error) {
      console.error('Admin middleware error:', error)
      
      // 发生错误时重定向到管理员登录页
      const signInUrl = new URL('/auth/admin-signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      signInUrl.searchParams.set('error', 'AuthError')
      
      return NextResponse.redirect(signInUrl)
    }
  }
  
  // 初始化日志轮转（只执行一次，且不在 Edge Runtime 中运行）
  if (!logRotationInitialized && 
      process.env.NODE_ENV === 'production' && 
      process.env.NEXT_RUNTIME !== 'edge') {
    try {
      const { logRotationManager } = await import('@/lib/log-rotation');
      logRotationManager.start();
      logRotationInitialized = true;
      logger.info('Log rotation manager initialized');
    } catch (error) {
      logger.error('Failed to initialize log rotation', error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  // 尝试获取用户ID（异步，不阻塞）
  const userIdPromise = getUserIdFromRequest(request);
  
  // 记录访问日志（生产环境和调试模式）
  const shouldLog = process.env.NODE_ENV === 'production' || 
                   process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
  
  if (shouldLog) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 判断请求类型
    const isApiRoute = path.startsWith('/api/');
    const isPageRoute = !isApiRoute && !path.startsWith('/_next') && !path.startsWith('/static');
    
    // 跳过静态资源和内部路由
    if (isApiRoute || isPageRoute) {
      logger.info('HTTP Request', {
        method: request.method,
        url: request.url,
        path: path,
        type: isApiRoute ? 'api' : 'page',
        userAgent: request.headers.get('user-agent'),
        ip: (request as any).ip || request.headers.get('x-forwarded-for') || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // 准备安全事件头（传递给后续 API 路由从请求头读取）
  const responseTime = Date.now() - start;
  const userId: string | null = null; // 中间件中不阻塞获取用户ID
  let securityHeader: string | null = null;
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith('/api/') &&
        !['/api/auth', '/api/admin/security-minimal', '/api/health', '/api/metrics'].some(p => path.startsWith(p))) {
      const eventData = {
        userId: userId || 'anonymous',
        action: 'api_call' as const,
        endpoint: path,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: (request as any).ip || request.headers.get('x-forwarded-for') || undefined,
        timestamp: new Date().toISOString(),
        metadata: {
          method: request.method,
          responseTime,
          url: request.url,
          userAgent: request.headers.get('user-agent'),
          feature: getFeatureFromPath(path)
        }
      };
      securityHeader = btoa(JSON.stringify(eventData));
    }
  } catch {}

  // 将安全事件写入“请求头”，供后续 Route Handler 读取
  const requestHeaders = new Headers(request.headers);
  if (securityHeader) {
    requestHeaders.set('x-security-event', securityHeader);
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-response-time', responseTime.toString());
  return response;
}

export const config = {
  matcher: [
    // 匹配所有路由，包括页面路由和API路由
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
