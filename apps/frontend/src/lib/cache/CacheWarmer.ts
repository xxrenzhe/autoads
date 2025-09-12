/**
 * Cache Warmer Service
 * 缓存预热服务，用于预加载关键数据
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { UnifiedCacheManager, CacheOptions } from './UnifiedCacheManager';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('CacheWarmer');

/**
 * 预热策略类型
 */
export type PrewarmStrategyType = 'time-based' | 'event-based' | 'predictive' | 'manual';

/**
 * 预热配置接口
 */
export interface PrewarmConfig {
  enabled: boolean;
  strategies: PrewarmStrategy[];
  criticalKeys: string[];
  batchSize: number;
  interval: number;
  maxConcurrent: number;
}

/**
 * 预热策略接口
 */
export interface PrewarmStrategy {
  id: string;
  type: PrewarmStrategyType;
  name: string;
  description: string;
  config: Record<string, any>;
  enabled: boolean;
  priority: number;
}

/**
 * 预热任务接口
 */
export interface PrewarmTask {
  id: string;
  strategyId: string;
  keys: string[];
  options: CacheOptions;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
  progress: number;
}

/**
 * 预热统计信息
 */
export interface PrewarmStatistics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalKeys: number;
  successKeys: number;
  failedKeys: number;
  averageTime: number;
  lastRun: Date | null;
}

/**
 * 缓存预热服务类
 */
export class CacheWarmer {
  private cacheManager: UnifiedCacheManager;
  private config: PrewarmConfig;
  private tasks: Map<string, PrewarmTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private statistics: PrewarmStatistics;
  private isRunning: boolean = false;

