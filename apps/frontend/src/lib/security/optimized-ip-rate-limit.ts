import { createLogger } from "@/lib/utils/security/secure-logger";
import { MultiLevelCacheService } from "@/lib/cache/multi-level-cache";
import { EnhancedError } from '@/lib/utils/error-handling';
import { auth } from '@/lib/auth/v5-config';

const logger = createLogger('OptimizedIPRateLimitManager');

export interface IPRequestRecord {
  ip: string;
  timestamp: number;
  endpoint: string;
  userAgent?: string;
  userId?: string;
}

export interface IPLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  keyPrefix?: string; // Redis 键前缀
  limitType: 'page' | 'api' | 'authenticated'; // 限制类型
}

export interface IPBanInfo {
  ip: string;
  reason: string;
  bannedAt: number;
  expiresAt: number;
  banLevel: number; // 封禁级别 1-5
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
  banInfo?: IPBanInfo;
}

/**
 * 优化的IP速率限制和封禁管理器
 * 区分页面访问、API访问和认证用户
 */
export class OptimizedIPRateLimitManager {
  private config: IPLimitConfig;
  
  // 优化后的封禁配置
  private banConfig = {
    // 页面访问的封禁阈值（非常宽松）
    pageThresholds: [
      { level: 1, requests: 2000, duration: 60 * 60 * 1000 }, // 1小时
      { level: 2, requests: 5000, duration: 6 * 60 * 60 * 1000 }, // 6小时
      { level: 3, requests: 10000, duration: 24 * 60 * 60 * 1000 }, // 1天
    ],
    // API访问的封禁阈值（适度严格）
    apiThresholds: [
      { level: 1, requests: 50, duration: 60 * 60 * 1000 }, // 1小时
      { level: 2, requests: 100, duration: 6 * 60 * 60 * 1000 }, // 6小时
      { level: 3, requests: 200, duration: 24 * 60 * 60 * 1000 }, // 1天
    ],
    // 认证用户的封禁阈值（非常宽松）
    authThresholds: [
      { level: 1, requests: 5000, duration: 60 * 60 * 1000 }, // 1小时
      { level: 2, requests: 10000, duration: 6 * 60 * 60 * 1000 }, // 6小时
    ],
    // 自动封禁的触发条件
    autoBanThreshold: 20, // 10秒内超过20个无效请求
    suspiciousPatterns: [
      /making%20each%20one/,
      /an exciting opportunity/,
      /a leading brand/,
      /athletic achievements/,
      /accessible haircare/,
      /one-of-a-kind%20addition/,
      /browse%20our%20selection/
    ]
  };

