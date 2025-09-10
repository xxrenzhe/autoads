import { createLogger } from "@/lib/utils/security/secure-logger";
import { MultiLevelCacheService } from "@/lib/cache/multi-level-cache";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('IPRateLimitManager');

export interface IPRequestRecord {
  ip: string;
  timestamp: number;
  endpoint: string;
  userAgent?: string;
}

export interface IPLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  keyPrefix?: string; // Redis 键前缀
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
 * IP 速率限制和封禁管理器
 */
export class IPRateLimitManager {
  private config: IPLimitConfig;
  private banConfig = {
    // 封禁阈值配置
    thresholds: [
      { level: 1, requests: 50, duration: 60 * 60 * 1000 }, // 1小时
      { level: 2, requests: 100, duration: 6 * 60 * 60 * 1000 }, // 6小时
      { level: 3, requests: 200, duration: 24 * 60 * 60 * 1000 }, // 1天
      { level: 4, requests: 500, duration: 7 * 24 * 60 * 60 * 1000 }, // 7天
      { level: 5, requests: 1000, duration: 30 * 24 * 60 * 60 * 1000 } // 30天
    ],
    // 自动封禁的触发条件
    autoBanThreshold: 10, // 10秒内超过10个无效请求
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
      keyPrefix: config.keyPrefix || 'rate_limit:'
    };
  }

  /**
   * 检查 IP 是否允许访问（使用滑动窗口算法）
   */
  async checkRateLimit(ip: string, endpoint: string, userAgent?: string): Promise<RateLimitResult> {
    try {
      // 首先检查是否被封禁
      const banInfo = await this.getBanInfo(ip);
      if (banInfo) {
        if (Date.now() < banInfo.expiresAt) {
          logger.warn(`封禁IP尝试访问: ${ip}`, { 
            endpoint, 
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
      const result = await this.checkSlidingWindowLimit(ip, endpoint, userAgent);

      // 检查是否超过限制
      if (!result.allowed) {
        // 获取当前所有请求记录用于自动封禁检查
        const key = `${this.config.keyPrefix}${ip}:${endpoint}`;
        const requests = await MultiLevelCacheService.get<IPRequestRecord[]>(key, {
          ttl: this.config.windowMs,
          tags: ['rate-limit'],
          strategy: 'l2'
        }) || [];
        await this.checkAutoBan(ip, requests);
      }

      return result;

    } catch (error) {
      logger.error('速率限制检查失败:', new EnhancedError('速率限制检查失败', { error: error instanceof Error ? error.message : String(error) }));
      // 出错时默认允许访问，避免误拦正常用户
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs,
        totalRequests: 0
      };
    }
  }

  /**
   * 滑动窗口算法实现
   */
  private async checkSlidingWindowLimit(ip: string, endpoint: string, userAgent?: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}${ip}:${endpoint}`;
    const now = Date.now();
    const windowSize = this.config.windowMs;
    const maxRequests = this.config.maxRequests;

    // 获取当前窗口的请求记录
    const requests = await MultiLevelCacheService.get<IPRequestRecord[]>(key, {
      ttl: this.config.windowMs,
      tags: ['rate-limit'],
      strategy: 'l2'
    }) || [];
    
    // 使用滑动窗口计算当前请求数
    const currentCount = this.calculateSlidingWindowCount(requests, now, windowSize);
    
    // 检查是否超过限制
    if (currentCount >= maxRequests) {
      // 计算需要等待的时间
      const oldestValidRequest = this.findOldestValidRequest(requests, now, windowSize, maxRequests);
      const resetTime = oldestValidRequest ? oldestValidRequest.timestamp + windowSize : now + windowSize;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        totalRequests: currentCount
      };
    }

    // 添加新请求
    const newRequest: IPRequestRecord = {
      ip,
      timestamp: now,
      endpoint,
      userAgent
    };

    // 更新请求记录
    const updatedRequests = [...requests, newRequest];
    await MultiLevelCacheService.set(key, updatedRequests, {
      ttl: windowSize,
      tags: ['rate-limit'],
      strategy: 'l2'
    });

    // 计算剩余请求数
    const remaining = maxRequests - currentCount - 1;
    
    // 记录请求到日志
    logger.info(`IP请求: ${ip}`, {
      endpoint,
      requestCount: currentCount + 1,
      remaining,
      userAgent: userAgent?.substring(0, 100)
    });

    return {
      allowed: true,
      remaining: Math.max(0, remaining),
      resetTime: now + windowSize,
      totalRequests: currentCount + 1
    };
  }

  /**
   * 计算滑动窗口内的请求数
   */
  private calculateSlidingWindowCount(requests: IPRequestRecord[], now: number, windowSize: number): number {
    const windowStart = now - windowSize;
    return requests.filter(req => req.timestamp > windowStart).length;
  }

  /**
   * 查找最旧的有效请求（用于计算重置时间）
   */
  private findOldestValidRequest(requests: IPRequestRecord[], now: number, windowSize: number, maxRequests: number): IPRequestRecord | null {
    const windowStart = now - windowSize;
    const validRequests = requests.filter(req => req.timestamp > windowStart);
    
    if (validRequests.length <= maxRequests) {
      return null as any;
    }
    
    // 按时间排序并找到第 maxRequests 个请求
    const sortedRequests = validRequests.sort((a, b) => a.timestamp - b.timestamp);
    return sortedRequests[maxRequests - 1] || null;
  }

  /**
   * 记录无效请求（用于检测滥用模式）
   */
  async recordInvalidRequest(ip: string, endpoint: string, domain?: string, userAgent?: string): Promise<void> {
    try {
      const key = `invalid_requests:${ip}`;
      const now = Date.now();
      
      const invalidRequests = await MultiLevelCacheService.get<Array<{ timestamp: number; domain?: string }>>(key, {
      ttl: 10 * 60 * 1000,
      tags: ['rate-limit', 'invalid-requests'],
      strategy: 'l2'
    }) || [];
      
      // 添加新记录
      invalidRequests.push({ timestamp: now, domain });
      
      // 保留最近10分钟的记录
      const recentRequests = invalidRequests.filter(req => now - req.timestamp < 10 * 60 * 1000);
      
      await MultiLevelCacheService.set(key, recentRequests, {
      ttl: 10 * 60 * 1000,
      tags: ['rate-limit', 'invalid-requests'],
      strategy: 'l2'
    });

      // 检查是否需要自动封禁
      if (recentRequests.length >= this.banConfig.autoBanThreshold) {
        await this.autoBanIP(ip, '频繁的无效请求', 2);
        logger.warn(`IP因频繁无效请求被自动封禁: ${ip}`, {
          endpoint,
          invalidCount: recentRequests.length,
          recentDomains: recentRequests.slice(-5)?.filter(Boolean)?.map(r => r.domain)
        });
      }

      // 检查可疑模式
      if (domain) {
        for (const pattern of this.banConfig.suspiciousPatterns) {
          if (pattern.test(domain)) {
            await this.autoBanIP(ip, `检测到可疑查询模式: ${domain}`, 3);
            logger.warn(`IP因可疑模式被自动封禁: ${ip}`, {
              endpoint,
              domain,
              pattern: pattern.toString()
            });
            break;
          }
        }
      }

    } catch (error) {
      logger.error('记录无效请求失败:', new EnhancedError('记录无效请求失败', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  /**
   * 检查是否需要自动封禁
   */
  private async checkAutoBan(ip: string, requests: IPRequestRecord[]): Promise<void> {
    try {
      // 统计最近1小时的请求
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentRequests = requests.filter(req => req.timestamp > oneHourAgo);
      
      // 检查是否达到封禁阈值
      for (const threshold of this.banConfig.thresholds) {
        if (recentRequests.length >= threshold.requests) {
          const existingBan = await this.getBanInfo(ip);
          if (!existingBan || existingBan.banLevel < threshold.level) {
            await this.autoBanIP(ip, `超过速率限制阈值 (${recentRequests.length} 请求/小时)`, threshold.level);
            logger.warn(`IP自动封禁升级: ${ip}`, {
              requestCount: recentRequests.length,
              newLevel: threshold.level,
              duration: threshold.duration
            });
            break;
          }
        }
      }
    } catch (error) {
      logger.error('自动封禁检查失败:', new EnhancedError('自动封禁检查失败', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  /**
   * 自动封禁IP
   */
  private async autoBanIP(ip: string, reason: string, level: number): Promise<void> {
    try {
      const threshold = this.banConfig.thresholds.find(t => t.level === level);
      if (!threshold) return;

      const banInfo: IPBanInfo = {
        ip,
        reason,
        bannedAt: Date.now(),
        expiresAt: Date.now() + threshold.duration,
        banLevel: level
      };

      const banKey = `banned_ip:${ip}`;
      await MultiLevelCacheService.set(banKey, banInfo, {
        ttl: threshold.duration,
        tags: ['rate-limit', 'banned-ip'],
        strategy: 'l2'
      });

      // 记录封禁事件
      logger.warn(`IP被自动封禁: ${ip}`, banInfo);

    } catch (error) {
      logger.error('自动封禁失败:', new EnhancedError('自动封禁失败', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  /**
   * 获取封禁信息
   */
  async getBanInfo(ip: string): Promise<IPBanInfo | null> {
    try {
      const banKey = `banned_ip:${ip}`;
      try {

      return await MultiLevelCacheService.get<IPBanInfo>(banKey, {
        ttl: 30 * 24 * 60 * 60 * 1000, // 30天
        tags: ['rate-limit', 'banned-ip'],
        strategy: 'l2'
      });

      } catch (error) {

        console.error(error);

        return null as any;

      }
    } catch (error) {
      logger.error('获取封禁信息失败:', new EnhancedError('获取封禁信息失败', { error: error instanceof Error ? error.message : String(error) }));
      return null as any;
    }
  }

  /**
   * 清除封禁
   */
  async clearBan(ip: string): Promise<void> {
    try {
      const banKey = `banned_ip:${ip}`;
      await MultiLevelCacheService.delete(banKey);
      logger.info(`清除IP封禁: ${ip}`);
    } catch (error) {
      logger.error('清除封禁失败:', new EnhancedError('清除封禁失败', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  /**
   * 手动封禁IP
   */
  async banIP(ip: string, reason: string, level: number = 1, duration?: number): Promise<void> {
    try {
      const threshold = this.banConfig.thresholds.find(t => t.level === level);
      const banDuration = duration || (threshold?.duration || 60 * 60 * 1000);

      const banInfo: IPBanInfo = {
        ip,
        reason,
        bannedAt: Date.now(),
        expiresAt: Date.now() + banDuration,
        banLevel: level
      };

      const banKey = `banned_ip:${ip}`;
      await MultiLevelCacheService.set(banKey, banInfo, {
        ttl: banDuration,
        tags: ['rate-limit', 'banned-ip'],
        strategy: 'l2'
      });

      logger.info(`手动封禁IP: ${ip}`, banInfo);

    } catch (error) {
      logger.error('手动封禁失败:', new EnhancedError('手动封禁失败', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    totalBannedIPs: number;
    activeBans: IPBanInfo[];
    topIPs: Array<{ ip: string; requestCount: number }>;
  }> {
    try {
      // 获取所有活跃的封禁
      const activeBans: IPBanInfo[] = [];
      // 注意：实际实现需要根据缓存系统的支持来遍历键
      
      // 获取请求最多的IP（简化版）
      const topIPs: Array<{ ip: string; requestCount: number }> = [];

      return {
        totalBannedIPs: activeBans.length,
        activeBans,
        topIPs
      };
    } catch (error) {
      logger.error('获取统计信息失败:', new EnhancedError('获取统计信息失败', { error: error instanceof Error ? error.message : String(error) }));
      return {
        totalBannedIPs: 0,
        activeBans: [],
        topIPs: []
      };
    }
  }
}

// 预定义的速率限制配置
export const RATE_LIMIT_CONFIGS = {
  // 默认限制：每分钟最多500次请求
  default: {
    windowMs: 60 * 1000,
    maxRequests: 500,
    keyPrefix: 'rate_limit:'
  },
  // 严格限制：每分钟最多100次请求
  strict: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'rate_limit_strict:'
  },
  // 批量查询限制：每分钟最多50次批量请求
  batch: {
    windowMs: 60 * 1000,
    maxRequests: 50,
    keyPrefix: 'rate_limit_batch:'
  }
} as const;

// 导出单例实例
export const ipRateLimitManager = new IPRateLimitManager(RATE_LIMIT_CONFIGS.default);
export const strictIpRateLimitManager = new IPRateLimitManager(RATE_LIMIT_CONFIGS.strict);
export const batchIpRateLimitManager = new IPRateLimitManager(RATE_LIMIT_CONFIGS.batch);