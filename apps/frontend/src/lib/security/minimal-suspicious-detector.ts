import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('MinimalSuspiciousDetector');

export interface UserEvent {
  userId: string;
  action: string;
  endpoint: string;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
  metadata?: {
    success?: boolean;
    error?: string;
    batchSize?: number;
    [key: string]: any;
  };
}

export interface SuspiciousEvent {
  id: string;
  userId: string;
  type: 'automation_tool' | 'brute_force' | 'abnormal_token_consumption' | 'suspicious_ip_rotation';
  details: UserEvent;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

/**
 * 极简可疑行为检测器
 * 只检测4种明确的异常模式，不影响正常使用
 */
export class MinimalSuspiciousDetector {
  private static instance: MinimalSuspiciousDetector;
  
  // 配置阈值
  private config = {
    // 暴力破解：5分钟内失败50次
    bruteForce: {
      windowMs: 5 * 60 * 1000,
      maxFailures: 50
    },
    // IP轮换：1小时内20个不同IP
    ipRotation: {
      windowMs: 60 * 60 * 1000,
      maxIPs: 20
    },
    // 异常token消耗：每分钟1000个（非批量操作）
    tokenConsumption: {
      windowMs: 60 * 1000,
      maxTokensPerMinute: 1000
    },
    // 自动化工具检测
    automationTools: [
      'curl/',
      'wget/',
      'python-requests',
      'postmanruntime',
      'axios/',
      'node-fetch',
      'java/',
      'okhttp'
    ]
  };

  constructor() {
    // 启动清理任务
    this.startCleanupTask();
  }

  static getInstance(): MinimalSuspiciousDetector {
    if (!MinimalSuspiciousDetector.instance) {
      MinimalSuspiciousDetector.instance = new MinimalSuspiciousDetector();
    }
    return MinimalSuspiciousDetector.instance;
  }

  /**
   * 记录用户事件（异步，不阻塞请求）
   */
  async recordEvent(event: UserEvent): Promise<void> {
    try {
      // 异步检测，不阻塞主流程
      this.detectSuspicious(event).catch(error => {
        logger.error('检测可疑行为失败:', error as Error);
      });
    } catch (error) {
      logger.error('记录事件失败:', error as Error);
    }
  }

  /**
   * 检测可疑行为
   */
  private async detectSuspicious(event: UserEvent): Promise<void> {
    // 并行检测4种模式
    const detections = [
      this.checkAutomationTool(event),
      this.checkBruteForce(event),
      this.checkAbnormalTokenConsumption(event),
      this.checkSuspiciousIPRotation(event)
    ];

    const results = await Promise.allSettled(detections);
    
    // 处理检测结果
    results.forEach((result, index: any) => {
      if (result.status === 'fulfilled' && result.value) {
        const types = ['automation_tool', 'brute_force', 'abnormal_token_consumption', 'suspicious_ip_rotation'];
        this.logSuspiciousEvent(event.userId, types[index] as any, event);
      }
    });
  }

  /**
   * 检测自动化工具
   */
  private async checkAutomationTool(event: UserEvent): Promise<boolean> {
    if (!event.userAgent) return false;

    const userAgent = event.userAgent.toLowerCase();
    
    // 检查是否包含自动化工具特征
    const isAutomationTool = this.config.automationTools.some(tool => 
      userAgent.includes(tool)
    );

    // 检查请求间隔（如果提供了时间戳）
    if (event.metadata?.requestInterval && event.metadata.requestInterval < 100) {
      return true;
    }

    return isAutomationTool;
  }

  /**
   * 检测暴力破解
   */
  private async checkBruteForce(event: UserEvent): Promise<boolean> {
    // 只检测失败事件
    if (event.metadata?.success !== false) return false;

    // 获取最近5分钟的失败次数
    const since = new Date(Date.now() - this.config.bruteForce.windowMs);
    
    const failureCount = await prisma.userEvent.count({
      where: {
        userId: event.userId,
        action: 'api_call',
        'metadata->>\'success\'': 'false',
        timestamp: { gte: since }
      }
    });

    return failureCount >= this.config.bruteForce.maxFailures;
  }

  /**
   * 检测异常token消耗或高频调用
   */
  private async checkAbnormalTokenConsumption(event: UserEvent): Promise<boolean> {
    // 跳过批量操作
    if (event.metadata?.batchSize && event.metadata.batchSize > 10) {
      return false;
    }

    // 获取最近1分钟的数据
    const since = new Date(Date.now() - this.config.tokenConsumption.windowMs);
    
    // 1. 检查真实的token消耗
    try {
      const tokenUsages = await prisma.token_usage?.findMany?.({
        where: {
          userId: event.userId,
          createdAt: { gte: since }
        },
        select: { amount: true }
      });

      const totalTokens = tokenUsages.reduce((sum: number, usage: any: any) => sum + (usage.amount || 0), 0);
      
      if (totalTokens >= this.config.tokenConsumption.maxTokensPerMinute) {
        return true;
      }
    } catch (error) {
      // 如果tokenUsage表不存在，继续检查API调用频率
      console.debug('TokenUsage table not available, checking API frequency');
    }
    
    // 2. 如果没有token数据，检查API调用频率
    const apiCalls = await prisma.userEvent.count({
      where: {
        userId: event.userId,
        action: 'api_call',
        timestamp: { gte: since },
        // 只检查消耗型API
        OR: [
          { endpoint: { contains: 'siterank' } },
          { endpoint: { contains: 'batchopen' } },
          { endpoint: { contains: 'adscenter' } }
        ]
      }
    });
    
    // 如果1分钟内调用超过60次，认为是异常
    const abnormalCallThreshold = 60;
    return apiCalls >= abnormalCallThreshold;
  }

