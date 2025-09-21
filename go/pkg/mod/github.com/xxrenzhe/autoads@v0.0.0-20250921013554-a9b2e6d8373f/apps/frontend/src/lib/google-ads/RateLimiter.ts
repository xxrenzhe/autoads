import { createLogger } from "@/lib/utils/security/secure-logger";
const logger = createLogger('RateLimiter');

export interface QuotaInfo {
  remainingQueries: number;
  remainingMutations: number;
  resetTime: string;
  quotaType: 'DAILY' | 'HOURLY' | 'MINUTE';
}

export interface RateLimitConfig {
  maxQueriesPerMinute: number;
  maxMutationsPerMinute: number;
  maxQueriesPerHour: number;
  maxMutationsPerHour: number;
  maxQueriesPerDay: number;
  maxMutationsPerDay: number;
}

export class GoogleAdsRateLimiter {
  private config: RateLimitConfig;
  private queryCounts: Map<string, number> = new Map();
  private mutationCounts: Map<string, number> = new Map();
  private lastReset: Map<string, number> = new Map();

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxQueriesPerMinute: 1000,
      maxMutationsPerMinute: 100,
      maxQueriesPerHour: 50000,
      maxMutationsPerHour: 5000,
      maxQueriesPerDay: 1000000,
      maxMutationsPerDay: 100000,
      ...config
    };
  }

  /**
   * 等待可用的API槽位
   */
  async waitForSlot(operationType: 'query' | 'mutation' = 'query'): Promise<void> {
    const now = Date.now();
    const minuteKey = this.getMinuteKey(now);
    const hourKey = this.getHourKey(now);
    const dayKey = this.getDayKey(now);

    // 检查并重置计数器
    this.resetCountersIfNeeded(minuteKey, hourKey, dayKey);

    // 检查限制
    const minuteLimit = operationType === 'query' 
      ? this.config.maxQueriesPerMinute 
      : this.config.maxMutationsPerMinute;
    const hourLimit = operationType === 'query' 
      ? this.config.maxQueriesPerHour 
      : this.config.maxMutationsPerHour;
    const dayLimit = operationType === 'query' 
      ? this.config.maxQueriesPerDay 
      : this.config.maxMutationsPerDay;

    const minuteCount = this.queryCounts.get(minuteKey) || 0;
    const hourCount = this.queryCounts.get(hourKey) || 0;
    const dayCount = this.queryCounts.get(dayKey) || 0;

    if (operationType === 'mutation') {
      const mutationMinuteCount = this.mutationCounts.get(minuteKey) || 0;
      const mutationHourCount = this.mutationCounts.get(hourKey) || 0;
      const mutationDayCount = this.mutationCounts.get(dayKey) || 0;

      if (mutationMinuteCount >= minuteLimit || 
          mutationHourCount >= hourLimit || 
          mutationDayCount >= dayLimit) {
        await this.waitForReset(operationType);
      }
    } else {
      if (minuteCount >= minuteLimit || 
          hourCount >= hourLimit || 
          dayCount >= dayLimit) {
        await this.waitForReset(operationType);
      }
    }
  }

  /**
   * 记录API请求
   */
  recordRequest(operationType: 'query' | 'mutation' = 'query'): void {
    const now = Date.now();
    const minuteKey = this.getMinuteKey(now);
    const hourKey = this.getHourKey(now);
    const dayKey = this.getDayKey(now);

    // 增加计数器
    if (operationType === 'mutation') {
      this.mutationCounts.set(minuteKey, (this.mutationCounts.get(minuteKey) || 0) + 1);
      this.mutationCounts.set(hourKey, (this.mutationCounts.get(hourKey) || 0) + 1);
      this.mutationCounts.set(dayKey, (this.mutationCounts.get(dayKey) || 0) + 1);
    } else {
      this.queryCounts.set(minuteKey, (this.queryCounts.get(minuteKey) || 0) + 1);
      this.queryCounts.set(hourKey, (this.queryCounts.get(hourKey) || 0) + 1);
      this.queryCounts.set(dayKey, (this.queryCounts.get(dayKey) || 0) + 1);
    }

    // 记录最后重置时间
    this.lastReset.set(`${operationType}_${minuteKey}`, now);
  }

  /**
   * 获取剩余配额信息
   */
  getRemainingQuota(): QuotaInfo {
    const now = Date.now();
    const minuteKey = this.getMinuteKey(now);
    const hourKey = this.getHourKey(now);
    const dayKey = this.getDayKey(now);

    const minuteQueries = this.queryCounts.get(minuteKey) || 0;
    const hourQueries = this.queryCounts.get(hourKey) || 0;
    const dayQueries = this.queryCounts.get(dayKey) || 0;

    const minuteMutations = this.mutationCounts.get(minuteKey) || 0;
    const hourMutations = this.mutationCounts.get(hourKey) || 0;
    const dayMutations = this.mutationCounts.get(dayKey) || 0;

    // 确定最严格的限制
    let remainingQueries = Math.min(
      this.config.maxQueriesPerMinute - minuteQueries,
      this.config.maxQueriesPerHour - hourQueries,
      this.config.maxQueriesPerDay - dayQueries
    );

    let remainingMutations = Math.min(
      this.config.maxMutationsPerMinute - minuteMutations,
      this.config.maxMutationsPerHour - hourMutations,
      this.config.maxMutationsPerDay - dayMutations
    );

    // 确保不为负数
    remainingQueries = Math.max(0, remainingQueries);
    remainingMutations = Math.max(0, remainingMutations);

    // 计算下次重置时间
    const nextMinute = new Date(now);
    nextMinute.setMinutes(nextMinute.getMinutes() + 1);
    nextMinute.setSeconds(0);
    nextMinute.setMilliseconds(0);

    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    nextHour.setSeconds(0);
    nextHour.setMilliseconds(0);

    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0);
    nextDay.setMinutes(0);
    nextDay.setSeconds(0);
    nextDay.setMilliseconds(0);

    // 确定最早的重置时间
    let resetTime = nextMinute.toISOString();
    let quotaType: 'DAILY' | 'HOURLY' | 'MINUTE' = 'MINUTE';

    if (minuteQueries >= this.config.maxQueriesPerMinute || 
        minuteMutations >= this.config.maxMutationsPerMinute) {
      resetTime = nextMinute.toISOString();
      quotaType = 'MINUTE';
    } else if (hourQueries >= this.config.maxQueriesPerHour || 
               hourMutations >= this.config.maxMutationsPerHour) {
      resetTime = nextHour.toISOString();
      quotaType = 'HOURLY';
    } else if (dayQueries >= this.config.maxQueriesPerDay || 
               dayMutations >= this.config.maxMutationsPerDay) {
      resetTime = nextDay.toISOString();
      quotaType = 'DAILY';
    }

    return {
      remainingQueries,
      remainingMutations,
      resetTime,
      quotaType
    };
  }

  /**
   * 检查是否可以执行操作
   */
  canExecute(operationType: 'query' | 'mutation' = 'query'): Promise<boolean> {
    const now = Date.now();
    const minuteKey = this.getMinuteKey(now);
    const hourKey = this.getHourKey(now);
    const dayKey = this.getDayKey(now);

    if (operationType === 'mutation') {
      const minuteCount = this.mutationCounts.get(minuteKey) || 0;
      const hourCount = this.mutationCounts.get(hourKey) || 0;
      const dayCount = this.mutationCounts.get(dayKey) || 0;

      return Promise.resolve(
        minuteCount < this.config.maxMutationsPerMinute &&
        hourCount < this.config.maxMutationsPerHour &&
        dayCount < this.config.maxMutationsPerDay
      );
    } else {
      const minuteCount = this.queryCounts.get(minuteKey) || 0;
      const hourCount = this.queryCounts.get(hourKey) || 0;
      const dayCount = this.queryCounts.get(dayKey) || 0;

      return Promise.resolve(
        minuteCount < this.config.maxQueriesPerMinute &&
        hourCount < this.config.maxQueriesPerHour &&
        dayCount < this.config.maxQueriesPerDay
      );
    }
  }

  /**
   * 等待重置
   */
  private async waitForReset(operationType: 'query' | 'mutation'): Promise<void> {
    const quota = this.getRemainingQuota();
    const resetTime = new Date(quota.resetTime);
    const now = new Date();
    const waitTime = resetTime.getTime() - now.getTime();

    if (waitTime > 0) {
      logger.info(`Rate limit reached for ${operationType}. Waiting ${waitTime}ms until reset.`);
      await this.delay(waitTime + 1000); // 额外等待1秒确保重置完成
    }
  }

  /**
   * 重置计数器
   */
  private resetCountersIfNeeded(minuteKey: string, hourKey: string, dayKey: string): void {
    const now = Date.now();

    // 清理过期的分钟计数器
    for (const [key] of this.queryCounts) {
      if (key !== minuteKey && key !== hourKey && key !== dayKey) {
        this.queryCounts.delete(key);
      }
    }

    for (const [key] of this.mutationCounts) {
      if (key !== minuteKey && key !== hourKey && key !== dayKey) {
        this.mutationCounts.delete(key);
      }
    }

    // 清理过期的重置时间记录
    for (const [key] of this.lastReset) {
      const lastResetTime = this.lastReset.get(key) || 0;
      if (now - lastResetTime > 24 * 60 * 60 * 1000) { // 24小时
        this.lastReset.delete(key);
      }
    }
  }

  /**
   * 获取分钟键
   */
  private getMinuteKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
  }

  /**
   * 获取小时键
   */
  private getHourKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;
  }

  /**
   * 获取天键
   */
  private getDayKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取当前配置
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 重置所有计数器
   */
  resetAllCounters(): void {
    this.queryCounts.clear();
    this.mutationCounts.clear();
    this.lastReset.clear();
  }
} 