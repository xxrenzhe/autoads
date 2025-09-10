/**
 * Business Types
 * Types for business domain entities
 */

export interface BusinessEntity {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ExecutionResult {
  success: boolean
  message?: string
  data?: any
  errors?: string[]
}
