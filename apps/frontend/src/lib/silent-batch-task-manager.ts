/**
 * 静默批量打开任务管理器
 * 提供全局任务存储和管理功能
 */


// 声明全局类型
declare global {
  var silentBatchTasks: Map<string, any> | undefined;
}

// 初始化全局任务存储
if (!global.silentBatchTasks) {
  global.silentBatchTasks = new Map();
}

export class SilentBatchTaskManager {
  private static instance: SilentBatchTaskManager;
  private lock: Promise<void> = Promise.resolve();
  
  private constructor() {}

  static getInstance(): SilentBatchTaskManager {
    if (!SilentBatchTaskManager.instance) {
      SilentBatchTaskManager.instance = new SilentBatchTaskManager();
    }
    return SilentBatchTaskManager.instance;
  }

  /**
   * 获取锁以确保线程安全
   */
  private async acquireLock(): Promise<() => void> {
    const oldLock = this.lock;
    let releaseLock: () => void;
    
    this.lock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    
    await oldLock;
    return releaseLock!;
  }

  // 添加或更新任务（线程安全）- 增强代理操作支持
  async setTask(taskId: string, status: any): Promise<void> {
    const releaseLock = await this.acquireLock();
    
    try {
      if (global.silentBatchTasks) {
        const now = Date.now();
        const existingTask = global.silentBatchTasks.get(taskId);
        
        // 验证成功和失败计数，确保逻辑一致性
        const total = status.total ?? existingTask?.total ?? 0;
        const incomingSuccessCount = status.successCount ?? 0;
        const incomingFailCount = status.failCount ?? 0;
        const pendingCount = status.pendingCount ?? Math.max(0, total - incomingSuccessCount - incomingFailCount);
        
        // 使用传入的值，如果没有则使用现有值
        const successCount = Math.min(incomingSuccessCount, total);
        const failCount = Math.min(incomingFailCount, total - successCount);
        
        // 简化的状态跟踪
        const proxyStats = this.extractProxyStats(status);

        const updatedTask = {
          ...status,
          successCount,
          failCount,
          pendingCount,
          total,
          updatedAt: now,
          proxyStats: {
            ...existingTask?.proxyStats,
            ...proxyStats
          }
        };
        
        global.silentBatchTasks.set(taskId, updatedTask);
        
        // 注释：WebSocket进展推送已移除，现在使用HTTP轮询方式
        // 进展更新通过API端点获取，无需主动推送
        
        // 记录任务状态变更（仅在服务端）
        if (typeof window === 'undefined') {
          // 动态导入logger以避免循环依赖
          import('./utils/security/secure-logger').then(({ createLogger }) => {
            const logger = createLogger('SilentBatchTaskManager');
            
            // 检测状态变更
            if (existingTask && existingTask.status !== status.status) {
              logger.info('任务状态变更', {
                taskId,
                from: existingTask.status,
                to: status.status,
                message: status.message
              });
            }
            
            }).catch(() => {
            // 静默处理logger导入错误
          });
        }
      }
    } finally {
      releaseLock();
    }
  }

  // 获取任务状态
  getTask(taskId: string) {
    return global.silentBatchTasks?.get(taskId);
  }


  /**
   * 从状态消息中提取代理统计信息
   */
  private extractProxyStats(status: any): any {
    const stats: any = {};
    const message = status.message || '';
    
    // 提取代理数量信息
    const proxyCountMatch = message.match(/(\d+)\s*个?\s*代理/);
    if (proxyCountMatch) {
      stats.currentProxyCount = parseInt(proxyCountMatch[1]);
    }
    
    // 提取获取进度信息 (例如: "代理IP获取中... (5/10)")
    const progressMatch = message.match(/\((\d+)\/(\d+)\)/);
    if (progressMatch) {
      stats.currentCount = parseInt(progressMatch[1]);
      stats.targetCount = parseInt(progressMatch[2]);
      stats.acquisitionProgress = Math.round((stats.currentCount / stats.targetCount) * 100);
    }
    
    // 提取代理来源信息
    if (message.includes('缓存')) {
      stats.source = 'cache';
    } else if (message.includes('批量获取') || message.includes('batch')) {
      stats.source = 'batch';
    } else if (message.includes('个别获取') || message.includes('individual')) {
      stats.source = 'individual';
    }
    
    // 提取代理策略信息
    if (message.includes('智能复用') || message.includes('优化')) {
      stats.strategy = 'optimized';
    } else if (message.includes('FIFO') || message.includes('先进先出')) {
      stats.strategy = 'fifo';
    } else if (message.includes('轮询') || message.includes('round-robin')) {
      stats.strategy = 'round-robin';
    }
    
    // 提取警告信息
    if (message.includes('不足') || message.includes('shortage')) {
      stats.hasShortage = true;
    }
    if (message.includes('降级') || message.includes('fallback')) {
      stats.usingFallback = true;
    }
    
    return stats;
  }




