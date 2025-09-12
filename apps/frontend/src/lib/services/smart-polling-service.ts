/**
 * 智能轮询服务
 * 根据任务状态和网络条件动态调整轮询间隔
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import React from 'react';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('SmartPollingService');

// 轮询配置
const POLLING_CONFIG = {
  // 基础轮询间隔 (毫秒)
  BASE_INTERVAL: 1000,
  // 最大轮询间隔
  MAX_INTERVAL: 30000,
  // 最小轮询间隔
  MIN_INTERVAL: 500,
  // 网络超时时间
  NETWORK_TIMEOUT: 10000,
  // 连续失败阈值
  CONSECUTIVE_FAILURE_THRESHOLD: 3,
  // 连续成功阈值
  CONSECUTIVE_SUCCESS_THRESHOLD: 5,
  // 退避因子
  BACKOFF_FACTOR: 1.5,
  // 恢复因子
  RECOVERY_FACTOR: 0.8,
  // 抖动范围 (0-1)
  JITTER_RANGE: 0.2
} as const;

// 任务状态
export enum TaskStatus {
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TERMINATED = 'terminated',
  PAUSED = 'paused'
}

// 网络质量
export enum NetworkQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor'
}

// 轮询策略接口
export interface PollingStrategy {
  interval: number;
  timeout: number;
  retryCount: number;
  adaptive: boolean;
}

// 轮询统计接口
export interface PollingStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  currentInterval: number;
  networkQuality: NetworkQuality;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export class SmartPollingService {
  private static instance: SmartPollingService;
  
  private stats: Map<string, PollingStats> = new Map();
  private networkQuality: NetworkQuality = NetworkQuality.GOOD;
  private lastNetworkCheck: number = 0;
  
  private constructor() {}
  
  static getInstance(): SmartPollingService {
    if (!SmartPollingService.instance) {
      SmartPollingService.instance = new SmartPollingService();
    }
    return SmartPollingService.instance;
  }
  
  /**
   * 获取轮询策略
   * @param taskId 任务ID
   * @param taskStatus 任务状态
   * @returns 轮询策略
   */
  getPollingStrategy(taskId: string, taskStatus: TaskStatus): PollingStrategy {
    const stats = this.getStats(taskId);
    const networkQuality = this.getNetworkQuality();
    
    // 基础间隔
    let interval: number = POLLING_CONFIG.BASE_INTERVAL;
    
    // 根据任务状态调整间隔
    switch (taskStatus) {
      case TaskStatus.INITIALIZING:
        interval = POLLING_CONFIG.BASE_INTERVAL; // 快速轮询以获取初始状态
        break;
      case TaskStatus.RUNNING:
        interval = POLLING_CONFIG.BASE_INTERVAL * 1.5; // 中等轮询间隔
        break;
      case TaskStatus.COMPLETED:
      case TaskStatus.FAILED:
      case TaskStatus.TERMINATED:
        interval = POLLING_CONFIG.MAX_INTERVAL; // 慢速轮询
        break;
      case TaskStatus.PAUSED:
        interval = POLLING_CONFIG.BASE_INTERVAL * 5; // 暂停状态使用较慢轮询
        break;
    }
    
    // 根据网络质量调整
    switch (networkQuality) {
      case NetworkQuality.EXCELLENT:
        interval *= 0.8;
        break;
      case NetworkQuality.GOOD:
        interval *= 1.0;
        break;
      case NetworkQuality.FAIR:
        interval *= 1.5;
        break;
      case NetworkQuality.POOR:
        interval *= 2.0;
        break;
    }
    
    // 根据统计信息调整
    if (stats.consecutiveFailures > 0) {
      // 连续失败，增加间隔
      interval *= Math.pow(POLLING_CONFIG.BACKOFF_FACTOR, Math.min(stats.consecutiveFailures, 5));
    }
    
    if (stats.consecutiveSuccesses > POLLING_CONFIG.CONSECUTIVE_SUCCESS_THRESHOLD) {
      // 连续成功，减少间隔
      interval *= POLLING_CONFIG.RECOVERY_FACTOR;
    }
    
    // 根据平均响应时间调整
    if (stats.averageResponseTime > 5000) {
      interval *= 1.2;
    }
    
    // 添加抖动
    const jitter = (Math.random() - 0.5) * 2 * POLLING_CONFIG.JITTER_RANGE;
    interval = interval * (1 + jitter);
    
    // 限制间隔范围
    interval = Math.max(POLLING_CONFIG.MIN_INTERVAL, Math.min(POLLING_CONFIG.MAX_INTERVAL, interval));
    
    // 计算超时时间
    const timeout = Math.min(interval * 2, POLLING_CONFIG.NETWORK_TIMEOUT);
    
    // 计算重试次数
    const retryCount = networkQuality === NetworkQuality.POOR ? 2 : 1;
    
    return {
      interval: Math.floor(interval),
      timeout: Math.floor(timeout),
      retryCount,
      adaptive: true
    };
  }
  
  /**
   * 更新轮询统计
   * @param taskId 任务ID
   * @param success 是否成功
   * @param responseTime 响应时间
   */
  updateStats(taskId: string, success: boolean, responseTime: number): void {
    let stats = this.stats.get(taskId);
    
    if (!stats) {
      stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        currentInterval: POLLING_CONFIG.BASE_INTERVAL,
        networkQuality: this.networkQuality,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0
      };
      this.stats.set(taskId, stats);
    }
    
    // 更新统计
    stats.totalRequests++;
    
    if (success) {
      stats.successfulRequests++;
      stats.consecutiveSuccesses++;
      stats.consecutiveFailures = 0;
    } else {
      stats.failedRequests++;
      stats.consecutiveFailures++;
      stats.consecutiveSuccesses = 0;
    }
    
    // 更新平均响应时间
    if (stats.totalRequests > 0) {
      stats.averageResponseTime = (
        (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) / 
        stats.totalRequests
      );
    }
    
    stats.networkQuality = this.networkQuality;
    
    logger.debug('Updated polling stats', {
      taskId,
      success,
      responseTime,
      stats: {
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        consecutiveFailures: stats.consecutiveFailures,
        consecutiveSuccesses: stats.consecutiveSuccesses,
        averageResponseTime: Math.round(stats.averageResponseTime)
      }
    });
  }
  
  /**
   * 获取统计信息
   * @param taskId 任务ID
   * @returns 统计信息
   */
  getStats(taskId: string): PollingStats {
    return this.stats.get(taskId) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      currentInterval: POLLING_CONFIG.BASE_INTERVAL,
      networkQuality: this.networkQuality,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    };
  }
  
  /**
   * 获取网络质量
   * @returns 网络质量
   */
  getNetworkQuality(): NetworkQuality {
    const now = Date.now();
    
    // 每30秒更新一次网络质量
    if (now - this.lastNetworkCheck > 30000) {
      this.updateNetworkQuality();
      this.lastNetworkCheck = now;
    }
    
    return this.networkQuality;
  }
  
  /**
   * 更新网络质量
   */
  private updateNetworkQuality(): void {
    // 基于所有任务的统计信息评估网络质量
    let totalResponseTime = 0;
    let totalRequests = 0;
    let failureRate = 0;
    
    for (const stats of this.stats.values()) {
      if (stats.totalRequests > 0) {
        totalResponseTime += stats.averageResponseTime * stats.totalRequests;
        totalRequests += stats.totalRequests;
        failureRate += stats.failedRequests / stats.totalRequests;
      }
    }
    
    if (totalRequests > 0) {
      const avgResponseTime = totalResponseTime / totalRequests;
      const avgFailureRate = failureRate / this.stats.size;
      
      if (avgResponseTime < 1000 && avgFailureRate < 0.05) {
        this.networkQuality = NetworkQuality.EXCELLENT;
      } else if (avgResponseTime < 2000 && avgFailureRate < 0.1) {
        this.networkQuality = NetworkQuality.GOOD;
      } else if (avgResponseTime < 5000 && avgFailureRate < 0.2) {
        this.networkQuality = NetworkQuality.FAIR;
      } else {
        this.networkQuality = NetworkQuality.POOR;
      }
    }
    
    logger.info('Network quality updated', {
      quality: this.networkQuality,
      avgResponseTime: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
      totalTasks: this.stats.size
    });
  }
  
  /**
   * 清理过期统计
   * @param maxAge 最大年龄 (毫秒)
   */
  cleanupStats(maxAge: number = 3600000): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [taskId, stats] of this.stats.entries()) {
      // 如果任务超过1小时没有活动，清理统计
      if (now - stats.totalRequests > maxAge) {
        this.stats.delete(taskId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info('Cleaned up polling stats', { cleanedCount, remaining: this.stats.size });
    }
  }
  
  /**
   * 重置统计信息
   * @param taskId 任务ID
   */
  resetStats(taskId: string): void {
    this.stats.delete(taskId);
    logger.info('Reset polling stats', { taskId });
  }
  
  /**
   * 获取所有统计信息
   * @returns 所有统计信息
   */
  getAllStats(): Map<string, PollingStats> {
    return new Map(this.stats);
  }
  
  /**
   * 获取汇总统计
   * @returns 汇总统计
   */
  getSummaryStats() {
    let totalRequests = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalResponseTime = 0;
    let activeTasks = 0;
    
    for (const stats of this.stats.values()) {
      totalRequests += stats.totalRequests;
      totalSuccessful += stats.successfulRequests;
      totalFailed += stats.failedRequests;
      totalResponseTime += stats.averageResponseTime * stats.totalRequests;
      
      if (stats.totalRequests > 0) {
        activeTasks++;
      }
    }
    
    return {
      activeTasks,
      totalRequests,
      totalSuccessful,
      totalFailed,
      successRate: totalRequests > 0 ? totalSuccessful / totalRequests : 0,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      networkQuality: this.networkQuality
    };
  }
}

