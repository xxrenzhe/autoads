import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/v5-config';

/**
 * HTTP Access Logging Middleware
 * 记录所有HTTP请求访问日志到stdout，包含用户身份信息
 */
export async function httpAccessLogger(request: NextRequest) {
  const start = Date.now();
  
  // 尝试获取用户身份信息
  let userId = 'anonymous';
  let sessionId = 'none';
  
  try {
    // 检查Authorization头
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionId = authHeader.substring(7);
    }
    
    // 对于API路由，尝试通过auth获取用户信息
    if (request.nextUrl.pathname.startsWith('/api/')) {
      try {
        const session = await auth();
        if (session?.user?.id) {
          userId = session.user.id;
          // sessionId = session.sessionId || sessionId; // Commented out as sessionId doesn't exist on Session type
        }
      } catch (error) {
        // 获取用户信息失败，保持anonymous
      }
    }
  } catch (error) {
    // 获取用户信息过程中出错，保持默认值
  }
  
  // 准备日志数据
  const logData = {
    type: 'access',
    method: request.method,
    url: request.url,
    path: request.nextUrl.pathname,
    query: Object.fromEntries(request.nextUrl.searchParams),
    userAgent: request.headers.get('user-agent') || '-',
    referer: request.headers.get('referer') || '-',
    ip: request.headers.get('x-forwarded-for') || 
         request.headers.get('x-real-ip') || 
         request.ip || 
         '-',
    userId,
    sessionId,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    deployment: process.env.DEPLOYMENT_ENV || 'unknown',
    // 请求特征
    isApi: request.nextUrl.pathname.startsWith('/api/'),
    isStatic: request.nextUrl.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$/i) !== null,
    // 安全相关
    hasAuth: !!request.headers.get('authorization'),
    hasCookie: !!request.headers.get('cookie'),
    origin: request.headers.get('origin'),
    host: request.headers.get('host'),
  };

  // 输出访问日志到stdout (JSON格式，便于日志收集)
  const accessLog = JSON.stringify(logData);
  
  // 根据环境决定输出方式
  if (process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production') {
    // Docker环境或生产环境：输出到stdout
    console.log(accessLog);
  } else {
    // 开发环境：格式化输出
    console.log(`[ACCESS] ${logData.method} ${logData.url} - ${logData.ip} [User: ${logData.userId}]`);
  }

  // 创建响应处理函数
  const response = NextResponse.next();
  
  // 在响应头中添加处理时间和用户信息
  response.headers.set('X-Response-Time', `${Date.now() - start}ms`);
  response.headers.set('X-User-ID', userId);
  
  return response;
}

/**
 * 包装Next.js API路由以记录访问日志
 */
export function withAccessLogger(handler: (request: NextRequest, ...args: any[]) => Promise<Response> | Response) {
  return async (request: NextRequest, ...args: any[]): Promise<Response> => {
    const start = Date.now();
    
    try {
      const response = await handler(request, ...args);
      const duration = Date.now() - start;
      
      // 记录成功响应
      const logData = {
        type: 'api-access',
        method: request.method,
        url: request.url,
        status: response.status,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown'
      };
      
      if (process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production') {
        console.log(JSON.stringify(logData));
      } else {
        console.log(`[API] ${logData.method} ${logData.url} - ${logData.status} (${logData.duration})`);
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      
      // 记录错误响应
      const logData = {
        type: 'api-error',
        method: request.method,
        url: request.url,
        status: 500,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown'
      };
      
      if (process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production') {
        console.error(JSON.stringify(logData));
      } else {
        console.error(`[API-ERROR] ${logData.method} ${logData.url} - ${logData.error} (${logData.duration})`);
      }
      
      throw error;
    }
  };
}