  /**
   * 设置代理短缺警告
   */
  async setProxyShortageWarning(taskId: string, shortageInfo: {
    required: number;
    available: number;
    shortage: number;
    recommendation: string;
  }): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) {
      return;
    }
    
    const shortagePercent = Math.round((shortageInfo.shortage / shortageInfo.required) * 100);
    const warningMessage = `代理不足警告: 需要${shortageInfo.required}个，可用${shortageInfo.available}个 (缺少${shortagePercent}%)`;
    
    await this.setTask(taskId, {
      ...task,
      message: warningMessage,
      proxyShortageWarning: {
        ...shortageInfo,
        shortagePercent,
        timestamp: Date.now()
      }
    });
  }

  // 安全获取任务状态（带锁）
  async getTaskSafe(taskId: string): Promise<any | undefined> {
    const releaseLock = await this.acquireLock();
    
    try {
      return global.silentBatchTasks?.get(taskId);
    } finally {
      releaseLock();
    }
  }

  // 删除任务
  removeTask(taskId: string) {
    return global.silentBatchTasks?.delete(taskId) || false;
  }

  // 获取所有任务
  getAllTasks() {
    return global.silentBatchTasks ? Array.from(global.silentBatchTasks.entries()) : [];
  }

  // 清理过期任务（增强版）
  cleanupExpiredTasks() {
    const now = Date.now();
    const config = this.getAdaptiveTaskLifecycle();
    
    if (global.silentBatchTasks) {
      const initialSize = global.silentBatchTasks.size;
      let cleanedCount = 0;
      const cleanupReasons = new Map<string, number>();
      
      for (const [taskId, task] of global.silentBatchTasks) {
        const taskAge = now - task.updatedAt;
        let shouldClean = false;
        let reason = '';
        
        // 根据任务状态决定清理时间
        switch (task.status) {
          case 'failed':
            if (taskAge > config.FAILED) {
              shouldClean = true;
              reason = 'failed';
            }
            break;
          case 'completed':
            if (taskAge > config.COMPLETED) {
              shouldClean = true;
              reason = 'completed';
            }
            break;
          case 'terminated':
            if (taskAge > config.TERMINATED) {
              shouldClean = true;
              reason = 'terminated';
            }
            break;
          case 'idle':
          case 'pending':
            if (taskAge > config.IDLE) {
              shouldClean = true;
              reason = 'idle';
            }
            break;
          default:
            // 其他状态任务使用过期时间
            if (taskAge > config.EXPIRED) {
              shouldClean = true;
              reason = 'expired';
            }
        }
        
        // 强制清理超过最大限制的任务
        if (global.silentBatchTasks.size > TASK_MANAGER_CONFIG.MEMORY_MONITOR.MAX_TASKS) {
          shouldClean = true;
          reason = 'overflow';
        }
        
        if (shouldClean) {
          global.silentBatchTasks.delete(taskId);
          cleanedCount++;
          cleanupReasons.set(reason, (cleanupReasons.get(reason) || 0) + 1);
          
          // 记录清理日志
          if (typeof window === 'undefined') {
            import('./utils/security/secure-logger').then(({ createLogger }) => {
              const logger = createLogger('SilentBatchTaskManager');
              logger.info('清理任务', {
                taskId,
                taskAge: `${Math.round(taskAge / 1000 / 60)}分钟`,
                status: task.status,
                reason
              });
            }).catch(() => {
              // 静默处理logger导入错误
            });
          }
        }
      }
      
      // 记录清理统计
      if (cleanedCount > 0 && typeof window === 'undefined') {
        import('./utils/security/secure-logger').then(({ createLogger }) => {
          const logger = createLogger('SilentBatchTaskManager');
          logger.info('任务清理完成', {
            initialSize,
            cleanedCount,
            remainingSize: global.silentBatchTasks!.size,
            cleanupReasons: Object.fromEntries(cleanupReasons)
          });
        }).catch(() => {
          // 静默处理logger导入错误
        });
      }
    }
  }

  // 激进清理所有已完成和失败的任务（4GB优化）
  aggressiveCleanup(): number {
    if (!global.silentBatchTasks) return 0;
    
    const initialSize = global.silentBatchTasks.size;
    let cleanedCount = 0;
    
    for (const [taskId, task] of global.silentBatchTasks) {
      if (['completed', 'failed', 'terminated'].includes(task.status)) {
        global.silentBatchTasks.delete(taskId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0 && typeof window === 'undefined') {
      import('./utils/security/secure-logger').then(({ createLogger }) => {
        const logger = createLogger('SilentBatchTaskManager');
        logger.warn('激进清理完成', {
          initialSize,
          cleanedCount,
          remainingSize: global.silentBatchTasks!.size
        });
      }).catch(() => {});
    }
    
    return cleanedCount;
  }

  // 获取系统负载状态
  private getSystemLoadStatus(): { isHighLoad: boolean; cpuUsage?: number; memoryUsage?: number } {
    try {
      // 在Node.js环境中获取系统信息
      if (typeof window === 'undefined' && typeof process !== 'undefined') {
        const memUsage = process.memoryUsage();
        // eslint-disable-next-line
        const os = require('os');
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = usedMemory / totalMemory;
        
        // 获取CPU使用率（简化版本）
        const cpuUsage = process.cpuUsage();
        const cpuUsagePercent = Math.min((cpuUsage.user + cpuUsage.system) / 1000000 / 100, 1);
        
        const isHighLoad = memoryUsagePercent > TASK_MANAGER_CONFIG.ADAPTIVE.HIGH_LOAD_THRESHOLD ||
                         cpuUsagePercent > TASK_MANAGER_CONFIG.ADAPTIVE.HIGH_LOAD_THRESHOLD;
        
        return {
          isHighLoad,
          cpuUsage: cpuUsagePercent,
          memoryUsage: memoryUsagePercent
        };
      }
    } catch (error) {
      // 如果无法获取系统信息，返回默认状态
      return { isHighLoad: false };
    }
    
    return { isHighLoad: false };
  }

  // 获取自适应清理间隔
  private getAdaptiveCleanupInterval(): number {
    const systemLoad = this.getSystemLoadStatus();
    const baseInterval = TASK_MANAGER_CONFIG.CLEANUP_INTERVAL;
    
    if (systemLoad.isHighLoad) {
      // 高负载时使用更短的清理间隔
      return Math.max(
        TASK_MANAGER_CONFIG.ADAPTIVE.MIN_CLEANUP_INTERVAL,
        baseInterval / TASK_MANAGER_CONFIG.ADAPTIVE.CLEANUP_MULTIPLIER
      );
    }
    
    return Math.min(baseInterval, TASK_MANAGER_CONFIG.ADAPTIVE.MAX_CLEANUP_INTERVAL);
  }

  // 获取自适应任务生命周期配置
  private getAdaptiveTaskLifecycle() {
    const systemLoad = this.getSystemLoadStatus();
    const baseLifecycle = TASK_MANAGER_CONFIG.TASK_LIFECYCLE;
    
    if (systemLoad.isHighLoad) {
      // 高负载时缩短任务生命周期
      const multiplier = TASK_MANAGER_CONFIG.ADAPTIVE.TASK_LIFECYCLE_MULTIPLIER;
      return {
        EXPIRED: baseLifecycle.EXPIRED * multiplier,
        FAILED: baseLifecycle.FAILED * multiplier,
        COMPLETED: baseLifecycle.COMPLETED * multiplier,
        TERMINATED: baseLifecycle.TERMINATED * multiplier,
        IDLE: baseLifecycle.IDLE * multiplier
      };
    }
    
    return baseLifecycle;
  }

  // 监控内存使用情况
  monitorMemoryUsage() {
    if (!global.silentBatchTasks) return;
    
    const taskCount = global.silentBatchTasks.size;
    const config = TASK_MANAGER_CONFIG.MEMORY_MONITOR;
    const systemLoad = this.getSystemLoadStatus();
    
    if (taskCount > config.CRITICAL_THRESHOLD) {
      // 强制清理最旧的任务
      this.forceCleanupOldestTasks(taskCount - config.WARNING_THRESHOLD);
      
      if (typeof window === 'undefined') {
        import('./utils/security/secure-logger').then(({ createLogger }) => {
          const logger = createLogger('SilentBatchTaskManager');
          logger.warn('内存使用达到临界阈值，强制清理任务', {
            taskCount,
            threshold: config.CRITICAL_THRESHOLD,
            systemLoad: {
              isHighLoad: systemLoad.isHighLoad,
              cpuUsage: systemLoad.cpuUsage,
              memoryUsage: systemLoad.memoryUsage
            },
            action: 'force_cleanup'
          });
        }).catch(() => {
          // 静默处理logger导入错误
        });
      }
    } else if (taskCount > config.WARNING_THRESHOLD) {
      // 发出警告
      if (typeof window === 'undefined') {
        import('./utils/security/secure-logger').then(({ createLogger }) => {
          const logger = createLogger('SilentBatchTaskManager');
          logger.warn('内存使用较高', {
            taskCount,
            threshold: config.WARNING_THRESHOLD,
            systemLoad: {
              isHighLoad: systemLoad.isHighLoad,
              cpuUsage: systemLoad.cpuUsage,
              memoryUsage: systemLoad.memoryUsage
            },
            action: 'warning'
          });
        }).catch(() => {
          // 静默处理logger导入错误
        });
      }
    }
  }

  // 强制清理最旧的任务
  private forceCleanupOldestTasks(count: number) {
    if (!global.silentBatchTasks) return;
    
    const tasks = Array.from((global.silentBatchTasks || new Map()).entries())
      .sort(([, a], [, b]) => a.updatedAt - b.updatedAt);
    
    let cleanedCount = 0;
    for (let i = 0; i < Math.min(count, tasks.length); i++) {
      const [taskId] = tasks[i];
      if (global.silentBatchTasks?.delete(taskId)) {
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0 && typeof window === 'undefined') {
      import('./utils/security/secure-logger').then(({ createLogger }) => {
        const logger = createLogger('SilentBatchTaskManager');
        logger.info('强制清理最旧任务完成', {
          requestedCount: count,
          actualCleanedCount: cleanedCount,
          remainingTasks: global.silentBatchTasks?.size || 0
        });
      }).catch(() => {
        // 静默处理logger导入错误
      });
    }
  }

  // 获取任务统计信息
  getTaskStats() {
    if (!global.silentBatchTasks) {
      return {
        total: 0,
        byStatus: {},
        memoryUsage: 'low'
      };
    }
    
    const byStatus = new Map<string, number>();
    if (global.silentBatchTasks) {
      for (const task of global.silentBatchTasks.values()) {
        byStatus.set(task.status, (byStatus.get(task.status) || 0) + 1);
      }
    }
    
    const total = global.silentBatchTasks.size;
    const config = TASK_MANAGER_CONFIG.MEMORY_MONITOR;
    
    let memoryUsage = 'low';
    if (total > config.CRITICAL_THRESHOLD) {
      memoryUsage = 'critical';
    } else if (total > config.WARNING_THRESHOLD) {
      memoryUsage = 'high';
    } else if (total > config.WARNING_THRESHOLD / 2) {
      memoryUsage = 'medium';
    }
    
    return {
      total,
      byStatus: Object.fromEntries(byStatus),
      memoryUsage
    };
  }

  // 终止任务
  async terminateTask(taskId: string): Promise<boolean> {
    const task = this.getTask(taskId);
    if (task) {
      const now = Date.now();
      const taskDuration = now - (task.startTime || now);
      
      // 记录任务完成分析
      
      task.status = 'terminated';
      task.message = '任务已终止';
      await this.setTask(taskId, task);
      return true;
    }
    return false;
  }
}

// 导出单例实例
export const silentBatchTaskManager = SilentBatchTaskManager.getInstance();

// 任务管理配置
const TASK_MANAGER_CONFIG = {
  // 清理间隔时间（优化版）
  CLEANUP_INTERVAL: 2 * 60 * 1000, // 2分钟（更频繁的清理）
  // 任务生命周期配置（4GB容器优化版）
  TASK_LIFECYCLE: {
    EXPIRED: 15 * 60 * 1000, // 15分钟 - 过期任务（减少50%）
    FAILED: 5 * 60 * 1000, // 5分钟 - 失败任务（减少67%）
    COMPLETED: 3 * 60 * 1000, // 3分钟 - 完成任务（减少70%）
    TERMINATED: 1 * 60 * 1000, // 1分钟 - 终止任务（减少50%）
    IDLE: 10 * 60 * 1000 // 10分钟 - 空闲任务（减少50%）
  },
  // 内存监控配置（优化版）
  MEMORY_MONITOR: {
    WARNING_THRESHOLD: 50, // 50个任务时发出警告（降低50%）
    CRITICAL_THRESHOLD: 100, // 100个任务时开始强制清理（降低50%）
    MAX_TASKS: 150 // 最大任务数限制（降低50%）
  },
  // 自适应配置
  ADAPTIVE: {
    HIGH_LOAD_THRESHOLD: 0.8, // 80% CPU/内存使用率时触发自适应
    CLEANUP_MULTIPLIER: 2, // 高负载时清理间隔乘数
    TASK_LIFECYCLE_MULTIPLIER: 0.5, // 高负载时任务生命周期乘数
    MIN_CLEANUP_INTERVAL: 30 * 1000, // 最小清理间隔30秒
    MAX_CLEANUP_INTERVAL: 10 * 60 * 1000 // 最大清理间隔10分钟
  }
} as const;

// 定期清理过期任务
if (typeof window === 'undefined') {
  // 只在服务端执行
  setInterval(() => {
    silentBatchTaskManager.cleanupExpiredTasks();
  }, TASK_MANAGER_CONFIG.CLEANUP_INTERVAL);
  
  // 内存监控定时器
  setInterval(() => {
    silentBatchTaskManager.monitorMemoryUsage();
  }, 2 * 60 * 1000); // 每2分钟检查一次内存使用情况
  
  }