// 导出单例实例
export const smartPollingService = SmartPollingService.getInstance();

// 定期清理统计信息
if (typeof window === 'undefined') {
  setInterval(() => {
    smartPollingService.cleanupStats();
  }, 2 * 60 * 1000); // 每2分钟清理一次，减少内存累积
}

// React Hook for smart polling
export function useSmartPolling(
  taskId: string,
  taskStatus: TaskStatus,
  onPoll: () => Promise<any>,
  options: {
    enabled?: boolean;
    onResult?: (result: any) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const { enabled = true, onResult, onError } = options;
  const pollingRef = React.useRef<NodeJS.Timeout | null>(null);
  
  React.useEffect(() => {
    if (!enabled || !taskId) {
      return;
    }
    
    const poll = async () => {
      const startTime = Date.now();
      
      try {
        const result = await onPoll();
        const responseTime = Date.now() - startTime;
        
        // 更新统计
        smartPollingService.updateStats(taskId, true, responseTime);
        
        if (onResult) {
          onResult(result);
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const err = error instanceof Error ? error : new Error(String(error));
        
        // 更新统计
        smartPollingService.updateStats(taskId, false, responseTime);
        
        if (onError) {
          onError(err);
        }
      }
      
      // 获取下一次轮询的策略
      const strategy = smartPollingService.getPollingStrategy(taskId, taskStatus);
      
      // 安排下一次轮询
      pollingRef.current = setTimeout(poll, strategy.interval);
    };
    
    // 开始轮询
    poll();
    
    // 清理
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [taskId, taskStatus, enabled, onPoll, onResult, onError]);
  
  return {
    stats: smartPollingService.getStats(taskId),
    networkQuality: smartPollingService.getNetworkQuality()
  };
}