  constructor(config: IPLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyPrefix: config.keyPrefix || 'rate_limit:',
      limitType: config.limitType || 'page'
    };
  }

  /**
   * 检查 IP 是否允许访问（使用滑动窗口算法）
   */
  async checkRateLimit(ip: string, endpoint: string, userAgent?: string): Promise<RateLimitResult> {
    try {
      // 检查用户是否已认证
      const session = await auth();
      const userId = session?.user?.id;
      
      // 根据用户状态和请求类型选择适当的限制策略
      const limitType = this.determineLimitType(endpoint, userId);
      
      // 首先检查是否被封禁
      const banInfo = await this.getBanInfo(ip);
      if (banInfo) {
        if (Date.now() < banInfo.expiresAt) {
          logger.warn(`封禁IP尝试访问: ${ip}`, { 
            endpoint, 
            userId,
            banLevel: banInfo.banLevel,
            reason: banInfo.reason,
            userAgent 
          });
          return {
            allowed: false,
            remaining: 0,
            resetTime: banInfo.expiresAt,
            totalRequests: 0,
            banInfo
          };
        } else {
          // 封禁已过期，清除记录
          await this.clearBan(ip);
        }
      }

      // 使用滑动窗口算法
      const result = await this.checkSlidingWindowLimit(ip, endpoint, userAgent, userId, limitType);

      // 检查可疑模式
      if (result.allowed && userAgent) {
        await this.checkSuspiciousPatterns(ip, userAgent, endpoint);
      }

      return result;
    } catch (error) {
      logger.error('IP速率限制检查失败:', error as Error);
      // 出错时允许访问，但记录错误
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs,
        totalRequests: 0
      };
    }
  }

  /**
   * 根据端点和用户状态确定限制类型
   */
  private determineLimitType(endpoint: string, userId?: string): 'page' | 'api' | 'authenticated' {
    if (userId) {
      return 'authenticated';
    }
    
    // 判断是否为API端点
    if (endpoint.startsWith('/api/')) {
      return 'api';
    }
    
    return 'page';
  }

  /**
   * 滑动窗口算法实现
   */
  private async checkSlidingWindowLimit(
    ip: string, 
    endpoint: string, 
    userAgent?: string,
    userId?: string,
    limitType: 'page' | 'api' | 'authenticated' = 'page'
  ): Promise<RateLimitResult> {
    const cache = MultiLevelCacheService;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // 根据限制类型获取不同的配置
    const thresholds = this.getThresholdsByType(limitType);
    const maxRequests = this.getMaxRequestsByType(limitType);
    
    const key = `${this.config.keyPrefix}${limitType}:${ip}`;
    
    // 获取当前窗口内的所有请求记录
    const records = await cache.get<IPRequestRecord[]>(key) || [];
    
    // 过滤掉过期的记录
    const validRecords = records.filter(record => record.timestamp > windowStart);
    
    // 检查是否超过限制
    if (validRecords.length >= maxRequests) {
      // 触发封禁检查
      await this.checkAndBan(ip, validRecords.length, limitType);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + this.config.windowMs,
        totalRequests: validRecords.length
      };
    }
    
    // 添加新记录
    validRecords.push({
      ip,
      timestamp: now,
      endpoint,
      userAgent,
      userId
    });
    
    // 更新缓存
    await cache.set(key, validRecords, {
      ttl: Math.ceil(this.config.windowMs / 1000)
    });
    
    return {
      allowed: true,
      remaining: maxRequests - validRecords.length,
      resetTime: now + this.config.windowMs,
      totalRequests: validRecords.length
    };
  }

  /**
   * 根据限制类型获取阈值配置
   */
  private getThresholdsByType(limitType: 'page' | 'api' | 'authenticated') {
    switch (limitType) {
      case 'page':
        return this.banConfig.pageThresholds;
      case 'api':
        return this.banConfig.apiThresholds;
      case 'authenticated':
        return this.banConfig.authThresholds;
      default:
        return this.banConfig.pageThresholds;
    }
  }

  /**
   * 根据限制类型获取最大请求数
   */
  private getMaxRequestsByType(limitType: 'page' | 'api' | 'authenticated'): number {
    switch (limitType) {
      case 'page':
        return 1000; // 每小时1000次页面请求
      case 'api':
        return 100; // 每小时100次API请求
      case 'authenticated':
        return 5000; // 每小时5000次认证请求
      default:
        return 1000;
    }
  }

  /**
   * 检查并执行封禁
   */
  private async checkAndBan(ip: string, requestCount: number, limitType: string) {
    const thresholds = this.getThresholdsByType(limitType as any);
    
    // 找到合适的封禁级别
    for (const threshold of thresholds) {
      if (requestCount >= threshold.requests) {
        await this.banIP(ip, `Exceeded ${limitType} request limit: ${requestCount}`, threshold.level, threshold.duration);
        break;
      }
    }
  }

  /**
   * 检查可疑模式
   */
  private async checkSuspiciousPatterns(ip: string, userAgent: string, endpoint: string) {
    // 检查是否包含垃圾邮件模式
    for (const pattern of this.banConfig.suspiciousPatterns) {
      if (pattern.test(userAgent) || pattern.test(endpoint)) {
        await this.banIP(ip, `Suspicious pattern detected: ${pattern}`, 1, 60 * 60 * 1000);
        logger.warn(`可疑模式检测并封禁IP: ${ip}`, { pattern: pattern.toString(), userAgent, endpoint });
        break;
      }
    }
  }

  /**
   * 封禁IP
   */
  private async banIP(ip: string, reason: string, level: number, duration: number): Promise<void> {
    const cache = MultiLevelCacheService;
    const banInfo: IPBanInfo = {
      ip,
      reason,
      bannedAt: Date.now(),
      expiresAt: Date.now() + duration,
      banLevel: level
    };
    
    await cache.set(`ban:${ip}`, banInfo, {
      ttl: Math.ceil(duration / 1000)
    });
    
    logger.info(`IP已封禁: ${ip}`, { reason, level, duration });
  }

  /**
   * 获取封禁信息
   */
  private async getBanInfo(ip: string): Promise<IPBanInfo | null> {
    const cache = MultiLevelCacheService;
    return await cache.get<IPBanInfo>(`ban:${ip}`);
  }

  /**
   * 清除封禁
   */
  private async clearBan(ip: string): Promise<void> {
    const cache = MultiLevelCacheService;
    await cache.delete(`ban:${ip}`);
  }

  /**
   * 获取IP的统计信息
   */
  async getIPStats(ip: string): Promise<{
    pageRequests: number;
    apiRequests: number;
    authRequests: number;
    isBanned: boolean;
    banInfo?: IPBanInfo;
  }> {
    const cache = MultiLevelCacheService;
    
    const [pageRecords, apiRecords, authRecords, banInfo] = await Promise.all([
      cache.get<IPRequestRecord[]>(`rate_limit:page:${ip}`) || [],
      cache.get<IPRequestRecord[]>(`rate_limit:api:${ip}`) || [],
      cache.get<IPRequestRecord[]>(`rate_limit:authenticated:${ip}`) || [],
      this.getBanInfo(ip)
    ]);
    
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1小时窗口
    
    return {
      pageRequests: (pageRecords || []).filter(r => r.timestamp > now - windowMs).length,
      apiRequests: (apiRecords || []).filter(r => r.timestamp > now - windowMs).length,
      authRequests: (authRecords || []).filter(r => r.timestamp > now - windowMs).length,
      isBanned: banInfo !== null && banInfo.expiresAt > now,
      banInfo: banInfo || undefined
    };
  }

  /**
   * 手动解封IP
   */
  async unbanIP(ip: string): Promise<boolean> {
    try {
      await this.clearBan(ip);
      logger.info(`IP已解封: ${ip}`);
      return true;
    } catch (error) {
      logger.error(`解封IP失败: ${ip}`, error as Error);
      return false;
    }
  }
}

// 创建预配置的实例
export const pageIPRateLimit = new OptimizedIPRateLimitManager({
  windowMs: 60 * 60 * 1000, // 1小时
  maxRequests: 1000,
  limitType: 'page'
});

export const apiIPRateLimit = new OptimizedIPRateLimitManager({
  windowMs: 60 * 60 * 1000, // 1小时
  maxRequests: 100,
  limitType: 'api'
});

export const authIPRateLimit = new OptimizedIPRateLimitManager({
  windowMs: 60 * 60 * 1000, // 1小时
  maxRequests: 5000,
  limitType: 'authenticated'
});