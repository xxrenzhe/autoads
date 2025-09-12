import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { minimalSuspiciousDetector, UserEvent } from './minimal-suspicious-detector';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('MinimalSecurityMiddleware');

export interface MinimalSecurityOptions {
  enableEventTracking?: boolean;
  trackSuccess?: boolean;
  trackErrors?: boolean;
}

/**
 * 极简安全中间件
 * 只记录事件，不限制任何操作
 */
export function withMinimalSecurity(
  handler: (request: NextRequest, userId?: string, ...args: any[]) => Promise<NextResponse>,
  options: MinimalSecurityOptions = {}
) {
  const {
    enableEventTracking = true,
    trackSuccess = true,
    trackErrors = true
  } = options;

  return async function(request: NextRequest, ...args: any[]): Promise<NextResponse> {
    const startTime = Date.now();
    const session = await auth();
    const userId = session?.user?.id;
    
    try {
      // 执行请求处理
      const response = await handler(request, userId, ...args);
      const responseTime = Date.now() - startTime;

      // 记录事件（异步，不阻塞响应）
      if (userId && enableEventTracking) {
        const shouldTrack = (response.ok && trackSuccess) || (!response.ok && trackErrors);
        
        if (shouldTrack) {
          const event: UserEvent = {
            userId,
            action: 'api_call',
            endpoint: request.nextUrl.pathname,
            userAgent: request.headers.get('user-agent') || undefined,
            ip: request.ip || request.headers.get('x-forwarded-for') || undefined,
            timestamp: new Date(),
            metadata: {
              method: request.method,
              responseTime,
              status: response.status,
              success: response.ok,
              error: response.ok ? undefined : `HTTP ${response.status}`
            }
          };

          // 异步记录，不阻塞
          minimalSuspiciousDetector.recordEvent(event).catch();
        }
      }

      return response;
    } catch (error) {
      // 记录错误事件
      if (userId && enableEventTracking && trackErrors) {
        const event: UserEvent = {
          userId,
          action: 'api_call',
          endpoint: request.nextUrl.pathname,
          userAgent: request.headers.get('user-agent') || undefined,
          ip: request.ip || request.headers.get('x-forwarded-for') || undefined,
          timestamp: new Date(),
          metadata: {
            method: request.method,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        };

        minimalSuspiciousDetector.recordEvent(event).catch();
      }

      logger.error('API错误:', error as Error);
      throw error;
    }
  };
}

/**
 * 手动记录事件的助手函数
 */
export class SecurityEventHelper {
  /**
   * 记录登录事件
   */
  static async recordLogin(
    userId: string,
    success: boolean,
    metadata: {
      ip?: string;
      userAgent?: string;
      error?: string;
    } = {}
  ): Promise<void> {
    const event: UserEvent = {
      userId,
      action: 'login',
      endpoint: '/api/auth/login',
      userAgent: metadata.userAgent,
      ip: metadata.ip,
      timestamp: new Date(),
      metadata: {
        success,
        error: metadata.error
      }
    };

    await minimalSuspiciousDetector.recordEvent(event);
  }

  /**
   * 记录Token消耗
   */
  static async recordTokenConsumption(
    userId: string,
    amount: number,
    metadata: {
      feature?: string;
      batchSize?: number;
    } = {}
  ): Promise<void> {
    const event: UserEvent = {
      userId,
      action: 'token_consumption',
      endpoint: '/api/token/consume',
      timestamp: new Date(),
      metadata: {
        amount,
        ...metadata
      }
    };

    await minimalSuspiciousDetector.recordEvent(event);
  }

  /**
   * 记录批量操作
   */
  static async recordBatchOperation(
    userId: string,
    operation: string,
    batchSize: number,
    metadata: any = {}
  ): Promise<void> {
    const event: UserEvent = {
      userId,
      action: 'batch_operation',
      endpoint: `/api/${operation}`,
      timestamp: new Date(),
      metadata: {
        operation,
        batchSize,
        ...metadata
      }
    };

    await minimalSuspiciousDetector.recordEvent(event);
  }
}