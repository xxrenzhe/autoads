/**
 * 任务调度器
 * 负责管理定时任务的创建、执行、监控和取消
 */

import { ExecutionOrchestrator } from './ExecutionOrchestrator';
import { ConfigurationManager } from './ConfigurationManager';
import { TrackingConfiguration } from '../types';
import { NotificationService } from './NotificationService';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('TaskScheduler');

export interface ScheduledTask {
  id: string;
  configurationId: string;
  userId: string;
  name: string;
  schedule: ScheduleConfig;
  status: 'active' | 'paused' | 'stopped';
  nextRun: Date;
  lastRun?: Date;
  lastExecutionId?: string;
  createdAt: Date;
  updatedAt: Date;
  executionCount: number;
  successCount: number;
  failureCount: number;
}

export interface ScheduleConfig {
  type: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string; // HH:MM format
  timezone: string;
  dayOfWeek?: number; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  cronExpression?: string; // For custom schedules
  enabled: boolean;
  endDate?: Date;
  maxExecutions?: number;
}

export interface TaskExecutionResult {
  taskId: string;
  executionId: string;
  startTime: Date;
  endTime: Date;
  status: 'success' | 'failure' | 'cancelled';
  error?: string;
}

export class TaskScheduler {
  private executionOrchestrator: ExecutionOrchestrator;
  private configManager: ConfigurationManager;
  private notificationService: NotificationService;
  
  private scheduledTasks = new Map<string, ScheduledTask>();
  private taskTimers = new Map<string, NodeJS.Timeout>();
  private isRunning = false;

  constructor(
    executionOrchestrator: ExecutionOrchestrator,
    configManager: ConfigurationManager,
    notificationService: NotificationService
  ) {
    this.executionOrchestrator = executionOrchestrator;
    this.configManager = configManager;
    this.notificationService = notificationService;
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('调度器已在运行中');
      return;
    }

    this.isRunning = true;
    this.scheduleAllTasks();
    
    // 每分钟检查一次任务状态
    setInterval(() => {
      this.checkTaskStatus();
    }, 60000);

    logger.info('任务调度器已启动');
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    // 清除所有定时器
    for (const timer of this.taskTimers.values()) {
      clearTimeout(timer);
    }
    this.taskTimers.clear();