  /**
   * 检测可疑IP轮换
   */
  private async checkSuspiciousIPRotation(event: UserEvent): Promise<boolean> {
    if (!event.ip) return false;

    // 获取最近1小时内的所有IP
    const since = new Date(Date.now() - this.config.ipRotation.windowMs);
    
    const events = await prisma.userEvent.findMany({
      where: {
        userId: event.userId,
        timestamp: { gte: since },
        ip: { not: null }
      },
      select: { ip: true }
    });

    const uniqueIPs = new Set((events.map((e: any) => e.ip).filter(Boolean));
    
    return uniqueIPs.size >= this.config.ipRotation.maxIPs;
  }

  /**
   * 记录可疑事件
   */
  private async logSuspiciousEvent(userId: string, type: SuspiciousEvent['type'], event: UserEvent): Promise<void> {
    try {
      // 检查是否已有未解决的相同类型事件
      const existingEvent = await prisma.suspiciousEvent.findFirst({
        where: {
          userId,
          type,
          resolved: false
        }
      });

      // 避免重复记录
      if (existingEvent) {
        // 更新最后检测时间
        await prisma.suspiciousEvent.update({
          where: { id: existingEvent.id },
          data: { timestamp: new Date() }
        });
        return;
      }

      // 创建新的可疑事件记录
      await prisma.suspiciousEvent.create({
        data: {
          userId,
          type,
          details: {
            action: event.action,
            endpoint: event.endpoint,
            userAgent: event.userAgent,
            ip: event.ip,
            metadata: event.metadata
          },
          timestamp: new Date()
        }
      });

      // 通知管理员（异步）
      this.notifyAdmin(type, userId, event).catch();
      
      logger.warn(`检测到可疑行为: ${type}`, { userId, type, endpoint: event.endpoint });
    } catch (error) {
      logger.error('记录可疑事件失败:', error as Error);
    }
  }

  /**
   * 通知管理员
   */
  private async notifyAdmin(type: string, userId: string, event: UserEvent): Promise<void> {
    // 这里可以集成邮件、Slack等通知方式
    // 目前只是记录日志
    logger.info('可疑行为通知', {
      type,
      userId,
      endpoint: event.endpoint,
      ip: event.ip,
      userAgent: event.userAgent?.substring(0, 100)
    });
  }

  /**
   * 获取用户的可疑事件
   */
  async getUserSuspiciousEvents(userId: string, limit: number = 10): Promise<SuspiciousEvent[]> {
    try {
      const events = await prisma.suspiciousEvent.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit
      });

      return events.map(((event: any) => ({
        id: event.id,
        userId: event.userId,
        type: event.type,
        details: event.details as UserEvent,
        timestamp: event.timestamp,
        resolved: event.resolved,
        resolvedAt: event.resolvedAt,
        resolvedBy: event.resolvedBy
      }));
    } catch (error) {
      logger.error('获取用户可疑事件失败:', error as Error);
      return [];
    }
  }

  /**
   * 获取所有未解决的可疑事件
   */
  async getUnresolvedEvents(limit: number = 50): Promise<SuspiciousEvent[]> {
    try {
      const events = await prisma.suspiciousEvent.findMany({
        where: { resolved: false },
        orderBy: { timestamp: 'desc' },
        take: limit,
        include: {
          user: {
            select: { email: true, name: true }
          }
        }
      });

      return events.map(((event: any) => ({
        id: event.id,
        userId: event.userId,
        type: event.type,
        details: event.details as UserEvent,
        timestamp: event.timestamp,
        resolved: event.resolved,
        resolvedAt: event.resolvedAt,
        resolvedBy: event.resolvedBy
      }));
    } catch (error) {
      logger.error('获取未解决事件失败:', error as Error);
      return [];
    }
  }

  /**
   * 解决可疑事件
   */
  async resolveEvent(eventId: string, resolvedBy: string, reason?: string): Promise<boolean> {
    try {
      await prisma.suspiciousEvent.update({
        where: { id: eventId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy
        }
      });

      logger.info(`可疑事件已解决: ${eventId}`, { resolvedBy, reason });
      return true;
    } catch (error) {
      logger.error('解决可疑事件失败:', error as Error);
      return false;
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
          prisma.userEvent.deleteMany({
            where: { timestamp: { lt: thirtyDaysAgo } }
          }),
          prisma.suspiciousEvent.deleteMany({
            where: { 
              timestamp: { lt: thirtyDaysAgo },
              resolved: true // 只清理已解决的
            }
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
export const minimalSuspiciousDetector = MinimalSuspiciousDetector.getInstance();