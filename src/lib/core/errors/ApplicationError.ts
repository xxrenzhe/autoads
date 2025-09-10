/**
 * Application Error Types
 * 应用错误类型
 */

/**
 * Base Application Error
 * 基础应用错误
 */
export abstract class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly userMessage?: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      userMessage: this.userMessage,
      details: this.details,
      stack: this.stack
    };
  }
}

/**
 * Validation Error
 * 验证错误
 */
export class ValidationError extends ApplicationError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value?: any,
    details?: Record<string, any>
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      `输入验证失败: ${message}`,
      {
        field,
        value,
        ...details
      }
    );
  }
}

/**
 * Authentication Error
 * 认证错误
 */
export class AuthenticationError extends ApplicationError {
  constructor(
    message: string = 'Authentication failed',
    public readonly provider?: string,
    details?: Record<string, any>
  ) {
    super(
      message,
      'AUTHENTICATION_ERROR',
      401,
      '认证失败，请重新登录',
      {
        provider,
        ...details
      }
    );
  }
}

/**
 * Authorization Error
 * 授权错误
 */
export class AuthorizationError extends ApplicationError {
  constructor(
    message: string = 'Access denied',
    public readonly permission?: string,
    public readonly resource?: string,
    details?: Record<string, any>
  ) {
    super(
      message,
      'AUTHORIZATION_ERROR',
      403,
      '权限不足，无法访问此资源',
      {
        permission,
        resource,
        ...details
      }
    );
  }
}

/**
 * Not Found Error
 * 未找到错误
 */
export class NotFoundError extends ApplicationError {
  constructor(
    message: string = 'Resource not found',
    public readonly resourceType?: string,
    public readonly resourceId?: string,
    details?: Record<string, any>
  ) {
    super(
      message,
      'NOT_FOUND_ERROR',
      404,
      '请求的资源不存在',
      {
        resourceType,
        resourceId,
        ...details
      }
    );
  }
}

/**
 * Conflict Error
 * 冲突错误
 */
export class ConflictError extends ApplicationError {
  constructor(
    message: string = 'Resource conflict',
    public readonly resourceType?: string,
    public readonly conflictId?: string,
    details?: Record<string, any>
  ) {
    super(
      message,
      'CONFLICT_ERROR',
      409,
      '资源冲突，请检查后重试',
      {
        resourceType,
        conflictId,
        ...details
      }
    );
  }
}

/**
 * External Service Error
 * 外部服务错误
 */
export class ExternalServiceError extends ApplicationError {
  constructor(
    message: string,
    public readonly service: string,
    public readonly operation?: string,
    public readonly originalError?: Error,
    details?: Record<string, any>
  ) {
    super(
      message,
      'EXTERNAL_SERVICE_ERROR',
      502,
      `外部服务(${service})暂时不可用，请稍后重试`,
      {
        service,
        operation,
        originalError: originalError?.message,
        ...details
      }
    );
  }
}

/**
 * Rate Limit Error
 * 速率限制错误
 */
export class RateLimitError extends ApplicationError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly limitType?: string,
    public readonly retryAfter?: number,
    details?: Record<string, any>
  ) {
    super(
      message,
      'RATE_LIMIT_ERROR',
      429,
      '请求过于频繁，请稍后重试',
      {
        limitType,
        retryAfter,
        ...details
      }
    );
  }
}

/**
 * Configuration Error
 * 配置错误
 */
export class ConfigurationError extends ApplicationError {
  constructor(
    message: string,
    public readonly configKey?: string,
    public readonly configValue?: any,
    details?: Record<string, any>
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      500,
      '系统配置错误，请联系管理员',
      {
        configKey,
        configValue,
        ...details
      }
    );
  }
}

/**
 * Business Rule Error
 * 业务规则错误
 */
export class BusinessRuleError extends ApplicationError {
  constructor(
    message: string,
    public readonly ruleName?: string,
    public readonly ruleDetails?: Record<string, any>,
    details?: Record<string, any>
  ) {
    super(
      message,
      'BUSINESS_RULE_ERROR',
      422,
      message, // Business rule errors should be user-facing
      {
        ruleName,
        ruleDetails,
        ...details
      }
    );
  }
}

