import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('SimpleSuspiciousDetector');

// 简化的风险等级
export type RiskLevel = 'normal' | 'suspicious' | 'dangerous';

export interface UserRiskInfo {
  userId: string;
  riskLevel: RiskLevel;
  riskScore: number;
  reasons: string[];
  lastUpdated: Date;
}

export interface SuspiciousEvent {
  userId: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  metadata?: any;
  timestamp: Date;
}

/**
 * 简化的可疑活动检测器
 * 只关注最核心的风险指标
 */
export class SimpleSuspiciousDetector {
  private static instance: SimpleSuspiciousDetector;
  
  // 配置阈值
  private config = {
    // 1小时内请求次数限制
    maxRequestsPerHour: {
      normal: 500,    // 正常用户
      suspicious: 1000, // 可疑
      dangerous: 2000  // 危险
    },
    // 批量操作大小限制
    maxBatchSize: 100,
    // 错误率阈值
    maxErrorRate: 0.3, // 30%
    // 不同IP数量阈值（24小时内）
    maxIPs: 5,
    // 凌晨时段活跃阈值
    nightHours: [2, 3, 4, 5], // 凌晨2-6点
    maxNightRequests: 50
  };

  constructor() {
    // 定期清理旧数据
    this.startCleanupTask();
  }

  static getInstance(): SimpleSuspiciousDetector {
    if (!SimpleSuspiciousDetector.instance) {
      SimpleSuspiciousDetector.instance = new SimpleSuspiciousDetector();
    }
    return SimpleSuspiciousDetector.instance;
  }

  /**
   * 记录用户活动并检测可疑行为
   */
  async recordActivity(userId: string, activity: {
    action: string;
    resource: string;
    ip?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      const now = new Date();
      
      // 1. 记录活动
      await prisma.userActivity.create({
        data: {
          userId,
          action: activity.action,
          resource: activity.resource,
          ip: activity.ip,
          userAgent: activity.userAgent,
          metadata: activity.metadata || {},
          timestamp: now
        }
      });

      // 2. 异步检测（不阻塞请求）
      this.detectSuspiciousActivity(userId).catch(error => {
        logger.error('检测可疑活动失败:', error as Error);
      });
    } catch (error) {
      logger.error('记录用户活动失败:', error as Error);
    }
  }

