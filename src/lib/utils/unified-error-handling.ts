/**
 * Unified Error Handling System
 * Provides consistent error types, handling, and recovery patterns
 */

import { createLogger } from '@/lib/utils/security/secure-logger';

// Base error class for all application errors
export abstract class BaseAppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly timestamp: number;
  public readonly context?: string;
  public readonly details?: any;

  constructor(
    code: string,
    statusCode: number,
    userMessage: string,
    message?: string,
    context?: string,
    details?: any
  ) {
    super(message || userMessage);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.userMessage = userMessage;
    this.timestamp = Date.now();
    this.context = context;
    this.details = details;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      statusCode: this.statusCode,
      userMessage: this.userMessage,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
      details: this.details,
      stack: this.stack
    };
  }
}

// Validation Errors
export class ValidationError extends BaseAppError {
  constructor(
    field: string,
    message: string,
    value?: any,
    context?: string
  ) {
    super(
      'VALIDATION_ERROR',
      400,
      `Validation failed for ${field}`,
      message,
      context,
      { field, value }
    );
  }
}

export class RequiredFieldError extends ValidationError {
  constructor(field: string, context?: string) {
    super(
      field,
      `${field} is required`,
      undefined,
      context
    );
  }
}

export class InvalidFormatError extends ValidationError {
  constructor(field: string, expected: string, actual: any, context?: string) {
    super(
      field,
      `Invalid format for ${field}. Expected ${expected}`,
      actual,
      context
    );
  }
}

// Authentication & Authorization Errors
export class AuthenticationError extends BaseAppError {
  constructor(message: string = 'Authentication required', context?: string) {
    super(
      'AUTHENTICATION_ERROR',
      401,
      'Please sign in to continue',
      message,
      context
    );
  }
}

export class AuthorizationError extends BaseAppError {
  constructor(
    action: string,
    resource: string,
    context?: string
  ) {
    super(
      'AUTHORIZATION_ERROR',
      403,
      'You do not have permission to perform this action',
      `Unauthorized to ${action} ${resource}`,
      context,
      { action, resource }
    );
  }
}

export class SessionExpiredError extends AuthenticationError {
  constructor(context?: string) {
    super('Your session has expired. Please sign in again.', context);
  }
}

// Not Found Errors
export class NotFoundError extends BaseAppError {
  constructor(resource: string, id?: string, context?: string) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(
      'NOT_FOUND',
      404,
      message,
      message,
      context,
      { resource, id }
    );
  }
}

// Rate Limiting Errors
export class RateLimitError extends BaseAppError {
  constructor(
    retryAfter: number,
    limit: number,
    window: string,
    context?: string
  ) {
    super(
      'RATE_LIMIT_EXCEEDED',
      429,
      `Too many requests. Please try again in ${Math.ceil(retryAfter / 1000)} seconds`,
      `Rate limit exceeded: ${limit} requests per ${window}`,
      context,
      { retryAfter, limit, window }
    );
  }
}

// Network & External Service Errors
export class NetworkError extends BaseAppError {
  constructor(
    service: string,
    message?: string,
    details?: any,
    context?: string
  ) {
    super(
      'NETWORK_ERROR',
      503,
      `Unable to connect to ${service}`,
      message || `Network error while connecting to ${service}`,
      context,
      { service, ...details }
    );
  }
}

export class ExternalServiceError extends BaseAppError {
  constructor(
    service: string,
    message: string,
    statusCode?: number,
    details?: any,
    context?: string
  ) {
    super(
      'EXTERNAL_SERVICE_ERROR',
      statusCode || 502,
      `Service temporarily unavailable`,
      `${service}: ${message}`,
      context,
      { service, statusCode, ...details }
    );
  }
}

// Business Logic Errors
export class BusinessRuleError extends BaseAppError {
  constructor(
    rule: string,
    message: string,
    details?: any,
    context?: string
  ) {
    super(
      'BUSINESS_RULE_VIOLATION',
      422,
      message,
      `Business rule violation: ${rule}`,
      context,
      { rule, ...details }
    );
  }
}

export class InsufficientBalanceError extends BusinessRuleError {
  constructor(
    required: number,
    available: number,
    context?: string
  ) {
    super(
      'INSUFFICIENT_BALANCE',
      `Insufficient balance. Required: ${required}, Available: ${available}`,
      { required, available },
      context
    );
  }
}

// Configuration Errors
export class ConfigurationError extends BaseAppError {
  constructor(
    key: string,
    message: string,
    context?: string
  ) {
    super(
      'CONFIGURATION_ERROR',
      500,
      'System configuration error',
      `Invalid configuration for ${key}: ${message}`,
      context,
      { key }
    );
  }
}

// Task & Processing Errors
export class TaskError extends BaseAppError {
  constructor(
    taskId: string,
    message: string,
    details?: any,
    context?: string
  ) {
    super(
      'TASK_ERROR',
      500,
      'Task processing failed',
      `Task ${taskId}: ${message}`,
      context,
      { taskId, ...details }
    );
  }
}