/**
 * System Error
 * 系统错误
 */
export class SystemError extends ApplicationError {
  constructor(
    message: string,
    public readonly systemComponent?: string,
    public readonly originalError?: Error,
    details?: Record<string, any>
  ) {
    super(
      message,
      'SYSTEM_ERROR',
      500,
      '系统内部错误，请联系管理员',
      {
        systemComponent,
        originalError: originalError?.message,
        ...details
      }
    );
  }
}

/**
 * Network Error
 * 网络错误
 */
export class NetworkError extends ApplicationError {
  constructor(
    message: string,
    public readonly url?: string,
    public readonly method?: string,
    public override readonly statusCode: number = 503,
    details?: Record<string, any>
  ) {
    super(
      message,
      'NETWORK_ERROR',
      statusCode,
      '网络连接失败，请检查网络后重试',
      {
        url,
        method,
        statusCode,
        ...details
      }
    );
  }
}

/**
 * Timeout Error
 * 超时错误
 */
export class TimeoutError extends ApplicationError {
  constructor(
    message: string = 'Operation timeout',
    public readonly operation?: string,
    public readonly timeout?: number,
    details?: Record<string, any>
  ) {
    super(
      message,
      'TIMEOUT_ERROR',
      504,
      '操作超时，请稍后重试',
      {
        operation,
        timeout,
        ...details
      }
    );
  }
}

/**
 * Database Error
 * 数据库错误
 */
export class DatabaseError extends ApplicationError {
  constructor(
    message: string,
    public readonly operation?: string,
    public readonly table?: string,
    public readonly originalError?: Error,
    details?: Record<string, any>
  ) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      '数据库操作失败，请联系管理员',
      {
        operation,
        table,
        originalError: originalError?.message,
        ...details
      }
    );
  }
}

/**
 * Cache Error
 * 缓存错误
 */
export class CacheError extends ApplicationError {
  constructor(
    message: string,
    public readonly operation?: string,
    public readonly cacheKey?: string,
    public readonly originalError?: Error,
    details?: Record<string, any>
  ) {
    super(
      message,
      'CACHE_ERROR',
      500,
      '缓存操作失败',
      {
        operation,
        cacheKey,
        originalError: originalError?.message,
        ...details
      }
    );
  }
}

/**
 * File Processing Error
 * 文件处理错误
 */
export class FileProcessingError extends ApplicationError {
  constructor(
    message: string,
    public readonly fileName?: string,
    public readonly fileType?: string,
    public readonly operation?: string,
    details?: Record<string, any>
  ) {
    super(
      message,
      'FILE_PROCESSING_ERROR',
      422,
      `文件处理失败: ${message}`,
      {
        fileName,
        fileType,
        operation,
        ...details
      }
    );
  }
}

/**
 * Task Execution Error
 * 任务执行错误
 */
export class TaskExecutionError extends ApplicationError {
  constructor(
    message: string,
    public readonly taskId?: string,
    public readonly taskType?: string,
    public readonly step?: string,
    details?: Record<string, any>
  ) {
    super(
      message,
      'TASK_EXECUTION_ERROR',
      500,
      `任务执行失败: ${message}`,
      {
        taskId,
        taskType,
        step,
        ...details
      }
    );
  }
}

/**
 * Proxy Error
 * 代理错误
 */
export class ProxyError extends ApplicationError {
  constructor(
    message: string,
    public readonly proxyUrl?: string,
    public readonly proxyType?: string,
    public readonly originalError?: Error,
    details?: Record<string, any>
  ) {
    super(
      message,
      'PROXY_ERROR',
      502,
      '代理服务器连接失败，请检查代理配置',
      {
        proxyUrl,
        proxyType,
        originalError: originalError?.message,
        ...details
      }
    );
  }
}

/**
 * Browser Automation Error
 * 浏览器自动化错误
 */
