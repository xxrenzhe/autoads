import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { simpleSuspiciousDetector, RiskLevel } from './simple-suspicious-detector';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { prisma } from '@/lib/db';

const logger = createLogger('SimpleSecurityMiddleware');

export interface SimpleSecurityOptions {
  enableActivityTracking?: boolean;
  enableRiskCheck?: boolean;
  riskThreshold?: number; // 超过此分数禁止访问
  enableAutoRestrict?: boolean;
}

/**
 * 简化的安全中间件
 * 只保留核心功能：活动记录和风险检查
 */
export function withSimpleSecurity(
  handler: (request: NextRequest, userId?: string, ...args: any[]) => Promise<NextResponse>,
  options: SimpleSecurityOptions = {}
) {
  const {
    enableActivityTracking = true,
    enableRiskCheck = true,
    riskThreshold = 80,
    enableAutoRestrict = true
  } = options;

  return async function(request: NextRequest, ...args: any[]): Promise<NextResponse> {
    const startTime = Date.now();
    const session = await auth();
    const userId = session?.user?.id;
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
      // 1. 检查用户风险等级
      if (userId && enableRiskCheck) {
        const userRisk = await simpleSuspiciousDetector.getUserRisk(userId);
        
        if (userRisk && userRisk.riskScore >= riskThreshold) {
          logger.warn(`高风险用户访问被拒绝: ${userId}`, {
            riskScore: userRisk.riskScore,
            riskLevel: userRisk.riskLevel,
            endpoint: request.nextUrl.pathname
          });

          // 记录可疑事件
          await simpleSuspiciousDetector.recordSuspiciousEvent({
            userId,
            eventType: 'access_denied',
            severity: 'high',
            message: `高风险用户尝试访问: ${request.nextUrl.pathname}`,
            metadata: {
              riskScore: userRisk.riskScore,
              endpoint: request.nextUrl.pathname,
              ip,
              userAgent
            }
          });

          return NextResponse.json(
            { error: 'Access denied due to high risk activity' },
            { status: 403 }
          );
        }

        // 2. 检查用户限制
        if (enableAutoRestrict) {
          const hasRestriction = await checkUserRestriction(userId);
          if (hasRestriction) {
            return NextResponse.json(
              { error: 'Account temporarily restricted' },
              { status: 403 }
            );
          }
        }
      }

      // 3. 执行请求处理
      const response = await handler(request, userId, ...args);
      const responseTime = Date.now() - startTime;

      // 4. 记录用户活动
      if (userId && enableActivityTracking) {
        await simpleSuspiciousDetector.recordActivity(userId, {
          action: response.ok ? 'api_success' : 'api_error',
          resource: request.nextUrl.pathname,
          ip,
          userAgent,
          metadata: {
            method: request.method,
            responseTime,
            status: response.status,
            batchSize: await getBatchSize(request)
          }
        });
      }

      // 5. 在响应头中添加风险信息
      if (response.ok && userId) {
        const userRisk = await simpleSuspiciousDetector.getUserRisk(userId);
        if (userRisk) {
          const headers = new Headers(response.headers);
          headers.set('X-User-Risk-Level', userRisk.riskLevel);
          headers.set('X-User-Risk-Score', userRisk.riskScore.toString());
          return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
          });
        }
      }

      return response;
    } catch (error) {
      // 记录错误事件
      if (userId) {
        await simpleSuspiciousDetector.recordSuspiciousEvent({
          userId,
          eventType: 'system_error',
          severity: 'medium',
          message: `系统错误: ${error instanceof Error ? error.message : String(error)}`,
          metadata: {
            endpoint: request.nextUrl.pathname,
            ip,
            userAgent
          }
        });
      }

      logger.error('安全中间件错误:', error as Error);
      throw error;
    }
  };
}

/**
 * 检查用户限制
 */
async function checkUserRestriction(userId: string): Promise<boolean> {
  try {
    const now = new Date();
    
    // 查找用户的有效限制
    const restrictions = await prisma.userRestriction.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: {
          gte: now
        }
      }
    });
    
    // 如果有任何有效限制，返回 true
    return restrictions.length > 0;
  } catch (error) {
    logger.error('检查用户限制失败:', error as Error);
    // 出错时默认允许访问
    return false;
  }
}

