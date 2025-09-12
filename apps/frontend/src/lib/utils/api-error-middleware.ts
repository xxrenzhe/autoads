/**
 * API Error Handling Middleware
 * Provides standardized error responses for Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { BaseAppError, ErrorUtils, AuthenticationError, ValidationError } from './unified-error-handling';
import { centralizedLogger, log } from './centralized-logging';

export interface ErrorHandlingOptions {
  includeStackTrace?: boolean;
  includeErrorDetails?: boolean;
  sanitizeErrors?: boolean;
  logErrors?: boolean;
  defaultErrorMessage?: string;
}

export interface ApiContext {
  endpoint: string;
  method: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export class ApiErrorMiddleware {
  private options: Required<ErrorHandlingOptions>;

  constructor(options: ErrorHandlingOptions = {}) {
    this.options = {
      includeStackTrace: options.includeStackTrace ?? process.env.NODE_ENV === 'development',
      includeErrorDetails: options.includeErrorDetails ?? process.env.NODE_ENV === 'development',
      sanitizeErrors: options.sanitizeErrors ?? true,
      logErrors: options.logErrors ?? true,
      defaultErrorMessage: options.defaultErrorMessage ?? 'An unexpected error occurred'
    };
  }

  /**
   * Create a middleware function for error handling
   */
  createMiddleware<T = any>(
    handler: (request: NextRequest, context: { params?: any }) => Promise<T>
  ) {
    return async (request: NextRequest, context: { params?: any }) => {
      const requestId = this.generateRequestId();
      const apiContext: ApiContext = {
        endpoint: request.nextUrl.pathname,
        method: request.method,
        requestId
      };

      try {
        // Call the handler and add request ID to headers for tracing
        const response = await handler(request, context);
        if (response instanceof NextResponse) {
          response.headers.set('X-Request-ID', requestId);
        }
        return response;
      } catch (error) {
        const errorResponse = await this.handleError(error, apiContext);
        errorResponse.headers.set('X-Request-ID', requestId);
        return errorResponse;
      }
    };
  }

  /**
   * Handle errors and create standardized responses
   */
  private async handleError(error: unknown, context: ApiContext): Promise<NextResponse> {
    let appError: BaseAppError;

    // Convert to BaseAppError if needed
    if (error instanceof BaseAppError) {
      appError = error;
    } else {
      appError = ErrorUtils.fromUnknown(error, context.endpoint);
    }

    // Log the error
    if (this.options.logErrors) {
      log.error(`API Error: ${appError.message}`, appError, {
        category: 'API',
        ...context,
        endpoint: context.endpoint,
        method: context.method,
        statusCode: appError.statusCode
      });
    }

    // Create response body
    const responseBody = {
      success: false,
      error: {
        code: appError.code,
        message: this.options.sanitizeErrors ? appError.userMessage : appError.message,
        userMessage: appError.userMessage
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: context.requestId
      }
    };

    // Add additional details in development
    if (this.options.includeErrorDetails && process.env.NODE_ENV === 'development') {
      (responseBody.error as any).details = {
        context: appError.context,
        stack: appError.stack,
        originalError: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : null
      };
    }

    // Add stack trace if enabled
    if (this.options.includeStackTrace && appError.stack) {
      (responseBody.error as any).stack = appError.stack;
    }

    return NextResponse.json(responseBody, {
      status: appError.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Code': appError.code,
        'Cache-Control': 'no-store'
      }
    });
  }

  /**
   * Create a wrapper for API route handlers
   */
  wrapHandler<T = any>(
    handler: (request: NextRequest, context: { params?: any }) => Promise<T>,
    options?: Partial<ErrorHandlingOptions>
  ) {
    const middleware = new ApiErrorMiddleware({ ...this.options, ...options });
    
    return async (request: NextRequest, context: { params?: any }): Promise<NextResponse> => {
      const requestId = this.generateRequestId();
      const apiContext: ApiContext = {
        endpoint: request.nextUrl.pathname,
        method: request.method,
        requestId
      };

      try {
        const startTime = Date.now();
        const result = await handler(request, context);
        const duration = Date.now() - startTime;

        // Log successful requests
        log.info(`API Success: ${request.method} ${request.nextUrl.pathname}`, {
          category: 'API',
          ...apiContext,
          duration,
          statusCode: 200
        });

        const response = NextResponse.json({
          success: true,
          data: result,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId,
            duration
          }
        });

        response.headers.set('X-Request-ID', requestId);
        return response;
      } catch (error) {
        const errorResponse = await middleware.handleError(error, apiContext);
        errorResponse.headers.set('X-Request-ID', requestId);
        return errorResponse;
      }
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `${timestamp}-${random}`;
  }
}

// Default instance
export const apiErrorMiddleware = new ApiErrorMiddleware();

// Convenience wrapper function
export function withApiErrorHandling<T = any>(
  handler: (request: NextRequest, context: { params?: any }) => Promise<T>,
  options?: Partial<ErrorHandlingOptions>
) {
  return apiErrorMiddleware.wrapHandler(handler, options);
}

// Create specialized handlers for common patterns
export function createAuthenticatedHandler<T = any>(
  handler: (request: NextRequest, context: { params?: any; user: any }) => Promise<T>,
  options?: Partial<ErrorHandlingOptions> & { getUser?: (request: NextRequest) => Promise<any> }
) {
  return withApiErrorHandling(async (request, context) => {
    // Get user from request (implementation depends on auth system)
    const getUser = options?.getUser || (async (req: NextRequest) => {
      // Default implementation - should be overridden based on auth system
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        throw new AuthenticationError(
          'Authentication required',
          'No authorization header provided'
        );
      }
      // Implement actual user extraction logic here
      return { id: 'user-id', email: 'user@example.com' };
    });

    const user = await getUser(request);
    
    if (!user) {
      throw new AuthenticationError(
        'Invalid authentication',
        'User not found'
      );
    }

    return handler(request, { ...context, user });
  }, options);
}

export function createValidatedHandler<T = any, U = any>(
  schema: {
    parse: (data: unknown) => U;
  },
  handler: (request: NextRequest, context: { params?: any; data: U }) => Promise<T>,
  options?: Partial<ErrorHandlingOptions>
) {
  return withApiErrorHandling(async (request, context) => {
    let data: unknown;
    
    if (request.method === 'GET') {
      data = Object.fromEntries(request.nextUrl.searchParams);
    } else {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await request.json();
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        data = Object.fromEntries(formData);
      } else {
        throw new ValidationError(
          'Unsupported content type',
          `Content-Type ${contentType} is not supported`
        );
      }
    }

    try {
      const validatedData = schema.parse(data);
      return handler(request, { ...context, data: validatedData });
    } catch (validationError) {
      if (validationError instanceof Error) {
        throw new ValidationError(
          'Invalid request data',
          validationError.message
        );
      }
      throw validationError;
    }
  }, options);
}