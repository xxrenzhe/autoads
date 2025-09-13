/**
 * Enhanced Progress Manager
 * 增强的进度管理器 - 提供完整的进度条解决方案
 */

import { createClientLogger } from '@/lib/utils/security/client-secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('EnhancedProgressManager');

// 任务状态定义
export type TaskState = 
  | 'idle'                    // 空闲状态
  | 'initializing'           // 初始化中
  | 'proxy_fetching'         // 代理获取中
  | 'proxy_validating'       // 代理验证中
  | 'batch_preparing'        // 批量任务准备中
  | 'url_processing'         // URL处理中
  | 'completing'             // 完成中
  | 'completed'              // 已完成
  | 'failed'                 // 失败
  | 'terminated';            // 已终止

// 进度阶段配置
export const PROGRESS_STAGES = {
  initializing: { weight: 5, minDuration: 500, maxDuration: 2000, showPercentage: false },
  proxy_fetching: { weight: 15, minDuration: 2000, maxDuration: 10000, showPercentage: false },
  proxy_validating: { weight: 5, minDuration: 1000, maxDuration: 3000, showPercentage: false },
  batch_preparing: { weight: 5, minDuration: 500, maxDuration: 1500, showPercentage: false },
  url_processing: { weight: 65, minDuration: 5000, maxDuration: 60000, showPercentage: true },
  completing: { weight: 5, minDuration: 500, maxDuration: 1000, showPercentage: false }
};

// 进度数据接口
export interface ProgressData {
  taskId: string;
  state: TaskState;
  progress: number; // 0-100
  stageProgress: number; // 当前阶段进度 0-100
  currentStage: keyof typeof PROGRESS_STAGES;
  message: string;
  successCount: number;
  failCount: number;
  totalItems: number;
  processedItems: number;
  startTime: number;
  estimatedEndTime?: number;
  lastUpdateTime: number;
  error?: string;
  details?: {
    proxyCount?: number;
    proxyProgress?: { current: number; total: number };
    urlProgress?: { current: number; total: number };
    performance?: {
      avgResponseTime: number;
      successRate: number;
      throughput: number;
    };
  };
  showPercentage?: boolean; // 是否显示百分比
}

// 进度事件类型
export type ProgressEvent = 
  | { type: 'state_change'; state: TaskState; timestamp: number }
  | { type: 'progress_update'; progress: number; stageProgress: number; timestamp: number }
  | { type: 'error'; error: string; timestamp: number }
  | { type: 'complete'; timestamp: number }
  | { type: 'terminate'; timestamp: number };

// 进度观察者接口
export interface ProgressObserver {
  onProgressUpdate: (data: ProgressData) => void;
  onStateChange: (state: TaskState) => void;
  onError: (error: string) => void;
  onComplete: () => void;
  onTerminate: () => void;
}

/**
 * 增强的进度管理器类
 */
export class EnhancedProgressManager {
  private taskData = new Map<string, ProgressData>();
  private observers = new Map<string, ProgressObserver[]>();
  private eventHistory = new Map<string, ProgressEvent[]>();
  private progressTimers = new Map<string, NodeJS.Timeout>();
  
  /**
   * 创建新任务
   */
  createTask(taskId: string, totalItems: number): ProgressData {
    const now = Date.now();
    const taskData: ProgressData = {
      taskId,
      state: 'idle',
      progress: 0,
      stageProgress: 0,
      currentStage: 'initializing',
      message: '准备开始任务...',
      successCount: 0,
      failCount: 0,
      totalItems,
      processedItems: 0,
      startTime: now,
      lastUpdateTime: now
    };
    
    this.taskData.set(taskId, taskData);
    this.eventHistory.set(taskId, []);
    
    logger.info('创建新任务', { taskId, totalItems });
    return taskData;
  }
  