    logger.info('任务调度器已停止');
  }

  /**
   * 创建定时任务
   */
  async createTask(
    configurationId: string,
    userId: string,
    schedule: ScheduleConfig
  ): Promise<string> {
    try {
      // 验证配置是否存在
      const config = await this.configManager.getConfiguration(configurationId);
      if (!config) {
        throw new Error(`配置不存在: ${configurationId}`);
      }

      // 验证调度配置
      this.validateScheduleConfig(schedule);

      const taskId = this.generateTaskId();
      const nextRun = this.calculateNextRun(schedule);

      const task: ScheduledTask = {
        id: taskId,
        configurationId,
        userId,
        name: `${config.name} - 定时任务`,
        schedule,
        status: 'active',
        nextRun,
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        successCount: 0,
        failureCount: 0
      };

      this.scheduledTasks.set(taskId, task);
      
      if (this.isRunning) {
        this.scheduleTask(task);
      }

      logger.info(`定时任务已创建: ${taskId} - ${config.name}`);
      return taskId;

    } catch (error) {
      logger.error('创建定时任务失败:', new EnhancedError('创建定时任务失败:', { error: error instanceof Error ? error.message : String(error)  }));
      throw error;
    }
  }

  /**
   * 更新定时任务
   */
  async updateTask(taskId: string, updates: {
    schedule?: Partial<ScheduleConfig>;
    status?: 'active' | 'paused' | 'stopped';
  }): Promise<void> {
    const task = this.scheduledTasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    // 更新调度配置
    if (updates.schedule) {
      task.schedule = { ...task.schedule, ...updates.schedule };
      this.validateScheduleConfig(task.schedule);
      task.nextRun = this.calculateNextRun(task.schedule);
    }

    // 更新状态
    if (updates.status) {
      task.status = updates.status;
    }

    task.updatedAt = new Date();

    // 重新调度任务
    this.clearTaskTimer(taskId);
    if (task.status === 'active' && this.isRunning) {
      this.scheduleTask(task);
    }

    logger.info(`定时任务已更新: ${taskId}`);
  }

  /**
   * 删除定时任务
   */
  async deleteTask(taskId: string): Promise<void> {
    const task = this.scheduledTasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    this.clearTaskTimer(taskId);
    this.scheduledTasks.delete(taskId);

    logger.info(`定时任务已删除: ${taskId}`);
  }

  /**
   * 获取任务列表
   */
  getTasks(userId?: string): ScheduledTask[] {
    const tasks = Array.from(this.scheduledTasks.values());
    return userId ? tasks.filter((task: any) => task.userId === userId) : tasks;
  }

  /**
   * 获取任务详情
   */
  getTask(taskId: string): ScheduledTask | null {
    return this.scheduledTasks.get(taskId) || null;
  }

  /**
   * 手动执行任务
   */
  async executeTask(taskId: string): Promise<string> {
    const task = this.scheduledTasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    try {
      const executionId = await this.executionOrchestrator.startExecution(
        task.configurationId,
        task.userId
      );

      task.lastRun = new Date();
      task.lastExecutionId = executionId;
      task.executionCount++;

      logger.info(`手动执行任务: ${taskId} -> ${executionId}`);
      return executionId;

    } catch (error) {
      task.failureCount++;
      logger.error('手动执行任务失败: ${taskId}', new EnhancedError('手动执行任务失败: ${taskId}', { error: error instanceof Error ? error.message : String(error)  }));
      throw error;
    }
  }

  /**
   * 暂停任务
   */
  async pauseTask(taskId: string): Promise<void> { 
    await this.updateTask(taskId, { status: 'paused' });
  }

  /**
   * 恢复任务
   */
  async resumeTask(taskId: string): Promise<void> { 
    await this.updateTask(taskId, { status: 'active' });
  }

  /**
   * 获取任务统计
   */
  getTaskStats(userId?: string): {
    total: number;
    active: number;
    paused: number;
    stopped: number;
    totalExecutions: number;
    successRate: number;
    nextExecution?: Date;
  } {
    const tasks = this.getTasks(userId);
    
    const stats = {
      total: tasks.length,
      active: tasks.filter((t: any) => t.status === 'active').length,
      paused: tasks.filter((t: any) => t.status === 'paused').length,
      stopped: tasks.filter((t: any) => t.status === 'stopped').length,
      totalExecutions: tasks.reduce((sum, t: any) => sum + t.executionCount, 0),
      successRate: 0,
      nextExecution: undefined as Date | undefined
    };

    const totalExecutions = stats.totalExecutions;
    const totalSuccesses = tasks.reduce((sum, t: any) => sum + t.successCount, 0);
    stats.successRate = totalExecutions > 0 ? (totalSuccesses / totalExecutions) * 100 : 0;

    // 找到下一个执行时间
    const activeTasks = tasks.filter((t: any) => t.status === 'active');
    if (activeTasks.length > 0) {
      stats.nextExecution = activeTasks.reduce((earliest, task: any) => 
        !earliest || task.nextRun < earliest ? task.nextRun : earliest
      , null as Date | null) || undefined;
    }

    return stats;
  }

  /**
   * 私有方法：调度所有任务
   */
  private scheduleAllTasks(): void {
    for (const task of this.scheduledTasks.values()) {
      if (task.status === 'active') {
        this.scheduleTask(task);
      }
    }
  }

  /**
   * 私有方法：调度单个任务
   */
  private scheduleTask(task: ScheduledTask): void {
    const now = new Date();
    const delay = task.nextRun.getTime() - now.getTime();

    if (delay <= 0) {
      // 立即执行
      this.executeScheduledTask(task);
    } else {
      // 设置定时器
      const timer = setTimeout(() => {
        this.executeScheduledTask(task);
      }, delay);

      this.taskTimers.set(task.id, timer);
    }
  }

  /**
   * 私有方法：执行调度任务
   */
  private async executeScheduledTask(task: ScheduledTask): Promise<void> {
    try {
      logger.info(`开始执行调度任务: ${task.id} - ${task.name}`);

      const executionId = await this.executionOrchestrator.startExecution(
        task.configurationId,
        task.userId
      );

      task.lastRun = new Date();
      task.lastExecutionId = executionId;
      task.executionCount++;

      // 监控执行结果
      this.monitorTaskExecution(task, executionId);

      // 计算下次执行时间
      if (task.schedule.type !== 'once') {
        task.nextRun = this.calculateNextRun(task.schedule);
        this.scheduleTask(task);
      } else {
        task.status = 'stopped';
      }

      task.updatedAt = new Date();

    } catch (error) {
      task.failureCount++;
      task.updatedAt = new Date();
      
      logger.error('调度任务执行失败: ${task.id}', new EnhancedError('调度任务执行失败: ${task.id}', { error: error instanceof Error ? error.message : String(error)  }));
      // 发送错误通知
      await this.notificationService.sendSystemAlert({
        type: 'error',
        title: '定时任务执行失败',
        message: `任务 "${task.name}" 执行失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        metadata: { taskId: task.id, configurationId: task.configurationId }
      });

      // 重新调度（如果不是一次性任务）
      if (task.schedule.type !== 'once' && task.status === 'active') {
        task.nextRun = this.calculateNextRun(task.schedule);
        this.scheduleTask(task);
      }
    }
  }

  /**
   * 私有方法：监控任务执行
   */
  private async monitorTaskExecution(task: ScheduledTask, executionId: string): Promise<void> {
    // 异步监控执行结果
    setTimeout(async () => {
      try {
        const status = await this.executionOrchestrator.getExecutionStatus(executionId);
        if (status) {
          if (status.status === 'completed') {
            task.successCount++;
          } else if (status.status === 'failed') {
            task.failureCount++;
          }
        }
      } catch (error) {
        logger.warn(`监控任务执行状态失败: ${executionId}`);
      }
    }, 5000); // 5秒后检查状态
  }

  /**
   * 私有方法：清除任务定时器
   */
  private clearTaskTimer(taskId: string): void {
    const timer = this.taskTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.taskTimers.delete(taskId);
    }
  }

  /**
   * 私有方法：检查任务状态
   */
  private checkTaskStatus(): void {
    const now = new Date();
    
    for (const task of this.scheduledTasks.values()) {
      // 检查是否有过期的任务需要重新调度
      if (task.status === 'active' && !this.taskTimers.has(task.id)) {
        if (task.nextRun <= now) {
          this.executeScheduledTask(task);
        } else {
          this.scheduleTask(task);
        }
      }

      // 检查任务是否已达到最大执行次数
      if (task.schedule.maxExecutions && task.executionCount >= task.schedule.maxExecutions) {
        task.status = 'stopped';
        this.clearTaskTimer(task.id);
      }

      // 检查任务是否已过期
      if (task.schedule.endDate && now > task.schedule.endDate) {
        task.status = 'stopped';
        this.clearTaskTimer(task.id);
      }
    }
  }

  /**
   * 私有方法：验证调度配置
   */
  private validateScheduleConfig(schedule: ScheduleConfig): void {
    if (!schedule.enabled) {
      return;
    }

    // 验证时间格式
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(schedule.time)) {
      throw new Error('时间格式无效，应为HH:MM格式');
    }

    // 验证时区
    if (!schedule.timezone) {
      throw new Error('时区不能为空');
    }

    // 验证特定类型的配置
    switch (schedule.type) {
      case 'weekly':
        if (schedule.dayOfWeek === undefined || schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6) {
          throw new Error('周调度必须指定有效的星期几(0-6)');
        }
        break;
      case 'monthly':
        if (schedule.dayOfMonth === undefined || schedule.dayOfMonth < 1 || schedule.dayOfMonth > 31) {
          throw new Error('月调度必须指定有效的日期(1-31)');
        }
        break;
      case 'custom':
        if (!schedule.cronExpression) {
          throw new Error('自定义调度必须指定cron表达式');
        }
        break;
    }
  }

  /**
   * 私有方法：计算下次执行时间
   */
  private calculateNextRun(schedule: ScheduleConfig): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':')?.filter(Boolean)?.map(Number);

    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    switch (schedule.type) {
      case 'once':
        // 一次性任务，如果时间已过，则设为明天
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;

      case 'daily':
        // 每日任务，如果今天的时间已过，则设为明天
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;

      case 'weekly':
        // 每周任务
        const targetDayOfWeek = schedule.dayOfWeek!;
        const currentDayOfWeek = nextRun.getDay();
        let daysUntilTarget = targetDayOfWeek - currentDayOfWeek;
        
        if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
          daysUntilTarget += 7;
        }
        
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        break;

      case 'monthly':
        // 每月任务
        const targetDayOfMonth = schedule.dayOfMonth!;
        nextRun.setDate(targetDayOfMonth);
        
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
          nextRun.setDate(targetDayOfMonth);
        }
        break;

      case 'custom':
        // 自定义cron表达式（简化实现）
        // 实际项目中应该使用专业的cron解析库
        nextRun.setDate(nextRun.getDate() + 1);
        break;
    }

    return nextRun;
  }

  /**
   * 私有方法：生成任务ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取调度器状态
   */
  getSchedulerStatus(): {
    isRunning: boolean;
    totalTasks: number;
    activeTasks: number;
    activeTimers: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      totalTasks: this.scheduledTasks.size,
      activeTasks: Array.from(this.scheduledTasks.values()).filter((t: any) => t.status === 'active').length,
      activeTimers: this.taskTimers.size,
      uptime: process.uptime ? process.uptime() * 1000 : 0
    };
  }

  /**
   * 清理已完成的任务
   */
  cleanup(): void {
    const now = new Date();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天

    for (const [taskId, task] of this.scheduledTasks.entries()) {
      if (task.status === 'stopped') {
        const age = now.getTime() - task.updatedAt.getTime();
        if (age > maxAge) {
          this.clearTaskTimer(taskId);
          this.scheduledTasks.delete(taskId);
          logger.info(`清理过期任务: ${taskId}`);
        }
      }
    }
  }
}