/**
 * Enhanced Error Handling Utilities
 * 提供统一的错误处理和日志记录
 */

/**
 * Helper function to create EnhancedError with common usage pattern
 */
export function createEnhancedError(message: string, context?: any): EnhancedError {
  return new EnhancedError(message, { data: context });
}

export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: number;
  public readonly stackTrace?: string;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = Date.now();
    this.stackTrace = this.stack;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}

export class ProxyError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, 'PROXY_ERROR', 502, details);
    this.name = 'ProxyError';
  }
}

export class TaskError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, 'TASK_ERROR', 500, details);
    this.name = 'TaskError';
  }
}

export class EnhancedError extends Error {
  public readonly code?: string;
  public readonly statusCode?: number;
  public readonly details?: any;
  public readonly timestamp: number;
  public readonly stackTrace?: string;
  
  // Allow additional properties to be added dynamically
  [key: string]: any;

  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      details?: any;
      timestamp?: number;
      [key: string]: any;
    } = {}
  ) {
    super(message);
    this.name = 'EnhancedError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.timestamp = options.timestamp || Date.now();
    this.stackTrace = this.stack;
    
    // Copy any additional properties
    Object.keys(options).forEach((key: any) => {
      if (key !== 'code' && key !== 'statusCode' && key !== 'details' && key !== 'timestamp') {
        (this as any)[key] = options[key];
      }
    });
  }
}

/**
 * 错误类型映射
 */
export const ErrorTypes = {
  VALIDATION: ValidationError,
  AUTHENTICATION: AuthenticationError,
  AUTHORIZATION: AuthorizationError,
  NOT_FOUND: NotFoundError,
  RATE_LIMIT: RateLimitError,
  PROXY: ProxyError,
  TASK: TaskError,
  APPLICATION: ApplicationError,
  ENHANCED: EnhancedError
} as const;

/**
 * 错误代码枚举
 */
export enum ErrorCodes {
  // 验证错误 (400)
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_URL_FORMAT = 'INVALID_URL_FORMAT',
  MALICIOUS_URL_DETECTED = 'MALICIOUS_URL_DETECTED',
  URL_LIMIT_EXCEEDED = 'URL_LIMIT_EXCEEDED',
  
  // 认证错误 (401)
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // 授权错误 (403)
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED = 'ACCESS_DENIED',
  
  // 资源不存在 (404)
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // 速率限制 (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // 代理错误 (502)
  PROXY_CONNECTION_FAILED = 'PROXY_CONNECTION_FAILED',
  PROXY_AUTHENTICATION_FAILED = 'PROXY_AUTHENTICATION_FAILED',
  PROXY_TIMEOUT = 'PROXY_TIMEOUT',
  PROXY_INVALID_RESPONSE = 'PROXY_INVALID_RESPONSE',
  
  // 任务错误 (500)
  TASK_EXECUTION_FAILED = 'TASK_EXECUTION_FAILED',
  TASK_TIMEOUT = 'TASK_TIMEOUT',
  TASK_TERMINATED = 'TASK_TERMINATED',
  TASK_INITIALIZATION_FAILED = 'TASK_INITIALIZATION_FAILED',
  