  /**
   * 检测用户可疑活动
   */
  private async detectSuspiciousActivity(userId: string): Promise<void> {
    try {
      // 获取最近1小时的活动
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const activities = await prisma.userActivity.findMany({
        where: {
          userId,
          timestamp: { gte: oneHourAgo }
        }
      });

      const riskFactors: string[] = [];
      let riskScore = 0;

      // 检测1: 请求频率过高
      if (activities.length > this.config.maxRequestsPerHour.normal) {
        riskFactors.push(`高频使用: ${activities.length}次/小时`);
        riskScore += 20;
        
        if (activities.length > this.config.maxRequestsPerHour.dangerous) {
          riskScore += 30;
        }
      }

      // 检测2: 批量操作异常
      const batchOps = activities.filter(((a: any) => 
        a.action.includes('batch') || 
        (a.metadata?.batchSize && a.metadata.batchSize > this.config.maxBatchSize)
      );
      if (batchOps.length > 0) {
        riskFactors.push('异常批量操作');
        riskScore += 25;
      }

      // 检测3: 错误率过高
      const errorOps = activities.filter(((a: any) => 
        a.action.includes('error') || a.action.includes('failed')
      );
      if (errorOps.length / activities.length > this.config.maxErrorRate) {
        riskFactors.push(`错误率过高: ${((errorOps.length / activities.length) * 100).toFixed(1)}%`);
        riskScore += 30;
      }

      // 检测4: 凌晨时段活跃
      const nightOps = activities.filter(((a: any) => {
        const hour = a.timestamp.getHours();
        return this.config.nightHours.includes(hour);
      });
      if (nightOps.length > this.config.maxNightRequests) {
        riskFactors.push('非正常时间活跃');
        riskScore += 15;
      }

      // 检测5: IP地址变化（获取24小时数据）
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dayActivities = await prisma.userActivity.findMany({
        where: {
          userId,
          timestamp: { gte: oneDayAgo }
        }
      });
      const uniqueIPs = new Set((dayActivities.map((a: any) => a.ip).filter(Boolean));
      if (uniqueIPs.size > this.config.maxIPs) {
        riskFactors.push(`IP地址频繁变更: ${uniqueIPs.size}个`);
        riskScore += 35;
      }

      // 更新用户风险等级
      await this.updateUserRisk(userId, riskScore, riskFactors);
    } catch (error) {
      logger.error('检测可疑活动失败:', error as Error);
    }
  }

  /**
   * 更新用户风险信息
   */
  private async updateUserRisk(userId: string, riskScore: number, factors: string[]): Promise<void> {
    try {
      const riskLevel: RiskLevel = 
        riskScore >= 80 ? 'dangerous' :
        riskScore >= 30 ? 'suspicious' : 'normal';

      await prisma.userRisk.upsert({
        where: { userId },
        update: {
          riskLevel,
          riskScore,
          factors,
          updatedAt: new Date()
        },
        create: {
          userId,
          riskLevel,
          riskScore,
          factors
        }
      });

      // 如果风险等级高，记录到可疑事件表
      if (riskLevel !== 'normal') {
        await prisma.suspiciousEvent.create({
          data: {
            userId,
            eventType: 'risk_level_change',
            severity: riskLevel === 'dangerous' ? 'high' : 'medium',
            message: `用户风险等级变为${riskLevel}，得分: ${riskScore}`,
            metadata: {
              riskScore,
              factors,
              previousLevel: 'normal' // 可以从历史记录获取
            },
            timestamp: new Date()
          }
        });
      }
    } catch (error) {
      logger.error('更新用户风险失败:', error as Error);
    }
  }

  /**
   * 获取用户风险信息
   */
  async getUserRisk(userId: string): Promise<UserRiskInfo | null> {
    try {
      const risk = await prisma.userRisk.findUnique({
        where: { userId }
      });

      if (!risk) return null as any;

      return {
        userId: risk.userId,
        riskLevel: risk.riskLevel,
        riskScore: risk.riskScore,
        reasons: risk.factors,
        lastUpdated: risk.updatedAt
      };
    } catch (error) {
      logger.error('获取用户风险失败:', error as Error);
      return null as any;
    }
  }

  /**
   * 获取高风险用户列表
   */
  async getHighRiskUsers(limit: number = 50): Promise<UserRiskInfo[]> {
    try {
      const risks = await prisma.userRisk.findMany({
        where: {
          riskLevel: { in: ['suspicious', 'dangerous'] }
        },
        orderBy: [
          { riskLevel: 'desc' },
          { riskScore: 'desc' }
        ],
        take: limit
      });

      return risks.map(((risk: any) => ({
        userId: risk.userId,
        riskLevel: risk.riskLevel,
        riskScore: risk.riskScore,
        reasons: risk.factors,
        lastUpdated: risk.updatedAt
      }));
    } catch (error) {
      logger.error('获取高风险用户失败:', error as Error);
      return [];
    }
  }

  /**
   * 记录可疑事件
   */
  async recordSuspiciousEvent(event: Omit<SuspiciousEvent, 'timestamp'>): Promise<void> {
    try {
      await prisma.suspiciousEvent.create({
        data: {
          ...event,
          timestamp: new Date()
        }
      });

      // 如果是高危事件，更新用户风险
      if (event.severity === 'high') {
        const currentRisk = await this.getUserRisk(event.userId);
        const additionalScore = event.severity === 'high' ? 40 : 20;
        const newScore = Math.min((currentRisk?.riskScore || 0) + additionalScore, 100);
        const newFactors = [...(currentRisk?.reasons || []), event.message];
        
        await this.updateUserRisk(event.userId, newScore, newFactors);
      }
    } catch (error) {
      logger.error('记录可疑事件失败:', error as Error);
    }
  }

  /**
   * 重置用户风险
   */
  async resetUserRisk(userId: string, reason?: string): Promise<void> {
    try {
      await prisma.userRisk.upsert({
        where: { userId },
        update: {
          riskLevel: 'normal',
          riskScore: 0,
          factors: [],
          updatedAt: new Date()
        },
        create: {
          userId,
          riskLevel: 'normal',
          riskScore: 0,
          factors: []
        }
      });

      // 记录重置事件
      await prisma.suspiciousEvent.create({
        data: {
          userId,
          eventType: 'risk_reset',
          severity: 'low',
          message: `用户风险已重置: ${reason || '管理员操作'}`,
          metadata: { reason },
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('重置用户风险失败:', error as Error);
    }
  }

  /**
   * 清理旧数据
   */
  private startCleanupTask(): void {
    // 每天清理一次30天前的数据
    setInterval(async () => {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        await Promise.all([
          prisma.userActivity.deleteMany({
            where: { timestamp: { lt: thirtyDaysAgo } }
          }),
          prisma.suspiciousEvent.deleteMany({
            where: { timestamp: { lt: thirtyDaysAgo } }
          })
        ]);

        logger.info('清理旧数据完成');
      } catch (error) {
        logger.error('清理旧数据失败:', error as Error);
      }
    }, 24 * 60 * 60 * 1000);
  }
}

// 导出单例
export const simpleSuspiciousDetector = SimpleSuspiciousDetector.getInstance();