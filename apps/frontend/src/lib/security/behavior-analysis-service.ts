import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { suspiciousActivityDetector, UserActivity } from './suspicious-activity-detector';

const logger = createLogger('BehaviorAnalysisService');

export interface BehaviorPattern {
  id: string;
  name: string;
  description: string;
  category: 'usage' | 'timing' | 'sequence' | 'performance';
  analyzeFunction: (activities: UserActivity[]) => BehaviorAnalysisResult;
}

export interface BehaviorAnalysisResult {
  patternId: string;
  detected: boolean;
  confidence: number; // 0-1
  severity: 'low' | 'medium' | 'high' | 'critical';
  insights: string[];
  recommendations: string[];
  metadata?: Record<string, any>;
}

export interface UserBehaviorProfile {
  userId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  behaviorScore: number;
  patterns: {
    [patternId: string]: {
      frequency: number;
      lastDetected: Date;
      severity: string;
    };
  };
  typicalUsageHours: number[];
  averageSessionDuration: number;
  favoriteFeatures: string[];
  lastUpdated: Date;
}

export interface SessionAnalysis {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  actionsCount: number;
  featuresUsed: string[];
  navigationPath: string[];
  suspiciousActivities: BehaviorAnalysisResult[];
  riskScore: number;
}

/**
 * 用户行为分析服务
 * 提供深度的用户行为模式分析和画像构建
 */
export class BehaviorAnalysisService {
  private static instance: BehaviorAnalysisService;
  private behaviorPatterns: Map<string, BehaviorPattern> = new Map();
  private analysisCache = new Map<string, { data: UserBehaviorProfile; expires: number }>();

  constructor() {
    this.initializePatterns();
  }

  static getInstance(): BehaviorAnalysisService {
    if (!BehaviorAnalysisService.instance) {
      BehaviorAnalysisService.instance = new BehaviorAnalysisService();
    }
    return BehaviorAnalysisService.instance;
  }