  /**
   * 更新任务状态
   */
  updateTaskState(taskId: string, newState: TaskState, message?: string): boolean {
    const task = this.taskData.get(taskId);
    if (!task) {
      logger.warn('任务不存在', { taskId });
      return false;
    }
    
    const oldState = task.state;
    task.state = newState;
    task.lastUpdateTime = Date.now();
    
    if (message) {
      task.message = message;
    }
    
    // 记录状态变更事件
    this.recordEvent(taskId, {
      type: 'state_change',
      state: newState,
      timestamp: Date.now()
    });
    
    // 更新进度
    this.updateProgressBasedOnState(taskId);
    
    // 通知观察者
    this.notifyObservers(taskId, 'stateChange', newState);
    
    logger.info('任务状态更新', { 
      taskId, 
      oldState, 
      newState, 
      message: task.message 
    });
    
    return true;
  }
  
  /**
   * 更新进度
   */
  updateProgress(
    taskId: string, 
    progress: number, 
    stageProgress?: number, 
    message?: string,
    details?: ProgressData['details']
  ): boolean {
    const task = this.taskData.get(taskId);
    if (!task) {
      logger.warn('任务不存在', { taskId });
      return false;
    }
    
    const now = Date.now();
    task.progress = Math.min(100, Math.max(0, progress));
    task.lastUpdateTime = now;
    
    if (stageProgress !== undefined) {
      task.stageProgress = Math.min(100, Math.max(0, stageProgress));
    }
    
    if (message) {
      task.message = message;
    }
    
    if (details) {
      task.details = { ...task.details, ...details };
    }
    
    // 更新预估完成时间
    this.updateEstimatedEndTime(taskId);
    
    // 记录进度更新事件
    this.recordEvent(taskId, {
      type: 'progress_update',
      progress: task.progress,
      stageProgress: task.stageProgress,
      timestamp: now
    });
    
    // 通知观察者
    this.notifyObservers(taskId, 'progressUpdate', task);
    
    return true;
  }
  
  /**
   * 更新项目处理进度
   */
  updateItemProgress(
    taskId: string, 
    processedItems: number, 
    successCount?: number, 
    failCount?: number
  ): boolean {
    const task = this.taskData.get(taskId);
    if (!task) {
      logger.warn('任务不存在', { taskId });
      return false;
    }
    
    task.processedItems = Math.min(task.totalItems, processedItems);
    
    if (successCount !== undefined) {
      task.successCount = successCount;
    }
    
    if (failCount !== undefined) {
      task.failCount = failCount;
    }
    
    // 计算进度
    const itemProgress = (task.processedItems / task.totalItems) * 100;
    const stageProgress = task.state === 'url_processing' ? itemProgress : 100;
    
    return this.updateProgress(
      taskId, 
      this.calculateOverallProgress(taskId, itemProgress),
      stageProgress,
      undefined,
      {
        ...task.details,
        urlProgress: {
          current: task.processedItems,
          total: task.totalItems
        }
      }
    );
  }
  
