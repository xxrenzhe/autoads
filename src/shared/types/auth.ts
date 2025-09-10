/**
 * Authentication Types
 * Types for user authentication and authorization
 */

export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

export interface Role {
  id: string
  name: string
  permissions: Permission[]
  inherits?: Role[]
}

export interface Permission {
  resource: string
  action: string
  conditions?: Record<string, any>
}

export interface TenantContext {
  tenantId: string
  userId: string
  userEmail: string
  permissions: Permission[]
  roles: Role[]
  subscription?: {
    planId: string
    status: string
    expiresAt?: Date
  }
}
