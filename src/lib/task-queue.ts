import { EventEmitter } from 'events';
import { createLogger } from './utils/security/secure-logger';

const logger = createLogger('TaskQueue');

// 任务状态
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// 任务优先级
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

// 任务接口
export interface Task {
  id: string;
  type: string;
  userId: string;
  priority: TaskPriority;
  payload: any;
  status: TaskStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number;
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

// 队列配置
export interface QueueConfig {
  maxConcurrentTasks: number;
  maxTasksPerUser: number;
  retryDelay: number;
  taskTimeout: number;
}

// 任务队列
export class TaskQueue extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private pendingQueue: string[] = [];
  private runningTasks: Set<string> = new Set();
  private userTaskCounts: Map<string, number> = new Map();
  private config: QueueConfig;
  private processing: boolean = false;

  constructor(config: QueueConfig) {
    super();
    this.config = config;
    
    // 开始处理队列
    this.process();
  }

  // 添加任务到队列
  async addTask(task: Omit<Task, 'id' | 'status' | 'createdAt' | 'retryCount'>): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullTask: Task = {
      ...task,
      id: taskId,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0
    };

    this.tasks.set(taskId, fullTask);
    
    // 按优先级插入队列
    this.insertByPriority(taskId);
    
    logger.info('Task added to queue', { 
      taskId, 
      type: task.type, 
      userId: task.userId,
      priority: task.priority 
    });

    this.emit('taskAdded', fullTask);
    
    // 如果队列没有在处理，启动处理
    if (!this.processing) {
      this.process();
    }
    
    return taskId;
  }

  // 按优先级插入
  private insertByPriority(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const taskPriority = priorityOrder[task.priority];

    // 找到合适的插入位置
    let insertIndex = 0;
    for (let i = 0; i < this.pendingQueue.length; i++) {
      const pendingTaskId = this.pendingQueue[i];
      const pendingTask = this.tasks.get(pendingTaskId);
      if (pendingTask) {
        const pendingPriority = priorityOrder[pendingTask.priority];
        if (taskPriority < pendingPriority) {
          insertIndex = i;
          break;
        }
      }
      insertIndex = i + 1;
    }

    this.pendingQueue.splice(insertIndex, 0, taskId);
  }

  // 处理队列
  private async process(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.pendingQueue.length > 0 && this.runningTasks.size < this.config.maxConcurrentTasks) {
      const taskId = this.pendingQueue.shift()!;
      const task = this.tasks.get(taskId);
      
      if (!task || task.status !== 'pending') continue;

      // 检查用户并发限制
      const userRunningCount = this.getUserRunningTaskCount(task.userId);
      if (userRunningCount >= this.config.maxTasksPerUser) {
        // 重新放回队列
        this.pendingQueue.unshift(taskId);
        break;
      }

      // 开始执行任务
      this.executeTask(task);
    }

    this.processing = false;
    
    // 如果还有待处理任务，继续处理
    if (this.pendingQueue.length > 0) {
      setTimeout(() => this.process(), 1000);
    }
  }

  // 执行单个任务
  private async executeTask(task: Task): Promise<void> {
    this.runningTasks.add(task.id);
    task.status = 'running';
    task.startedAt = new Date();
    
    // 更新用户任务计数
    const userCount = this.userTaskCounts.get(task.userId) || 0;
    this.userTaskCounts.set(task.userId, userCount + 1);
    
    logger.info('Task started', { taskId: task.id, userId: task.userId });
    this.emit('taskStarted', task);

    // 设置超时
    const timeout = setTimeout(() => {
      this.handleTaskTimeout(task.id);
    }, this.config.taskTimeout);

    try {
      // 这里应该根据任务类型执行具体的处理器
      const result = await this.executeTaskByType(task);
      
      clearTimeout(timeout);
      
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;
      task.progress = 100;
      
      logger.info('Task completed', { taskId: task.id });
      this.emit('taskCompleted', task);
      
    } catch (error) {
      clearTimeout(timeout);
      
      if (task.retryCount < task.maxRetries) {
        // 重试
        task.retryCount++;
        task.status = 'pending';
        task.startedAt = undefined;
        
        logger.warn('Task failed, retrying', { 
          taskId: task.id, 
          retryCount: task.retryCount,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // 延迟重试
        setTimeout(() => {
          this.pendingQueue.push(task.id);
          this.process();
        }, this.config.retryDelay * task.retryCount);
        
      } else {
        // 最终失败
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = error instanceof Error ? error.message : 'Unknown error';
        
        logger.error('Task failed permanently', { taskId: task.id, error });
        this.emit('taskFailed', task);
      }
    } finally {
      // 清理运行状态
      this.runningTasks.delete(task.id);
      
      // 更新用户任务计数
      const userCount = this.userTaskCounts.get(task.userId) || 0;
      if (userCount > 0) {
        this.userTaskCounts.set(task.userId, userCount - 1);
      }
      
      // 继续处理下一个任务
      this.process();
    }
  }

  // 根据任务类型执行
  private async executeTaskByType(task: Task): Promise<any> {
    // 这里应该根据任务类型调用具体的处理器
    // 可以通过事件发射器让外部处理
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Task execution timeout'));
      }, this.config.taskTimeout);

      this.emit('executeTask', task, (result: any) => {
        clearTimeout(timeout);
        resolve(result);
      }, (error: any) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  // 处理任务超时
  private handleTaskTimeout(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'running') {
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = 'Task timeout';
      
      this.runningTasks.delete(taskId);
      
      logger.error('Task timeout', { taskId });
      this.emit('taskFailed', task);
      
      this.process();
    }
  }

  // 取消任务
  async cancelTask(taskId: string, userId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    
    if (!task) return false;
    
    // 只有任务所有者或管理员可以取消
    if (task.userId !== userId) return false;
    
    if (task.status === 'pending') {
      // 从队列中移除
      const index = this.pendingQueue.indexOf(taskId);
      if (index > -1) {
        this.pendingQueue.splice(index, 1);
      }
      
      task.status = 'cancelled';
      task.completedAt = new Date();
      
      this.emit('taskCancelled', task);
      return true;
      
    } else if (task.status === 'running') {
      // 标记为取消，但需要等待任务处理器响应
      task.status = 'cancelled';
      this.emit('taskCancelled', task);
      return true;
    }
    
    return false;
  }

  // 获取任务状态
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  // 获取用户的任务列表
  getUserTasks(userId: string): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.userId === userId);
  }

  // 获取用户正在运行的任务数
  private getUserRunningTaskCount(userId: string): number {
    let count = 0;
    for (const taskId of this.runningTasks) {
      const task = this.tasks.get(taskId);
      if (task && task.userId === userId) {
        count++;
      }
    }
    return count;
  }

  // 获取队列统计
  getStats() {
    return {
      pending: this.pendingQueue.length,
      running: this.runningTasks.size,
      total: this.tasks.size,
      userTaskCounts: Object.fromEntries(this.userTaskCounts)
    };
  }
}

// 全局任务队列实例
export const taskQueue = new TaskQueue({
  maxConcurrentTasks: 10,
  maxTasksPerUser: 3,
  retryDelay: 5000,
  taskTimeout: 300000 // 5分钟
});