import { EventEmitter } from 'events';
import { getCacheService } from './cache-service';
import { prisma } from '@/lib/db';

export interface Task {
  id: string;
  type: string;
  payload: any;
  priority?: number; // Higher number = higher priority
  delay?: number; // Delay in milliseconds before execution
  retryCount?: number;
  maxRetries?: number;
  timeout?: number; // Task timeout in milliseconds
  scheduledAt?: Date;
  createdAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: any;
  progress?: number;
  metadata?: any;
}

export interface TaskHandler {
  type: string;
  handler: (task: Task) => Promise<any>;
  options?: {
    maxRetries?: number;
    timeout?: number;
    concurrency?: number;
  };
}

export interface TaskQueueOptions {
  concurrency?: number;
  retryDelay?: number;
  maxRetries?: number;
  stalledInterval?: number;
  drainDelay?: number;
}

/**
 * Async Task Queue Service
 * Handles background task processing with retry, priority, and concurrency control
 */
export class AsyncTaskQueue extends EventEmitter {
  private handlers = new Map<string, TaskHandler>();
  private runningTasks = new Map<string, NodeJS.Timeout>();
  private taskTimeouts = new Map<string, NodeJS.Timeout>();
  private options: Required<TaskQueueOptions>;
  private cache = getCacheService();
  private isProcessing = false;
  private stats = {
    total: 0,
    completed: 0,
    failed: 0,
    running: 0,
    pending: 0
  };

  constructor(options: TaskQueueOptions = {}) {
    super();
    
    this.options = {
      concurrency: options.concurrency || 10,
      retryDelay: options.retryDelay || 5000,
      maxRetries: options.maxRetries || 3,
      stalledInterval: options.stalledInterval || 30000,
      drainDelay: options.drainDelay || 1000
    };

    // Start processing
    this.start();
    
    // Setup stalled task check
    setInterval(() => this.checkStalledTasks(), this.options.stalledInterval);
  }

  /**
   * Register a task handler
   */
  registerHandler(handler: TaskHandler): void {
    this.handlers.set(handler.type, {
      ...handler,
      options: {
        maxRetries: this.options.maxRetries,
        timeout: 30000,
        concurrency: 1,
        ...handler.options
      }
    });
  }

  /**
   * Add a task to the queue
   */
  async add(task: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullTask: Task = {
      ...task,
      id: taskId,
      createdAt: new Date(),
      status: 'pending',
      retryCount: 0,
      priority: task.priority || 0
    };

    // Store task in Redis for persistence
    await this.cache.set(`task:${taskId}`, fullTask, {
      ttl: 86400 * 7 // 7 days TTL
    });

    // Add to priority queue
    await this.addToPriorityQueue(taskId, fullTask.priority || 0, task.scheduledAt);

    this.stats.total++;
    this.stats.pending++;

    this.emit('taskAdded', fullTask);

    // If task is scheduled for future, set timeout
    if (task.scheduledAt && task.scheduledAt > new Date()) {
      const delay = task.scheduledAt.getTime() - Date.now();
      setTimeout(() => this.process(), delay);
    } else {
      // Process immediately
      setImmediate(() => this.process());
    }

    return taskId;
  }

  /**
   * Get task status
   */
  async getTask(taskId: string): Promise<Task | null> {
    return await this.cache.get<Task>(`task:${taskId}`);
  }

  /**
   * Cancel a task
   */
  async cancel(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId);
    
    if (!task || task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }

    // Update task status
    task.status = 'cancelled';
    await this.cache.set(`task:${taskId}`, task);

    // Remove from queue
    await (this.cache as any)["zrem"]('task_queue', taskId);

