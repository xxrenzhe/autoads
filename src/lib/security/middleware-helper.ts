import { NextRequest } from 'next/server';
import { minimalSuspiciousDetector, UserEvent } from './minimal-suspicious-detector';

/**
 * 处理来自中间件的安全事件
 * API路由可以调用这个函数来处理中间件记录的事件
 */
export async function processSecurityEventFromHeader(request: NextRequest): Promise<void> {
  try {
    // 从请求头获取安全事件数据
    const securityEventData = request.headers.get('x-security-event');
    
    if (!securityEventData) {
      return;
    }
    
    // 解码事件数据
    const eventDataStr = atob(securityEventData);
    const eventData = JSON.parse(eventDataStr);
    
    // 转换为UserEvent格式
    const event: UserEvent = {
      userId: eventData.userId,
      action: eventData.action,
      endpoint: eventData.endpoint,
      userAgent: eventData.userAgent,
      ip: eventData.ip,
      timestamp: new Date(eventData.timestamp),
      metadata: {
        ...eventData.metadata,
        success: true, // 中间件只记录成功的请求
      }
    };
    
    // 记录事件
    await minimalSuspiciousDetector.recordEvent(event);
    
  } catch (error) {
    // 静默失败
    console.debug('Failed to process security event from header:', error);
  }
}

/**
 * API路由使用的安全监控包装器
 * 自动处理中间件传递的安全事件
 */
export function withSecurityMonitoring(
  handler: (request: NextRequest, ...args: any[]) => Promise<Response>
) {
  return async function(request: NextRequest, ...args: any[]): Promise<Response> {
    // 处理安全事件（异步，不阻塞）
    processSecurityEventFromHeader(request).catch();
    
    // 执行原始处理器
    return handler(request, ...args);
  };
}