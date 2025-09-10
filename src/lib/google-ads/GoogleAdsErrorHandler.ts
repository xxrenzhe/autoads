import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('GoogleAdsErrorHandler');

export interface GoogleAdsError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  accountId?: string;
  operation?: string;
  requestId?: string;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'quota' | 'rate_limit' | 'validation' | 'network' | 'internal' | 'unknown';
}

export interface ErrorHandlingStrategy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  timeout: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  lastFailureTime: Date;
  failureCount: number;
  nextAttemptTime: Date;
}

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  delay: number;
  error: GoogleAdsError;
  operation: string;
  accountId?: string;
}

export interface ErrorMetrics {
  totalErrors: number;
  retryableErrors: number;
  nonRetryableErrors: number;
  errorByCode: Record<string, number>;
  errorByCategory: Record<string, number>;
  errorByAccount: Record<string, number>;
  averageRetryAttempts: number;
  successAfterRetry: number;
  lastErrorTime: Date;
}

export class GoogleAdsErrorHandler {
  private static instance: GoogleAdsErrorHandler;
  private errorHistory: GoogleAdsError[] = [];
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private errorMetrics: ErrorMetrics;
  private strategy: ErrorHandlingStrategy;

  constructor(strategy: Partial<ErrorHandlingStrategy> = {}) {
    this.strategy = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      timeout: 30000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000, // 1 minute
      ...strategy,
    };

    this.errorMetrics = this.initializeMetrics();
    
