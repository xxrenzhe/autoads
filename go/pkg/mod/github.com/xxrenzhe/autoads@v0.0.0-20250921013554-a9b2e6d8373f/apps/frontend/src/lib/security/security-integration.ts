import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { suspiciousActivityDetector, UserActivity } from './suspicious-activity-detector';
// behaviorAnalysisService 体量较大且仅服务端使用，这里采用按需动态加载，避免预览/轻量构建时的静态引入
// Note: Real-time alert system has been removed for performance optimization
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('SecurityIntegrationMiddleware');

async function getBehaviorAnalysisService() {
  try {
    const mod = await import('./behavior-analysis-service');
    return mod.behaviorAnalysisService;
  } catch (e) {
    logger.warn('behaviorAnalysisService 动态加载失败，跳过行为分析');
    return null as any;
  }
}

export interface SecurityIntegrationOptions {
  enableSuspiciousDetection?: boolean;
  enableBehaviorAnalysis?: boolean;
  enableRealTimeAlerts?: boolean;
  riskThreshold?: number;
}

/**
 * 安全系统集成中间件
 * 整合可疑活动检测、行为分析和实时预警系统
 */
export function withSecurityIntegration(
  handler: (request: NextRequest, userId?: string, ...args: any[]) => Promise<NextResponse>,
  options: SecurityIntegrationOptions = {}
) {
  const {
    enableSuspiciousDetection = true,
    enableBehaviorAnalysis = true,
    enableRealTimeAlerts = true,
    riskThreshold = 70
  } = options;

  return async function(request: NextRequest, ...args: any[]): Promise<NextResponse> {
    const startTime = Date.now();
    const session = await auth();
    const userId = session?.user?.id;
  const ip = (request as any).ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const sessionId = request.headers.get('x-session-id') || generateSessionId();

    try {
      // 1. 记录用户活动
      if (userId && enableSuspiciousDetection) {
        const activity: UserActivity = {
          userId,
          action: determineAction(request),
          resource: request.nextUrl.pathname,
          timestamp: new Date(),
          ip,
          userAgent,
          metadata: {
            method: request.method,
            sessionId,
            endpoint: request.nextUrl.pathname,
            query: Object.fromEntries(request.nextUrl.searchParams)
          }
        };

        // 异步记录活动，不阻塞请求
        suspiciousActivityDetector.logActivity(activity).catch(error => {
          logger.error('记录用户活动失败:', error as Error);
        });
      }

      // 2. 检查用户风险等级
      if (userId && enableBehaviorAnalysis) {
        try {
          const riskScore = await suspiciousActivityDetector.getUserRiskScore(userId);
          
          if (riskScore && riskScore.score >= riskThreshold) {
            // 高风险用户，触发预警 - alert system removed for performance optimization
            // if (enableRealTimeAlerts) {
//             //   await realTimeAlertSystem.processEvent({
//             //     userId,
//             //     event: 'high_risk_user',
//             //     metadata: {
//             //       score: riskScore.score,
//             //       level: riskScore.level,
//             //       factors: riskScore.factors
//             //     },
//             //     timestamp: new Date(),
//             //     context: { ip, userAgent, sessionId }
//             //   });
            // }

            // 可以根据风险等级采取不同措施
            if (riskScore.level === 'critical') {
              logger.warn(`高风险用户访问: ${userId}`, {
                score: riskScore.score,
                factors: riskScore.factors,
                endpoint: request.nextUrl.pathname
              });
            }
          }
        } catch (error) {
          logger.error('检查用户风险失败:', error as Error);
        }
      }

      // 3. 执行原始请求处理
      const response = await handler(request, userId, ...args);
      const responseTime = Date.now() - startTime;

      // 4. 记录响应时间和结果
      if (userId && enableSuspiciousDetection) {
        const resultActivity: UserActivity = {
          userId,
          action: response.ok ? 'request_success' : 'request_failed',
          resource: request.nextUrl.pathname,
          timestamp: new Date(),
          ip,
          userAgent,
          metadata: {
            method: request.method,
            sessionId,
            endpoint: request.nextUrl.pathname,
            responseTime,
            status: response.status,
            success: response.ok
          }
        };

        suspiciousActivityDetector.logActivity(resultActivity).catch(error => {
          logger.error('记录请求结果失败:', error as Error);
        });

        // 发送实时事件
        if (enableRealTimeAlerts) {
//           await realTimeAlertSystem.processEvent({
//             userId,
//             event: response.ok ? 'api_request' : 'api_error',
//             metadata: {
//               endpoint: request.nextUrl.pathname,
//               method: request.method,
//               responseTime,
//               status: response.status,
//               success: response.ok
//             },
//             timestamp: new Date(),
//             context: { ip, userAgent, sessionId }
//           });
        }
      }

      // 5. 在响应头中添加安全信息
      if (response.ok && userId) {
        try {
          const riskScore = await suspiciousActivityDetector.getUserRiskScore(userId);
          if (riskScore) {
            const headers = new Headers(response.headers);
            headers.set('X-User-Risk-Level', riskScore.level);
            headers.set('X-User-Risk-Score', riskScore.score.toString());
            return new NextResponse(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers
            });
          }
        } catch (error) {
          // 不影响正常响应
        }
      }

      return response;
    } catch (error) {
      // 记录错误事件
      if (userId && enableRealTimeAlerts) {
//         await realTimeAlertSystem.processEvent({
//           userId,
//           event: 'api_error',
//           metadata: {
//             endpoint: request.nextUrl.pathname,
//             method: request.method,
//             error: error instanceof Error ? error.message : String(error)
//           },
//           timestamp: new Date(),
//           context: { ip, userAgent, sessionId }
//         });
      }

      logger.error('安全集成中间件错误:', error as Error);
      throw error;
    }
  };
}