    // Clear timeout if running
    const timeout = this.taskTimeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.taskTimeouts.delete(taskId);
    }

    this.emit('taskCancelled', task);
    return true;
  }

  /**
   * Retry a failed task
   */
  async retry(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId);
    
    if (!task || task.status !== 'failed') {
      return false;
    }

    task.status = 'pending';
    task.retryCount = 0;
    task.error = undefined;
    task.scheduledAt = new Date(Date.now() + this.options.retryDelay);

    await this.cache.set(`task:${taskId}`, task);
    await this.addToPriorityQueue(taskId, task.priority || 0, task.scheduledAt);

    this.emit('taskRetried', task);
    return true;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Start processing tasks
   */
  private start(): void {
    this.isProcessing = true;
    this.process();
  }

  /**
   * Stop processing tasks
   */
  stop(): void {
    this.isProcessing = false;
    
    // Clear all running tasks
    for (const timeout of this.runningTasks.values()) {
      clearTimeout(timeout);
    }
    this.runningTasks.clear();
    
    // Clear all timeouts
    for (const timeout of this.taskTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.taskTimeouts.clear();
  }

  /**
   * Process next task in queue
   */
  private async process(): Promise<void> {
    if (!this.isProcessing || this.stats.running >= this.options.concurrency) {
      return;
    }

    // Get next task
    const taskId = await this.getNextTask();
    if (!taskId) {
      // No tasks available, wait a bit
      setTimeout(() => this.process(), this.options.drainDelay);
      return;
    }

    const task = await this.getTask(taskId);
    if (!task || task.status !== 'pending') {
      // Task might have been cancelled or processed
      this.process();
      return;
    }

    // Check if task is scheduled for future
    if (task.scheduledAt && task.scheduledAt > new Date()) {
      // Re-add to queue with proper scheduling
      await this.addToPriorityQueue(taskId, task.priority || 0, task.scheduledAt);
      this.process();
      return;
    }

    // Update task status
    task.status = 'running';
    await this.cache.set(`task:${taskId}`, task);
    this.stats.running++;
    this.stats.pending--;

    const handler = this.handlers.get(task.type);
    if (!handler) {
      // No handler registered
      await this.handleTaskFailure(taskId, task, new Error(`No handler for task type: ${task.type}`));
      this.process();
      return;
    }

    // Set task timeout
    const timeout = setTimeout(() => {
      this.handleTaskTimeout(taskId, task);
    }, (handler.options?.timeout as any) || 30000); // Default 30 seconds

    this.taskTimeouts.set(taskId, timeout);

    // Execute task
    try {
      this.emit('taskStarted', task);
      
      const result = await Promise.race([
        handler.handler(task),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Task timeout')), (handler.options?.timeout as any) || 30000);
        })
      ]);

      await this.handleTaskSuccess(taskId, task, result);
    } catch (error) {
      await this.handleTaskFailure(taskId, task, error);
    } finally {
      // Clear timeout
      const timeout = this.taskTimeouts.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(taskId);
      }
      
      this.process();
    }
  }

  /**
   * Add task to priority queue
   */
  private async addToPriorityQueue(taskId: string, priority: number, scheduledAt?: Date): Promise<void> {
    const score = scheduledAt ? scheduledAt.getTime() : Date.now();
    // Use negative priority so higher priority numbers come first
    const priorityScore = score - (priority * 1000);
    
    await (this.cache as any).client?.zadd('task_queue', priorityScore, taskId);
  }

  /**
   * Get next task from queue
   */
  private async getNextTask(): Promise<string | null> {
    const now = Date.now();
    const tasks = await (this.cache as any).client?.zrangebyscore('task_queue', 0, now, 'LIMIT', 0, 1);
    
    if (tasks && tasks.length > 0) {
      // Remove from queue
      await (this.cache as any).client?.zrem('task_queue', tasks[0]);
      return tasks[0];
    }
    
    return null as any;
  }

  /**
   * Handle task success
   */
  private async handleTaskSuccess(taskId: string, task: Task, result: any): Promise<void> {
    task.status = 'completed';
    task.result = result;
    (task as any).completedAt = new Date();
    
    await this.cache.set(`task:${taskId}`, task, { ttl: 86400 }); // Keep for 1 day
    
    this.stats.running--;
    this.stats.completed++;
    
    this.emit('taskCompleted', task, result);
  }

  /**
   * Handle task failure
   */
  private async handleTaskFailure(taskId: string, task: Task, error: any): Promise<void> {
    task.retryCount = (task.retryCount || 0) + 1;
    task.error = error;
    
    const handler = this.handlers.get(task.type);
    const maxRetries = handler?.options?.maxRetries || this.options.maxRetries;
    
    if (task.retryCount < maxRetries) {
      // Retry task
      task.status = 'pending';
      task.scheduledAt = new Date(Date.now() + this.options.retryDelay * task.retryCount);
      
      await this.cache.set(`task:${taskId}`, task);
      await this.addToPriorityQueue(taskId, task.priority || 0, task.scheduledAt);
      
      this.stats.running--;
      this.stats.pending++;
      
      this.emit('taskFailed', task, error, true);
    } else {
      // Max retries reached
      task.status = 'failed';
      (task as any).completedAt = new Date();
      
      await this.cache.set(`task:${taskId}`, task, { ttl: 86400 }); // Keep for 1 day
      
      this.stats.running++;
      this.stats.failed++;
      
      this.emit('taskFailed', task, error, false);
    }
  }

  /**
   * Handle task timeout
   */
  private async handleTaskTimeout(taskId: string, task: Task): Promise<void> {
    await this.handleTaskFailure(taskId, task, new Error('Task timeout'));
  }

  /**
   * Check for stalled tasks
   */
  private async checkStalledTasks(): Promise<void> {
    try {
      const tasks = await (this.cache as any).client?.keys('task:*') || [];
      
      for (const key of tasks) {
        if (key.startsWith('task:')) {
          const task = await this.cache.get<Task>(key);
          
          if (task && task.status === 'running') {
            const runningTime = Date.now() - ((task as any).updatedAt?.getTime() || Date.now());
            
            // If task has been running for too long, mark as failed
            if (runningTime > (this.options.stalledInterval * 2)) {
              await this.handleTaskFailure(task.id, task, new Error('Task stalled'));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking stalled tasks:', error);
    }
  }
}

// Export singleton instance
export const taskQueue = new AsyncTaskQueue();

/**
 * Common task handlers
 */
export const TaskHandlers = {
  // Send email
  sendEmail: {
    type: 'send_email',
    handler: async (task: any) => {
      const { to, subject, html, text } = task.payload;
      // Implement email sending logic
      console.log(`Sending email to ${to}: ${subject}`);
      return { sent: true };
    }
  },

  // Process token expiration
  processTokenExpiration: {
    type: 'process_token_expiration',
    handler: async (task: any) => {
      // Implement token expiration logic
      console.log('Processing expired tokens');
      return { processed: 100 };
    }
  },

  // Generate analytics report
  generateReport: {
    type: 'generate_report',
    handler: async (task: any) => {
      const { type, startDate, endDate } = task.payload;
      // Implement report generation logic
      console.log(`Generating ${type} report`);
      return { reportUrl: '/reports/analytics.pdf' };
    }
  },

  // Clean up old data
  cleanupData: {
    type: 'cleanup_data',
    handler: async (task: any) => {
      const { daysOld } = task.payload;
      // Implement data cleanup logic
      console.log(`Cleaning up data older than ${daysOld} days`);
      return { deletedRecords: 1000 };
    }
  },

  // Process webhook
  processWebhook: {
    type: 'process_webhook',
    handler: async (task: any) => {
      const { webhookUrl, payload } = task.payload;
      // Implement webhook processing logic
      console.log(`Processing webhook to ${webhookUrl}`);
      return { success: true };
    }
  }
};

// Register default handlers
Object.values(TaskHandlers).forEach(handler => {
  taskQueue.registerHandler(handler);
});