  /**
   * 初始化行为模式
   */
  private initializePatterns() {
    // 1. 使用频率模式
    this.behaviorPatterns.set('usage_frequency', {
      id: 'usage_frequency',
      name: '使用频率分析',
      description: '分析用户的使用频率是否异常',
      category: 'usage',
      analyzeFunction: (activities) => {
        const last7Days = activities.filter(a => 
          new Date(a.timestamp).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
        );
        
        const dailyUsage = new Array(7).fill(0);
        last7Days.forEach(activity => {
          const dayIndex = Math.floor((Date.now() - new Date(activity.timestamp).getTime()) / (24 * 60 * 60 * 1000));
          if (dayIndex >= 0 && dayIndex < 7) {
            dailyUsage[6 - dayIndex]++;
          }
        });

        const avgDailyUsage = dailyUsage.reduce((a, b) => a + b, 0) / 7;
        const maxDailyUsage = Math.max(...dailyUsage);
        const usageVariance = dailyUsage.reduce((sum, usage) => sum + Math.pow(usage - avgDailyUsage, 2), 0) / 7;

        const detected = maxDailyUsage > avgDailyUsage * 3 || usageVariance > avgDailyUsage * 2;
        const confidence = Math.min((maxDailyUsage / (avgDailyUsage + 1)) / 3, 1);
        
        return {
          patternId: 'usage_frequency',
          detected,
          confidence,
          severity: detected && confidence > 0.7 ? 'high' : 'medium',
          insights: [
            `7日平均每日使用: ${avgDailyUsage.toFixed(1)}次`,
            `峰值日使用: ${maxDailyUsage}次`,
            `使用方差: ${usageVariance.toFixed(1)}`
          ],
          recommendations: detected ? [
            '监控该用户的异常使用高峰',
            '考虑是否需要限制使用频率'
          ] : [],
          metadata: { dailyUsage, avgDailyUsage, maxDailyUsage, usageVariance }
        };
      }
    });

    // 2. 时间模式分析
    this.behaviorPatterns.set('timing_pattern', {
      id: 'timing_pattern',
      name: '使用时间模式',
      description: '分析用户的使用时间是否异常',
      category: 'timing',
      analyzeFunction: (activities) => {
        const hourDistribution = new Array(24).fill(0);
        activities.forEach(activity => {
          const hour = new Date(activity.timestamp).getHours();
          hourDistribution[hour]++;
        });

        // 计算活跃时段
        const peakHours = hourDistribution
          .map((count, hour) => ({ hour, count }))
          .filter(item => item.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        // 检测夜间活跃（凌晨2-6点）
        const nightActivity = hourDistribution.slice(2, 7).reduce((a, b) => a + b, 0);
        const totalActivity = hourDistribution.reduce((a, b) => a + b, 0);
        const nightActivityRatio = totalActivity > 0 ? nightActivity / totalActivity : 0;

        const detected = nightActivityRatio > 0.3; // 30%以上活动在夜间
        const confidence = Math.min(nightActivityRatio * 2, 1);
        
        return {
          patternId: 'timing_pattern',
          detected,
          confidence,
          severity: detected && confidence > 0.5 ? 'medium' : 'low',
          insights: [
            `主要活跃时段: ${peakHours.map(h => `${h.hour}:00`).join(', ')}`,
            `夜间活动比例: ${(nightActivityRatio * 100).toFixed(1)}%`
          ],
          recommendations: detected ? [
            '关注用户的夜间使用行为',
            '考虑加强安全验证'
          ] : [],
          metadata: { hourDistribution, peakHours, nightActivityRatio }
        };
      }
    });

    // 3. 功能使用序列
    this.behaviorPatterns.set('feature_sequence', {
      id: 'feature_sequence',
      name: '功能使用序列',
      description: '分析用户的功能使用顺序是否合理',
      category: 'sequence',
      analyzeFunction: (activities) => {
        // 按时间排序活动
        const sortedActivities = [...activities]
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(-100); // 分析最近100个活动

        // 提取功能使用序列
        const featureSequence = sortedActivities
          .map(a => a.resource.split('/')[0])
          .filter((feature, index, arr) => feature && feature !== arr[index - 1]);

        // 检测快速切换
        let rapidSwitches = 0;
        for (let i = 1; i < sortedActivities.length; i++) {
          const timeDiff = new Date(sortedActivities[i].timestamp).getTime() - 
                          new Date(sortedActivities[i - 1].timestamp).getTime();
          if (timeDiff < 5000 && sortedActivities[i].resource !== sortedActivities[i - 1].resource) {
            rapidSwitches++;
          }
        }

        const detected = rapidSwitches > 20; // 20次快速切换
        const confidence = Math.min(rapidSwitches / 50, 1);
        
        return {
          patternId: 'feature_sequence',
          detected,
          confidence,
          severity: detected && confidence > 0.6 ? 'high' : 'medium',
          insights: [
            `快速切换次数: ${rapidSwitches}`,
            `主要使用功能: ${this.getMostFrequentFeatures(featureSequence, 3).join(', ')}`
          ],
          recommendations: detected ? [
            '用户可能在使用自动化工具',
            '建议进行人机验证'
          ] : [],
          metadata: { rapidSwitches, featureSequence: featureSequence.slice(-10) }
        };
      }
    });

    // 4. 性能异常模式
    this.behaviorPatterns.set('performance_anomaly', {
      id: 'performance_anomaly',
      name: '性能异常模式',
      description: '检测用户的操作响应时间异常',
      category: 'performance',
      analyzeFunction: (activities) => {
        const responseTimes = activities
          .filter(a => a.metadata && typeof a.metadata === 'object' && 'responseTime' in a.metadata)
          .map(a => (a.metadata as any).responseTime as number);

        if (responseTimes.length === 0) {
          return {
            patternId: 'performance_anomaly',
            detected: false,
            confidence: 0,
            severity: 'low',
            insights: ['无性能数据'],
            recommendations: []
          };
        }

        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxResponseTime = Math.max(...responseTimes);
        const slowResponses = responseTimes.filter(t => t > avgResponseTime * 2).length;
        
        const detected = slowResponses > responseTimes.length * 0.2; // 20%的请求响应异常慢
        const confidence = Math.min(slowResponses / responseTimes.length * 3, 1);
        
        return {
          patternId: 'performance_anomaly',
          detected,
          confidence,
          severity: detected && confidence > 0.5 ? 'medium' : 'low',
          insights: [
            `平均响应时间: ${avgResponseTime.toFixed(0)}ms`,
            `最大响应时间: ${maxResponseTime}ms`,
            `慢响应比例: ${(slowResponses / responseTimes.length * 100).toFixed(1)}%`
          ],
          recommendations: detected ? [
            '检查服务器性能',
            '优化数据库查询'
          ] : [],
          metadata: { avgResponseTime, maxResponseTime, slowResponses }
        };
      }
    });

    // 5. 错误模式分析
    this.behaviorPatterns.set('error_pattern', {
      id: 'error_pattern',
      name: '错误模式分析',
      description: '分析用户的错误类型和频率',
      category: 'usage',
      analyzeFunction: (activities) => {
        const errorActivities = activities.filter(a => 
          a.action.includes('error') || 
          a.action.includes('failed') ||
          (a.metadata && typeof a.metadata === 'object' && 'error' in a.metadata)
        );

        const totalActivities = activities.filter(a => 
          a.action.includes('consume') || 
          a.action.includes('access') ||
          a.action.includes('query')
        );

        if (totalActivities.length === 0) {
          return {
            patternId: 'error_pattern',
            detected: false,
            confidence: 0,
            severity: 'low',
            insights: ['无操作数据'],
            recommendations: []
          };
        }

        const errorRate = errorActivities.length / totalActivities.length;
        
        // 分析错误类型
        const errorTypes = new Map<string, number>();
        errorActivities.forEach(activity => {
          const errorType = (activity.metadata && typeof activity.metadata === 'object' && 'errorType' in activity.metadata) 
            ? (activity.metadata as any).errorType 
            : 'unknown';
          errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
        });

        const detected = errorRate > 0.1; // 错误率超过10%
        const confidence = Math.min(errorRate * 5, 1);
        
        return {
          patternId: 'error_pattern',
          detected,
          confidence,
          severity: detected && confidence > 0.7 ? 'high' : 'medium',
          insights: [
            `错误率: ${(errorRate * 100).toFixed(1)}%`,
            `主要错误类型: ${Array.from(errorTypes.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([type, count]) => `${type}(${count}次)`)
              .join(', ')}`
          ],
          recommendations: detected ? [
            '检查API文档是否清晰',
            '改进错误提示信息'
          ] : [],
          metadata: { errorRate, errorTypes: Object.fromEntries(errorTypes) }
        };
      }
    });
  }

  /**
   * 分析用户行为
   */
  async analyzeUserBehavior(userId: string, timeRange: number = 7 * 24 * 60 * 60 * 1000): Promise<UserBehaviorProfile> {
    try {
      const cacheKey = `behavior_profile:${userId}:${timeRange}`;
      const cached = this.analysisCache.get(cacheKey);
      
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }

      // 获取用户活动数据
      const since = new Date(Date.now() - timeRange);
      const activities = await prisma.userActivity.findMany({
        where: {
          userId,
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'asc' }
      });

      // 转换为UserActivity格式
      const userActivities: UserActivity[] = activities.map((a: any) => ({
        userId: a.userId,
        action: a.action,
        resource: a.resource,
        timestamp: a.timestamp,
        metadata: a.metadata,
        ip: a.ip,
        userAgent: a.userAgent
      }));

      // 分析各个模式
      const analysisResults: BehaviorAnalysisResult[] = [];
      let totalRiskScore = 0;

      for (const pattern of this.behaviorPatterns.values()) {
        const result = pattern.analyzeFunction(userActivities);
        analysisResults.push(result);
        
        if (result.detected) {
          totalRiskScore += result.confidence * (result.severity === 'critical' ? 40 : 
                                              result.severity === 'high' ? 30 :
                                              result.severity === 'medium' ? 20 : 10);
        }
      }

      // 构建用户画像
      const profile: UserBehaviorProfile = {
        userId,
        riskLevel: this.calculateRiskLevel(totalRiskScore),
        behaviorScore: Math.max(0, 100 - totalRiskScore),
        patterns: {},
        typicalUsageHours: this.calculateTypicalUsageHours(userActivities),
        averageSessionDuration: this.calculateAverageSessionDuration(userActivities),
        favoriteFeatures: this.getMostFrequentFeatures(
          userActivities.map(a => a.resource.split('/')[0]).filter(Boolean),
          5
        ),
        lastUpdated: new Date()
      };

      // 记录模式检测结果
      analysisResults.forEach(result => {
        if (result.detected) {
          profile.patterns[result.patternId] = {
            frequency: result.confidence,
            lastDetected: new Date(),
            severity: result.severity
          };
        }
      });

      // 缓存结果
      this.analysisCache.set(cacheKey, {
        data: profile,
        expires: Date.now() + 60 * 60 * 1000 // 1小时缓存
      });

      // 保存到数据库
      await this.saveBehaviorProfile(profile);

      return profile;
    } catch (error) {
      logger.error('分析用户行为失败:', error as Error);
      throw error;
    }
  }

