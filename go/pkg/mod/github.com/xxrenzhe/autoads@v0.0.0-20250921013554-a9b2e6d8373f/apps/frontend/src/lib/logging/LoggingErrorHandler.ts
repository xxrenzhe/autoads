/**
 * Comprehensive Error Handling and Performance Optimization for Logging System
 * 日志系统的综合错误处理和性能优化
 */

import { createLogger } from "@/lib/utils/security/secure-logger";

const logger = createLogger('LoggingErrorHandler');

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface CacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
}

export interface PerformanceConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  bufferSize: number;
  flushInterval: number;
}

export class LoggingErrorHandler {
  private retryConfig: RetryConfig;
  private cacheConfig: CacheConfig;
  private performanceConfig: PerformanceConfig;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private activeRequests = new Set<string>();
  private requestQueue: Array<() => Promise<any>> = [];

  constructor(
    retryConfig: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    },
    cacheConfig: CacheConfig = {
      maxSize: 100,
      ttl: 30000 // 30 seconds
    },
    performanceConfig: PerformanceConfig = {
      maxConcurrentRequests: 5,
      requestTimeout: 30000,
      bufferSize: 1000,
      flushInterval: 5000
    }
  ) {
    this.retryConfig = retryConfig;
    this.cacheConfig = cacheConfig;
    this.performanceConfig = performanceConfig;

    // 定期清理过期缓存
    setInterval(() => this.cleanupCache(), this.cacheConfig.ttl);
  }

  /**
   * 带重试机制的API调用
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    let lastError: Error;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        try {

        return await this.withTimeout(operation(), this.performanceConfig.requestTimeout);

        } catch (error) {

          console.error(error);

          throw error;

        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === config.maxRetries) {
          logger.error(`Operation failed after ${config.maxRetries + 1} attempts in ${context}:`, lastError);
          break;
        }

        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );

        logger.warn(`Attempt ${attempt + 1} failed in ${context}, retrying in ${delay}ms:`, lastError);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * 带缓存的数据获取
   */
  async withCache<T>(
    key: string,
    operation: () => Promise<T>,
    customTtl?: number
  ): Promise<T> {
    const ttl = customTtl || this.cacheConfig.ttl;
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    const data = await operation();
    
    // 限制缓存大小
    if (this.cache.size >= this.cacheConfig.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * 并发请求控制
   */
  async withConcurrencyControl<T>(
    operation: () => Promise<T>,
    requestId: string
  ): Promise<T> {
    // 如果已经有相同的请求在进行，等待其完成
    if (this.activeRequests.has(requestId)) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (!this.activeRequests.has(requestId)) {
            clearInterval(checkInterval);
            // 重新执行操作
            this.withConcurrencyControl(operation, requestId + '_retry')
              .then(resolve)
              .catch(reject);
          }
        }, 100);
      });
    }

    // 如果并发请求数已达上限，加入队列
    if (this.activeRequests.size >= this.performanceConfig.maxConcurrentRequests) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push(async () => {
          try {
            const result = await this.executeRequest(operation, requestId);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    return this.executeRequest(operation, requestId);
  }

  /**
   * 执行请求
   */
  private async executeRequest<T>(
    operation: () => Promise<T>,
    requestId: string
  ): Promise<T> {
    this.activeRequests.add(requestId);
    
    try {
      const result = await operation();
      return result;
    } finally {
      this.activeRequests.delete(requestId);
      
      // 处理队列中的下一个请求
      if (this.requestQueue.length > 0) {
        const nextRequest = this.requestQueue.shift();
        if (nextRequest) {
          // 异步执行，不阻塞当前请求
          nextRequest().catch(error => {
            logger.error('Queued request failed:', error as Error);
          });
        }
      }
    }
  }

  /**
   * 带超时的Promise包装
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
      })
    ]);
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheConfig.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 优雅降级处理
   */
  async withGracefulDegradation<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      try {

      return await primaryOperation();

      } catch (error) {

        console.error(error);

        throw error;

      }
    } catch (error) {
      logger.warn(`Primary operation failed in ${context}, falling back:`, { error });
      
      try {
        try {

        return await fallbackOperation();

        } catch (error) {

          console.error(error);

          throw error;

        }
      } catch (fallbackError) {
        logger.error(`Fallback operation also failed in ${context}:`, fallbackError as Error);
        throw fallbackError;
      }
    }
  }

  /**
   * 文件系统错误处理
   */
  handleFileSystemError(error: Error, context: string): void {
    if (error.message.includes('ENOENT')) {
      logger.warn(`File not found in ${context}, this may be expected for new log files`);
    } else if (error.message.includes('EACCES')) {
      logger.error(`Permission denied in ${context}:`, error as Error);
    } else if (error.message.includes('ENOSPC')) {
      logger.error(`No space left on device in ${context}:`, error as Error);
    } else if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
      logger.error(`Too many open files in ${context}:`, error as Error);
    } else {
      logger.error(`File system error in ${context}:`, error as Error);
    }
  }

  /**
   * 网络错误处理
   */
  handleNetworkError(error: Error, context: string): boolean {
    if (error.message.includes('fetch')) {
      if (error.message.includes('timeout')) {
        logger.warn(`Request timeout in ${context}, will retry`);
        return true; // 可重试
      } else if (error.message.includes('network')) {
        logger.warn(`Network error in ${context}, will retry`);
        return true; // 可重试
      } else if (error.message.includes('abort')) {
        logger.info(`Request aborted in ${context}`);
        return false; // 不重试
      }
    }
    
    logger.error(`Network error in ${context}:`, error as Error);
    return false; // 默认不重试
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.cacheConfig.maxSize
    };
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats(): {
    activeRequests: number;
    queuedRequests: number;
    maxConcurrentRequests: number;
  } {
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      maxConcurrentRequests: this.performanceConfig.maxConcurrentRequests
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.cache.clear();
    this.activeRequests.clear();
    this.requestQueue.length = 0;
  }
}

// 创建全局错误处理器实例
export const loggingErrorHandler = new LoggingErrorHandler();

/**
 * React Hook for handling component cleanup
 */
export function useLoggingCleanup() {
  const cleanupCallbacks = new Set<() => void>();

  const addCleanup = (callback: () => void) => {
    cleanupCallbacks.add(callback);
  };

  const cleanup = () => {
    cleanupCallbacks.forEach((callback: any) => {
      try {
        callback();
      } catch (error) {
        logger.error('Error during cleanup:', error as Error);
      }
    });
    cleanupCallbacks.clear();
  };

  return { addCleanup, cleanup };
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}