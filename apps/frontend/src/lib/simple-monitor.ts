import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from './utils/security/secure-logger';
import { getOrCreateRequestId } from './request-id';
import { eventBus, emitApiCall, emitTokenConsumed, emitFeatureUsage } from './simple-event-bus';

const logger = createLogger('SimpleMonitor');

// 统一的监控指标接口
interface MonitorMetrics {
  // API统计
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  
  // 按功能统计
  featureStats: {
    siterank: { requests: number; tokens: number; };
    batchopen: { requests: number; tokens: number; };
    adscenter: { requests: number; tokens: number; };
  };
  
  // 按状态码统计
  statusCodes: Record<number, number>;
  
  // 时间统计
  lastUpdated: Date;
}

// 简化的监控器
export class SimpleMonitor {
  private metrics: MonitorMetrics = {
    totalRequests: 0,
    totalErrors: 0,
    averageResponseTime: 0,
    featureStats: {
      siterank: { requests: 0, tokens: 0 },
      batchopen: { requests: 0, tokens: 0 },
      adscenter: { requests: 0, tokens: 0 }
    },
    statusCodes: {},
    lastUpdated: new Date()
  };
  
  private responseTimes: number[] = [];
  private readonly maxResponseTimes = 1000;
  private readonly slowResponseThreshold = 2000;

  // 记录API调用
  recordApiCall(
    request: NextRequest,
    response: NextResponse,
    responseTime: number,
    userId?: string,
    feature?: 'siterank' | 'batchopen' | 'adscenter',
    tokensUsed?: number
  ): void {
    const url = new URL(request.url);
    const endpoint = url.pathname;
    const method = request.method;
    const statusCode = response.status;

    // 更新基本统计
    this.metrics.totalRequests++;
    this.metrics.lastUpdated = new Date();
    
    // 记录响应时间
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }
    
    // 计算平均响应时间
    this.metrics.averageResponseTime = Math.round(
      this.responseTimes.reduce((a, b: any) => a + b, 0) / this.responseTimes.length
    );

    // 记录状态码
    this.metrics.statusCodes[statusCode] = (this.metrics.statusCodes[statusCode] || 0) + 1;

    // 记录错误
    if (statusCode >= 400) {
      this.metrics.totalErrors++;
    }

    // 记录功能使用
    if (feature) {
      this.metrics.featureStats[feature].requests++;
      
      if (tokensUsed) {
        this.metrics.featureStats[feature].tokens += tokensUsed;
      }
    }

    // 检查慢响应
    if (responseTime > this.slowResponseThreshold) {
      logger.warn('Slow API response', {
        endpoint,
        method,
        responseTime,
        threshold: this.slowResponseThreshold
      });
    }

    // 发出事件
    emitApiCall({
      endpoint,
      method,
      statusCode,
      responseTime,
      userId,
      feature
    });

    // 记录功能使用事件
    if (feature && userId) {
      emitFeatureUsage({
        userId,
        feature,
        endpoint
      });
    }
  }

  // 记录Token消耗
  recordTokenConsumption(
    userId: string,
    amount: number,
    feature: 'siterank' | 'batchopen' | 'adscenter',
    endpoint: string
  ): void {
    this.metrics.featureStats[feature].tokens += amount;
    
    emitTokenConsumed({
      userId,
      amount,
      feature,
      endpoint
    });
  }

  // 获取统计数据
  getStats(timeRange?: number): MonitorMetrics {
    // 返回指标的副本
    return {
      ...this.metrics,
      lastUpdated: new Date(this.metrics.lastUpdated)
    };
  }

  // 获取错误率
  getErrorRate(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return Math.round((this.metrics.totalErrors / this.metrics.totalRequests) * 10000) / 100;
  }

  // 获取热门端点
  getTopEndpoints(limit: number = 10): Array<{ endpoint: string; count: number }> {
    // 这里简化实现，实际应用中可能需要记录更多细节
    return [];
  }

  // 重置统计数据
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      featureStats: {
        siterank: { requests: 0, tokens: 0 },
        batchopen: { requests: 0, tokens: 0 },
        adscenter: { requests: 0, tokens: 0 }
      },
      statusCodes: {},
      lastUpdated: new Date()
    };
    this.responseTimes = [];
  }
}

// 全局监控器实例
export const simpleMonitor = new SimpleMonitor();

// 监控中间件
export function withSimpleMonitoring(
  handler: (req: NextRequest, userId?: string) => Promise<NextResponse>,
  options: {
    feature?: 'siterank' | 'batchopen' | 'adscenter';
    extractTokens?: (response: NextResponse) => number;
  } = {}
) {
  return async function(req: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();
    const requestId = getOrCreateRequestId(req.headers);
    
    // 尝试获取用户ID
    let userId: string | undefined;
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // 这里可以解析JWT获取用户ID
        // userId = parseUserIdFromToken(authHeader.substring(7));
      }
    } catch (error) {
      // 忽略认证错误
    }

    try {
      const response = await handler(req, userId);
      const responseTime = Date.now() - startTime;

      // 提取Token消耗
      let tokensUsed = 0;
      if (options.extractTokens) {
        tokensUsed = options.extractTokens(response);
      }

      // 记录API调用
      simpleMonitor.recordApiCall(
        req, 
        response, 
        responseTime, 
        userId, 
        options.feature,
        tokensUsed
      );

      // 添加监控头
      response.headers.set('x-request-id', requestId);
      response.headers.set('x-response-time', responseTime.toString());

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // 记录错误
      simpleMonitor.recordApiCall(
        req, 
        new NextResponse(null, { status: 500 }), 
        responseTime, 
        userId, 
        options.feature
      );

      logger.error('Request failed', {
        requestId,
        endpoint: req.nextUrl.pathname,
        method: req.method,
        duration: responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // 返回错误响应
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
          requestId
        },
        { 
          status: 500,
          headers: {
            'x-request-id': requestId,
            'x-response-time': responseTime.toString()
          }
        }
      );
    }
  };
}