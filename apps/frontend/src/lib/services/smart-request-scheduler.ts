/**
 * Smart Request Scheduler
 * 智能请求调度器，优化HTTP请求时序
 */

import { createProxyLogger } from '@/lib/utils/proxy-logger';

const logger = createProxyLogger('SmartRequestScheduler');

export interface RequestTiming {
  minDelay: number;
  maxDelay: number;
  randomFactor: number;
  thinkTime: number;
  typingSpeed: number;
}

export interface SchedulerConfig {
  concurrency: number;
  timing: RequestTiming;
  maxRetries: number;
  timeout: number;
  adaptive: boolean;
}

export interface ScheduledRequest<T> {
  id: string;
  execute: () => Promise<T>;
  priority: number;
  retryCount: number;
  createdAt: number;
}

export class SmartRequestScheduler {
  private queue: ScheduledRequest<any>[] = [];
  private activeRequests = new Set<string>();
  private config: SchedulerConfig;
  private isRunning = false;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      concurrency: config.concurrency ?? 2,
      timing: config.timing ?? {
        minDelay: 1000,
        maxDelay: 5000,
        randomFactor: 0.3,
        thinkTime: 2000,
        typingSpeed: 100
      },
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 30000,
      adaptive: config.adaptive ?? true
    };
  }



  /**
   * 添加请求到队列
   */
  async addRequest<T>(
    request: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.generateRequestId();
      
      const scheduledRequest: ScheduledRequest<T> = {
        id,
        execute: async (): Promise<T> => {
          try {
            const result = await this.executeWithHumanBehavior(request);
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        },
        priority,
        retryCount: 0,
        createdAt: Date.now()
      };

      this.queue.push(scheduledRequest);
      this.queue.sort((a, b) => b.priority - a.priority);
      
      // 如果调度器未运行，启动它
      if (!this.isRunning) {
        this.start();
      }
    });
  }

  /**
   * 批量添加请求
   */
  async addBatchRequests<T>(
    requests: Array<() => Promise<T>>,
    priorities?: number[]
  ): Promise<T[]> {
    const promises = requests.map((request, index: any) => 
      this.addRequest(request, priorities?.[index] ?? 0)
    );
    
    return Promise.all(promises);
  }

  /**
   * 启动调度器
   */
  private start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.processQueue();
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 || this.activeRequests.size > 0) {
      // 检查并发限制
      while (this.activeRequests.size < this.config.concurrency && this.queue.length > 0) {
        const request = this.queue.shift()!;
        this.activeRequests.add(request.id);
        
        // 执行请求
        this.executeRequest(request)
          .finally(() => {
            this.activeRequests.delete(request.id);
          });
      }
      
      // 等待下一个检查周期
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isRunning = false;
  }

  /**
   * 执行单个请求
   */
  private async executeRequest<T>(request: ScheduledRequest<T>): Promise<void> {
    try {
      await request.execute();
    } catch (error) {
      // 重试逻辑
      if (request.retryCount < this.config.maxRetries) {
        request.retryCount++;
        logger.info('请求失败，准备重试', {
          requestId: request.id,
          retry: request.retryCount,
          error
        });
        
        // 指数退避
        const delay = Math.min(
          1000 * Math.pow(2, request.retryCount),
          30000
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // 重新加入队列
        this.queue.push(request);
        this.queue.sort((a, b) => b.priority - a.priority);
      } else {
        logger.error('请求达到最大重试次数', {
          requestId: request.id,
          error
        });
      }
    }
  }

  /**
   * 模拟人类行为执行请求
   */
  private async executeWithHumanBehavior<T>(request: () => Promise<T>): Promise<T> {
    // 随机延迟
    const delay = this.calculateRandomDelay();
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // 模拟思考时间
    if (Math.random() < 0.3) { // 30%概率有思考时间
      await new Promise(resolve => 
        setTimeout(resolve, this.config.timing.thinkTime * Math.random())
      );
    }

    // 执行请求
    const startTime = Date.now();
    const result = await Promise.race([
      request(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('请求超时')), this.config.timeout)
      )
    ]);
    
    const duration = Date.now() - startTime;
    
    // 自适应调整
    if (this.config.adaptive) {
      this.adjustTiming(duration);
    }

    return result;
  }

  /**
   * 计算随机延迟
   */
  private calculateRandomDelay(): number {
    const { minDelay, maxDelay, randomFactor } = this.config.timing;
    
    // 基础延迟
    const baseDelay = minDelay + (maxDelay - minDelay) * Math.random();
    
    // 随机因子
    const randomOffset = baseDelay * randomFactor * (Math.random() - 0.5) * 2;
    
    return Math.max(0, baseDelay + randomOffset);
  }

  /**
   * 自适应调整时序
   */
  private adjustTiming(requestDuration: number): void {
    // 如果请求时间过长，增加延迟
    if (requestDuration > 10000) {
      this.config.timing.minDelay = Math.min(
        this.config.timing.minDelay * 1.1,
        5000
      );
      this.config.timing.maxDelay = Math.min(
        this.config.timing.maxDelay * 1.1,
        10000
      );
    }
    
    // 如果请求很快，可以适当减少延迟
    else if (requestDuration < 1000) {
      this.config.timing.minDelay = Math.max(
        this.config.timing.minDelay * 0.9,
        500
      );
      this.config.timing.maxDelay = Math.max(
        this.config.timing.maxDelay * 0.9,
        3000
      );
    }
  }

  /**
   * 模拟人类请求间隔
   */
  async simulateHumanDelay(options?: {
    minDelay?: number;
    maxDelay?: number;
    randomFactor?: number;
  }): Promise<void> {
    const opts = {
      minDelay: options?.minDelay ?? 1000,
      maxDelay: options?.maxDelay ?? 3000,
      randomFactor: options?.randomFactor ?? 0.3
    };

    const baseDelay = opts.minDelay + (opts.maxDelay - opts.minDelay) * Math.random();
    const randomOffset = baseDelay * opts.randomFactor * (Math.random() - 0.5) * 2;
    const delay = Math.max(0, baseDelay + randomOffset);
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    isRunning: boolean;
    queueLength: number;
    activeRequests: number;
    config: SchedulerConfig;
  } {
    return {
      isRunning: this.isRunning,
      queueLength: this.queue.length,
      activeRequests: this.activeRequests.size,
      config: this.config
    };
  }

  /**
   * 停止调度器
   */
  stop(): void {
    this.isRunning = false;
    this.queue = [];
    this.activeRequests.clear();
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出单例实例
export const smartRequestScheduler = new SmartRequestScheduler();