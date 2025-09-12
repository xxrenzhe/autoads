/**
 * Object Pool Manager
 * 对象池管理器
 * 
 * 实现通用的对象池管理，用于复用昂贵的对象（如浏览器实例、HTTP客户端等）
 */

import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('ObjectPoolManager');

interface PoolConfig<T> {
  // 对象创建工厂函数
  factory: () => Promise<T>;
  
  // 对象销毁函数
  destroyer?: (obj: T) => Promise<void> | void;
  
  // 对象重置函数（在回收时调用）
  reset?: (obj: T) => Promise<void> | void;
  
  // 对象验证函数（检查对象是否仍然有效）
  validator?: (obj: T) => Promise<boolean> | boolean;
  
  // 最大池大小
  maxPoolSize: number;
  
  // 最小池大小（保持的空闲对象数量）
  minPoolSize: number;
  
  // 对象最大空闲时间（毫秒）
  maxIdleTime: number;
  
  // 获取对象超时时间（毫秒）
  acquisitionTimeout: number;
  
  // 是否启用健康检查
  enableHealthCheck: boolean;
  
  // 健康检查间隔（毫秒）
  healthCheckInterval: number;
}

interface PoolObject<T> {
  // 池对象
  object: T;
  
  // 创建时间
  createdAt: number;
  
  // 最后使用时间
  lastUsedAt: number;
  
  // 使用次数
  useCount: number;
  
  // 是否正在使用
  inUse: boolean;
  
  // 是否被标记为销毁
  markedForDestruction: boolean;
}

interface PoolStatistics {
  // 池大小
  poolSize: number;
  
  // 空闲对象数
  idleCount: number;
  
  // 正在使用的对象数
  activeCount: number;
  
  // 等待获取对象的任务数
  waitingCount: number;
  
  // 总创建对象数
  totalCreated: number;
  
  // 总销毁对象数
  totalDestroyed: number;
  
  // 总获取次数
  totalAcquisitions: number;
  
  // 总释放次数
  totalReleases: number;
  
  // 平均等待时间
  averageWaitTime: number;
  
  // 命中率（从池中获取的比例）
  hitRate: number;
}

const DEFAULT_POOL_CONFIG: Partial<PoolConfig<any>> = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTime: 5 * 60 * 1000, // 5分钟
  acquisitionTimeout: 30000, // 30秒
  enableHealthCheck: true,
  healthCheckInterval: 60 * 1000 // 1分钟
};

export class ObjectPool<T> {
  private config: PoolConfig<T>;
  private pool: Map<string, PoolObject<T>> = new Map();
  private waitingQueue: Array<{
    resolve: (obj: T) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  
  // 统计信息
  private stats: PoolStatistics = {
    poolSize: 0,
    idleCount: 0,
    activeCount: 0,
    waitingCount: 0,
    totalCreated: 0,
    totalDestroyed: 0,
    totalAcquisitions: 0,
    totalReleases: 0,
    averageWaitTime: 0,
    hitRate: 0
  };
  
  private totalWaitTime = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isDestroyed = false;
  
  constructor(config: PoolConfig<T>) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config } as PoolConfig<T>;
    
    // 启动健康检查
    if (this.config.enableHealthCheck) {
      this.startHealthCheck();
    }
    
    // 启动清理任务
    this.startCleanupTask();
    
