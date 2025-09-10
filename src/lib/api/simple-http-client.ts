/**
 * Simple HTTP Client - Clean, lightweight API client
 * Replaces over-engineered ApiManager with straightforward functionality
 */

import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('SimpleHttpClient');

// Basic response interface
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
}

// Request configuration
export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  body?: any;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (error: any, response?: Response) => boolean;
}

/**
 * Simple HTTP Client with retry logic and basic error handling
 */
export class SimpleHttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private retryConfig: RetryConfig;
  private timeout: number;

  constructor(
    baseUrl: string = '',
    defaultHeaders: Record<string, string> = {},
    retryConfig: Partial<RetryConfig> = {}
  ) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...defaultHeaders
    };
    
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      retryCondition: (error, response) => {
        // Retry on network errors or 5xx status codes
        if (error) return true;
        if (response && response.status >= 500 && response.status < 600) return true;
        if (response && response.status === 429) return true; // Rate limiting
        return false;
      },
      ...retryConfig
    };
    
    this.timeout = 30000;
    
    logger.info('SimpleHttpClient initialized', {
      baseUrl,
      hasDefaultHeaders: Object.keys(this.defaultHeaders).length > 0,
      retryConfig: this.retryConfig
    });
  }

  /**
   * Make HTTP request with retry logic
   */
  async request<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = this.baseUrl + endpoint;
    const finalConfig = {
      method: 'GET' as const,
      timeout: this.timeout,
      retries: this.retryConfig.maxRetries,
      retryDelay: this.retryConfig.retryDelay,
      ...config
    };

    const headers = {
      ...this.defaultHeaders,
      ...config.headers
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= finalConfig.retries!; attempt++) {
      try {
        logger.debug(`Attempting request: ${finalConfig.method} ${url} (attempt ${attempt})`);
        
        const response = await this.makeRequest(url, finalConfig, headers);
        
        // Check if response should be retried
        if (attempt < finalConfig.retries! && this.retryConfig.retryCondition!(null, response)) {
          logger.warn(`Request retryable: ${response.status} ${url}`);
          await this.delay(finalConfig.retryDelay! * attempt);
          continue;
        }

        // Parse response
        const data = await this.parseResponse(response);
        
        logger.debug(`Request successful: ${finalConfig.method} ${url}`, {
          status: response.status,
          dataSize: JSON.stringify(data).length
        });

        return {
          success: true,
          data,
          status: response.status,
          headers: this.parseHeaders(response.headers)
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn(`Request failed: ${finalConfig.method} ${url} (attempt ${attempt})`, {
          error: lastError.message,
          attempt,
          maxRetries: finalConfig.retries
        });

        // Check if error should be retried
        if (attempt < finalConfig.retries! && this.retryConfig.retryCondition!(lastError)) {
          await this.delay(finalConfig.retryDelay! * attempt);
          continue;
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: lastError?.message || 'Request failed after all retries'
    };
  }

  /**
   * Make actual HTTP request
   */
  private async makeRequest(
    url: string,
    config: RequestConfig,
    headers: Record<string, string>
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const requestOptions: RequestInit = {
      method: config.method,
      headers,
      signal: controller.signal,
      ...(config.body && {
        body: typeof config.body === 'string' ? config.body : JSON.stringify(config.body)
      })
    };

    const response = await fetch(url, requestOptions);
    clearTimeout(timeoutId);

    return response;
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      try {

      return await response.json();

      } catch (error) {

        console.error(error);

        return false;

      }
    } else if (contentType?.includes('text/')) {
      try {

      return await response.text();

      } catch (error) {

        console.error(error);

        return false;

      }
    } else {
      // For other content types, return as text or empty object
      try {
        try {

        return await response.text();

        } catch (error) {

          console.error(error);

          return false;

        }
      } catch {
        return {};
      }
    }
  }

  /**
   * Parse headers to plain object
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== Convenience Methods ==================== //

  async get<T = any>(endpoint: string, config: Omit<RequestConfig, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any, config: Omit<RequestConfig, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body: data });
  }

  async put<T = any>(endpoint: string, data?: any, config: Omit<RequestConfig, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body: data });
  }

  async patch<T = any>(endpoint: string, data?: any, config: Omit<RequestConfig, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body: data });
  }

  async delete<T = any>(endpoint: string, config: Omit<RequestConfig, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // ==================== Health Check ==================== //

  async healthCheck(endpoint: string = '/health'): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.get<{ status: string; timestamp: string }>(endpoint, {
      timeout: 5000,
      retries: 1
    });
  }

  // ==================== Configuration ==================== //

  setDefaultHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  removeDefaultHeader(key: string): void {
    delete this.defaultHeaders[key];
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }
}

// Factory function to create pre-configured clients
export function createHttpClient(
  baseUrl?: string,
  config?: {
    defaultHeaders?: Record<string, string>;
    retryConfig?: Partial<RetryConfig>;
    timeout?: number;
  }
): SimpleHttpClient {
  return new SimpleHttpClient(
    baseUrl,
    config?.defaultHeaders,
    config?.retryConfig
  );
}

// Default instance for general use
export const httpClient = createHttpClient();

// Specialized clients for different services
export const apiClient = createHttpClient('/api', {
  defaultHeaders: {
    'X-Requested-With': 'XMLHttpRequest'
  },
  retryConfig: {
    maxRetries: 2,
    retryDelay: 500
  }
});

export const externalApiClient = createHttpClient('', {
  defaultHeaders: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  },
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000
  }
});

// Legacy compatibility
export class ApiManager {
  private static instance: ApiManager;

  static getInstance(): ApiManager {
    if (!ApiManager.instance) {
      ApiManager.instance = new ApiManager();
    }
    return ApiManager.instance;
  }

  async callApi<T = any>(
    type: string,
    endpoint: string,
    apiCall: () => Promise<T>
  ): Promise<ApiResponse<T>> {
    try {
      const data = await apiCall();
      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" as any 
      };
    }
  }

  async performHealthChecks(): Promise<void> {
    // Simple implementation - can be expanded
    try {
      await httpClient.healthCheck();
    } catch (error) {
      logger.warn('Health check failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export function getApiManager(): ApiManager {
  return ApiManager.getInstance();
}

// Export default for backward compatibility
export default SimpleHttpClient;