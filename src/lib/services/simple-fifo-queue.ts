/**
 * Simple FIFO Queue
 * 简化版FIFO队列实现，移除优先级功能，仅保留基本的FIFO操作
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { CircularBufferQueue } from './circular-buffer-queue';
import { getDataFilePath } from '@/lib/utils/path-utils';

const logger = createLogger('SimpleFIFOQueue');

export interface SimpleQueueOptions {
  capacity: number;
  persistenceFile?: string;
  enablePersistence?: boolean;
  autoSaveInterval?: number;
}

export interface SimpleQueueStats {
  size: number;
  capacity: number;
  utilization: number;
  totalEnqueued: number;
  totalDequeued: number;
  lastOperationTime: number;
}

export class SimpleFIFOQueue<T> {
  private queue: CircularBufferQueue<T>;
  private options: SimpleQueueOptions;
  private stats: SimpleQueueStats;
  
  constructor(options: SimpleQueueOptions) {
    this.options = {
      ...options,
      enablePersistence: options.enablePersistence ?? true,
      autoSaveInterval: options.autoSaveInterval ?? 30000,
    };
    
    // 使用循环缓冲区作为底层实现
    this.queue = new CircularBufferQueue<T>({
      capacity: this.options.capacity,
      persistenceFile: this.options.persistenceFile || getDataFilePath('simple-fifo-queue.json'),
      enablePersistence: this.options.enablePersistence,
      autoSaveInterval: this.options.autoSaveInterval,
    });
    
    // 初始化统计信息
    this.stats = {
      size: 0,
      capacity: this.options.capacity,
      utilization: 0,
      totalEnqueued: 0,
      totalDequeued: 0,
      lastOperationTime: Date.now()
    };
    
    logger.info('简化FIFO队列已初始化', {
      capacity: this.options.capacity,
      persistenceEnabled: this.options.enablePersistence
    });
  }
  
  /**
   * 入队操作
   */
  async enqueue(item: T): Promise<boolean> {
    const success = await this.queue.enqueue(item);
    
    if (success) {
      this.stats.totalEnqueued++;
      this.stats.lastOperationTime = Date.now();
      this.updateStats();
      
      logger.debug('项目已入队', {
        queueSize: this.size(),
        totalItems: this.stats.totalEnqueued
      });
    }
    
    return success;
  }
  
  /**
   * 批量入队
   */
  async enqueueBatch(items: T[]): Promise<number> {
    const enqueuedCount = await this.queue.enqueueBatch(items);
    
    if (enqueuedCount > 0) {
      this.stats.totalEnqueued += enqueuedCount;
      this.stats.lastOperationTime = Date.now();
      this.updateStats();
      
      logger.debug('批量入队完成', {
        requested: items.length,
        enqueued: enqueuedCount,
        currentSize: this.size()
      });
    }
    
    return enqueuedCount;
  }
  
  /**
   * 出队操作
   */
  async dequeue(count: number = 1): Promise<T[]> {
    const items = this.queue.dequeue(count);
    
    if (items.length > 0) {
      this.stats.totalDequeued += items.length;
      this.stats.lastOperationTime = Date.now();
      this.updateStats();
    }
    
    return items;
  }
  
  /**
   * 查看队首元素（不移除）
   */
  peek(): T | null {
    return this.queue.peek();
  }
  
  /**
   * 查看队列中的元素（不移除）
   */
  peekMultiple(count: number): T[] {
    return this.queue.peekMultiple(count);
  }
  
  /**
   * 获取队列大小
   */
  size(): number {
    return this.queue.size();
  }
  
  /**
   * 检查队列是否为空
   */
  isEmpty(): boolean {
    return this.queue.isEmpty();
  }
  
  /**
   * 检查队列是否已满
   */
  isFull(): boolean {
    return this.queue.isFull();
  }
  
  /**
   * 清空队列
   */
  clear(): void {
    this.queue.clear();
    this.stats.lastOperationTime = Date.now();
    this.updateStats();
    
    logger.info('队列已清空');
  }
  
  /**
   * 获取统计信息
   */
  getStats(): SimpleQueueStats {
    return { ...this.stats };
  }
  
  /**
   * 更新统计信息
   */
  private updateStats(): void {
    const queueStats = this.queue.getStats();
    this.stats = {
      size: queueStats.size,
      capacity: this.options.capacity,
      utilization: queueStats.utilization,
      totalEnqueued: this.stats.totalEnqueued,
      totalDequeued: this.stats.totalDequeued,
      lastOperationTime: this.stats.lastOperationTime
    };
  }
  
  /**
   * 调整队列容量
   */
  resize(newCapacity: number): boolean {
    const success = this.queue.resize(newCapacity);
    if (success) {
      this.options.capacity = newCapacity;
      this.updateStats();
    }
    return success;
  }
  
  /**
   * 从文件恢复
   */
  async restore(): Promise<boolean> {
    const success = await this.queue.restore();
    if (success) {
      this.updateStats();
      logger.info('队列已从持久化文件恢复');
    }
    return success;
  }
  
  /**
   * 销毁队列
   */
  async destroy(): Promise<void> {
    await this.queue.destroy();
    logger.info('简化FIFO队列已销毁');
  }
}

// 导出默认配置
export const DEFAULT_SIMPLE_QUEUE_OPTIONS: SimpleQueueOptions = {
  capacity: 1000,
  enablePersistence: true,
  autoSaveInterval: 30000,
};