    logger.info('对象池已创建', {
      maxPoolSize: this.config.maxPoolSize,
      minPoolSize: this.config.minPoolSize,
      maxIdleTime: this.config.maxIdleTime
    });
  }
  
  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 获取对象
   */
  async acquire(): Promise<T> {
    if (this.isDestroyed) {
      throw new Error('对象池已被销毁');
    }
    
    const startTime = Date.now();
    
    // 尝试从池中获取空闲对象
    for (const [id, poolObj] of this.pool.entries()) {
      if (!poolObj.inUse && !poolObj.markedForDestruction) {
        // 验证对象是否仍然有效
        if (this.config.validator) {
          try {
            const isValid = await this.config.validator(poolObj.object);
            if (!isValid) {
              // 对象无效，销毁并继续查找
              this.destroyObject(id, poolObj);
              continue;
            }
          } catch (error) {
            logger.warn('对象验证失败，销毁对象', {
              id,
              error: error instanceof Error ? error.message : String(error)
            });
            this.destroyObject(id, poolObj);
            continue;
          }
        }
        
        // 找到可用对象
        poolObj.inUse = true;
        poolObj.lastUsedAt = Date.now();
        poolObj.useCount++;
        
        this.updateStats('acquire', true);
        
        logger.debug('从池中获取对象', {
          id,
          useCount: poolObj.useCount,
          idleTime: Date.now() - poolObj.lastUsedAt
        });
        
        return poolObj.object;
      }
    }
    
    // 池中没有可用对象，创建新对象
    if (this.pool.size < this.config.maxPoolSize) {
      return this.createNewObject();
    }
    
    // 池已满，等待其他对象释放
    return this.waitForAvailableObject(startTime);
  }
  
  /**
   * 创建新对象
   */
  private async createNewObject(): Promise<T> {
    const id = this.generateId();
    const startTime = Date.now();
    
    try {
      const object = await this.config.factory();
      
      const poolObj: PoolObject<T> = {
        object,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        useCount: 0,
        inUse: true,
        markedForDestruction: false
      };
      
      this.pool.set(id, poolObj);
      this.updateStats('create');
      
      logger.debug('创建新对象', {
        id,
        createTime: Date.now() - startTime,
        poolSize: this.pool.size
      });
      
      return object;
      
    } catch (error) {
      logger.error('创建对象失败', error instanceof Error ? error : undefined);
      throw error;
    }
  }
  
  /**
   * 等待可用对象
   */
  private async waitForAvailableObject(startTime: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
          this.updateStats('waitTimeout');
        }
        reject(new Error(`获取对象超时（${this.config.acquisitionTimeout}ms）`));
      }, this.config.acquisitionTimeout);
      
      this.waitingQueue.push({
        resolve: (obj: T) => {
          clearTimeout(timeout);
          this.totalWaitTime += Date.now() - startTime;
          resolve(obj);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: startTime
      });
      
      this.updateStats('wait');
    });
  }
  
  /**
   * 释放对象回池中
   */
  async release(object: T): Promise<void> {
    if (this.isDestroyed) {
      return;
    }
    
    // 查找对象
    let foundId: string | null = null;
    let foundPoolObj: PoolObject<T> | null = null;
    
    for (const [id, poolObj] of this.pool.entries()) {
      if (poolObj.object === object && poolObj.inUse) {
        foundId = id;
        foundPoolObj = poolObj;
        break;
      }
    }
    
    if (!foundId || !foundPoolObj) {
      logger.warn('尝试释放不存在的对象或对象已被释放');
      return;
    }
    
    // 重置对象
    if (this.config.reset) {
      try {
        await this.config.reset(object);
      } catch (error) {
        logger.warn('重置对象失败，将销毁对象', {
          id: foundId,
          error: error instanceof Error ? error.message : String(error)
        });
        this.destroyObject(foundId, foundPoolObj);
        return;
      }
    }
    
    // 释放对象
    foundPoolObj.inUse = false;
    foundPoolObj.lastUsedAt = Date.now();
    
    this.updateStats('release');
    
    logger.debug('释放对象回池中', {
      id: foundId,
      useCount: foundPoolObj.useCount,
      idleObjects: this.getIdleCount()
    });
    
    // 检查是否有等待的任务
    this.processWaitingQueue();
  }
  
  /**
   * 处理等待队列
   */
  private processWaitingQueue(): void {
    if (this.waitingQueue.length === 0) {
      return;
    }
    
    // 查找空闲对象
    for (const [id, poolObj] of this.pool.entries()) {
      if (!poolObj.inUse && !poolObj.markedForDestruction && this.waitingQueue.length > 0) {
        const waiting = this.waitingQueue.shift();
        if (waiting) {
          // 验证对象
          if (this.config.validator) {
            try {
              const isValid = this.config.validator(poolObj.object);
              if (!isValid) {
                this.destroyObject(id, poolObj);
                // 继续处理下一个等待任务
                this.processWaitingQueue();
                return;
              }
            } catch (error) {
              this.destroyObject(id, poolObj);
              this.processWaitingQueue();
              return;
            }
          }
          
          // 分配对象
          poolObj.inUse = true;
          poolObj.lastUsedAt = Date.now();
          poolObj.useCount++;
          
          this.updateStats('acquire', false);
          
          logger.debug('分配对象给等待任务', {
            id,
            waitTime: Date.now() - waiting.timestamp
          });
          
          waiting.resolve(poolObj.object);
        }
      }
    }
  }
  
  /**
   * 销毁对象
   */
  private async destroyObject(id: string, poolObj: PoolObject<T>): Promise<void> {
    this.pool.delete(id);
    
    if (this.config.destroyer) {
      try {
        await this.config.destroyer(poolObj.object);
      } catch (error) {
        logger.warn('销毁对象失败', {
          id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    this.updateStats('destroy');
    
    logger.debug('销毁对象', {
      id,
      useCount: poolObj.useCount,
      lifetime: Date.now() - poolObj.createdAt
    });
  }
  
  /**
   * 获取空闲对象数量
   */
  private getIdleCount(): number {
    let count = 0;
    for (const poolObj of this.pool.values()) {
      if (!poolObj.inUse && !poolObj.markedForDestruction) {
        count++;
      }
    }
    return count;
  }
  
  /**
   * 更新统计信息
   */
  private updateStats(action: 'create' | 'destroy' | 'acquire' | 'release' | 'wait' | 'waitTimeout', fromPool?: boolean): void {
    switch (action) {
      case 'create':
        this.stats.totalCreated++;
        this.stats.poolSize = this.pool.size;
        break;
      case 'destroy':
        this.stats.totalDestroyed++;
        this.stats.poolSize = this.pool.size;
        break;
      case 'acquire':
        this.stats.totalAcquisitions++;
        this.stats.activeCount++;
        if (fromPool !== false) {
          this.stats.idleCount--;
        }
        // 计算命中率
        if (this.stats.totalAcquisitions > 0) {
          this.stats.hitRate = (this.stats.totalAcquisitions - this.stats.totalCreated) / this.stats.totalAcquisitions;
        }
        break;
      case 'release':
        this.stats.totalReleases++;
        this.stats.activeCount--;
        this.stats.idleCount++;
        break;
      case 'wait':
        this.stats.waitingCount = this.waitingQueue.length;
        break;
      case 'waitTimeout':
        this.stats.waitingCount = this.waitingQueue.length;
        break;
    }
    
    // 计算平均等待时间
    if (this.stats.totalAcquisitions > 0) {
      this.stats.averageWaitTime = this.totalWaitTime / this.stats.totalAcquisitions;
    }
  }
  
  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(async () => {
      if (this.isDestroyed) return;
      
      const now = Date.now();
      const objectsToDestroy: string[] = [];
      
      for (const [id, poolObj] of this.pool.entries()) {
        // 检查空闲时间过长的对象
        if (!poolObj.inUse && now - poolObj.lastUsedAt > this.config.maxIdleTime) {
          objectsToDestroy.push(id);
          continue;
        }
        
        // 健康检查
        if (!poolObj.inUse && this.config.validator) {
          try {
            const isValid = await this.config.validator(poolObj.object);
            if (!isValid) {
              objectsToDestroy.push(id);
            }
          } catch (error) {
            logger.warn('健康检查失败', {
              id,
              error: error instanceof Error ? error.message : String(error)
            });
            objectsToDestroy.push(id);
          }
        }
      }
      
      // 销毁无效对象
      for (const id of objectsToDestroy) {
        const poolObj = this.pool.get(id);
        if (poolObj) {
          await this.destroyObject(id, poolObj);
        }
      }
      
      // 如果池大小小于最小值，创建新对象
      const idleCount = this.getIdleCount();
      if (idleCount < this.config.minPoolSize && this.pool.size < this.config.maxPoolSize) {
        const toCreate = Math.min(
          this.config.minPoolSize - idleCount,
          this.config.maxPoolSize - this.pool.size
        );
        
        for (let i = 0; i < toCreate; i++) {
          this.createNewObject().then(obj => {
            // 创建后立即释放，使其成为空闲对象
            this.release(obj);
          }).catch(error => {
            logger.error('预创建对象失败', error instanceof Error ? error : undefined);
          });
        }
      }
      
    }, this.config.healthCheckInterval);
  }
  
  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    // 每分钟执行一次清理
    this.cleanupTimer = setInterval(() => {
      if (this.isDestroyed) return;
      
      // 清理等待队列中超时的任务
      const now = Date.now();
      const timedOutWaits = this.waitingQueue.filter(
        w => now - w.timestamp > this.config.acquisitionTimeout
      );
      
      timedOutWaits.forEach(wait => {
        wait.reject(new Error('获取对象超时'));
        const index = this.waitingQueue.indexOf(wait);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }
      });
      
    }, 60000);
  }
  
  /**
   * 获取统计信息
   */
  getStatistics(): PoolStatistics {
    return {
      ...this.stats,
      idleCount: this.getIdleCount(),
      waitingCount: this.waitingQueue.length,
      hitRate: Math.round(this.stats.hitRate * 10000) / 100 // 保留两位小数
    };
  }
  
  /**
   * 获取池的详细信息
   */
  getDetailedInfo(): {
    config: PoolConfig<T>;
    statistics: PoolStatistics;
    objects: Array<{
      id: string;
      inUse: boolean;
      useCount: number;
      age: number;
      idleTime: number;
    }>;
  } {
    const objects = Array.from(this.pool.entries()).map(([id, poolObj]) => ({
      id,
      inUse: poolObj.inUse,
      useCount: poolObj.useCount,
      age: Date.now() - poolObj.createdAt,
      idleTime: poolObj.inUse ? 0 : Date.now() - poolObj.lastUsedAt
    }));
    
    return {
      config: this.config,
      statistics: this.getStatistics(),
      objects
    };
  }
  
  /**
   * 清理池
   */
  async clear(): Promise<void> {
    // 销毁所有对象
    const destroyPromises = Array.from(this.pool.entries()).map(([id, poolObj]) => 
      this.destroyObject(id, poolObj)
    );
    
    await Promise.allSettled(destroyPromises);
    
    // 清空等待队列
    const waitingTasks = [...this.waitingQueue];
    this.waitingQueue = [];
    waitingTasks.forEach(wait => {
      wait.reject(new Error('对象池已清理'));
    });
    
    logger.info('对象池已清理');
  }
  
  /**
   * 销毁池
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }
    
    this.isDestroyed = true;
    
    // 停止定时器
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // 清理池
    await this.clear();
    
    logger.info('对象池已销毁');
  }
}

// 导出工厂函数
export function createObjectPool<T>(config: PoolConfig<T>): ObjectPool<T> {
  return new ObjectPool<T>(config);
}