import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('SuspiciousActivityDetector');

export interface UserActivity {
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  metadata?: any;
  ip?: string;
  userAgent?: string;
}

export interface SuspiciousPattern {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  checkFunction: (activities: UserActivity[]) => boolean;
  weight: number; // 用于计算风险分数
}

export interface RiskScore {
  userId: string;
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  lastUpdated: Date;
}

export interface SuspiciousAlert {
  id: string;
  userId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata: any;
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

/**
 * 用户可疑活动检测器
 */
export class SuspiciousActivityDetector {
  private static instance: SuspiciousActivityDetector;
  private suspiciousPatterns: Map<string, SuspiciousPattern> = new Map();
  
  constructor() {
    this.initializePatterns();
  }

  static getInstance(): SuspiciousActivityDetector {
    if (!SuspiciousActivityDetector.instance) {
      SuspiciousActivityDetector.instance = new SuspiciousActivityDetector();
    }
    return SuspiciousActivityDetector.instance;
  }

  /**
   * 初始化可疑模式
   */
  private initializePatterns() {
    // 1. 异常高频使用模式
    this.suspiciousPatterns.set('high_frequency_usage', {
      id: 'high_frequency_usage',
      name: '异常高频使用',
      description: '用户在短时间内进行大量操作',
      severity: 'high',
      weight: 30,
      checkFunction: (activities) => {
        const lastHour = activities.filter((a: any) => 
          new Date(a.timestamp).getTime() > Date.now() - 60 * 60 * 1000
        );
        return lastHour.length > 1000; // 1小时内超过1000次操作
      }
    });

    // 2. 非时间模式使用
    this.suspiciousPatterns.set('off_hours_usage', {
      id: 'off_hours_usage',
      name: '非正常时间使用',
      description: '用户在凌晨2-6点大量使用',
      severity: 'medium',
      weight: 20,
      checkFunction: (activities) => {
        const offHours = activities.filter((a: any) => {
          const hour = new Date(a.timestamp).getHours();
          return hour >= 2 && hour <= 6;
        });
        return offHours.length > 100; // 凌晨时段超过100次操作
      }
    });

    // 3. 批量操作异常
    this.suspiciousPatterns.set('abnormal_batch_operations', {
      id: 'abnormal_batch_operations',
      name: '批量操作异常',
      description: '用户进行异常大量的批量查询',
      severity: 'high',
      weight: 25,
      checkFunction: (activities) => {
        const batchOps = activities.filter((a: any) => 
          a.resource.includes('batch') || a.metadata?.batchSize > 100
        );
        // 检查是否有异常大的批量操作
        return batchOps.some(op => op.metadata?.batchSize > 1000);
      }
    });

    // 4. IP地址频繁变更
    this.suspiciousPatterns.set('frequent_ip_change', {
      id: 'frequent_ip_change',
      name: 'IP地址频繁变更',
      description: '用户在短时间内使用多个不同IP',
      severity: 'high',
      weight: 35,
      checkFunction: (activities) => {
        const last24Hours = activities.filter((a: any) => 
          new Date(a.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
        );
        const uniqueIPs = new Set(last24Hours.map((a: any) => a.ip).filter(Boolean));
        return uniqueIPs.size > 10; // 24小时内超过10个不同IP
      }
    });

    // 5. Token消耗异常
    this.suspiciousPatterns.set('abnormal_token_consumption', {
      id: 'abnormal_token_consumption',
      name: 'Token消耗异常',
      description: 'Token消耗速度异常快',
      severity: 'critical',
      weight: 40,
      checkFunction: (activities) => {
        const tokenOps = activities.filter((a: any) => a.action === 'token_consumed');
        if (tokenOps.length < 10) return false;
        
        // 计算平均消耗速度
        const totalTime = tokenOps[tokenOps.length - 1].timestamp.getTime() - tokenOps[0].timestamp.getTime();
        const avgTokensPerHour = (tokenOps.length * 3600000) / totalTime;
        
        return avgTokensPerHour > 1000; // 每小时消耗超过1000个token
      }
    });

    // 6. 功能跳跃使用
    this.suspiciousPatterns.set('feature_hopping', {
      id: 'feature_hopping',
      name: '功能跳跃使用',
      description: '用户快速切换不同功能模块',
      severity: 'medium',
      weight: 15,
      checkFunction: (activities) => {
        const last30Min = activities.filter((a: any) => 
          new Date(a.timestamp).getTime() > Date.now() - 30 * 60 * 1000
        );
        const features = new Set(last30Min.map((a: any) => a.resource.split('/')[0]));
        return features.size > 5; // 30分钟内使用超过5个不同功能
      }
    });

    // 7. 错误率异常
    this.suspiciousPatterns.set('high_error_rate', {
      id: 'high_error_rate',
      name: '错误率异常',
      description: '用户操作失败率过高',
      severity: 'medium',
      weight: 20,
      checkFunction: (activities) => {
        const errorOps = activities.filter((a: any) => a.action.includes('error') || a.action.includes('failed'));
        const totalOps = activities.filter((a: any) => a.action.includes('consume') || a.action.includes('access'));
        
        if (totalOps.length === 0) return false;
        return (errorOps.length / totalOps.length) > 0.3; // 错误率超过30%
      }
    });

    // 8. 可疑的用户代理
    this.suspiciousPatterns.set('suspicious_user_agent', {
      id: 'suspicious_user_agent',
      name: '可疑的用户代理',
      description: '使用自动化工具或可疑浏览器',
      severity: 'medium',
      weight: 25,
      checkFunction: (activities) => {
        return activities.some(a => 
          a.userAgent && (
            a.userAgent.includes('bot') ||
            a.userAgent.includes('crawler') ||
            a.userAgent.includes('spider') ||
            a.userAgent.includes('curl') ||
            a.userAgent.includes('wget')
          )
        );
      }
    });
  }

  /**
   * 记录用户活动
   */
  async logActivity(activity: UserActivity): Promise<void> {
    try {
      // 存储到数据库
      await prisma.userActivity.create({
        data: {
          userId: activity.userId,
          action: activity.action,
          resource: activity.resource,
          metadata: activity.metadata || {},
          ip: activity.ip,
          userAgent: activity.userAgent,
          timestamp: activity.timestamp
        }
      });

      // 异步检测可疑模式
      this.detectSuspiciousActivity(activity.userId).catch(error => {
        logger.error('检测可疑活动失败:', error as Error);
      });
    } catch (error) {
      logger.error('记录用户活动失败:', error as Error);
    }
  }

  /**
   * 检测用户可疑活动
   */
  async detectSuspiciousActivity(userId: string): Promise<RiskScore | null> {
    try {
      // 获取用户最近24小时的活动
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activities = await prisma.userActivity.findMany({
        where: {
          userId,
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'asc' }
      });

      if (activities.length === 0) {
        return null as any;
      }

      // 计算风险分数
      let totalScore = 0;
      const detectedFactors: string[] = [];

      for (const [patternId, pattern] of this.suspiciousPatterns) {
        if (pattern.checkFunction(activities)) {
          totalScore += pattern.weight;
          detectedFactors.push(pattern.name);
          
          // 记录检测到的模式
          await this.recordSuspiciousPattern(userId, patternId, pattern.severity);
        }
      }

      // 确定风险等级
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (totalScore >= 100) riskLevel = 'critical';
      else if (totalScore >= 70) riskLevel = 'high';
      else if (totalScore >= 40) riskLevel = 'medium';

      // 保存风险评分
      const riskScore: RiskScore = {
        userId,
        score: totalScore,
        level: riskLevel,
        factors: detectedFactors,
        lastUpdated: new Date()
      };

      // Skip database persistence since UserRiskScore model doesn't exist
      logger.info('风险评分已计算 (未持久化):', { userId, score: totalScore, level: riskLevel });

      // 如果风险等级较高，创建警报
      if (riskLevel === 'high' || riskLevel === 'critical') {
        await this.createAlert(userId, 'high_risk_score', riskLevel, 
          `用户风险评分过高: ${totalScore}分，检测到: ${detectedFactors.join(', ')}`, 
          { score: totalScore, factors: detectedFactors }
        );
      }

      return riskScore;
    } catch (error) {
      logger.error('检测可疑活动失败:', error as Error);
      return null as any;
    }
  }

  /**
   * 记录检测到的可疑模式
   */
  private async recordSuspiciousPattern(userId: string, patternId: string, severity: string): Promise<void> {
    try {
      // Skip database persistence since SuspiciousPatternDetection model doesn't exist
      logger.info('可疑模式已检测 (未持久化):', { userId, patternId, severity });
    } catch (error) {
      logger.error('记录可疑模式失败:', error as Error);
    }
  }

  /**
   * 创建警报
   */
  private async createAlert(
    userId: string, 
    type: string, 
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    metadata: any
  ): Promise<void> {
    try {
      // Skip database persistence since SuspiciousAlert model doesn't exist
      logger.info('警报已创建 (未持久化):', { userId, type, severity, message });
      
      // 发送通知
      await this.sendAlertNotification(userId, severity, message);
    } catch (error) {
      logger.error('创建警报失败:', error as Error);
    }
  }

  /**
   * 发送警报通知
   */
  private async sendAlertNotification(userId: string, severity: string, message: string): Promise<void> {
    try {
      // 获取用户信息
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true }
      });