  /**
   * 分析会话行为
   */
  async analyzeSession(sessionId: string): Promise<SessionAnalysis | null> {
    try {
      // 获取会话活动 - using simple filtering since metadata query might not work as expected
      const activities = await prisma.userActivity.findMany({
        where: {
          AND: [
            {
              metadata: {
                path: ['sessionId'],
                equals: sessionId
              }
            }
          ]
        },
        orderBy: { timestamp: 'asc' }
      });

      if (activities.length === 0) {
        return null as any;
      }

      const startTime = activities[0].timestamp;
      const endTime = activities[activities.length - 1].timestamp;
      const duration = endTime.getTime() - startTime.getTime();

      // 分析导航路径
      const navigationPath = activities
        .filter((a: any) => a.resource && !a.resource.startsWith('/api/'))
        .map((a: any) => a.resource);

      // 分析使用的功能
      const featuresUsed: string[] = [...new Set(
        activities
          .map((a: any) => a.resource.split('/')[0])
          .filter(Boolean)
      ) as Set<string>];

      // 转换为UserActivity格式进行分析
      const userActivities: UserActivity[] = activities.map((a: any) => ({
        userId: a.userId,
        action: a.action,
        resource: a.resource,
        timestamp: a.timestamp,
        metadata: a.metadata,
        ip: a.ip,
        userAgent: a.userAgent
      }));

      // 检测可疑活动
      const suspiciousActivities: BehaviorAnalysisResult[] = [];
      let riskScore = 0;

      for (const pattern of this.behaviorPatterns.values()) {
        const result = pattern.analyzeFunction(userActivities);
        if (result.detected) {
          suspiciousActivities.push(result);
          riskScore += result.confidence * (result.severity === 'critical' ? 40 : 
                                           result.severity === 'high' ? 30 :
                                           result.severity === 'medium' ? 20 : 10);
        }
      }

      return {
        sessionId,
        userId: activities[0].userId,
        startTime,
        endTime,
        duration,
        actionsCount: activities.length,
        featuresUsed,
        navigationPath,
        suspiciousActivities,
        riskScore
      };
    } catch (error) {
      logger.error('分析会话失败:', error as Error);
      return null as any;
    }
  }

