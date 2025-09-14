import { EnhancedError } from '@/lib/utils/error-handling';
// import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
// const logger = createClientLogger('RetryManager');
const logger = console;

/**
 * 重试管理器
 * 实现指数退避、熔断器模式和智能重试策略
 */

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  BROWSER_ERROR = 'BROWSER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR'
}

export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  multiplier: number;
  maxDelay: number;
  jitter: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export interface RetryContext {
  operation: string;
  attempt: number;
  maxAttempts: number;
  lastError?: Error;
  startTime: number;
  totalDelay: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
  context: RetryContext;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - operation blocked');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) { // 需要连续3次成功才完全恢复
        this.state = 'CLOSED';
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  getStats(): {
    state: string;
    failures: number;
    lastFailureTime: number;
    successCount: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

export class RetryManager {
  private retryStrategies: Map<ErrorType, RetryStrategy> = new Map([
    [ErrorType.NETWORK_ERROR, { 
      maxRetries: 3, 
      baseDelay: 1000, 
      multiplier: 2, 
      maxDelay: 10000, 
      jitter: true 
    }],
    [ErrorType.TIMEOUT_ERROR, { 
      maxRetries: 2, 
      baseDelay: 5000, 
      multiplier: 1.5, 
      maxDelay: 15000, 
      jitter: true 
    }],
    [ErrorType.BROWSER_ERROR, { 
      maxRetries: 2, 
      baseDelay: 3000, 
      multiplier: 2, 
      maxDelay: 12000, 
      jitter: false 
    }],
    [ErrorType.RATE_LIMIT_ERROR, { 
      maxRetries: 5, 
      baseDelay: 60000, 
      multiplier: 1, 
      maxDelay: 60000, 
      jitter: false 
    }],
    [ErrorType.AUTHENTICATION_ERROR, { 
      maxRetries: 1, 
      baseDelay: 5000, 
      multiplier: 1, 
      maxDelay: 5000, 
      jitter: false 
    }],
    [ErrorType.CONNECTION_ERROR, { 
      maxRetries: 4, 
      baseDelay: 2000, 
      multiplier: 2, 
      maxDelay: 16000, 
      jitter: true 
    }],
    [ErrorType.SERVER_ERROR, { 
      maxRetries: 3, 
      baseDelay: 3000, 
      multiplier: 1.8, 
      maxDelay: 20000, 
      jitter: true 
    }]
  ]);

  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private operationStats: Map<string, {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    averageRetries: number;
    lastExecutionTime: number;
  }> = new Map();

  constructor() {
    // 初始化默认熔断器
    this.circuitBreakers.set('default', new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1分钟
      monitoringPeriod: 300000 // 5分钟
    }));

    this.circuitBreakers.set('browser', new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 120000, // 2分钟
      monitoringPeriod: 600000 // 10分钟
    }));

    this.circuitBreakers.set('api', new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1分钟
      monitoringPeriod: 300000 // 5分钟
    }));
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    errorType?: ErrorType,
    customStrategy?: Partial<RetryStrategy>
  ): Promise<T> {
    const strategy = this.getRetryStrategy(errorType, customStrategy);
    const circuitBreaker = this.getCircuitBreaker(operationName);
    const context: RetryContext = {
      operation: operationName,
      attempt: 0,
      maxAttempts: strategy.maxRetries + 1,
      startTime: Date.now(),
      totalDelay: 0
    };

    let lastError: Error = new Error('未知错误');

    for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
      context.attempt = attempt + 1;

      try {
        const result = await circuitBreaker.execute(operation);
        this.recordSuccess(operationName, context);
        return result;
      } catch (error) {
        lastError = error as Error;
        context.lastError = lastError;

        // 记录错误
        logger.error('操作失败 (${operationName}) - 尝试 ${attempt + 1}/${strategy.maxRetries + 1}:', new EnhancedError('操作失败 (${operationName}) - 尝试 ${attempt + 1}/${strategy.maxRetries + 1}:', { error: lastError.message,
          errorType: this.classifyError(lastError),
          attempt: attempt + 1,
          operationName
         }));
        // 如果是最后一次尝试，不再重试
        if (attempt === strategy.maxRetries) {
          break;
        }

        // 计算延迟时间
        const delay = this.calculateDelay(strategy, attempt);
        context.totalDelay += delay;

        // 等待后重试
        await this.delay(delay);
      }
    }

    // 记录失败
    this.recordFailure(operationName, context);
    
    throw new Error(
      `操作 "${operationName}" 在 ${strategy.maxRetries + 1} 次尝试后失败: ${lastError.message}`
    );
  }

  /**
   * 执行带超时的重试操作
   */
  async executeWithTimeoutAndRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    timeout: number,
    errorType?: ErrorType,
    customStrategy?: Partial<RetryStrategy>
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`操作 "${operationName}" 超时 (${timeout}ms)`));
      }, timeout);
    });

    return Promise.race([
      this.executeWithRetry(operation, operationName, errorType, customStrategy),
      timeoutPromise
    ]);
  }

  /**
   * 批量执行操作（带并发控制）
   */
  async executeBatch<T>(
    operations: Array<{
      operation: () => Promise<T>;
      name: string;
      errorType?: ErrorType;
    }>,
    options: {
      concurrency?: number;
      failFast?: boolean;
      timeout?: number;
    } = {}
  ): Promise<Array<{
    success: boolean;
    result?: T;
    error?: Error;
    operationName: string;
    attempts: number;
  }>> {
    const { concurrency = 3, failFast = false, timeout } = options;
    const results: Array<{
      success: boolean;
      result?: T;
      error?: Error;
      operationName: string;
      attempts: number;
    }> = [];

    // 分批处理
    const chunks: Array<{ operation: () => Promise<T>; name: string; errorType?: ErrorType }[]> = [];
    for (let i = 0; i < operations.length; i += concurrency) {
      chunks.push(operations.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk?.filter(Boolean)?.map(async (op) => {
        try {
          const result = await this.executeWithRetry(
            op.operation,
            op.name,
            op.errorType
          );

          return {
            success: true,
            result,
            operationName: op.name,
            attempts: 1
          };
        } catch (error) {
          const stats = this.operationStats.get(op.name);
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            operationName: op.name,
            attempts: stats?.totalAttempts || 1
          };
        }
      });

      try {
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      } catch (error) {
        if (failFast) {
          throw error;
        }
      }

      // 在处理下一批之前稍作延迟
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(1000);
      }
    }

    return results;
  }

  /**
   * 获取重试策略
   */
  private getRetryStrategy(
    errorType?: ErrorType, 
    customStrategy?: Partial<RetryStrategy>
  ): RetryStrategy {
    const baseStrategy = errorType 
      ? this.retryStrategies.get(errorType) 
      : this.retryStrategies.get(ErrorType.SYSTEM_ERROR);

    const defaultStrategy: RetryStrategy = {
      maxRetries: 3,
      baseDelay: 1000,
      multiplier: 2,
      maxDelay: 10000,
      jitter: true
    };

    return {
      ...(baseStrategy || defaultStrategy),
      ...customStrategy
    };
  }

  /**
   * 获取熔断器
   */
  private getCircuitBreaker(operationName: string): CircuitBreaker {
    // 根据操作名称选择合适的熔断器
    if (operationName.includes('browser') || operationName.includes('Browser')) {
      return this.circuitBreakers.get('browser')!;
    } else if (operationName.includes('api') || operationName.includes('Api')) {
      return this.circuitBreakers.get('api')!;
    } else {
      return this.circuitBreakers.get('default')!;
    }
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(strategy: RetryStrategy, attempt: number): number {
    let delay = strategy.baseDelay * Math.pow(strategy.multiplier, attempt);
    delay = Math.min(delay, strategy.maxDelay);

    // 添加抖动以避免雷群效应
    if (strategy.jitter) {
      const jitterAmount = delay * 0.1; // 10%的抖动
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(delay, 0);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 错误分类
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('超时')) {
      return ErrorType.TIMEOUT_ERROR;
    } else if (message.includes('network') || message.includes('网络') || message.includes('fetch')) {
      return ErrorType.NETWORK_ERROR;
    } else if (message.includes('auth') || message.includes('认证') || message.includes('unauthorized')) {
      return ErrorType.AUTHENTICATION_ERROR;
    } else if (message.includes('rate limit') || message.includes('限流') || message.includes('too many requests')) {
      return ErrorType.RATE_LIMIT_ERROR;
    } else if (message.includes('browser') || message.includes('浏览器') || message.includes('puppeteer')) {
      return ErrorType.BROWSER_ERROR;
    } else if (message.includes('connection') || message.includes('连接') || message.includes('econnrefused')) {
      return ErrorType.CONNECTION_ERROR;
    } else if (message.includes('server error') || message.includes('服务器错误') || message.includes('5')) {
      return ErrorType.SERVER_ERROR;
    } else {
      return ErrorType.SYSTEM_ERROR;
    }
  }

  /**
   * 记录成功操作
   */
  private recordSuccess(operationName: string, context: RetryContext): void {
    const stats = this.operationStats.get(operationName) || {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      averageRetries: 0,
      lastExecutionTime: 0
    };

    stats.totalAttempts++;
    stats.successfulAttempts++;
    stats.lastExecutionTime = Date.now();
    
    // 更新平均重试次数
    stats.averageRetries = (stats.averageRetries * (stats.totalAttempts - 1) + (context.attempt - 1)) / stats.totalAttempts;

    this.operationStats.set(operationName, stats);
  }

  /**
   * 记录失败操作
   */
  private recordFailure(operationName: string, context: RetryContext): void {
    const stats = this.operationStats.get(operationName) || {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      averageRetries: 0,
      lastExecutionTime: 0
    };

    stats.totalAttempts++;
    stats.failedAttempts++;
    stats.lastExecutionTime = Date.now();
    
    // 更新平均重试次数
    stats.averageRetries = (stats.averageRetries * (stats.totalAttempts - 1) + context.maxAttempts) / stats.totalAttempts;

    this.operationStats.set(operationName, stats);
  }

  /**
   * 获取操作统计信息
   */
  getOperationStats(operationName?: string): Map<string, unknown> | unknown {
    if (operationName) {
      return this.operationStats.get(operationName);
    }
    return this.operationStats;
  }

  /**
   * 获取熔断器状态
   */
  getCircuitBreakerStats(): Map<string, unknown> {
    const stats = new Map();
    for (const [name, breaker] of this.circuitBreakers) {
      stats.set(name, breaker.getStats());
    }
    return stats;
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.operationStats.clear();
  }

  /**
   * 重置熔断器
   */
  resetCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      // 重新创建熔断器实例来重置状态
      const stats = breaker.getStats();
      // 这里需要重新初始化，但保持配置
    }
  }

  /**
   * 添加自定义重试策略
   */
  addRetryStrategy(errorType: ErrorType, strategy: RetryStrategy): void {
    this.retryStrategies.set(errorType, strategy);
  }

  /**
   * 添加自定义熔断器
   */
  addCircuitBreaker(name: string, config: CircuitBreakerConfig): void {
    this.circuitBreakers.set(name, new CircuitBreaker(config));
  }

  /**
   * 健康检查
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    circuitBreakers: Record<string, string>;
    operationStats: {
      totalOperations: number;
      successRate: number;
      averageRetries: number;
    };
  } {
    const circuitBreakerStates: Record<string, string> = {};
    let openBreakers = 0;

    for (const [name, breaker] of this.circuitBreakers) {
      const state = breaker.getState();
      circuitBreakerStates[name] = state;
      if (state === 'OPEN') openBreakers++;
    }

    let totalOperations = 0;
    let successfulOperations = 0;
    let totalRetries = 0;

    for (const stats of this.operationStats.values()) {
      totalOperations += stats.totalAttempts;
      successfulOperations += stats.successfulAttempts;
      totalRetries += stats.averageRetries * stats.totalAttempts;
    }

    const successRate = totalOperations > 0 ? successfulOperations / totalOperations : 1;
    const averageRetries = totalOperations > 0 ? totalRetries / totalOperations : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (openBreakers === 0 && successRate >= 0.95) {
      status = 'healthy';
    } else if (openBreakers <= 1 && successRate >= 0.8) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      circuitBreakers: circuitBreakerStates,
      operationStats: {
        totalOperations,
        successRate,
        averageRetries
      }
    };
  }
}