/**
 * Optimized Circular Buffer FIFO Queue
 * 高性能循环缓冲区FIFO队列，替代Array.splice的O(n)操作
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { ProxyConfig } from '@/lib/utils/proxy-utils';
import fs from 'fs/promises';
import path from 'path';
import { getDataFilePath } from '@/lib/utils/path-utils';

const logger = createLogger('CircularBufferQueue');

export interface CircularBufferOptions {
  capacity: number;
  persistenceFile?: string;
  enablePersistence?: boolean;
  autoSaveInterval?: number;
}

export interface QueueStats {
  size: number;
  capacity: number;
  utilization: number;
  memoryUsage: number;
  totalEnqueued: number;
  totalDequeued: number;
  lastOperationTime: number;
}

export class CircularBufferQueue<T> {
  private buffer: (T | null)[] = [];
  private head: number = 0; // 指向下一个要出队的元素
  private tail: number = 0; // 指向下一个要入队的位置
  private count: number = 0; // 当前元素数量
  private capacity: number;
  private persistenceFile: string;
  private enablePersistence: boolean;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private stats: QueueStats;
  
  // 统计信息
  private totalEnqueued: number = 0;
  private totalDequeued: number = 0;
  private lastOperationTime: number = Date.now();

  constructor(options: CircularBufferOptions) {
    this.capacity = options.capacity;
    this.persistenceFile = options.persistenceFile || getDataFilePath('circular-queue-backup.json');
    this.enablePersistence = options.enablePersistence ?? true;
    
    // 初始化缓冲区
    this.buffer = new Array(this.capacity).fill(null);
    
    // 初始化统计
    this.stats = {
      size: 0,
      capacity: this.capacity,
      utilization: 0,
      memoryUsage: 0,
      totalEnqueued: 0,
      totalDequeued: 0,
      lastOperationTime: this.lastOperationTime
    };
    
    // 启动自动保存
    if (this.enablePersistence && options.autoSaveInterval) {
      this.startAutoSave(options.autoSaveInterval);
    }
    
    logger.info('循环缓冲区队列已初始化', {
      capacity: this.capacity,
      persistenceEnabled: this.enablePersistence,
      persistenceFile: this.persistenceFile
    });
  }

  /**
   * 入队操作 - O(1)时间复杂度
   */
  enqueue(item: T): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (this.count >= this.capacity) {
        logger.warn('队列已满，无法入队', {
          currentSize: this.count,
          capacity: this.capacity
        });
        resolve(false);
        return;
      }

      // 将元素放入tail位置
      this.buffer[this.tail] = item;
      this.tail = (this.tail + 1) % this.capacity;
      this.count++;
      this.totalEnqueued++;
      this.lastOperationTime = Date.now();
      
      // 更新统计
      this.updateStats();
      
      // 异步持久化
      if (this.enablePersistence) {
        setImmediate(() => this.persist());
      }
      
      resolve(true);
    });
  }

  /**
   * 批量入队操作
   */
  async enqueueBatch(items: T[]): Promise<number> {
    let enqueuedCount = 0;
    
    for (const item of items) {
      const success = await this.enqueue(item);
      if (success) {
        enqueuedCount++;
      } else {
        break; // 队列已满
      }
    }
    
    if (enqueuedCount > 0) {
      logger.debug('批量入队完成', {
        requested: items.length,
        enqueued: enqueuedCount,
        currentSize: this.count
      });
    }
    
    return enqueuedCount;
  }

  /**
   * 出队操作 - O(1)时间复杂度
   */
  dequeue(count: number = 1): T[] {
    const result: T[] = [];
    const actualCount = Math.min(count, this.count);
    
    for (let i = 0; i < actualCount; i++) {
      const item = this.buffer[this.head];
      if (item !== null) {
        result.push(item);
        this.buffer[this.head] = null; // 清空位置
        this.head = (this.head + 1) % this.capacity;
        this.count++;
        this.totalDequeued++;
      }
    }
    
    this.count -= actualCount;
    this.lastOperationTime = Date.now();
    
    // 更新统计
    this.updateStats();
    
    // 异步持久化
    if (this.enablePersistence && result.length > 0) {
      setImmediate(() => this.persist());
    }
    
    return result;
  }

  /**
   * 查看队首元素（不移除）
   */
  peek(): T | null {
    if (this.count === 0) {
      return null as any;
    }
    return this.buffer[this.head];
  }

  /**
   * 查看队列中指定数量的元素（不移除）
   */
  peekMultiple(count: number): T[] {
    const result: T[] = [];
    const actualCount = Math.min(count, this.count);
    
    let current = this.head;
    for (let i = 0; i < actualCount; i++) {
      const item = this.buffer[current];
      if (item !== null) {
        result.push(item);
      }
      current = (current + 1) % this.capacity;
    }
    
    return result;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.lastOperationTime = Date.now();
    
    this.updateStats();
    
    if (this.enablePersistence) {
      setImmediate(() => this.persist());
    }
    
    logger.info('队列已清空');
  }

  /**
   * 获取队列当前大小
   */
  size(): number {
    return this.count;
  }

  /**
   * 检查队列是否为空
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * 检查队列是否已满
   */
  isFull(): boolean {
    return this.count >= this.capacity;
  }

  /**
   * 获取队列统计信息
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats = {
      size: this.count,
      capacity: this.capacity,
      utilization: this.count / this.capacity,
      memoryUsage: this.estimateMemoryUsage(),
      totalEnqueued: this.totalEnqueued,
      totalDequeued: this.totalDequeued,
      lastOperationTime: this.lastOperationTime
    };
  }

  /**
   * 估算内存使用（字节）
   */
  private estimateMemoryUsage(): number {
    // 基础对象开销 + 缓冲区数组 + 元素
    const baseOverhead = 200; // 基础对象开销
    const arrayOverhead = this.capacity * 8; // 数组引用（每个8字节）
    
    // 估算元素大小（如果元素是ProxyConfig）
    let elementSize = 0;
    if (this.count > 0 && this.buffer[this.head]) {
      const sample = this.buffer[this.head];
      if (sample && typeof sample === 'object') {
        elementSize = JSON.stringify(sample).length * 2; // 粗略估算
      }
    }
    
    return baseOverhead + arrayOverhead + (this.count * elementSize);
  }

  /**
   * 持久化到文件
   */
  private async persist(): Promise<void> {
    if (!this.enablePersistence) {
      return;
    }

    try {
      // 确保目录存在
      const dir = path.dirname(this.persistenceFile);
      await fs.mkdir(dir, { recursive: true, mode: 0o755 });
      
      // 序列化队列数据
      const data = {
        head: this.head,
        tail: this.tail,
        count: this.count,
        buffer: this.buffer,
        stats: this.stats,
        timestamp: Date.now()
      };
      
      await fs.writeFile(
        this.persistenceFile,
        JSON.stringify(data, null, 2),
        'utf8'
      );
      
    } catch (error) {
      logger.error('队列持久化失败', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 从文件恢复
   */
  async restore(): Promise<boolean> {
    if (!this.enablePersistence) {
      return false;
    }

    try {
      const data = await fs.readFile(this.persistenceFile, 'utf8');
      const backup = JSON.parse(data);
      
      // 验证数据格式
      if (backup.buffer && Array.isArray(backup.buffer) && 
          typeof backup.head === 'number' && 
          typeof backup.tail === 'number' && 
          typeof backup.count === 'number') {
        
        this.head = backup.head;
        this.tail = backup.tail;
        this.count = backup.count;
        this.buffer = backup.buffer;
        
        if (backup.stats) {
          this.stats = backup.stats;
        }
        
        logger.info('队列从持久化文件恢复成功', {
          restoredCount: this.count,
          timestamp: backup.timestamp
        });
        
        return true;
      }
      
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error('队列恢复失败', error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    return false;
  }

  /**
   * 启动自动保存
   */
  private startAutoSave(interval: number): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(() => {
      this.persist().catch(error => {
        logger.error('自动保存失败', error instanceof Error ? error : new Error(String(error)));
      });
    }, interval);
    
    logger.debug('自动保存已启动', { interval });
  }

  /**
   * 停止自动保存
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * 销毁队列
   */
  async destroy(): Promise<void> {
    this.stopAutoSave();
    
    // 最后一次持久化
    if (this.enablePersistence) {
      await this.persist();
    }
    
    this.clear();
    
    logger.info('循环缓冲区队列已销毁');
  }

  /**
   * 调整队列容量
   */
  resize(newCapacity: number): boolean {
    if (newCapacity < this.count) {
      logger.warn('无法缩小容量到小于当前元素数量', {
        currentSize: this.count,
        requestedCapacity: newCapacity
      });
      return false;
    }

    // 创建新缓冲区
    const newBuffer = new Array(newCapacity).fill(null);
    
    // 复制元素
    let current = this.head;
    for (let i = 0; i < this.count; i++) {
      newBuffer[i] = this.buffer[current];
      current = (current + 1) % this.capacity;
    }
    
    // 更新状态
    this.buffer = newBuffer;
    this.capacity = newCapacity;
    this.head = 0;
    this.tail = this.count;
    
    this.updateStats();
    
    logger.info('队列容量已调整', {
      oldCapacity: this.capacity - (newCapacity - this.capacity),
      newCapacity: this.capacity,
      currentSize: this.count
    });
    
    return true;
  }
}