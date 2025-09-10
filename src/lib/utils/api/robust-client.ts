/**
 * Robust API client with retry mechanisms and connection health checks
 * Handles network failures, timeouts, and server errors gracefully
 */

import { createClientLogger } from '@/lib/utils/security/client-secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('RobustApiClient');

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryCondition: (error: any, response?: Response) => boolean;
  timeout: number;
}

export interface ApiClientOptions {
  retryConfig?: Partial<RetryConfig>;
  enableHealthCheck?: boolean;
  onRetry?: (attempt: number, error: any, delay: number) => void;
  onSuccess?: (response: Response, attempt: number) => void;
  onFailure?: (error: any) => void;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  timeout: 10000,
  retryCondition: (error, response) => {
    // Retry on network errors, 5xx errors, 429 (Too Many Requests), and 408 (Request Timeout)
    if (error) return true;
    if (!response) return false;
    return response.status >= 500 || response.status === 429 || response.status === 408;
  }
};

/**
 * Calculate exponential backoff with jitter
 */
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = exponentialDelay * 0.1 * Math.random();
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

/**
 * Robust fetch implementation with retry logic
 */
export async function robustFetch(
  url: string,
  options: RequestInit & { retryConfig?: Partial<RetryConfig> } = {},
  clientOptions: ApiClientOptions = {}
): Promise<Response> {
  const retryConfig = { ...defaultRetryConfig, ...options.retryConfig, ...clientOptions.retryConfig };
  const { signal, ...fetchOptions } = options;
  
  let lastError: any;
  let lastResponse: Response | undefined;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    const timeoutController = createTimeoutController(retryConfig.timeout);
    const abortSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;
    
    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        ...fetchOptions,
        signal: abortSignal,
        headers: {
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=30',
          ...fetchOptions.headers
        }
      });
      
      const duration = Date.now() - startTime;
      
      // Log successful request
      if (clientOptions.onSuccess) {
        clientOptions.onSuccess(response, attempt);
      }
      
      // Check if response is successful or should be retried
      if (response.ok || !retryConfig.retryCondition(null, response)) {
        timeoutController.abort();
        return response;
      }
      
      lastResponse = response;
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      
    } catch (error: any) {
      timeoutController.abort();
      lastError = error;
      
      // Don't retry on abort errors unless it's our timeout
      if (error.name === 'AbortError' && !signal?.aborted) {
        // This is our timeout, continue to retry
        lastError = new Error(`Request timeout after ${retryConfig.timeout}ms`);
      } else if (error.name === 'AbortError') {
        // User aborted, don't retry
        throw error;
      }
      
      // Don't retry on certain errors
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        // Network error, retry
      }
    }
    
    // If this is the last attempt, throw the error
    if (attempt === retryConfig.maxRetries) {
      if (clientOptions.onFailure) {
        clientOptions.onFailure(lastError);
      }
      throw lastError;
    }
    
    // Calculate delay and wait before retry
    const delay = calculateBackoff(attempt, retryConfig.baseDelay, retryConfig.maxDelay);
    
    if (clientOptions.onRetry) {
      clientOptions.onRetry(attempt + 1, lastError, delay);
    }
    
    // Wait for the delay
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Health check for API connectivity
 */
export async function checkApiHealth(url: string = '/api/health', timeout: number = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Create a progress polling client with adaptive intervals
 */
export class ProgressPollingClient {
  private url: string;
  private options: ApiClientOptions;
  private isPolling: boolean = false;
  private currentInterval: number = 500;
  private minInterval: number = 200;
  private maxInterval: number = 3000;
  private consecutiveErrors: number = 0;
  private consecutiveSuccesses: number = 0;
  private totalErrorCount: number = 0;
  
  constructor(url: string, options: ApiClientOptions = {}) {
    this.url = url;
    this.options = {
      ...options,
      retryConfig: {
        maxRetries: 2,
        baseDelay: 300,
        maxDelay: 5000,
        timeout: 8000,
        ...options.retryConfig
      }
    };
  }
  
  /**
   * Start polling with adaptive intervals
   */
  async startPolling(
    onProgress: (data: any) => void,
    onError?: (error: any) => void,
    onComplete?: () => void,
    onFailure?: (error: any) => void
  ): Promise<() => void> {
    this.isPolling = true;
    
    const poll = async () => {
      if (!this.isPolling) return;
      
      try {
        const response = await robustFetch(this.url, {
          method: 'GET',
          cache: 'no-cache'
        }, this.options);
        
        const data = await response.json();
        
        if (data.success) {
          // Reset error count on success
          this.consecutiveErrors = 0;
          this.consecutiveSuccesses++;
          
          // Adapt interval based on success rate
          this.adaptInterval();
          
          // 确保进度至少为1%，避免显示0%
          const validatedData = {
            ...data,
            progress: Math.max(1, data.progress || 0)
          };
          
          onProgress(validatedData);
          
          // Check if polling should stop
          if (data.status === 'completed' || data.status === 'error' || data.status === 'terminated') {
            this.isPolling = false;
            if (onComplete) onComplete();
            return;
          }
        } else {
          // For non-success responses, check if it's a temporary issue
          // Don't immediately throw for common temporary errors
          if (data.code === 'CONNECTION_ERROR' || data.code === 'TIMEOUT_ERROR') {
            logger.warn('Temporary connection issue detected, will retry', { 
              taskId: this.url.split('taskId=')[1],
              code: data.code,
              message: data.message 
            });
            // Treat as temporary error, continue polling
            this.consecutiveErrors++;
            this.consecutiveSuccesses = 0;
            this.adaptInterval();
            // Don't throw, continue to schedule next poll
          } else {
            throw new Error(data.message || 'Invalid response');
          }
        }
      } catch (error: any) {
        this.consecutiveErrors++;
        this.consecutiveSuccesses = 0;
        
        // Adapt interval based on errors
        this.adaptInterval();
        
        if (onError) {
          onError(error);
        }
        
        // After too many consecutive errors, stop polling
        // But be more lenient - only stop after 15 consecutive errors
        if (this.consecutiveErrors >= 15) {
          this.isPolling = false;
          logger.error('Progress polling stopped due to too many consecutive errors', new EnhancedError('Progress polling stopped due to too many consecutive errors', {
            data: {
              taskId: this.url.split('taskId=')[1],
              consecutiveErrors: this.consecutiveErrors
            }
          }));
          if (onFailure) {
            onFailure(new Error('Polling stopped after too many consecutive errors'));
          }
          if (onComplete) onComplete();
          return;
        }
      }
      
      // Schedule next poll
      if (this.isPolling) {
        setTimeout(poll, this.currentInterval);
      }
    };
    
    // Start polling
    poll();
    
    // Return stop function
    return () => {
      this.isPolling = false;
    };
  }
  
  /**
   * Adapt polling interval based on performance
   */
  private adaptInterval(): void {
    if (this.consecutiveSuccesses >= 5) {
      // If consistently successful, increase interval (less frequent)
      this.currentInterval = Math.min(this.currentInterval * 1.2, this.maxInterval);
      this.consecutiveSuccesses = 0;
    } else if (this.consecutiveErrors >= 2) {
      // If errors occur, decrease interval (more frequent retries)
      this.currentInterval = Math.max(this.currentInterval * 0.8, this.minInterval);
    }
  }
}

/**
 * Default API client instance
 */
export const apiClient = {
  fetch: robustFetch,
  checkHealth: checkApiHealth,
  createProgressPoller: (url: string, options?: ApiClientOptions) => 
    new ProgressPollingClient(url, options)
};