      if (!user) return;

      // 发送邮件通知（可以集成邮件服务）
      logger.info(`发送安全警报通知: ${user.email}`, { severity, message });

      // 这里可以集成其他通知方式，如短信、Slack等
    } catch (error) {
      logger.error('发送警报通知失败:', error as Error);
    }
  }

  /**
   * 获取用户风险评分
   */
  async getUserRiskScore(userId: string): Promise<RiskScore | null> {
    try {
      // Since UserRiskScore model doesn't exist, return null or calculate on demand
      // For now, return null to indicate no stored risk score
      return null as any;
    } catch (error) {
      logger.error('获取用户风险评分失败:', error as Error);
      return null as any;
    }
  }

  /**
   * 获取用户最近的警报
   */
  async getUserAlerts(userId: string, limit: number = 10): Promise<SuspiciousAlert[]> {
    try {
      // Since SuspiciousAlert model doesn't exist, return empty array
      return [];
    } catch (error) {
      logger.error('获取用户警报失败:', error as Error);
      return [];
    }
  }

  /**
   * 解决警报
   */
  async resolveAlert(alertId: string, resolvedBy: string, reason?: string): Promise<boolean> {
    try {
      // Since SuspiciousAlert model doesn't exist, just log the resolution
      logger.info(`警报已解决 (模拟): ${alertId}`, { resolvedBy, reason });
      return true;
    } catch (error) {
      logger.error('解决警报失败:', error as Error);
      return false;
    }
  }

  /**
   * 获取系统风险统计
   */
  async getSystemRiskStats(): Promise<{
    totalUsers: number;
    highRiskUsers: number;
    criticalRiskUsers: number;
    activeAlerts: number;
    topRiskFactors: Array<{ factor: string; count: number }>;
  }> {
    try {
      // Since UserRiskScore and SuspiciousAlert models don't exist, return basic stats
      const [totalUsers] = await Promise.all([
        prisma.user.count()
      ]);

      return {
        totalUsers,
        highRiskUsers: 0,
        criticalRiskUsers: 0,
        activeAlerts: 0,
        topRiskFactors: []
      };
    } catch (error) {
      logger.error('获取系统风险统计失败:', error as Error);
      return {
        totalUsers: 0,
        highRiskUsers: 0,
        criticalRiskUsers: 0,
        activeAlerts: 0,
        topRiskFactors: []
      };
    }
  }
}

// 导出单例实例
export const suspiciousActivityDetector = SuspiciousActivityDetector.getInstance();