/**
 * 生成会话ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 根据请求确定操作类型
 */
function determineAction(request: NextRequest): string {
  const method = request.method;
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api/siterank')) {
    return `${method.toLowerCase()}_siterank`;
  } else if (pathname.startsWith('/api/batchopen')) {
    return `${method.toLowerCase()}_batchopen`;
  } else if (pathname.startsWith('/api/adscenter')) {
    return `${method.toLowerCase()}_adscenter`;
  } else if (pathname.startsWith('/api/user/subscription')) {
    return `${method.toLowerCase()}_subscription`;
  } else if (pathname.startsWith('/api/auth')) {
    return `${method.toLowerCase()}_auth`;
  }

  return `${method.toLowerCase()}_request`;
}

/**
 * 安全监控助手类
 */
export class SecurityMonitor {
  /**
   * 监控Token消耗
   */
  static async monitorTokenConsumption(
    userId: string,
    featureId: string,
    amount: number,
    metadata?: any
  ): Promise<void> {
    try {
      // 记录Token消耗事件
//       await realTimeAlertSystem.processEvent({
//         userId,
//         event: 'token_consumed',
//         metadata: {
//           featureId,
//           amount,
//           consumptionRate: metadata?.consumptionRate || 0,
//           balance: metadata?.balance || 0
//         },
//         timestamp: new Date()
//       });

      // 记录用户活动
      await suspiciousActivityDetector.logActivity({
        userId,
        action: 'token_consumed',
        resource: featureId,
        timestamp: new Date(),
        metadata: {
          amount,
          ...metadata
        }
      });
    } catch (error) {
      logger.error('监控Token消耗失败:', error as Error);
    }
  }

  /**
   * 监控批量操作
   */
  static async monitorBatchOperation(
    userId: string,
    operation: string,
    batchSize: number,
    metadata?: any
  ): Promise<void> {
    try {
      // 发送批量操作事件
//       await realTimeAlertSystem.processEvent({
//         userId,
//         event: 'batch_operation',
//         metadata: {
//           operation,
//           batchSize,
//           ...metadata
//         },
//         timestamp: new Date()
//       });

      // 记录用户活动
      await suspiciousActivityDetector.logActivity({
        userId,
        action: 'batch_operation',
        resource: operation,
        timestamp: new Date(),
        metadata: {
          batchSize,
          ...metadata
        }
      });
    } catch (error) {
      logger.error('监控批量操作失败:', error as Error);
    }
  }

