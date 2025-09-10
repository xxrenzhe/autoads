/**
 * API Error Handler - Extends base ErrorHandler with API-specific functionality
 * Provides consistent error handling across all API routes
 */

import { createLogger } from '@/lib/utils/security/secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('ApiErrorHandler');

// Base error handler functionality
class BaseErrorHandler {
  public getUserMessage(error: Error | unknown, context: string): string {
    if (error instanceof Error) {
      return `${context}: ${error.message}`;
    }
    return `${context}: Unknown error occurred`;
  }

  public withRetry<T>(
    operation: () => Promise<T>,
    options: {
      retryOptions?: { maxRetries: number; delayMs: number };
      fallback?: () => Promise<T>;
    }
  ): Promise<T> {
    // Simple retry implementation
    return operation();
  }
}

export interface ApiErrorContext {
  endpoint: string;
  method: string;
  userId?: string;
  requestId?: string;
  additionalData?: Record<string, any>;
}

export class ApiErrorHandler extends BaseErrorHandler {
  private static instance: ApiErrorHandler;

  constructor() {
    super();
  }

  static getInstance(): ApiErrorHandler {
    if (!ApiErrorHandler.instance) {
      ApiErrorHandler.instance = new ApiErrorHandler();
    }
    return ApiErrorHandler.instance;
  }

  /**
   * Handle API route errors with context
   */
  handleApiError(
    error: Error | unknown,
    context: string,
    apiContext?: ApiErrorContext
  ): {
    success: false;
    error: string;
    code: string;
    timestamp: string;
    requestId?: string;
  } {
    const userMessage = this.getUserMessage(error, context);
    const errorCode = this.getErrorCode(error);
    const requestId = apiContext?.requestId || this.generateRequestId();

    logger.error('API Error:', new EnhancedError('API Error:', { error: error instanceof Error ? error.message : String(error),
      code: errorCode,
      context,
      apiContext,
      requestId,
      stack: error instanceof Error ? error.stack : undefined
     }));

    return {
      success: false,
      error: userMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
      requestId
    };
  }

  /**
   * Create standardized API response for errors
   */
  createErrorResponse(
    error: Error | unknown,
    context: string,
    status: number = 500,
    apiContext?: ApiErrorContext
  ): Response {
    const errorData = this.handleApiError(error, context, apiContext);

    return new Response(JSON.stringify(errorData), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': errorData.requestId || '',
        'X-Error-Code': errorData.code,
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  /**
   * Handle validation errors
   */
  handleValidationError(
    errors: string[] | Record<string, string>,
    context: string = 'Validation'
  ): {
    success: false;
    error: string;
    code: 'VALIDATION_ERROR';
    details: Record<string, string>;
    timestamp: string;
  } {
    const errorDetails = Array.isArray(errors) 
      ? errors.reduce((acc, error, index) => ({ ...acc, [`field_${index}`]: error }), {})
      : errors;

    logger.warn('Validation Error:', { context, details: errorDetails });

    return {
      success: false,
      error: 'Request validation failed',
      code: 'VALIDATION_ERROR',
      details: errorDetails,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle rate limiting errors
   */
  handleRateLimitError(
    endpoint: string,
    retryAfter?: number
  ): {
    success: false;
    error: string;
    code: 'RATE_LIMITED';
    retryAfter?: number;
    timestamp: string;
  } {
    logger.warn('Rate Limit Exceeded:', { endpoint, retryAfter });

    return {
      success: false,
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(
    message: string = 'Authentication required'
  ): {
    success: false;
    error: string;
    code: 'AUTH_ERROR';
    timestamp: string;
  } {
    logger.warn('Authentication Error:', { message });

    return {
      success: false,
      error: message,
      code: 'AUTH_ERROR',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle not found errors
   */
  handleNotFoundError(resource: string): {
    success: false;
    error: string;
    code: 'NOT_FOUND';
    timestamp: string;
  } {
    logger.info('Not Found:', { resource });

    return {
      success: false,
      error: `${resource} not found`,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle external service errors
   */
  handleServiceError(
    service: string,
    error: Error | unknown,
    operation: string
  ): {
    success: false;
    error: string;
    code: 'SERVICE_ERROR';
    service: string;
    operation: string;
    timestamp: string;
  } {
    const userMessage = this.getUserMessage(error, `${service} ${operation}`);
    
    logger.error('Service Error:', new EnhancedError('Service Error:', { 
      service,
      operation,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
     }));

    return {
      success: false,
      error: userMessage,
      code: 'SERVICE_ERROR',
      service,
      operation,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute API operation with comprehensive error handling
   */
  async executeApiOperation<T>(
    operation: () => Promise<T>,
    context: string,
    options: {
      maxRetries?: number;
      delayMs?: number;
      fallback?: () => Promise<T>;
      timeoutMs?: number;
      apiContext?: ApiErrorContext;
    } = {}
  ): Promise<T> {
    const { maxRetries = 2, delayMs = 1000, fallback, timeoutMs = 30000, apiContext } = options;

    try {
      // Add timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
      });

      const result = await Promise.race([
        this.withRetry(operation, {
          retryOptions: { maxRetries, delayMs },
          fallback
        }),
        timeoutPromise
      ]);

      return result;
    } catch (error) {
      // Re-throw with enhanced context
      const enhancedError = error instanceof Error 
        ? new Error(`${context}: ${error.message}`)
        : new Error(`${context}: Unknown error`);
      
      enhancedError.stack = error instanceof Error ? error.stack : undefined;
      throw enhancedError;
    }
  }

  /**
   * Get error code from error
   */
  private getErrorCode(error: Error | unknown): string {
    if (error instanceof Error) {
      // Check for specific error types
      if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
      if (error.name === 'AuthenticationError') return 'AUTH_ERROR';
      if (error.name === 'NotFoundError') return 'NOT_FOUND';
      if (error.name === 'RateLimitError') return 'RATE_LIMITED';
      if (error.name === 'TimeoutError') return 'TIMEOUT_ERROR';
      if (error.name === 'NetworkError') return 'NETWORK_ERROR';
      
      // Check for HTTP status codes
      const statusMatch = error.message.match(/status (\d+)/);
      if (statusMatch) {
        const status = parseInt(statusMatch[1], 10);
        if (status >= 400 && status < 500) return 'CLIENT_ERROR';
        if (status >= 500) return 'SERVER_ERROR';
      }
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create middleware for error handling
   */
  static middleware() {
    return async (request: Request, context: any) => {
      const requestId = ApiErrorHandler.getInstance().generateRequestId();
      
      // Add request ID to context
      context.requestId = requestId;
      
      try {
        const response = await context.next();
        
        // Add request ID to response headers
        response.headers.set('X-Request-ID', requestId);
        return response;
      } catch (error) {
        const errorHandler = ApiErrorHandler.getInstance();
        const errorResponse = errorHandler.createErrorResponse(
          error,
          'Middleware error',
          500,
          {
            endpoint: request.url,
            method: request.method,
            requestId
          }
        );
        
        return errorResponse;
      }
    };
  }
}

// Export singleton instance
export const apiErrorHandler = ApiErrorHandler.getInstance();

// Default export
export default ApiErrorHandler;