  constructor(cacheManager: UnifiedCacheManager, config: PrewarmConfig) {
    this.cacheManager = cacheManager;
    this.config = config;
    
    this.statistics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalKeys: 0,
      successKeys: 0,
      failedKeys: 0,
      averageTime: 0,
      lastRun: null
    };
  }

  /**
   * 启动预热服务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('缓存预热服务已经在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('缓存预热服务已启动');

    // 启动定时预热
    this.startScheduledPrewarming();
    
    // 立即执行一次预热
    await this.executePrewarming();
  }

  /**
   * 停止预热服务
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('缓存预热服务未运行');
      return;
    }

    this.isRunning = false;
    logger.info('缓存预热服务已停止');
  }

  /**
   * 手动触发预热
   */
  async triggerManualPrewarm(keys: string[], options: CacheOptions = {}): Promise<string> {
    const taskId = `manual-${Date.now()}`;
    
    const task: PrewarmTask = {
      id: taskId,
      strategyId: 'manual',
      keys,
      options,
      status: 'pending',
      progress: 0
    };

    this.tasks.set(taskId, task);
    this.statistics.totalTasks++;
    this.statistics.totalKeys += keys.length;

    await this.executeTask(task);
    
    return taskId;
  }

  /**
   * 添加预热策略
   */
  addStrategy(strategy: PrewarmStrategy): void {
    const existingIndex = this.config.strategies.findIndex(s => s.id === strategy.id);
    if (existingIndex >= 0) {
      this.config.strategies[existingIndex] = strategy;
    } else {
      this.config.strategies.push(strategy);
    }
    
    // 按优先级排序
    this.config.strategies.sort((a, b) => b.priority - a.priority);
    
    logger.info(`添加预热策略: ${strategy.name}`);
  }

  /**
   * 移除预热策略
   */
  removeStrategy(strategyId: string): void {
    this.config.strategies = this.config.strategies.filter(s => s.id !== strategyId);
    logger.info(`移除预热策略: ${strategyId}`);
  }

  /**
   * 获取预热统计信息
   */
  getStatistics(): PrewarmStatistics {
    return { ...this.statistics };
  }

  /**
   * 获取预热任务状态
   */
  getTaskStatus(taskId: string): PrewarmTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 获取所有预热任务
   */
  getAllTasks(): PrewarmTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 清理已完成的任务
   */
  cleanupCompletedTasks(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const tasksToDelete: string[] = [];
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'completed' && task.endTime && 
          (now - task.endTime.getTime()) > maxAge) {
        tasksToDelete.push(taskId);
      }
    }
    
    tasksToDelete.forEach(taskId => this.tasks.delete(taskId));
    
    if (tasksToDelete.length > 0) {
      logger.info(`清理了 ${tasksToDelete.length} 个已完成的预热任务`);
    }
  }

  // 私有方法

  private startScheduledPrewarming(): void {
    if (!this.config.enabled) return;

    setInterval(async () => {
      if (this.isRunning) {
        await this.executePrewarming();
      }
    }, this.config.interval);
  }

  private async executePrewarming(): Promise<void> {
    if (!this.config.enabled) return;

    logger.info('开始执行缓存预热');

    const enabledStrategies = this.config.strategies.filter(s => s.enabled);
    
    for (const strategy of enabledStrategies) {
      try {
        await this.executeStrategy(strategy);
      } catch (error) {
        logger.error(`预热策略执行失败: ${strategy.name}`, error instanceof Error ? error : new Error(String(error)));
      }
    }

    // 预热关键键
    if (this.config.criticalKeys.length > 0) {
      await this.prewarmCriticalKeys();
    }

    this.statistics.lastRun = new Date();
    logger.info('缓存预热执行完成');
  }

  private async executeStrategy(strategy: PrewarmStrategy): Promise<void> {
    logger.info(`执行预热策略: ${strategy.name}`);

    switch (strategy.type) {
      case 'time-based':
        await this.executeTimeBasedStrategy(strategy);
        break;
      case 'event-based':
        await this.executeEventBasedStrategy(strategy);
        break;
      case 'predictive':
        await this.executePredictiveStrategy(strategy);
        break;
      case 'manual':
        // 手动策略由外部触发
        break;
    }
  }

  private async executeTimeBasedStrategy(strategy: PrewarmStrategy): Promise<void> {
    const { schedule, keys } = strategy.config;
    
    if (!this.shouldExecuteNow(schedule)) {
      return;
    }

    const taskId = `time-based-${strategy.id}-${Date.now()}`;
    const task: PrewarmTask = {
      id: taskId,
      strategyId: strategy.id,
      keys,
      options: strategy.config.cacheOptions || {},
      status: 'pending',
      progress: 0
    };

    this.tasks.set(taskId, task);
    this.statistics.totalTasks++;
    this.statistics.totalKeys += keys.length;

    await this.executeTask(task);
  }

  private async executeEventBasedStrategy(strategy: PrewarmStrategy): Promise<void> {
    const { events, keys } = strategy.config;
    
    // 这里可以根据具体事件来触发预热
    // 例如：系统启动、数据更新、用户活跃等
    for (const event of events) {
      if (this.shouldTriggerEvent(event)) {
        const taskId = `event-based-${strategy.id}-${event}-${Date.now()}`;
        const task: PrewarmTask = {
          id: taskId,
          strategyId: strategy.id,
          keys,
          options: strategy.config.cacheOptions || {},
          status: 'pending',
          progress: 0
        };

        this.tasks.set(taskId, task);
        this.statistics.totalTasks++;
        this.statistics.totalKeys += keys.length;

        await this.executeTask(task);
      }
    }
  }

  private async executePredictiveStrategy(strategy: PrewarmStrategy): Promise<void> {
    const { model, threshold } = strategy.config;
    
    // 使用预测模型确定需要预热的键
    const predictedKeys = await this.predictKeys(model, threshold);
    
    if (predictedKeys.length > 0) {
      const taskId = `predictive-${strategy.id}-${Date.now()}`;
      const task: PrewarmTask = {
        id: taskId,
        strategyId: strategy.id,
        keys: predictedKeys,
        options: strategy.config.cacheOptions || {},
        status: 'pending',
        progress: 0
      };

      this.tasks.set(taskId, task);
      this.statistics.totalTasks++;
      this.statistics.totalKeys += predictedKeys.length;

      await this.executeTask(task);
    }
  }

  private async prewarmCriticalKeys(): Promise<void> {
    const taskId = `critical-${Date.now()}`;
    const task: PrewarmTask = {
      id: taskId,
      strategyId: 'critical',
      keys: this.config.criticalKeys,
      options: { ttl: 600000 }, // 关键键使用更长的TTL
      status: 'pending',
      progress: 0
    };

    this.tasks.set(taskId, task);
    this.statistics.totalTasks++;
    this.statistics.totalKeys += this.config.criticalKeys.length;

    await this.executeTask(task);
  }

  private async executeTask(task: PrewarmTask): Promise<void> {
    if (this.runningTasks.has(task.id)) {
      logger.warn(`预热任务已在运行中: ${task.id}`);
      return;
    }

    task.status = 'running';
    task.startTime = new Date();
    this.runningTasks.add(task.id);

    try {
      const batchSize = this.config.batchSize;
      const totalBatches = Math.ceil(task.keys.length / batchSize);
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < totalBatches; i++) {
        const batch = task.keys.slice(i * batchSize, (i + 1) * batchSize);
        
        const batchResults = await Promise.allSettled(
          batch?.filter(Boolean)?.map(async (key) => {
            try {
              const value = await this.fetchData(key);
              if (value !== null) {
                await this.cacheManager.set(key, value, task.options.ttl);
                return { success: true, key };
              } else {
                return { success: false, key, error: 'No data found' };
              }
            } catch (error) {
              return { success: false, key, error };
            }
          })
        );

        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
          } else {
            failCount++;
          }
        });

        task.progress = ((i + 1) / totalBatches) * 100;
        
        // 批次间延迟，避免压力过大
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      task.status = 'completed';
      task.endTime = new Date();
      
      this.statistics.completedTasks++;
      this.statistics.successKeys += successCount;
      this.statistics.failedKeys += failCount;
      
      // 更新平均时间
      const duration = task.endTime.getTime() - task.startTime.getTime();
      this.updateAverageTime(duration);

      logger.info(`预热任务完成: ${task.id}, 成功: ${successCount}, 失败: ${failCount}`);

    } catch (error) {
      task.status = 'failed';
      task.endTime = new Date();
      task.error = error instanceof Error ? error.message : String(error);
      
      this.statistics.failedTasks++;
      this.statistics.failedKeys += task.keys.length;
      
      logger.error(`预热任务失败: ${task.id}`, error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  private async fetchData(key: string): Promise<any> {
    // 这里应该实现具体的数据获取逻辑
    // 可以根据不同的key类型调用不同的数据源
    return null as any;
  }

  private shouldExecuteNow(schedule: any): boolean {
    // 实现基于时间的调度逻辑
    return true;
  }

  private shouldTriggerEvent(event: string): boolean {
    // 实现事件触发逻辑
    return false;
  }

  private async predictKeys(model: string, threshold: number): Promise<string[]> {
    // 实现预测模型逻辑
    return [];
  }

  private updateAverageTime(duration: number): void {
    const totalTime = this.statistics.averageTime * (this.statistics.completedTasks - 1) + duration;
    this.statistics.averageTime = totalTime / this.statistics.completedTasks;
  }
}

/**
 * 创建默认的缓存预热服务
 */
export function createCacheWarmer(
  cacheManager: UnifiedCacheManager,
  config?: Partial<PrewarmConfig>
): CacheWarmer {
  const defaultConfig: PrewarmConfig = {
    enabled: true,
    strategies: [],
    criticalKeys: [],
    batchSize: 10,
    interval: 5 * 60 * 1000, // 5分钟
    maxConcurrent: 3,
    ...config
  };
  
  return new CacheWarmer(cacheManager, defaultConfig);
}

/**
 * 预定义的预热策略
 */
export const PREDEFINED_STRATEGIES: PrewarmStrategy[] = [
  {
    id: 'startup',
    type: 'event-based',
    name: '系统启动预热',
    description: '系统启动时预热关键数据',
    config: {
      events: ['startup'],
      cacheOptions: { ttl: 600000 }
    },
    enabled: true,
    priority: 10
  },
  {
    id: 'hourly',
    type: 'time-based',
    name: '每小时预热',
    description: '每小时定时预热热点数据',
    config: {
      schedule: { type: 'hourly', minute: 0 },
      cacheOptions: { ttl: 3600000 }
    },
    enabled: true,
    priority: 5
  },
  {
    id: 'predictive',
    type: 'predictive',
    name: '预测性预热',
    description: '基于访问模式预测需要预热的数据',
    config: {
      model: 'simple-frequency',
      threshold: 0.7,
      cacheOptions: { ttl: 1800000 }
    },
    enabled: true,
    priority: 3
  }
];