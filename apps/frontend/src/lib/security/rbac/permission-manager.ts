import { prisma } from '@/lib/db'
import { getRedisClient } from '@/lib/cache/redis-client'

export interface Permission {
  resource: string
  action: string
  conditions?: PolicyCondition[]
}

export interface PolicyCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in'
  value: any
}

export interface Role {
  id: string
  name: string
  permissions: Permission[]
  inherits?: Role[]
}

export interface SecurityContext {
  userId: string
  userRole: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  timestamp: Date
}

export class PermissionManager {
  private static readonly CACHE_PREFIX = 'rbac:permissions:'
  private static readonly CACHE_TTL = 300 // 5 minutes

  /**
   * Check if user has permission for a specific resource and action
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    context?: any
  ): Promise<boolean> {
    try {
      const cacheKey = `${PermissionManager.CACHE_PREFIX}${userId}:${resource}:${action}`
      const redis = getRedisClient()

      // Try cache first for basic permissions
      if (!context) {
        const cached = await redis.get(cacheKey)
        if (cached !== null) {
          return JSON.parse(cached)
        }
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      })

      if (!user) {
        return false
      }

      const hasPermission = await this.evaluatePermission(user.role, resource, action, context)

      // Cache basic permissions (without context)
      if (!context) {
        await redis.setex(cacheKey, PermissionManager.CACHE_TTL, JSON.stringify(hasPermission))
      }

      return hasPermission
    } catch (error) {
      console.error('Error checking permission:', error)
      return false
    }
  }

  /**
   * Evaluate permission based on role and conditions
   */
  private async evaluatePermission(
    userRole: string,
    resource: string,
    action: string,
    context?: any
  ): Promise<boolean> {
    // Define role-based permissions
    const rolePermissions = this.getRolePermissions(userRole)
    
    // Check if user has the required permission
    const permission = rolePermissions.find((p: any) => 
      p.resource === resource && p.action === action
    )

    if (!permission) {
      return false
    }

    // If no conditions, permission is granted
    if (!permission.conditions || permission.conditions.length === 0) {
      return true
    }

    // Evaluate conditions
    return this.evaluateConditions(permission.conditions, context)
  }

  /**
   * Get permissions for a specific role
   */
  private getRolePermissions(role: string): Permission[] {
    const permissions: Record<string, Permission[]> = {
      'ADMIN': [
        // User management
        { resource: 'users', action: 'read' },
        { resource: 'users', action: 'create' },
        { resource: 'users', action: 'update' },
        { resource: 'users', action: 'delete' },
        
        // Configuration management
        { resource: 'config', action: 'read' },
        { resource: 'config', action: 'update' },
        
        // Token management
        { resource: 'tokens', action: 'read' },
        { resource: 'tokens', action: 'configure' },
        
        // Analytics and monitoring
        { resource: 'analytics', action: 'read' },
        { resource: 'monitoring', action: 'read' },
        
        // Subscription management
        { resource: 'subscriptions', action: 'read' },
        { resource: 'subscriptions', action: 'update' },
        
        // Notification management
        { resource: 'notifications', action: 'read' },
        { resource: 'notifications', action: 'send' },
        
        // API management
        { resource: 'api', action: 'read' },
        { resource: 'api', action: 'configure' },
      ],
      'USER': [
        // Own profile management
        { resource: 'profile', action: 'read', conditions: [
          { field: 'userId', operator: 'equals', value: 'self' }
        ]},
        { resource: 'profile', action: 'update', conditions: [
          { field: 'userId', operator: 'equals', value: 'self' }
        ]},
        
        // Own token usage
        { resource: 'tokens', action: 'read', conditions: [
          { field: 'userId', operator: 'equals', value: 'self' }
        ]},
        { resource: 'tokens', action: 'topup', conditions: [
          { field: 'userId', operator: 'equals', value: 'self' }
        ]},
        
        // Core features
        { resource: 'siterank', action: 'use' },
        { resource: 'batchopen', action: 'use' },
        { resource: 'adscenter', action: 'use' },
        
        // Own subscription
        { resource: 'subscription', action: 'read', conditions: [
          { field: 'userId', operator: 'equals', value: 'self' }
        ]},
        { resource: 'subscription', action: 'update', conditions: [
          { field: 'userId', operator: 'equals', value: 'self' }
        ]},
      ]
    }

    return permissions[role] || []
  }

  /**
   * Evaluate policy conditions
   */
  private evaluateConditions(conditions: PolicyCondition[], context: any): boolean {
    if (!context) {
      return false
    }

    return conditions.every(condition => {
      const contextValue = this.getContextValue(condition.field, context)
      return this.evaluateCondition(condition, contextValue)
    })
  }

  /**
   * Get value from context
   */
  private getContextValue(field: string, context: any): any {
    if (field === 'self' && context.userId) {
      return context.userId
    }
    
    return context[field]
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PolicyCondition, contextValue: any): boolean {
    const { operator, value } = condition

    switch (operator) {
      case 'equals':
        return contextValue === value || (value === 'self' && contextValue === contextValue)
      case 'not_equals':
        return contextValue !== value
      case 'contains':
        return Array.isArray(contextValue) ? contextValue.includes(value) : 
               typeof contextValue === 'string' ? contextValue.includes(value) : false
      case 'not_contains':
        return Array.isArray(contextValue) ? !contextValue.includes(value) : 
               typeof contextValue === 'string' ? !contextValue.includes(value) : true
      case 'greater_than':
        return Number(contextValue) > Number(value)
      case 'less_than':
        return Number(contextValue) < Number(value)
      case 'in':
        return Array.isArray(value) ? value.includes(contextValue) : false
      case 'not_in':
        return Array.isArray(value) ? !value.includes(contextValue) : true
      default:
        return false
    }
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })

    if (!user) {
      return []
    }

    return this.getRolePermissions(user.role)
  }

  /**
   * Clear permission cache for a user
   */
  async clearUserPermissionCache(userId: string): Promise<void> {
    const pattern = `${PermissionManager.CACHE_PREFIX}${userId}:*`
    const redis = getRedisClient()
    const keys = await redis.keys(pattern)
    
    if (keys.length > 0) {
      for (const key of keys) {
        await redis.del(key)
      }
    }
  }

  /**
   * Bulk permission check
   */
  async hasPermissions(
    userId: string,
    permissions: Array<{ resource: string; action: string; context?: any }>
  ): Promise<boolean[]> {
    const results = await Promise.all(
      permissions.map(({ resource, action, context }: any) =>
        this.hasPermission(userId, resource, action, context)
      )
    )

    return results
  }
}

export const permissionManager = new PermissionManager()
