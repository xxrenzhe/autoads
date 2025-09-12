import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { createCategoryLogger } from '@/lib/utils/centralized-logging';

const apiLogger = createCategoryLogger('APIRequestLogger');

/**
 * 增强的API请求日志中间件
 * 记录所有API请求的详细信息，包括用户身份、请求参数和响应结果
 */
export async function logApiRequest(
  request: NextRequest,
  handler: (req: NextRequest, context: any) => Promise<NextResponse>,
  context: any = {}
): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // 获取用户信息
  let userId = 'anonymous';
  try {
    const session = await auth();
    if (session?.user?.id) {
      userId = session.user.id;
    }
  } catch (error) {
    // 获取用户信息失败，使用anonymous
  }

  // 记录请求开始
  apiLogger.info('API Request Started', {
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '-',
    userId,
    requestId,
    timestamp: new Date().toISOString(),
    // 记录查询参数
    query: Object.fromEntries(new URL(request.url).searchParams),
    // 记录请求头（排除敏感信息）
    headers: {
      'content-type': request.headers.get('content-type'),
      'authorization': request.headers.get('authorization') ? '[REDACTED]' : undefined,
      'user-agent': request.headers.get('user-agent'),
    }
  });

  try {
    // 执行处理器
    const response = await handler(request, context);
    const duration = Date.now() - startTime;

    // 获取响应数据
    let responseData: any = null;
    let responseSize = 0;
    
    try {
      // 克隆响应以读取数据
      const clonedResponse = response.clone();
      responseData = await clonedResponse.json();
      responseSize = JSON.stringify(responseData).length;
    } catch (error) {
      // 无法解析响应体，可能是流或其他格式
    }

    // 记录成功响应
    apiLogger.info('API Request Completed', {
      method: request.method,
      url: request.url,
      status: response.status,
      duration: `${duration}ms`,
      responseSize: `${responseSize} bytes`,
      userId,
      requestId,
      timestamp: new Date().toISOString(),
      // 记录响应摘要（避免记录敏感数据）
      responseSummary: responseData ? {
        success: responseData.success,
        data: responseData.data ? typeof responseData.data : undefined,
        error: responseData.error,
        metadata: {
          hasData: !!responseData.data,
          hasError: !!responseData.error,
        }
      } : null
    });

    // 添加请求ID到响应头
    response.headers.set('X-Request-ID', requestId);
    response.headers.set('X-Response-Time', `${duration}ms`);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // 记录错误响应
    apiLogger.error('API Request Failed', error instanceof Error ? error : new Error(String(error)), {
      method: request.method,
      url: request.url,
      status: 500,
      duration: `${duration}ms`,
      userId,
      requestId,
      timestamp: new Date().toISOString(),
      errorDetails: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    });

    throw error;
  }
}

/**
 * 创建带日志记录的API处理器包装器
 */
export function withApiLogging(
  handler: (req: NextRequest, context: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: any): Promise<NextResponse> => {
    return logApiRequest(request, handler, context);
  };
}