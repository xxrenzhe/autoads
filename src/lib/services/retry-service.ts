/**
 * 重试机制服务
 * 提供智能重试策略和错误恢复机制
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import React from 'react';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('RetryService');

// 重试配置
const RETRY_CONFIG = {
  // 最大重试次数
  MAX_RETRIES: 3,
  // 基础延迟时间 (毫秒)
  BASE_DELAY: 1000,
  // 最大延迟时间 (毫秒)
  MAX_DELAY: 30000,
  // 指数退避因子
  BACKOFF_FACTOR: 2,
  // 抖动因子 (0-1)
  JITTER_FACTOR: 0.1,
  // 可重试的错误类型
  RETRIABLE_ERROR_TYPES: [
    'network_error',
    'timeout_error',
    'rate_limit_error',
    'temporary_error',
    'connection_error'
  ],
  // 不可重试的错误类型
  NON_RETRIABLE_ERROR_TYPES: [
    'validation_error',
    'authentication_error',
    'authorization_error',
    'not_found_error',
    'conflict_error'
  ]
} as const;

// 重试选项接口
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitterFactor?: number;
  retriableErrorTypes?: string[];
  nonRetriableErrorTypes?: string[];
  onRetry?: (error: Error, attempt: number) => void;
  onSuccess?: (attempt: number) => void;
  onFailure?: (error: Error) => void;
}

// 重试结果接口
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

// 错误分类接口
export interface ErrorClassification {
  isRetriable: boolean;
  errorType: string;
  shouldRetry: boolean;
  recommendedDelay: number;
}

export class RetryService {
  private static instance: RetryService;
  
  private constructor() {}
  
  static getInstance(): RetryService {
    if (!RetryService.instance) {
      RetryService.instance = new RetryService();
    }
    return RetryService.instance;
  }
  
  /**
   * 执行带重试的异步操作
   * @param operation 要执行的异步操作
   * @param options 重试选项
   * @returns 重试结果
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const config = { ...RETRY_CONFIG, ...options };
    
    let lastError: Error | undefined;
    let attempts = 0;
    
    for (let attempt = 0; attempt <= config.maxRetries!; attempt++) {
      attempts = attempt + 1;
      
      try {
        const result = await operation();
        
        // 成功回调
        if (config.onSuccess) {
          config.onSuccess(attempts);
        }
        
        logger.info('操作成功完成', {
          attempts,
          totalDuration: Date.now() - startTime
        });
        
        return {
          success: true,
          data: result,
          attempts,
          totalDuration: Date.now() - startTime
        };
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 分类错误
        const classification = this.classifyError(lastError, config);
        
        logger.warn('操作失败', {
          attempt: attempts,
          error: lastError.message,
          errorType: classification.errorType,
          isRetriable: classification.isRetriable,
          shouldRetry: classification.shouldRetry
        });
        
        // 检查是否应该重试
        if (!classification.shouldRetry || attempt === config.maxRetries) {
          break;
        }
        
        // 重试回调
        if (config.onRetry) {
          config.onRetry(lastError, attempts);
        }
        
        // 计算延迟时间
        const delay = this.calculateDelay(attempt, classification.recommendedDelay, config);
        
        logger.info('等待重试', {
          attempt: attempts,
          delay: `${delay}ms`,
          nextAttempt: attempts + 1
        });
        
        // 等待延迟
        await this.sleep(delay);
      }
    }
    
    // 失败回调
    if (config.onFailure && lastError) {
      config.onFailure(lastError);
    }
    
    logger.error('操作最终失败', new EnhancedError('操作最终失败', { 
      attempts,
      totalDuration: Date.now() - startTime,
      error: lastError?.message
     }));
    
    return {
      success: false,
      error: lastError,
      attempts,
      totalDuration: Date.now() - startTime
    };
  }
  
  /**
   * 分类错误类型
   * @param error 错误对象
   * @param config 重试配置
   * @returns 错误分类
   */
  private classifyError(error: Error, config: RetryOptions): ErrorClassification {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();
    
    // 检查是否为不可重试的错误类型
    for (const nonRetriableType of config.nonRetriableErrorTypes || []) {
      if (errorMessage.includes(nonRetriableType) || errorName.includes(nonRetriableType)) {
        return {
          isRetriable: false,
          errorType: nonRetriableType,
          shouldRetry: false,
          recommendedDelay: 0
        };
      }
    }
    
    // 检查是否为可重试的错误类型
    for (const retriableType of config.retriableErrorTypes || []) {
      if (errorMessage.includes(retriableType) || errorName.includes(retriableType)) {
        return {
          isRetriable: true,
          errorType: retriableType,
          shouldRetry: true,
          recommendedDelay: this.getRecommendedDelay(retriableType)
        };
      }
    }
    
    // 基于错误消息的启发式分类
    if (errorMessage.includes('timeout') || errorMessage.includes('etimedout') || errorMessage.includes('timed out')) {
      return {
        isRetriable: true,
        errorType: 'timeout_error',
        shouldRetry: true,
        recommendedDelay: 2000
      };
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('enetdown') || errorMessage.includes('econnrefused') || 
        errorMessage.includes('fetch') || errorMessage.includes('failed to fetch')) {
      return {
        isRetriable: true,
        errorType: 'network_error',
        shouldRetry: true,
        recommendedDelay: 3000
      };
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests') || 
        errorMessage.includes('429') || errorMessage.includes('quota')) {
      return {
        isRetriable: true,
        errorType: 'rate_limit_error',
        shouldRetry: true,
        recommendedDelay: 5000
      };
    }
    
    if (errorMessage.includes('connection') || errorMessage.includes('econnreset') || 
        errorMessage.includes('connection reset') || errorMessage.includes('connection refused')) {
      return {
        isRetriable: true,
        errorType: 'connection_error',
        shouldRetry: true,
        recommendedDelay: 1000
      };
    }
    
    // 特殊处理页面关闭错误
    if (errorMessage.includes('页面已关闭') || errorMessage.includes('page closed') || 
        errorMessage.includes('target closed') || errorMessage.includes('context was destroyed')) {
      return {
        isRetriable: true,
        errorType: 'browser_error',
        shouldRetry: true,
        recommendedDelay: 1500
      };
    }
    
    // 处理代理相关错误
    if (errorMessage.includes('proxy') || errorMessage.includes('tunnel') || 
        errorMessage.includes('socks') || errorMessage.includes('代理')) {
      return {
        isRetriable: true,
        errorType: 'proxy_error',
        shouldRetry: true,
        recommendedDelay: 2000
      };
    }
    
    // 默认情况下，假设错误是临时性的
    return {
      isRetriable: true,
      errorType: 'temporary_error',
      shouldRetry: true,
      recommendedDelay: 1000
    };
  }
  
  /**
   * 计算重试延迟时间
   * @param attempt 重试次数
   * @param recommendedDelay 推荐延迟
   * @param config 重试配置
   * @returns 延迟时间
   */
  private calculateDelay(attempt: number, recommendedDelay: number, config: RetryOptions): number {
    // 指数退避
    const exponentialDelay = config.baseDelay! * Math.pow(config.backoffFactor!, attempt);
    
    // 使用推荐延迟和指数退避的较大值
    const baseDelay = Math.max(recommendedDelay, exponentialDelay);
    
    // 添加抖动以避免 thundering herd 问题
    const jitter = baseDelay * config.jitterFactor! * (Math.random() * 2 - 1);
    
    // 限制最大延迟
    const finalDelay = Math.min(baseDelay + jitter, config.maxDelay!);
    
    return Math.max(0, Math.floor(finalDelay));
  }
  
  /**
   * 获取推荐延迟时间
   * @param errorType 错误类型
   * @returns 推荐延迟时间
   */
  private getRecommendedDelay(errorType: string): number {
    switch (errorType) {
      case 'timeout_error':
        return 2000;
      case 'network_error':
        return 3000;
      case 'rate_limit_error':
        return 5000;
      case 'connection_error':
        return 1000;
      case 'browser_error':
        return 1500;
      case 'proxy_error':
        return 2000;
      case 'temporary_error':
        return 1000;
      default:
        return 1000;
    }
  }

  /**
   * 获取智能重试延迟 - 基于错误类型和重试次数的动态延迟
   * @param errorType 错误类型
   * @param attempt 重试次数
   * @param baseDelay 基础延迟
   * @returns 智能延迟时间
   */
  private getSmartRetryDelay(errorType: string, attempt: number, baseDelay: number = 1000): number {
    // 基础延迟乘数
    const baseMultiplier = Math.min(attempt, 5); // 最多5倍
    
    // 根据错误类型调整策略
    switch (errorType) {
      case 'timeout_error':
        // 超时错误：线性增长，避免过长的等待
        return Math.min(baseDelay * attempt, 8000);
        
      case 'network_error':
        // 网络错误：指数退避，但上限较低
        return Math.min(baseDelay * Math.pow(1.5, attempt), 10000);
        
      case 'rate_limit_error':
        // 限流错误：较长的指数退避
        return Math.min(baseDelay * Math.pow(2, attempt), 30000);
        
      case 'connection_error':
        // 连接错误：快速重试，适合临时连接问题
        return Math.min(baseDelay * Math.pow(1.2, attempt), 5000);
        
      case 'browser_error':
        // 浏览器错误：中等重试间隔
        return Math.min(baseDelay * Math.pow(1.3, attempt), 6000);
        
      case 'proxy_error':
        // 代理错误：较短的重试间隔，代理问题通常是暂时的
        return Math.min(baseDelay * Math.pow(1.4, attempt), 8000);
        
      case 'temporary_error':
        // 临时错误：标准指数退避
        return Math.min(baseDelay * Math.pow(1.8, attempt), 15000);
        
      default:
        // 默认：保守的指数退避
        return Math.min(baseDelay * Math.pow(1.5, attempt), 10000);
    }
  }
  
  /**
   * 睡眠函数
   * @param ms 毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 创建带重试的函数包装器
   * @param fn 要包装的函数
   * @param options 重试选项
   * @returns 带重试的函数
   */
  withRetry<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    options: RetryOptions = {}
  ): (...args: T) => Promise<RetryResult<R>> {
    return async (...args: T) => {
      return this.executeWithRetry(() => fn(...args), options);
    };
  }
  
  /**
   * 批量执行带重试的操作
   * @param operations 操作数组
   * @param options 重试选项
   * @returns 重试结果数组
   */
  async executeBatchWithRetry<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>[]> {
    const results: RetryResult<T>[] = [];
    
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      
      try {
        const result = await this.executeWithRetry(operation, {
          ...options,
          onRetry: (error, attempt) => {
            logger.warn('批量操作重试', {
              operationIndex: i,
              attempt,
              error: error.message
            });
            if (options.onRetry) {
              options.onRetry(error, attempt);
            }
          }
        });
        
        results.push(result);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        results.push({
          success: false,
          error: err,
          attempts: 1,
          totalDuration: 0
        });
      }
    }
    
    return results;
  }
  
  /**
   * 获取重试统计信息
   */
  getStats() {
    // 这里可以添加重试统计逻辑
    return {
      config: RETRY_CONFIG,
      available: true
    };
  }
}

// 导出单例实例
export const retryService = RetryService.getInstance();

// 便捷的重试装饰器
export function withRetry<T extends any[], R>(
  options: RetryOptions = {}
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const method = descriptor.value!;
    
    descriptor.value = async function (...args: T): Promise<R> {
      const result = await retryService.executeWithRetry(() => method.apply(this, args), options);
      return result.success ? result.data! : Promise.reject(result.error);
    };
    
    return descriptor;
  };
}

// React Hook版本的重试机制
export function useRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  
  const execute = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await retryService.executeWithRetry(operation, {
        ...options,
        onRetry: (err, attempt) => {
          setRetryCount(attempt);
          if (options.onRetry) {
            options.onRetry(err, attempt);
          }
        }
      });
      
      if (result.success) {
        setData(result.data ?? null);
        setError(null);
      } else {
        setError(result.error || new Error('Operation failed'));
      }
    } catch (err) {
      const caughtError = err instanceof Error ? err : new Error(String(err));
      setError(caughtError);
    } finally {
      setLoading(false);
    }
  }, [operation, options]);
  
  return {
    data,
    error,
    loading,
    retryCount,
    execute,
    reset: () => {
      setData(null);
      setError(null);
      setRetryCount(0);
    }
  };
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}