  /**
   * 设置错误状态
   */
  setError(taskId: string, error: string): boolean {
    const task = this.taskData.get(taskId);
    if (!task) {
      logger.warn('任务不存在', { taskId });
      return false;
    }
    
    task.state = 'failed';
    task.error = error;
    task.message = `任务失败: ${error}`;
    task.lastUpdateTime = Date.now();
    
    // 记录错误事件
    this.recordEvent(taskId, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
    
    // 通知观察者
    this.notifyObservers(taskId, 'error', error);
    
    logger.error('任务错误', new EnhancedError('任务错误', { data: { taskId, error } }));
    
    return true;
  }
  
  /**
   * 完成任务
   */
  completeTask(taskId: string, message?: string): boolean {
    const task = this.taskData.get(taskId);
    if (!task) {
      logger.warn('任务不存在', { taskId });
      return false;
    }
    
    task.state = 'completed';
    task.progress = 100;
    task.stageProgress = 100;
    task.processedItems = task.totalItems;
    task.message = message || '任务已完成';
    task.lastUpdateTime = Date.now();
    
    // 记录完成事件
    this.recordEvent(taskId, {
      type: 'complete',
      timestamp: Date.now()
    });
    
    // 清理定时器
    this.clearProgressTimer(taskId);
    
    // 通知观察者
    this.notifyObservers(taskId, 'complete');
    
    logger.info('任务完成', { taskId, duration: Date.now() - task.startTime });
    
    return true;
  }
  
  /**
   * 终止任务
   */
  terminateTask(taskId: string, message?: string): boolean {
    const task = this.taskData.get(taskId);
    if (!task) {
      logger.warn('任务不存在', { taskId });
      return false;
    }
    
    task.state = 'terminated';
    task.message = message || '任务已终止';
    task.lastUpdateTime = Date.now();
    
    // 记录终止事件
    this.recordEvent(taskId, {
      type: 'terminate',
      timestamp: Date.now()
    });
    
    // 清理定时器
    this.clearProgressTimer(taskId);
    
    // 通知观察者
    this.notifyObservers(taskId, 'terminate');
    
    logger.info('任务终止', { taskId });
    
    return true;
  }
  
  /**
   * 获取任务数据
   */
  getTask(taskId: string): ProgressData | undefined {
    return this.taskData.get(taskId);
  }
  
  /**
   * 注册观察者
   */
  addObserver(taskId: string, observer: ProgressObserver): void {
    if (!this.observers.has(taskId)) {
      this.observers.set(taskId, []);
    }
    this.observers.get(taskId)!.push(observer);
    
    logger.debug('添加进度观察者', { taskId });
  }
  
  /**
   * 移除观察者
   */
  removeObserver(taskId: string, observer: ProgressObserver): void {
    const taskObservers = this.observers.get(taskId);
    if (taskObservers) {
      const index = taskObservers.indexOf(observer);
      if (index > -1) {
        taskObservers.splice(index, 1);
      }
    }
    
    logger.debug('移除进度观察者', { taskId });
  }
  
  /**
   * 启动进度模拟器（用于长时间操作）
   */
  startProgressSimulation(taskId: string, stage: keyof typeof PROGRESS_STAGES): void {
    const task = this.taskData.get(taskId);
    if (!task) return;
    
    // 清除现有定时器
    this.clearProgressTimer(taskId);
    
    const stageConfig = PROGRESS_STAGES[stage];
    const interval = stageConfig.minDuration / 20; // 分20步完成
    
    const timer = setInterval(() => {
      const currentTask = this.taskData.get(taskId);
      if (!currentTask || currentTask.state !== stage) {
        this.clearProgressTimer(taskId);
        return;
      }
      
      // 模拟进度增长
      const increment = 100 / 20;
      const newStageProgress = Math.min(100, currentTask.stageProgress + increment);
      
      this.updateProgress(
        taskId,
        this.calculateOverallProgress(taskId, newStageProgress),
        newStageProgress,
        currentTask.message
      );
      
      // 如果阶段完成，停止模拟
      if (newStageProgress >= 100) {
        this.clearProgressTimer(taskId);
      }
    }, interval);
    
    this.progressTimers.set(taskId, timer);
  }
  
  /**
   * 停止进度模拟
   */
  stopProgressSimulation(taskId: string): void {
    this.clearProgressTimer(taskId);
  }
  
  // 私有方法
  
  /**
   * 记录事件
   */
  private recordEvent(taskId: string, event: ProgressEvent): void {
    const history = this.eventHistory.get(taskId) || [];
    history.push(event);
    
    // 保留最近100个事件
    if (history.length > 100) {
      history.shift();
    }
    
    this.eventHistory.set(taskId, history);
  }
  
  /**
   * 通知观察者
   */
  private notifyObservers(
    taskId: string, 
    eventType: 'progressUpdate' | 'stateChange' | 'error' | 'complete' | 'terminate',
    data?: any
  ): void {
    const task = this.taskData.get(taskId);
    if (!task) return;
    
    const observers = this.observers.get(taskId) || [];
    
    observers.forEach((observer: any) => {
      try {
        switch (eventType) {
          case 'progressUpdate':
            observer.onProgressUpdate(task);
            break;
          case 'stateChange':
            observer.onStateChange(data);
            break;
          case 'error':
            observer.onError(data);
            break;
          case 'complete':
            observer.onComplete();
            break;
          case 'terminate':
            observer.onTerminate();
            break;
        }
      } catch (error) {
        logger.error('观察者通知失败', new EnhancedError('观察者通知失败', {  
          taskId, 
          eventType, 
          error: error instanceof Error ? error.message : String(error) 
         }));
      }
    });
  }
  
  /**
   * 基于状态更新进度
   */
  private updateProgressBasedOnState(taskId: string): void {
    const task = this.taskData.get(taskId);
    if (!task) return;
    
    // 计算基于状态的进度
    let progress = 0;
    let currentStage: keyof typeof PROGRESS_STAGES = 'initializing';
    
    switch (task.state) {
      case 'idle':
        progress = 0;
        currentStage = 'initializing';
        break;
      case 'initializing':
        progress = 5;
        currentStage = 'initializing';
        break;
      case 'proxy_fetching':
        progress = 10;
        currentStage = 'proxy_fetching';
        break;
      case 'proxy_validating':
        progress = 25;
        currentStage = 'proxy_validating';
        break;
      case 'batch_preparing':
        progress = 30;
        currentStage = 'batch_preparing';
        break;
      case 'url_processing':
        progress = 35; // URL处理阶段开始基准
        currentStage = 'url_processing';
        break;
      case 'completing':
        progress = 95;
        currentStage = 'completing';
        break;
      case 'completed':
        progress = 100;
        currentStage = 'completing';
        break;
      case 'failed':
      case 'terminated':
        // 保持当前进度
        break;
    }
    
    task.currentStage = currentStage;
    task.progress = progress;
    task.stageProgress = 0;
    
    // 设置是否显示百分比
    task.showPercentage = PROGRESS_STAGES[currentStage].showPercentage;
  }
  
  /**
   * 计算总体进度
   */
  private calculateOverallProgress(taskId: string, stageProgress: number): number {
    const task = this.taskData.get(taskId);
    if (!task) return 0;
    
    const stage = task.currentStage;
    const stageConfig = PROGRESS_STAGES[stage];
    
    // 计算之前阶段的权重总和
    const stages = Object.keys(PROGRESS_STAGES) as (keyof typeof PROGRESS_STAGES)[];
    const stageIndex = stages.indexOf(stage);
    
    let baseProgress = 0;
    for (let i = 0; i < stageIndex; i++) {
      baseProgress += PROGRESS_STAGES[stages[i]].weight;
    }
    
    // 如果是URL处理阶段，显示详细的百分比进度
    if (stage === 'url_processing') {
      const urlProgress = 35 + (stageProgress / 100) * 60; // 35-95%的范围
      return Math.min(95, urlProgress);
    }
    
    // 其他阶段只显示阶段进度，不显示详细百分比
    const currentStageProgress = (stageProgress / 100) * stageConfig.weight;
    return Math.min(100, baseProgress + currentStageProgress);
  }
  
  /**
   * 更新预估完成时间
   */
  private updateEstimatedEndTime(taskId: string): void {
    const task = this.taskData.get(taskId);
    if (!task) return;
    
    const now = Date.now();
    const elapsed = now - task.startTime;
    
    if (task.progress > 0 && task.progress < 100) {
      const estimatedTotal = (elapsed / task.progress) * 100;
      task.estimatedEndTime = task.startTime + estimatedTotal;
    }
  }
  
  /**
   * 清理进度定时器
   */
  private clearProgressTimer(taskId: string): void {
    const timer = this.progressTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.progressTimers.delete(taskId);
    }
  }
}

// 导出单例实例
export const enhancedProgressManager = new EnhancedProgressManager();