  // 系统错误 (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

/**
 * 安全的错误信息映射
 */
const secureErrorMessages: Record<string, string> = {
  'ECONNREFUSED': '网络连接失败',
  'ENOTFOUND': '无法连接到服务器',
  'ETIMEDOUT': '连接超时',
  'ECONNRESET': '连接被重置',
  'EPIPE': '管道断开',
  'ERR_NETWORK_CHANGED': '网络连接已更改',
  'ERR_CONNECTION_RESET': '连接重置',
  'ERR_CONNECTION_TIMEOUT': '连接超时',
  'ERR_CONNECTION_REFUSED': '连接被拒绝',
  'ERR_PROXY_CONNECTION_FAILED': '代理连接失败',
  'ERR_TUNNEL_CONNECTION_FAILED': '隧道连接失败',
  'ERR_QUIC_PROTOCOL_ERROR': 'QUIC协议错误',
  'ERR_HTTP2_PROTOCOL_ERROR': 'HTTP2协议错误',
  'ERR_SOCKET_TIMEOUT': 'Socket超时',
  'AbortError': '请求被中止',
  'TimeoutError': '请求超时'
};

/**
 * 创建安全错误信息
 */
export function createSecureErrorMessage(error: Error): string {
  // 如果是已知的ApplicationError，直接返回其消息
  if (error instanceof ApplicationError) {
    return error.message;
  }
  
  // 检查错误名称
  if (secureErrorMessages[error.name]) {
    return secureErrorMessages[error.name];
  }
  
  // 检查错误消息
  for (const [key, message] of Object.entries(secureErrorMessages)) {
    if (error.message.includes(key)) {
      return message;
    }
  }
  
  // 默认消息
  return '操作失败，请稍后重试';
}

/**
 * 判断是否应该记录详细错误信息
 */
export function shouldLogDetailedError(error: Error): boolean {
  // 始终记录ApplicationError的详细信息
  if (error instanceof ApplicationError) {
    return true;
  }
  
  // 记录系统错误的详细信息
  const systemErrorPatterns = [
    /Error/i,
    /Exception/i,
    /Failed/i,
    /Cannot/i,
    /Unable/i,
    /denied/i,
    /forbidden/i,
    /unauthorized/i,
    /timeout/i,
    /network/i,
    /connection/i
  ];
  
  return systemErrorPatterns.some(pattern => 
    pattern.test(error.message) || pattern.test(error.name)
  );
}

/**
 * 格式化错误对象用于日志记录
 */
export function formatErrorForLogging(error: Error, context?: any): any {
  const baseError = {
    name: error.name,
    message: createSecureErrorMessage(error),
    code: error instanceof ApplicationError ? error.code : 'UNKNOWN_ERROR',
    statusCode: error instanceof ApplicationError ? error.statusCode : 500,
    timestamp: Date.now(),
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    context
  };
  
  if (error instanceof ApplicationError) {
    return {
      ...baseError,
      details: error.details,
      timestamp: error.timestamp,
      stackTrace: error.stackTrace
    };
  }
  
  return baseError;
}

/**
 * 包装异步函数的错误处理
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = error instanceof ApplicationError 
        ? error 
        : new ApplicationError(
            createSecureErrorMessage(error as Error),
            'UNKNOWN_ERROR',
            500,
            { originalError: error }
          );
      
      // 这里可以添加日志记录逻辑
      if (shouldLogDetailedError(error as Error)) {
        console.error(`[${context || 'Unknown'}] Error:`, formatErrorForLogging(error as Error, { args }));
      }
      
      throw appError;
    }
  };
}

/**
 * 创建错误响应对象
 */
export function createErrorResponse(error: Error): {
  success: false;
  message: string;
  code: string;
  details?: any;
  timestamp: number;
} {
  const secureMessage = createSecureErrorMessage(error);
  const code = error instanceof ApplicationError ? error.code : 'UNKNOWN_ERROR';
  const timestamp = error instanceof ApplicationError ? error.timestamp : Date.now();
  
  return {
    success: false,
    message: secureMessage,
    code,
    details: process.env.NODE_ENV === 'development' ? error instanceof ApplicationError ? error.details : undefined : undefined,
    timestamp
  };
}

/**
 * 重试机制配置
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors?: string[];
}

/**
 * 默认重试配置
 */
export const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  retryableErrors: [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'ERR_NETWORK_CHANGED',
    'ERR_CONNECTION_RESET',
    'ERR_CONNECTION_TIMEOUT',
    'ERR_PROXY_CONNECTION_FAILED',
    'AbortError',
    'TimeoutError'
  ]
};

/**
 * 带重试的异步函数执行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: string
): Promise<T> {
  const finalConfig = { ...defaultRetryConfig, ...config };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // 检查是否可重试
      const shouldRetry = finalConfig.retryableErrors?.some(errCode => 
        (error as Error).name.includes(errCode) || 
        (error as Error).message.includes(errCode)
      );
      
      if (!shouldRetry || attempt === finalConfig.maxRetries) {
        throw error;
      }
      
      // 计算延迟时间
      const delay = Math.min(
        finalConfig.baseDelay * Math.pow(finalConfig.backoffFactor, attempt - 1),
        finalConfig.maxDelay
      );
      
      console.warn(`[${context || 'Retry'}] Attempt ${attempt} failed, retrying in ${delay}ms:`, {
        error: createSecureErrorMessage(error as Error),
        attempt,
        maxRetries: finalConfig.maxRetries,
        delay
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * 错误边界组件的HOC
 * Note: This should be implemented in a React component file, not a utility file
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
): React.ComponentType<P> {
  // This is a placeholder implementation
  // The actual implementation should be in a React component file
  return Component;
}