  /**
   * 监控用户登录
   */
  static async monitorUserLogin(
    userId: string,
    metadata: {
      success: boolean;
      failedAttempts?: number;
      newDevice?: boolean;
      unusualLocation?: boolean;
      ip?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
//       await realTimeAlertSystem.processEvent({
//         userId,
//         event: 'user_login',
//         metadata,
//         timestamp: new Date(),
//         context: {
//           ip: metadata.ip,
//           userAgent: metadata.userAgent
//         }
//       });
    } catch (error) {
      logger.error('监控用户登录失败:', error as Error);
    }
  }

  /**
   * 获取用户安全报告
   */
  static async getUserSecurityReport(userId: string): Promise<{
    riskScore: any;
    behaviorProfile: any;
    recentAlerts: any;
    recommendations: string[];
  }> {
    try {
      const [riskScore, behaviorProfile, recentAlerts] = await Promise.all([
        suspiciousActivityDetector.getUserRiskScore(userId),
        (async () => {
          const svc = await getBehaviorAnalysisService();
          return svc ? svc.analyzeUserBehavior(userId) : null;
        })(),
        suspiciousActivityDetector.getUserAlerts(userId, 10)
      ]);

      const recommendations: string[] = [];

      // 基于风险等级生成建议
      if (riskScore) {
        if (riskScore.level === 'critical') {
          recommendations.push('建议立即检查账户安全设置');
          recommendations.push('考虑启用双因素认证');
        } else if (riskScore.level === 'high') {
          recommendations.push('建议修改密码');
          recommendations.push('检查最近的登录记录');
        }
      }

      // 基于行为模式生成建议
      if (behaviorProfile) {
        if (behaviorProfile.riskLevel === 'high') {
          recommendations.push('注意使用频率，避免过度使用');
        }
        
        if (behaviorProfile.typicalUsageHours.includes(3) || 
            behaviorProfile.typicalUsageHours.includes(4)) {
          recommendations.push('建议避免在凌晨时段使用');
        }
      }

      return {
        riskScore,
        behaviorProfile,
        recentAlerts,
        recommendations
      };
    } catch (error) {
      logger.error('获取用户安全报告失败:', error as Error);
      return {
        riskScore: null,
        behaviorProfile: null,
        recentAlerts: [],
        recommendations: []
      };
    }
  }
}

/**
 * 自动化安全检查装饰器
 */
export function withSecurityCheck(eventType: string, metadataExtractor?: (args: any[]) => any) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const userId = (this as any).userId || args[0]?.userId;
      
      if (!userId) {
        return originalMethod.apply(this, args);
      }

      const metadata = metadataExtractor ? metadataExtractor(args) : {};
      const ip = args[0]?.ip || 'unknown';
      const userAgent = args[0]?.userAgent || 'unknown';

      try {
        // 执行前检查
        const riskScore = await suspiciousActivityDetector.getUserRiskScore(userId);
        
        if (riskScore && riskScore.level === 'critical') {
          throw new Error('账户已被临时限制，请联系客服');
        }

        // 执行原方法
        const result = await originalMethod.apply(this, args);

        // 记录成功事件
//         await realTimeAlertSystem.processEvent({
//           userId,
//           event: eventType,
//           metadata: {
//             success: true,
//             ...metadata
//           },
//           timestamp: new Date(),
//           context: { ip, userAgent }
//         });

        return result;
      } catch (error) {
        // 记录失败事件
//         await realTimeAlertSystem.processEvent({
//           userId,
//           event: `${eventType}_error`,
//           metadata: {
//             success: false,
//             error: error instanceof Error ? error.message : String(error),
//             ...metadata
//           },
//           timestamp: new Date(),
//           context: { ip, userAgent }
//         });

        throw error;
      }
    };

    return descriptor;
  };
}
