/**
 * 增强的访问日志和环境初始化中间件
 * 集成认证、速率限制、安全监控和性能优化
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from "@/lib/utils/security/secure-logger";

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

// 轻量 per-IP 限流（内存级，最终以 Go 判定为准）
// 注意：中间件运行于 Edge/无共享状态环境，以下实现仅作“尽力而为”的本地保护。
// 生产环境真实限流以 Go/Redis 为准。
type WindowEntry = { count: number; resetAt: number };
const ipBuckets: Map<string, WindowEntry> = new Map();
const RPM = Number(process.env.FRONTEND_LIGHT_RPM || '300');
const WINDOW_MS = 60_000; // 1 分钟

function ipRateLimited(ip: string): { limited: boolean; resetSec: number; remaining: number } {
  const now = Date.now();
  const entry = ipBuckets.get(ip);
  if (!entry || entry.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, resetSec: Math.ceil(WINDOW_MS / 1000), remaining: RPM - 1 };
  }
  if (entry.count >= RPM) {
    const remainingMs = Math.max(0, entry.resetAt - now);
    return { limited: true, resetSec: Math.ceil(remainingMs / 1000), remaining: 0 };
  }
  entry.count++;
  return { limited: false, resetSec: Math.ceil((entry.resetAt - now) / 1000), remaining: RPM - entry.count };
}

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
  if (path.includes('/adscenter') || path.includes('/changelink')) return 'adscenter';
  if (path.includes('/token')) return 'token';
  if (path.includes('/user')) return 'user';
  if (path.includes('/admin')) return 'admin';
  return 'unknown';
}

export async function middleware(request: NextRequest) {
  const start = Date.now();
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith('/api/');
  const isGoProxy = pathname.startsWith('/go/');

  // 统一管理台入口：
  // - 所有 /admin/* 直接 308 到 /console/*（避免 Cloudflare 拦截 /admin）
  // - 所有 /console/* 在边缘层改写到 /ops/console/*，由 /ops 反代到 Go 后端
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const url = new URL(request.url);
    url.pathname = '/console' + pathname.substring('/admin'.length);
    return NextResponse.redirect(url, 308);
  }
  if (pathname === '/console' || pathname.startsWith('/console/')) {
    const url = new URL(request.url);
    url.pathname = '/ops' + pathname;
    return NextResponse.rewrite(url);
  }

  // 将所有 /api/admin/* 在边缘层重写到 /ops/api/v1/console/*，不经过本地 Next 路由
  if (pathname.startsWith('/api/admin/')) {
    const url = new URL(request.url);
    const rest = pathname.replace('/api/admin', '');
    url.pathname = `/ops/api/v1/console${rest}`;
    return NextResponse.rewrite(url);
  }

  // 轻量 per-IP 保护：仅针对 Next 自身 API 路由，跳过 /go/* 以避免与后端限流重复
  if (isApiRoute && !isGoProxy) {
    const ip = (request as any).ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rl = ipRateLimited(String(ip));
    if (rl.limited) {
      return new NextResponse(
        JSON.stringify({ code: 429, message: 'Too many requests (frontend light limit)' }),
        { status: 429, headers: { 'content-type': 'application/json', 'Retry-After': String(rl.resetSec), 'X-RateLimit-Limit': String(RPM), 'X-RateLimit-Remaining': String(rl.remaining) } }
      );
    }
  }
  // 路由改名：/changelink -> /adscenter（保持向后兼容）
  if (!isApiRoute && pathname.startsWith('/changelink')) {
    const target = new URL(request.url);
    target.pathname = pathname.replace('/changelink', '/adscenter');
    return NextResponse.redirect(target, 301);
  }

  // 将核心写路径统一切换至 Go 原子端点（同源 /go/* 反代注入内部JWT/幂等/链路头）
  // 仅针对 siterank/batchopen/adscenter 三大模块，避免误伤其他 Next 自身 API
  if (
    pathname.startsWith('/api/siterank') || pathname.startsWith('/api/batchopen') || pathname.startsWith('/api/adscenter') ||
    pathname.startsWith('/api/v1/siterank') || pathname.startsWith('/api/v1/batchopen') || pathname.startsWith('/api/v1/adscenter')
  ) {
    const url = new URL(request.url);
    // 精准映射到 Go 的 :check/:execute 原子端点（已实现的路径）
    if (pathname === '/api/siterank/batch' && request.method === 'POST') {
      url.pathname = '/go/api/v1/siterank/batch:execute';
      return NextResponse.rewrite(url);
    }
    // 单域名 rank 查询：使用 Go 的兼容端点（非 v1）
    if (pathname === '/api/siterank/rank' && request.method === 'GET') {
      url.pathname = '/go/api/siterank/rank';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/api/batchopen/silent-start' && request.method === 'POST') {
      url.pathname = '/go/api/v1/batchopen/silent:execute';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/api/batchopen/silent-progress' && request.method === 'GET') {
      const id = url.searchParams.get('taskId') || url.searchParams.get('task_id');
      if (id) {
        url.pathname = `/go/api/v1/batchopen/tasks/${id}`;
        // 移除冗余参数
        url.searchParams.delete('taskId');
        url.searchParams.delete('task_id');
        return NextResponse.rewrite(url);
      }
    }
    // 其余写路径统一走 /go 反代，让后端按原子端点/旧端点做兼容
    if (pathname.startsWith('/api/v1/')) {
      url.pathname = '/go' + pathname;
    } else if (pathname.startsWith('/api/')) {
      url.pathname = '/go' + pathname.replace('/api/', '/api/v1/');
    } else {
      url.pathname = '/go' + pathname;
    }
    return NextResponse.rewrite(url);
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
                   (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true');
  
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
        !['/api/auth', '/api/health', '/api/metrics'].some(p => path.startsWith(p))) {
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

  // 注入/透传 X-Request-Id，贯穿链路
  const reqId = request.headers.get('x-request-id') || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  // 将安全事件写入“请求头”，供后续 Route Handler 读取
  const requestHeaders = new Headers(request.headers);
  if (securityHeader) {
    requestHeaders.set('x-security-event', securityHeader);
  }
  requestHeaders.set('x-request-id', reqId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // 管理网关响应禁止收录
  if (pathname.startsWith('/ops/')) {
    try { response.headers.set('X-Robots-Tag', 'noindex, nofollow') } catch {}
  }
  response.headers.set('x-response-time', responseTime.toString());
  try { response.headers.set('x-request-id', reqId); } catch {}
  return response;
}

export const config = {
  matcher: [
    // 匹配所有路由，包括页面路由和API路由
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
