import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { logApiRequest } from '@/lib/middleware/api-logging'

export interface SecureHandlerOptions {
  requireAuth?: boolean
  rateLimit?: {
    windowMs: number
    maxRequests: number
    keyGenerator?: (req: NextRequest, user?: any) => string
  }
  validation?: {
    body?: Array<{
      field: string
      type: string
      required?: boolean
      enum?: string[]
      min?: number
      max?: number
      default?: any
    }>
    query?: Array<{
      field: string
      type: string
      required?: boolean
      enum?: string[]
      min?: number
      max?: number
      default?: any
    }>
  }
  handler: (req: NextRequest, context: any) => Promise<NextResponse>
}

export function createSecureHandler(options: SecureHandlerOptions) {
  return async (request: NextRequest) => {
    // Admin API 迁移层：统一将部分 /api/admin/* 转发至 Go 面板或返回迁移提示
    try {
      const url = new URL(request.url)
      const path = url.pathname
      if (path.startsWith('/api/admin/')) {
        // 迁移：/api/admin/* → /ops/api/v1/console/*（经 /ops 网关转发给 Go 后端）
        const target = '/ops/api/v1/console' + path.replace('/api/admin', '') + (url.search || '')
        const headers = new Headers(request.headers)
        headers.delete('host'); headers.delete('connection'); headers.delete('content-length'); headers.delete('accept-encoding')
        const init: RequestInit = { method: request.method, headers, redirect: 'manual', body: ['GET','HEAD'].includes(request.method) ? undefined : request.body as any }
        const resp = await fetch(target, init)
        const h = new Headers(resp.headers)
        h.set('x-admin-proxy', '1')
        return new NextResponse(resp.body, { status: resp.status, headers: h })
      }
    } catch {}

    // 使用增强的API日志记录包装整个请求处理过程
    return logApiRequest(request, async (req: NextRequest, context: any) => {
      try {
        // Check authentication if required
        let user: any = null
        if (options.requireAuth) {
          const session = await auth()
          if (!session?.user?.id) {
            return NextResponse.json(
              { error: 'Authentication required' },
              { status: 401 }
            )
          }
          user = { id: session.user.id }
        }

        // Apply rate limiting if configured
        if (options.rateLimit) {
          // Simplified rate limiting - in production, use Redis
          const key = options.rateLimit.keyGenerator 
            ? options.rateLimit.keyGenerator(request, user)
            : 'default'
          
          // This is a simplified version - implement proper rate limiting with Redis
          console.log(`Rate limiting key: ${key}`)
        }

        // Validate body parameters if configured
        let validatedBody = {}
        if (options.validation?.body) {
          const body = await request.json().catch(() => ({}))
          
          for (const field of options.validation.body) {
            const value = body[field.field]
            
            // Check if field is required
            if (field.required && (value === undefined || value === null || value === '')) {
              throw {
                name: 'ValidationError',
                message: `Field '${field.field}' is required`,
                field: field.field
              }
            }
            
            // Type validation
            if (value !== undefined && value !== null) {
              if (field.type === 'string') {
                if (typeof value !== 'string') {
                  throw {
                    name: 'ValidationError',
                    message: `Field '${field.field}' must be a string`,
                    field: field.field
                  }
                }
                if (field.min && value.length < field.min) {
                  throw {
                    name: 'ValidationError',
                    message: `Field '${field.field}' must be at least ${field.min} characters`,
                    field: field.field
                  }
                }
                if (field.max && value.length > field.max) {
                  throw {
                    name: 'ValidationError',
                    message: `Field '${field.field}' must be at most ${field.max} characters`,
                    field: field.field
                  }
                }
              } else if (field.type === 'number') {
                if (typeof value !== 'number' || isNaN(value)) {
                  throw {
                    name: 'ValidationError',
                    message: `Field '${field.field}' must be a number`,
                    field: field.field
                  }
                }
                if (field.min !== undefined && value < field.min) {
                  throw {
                    name: 'ValidationError',
                    message: `Field '${field.field}' must be at least ${field.min}`,
                    field: field.field
                  }
                }
                if (field.max !== undefined && value > field.max) {
                  throw {
                    name: 'ValidationError',
                    message: `Field '${field.field}' must be at most ${field.max}`,
                    field: field.field
                  }
                }
              } else if (field.type === 'boolean') {
                if (typeof value !== 'boolean') {
                  throw {
                    name: 'ValidationError',
                    message: `Field '${field.field}' must be a boolean`,
                    field: field.field
                  }
                }
              }
              
              // Enum validation
              if (field.enum && !field.enum.includes(value)) {
                throw {
                  name: 'ValidationError',
                  message: `Field '${field.field}' must be one of: ${field.enum.join(', ')}`,
                  field: field.field
                }
              }
            }
            
            // Set default value if needed
            if (value === undefined && field.default !== undefined) {
              body[field.field] = field.default
            }
          }
          
          validatedBody = body
        }

        // Validate query parameters if configured
        let validatedQuery = {}
        if (options.validation?.query) {
          const { searchParams } = new URL(request.url)
          const query: any = {}
          
          for (const param of options.validation.query) {
            const value = searchParams.get(param.field)
            if (value !== null) {
              // Convert value to the correct type
              if (param.type === 'number') {
                query[param.field] = parseInt(value, 10)
              } else if (param.type === 'boolean') {
                query[param.field] = value.toLowerCase() === 'true'
              } else {
                query[param.field] = value
              }
            } else if (param.default !== undefined) {
              query[param.field] = param.default
            }
          }
          
          validatedQuery = query
        }

        // Call the handler
        return await options.handler(request, {
          request,
          validatedBody,
          validatedQuery,
          user
        })
      } catch (error) {
        console.error('Secure handler error:', error)
        
        // Handle validation errors
        if (error && typeof error === 'object' && 'name' in error && error.name === 'ValidationError') {
          const err = error as any;
          return NextResponse.json(
            { 
              error: err.message || 'Validation failed',
              details: err.errors || err.details 
            },
            { status: 400 }
          )
        }
        
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        )
      }
    }, { user: undefined }); // context will be passed by the wrapper
  }
}