export class TaskTimeoutError extends TaskError {
  constructor(taskId: string, timeout: number, context?: string) {
    super(
      taskId,
      `Task timed out after ${timeout}ms`,
      { timeout },
      context
    );
  }
}

export class TaskCancelledError extends TaskError {
  constructor(taskId: string, reason?: string, context?: string) {
    super(
      taskId,
      `Task cancelled${reason ? `: ${reason}` : ''}`,
      { reason },
      context
    );
  }
}

// Database Errors
export class DatabaseError extends BaseAppError {
  constructor(
    operation: string,
    message: string,
    details?: any,
    context?: string
  ) {
    super(
      'DATABASE_ERROR',
      500,
      'Database operation failed',
      `Database ${operation} failed: ${message}`,
      context,
      { operation, ...details }
    );
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message?: string, context?: string) {
    super(
      'connect',
      message || 'Unable to connect to database',
      undefined,
      context
    );
  }
}

// Internal Error (for unknown errors)
export class InternalError extends BaseAppError {
  constructor(
    message: string,
    context?: string,
    details?: any
  ) {
    super(
      'INTERNAL_ERROR',
      500,
      'An internal error occurred',
      message,
      context,
      details
    );
  }
}

// Error utilities
export class ErrorUtils {
  /**
   * Check if error is of specific type
   */
  static is(error: any, errorClass: new (...args: any[]) => BaseAppError): boolean {
    return error instanceof errorClass;
  }

  /**
   * Get user-friendly message from any error
   */
  static getUserMessage(error: any): string {
    if (error instanceof BaseAppError) {
      return error.userMessage;
    }
    
    // Handle common error types
    if (error instanceof Error) {
      switch (error.name) {
        case 'NetworkError':
        case 'FetchError':
          return 'Network connection failed. Please check your internet connection.';
        case 'TimeoutError':
          return 'Request timed out. Please try again.';
        case 'SyntaxError':
          return 'Invalid data format received.';
        default:
          return 'An unexpected error occurred.';
      }
    }
    
    return 'An unexpected error occurred.';
  }

  /**
   * Get appropriate HTTP status code from error
   */
  static getStatusCode(error: any): number {
    if (error instanceof BaseAppError) {
      return error.statusCode;
    }
    
    // Default status codes for common errors
    if (error instanceof Error) {
      switch (error.name) {
        case 'ValidationError':
          return 400;
        case 'AuthenticationError':
        case 'UnauthorizedError':
          return 401;
        case 'ForbiddenError':
          return 403;
        case 'NotFoundError':
          return 404;
        case 'TimeoutError':
          return 504;
        default:
          return 500;
      }
    }
    
    return 500;
  }

  /**
   * Sanitize error for logging (remove sensitive data)
   */
  static sanitizeForLogging(error: any): any {
    if (error instanceof BaseAppError) {
      const sanitized = error.toJSON();
      
      // Remove sensitive data from details
      if (sanitized.details) {
        sanitized.details = this.sanitizeObject(sanitized.details);
      }
      
      return sanitized;
    }
    
    return {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    };
  }

  /**
   * Sanitize object by removing sensitive fields
   */
  private static sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization',
      'cookie', 'session', 'credit', 'card', 'ssn', 'social'
    ];

    const sanitized = { ...obj };
    
    for (const key in sanitized) {
      if (sensitiveFields.some(field => 
        key.toLowerCase().includes(field)
      )) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeObject(sanitized[key]);
      }
    }
    
    return sanitized;
  }

  /**
   * Create error from unknown value
   */
  static fromUnknown(value: any, context?: string): BaseAppError {
    if (value instanceof BaseAppError) {
      return value;
    }
    
    if (value instanceof Error) {
      // Create a concrete error class
      return new InternalError(value.message, context, { originalError: value.name });
    }
    
    if (typeof value === 'string') {
      return new InternalError(value, context);
    }
    
    return new InternalError('Unknown error', context, { originalValue: typeof value });
  }
}

// Global error handler registration
export function setupGlobalErrorHandlers(): void {
  const logger = createLogger('GlobalErrorHandler');

  // Handle uncaught exceptions - log but don't crash immediately
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error,
      sanitized: ErrorUtils.sanitizeForLogging(error)
    });
    
    // Don't crash immediately - try to recover
    // Only exit on critical system errors
    if (error instanceof Error && (
      error.message.includes('Cannot read property') ||
      error.message.includes('Cannot read') ||
      error.message.includes('is not defined') ||
      error.message.includes('is not a function') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT')
    )) {
      logger.warn('Recoverable error detected, continuing operation');
      return;
    }
    
    // For truly critical errors, graceful shutdown after a delay
    setTimeout(() => {
      logger.error('Critical uncaught exception, shutting down gracefully');
      process.exit(1);
    }, 5000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      error: reason instanceof Error ? reason : new Error(String(reason)),
      promise: promise.toString(),
      sanitized: ErrorUtils.sanitizeForLogging(reason)
    });
    
    // Don't exit the process, but log it for investigation
  });
}

// Error boundary types for React
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; errorInfo?: any }>;
  onError?: (error: Error, errorInfo: any) => void;
  context?: string;
}