export class BrowserAutomationError extends ApplicationError {
  constructor(
    message: string,
    public readonly browser?: string,
    public readonly operation?: string,
    public readonly originalError?: Error,
    details?: Record<string, any>
  ) {
    super(
      message,
      'BROWSER_AUTOMATION_ERROR',
      500,
      '浏览器自动化操作失败',
      {
        browser,
        operation,
        originalError: originalError?.message,
        ...details
      }
    );
  }
}

/**
 * API Error
 * API错误
 */
export class APIError extends ApplicationError {
  constructor(
    message: string,
    public readonly endpoint?: string,
    public readonly method?: string,
    public override readonly statusCode: number = 500,
    public readonly responseBody?: any,
    details?: Record<string, any>
  ) {
    super(
      message,
      'API_ERROR',
      statusCode,
      'API调用失败',
      {
        endpoint,
        method,
        statusCode,
        responseBody,
        ...details
      }
    );
  }
}

/**
 * Result Type for Error Handling
 * 错误处理的结果类型
 */
export type Result<T, E extends ApplicationError = ApplicationError> = 
  | { success: true; data: T; error?: never }
  | { success: false; error: E; data?: never };

/**
 * Success result helper
 * 成功结果助手
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Error result helper
 * 错误结果助手
 */
export function failure<E extends ApplicationError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Error handler helper
 * 错误处理助手
 */
export function handleError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) {
    return error;
  }

  if (error instanceof Error) {
    // Map common error types to application errors
    if (error.name === 'ValidationError') {
      return new ValidationError(error.message, 'unknown');
    }

    if (error.name === 'AuthenticationError') {
      return new AuthenticationError(error.message);
    }

    if (error.name === 'NetworkError' || error.name === 'FetchError') {
      return new NetworkError(error.message);
    }

    if (error.name === 'TimeoutError') {
      return new TimeoutError(error.message);
    }

    return new SystemError(error.message, 'unknown', error);
  }

  // Handle unknown errors
  return new SystemError(String(error), 'unknown');
}

/**
 * Error boundary type
 * 错误边界类型
 */
export type ErrorBoundaryHandler = (error: ApplicationError) => void | Promise<void>;

/**
 * Error boundary class
 * 错误边界类
 */
export class ErrorBoundary {
  private handlers: Map<string, ErrorBoundaryHandler[]> = new Map();

  constructor(private defaultHandler?: ErrorBoundaryHandler) {}

  /**
   * Register an error handler for a specific error type
   * 注册特定错误类型的处理器
   */
  on(errorCode: string, handler: ErrorBoundaryHandler): void {
    if (!this.handlers.has(errorCode)) {
      this.handlers.set(errorCode, []);
    }
    this.handlers.get(errorCode)!.push(handler);
  }

  /**
   * Handle an error
   * 处理错误
   */
  async handle(error: ApplicationError): Promise<void> {
    const handlers = this.handlers.get(error.code) || [];
    
    if (handlers.length === 0 && this.defaultHandler) {
      await this.defaultHandler(error);
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(error);
      } catch (handlerError) {
        console.error('Error boundary handler failed:', handlerError);
      }
    }
  }

  /**
   * Clear all handlers
   * 清除所有处理器
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Error utilities
 * 错误工具
 */
export const ErrorUtils = {
  /**
   * Check if error is retryable
   * 检查错误是否可重试
   */
  isRetryable(error: ApplicationError): boolean {
    const retryableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'EXTERNAL_SERVICE_ERROR',
      'RATE_LIMIT_ERROR',
      'CACHE_ERROR'
    ];
    
    return retryableCodes.includes(error.code);
  },

  /**
   * Get error severity
   * 获取错误严重程度
   */
  getSeverity(error: ApplicationError): 'low' | 'medium' | 'high' | 'critical' {
    if (error.statusCode >= 500) return 'high';
    if (error.statusCode >= 400) return 'medium';
    return 'low';
  },

  /**
   * Format error for logging
   * 格式化错误用于日志
   */
  formatForLogging(error: ApplicationError): Record<string, any> {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      stack: error.stack
    };
  },

  /**
   * Format error for user response
   * 格式化错误用于用户响应
   */
  formatForResponse(error: ApplicationError): Record<string, any> {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.userMessage || error.message,
        details: error.details
      }
    };
  }
};