    // Start periodic cleanup
    this.startCleanupTimer();
  }

  static getInstance(): GoogleAdsErrorHandler {
    if (!GoogleAdsErrorHandler.instance) {
      GoogleAdsErrorHandler.instance = new GoogleAdsErrorHandler();
    }
    return GoogleAdsErrorHandler.instance;
  }

  /**
   * Execute operation with automatic retry and error handling
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      accountId?: string;
      operation?: string;
      customRetryCondition?: (error: any) => boolean;
      skipCircuitBreaker?: boolean;
    } = {}
  ): Promise<T> {
    const operationId = Math.random().toString(36).substring(7);
    const startTime = Date.now();
    let attempt = 0;

    while (attempt <= this.strategy.maxRetries) {
      try {
        // Check circuit breaker
        if (!context.skipCircuitBreaker && this.isCircuitBreakerOpen(context.accountId || 'default')) {
          throw new Error('Circuit breaker is open - operations temporarily suspended');
        }

        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), this.strategy.timeout)
          ),
        ]);

        // Success - reset circuit breaker if it was open
        if (context.accountId) {
          this.resetCircuitBreaker(context.accountId);
        }

        // Log successful retry
        if (attempt > 0) {
          this.logRetrySuccess(context.operation || 'unknown', attempt, context.accountId);
        }

        return result;
      } catch (error) {
        attempt++;
        
        const googleAdsError = this.normalizeError(error, context);
        this.logError(googleAdsError);

        // Update circuit breaker state
        if (context.accountId && googleAdsError.retryable) {
          this.updateCircuitBreaker(context.accountId, googleAdsError);
        }

        // Check if we should retry
        if (!this.shouldRetry(googleAdsError, attempt, context.customRetryCondition)) {
          throw error;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, googleAdsError);
        
        // Log retry attempt
        this.logRetryAttempt(googleAdsError, attempt, delay, context);

        // Wait before retry
        await this.delay(delay);
      }
    }

    throw new Error(`Max retries (${this.strategy.maxRetries}) exceeded`);
  }

  /**
   * Execute multiple operations with bulk error handling
   */
  async executeBulkWithRetry<T>(
    operations: Array<() => Promise<T>>,
    options: {
      concurrency?: number;
      continueOnError?: boolean;
      accountId?: string;
      operationName?: string;
    } = {}
  ): Promise<Array<{
    success: boolean;
    result?: T;
    error?: GoogleAdsError;
    attempt: number;
    processingTime: number;
  }>> {
    const {
      concurrency = 5,
      continueOnError = true,
      accountId,
      operationName = 'bulk_operation',
    } = options;

    const results: Array<{
      success: boolean;
      result?: T;
      error?: GoogleAdsError;
      attempt: number;
      processingTime: number;
    }> = [];

    const chunks = this.chunkArray(operations, concurrency);

    for (const chunk of chunks) {
      const promises = chunk?.filter(Boolean)?.map(async (operation, index) => {
        const startTime = Date.now();
        let attempt = 0;

        while (attempt <= this.strategy.maxRetries) {
          try {
            const result = await this.executeWithRetry(operation, {
              accountId,
              operation: `${operationName}_${index}`,
            });

            results.push({
              success: true,
              result,
              attempt,
              processingTime: Date.now() - startTime,
            });

            break;
          } catch (error) {
            attempt++;

            const googleAdsError = this.normalizeError(error, { accountId, operation: `${operationName}_${index}` });
            
            if (attempt > this.strategy.maxRetries || !continueOnError) {
              results.push({
                success: false,
                error: googleAdsError,
                attempt,
                processingTime: Date.now() - startTime,
              });

              if (!continueOnError) {
                throw error;
              }
              break;
            }

            const delay = this.calculateDelay(attempt, googleAdsError);
            await this.delay(delay);
          }
        }
      });

      await Promise.allSettled(promises);
    }

    return results;
  }

  /**
   * Create a resilient API client wrapper
   */
  createResilientApiClient<T extends object>(
    apiClient: T,
    context: { accountId?: string; clientName?: string } = {}
  ): T {
    const resilientClient: any = {};

    Object.keys(apiClient).forEach(methodName => {
      if (typeof apiClient[methodName as keyof T] === 'function') {
        resilientClient[methodName as keyof T] = async (...args: any[]) => {
          return this.executeWithRetry(
            () => (apiClient[methodName as keyof T] as any)(...args),
            {
              accountId: context.accountId,
              operation: `${context.clientName || 'api_client'}.${methodName}`,
            }
          );
        };
      } else {
        resilientClient[methodName as keyof T] = apiClient[methodName as keyof T];
      }
    });

    return resilientClient as T;
  }

  /**
   * Get error handling metrics
   */
  getErrorMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  /**
   * Get error history with filtering
   */
  getErrorHistory(filters: {
    accountId?: string;
    operation?: string;
    category?: string;
    severity?: string;
    retryable?: boolean;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  } = {}): GoogleAdsError[] {
    let filtered = [...this.errorHistory];

    if (filters.accountId) {
      filtered = filtered.filter(error => error.accountId === filters.accountId);
    }

    if (filters.operation) {
      filtered = filtered.filter(error => error.operation === filters.operation);
    }

    if (filters.category) {
      filtered = filtered.filter(error => error.category === filters.category);
    }

    if (filters.severity) {
      filtered = filtered.filter(error => error.severity === filters.severity);
    }

    if (filters.retryable !== undefined) {
      filtered = filtered.filter(error => error.retryable === filters.retryable);
    }

    if (filters.startTime) {
      filtered = filtered.filter(error => error.timestamp >= filters.startTime!);
    }

    if (filters.endTime) {
      filtered = filtered.filter(error => error.timestamp <= filters.endTime!);
    }

    if (filters.limit) {
      filtered = filtered.slice(-filters.limit);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(accountId: string = 'default'): {
    isOpen: boolean;
    failureCount: number;
    lastFailureTime?: Date;
    nextAttemptTime?: Date;
    timeUntilReset?: number;
  } {
    const state = this.circuitBreakers.get(accountId);
    
    if (!state) {
      return {
        isOpen: false,
        failureCount: 0,
      };
    }

    const timeUntilReset = state.nextAttemptTime.getTime() - Date.now();

    return {
      isOpen: state.isOpen,
      failureCount: state.failureCount,
      lastFailureTime: state.lastFailureTime,
      nextAttemptTime: state.nextAttemptTime,
      timeUntilReset: timeUntilReset > 0 ? timeUntilReset : 0,
    };
  }

  /**
   * Reset circuit breaker for an account
   */
  resetCircuitBreaker(accountId: string = 'default'): void {
    this.circuitBreakers.delete(accountId);
    logger.info('Circuit breaker reset', { accountId });
  }

  /**
   * Force open circuit breaker for testing
   */
  forceOpenCircuitBreaker(accountId: string = 'default', timeout?: number): void {
    const state: CircuitBreakerState = {
      isOpen: true,
      lastFailureTime: new Date(),
      failureCount: this.strategy.circuitBreakerThreshold,
      nextAttemptTime: new Date(Date.now() + (timeout || this.strategy.circuitBreakerTimeout)),
    };

    this.circuitBreakers.set(accountId, state);
    logger.warn('Circuit breaker force opened', { accountId, timeout });
  }

  // Private methods

  private normalizeError(error: any, context: any): GoogleAdsError {
    const timestamp = new Date();
    
    // Handle different error types
    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const data = error.response.data;
      
      return {
        code: this.getErrorCodeFromHttpStatus(status),
        message: data.error?.message || data.message || error.message || 'HTTP error',
        details: {
          status,
          data,
          url: error.response.config?.url,
          method: error.response.config?.method,
        },
        timestamp,
        accountId: context.accountId,
        operation: context.operation,
        requestId: data.requestId,
        retryable: this.isRetryableHttpStatus(status),
        severity: this.getErrorSeverityFromHttpStatus(status),
        category: this.getErrorCategoryFromHttpStatus(status),
      };
    }

    if (error.code) {
      // Google Ads API error
      return {
        code: error.code,
        message: error.message || 'Google Ads API error',
        details: error.details,
        timestamp,
        accountId: context.accountId,
        operation: context.operation,
        requestId: error.requestId,
        retryable: this.isRetryableGoogleAdsError(error.code),
        severity: this.getErrorSeverityFromGoogleAdsCode(error.code),
        category: this.getErrorCategoryFromGoogleAdsCode(error.code),
      };
    }

    // Generic error
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      details: error,
      timestamp,
      accountId: context.accountId,
      operation: context.operation,
      retryable: this.isRetryableGenericError(error),
      severity: 'medium',
      category: 'unknown',
    };
  }

  private shouldRetry(error: GoogleAdsError, attempt: number, customCondition?: (error: any) => boolean): boolean {
    if (attempt > this.strategy.maxRetries) {
      return false;
    }

    if (customCondition && !customCondition(error)) {
      return false;
    }

    return error.retryable;
  }

  private calculateDelay(attempt: number, error: GoogleAdsError): number {
    let delay = Math.min(
      this.strategy.initialDelay * Math.pow(this.strategy.backoffMultiplier, attempt - 1),
      this.strategy.maxDelay
    );

    // Add jitter to prevent thundering herd
    if (this.strategy.jitter) {
      delay += Math.random() * 1000;
    }

    // Adjust delay based on error severity
    if (error.severity === 'critical') {
      delay *= 2;
    } else if (error.severity === 'high') {
      delay *= 1.5;
    }

    return Math.max(delay, 100); // Minimum delay of 100ms
  }

  private isCircuitBreakerOpen(accountId: string): boolean {
    const state = this.circuitBreakers.get(accountId);
    
    if (!state || !state.isOpen) {
      return false;
    }

    // Check if circuit breaker should be reset
    if (Date.now() >= state.nextAttemptTime.getTime()) {
      this.resetCircuitBreaker(accountId);
      return false;
    }

    return true;
  }

  private updateCircuitBreaker(accountId: string, error: GoogleAdsError): void {
    if (!error.retryable) {
      return; // Only open circuit breaker for retryable errors
    }

    let state = this.circuitBreakers.get(accountId);
    
    if (!state) {
      state = {
        isOpen: false,
        lastFailureTime: new Date(),
        failureCount: 1,
        nextAttemptTime: new Date(Date.now() + this.strategy.circuitBreakerTimeout),
      };
    } else {
      state.failureCount++;
      state.lastFailureTime = new Date();
      
      if (state.failureCount >= this.strategy.circuitBreakerThreshold) {
        state.isOpen = true;
        state.nextAttemptTime = new Date(Date.now() + this.strategy.circuitBreakerTimeout);
        
        logger.warn('Circuit breaker opened', {
          accountId,
          failureCount: state.failureCount,
          threshold: this.strategy.circuitBreakerThreshold,
          timeout: this.strategy.circuitBreakerTimeout,
        });
      }
    }

    this.circuitBreakers.set(accountId, state);
  }

  private logError(error: GoogleAdsError): void {
    // Add to history
    this.errorHistory.push(error);
    
    // Keep only last 1000 errors
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000);
    }

    // Update metrics
    this.updateMetrics(error);

    // Log with appropriate level
    const logMessage = `Google Ads API error: ${error.message} (${error.code})`;
    const logContext = {
      accountId: error.accountId,
      operation: error.operation,
      code: error.code,
      category: error.category,
      severity: error.severity,
      retryable: error.retryable,
    };

    switch (error.severity) {
      case 'critical':
        logger.error(logMessage, new Error(logMessage));
        break;
      case 'high':
        logger.error(logMessage, new Error(logMessage));
        break;
      case 'medium':
        logger.warn(logMessage, logContext);
        break;
      case 'low':
        logger.info(logMessage, logContext);
        break;
    }
  }

  private logRetryAttempt(error: GoogleAdsError, attempt: number, delay: number, context: any): void {
    logger.info('Retry attempt', {
      accountId: context.accountId,
      operation: context.operation,
      attempt,
      maxAttempts: this.strategy.maxRetries,
      delay,
      errorCode: error.code,
      errorMessage: error.message,
    });
  }

  private logRetrySuccess(operation: string, attempts: number, accountId?: string): void {
    logger.info('Operation succeeded after retry', {
      accountId,
      operation,
      attempts,
    });
  }

  private updateMetrics(error: GoogleAdsError): void {
    this.errorMetrics.totalErrors++;
    
    if (error.retryable) {
      this.errorMetrics.retryableErrors++;
    } else {
      this.errorMetrics.nonRetryableErrors++;
    }

    this.errorMetrics.errorByCode[error.code] = (this.errorMetrics.errorByCode[error.code] || 0) + 1;
    this.errorMetrics.errorByCategory[error.category] = (this.errorMetrics.errorByCategory[error.category] || 0) + 1;
    
    if (error.accountId) {
      this.errorMetrics.errorByAccount[error.accountId] = (this.errorMetrics.errorByAccount[error.accountId] || 0) + 1;
    }

    this.errorMetrics.lastErrorTime = error.timestamp;
  }

  private initializeMetrics(): ErrorMetrics {
    return {
      totalErrors: 0,
      retryableErrors: 0,
      nonRetryableErrors: 0,
      errorByCode: {},
      errorByCategory: {},
      errorByAccount: {},
      averageRetryAttempts: 0,
      successAfterRetry: 0,
      lastErrorTime: new Date(0),
    };
  }

  private getErrorCodeFromHttpStatus(status: number): string {
    const statusCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };

    return statusCodes[status] || `HTTP_${status}`;
  }

  private isRetryableHttpStatus(status: number): boolean {
    const retryableStatuses = [429, 500, 502, 503, 504];
    return retryableStatuses.includes(status);
  }

  private getErrorSeverityFromHttpStatus(status: number): GoogleAdsError['severity'] {
    if (status >= 500) return 'high';
    if (status === 429) return 'medium';
    if (status >= 400) return 'low';
    return 'medium';
  }

  private getErrorCategoryFromHttpStatus(status: number): GoogleAdsError['category'] {
    if (status === 401) return 'authentication';
    if (status === 403) return 'authorization';
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'internal';
    if (status >= 400) return 'validation';
    return 'unknown';
  }

  private isRetryableGoogleAdsError(code: string): boolean {
    const retryableCodes = [
      'RATE_LIMIT_EXCEEDED',
      'QUOTA_EXCEEDED',
      'INTERNAL_ERROR',
      'UNAVAILABLE',
      'DEADLINE_EXCEEDED',
      'RESOURCE_EXHAUSTED',
      'ABORTED',
      'CANCELLED',
    ];

    return retryableCodes.includes(code);
  }

  private getErrorSeverityFromGoogleAdsCode(code: string): GoogleAdsError['severity'] {
    const severeCodes = ['INTERNAL_ERROR', 'UNAVAILABLE', 'DEADLINE_EXCEEDED'];
    const highCodes = ['QUOTA_EXCEEDED', 'RATE_LIMIT_EXCEEDED', 'RESOURCE_EXHAUSTED'];
    
    if (severeCodes.includes(code)) return 'high';
    if (highCodes.includes(code)) return 'medium';
    return 'low';
  }

  private getErrorCategoryFromGoogleAdsCode(code: string): GoogleAdsError['category'] {
    if (code.includes('QUOTA') || code.includes('RATE_LIMIT')) return 'quota';
    if (code.includes('AUTH') || code.includes('PERMISSION')) return 'authorization';
    if (code.includes('INTERNAL') || code.includes('UNAVAILABLE')) return 'internal';
    if (code.includes('VALIDATION') || code.includes('INVALID')) return 'validation';
    return 'unknown';
  }

  private isRetryableGenericError(error: any): boolean {
    // Network errors, timeouts, etc.
    return error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT' ||
           error.code === 'ENOTFOUND' ||
           error.message?.includes('timeout') ||
           error.message?.includes('network') ||
           error.message?.includes('connection');
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startCleanupTimer(): void {
    // Clean up old error history every hour
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      this.errorHistory = this.errorHistory.filter(error => error.timestamp > oneHourAgo);
      
      // Clean up old circuit breaker states
      for (const [accountId, state] of this.circuitBreakers) {
        if (Date.now() > state.nextAttemptTime.getTime() + 24 * 60 * 60 * 1000) {
          this.circuitBreakers.delete(accountId);
        }
      }

      logger.debug('Error handler cleanup completed', {
        errorHistorySize: this.errorHistory.length,
        circuitBreakersCount: this.circuitBreakers.size,
      });
    }, 60 * 60 * 1000); // 1 hour
  }
}

// Utility functions for creating error handlers
export function createGoogleAdsErrorHandler(strategy?: Partial<ErrorHandlingStrategy>): GoogleAdsErrorHandler {
  return GoogleAdsErrorHandler.getInstance();
}

export function withRetry<T>(
  operation: () => Promise<T>,
  context?: {
    accountId?: string;
    operation?: string;
    customRetryCondition?: (error: any) => boolean;
  }
): Promise<T> {
  const handler = GoogleAdsErrorHandler.getInstance();
  return handler.executeWithRetry(operation, context);
}

export function createResilientApiClient<T extends object>(
  apiClient: T,
  context?: { accountId?: string; clientName?: string }
): T {
  const handler = GoogleAdsErrorHandler.getInstance();
  return handler.createResilientApiClient(apiClient, context);
}