  /**
   * 获取系统行为统计
   */
  async getSystemBehaviorStats(): Promise<{
    totalProfiles: number;
    riskDistribution: { [level: string]: number };
    topRiskFactors: Array<{ factor: string; count: number }>;
    avgBehaviorScore: number;
    activeUsers: number;
  }> {
    try {
      // Since UserBehaviorProfile model doesn't exist, return placeholder data
      const [activeUsers] = await Promise.all([
        prisma.user.count({
          where: {
            lastActiveAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时内活跃
            }
          }
        })
      ]);

      return {
        totalProfiles: 0,
        riskDistribution: {},
        topRiskFactors: [],
        avgBehaviorScore: 0,
        activeUsers
      };
    } catch (error) {
      logger.error('获取系统行为统计失败:', error as Error);
      return {
        totalProfiles: 0,
        riskDistribution: {},
        topRiskFactors: [],
        avgBehaviorScore: 0,
        activeUsers: 0
      };
    }
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  /**
   * 计算典型使用时段
   */
  private calculateTypicalUsageHours(activities: UserActivity[]): number[] {
    const hourCount = new Array(24).fill(0);
    activities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours();
      hourCount[hour]++;
    });

    const maxCount = Math.max(...hourCount);
    return hourCount
      .map((count, hour) => ({ hour, count }))
      .filter(item => item.count >= maxCount * 0.5)
      .map(item => item.hour);
  }

  /**
   * 计算平均会话时长
   */
  private calculateAverageSessionDuration(activities: UserActivity[]): number {
    if (activities.length === 0) return 0;

    // 按会话分组（简化版，假设15分钟内的活动属于同一会话）
    const sessions: UserActivity[][] = [];
    let currentSession: UserActivity[] = [];

    activities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    activities.forEach(activity => {
      if (currentSession.length === 0) {
        currentSession.push(activity);
      } else {
        const lastActivity = currentSession[currentSession.length - 1];
        const timeDiff = new Date(activity.timestamp).getTime() - 
                        new Date(lastActivity.timestamp).getTime();
        
        if (timeDiff <= 15 * 60 * 1000) { // 15分钟内
          currentSession.push(activity);
        } else {
          if (currentSession.length > 0) {
            sessions.push(currentSession);
          }
          currentSession = [activity];
        }
      }
    });

    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }

    const durations = sessions.map(session => {
      if (session.length < 2) return 0;
      return new Date(session[session.length - 1].timestamp).getTime() - 
             new Date(session[0].timestamp).getTime();
    });

    return durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : 0;
  }

  /**
   * 获取最常用的功能
   */
  private getMostFrequentFeatures(features: string[], limit: number): string[] {
    const featureCount = new Map<string, number>();
    features.forEach(feature => {
      featureCount.set(feature, (featureCount.get(feature) || 0) + 1);
    });

    return Array.from(featureCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([feature]) => feature);
  }

  /**
   * 保存用户行为画像
   */
  private async saveBehaviorProfile(profile: UserBehaviorProfile): Promise<void> {
    try {
      // For now, skip database persistence since UserBehaviorProfile model doesn't exist
      // TODO: Create the Prisma model or use alternative storage
      logger.info('行为画像已生成 (未持久化):', { 
        userId: profile.userId, 
        riskLevel: profile.riskLevel,
        behaviorScore: profile.behaviorScore 
      });
    } catch (error) {
      logger.error('保存用户行为画像失败:', error as Error);
    }
  }
}

// 导出单例实例
export const behaviorAnalysisService = BehaviorAnalysisService.getInstance();