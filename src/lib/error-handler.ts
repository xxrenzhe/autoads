/**
 * Enhanced Error Handling Utilities for ChangeLink
 * Provides comprehensive error handling with retry logic and user-friendly messages
 */

export interface ErrorContext {
  component: string;
  action: string;
  timestamp: number;
  userId?: string;
}

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffFactor: number;
  jitter: boolean;
}

export interface ErrorHandlerOptions {
  enableRetry: boolean;
  retryOptions?: RetryOptions;
  enableLogging: boolean;
  enableUserFeedback: boolean;
  onError?: (error: Error, context: ErrorContext) => void;
}

export class ErrorHandler {
  private static readonly DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 3,
    delayMs: 1000,
    backoffFactor: 2,
    jitter: true
  };

  private static readonly ERROR_CODES = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTH_ERROR: 'AUTH_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  };

  /**
   * Classify error based on type and message
   */
  private static classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name.includes('network') || message.includes('network') || message.includes('fetch')) {
      return this.ERROR_CODES.NETWORK_ERROR;
    }

    if (name.includes('auth') || message.includes('unauthorized') || message.includes('401')) {
      return this.ERROR_CODES.AUTH_ERROR;
    }

    if (name.includes('validation') || message.includes('invalid') || message.includes('400')) {
      return this.ERROR_CODES.VALIDATION_ERROR;
    }

    if (message.includes('rate limit') || message.includes('too many') || message.includes('429')) {
      return this.ERROR_CODES.RATE_LIMIT_ERROR;
    }

    if (message.includes('server') || message.includes('500') || message.includes('502')) {
      return this.ERROR_CODES.SERVER_ERROR;
    }

    if (name.includes('timeout') || message.includes('timeout')) {
      return this.ERROR_CODES.TIMEOUT_ERROR;
    }

    return this.ERROR_CODES.UNKNOWN_ERROR;
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: Error, context?: string): string {
    const errorCode = this.classifyError(error);
    
    const errorMessages = {
      [this.ERROR_CODES.NETWORK_ERROR]: '网络连接失败，请检查您的网络连接后重试。',
      [this.ERROR_CODES.AUTH_ERROR]: '身份验证失败，请检查您的凭据是否正确。',
      [this.ERROR_CODES.VALIDATION_ERROR]: '输入数据无效，请检查您的输入。',
      [this.ERROR_CODES.RATE_LIMIT_ERROR]: '请求过于频繁，请稍后再试。',
      [this.ERROR_CODES.SERVER_ERROR]: '服务器错误，请稍后再试。如果问题持续，请联系技术支持。',
      [this.ERROR_CODES.TIMEOUT_ERROR]: '请求超时，请检查网络连接后重试。',
      [this.ERROR_CODES.UNKNOWN_ERROR]: '发生未知错误，请重试或联系技术支持。'
    };

    const baseMessage = errorMessages[errorCode] || errorMessages[this.ERROR_CODES.UNKNOWN_ERROR];
    
    if (context) {
      return `${context}：${baseMessage}`;
    }
    
    return baseMessage;
  }

  /**
   * Execute operation with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<ErrorHandlerOptions> = {}
  ): Promise<T> {
    const retryOptions = { ...this.DEFAULT_RETRY_OPTIONS, ...options.retryOptions };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (options.enableLogging !== false) {
          console.warn(`Attempt ${attempt} failed:`, error);
        }

        // Don't retry on certain error types
        const errorCode = this.classifyError(lastError);
        if (errorCode === this.ERROR_CODES.VALIDATION_ERROR || 
            errorCode === this.ERROR_CODES.AUTH_ERROR) {
          break;
        }

        // Don't retry on last attempt
        if (attempt === retryOptions.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(retryOptions, attempt);
        
        if (options.enableLogging !== false) {
          console.log(`Retrying in ${delay}ms...`);
        }
        
        await this.delay(delay);
      }
    }

    throw lastError || new Error('Operation failed');
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private static calculateDelay(options: RetryOptions, attempt: number): number {
    let delay = options.delayMs * Math.pow(options.backoffFactor, attempt - 1);
    
    if (options.jitter) {
      // Add random jitter to avoid thundering herd
      const jitter = delay * 0.1; // 10% jitter
      delay = delay + (Math.random() * 2 - 1) * jitter;
    }
    
    return Math.min(delay, 30000); // Cap at 30 seconds
  }

  /**
   * Simple delay helper
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle API response errors
   */
  static handleApiResponse(response: Response): void {
    if (!response.ok) {
      const status = response.status;
      let errorMessage = 'Request failed';

      switch (status) {
        case 400:
          errorMessage = 'Bad request - invalid input data';
          break;
        case 401:
          errorMessage = 'Unauthorized - invalid credentials';
          break;
        case 403:
          errorMessage = 'Forbidden - access denied';
          break;
        case 404:
          errorMessage = 'Resource not found';
          break;
        case 429:
          errorMessage = 'Too many requests - rate limited';
          break;
        case 500:
          errorMessage = 'Internal server error';
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = 'Service unavailable';
          break;
        default:
          errorMessage = `HTTP error ${status}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Create a wrapped API fetch function with error handling
   */
  static async fetchWithHandling(
    url: string,
    options: RequestInit = {},
    errorHandlerOptions: Partial<ErrorHandlerOptions> = {}
  ): Promise<any> {
    return this.withRetry(async () => {
      const response = await fetch(url, options);
      this.handleApiResponse(response);
      
      if (response.status === 204) {
        return null as any;
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Request failed');
      }
      
      return data;
    }, errorHandlerOptions);
  }

  /**
   * Log error with context
   */
  static logError(error: Error, context: ErrorContext): void {
    const errorData = {
      message: error.message,
      stack: error.stack,
      code: this.classifyError(error),
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
    };

    // In production, send to error tracking service
    console.error('Error logged:', errorData);

    // Optionally send to external service
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Example: send to Sentry, LogRocket, etc.
      // this.sendToErrorService(errorData);
    }
  }

  /**
   * Wrap async function with error handling
   */
  static wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context: string,
    options: Partial<ErrorHandlerOptions> = {}
  ) {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        const errorContext: ErrorContext = {
          component: context,
          action: fn.name,
          timestamp: Date.now()
        };

        this.logError(error as Error, errorContext);

        if (options.onError) {
          options.onError(error as Error, errorContext);
        }

        throw error;
      }
    };
  }

  /**
   * Create connection tester with retry logic
   */
  static createConnectionTester(
    testFn: () => Promise<boolean>,
    options: Partial<ErrorHandlerOptions> = {}
  ) {
    return async (): Promise<{ success: boolean; message: string; attempts?: number }> => {
      let attempts = 0;
      
      try {
        const result = await this.withRetry(
          async () => {
            attempts++;
            try {

            return await testFn();

            } catch (error) {

              console.error(error);

              return false;

            }
          },
          {
            ...options,
            retryOptions: {
              maxRetries: 2,
              delayMs: 1000,
              backoffFactor: 1.5,
              jitter: true,
              ...options.retryOptions
            }
          }
        );

        return {
          success: result,
          message: '连接测试成功',
          attempts
        };
      } catch (error) {
        return {
          success: false,
          message: this.getUserMessage(error as Error, '连接测试失败'),
          attempts
        };
      }
    };
  }
}

/**
 * React hook for error handling
 */
import { useCallback, useState } from 'react';
import { EnhancedError } from '@/lib/utils/error-handling';

export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string,
    options: Partial<ErrorHandlerOptions> = {}
  ): Promise<T> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await ErrorHandler.withRetry(operation, options);
      return result;
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj);
      
      const errorContext: ErrorContext = {
        component: context,
        action: 'execute',
        timestamp: Date.now()
      };
      
      ErrorHandler.logError(errorObj, errorContext);
      
      throw errorObj;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    isLoading,
    executeWithErrorHandling,
    clearError
  };
}