/**
 * 标准 API 响应格式
 */
import { NextRequest, NextResponse } from 'next/server'
export interface ApiResponse<T = any> {
  success: boolean
  code: string
  message: string
  data?: T
  error?: {
    type: string
    details?: any
    stack?: string
  }
  meta?: {
    timestamp: string
    requestId: string
    version: string
  }
}

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * 标准响应代码
 */
export const ResponseCode = {
  SUCCESS: 'SUCCESS',
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  
  // 客户端错误
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // 服务器错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT'
} as const

/**
 * HTTP 状态码映射
 */
export const StatusCode = {
  [ResponseCode.SUCCESS]: 200,
  [ResponseCode.CREATED]: 201,
  [ResponseCode.UPDATED]: 200,
  [ResponseCode.DELETED]: 200,
  
  [ResponseCode.BAD_REQUEST]: 400,
  [ResponseCode.UNAUTHORIZED]: 401,
  [ResponseCode.FORBIDDEN]: 403,
  [ResponseCode.NOT_FOUND]: 404,
  [ResponseCode.CONFLICT]: 409,
  [ResponseCode.VALIDATION_ERROR]: 422,
  [ResponseCode.RATE_LIMITED]: 429,
  
  [ResponseCode.INTERNAL_ERROR]: 500,
  [ResponseCode.SERVICE_UNAVAILABLE]: 503,
  [ResponseCode.TIMEOUT]: 504
} as const

/**
 * 创建成功响应
 */
export function successResponse<T>(
  data: T,
  message: string = 'Success',
  code: keyof typeof ResponseCode = 'SUCCESS',
  status?: number
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    code: ResponseCode[code],
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      version: '1.0.0'
    }
  }

  return NextResponse.json(response, {
    status: status || StatusCode[ResponseCode[code]]
  })
}

/**
 * 创建分页响应
 */
export function paginatedResponse<T>(
  items: T[],
  pagination: PaginatedResponse<T>['pagination'],
  message: string = 'Success'
): NextResponse {
  const response: ApiResponse<PaginatedResponse<T>> = {
    success: true,
    code: ResponseCode.SUCCESS,
    message,
    data: {
      items,
      pagination
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      version: '1.0.0'
    }
  }

  return NextResponse.json(response, { status: 200 })
}

/**
 * 创建错误响应
 */
export function errorResponse(
  message: string,
  code: keyof typeof ResponseCode = 'INTERNAL_ERROR',
  details?: any,
  status?: number
): NextResponse {
  const response: ApiResponse = {
    success: false,
    code: ResponseCode[code],
    message,
    error: {
      type: code.toLowerCase().replace(/_/g, '-'),
      details: process.env.NODE_ENV === 'development' ? details : undefined
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      version: '1.0.0'
    }
  }

  return NextResponse.json(response, {
    status: status || StatusCode[ResponseCode[code]]
  })
}

/**
 * 创建验证错误响应
 */
export function validationErrorResponse(
  errors: Record<string, string[]> | string,
  message: string = 'Validation failed'
): NextResponse {
  return errorResponse(message, 'VALIDATION_ERROR', errors, 422)
}

/**
 * 创建未授权响应
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return errorResponse(message, 'UNAUTHORIZED', undefined, 401)
}

/**
 * 创建禁止访问响应
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return errorResponse(message, 'FORBIDDEN', undefined, 403)
}

/**
 * 创建未找到响应
 */
export function notFoundResponse(message: string = 'Resource not found'): NextResponse {
  return errorResponse(message, 'NOT_FOUND', undefined, 404)
}

/**
 * 创建限流响应
 */
export function rateLimitedResponse(
  message: string = 'Too many requests',
  retryAfter?: number
): NextResponse {
  const response = errorResponse(message, 'RATE_LIMITED', undefined, 429)
  
  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString())
  }
  
  return response
}

/**
 * 生成请求 ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(
    public override message: string,
    public code: keyof typeof ResponseCode = 'INTERNAL_ERROR',
    public details?: any,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 包装异步处理函数，统一错误处理
 */
export function withErrorHandling<T>(
  handler: () => Promise<T>,
  errorMessage: string = 'Internal server error'
): Promise<T> {
  return handler().catch(error => {
    console.error(errorMessage, error)
    
    if (error instanceof ApiError) {
      throw error
    }
    
    throw new ApiError(
      error.message || errorMessage,
      'INTERNAL_ERROR',
      process.env.NODE_ENV === 'development' ? error.stack : undefined
    )
  })
}

/**
 * 验证请求数据
 */
export function validateRequest(
  data: any,
  schema: any,
  errorMessage: string = 'Invalid request data'
): { success: true; data: any } | { success: false; error: NextResponse } {
  try {
    const validData = schema.parse(data)
    return { success: true, data: validData }
  } catch (error) {
    return {
      success: false,
      error: validationErrorResponse((error as any).errors || (error as Error).message, errorMessage)
    }
  }
}

/**
 * 创建 API 路由包装器
 */
export function createApiRoute<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<T>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      const result = await withErrorHandling(() => handler(request, context))
      return successResponse(result)
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(
          error.message,
          error.code,
          error.details,
          error.statusCode
        )
      }
      
      return errorResponse(
        'An unexpected error occurred',
        'INTERNAL_ERROR',
        process.env.NODE_ENV === 'development' ? error : undefined
      )
    }
  }
}