/**
 * 获取批量操作大小
 */
async function getBatchSize(request: NextRequest): Promise<number> {
  try {
    if (request.method !== 'POST') return 0;
    
    const body = await request.clone().json();
    if (body.domains && Array.isArray(body.domains)) {
      return body.domains.length;
    }
    if (body.urls && Array.isArray(body.urls)) {
      return body.urls.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * 简化的安全监控助手
 */
export class SimpleSecurityMonitor {
  /**
   * 快速检查用户是否安全
   */
  static async isUserSafe(userId: string): Promise<{
    safe: boolean;
    riskLevel?: RiskLevel;
    riskScore?: number;
    reasons?: string[];
  }> {
    try {
      const risk = await simpleSuspiciousDetector.getUserRisk(userId);
      
      if (!risk) {
        return { safe: true };
      }

      return {
        safe: risk.riskLevel === 'normal' && risk.riskScore < 30,
        riskLevel: risk.riskLevel,
        riskScore: risk.riskScore,
        reasons: risk.reasons
      };
    } catch (error) {
      logger.error('检查用户安全状态失败:', error as Error);
      return { safe: true }; // 出错时默认允许
    }
  }

  /**
   * 记录自定义可疑事件
   */
  static async recordEvent(
    userId: string,
    eventType: string,
    message: string,
    severity: 'low' | 'medium' | 'high' = 'medium',
    metadata?: any
  ): Promise<void> {
    try {
      await simpleSuspiciousDetector.recordSuspiciousEvent({
        userId,
        eventType,
        severity,
        message,
        metadata
      });
    } catch (error) {
      logger.error('记录事件失败:', error as Error);
    }
  }

  /**
   * 限制用户
   */
  static async restrictUser(
    userId: string,
    type: 'api_limit' | 'batch_limit' | 'account_suspend' | 'login_block' | 'feature_access',
    reason: string,
    durationHours: number = 24
  ): Promise<void> {
    try {
      // 创建用户限制记录
      await prisma.userRestriction.create({
        data: {
          userId,
          type: type.toUpperCase() as any, // Convert to enum
          reason,
          expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000)
        }
      });

      // 记录事件
      await simpleSuspiciousDetector.recordSuspiciousEvent({
        userId,
        eventType: 'user_restricted',
        severity: 'high',
        message: `用户被限制: ${type} - ${reason}`,
        metadata: { type, reason, durationHours }
      });

      logger.info(`用户已限制: ${userId}`, { type, reason, durationHours });
    } catch (error) {
      logger.error('限制用户失败:', error as Error);
    }
  }

  /**
   * 解除用户限制
   */
  static async unrestrictUser(userId: string): Promise<void> {
    try {
      // 将用户的所有限制标记为非活跃
      await prisma.userRestriction.updateMany({
        where: {
          userId,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      logger.info(`用户限制已解除: ${userId}`);
    } catch (error) {
      logger.error('解除用户限制失败:', error as Error);
    }
  }

  /**
   * 获取用户当前所有限制
   */
  static async getUserRestrictions(userId: string): Promise<any[]> {
    try {
      const now = new Date();
      const restrictions = await prisma.userRestriction.findMany({
        where: {
          userId,
          isActive: true,
          expiresAt: {
            gte: now
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      return restrictions;
    } catch (error) {
      logger.error('获取用户限制失败:', error as Error);
      return [];
    }
  }

  /**
   * 检查用户是否有特定类型的限制
   */
  static async hasRestriction(
    userId: string, 
    type: 'api_limit' | 'batch_limit' | 'account_suspend' | 'login_block' | 'feature_access'
  ): Promise<boolean> {
    try {
      const now = new Date();
      const restriction = await prisma.userRestriction.findFirst({
        where: {
          userId,
          type: type.toUpperCase() as any,
          isActive: true,
          expiresAt: {
            gte: now
          }
        }
      });
      
      return !!restriction;
    } catch (error) {
      logger.error('检查用户特定限制失败:', error as Error);
      return false;
    }
  }
}