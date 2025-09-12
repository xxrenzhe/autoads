/**
 * 标准化API响应工具
 * 提供统一的API响应格式和错误处理
 */

import { NextResponse } from 'next/server';
import { EnhancedError } from '@/lib/utils/error-handling';

// API响应状态码
export enum ApiResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

// API错误类型
export enum ApiErrorType {
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  NOT_FOUND_ERROR = 'not_found_error',
  CONFLICT_ERROR = 'conflict_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  INTERNAL_ERROR = 'internal_error',
  EXTERNAL_SERVICE_ERROR = 'external_service_error'
}

// 标准API响应接口
export interface StandardApiResponse<T = any> {
  success: boolean;
  status: ApiResponseStatus;
  code: number;
  message: string;
  data?: T;
  error?: {
    type: ApiErrorType;
    message: string;
    details?: any;
    stack?: string;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
    duration?: number;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// API配置接口
export interface ApiConfig {
  version: string;
  includeTimestamp: boolean;
  includeRequestId: boolean;
  includeDuration: boolean;
  includeStackInError: boolean;
  defaultPageSize: number;
  maxPageSize: number;
}

// 默认配置
const DEFAULT_API_CONFIG: ApiConfig = {
  version: '1.0.0',
  includeTimestamp: true,
  includeRequestId: true,
  includeDuration: true,
  includeStackInError: false,
  defaultPageSize: 20,
  maxPageSize: 100
};

export class ApiResponseBuilder {
  private config: ApiConfig;
  private startTime: number;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = { ...DEFAULT_API_CONFIG, ...config };
    this.startTime = Date.now();
  }

  /**
   * 创建成功响应
   */
  success<T>(
    data: T,
    message: string = '操作成功',
    statusCode: number = 200,
    pagination?: StandardApiResponse<T>['pagination']
  ): NextResponse {
    const response: StandardApiResponse<T> = {
      success: true,
      status: ApiResponseStatus.SUCCESS,
      code: statusCode,
      message,
      data
    };

    this.addMetadata(response);
    
    if (pagination) {
      response.pagination = pagination;
    }

    return NextResponse.json(response, { status: statusCode });
  }

  /**
   * 创建警告响应
   */
  warning<T>(
    data: T,
    message: string = '操作警告',
    statusCode: number = 299
  ): NextResponse {
    const response: StandardApiResponse<T> = {
      success: true,
      status: ApiResponseStatus.WARNING,
      code: statusCode,
      message,
      data
    };

    this.addMetadata(response);
    return NextResponse.json(response, { status: statusCode });
  }

  /**
   * 创建信息响应
   */
  info<T>(
    data: T,
    message: string = '操作信息',
    statusCode: number = 200
  ): NextResponse {
    const response: StandardApiResponse<T> = {
      success: true,
      status: ApiResponseStatus.INFO,
      code: statusCode,
      message,
      data
    };

    this.addMetadata(response);
    return NextResponse.json(response, { status: statusCode });
  }

  /**
   * 创建错误响应
   */
  error(
    message: string,
    errorType: ApiErrorType = ApiErrorType.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: any,
    originalError?: Error
  ): NextResponse {
    const response: StandardApiResponse = {
      success: false,
      status: ApiResponseStatus.ERROR,
      code: statusCode,
      message,
      error: {
        type: errorType,
        message,
        details
      }
    };

    // 开发环境下包含堆栈信息
    if (this.config.includeStackInError && originalError?.stack) {
      response.error!.stack = originalError.stack;
    }

    this.addMetadata(response);

    return NextResponse.json(response, { status: statusCode });
  }

  /**
   * 创建验证错误响应
   */
  validationError(
    message: string = '参数验证失败',
    details?: any
  ): NextResponse {
    return this.error(
      message,
      ApiErrorType.VALIDATION_ERROR,
      400,
      details
    );
  }

  /**
   * 创建认证错误响应
   */
  authenticationError(
    message: string = '认证失败'
  ): NextResponse {
    return this.error(
      message,
      ApiErrorType.AUTHENTICATION_ERROR,
      401
    );
  }

  /**
   * 创建授权错误响应
   */
  authorizationError(
    message: string = '权限不足'
  ): NextResponse {
    return this.error(
      message,
      ApiErrorType.AUTHORIZATION_ERROR,
      403
    );
  }

  /**
   * 创建未找到错误响应
   */
  notFoundError(
    message: string = '资源未找到',
    resource?: string
  ): NextResponse {
    return this.error(
      message,
      ApiErrorType.NOT_FOUND_ERROR,
      404,
      resource ? { resource } : undefined
    );
  }

  /**
   * 创建冲突错误响应
   */
  conflictError(
    message: string = '资源冲突',
    details?: any
  ): NextResponse {
    return this.error(
      message,
      ApiErrorType.CONFLICT_ERROR,
      409,
      details
    );
  }

  /**
   * 创建限流错误响应
   */
  rateLimitError(
    message: string = '请求过于频繁',
    retryAfter?: number
  ): NextResponse {
    const response = this.error(
      message,
      ApiErrorType.RATE_LIMIT_ERROR,
      429,
      retryAfter ? { retryAfter } : undefined
    );

    if (retryAfter) {
      response.headers.set('Retry-After', retryAfter.toString());
    }

    return response;
  }

  /**
   * 创建网络错误响应
   */
  networkError(
    message: string = '网络连接错误',
    details?: any
  ): NextResponse {
    return this.error(
      message,
      ApiErrorType.NETWORK_ERROR,
      503,
      details
    );
  }

  /**
   * 创建超时错误响应
   */
  timeoutError(
    message: string = '请求超时',
    timeout?: number
  ): NextResponse {
    return this.error(
      message,
      ApiErrorType.TIMEOUT_ERROR,
      504,
      timeout ? { timeout } : undefined
    );
  }

  /**
   * 创建外部服务错误响应
   */
  externalServiceError(
    message: string = '外部服务错误',
    service?: string,
    details?: any
  ): NextResponse {
    return this.error(
      message,
      ApiErrorType.EXTERNAL_SERVICE_ERROR,
      502,
      { service, ...details }
    );
  }

  
  /**
   * 创建分页响应
   */
  paginated<T>(
    data: T[],
    page: number,
    pageSize: number,
    total: number,
    message: string = '获取数据成功'
  ): NextResponse {
    const totalPages = Math.ceil(total / pageSize);
    
    const pagination = {
      page,
      pageSize,
      total,
      totalPages
    };

    return this.success(
      data,
      message,
      200,
      pagination
    );
  }

  /**
   * 添加元数据
   */
  private addMetadata(response: StandardApiResponse): void {
    if (this.config.includeTimestamp) {
      response.metadata = {
        timestamp: new Date().toISOString(),
        requestId: '',
        version: this.config.version
      };
    }

    if (this.config.includeRequestId) {
      response.metadata!.requestId = this.generateRequestId();
    }

    if (this.config.includeDuration) {
      response.metadata!.duration = Date.now() - this.startTime;
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${random}`;
  }

  /**
   * 获取配置
   */
  getConfig(): ApiConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// 创建默认实例
export const apiResponseBuilder = new ApiResponseBuilder();

// 便捷函数
export const apiResponse = {
  success: <T>(data: T, message?: string, statusCode?: number) =>
    apiResponseBuilder.success(data, message, statusCode),
  
  error: (message: string, errorType?: ApiErrorType, statusCode?: number, details?: any) =>
    apiResponseBuilder.error(message, errorType, statusCode, details),
  
  validationError: (message?: string, details?: any) =>
    apiResponseBuilder.validationError(message, details),
  
  authenticationError: (message?: string) =>
    apiResponseBuilder.authenticationError(message),
  
  authorizationError: (message?: string) =>
    apiResponseBuilder.authorizationError(message),
  
  notFoundError: (message?: string, resource?: string) =>
    apiResponseBuilder.notFoundError(message, resource),
  
  conflictError: (message?: string, details?: any) =>
    apiResponseBuilder.conflictError(message, details),
  
  rateLimitError: (message?: string, retryAfter?: number) =>
    apiResponseBuilder.rateLimitError(message, retryAfter),
  
  networkError: (message?: string, details?: any) =>
    apiResponseBuilder.networkError(message, details),
  
  timeoutError: (message?: string, timeout?: number) =>
    apiResponseBuilder.timeoutError(message, timeout),
  
  externalServiceError: (message?: string, service?: string, details?: any) =>
    apiResponseBuilder.externalServiceError(message, service, details),
  
  warning: <T>(data: T, message?: string, statusCode?: number) =>
    apiResponseBuilder.warning(data, message, statusCode),
  
  info: <T>(data: T, message?: string, statusCode?: number) =>
    apiResponseBuilder.info(data, message, statusCode),
  
  paginated: <T>(data: T[], page: number, pageSize: number, total: number, message?: string) =>
    apiResponseBuilder.paginated(data, page, pageSize, total, message)
};

// 错误类型映射工具
export function mapErrorToApiType(error: Error): ApiErrorType {
  const message = error.message.toLowerCase();
  
  if (message.includes('validation') || message.includes('invalid')) {
    return ApiErrorType.VALIDATION_ERROR;
  }
  
  if (message.includes('authentication') || message.includes('unauthorized')) {
    return ApiErrorType.AUTHENTICATION_ERROR;
  }
  
  if (message.includes('authorization') || message.includes('forbidden')) {
    return ApiErrorType.AUTHORIZATION_ERROR;
  }
  
  if (message.includes('not found') || message.includes('no such')) {
    return ApiErrorType.NOT_FOUND_ERROR;
  }
  
  if (message.includes('conflict') || message.includes('already exists')) {
    return ApiErrorType.CONFLICT_ERROR;
  }
  
  if (message.includes('rate limit') || message.includes('too many')) {
    return ApiErrorType.RATE_LIMIT_ERROR;
  }
  
  if (message.includes('network') || message.includes('connection')) {
    return ApiErrorType.NETWORK_ERROR;
  }
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return ApiErrorType.TIMEOUT_ERROR;
  }
  
  return ApiErrorType.INTERNAL_ERROR;
}

// API响应中间件
export function withApiResponse(handler: (req: Request) => Promise<NextResponse>) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      try {

      return await handler(req);

      } catch (error) {

        console.error(error);

        return NextResponse.json(
          { success: false, error: 'Internal server error' },
          { status: 500 }
        );

      }
    } catch (error) {
      console.error('API Error:', error);
      
      const err = error instanceof Error ? error : new Error(String(error));
      const errorType = mapErrorToApiType(err);
      
      return apiResponseBuilder.error(
        '服务器内部错误',
        errorType,
        500,
        process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
        err
      );
    }
  };
}