/**
 * Priority FIFO Queue
 * 优先级FIFO队列实现，支持不同优先级的代理处理
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { ProxyConfig } from '@/lib/utils/proxy-utils';
import { CircularBufferQueue } from './circular-buffer-queue';
import { getDataFilePath } from '@/lib/utils/path-utils';

const logger = createLogger('PriorityFIFOQueue');

export interface PriorityLevel {
  level: number;
  name: string;
  weight: number; // 权重，用于计算分配比例
  description: string;
}

export interface PriorityOptions {
  levels: PriorityLevel[];
  defaultLevel: number;
  queueSizePerLevel: number;
  enableStarvationPrevention: boolean;
  starvationThreshold: number; // 防止饥饿的阈值（毫秒）
}

export interface QueueItem<T> {
  data: T;
  priority: number;
  timestamp: number;
  attempts: number;
  metadata?: Record<string, any>;
}

export interface PriorityStats {
  totalItems: number;
  itemsByLevel: Record<number, number>;
  waitTimesByLevel: Record<number, { min: number; max: number; avg: number }>;
  processingRates: Record<number, number>;
  lastBalanceTime: number;
}

export const DEFAULT_PRIORITY_LEVELS: PriorityLevel[] = [
  { level: 1, name: 'critical', weight: 40, description: '关键任务，最高优先级' },
  { level: 2, name: 'high', weight: 30, description: '高优先级任务' },
  { level: 3, name: 'normal', weight: 20, description: '普通优先级任务' },
  { level: 4, name: 'low', weight: 10, description: '低优先级任务' },
];

export class PriorityFIFOQueue<T> {
  private queues: Map<number, CircularBufferQueue<QueueItem<T>>>;
  private options: PriorityOptions;
  private stats: PriorityStats;
  private lastStarvationCheck: number = 0;
  private totalProcessed: number = 0;
  private processingStats: Map<number, { count: number; totalTime: number }> = new Map();
  
  constructor(options: Partial<PriorityOptions> = {}) {
    this.options = {
      levels: options.levels || DEFAULT_PRIORITY_LEVELS,
      defaultLevel: options.defaultLevel || 3,
      queueSizePerLevel: options.queueSizePerLevel || 250,
      enableStarvationPrevention: options.enableStarvationPrevention ?? true,
      starvationThreshold: options.starvationThreshold || 30000, // 30秒
    };
    
    // 初始化各个优先级的队列
    this.queues = new Map();
    for (const level of this.options.levels) {
      const queue = new CircularBufferQueue<QueueItem<T>>({
        capacity: this.options.queueSizePerLevel,
        persistenceFile: getDataFilePath(`priority-queue-${level.name}.json`),
        enablePersistence: true,
        autoSaveInterval: 30000,
      });
      this.queues.set(level.level, queue);
    }
    
    // 初始化统计信息
    this.stats = {
      totalItems: 0,
      itemsByLevel: {},
      waitTimesByLevel: {},
      processingRates: {},
      lastBalanceTime: Date.now(),
    };
    
    // 初始化各优先级统计
    for (const level of this.options.levels) {
      this.stats.itemsByLevel[level.level] = 0;
      this.stats.waitTimesByLevel[level.level] = { min: 0, max: 0, avg: 0 };
      this.stats.processingRates[level.level] = 0;
      this.processingStats.set(level.level, { count: 0, totalTime: 0 });
    }
    
    logger.info('优先级FIFO队列已初始化', {
      levels: this.options.levels,
      defaultLevel: this.options.defaultLevel,
      queueSizePerLevel: this.options.queueSizePerLevel
    });
  }
  
  /**
   * 入队操作
   */
  async enqueue(
    item: T,
    priority: number = this.options.defaultLevel,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    // 验证优先级
    if (!this.queues.has(priority)) {
      logger.warn('无效的优先级，使用默认优先级', {
        requested: priority,
        default: this.options.defaultLevel
      });
      priority = this.options.defaultLevel;
    }
    
    const queueItem: QueueItem<T> = {
      data: item,
      priority,
      timestamp: Date.now(),
      attempts: 0,
      metadata,
    };
    
    const queue = this.queues.get(priority)!;
    const success = await queue.enqueue(queueItem);
    
    if (success) {
      this.stats.itemsByLevel[priority]++;
      this.stats.totalItems++;
      
      logger.debug('项目已入队', {
        priority,
        queueSize: queue.size(),
        totalItems: this.stats.totalItems
      });
      
      // 检查是否需要防止饥饿
      if (this.options.enableStarvationPrevention) {
        this.checkStarvation();
      }
    }
    
    return success;
  }
  
  /**
   * 批量入队
   */
  async enqueueBatch(
    items: T[],
    priority: number = this.options.defaultLevel,
    metadata?: Record<string, any>
  ): Promise<number> {
    const queueItems = items?.filter(Boolean)?.map((item: any) => ({
      data: item,
      priority,
      timestamp: Date.now(),
      attempts: 0,
      metadata,
    }));
    
    const queue = this.queues.get(priority)!;
    const enqueuedCount = await queue.enqueueBatch(queueItems);
    
    if (enqueuedCount > 0) {
      this.stats.itemsByLevel[priority] += enqueuedCount;
      this.stats.totalItems += enqueuedCount;
      
      logger.debug('批量入队完成', {
        priority,
        requested: items.length,
        enqueued: enqueuedCount,
        queueSize: queue.size()
      });
    }
    
    return enqueuedCount;
  }
  
  /**
   * 出队操作 - 基于权重的智能出队
   */
  async dequeue(count: number = 1): Promise<T[]> {
    const result: T[] = [];
    const now = Date.now();
    
    // 计算每个优先级应该分配的数量
    const allocation = this.calculateAllocation(count);
    
    // 按优先级顺序出队
    for (const [priority, allocCount] of Object.entries(allocation)) {
      const priorityNum = parseInt(priority);
      const queue = this.queues.get(priorityNum);
      
      if (queue && allocCount > 0) {
        const items = queue.dequeue(allocCount);
        
        for (const item of items) {
          result.push(item.data);
          
          // 更新等待时间统计
          const waitTime = now - item.timestamp;
          this.updateWaitTimeStats(priorityNum, waitTime);
          
          // 更新处理统计
          this.updateProcessingStats(priorityNum, item);
        }
        
        // 更新队列统计
        this.stats.itemsByLevel[priorityNum] = queue.size();
      }
    }
    
    this.stats.totalItems -= result.length;
    this.totalProcessed += result.length;
    
    // 更新处理率
    this.updateProcessingRates();
    
    return result;
  }
  
  /**
   * 计算分配比例
   */
  private calculateAllocation(totalCount: number): Record<string, number> {
    const allocation: Record<string, number> = {};
    const availableQueues = Array.from(this.queues.entries()).filter(([_, queue]: any) => !queue.isEmpty());
    
    if (availableQueues.length === 0) {
      return allocation;
    }
    
    // 计算总权重
    let totalWeight = 0;
    const weights: Record<number, number> = {};
    
    for (const [level, queue] of availableQueues) {
      const levelConfig = this.options.levels.find((l: any) => l.level === level);
      const weight = levelConfig?.weight || 1;
      
      // 根据队列大小调整权重（防止大队列垄断）
      const queueSize = queue.size();
      const adjustedWeight = weight * Math.sqrt(queueSize);
      
      weights[level] = adjustedWeight;
      totalWeight += adjustedWeight;
    }
    
    // 分配数量
    let remaining = totalCount;
    for (const [level, _] of availableQueues) {
      if (remaining <= 0) break;
      
      const ratio = weights[level] / totalWeight;
      const allocated = Math.min(
        Math.floor(totalCount * ratio),
        remaining
      );
      
      allocation[level] = allocated;
      remaining -= allocated;
    }
    
    // 分配剩余的数量（如果有）
    if (remaining > 0) {
      // 按优先级顺序分配
      const sortedLevels = availableQueues
        .map(([level, _]: any) => level)
        .sort((a, b) => a - b);
      
      for (const level of sortedLevels) {
        if (remaining <= 0) break;
        allocation[level] = (allocation[level] || 0) + 1;
        remaining--;
      }
    }
    
    return allocation;
  }
  
  /**
   * 检查并防止饥饿
   */
  private checkStarvation(): void {
    const now = Date.now();
    
    // 每分钟检查一次
    if (now - this.lastStarvationCheck < 60000) {
      return;
    }
    
    this.lastStarvationCheck = now;
    
    for (const [level, queue] of this.queues) {
      if (queue.isEmpty()) continue;
      
      // 查看队首元素的等待时间
      const items = queue.peekMultiple(1);
      if (items.length > 0) {
        const waitTime = now - items[0].timestamp;
        
        if (waitTime > this.options.starvationThreshold) {
          logger.warn('检测到可能的队列饥饿', {
            priority: level,
            waitTime,
            threshold: this.options.starvationThreshold
          });
          
          // 触发饥饿处理
          this.handleStarvation(level);
        }
      }
    }
  }
  
  /**
   * 处理饥饿情况
   */
  private handleStarvation(priorityLevel: number): void {
    // 临时提高该优先级的权重
    const levelConfig = this.options.levels.find((l: any) => l.level === priorityLevel);
    if (levelConfig) {
      const originalWeight = levelConfig.weight;
      levelConfig.weight = Math.min(levelConfig.weight * 2, 100);
      
      logger.info('已临时提高优先级权重以防止饥饿', {
        priority: priorityLevel,
        originalWeight,
        newWeight: levelConfig.weight
      });
      
      // 5分钟后恢复原权重
      setTimeout(() => {
        levelConfig.weight = originalWeight;
        logger.info('已恢复优先级权重', {
          priority: priorityLevel,
          weight: originalWeight
        });
      }, 5 * 60 * 1000);
    }
  }
  
  /**
   * 更新等待时间统计
   */
  private updateWaitTimeStats(priority: number, waitTime: number): void {
    const stats = this.stats.waitTimesByLevel[priority];
    
    if (stats.min === 0 || waitTime < stats.min) {
      stats.min = waitTime;
    }
    if (waitTime > stats.max) {
      stats.max = waitTime;
    }
    
    // 简单的移动平均
    stats.avg = (stats.avg * 0.9) + (waitTime * 0.1);
  }
  
  /**
   * 更新处理统计
   */
  private updateProcessingStats(priority: number, item: QueueItem<T>): void {
    const procStats = this.processingStats.get(priority);
    if (procStats) {
      procStats.count++;
      // 注意：这里假设处理时间为0，实际应该在外部记录
      procStats.totalTime += 0;
    }
  }
  
  /**
   * 更新处理率
   */
  private updateProcessingRates(): void {
    const now = Date.now();
    const timeWindow = 60000; // 1分钟
    
    for (const [priority, procStats] of this.processingStats) {
      this.stats.processingRates[priority] = 
        (procStats.count / timeWindow) * 1000; // 每秒处理数
    }
  }
  
  /**
   * 获取队列大小
   */
  size(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.size();
    }
    return total;
  }
  
  /**
   * 获取指定优先级的队列大小
   */
  sizeByPriority(priority: number): number {
    const queue = this.queues.get(priority);
    return queue ? queue.size() : 0;
  }
  
  /**
   * 检查是否为空
   */
  isEmpty(): boolean {
    return this.size() === 0;
  }
  
  /**
   * 获取统计信息
   */
  getStats(): PriorityStats {
    return { ...this.stats };
  }
  
  /**
   * 获取详细的队列状态
   */
  getDetailedStatus(): {
    overall: PriorityStats;
    byLevel: Array<{
      level: PriorityLevel;
      size: number;
      capacity: number;
      utilization: number;
      waitTime: { min: number; max: number; avg: number };
      processingRate: number;
    }>;
  } {
    const byLevel = this.options.levels?.filter(Boolean)?.map((levelConfig: any) => {
      const queue = this.queues.get(levelConfig.level);
      const size = queue ? queue.size() : 0;
      const queueStats = queue ? queue.getStats() : null;
      
      return {
        level: levelConfig,
        size,
        capacity: this.options.queueSizePerLevel,
        utilization: size / this.options.queueSizePerLevel,
        waitTime: this.stats.waitTimesByLevel[levelConfig.level],
        processingRate: this.stats.processingRates[levelConfig.level],
      };
    });
    
    return {
      overall: this.getStats(),
      byLevel,
    };
  }
  
  /**
   * 重新平衡队列
   */
  rebalance(): void {
    this.stats.lastBalanceTime = Date.now();
    
    // 可以在这里实现更复杂的重新平衡逻辑
    logger.info('优先级队列已重新平衡', {
      totalItems: this.stats.totalItems,
      timestamp: this.stats.lastBalanceTime
    });
  }
  
  /**
   * 清空所有队列
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.clear();
    }
    
    // 重置统计
    this.stats.totalItems = 0;
    for (const level of this.options.levels) {
      this.stats.itemsByLevel[level.level] = 0;
      this.stats.waitTimesByLevel[level.level] = { min: 0, max: 0, avg: 0 };
    }
    
    logger.info('优先级队列已清空');
  }
  
  /**
   * 销毁队列
   */
  async destroy(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.destroy();
    }
    this.queues.clear();
    this.processingStats.clear();
    
    logger.info('优先级队列已销毁');
  }
}