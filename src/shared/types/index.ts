// 通用类型定义导出

export type { ApiResponse, ApiError, PaginationParams } from './api'
export type { User, Role, Permission, TenantContext } from './auth'
export type { BaseEntity, EntityId, Timestamps } from './common'
export type { ComponentProps, StyleProps, ThemeProps } from './ui'
export type { BusinessEntity, TaskStatus, ExecutionResult } from './business'

// 工具类型
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// 事件类型
export interface DomainEvent {
  id: string
  type: string
  payload: any
  timestamp: Date
  userId?: string
  tenantId?: string
}

// 查询类型
export interface QueryOptions {
  page?: number
  limit?: number
  sort?: {
    field: string
    order: 'asc' | 'desc'
  }
  filters?: Record<string, any>
}

// 响应类型
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}
