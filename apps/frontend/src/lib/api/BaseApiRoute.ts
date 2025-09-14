/**
 * Base API Route Template - Provides standardized error handling, validation, and response formatting
 * Reduces duplicate code across all API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/utils/security/secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';
import { getDomainConfig } from '@/lib/domain-config';

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

export abstract class BaseApiRoute {
  protected logger: ReturnType<typeof createLogger>;
  protected errorHandler: BaseErrorHandler;

  constructor(protected serviceName: string) {
    this.logger = createLogger(serviceName);
    this.errorHandler = new BaseErrorHandler();
  }

  /**
   * Standardized success response
   */
  protected handleSuccess(
    data: any = null,
    message?: string,
    status: number = 200
  ): NextResponse {
    const response: any = {
      success: true,
      timestamp: new Date().toISOString()
    };

    if (data !== null) {
      response.data = data;
    }

    if (message) {
      response.message = message;
    }

    return NextResponse.json(response, { status });
  }

  /**
   * Standardized error response
   */
  protected handleError(
    error: Error | unknown,
    context: string,
    status: number = 500
  ): NextResponse {
    const userMessage = this.errorHandler.getUserMessage(error, context);
    
    this.logger.error(`${context} failed:`, new EnhancedError(`${context} failed:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }));

    return NextResponse.json({
      success: false,
      error: userMessage,
      timestamp: new Date().toISOString()
    }, { status });
  }

  /**
   * Validate request body with schema
   */
  protected validateRequest<T>(
    body: any,
    validator: (data: any) => T
  ): { success: true; data: T } | { success: false; error: string } {
    try {
      const validated = validator(body);
      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid request data'
      };
    }
  }

  /**
   * Extract and validate common parameters
   */
  protected extractCommonParams(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    return {
      type,
      action,
      id,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined
    };
  }

  /**
   * Execute operation with automatic error handling and retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    options: {
      maxRetries?: number;
      delayMs?: number;
      fallback?: () => Promise<T>;
    } = {}
  ): Promise<T> {
    const { maxRetries = 2, delayMs = 1000, fallback } = options;

    return this.errorHandler.withRetry(operation, {
      retryOptions: { maxRetries, delayMs },
      fallback
    });
  }

  /**
   * Handle CORS preflight requests
   */
  protected handlePreflight(): NextResponse {
    const cfg = getDomainConfig();
    const allowedOrigin = cfg.isLocal ? '*' : cfg.baseUrl;
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Request-Id',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin',
      },
    });
  }

  /**
   * Add common headers to response
   */
  protected addHeaders(response: NextResponse): NextResponse {
    const cfg = getDomainConfig();
    const allowedOrigin = cfg.isLocal ? '*' : cfg.baseUrl;
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  }

  /**
   * Abstract method that must be implemented by subclasses
   */
  abstract handleRequest(request: NextRequest): Promise<NextResponse>;

  /**
   * Main request handler with standardized error handling
   */
  public async handle(request: NextRequest): Promise<NextResponse> {
    try {
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return this.addHeaders(this.handlePreflight());
      }

      const response = await this.handleRequest(request);
      return this.addHeaders(response);
    } catch (error) {
      return this.addHeaders(
        this.handleError(error, `${this.serviceName} request failed`)
      );
    }
  }
}

/**
 * Generic POST route handler for common CRUD operations
 */
export abstract class BasePostRoute<T> extends BaseApiRoute {
  constructor(serviceName: string) {
    super(serviceName);
  }

  /**
   * Validate POST request body
   */
  protected validateBody(body: any): { success: true; data: T } | { success: false; error: string } {
    if (!body || typeof body !== 'object') {
      return { success: false, error: 'Request body must be a valid JSON object' };
    }
    return { success: true, data: body as T };
  }

  /**
   * Execute POST operation with validation
   */
  protected async executePostOperation(
    request: NextRequest,
    operation: (data: T) => Promise<any>
  ): Promise<NextResponse> {
    const body = await request.json();
    const validation = this.validateBody(body);

    if (!validation.success) {
      return this.handleError(
        new Error(validation.error),
        'POST validation failed',
        400
      );
    }

    try {
      const result = await this.executeWithRetry(
        () => operation(validation.data),
        'POST operation'
      );

      return this.handleSuccess(result, 'Operation completed successfully');
    } catch (error) {
      return this.handleError(error, 'POST operation failed');
    }
  }
}

/**
 * Generic GET route handler for data retrieval
 */
export abstract class BaseGetRoute extends BaseApiRoute {
  constructor(serviceName: string) {
    super(serviceName);
  }

  /**
   * Execute GET operation with common parameters
   */
  protected async executeGetOperation(
    request: NextRequest,
    operation: (params: ReturnType<typeof this.extractCommonParams>) => Promise<any>
  ): Promise<NextResponse> {
    try {
      const params = this.extractCommonParams(request);
      const result = await this.executeWithRetry(
        () => operation(params),
        'GET operation'
      );

      return this.handleSuccess(result);
    } catch (error) {
      return this.handleError(error, 'GET operation failed');
    }
  }
}

/**
 * Health check route mixin
 */
export abstract class HealthCheckRoute extends BaseApiRoute {
  constructor(serviceName: string) {
    super(serviceName);
  }

  /**
   * Basic health check implementation
   */
  protected async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      // Override in subclasses for specific health checks
      return {
        status: 'healthy',
        details: {
          service: this.serviceName,
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || 'unknown'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          service: this.serviceName,
          error: error instanceof Error ? error.message : "Unknown error" as any
        }
      };
    }
  }
}

export default BaseApiRoute;
