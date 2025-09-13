import { prisma } from '@/lib/db'
import { $Enums } from '@prisma/client'

export interface Permission {
  id: string
  name: string
  description?: string
  resource: string
  action: string
  category?: string
  conditions?: any
}

export interface RolePermissions {
  role: $Enums.UserRole | string
  permissions: Permission[]
}

export interface PermissionCheck {
  userId: string
  resource: string
  action: string
}

export interface PermissionContext {
  userId: string
  role: $Enums.UserRole | string
  userStatus: string
  resourceId?: string
  metadata?: Record<string, any>
}

  export class PermissionService {
  /**
   * 检查用户权限
   */
  static async checkPermission(context: PermissionContext, resource: string, action: string): Promise<boolean> {
    try {
      const { userId, role, userStatus } = context

      // 检查用户状态
      if (userStatus !== 'ACTIVE') {
        return false
      }

      // 获取用户角色
      let effectiveRole = role

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          role: true,
          status: true
        }
      })

      if (!user) {
        return false
      }

      // 使用现有的角色系统
      effectiveRole = user.role

      // 获取角色权限
      const rolePermissions = await this.getRolePermissionsWithInheritance(effectiveRole)
      
      // 检查是否有对应权限
      const hasPermission = rolePermissions.some(
        permission => permission.resource === resource && permission.action === action
      )

      if (hasPermission) {
        // 记录权限检查日志
        await this.logPermissionCheck(userId, resource, action, true)
        return true
      }

      // 检查资源所有权（用户只能操作自己的资源）
      if (resource === 'profile' && context.resourceId === userId) {
        await this.logPermissionCheck(userId, resource, action, true)
        return true
      }

      // 记录权限拒绝日志
      await this.logPermissionCheck(userId, resource, action, false)
      return false
    } catch (error) {
      console.error('Permission check failed:', error)
      return false
    }
  }

  /**
   * 快速权限检查（基于用户ID）
   */
  static async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true }
      })

      if (!user || user.status !== 'ACTIVE') {
        return false
      }

      return await this.checkPermission({
        userId,
        role: user.role,
        userStatus: user.status
      }, resource, action)
    } catch (error) {
      console.error('Permission check failed:', error)
      return false
    }
  }

  /**
   * 获取角色权限（包括继承）
   */
  private static async getRolePermissionsWithInheritance(roleName: string): Promise<Permission[]> {
    // 使用硬编码的权限配置
    return this.getLegacyRolePermissions(roleName as $Enums.UserRole)
  }

  /**
   * 获取传统角色权限（向后兼容）
   */
  private static getLegacyRolePermissions(role: $Enums.UserRole): Permission[] {
    const legacyPermissions: Record<$Enums.UserRole, Permission[]> = {
      USER: [
        { id: 'profile-read', name: 'profile:read', resource: 'profile', action: 'read' },
        { id: 'profile-write', name: 'profile:write', resource: 'profile', action: 'write' },
        { id: 'siterank-use', name: 'siterank:use', resource: 'siterank', action: 'use' },
        { id: 'batchopen-use', name: 'batchopen:use', resource: 'batchopen', action: 'use' },
        { id: 'adscenter-use', name: 'adscenter:use', resource: 'adscenter', action: 'use' }
      ],
      ADMIN: [
        { id: 'users-read', name: 'users:read', resource: 'users', action: 'read' },
        { id: 'users-write', name: 'users:write', resource: 'users', action: 'write' },
        { id: 'config-read', name: 'config:read', resource: 'config', action: 'read' },
        { id: 'config-write', name: 'config:write', resource: 'config', action: 'write' },
        { id: 'analytics-read', name: 'analytics:read', resource: 'analytics', action: 'read' }
      ],
      SUPER_ADMIN: [
        { id: 'users-read', name: 'users:read', resource: 'users', action: 'read' },
        { id: 'users-write', name: 'users:write', resource: 'users', action: 'write' },
        { id: 'config-read', name: 'config:read', resource: 'config', action: 'read' },
        { id: 'config-write', name: 'config:write', resource: 'config', action: 'write' },
        { id: 'analytics-read', name: 'analytics:read', resource: 'analytics', action: 'read' },
        { id: 'system-admin', name: 'system:admin', resource: 'system', action: 'admin' }
      ]
    }

    return legacyPermissions[role] || []
  }

  /**
   * 获取用户所有权限
   */
  static async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        role: true
      }
    })

    if (!user) {
      return []
    }

    return this.getLegacyRolePermissions(user.role)
  }

  /**
   * 获取角色权限映射
   */
  static async getAllRolePermissions(): Promise<RolePermissions[]> {
    // No role model in schema - using legacy role system only
    const rolePermissions: RolePermissions[] = []

    // Add legacy roles for backward compatibility
    const legacyRoles = ['USER', 'ADMIN', 'SUPER_ADMIN'] as const
    for (const roleName of legacyRoles) {
      rolePermissions.push({
        role: roleName,
        permissions: this.getLegacyRolePermissions(roleName)
      })
    }

    return rolePermissions
  }

  /**
   * 检查用户是否有管理员权限
   */
  static async isAdmin(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          role: true, 
          status: true
        }
      })

      if (!user || user.status !== 'ACTIVE') {
        return false
      }

      // Using legacy system only
      return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
    } catch (error) {
      console.error('Admin check failed:', error)
      return false
    }
  }

  /**
   * 检查用户是否有管理员权限（已废弃，请使用isAdmin）
   * @deprecated Use isAdmin instead
   */
  static async isSuperAdmin(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          role: true, 
          status: true
        }
      })

      if (!user || user.status !== 'ACTIVE') {
        return false
      }

      // Using legacy system only
      return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
    } catch (error) {
      console.error('Super admin check failed:', error)
      return false
    }
  }

  
  /**
   * 检查功能访问权限（基于套餐）
   */
  static async checkFeatureAccess(userId: string, feature: string): Promise<{
    hasAccess: boolean
    reason?: string
    limits?: any
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: { plan: true }
          }
        }
      })

      if (!user) {
        return { hasAccess: false, reason: 'User not found' }
      }

      if (user.status !== 'ACTIVE') {
        return { hasAccess: false, reason: 'User account is not active' }
      }

      // 获取用户当前套餐
      const activeSubscription = user.subscriptions[0]
      if (!activeSubscription) {
        return { hasAccess: false, reason: 'No active subscription' }
      }

      const plan = activeSubscription.plan
      const features = plan.features as any

      // 检查功能是否在套餐中启用
      if (!features[feature] || !features[feature].enabled) {
        return { hasAccess: false, reason: 'Feature not included in current plan' }
      }

      // 检查Token余额
      if (user.tokenBalance <= 0) {
        return { hasAccess: false, reason: 'Insufficient token balance' }
      }

      return {
        hasAccess: true,
        limits: {
          tokenBalance: user.tokenBalance,
          featureLimits: features[feature]
        }
      }
    } catch (error) {
      console.error('Feature access check failed:', error)
      return { hasAccess: false, reason: 'Internal error' }
    }
  }

  /**
   * 记录权限检查日志
   */
  private static async logPermissionCheck(
    userId: string,
    resource: string,
    action: string,
    granted: boolean
  ): Promise<void> {
    try {
      await prisma.userActivity.create({
        data: {
          userId,
          action: 'permission_check',
          resource: `${resource}:${action}`,
          metadata: {
            resource,
            action,
            granted,
            timestamp: new Date().toISOString()
          }
        }
      })
    } catch (error) {
      // 日志记录失败不应该影响权限检查
      console.error('Failed to log permission check:', error)
    }
  }

  /**
   * 权限中间件工厂函数
   */
  static requirePermission(resource: string, action: string) {
    return async (userId: string): Promise<boolean> => {
      return await this.hasPermission(userId, resource, action)
    }
  }

  /**
   * 批量权限检查
   */
  static async checkMultiplePermissions(
    userId: string,
    permissions: Array<{ resource: string; action: string }>
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}

    for (const permission of permissions) {
      const key = `${permission.resource}:${permission.action}`
      results[key] = await this.hasPermission(userId, permission.resource, permission.action)
    }

    return results
  }

  /**
   * 获取用户可访问的资源列表
   */
  static async getUserAccessibleResources(userId: string): Promise<string[]> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          role: true, 
          status: true
        }
      })

      if (!user || user.status !== 'ACTIVE') {
        return []
      }

      let permissions: Permission[] = []
      
      if (user.role) {
        permissions = await this.getRolePermissionsWithInheritance(user.role)
      } else {
        permissions = this.getLegacyRolePermissions(user.role)
      }

      const resources = [...new Set(permissions?.filter(Boolean)?.map((p: any) => p.resource))]

      return resources
    } catch (error) {
      console.error('Failed to get accessible resources:', error)
      return []
    }
  }

  /**
   * 权限缓存管理
   */
  private static permissionCache = new Map<string, { permissions: boolean; expiry: number }>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5分钟

  /**
   * 带缓存的权限检查
   */
  static async hasPermissionCached(userId: string, resource: string, action: string): Promise<boolean> {
    const cacheKey = `${userId}:${resource}:${action}`
    const cached = this.permissionCache.get(cacheKey)

    if (cached && cached.expiry > Date.now()) {
      return cached.permissions
    }

    const hasPermission = await this.hasPermission(userId, resource, action)
    
    this.permissionCache.set(cacheKey, {
      permissions: hasPermission,
      expiry: Date.now() + this.CACHE_TTL
    })

    return hasPermission
  }

  /**
   * 清除权限缓存
   */
  static clearPermissionCache(userId?: string): void {
    if (userId) {
      // 清除特定用户的缓存
      for (const key of this.permissionCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.permissionCache.delete(key)
        }
      }
    } else {
      // 清除所有缓存
      this.permissionCache.clear()
    }
  }
}