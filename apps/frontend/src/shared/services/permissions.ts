// RBAC权限管理系统

// 权限接口定义
export interface Permission {
  id: string
  resource: string // 资源类型：siterank, batchopen, adscenter, admin
  action: string // 操作类型：create, read, update, delete, execute
  conditions?: Record<string, any> // 条件限制
}

// 角色接口定义
export interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  tenantId: string
}

// 用户接口定义
export interface User {
  id: string
  email: string
  name: string
  tenantId: string
  roles: Role[]
  status: 'active' | 'inactive' | 'suspended'
  lastLoginAt?: Date
  preferences: UserPreferences
}

// 用户偏好设置
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
  notifications: {
    email: boolean
    push: boolean
  }
}

// 权限检查上下文
export interface PermissionContext {
  userId: string
  tenantId: string
  resource?: any
  metadata?: Record<string, any>
}

// 权限服务接口
export interface IPermissionService {
  hasPermission(userId: string, resource: string, action: string, context?: any): Promise<boolean>

  getUserPermissions(userId: string): Promise<Permission[]>
  getUserRoles(userId: string): Promise<Role[]>
  assignRole(userId: string, roleId: string): Promise<void>
  removeRole(userId: string, roleId: string): Promise<void>
  createRole(tenantId: string, roleData: Omit<Role, 'id' | 'tenantId'>): Promise<Role>
  updateRole(roleId: string, updates: Partial<Role>): Promise<Role>
  deleteRole(roleId: string): Promise<void>
}

// 权限服务实现
export class PermissionService implements IPermissionService {
  constructor(
    private userRepository: any, // 将在后续任务中定义具体类型
    private roleRepository: any,
    private tenantService: any
  ) {}

  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    context?: any
  ): Promise<boolean> {
    const user = await this.getUserWithRoles(userId)
    if (!user) return false

    // 检查用户状态
    if (user.status !== 'active') return false

    // 检查租户限制
    const tenant = await this.tenantService.getTenantById(user.tenantId)
    if (!this.checkTenantLimits(tenant, resource, action)) return false

    // 检查角色权限
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        if (this.matchesPermission(permission, resource, action, context)) {
          return true
        }
      }
    }

    return false
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await this.getUserWithRoles(userId)
    if (!user) return []

    const permissions: Permission[] = []
    for (const role of user.roles) {
      permissions.push(...role.permissions)
    }

    // 去重
    return this.deduplicatePermissions(permissions)
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const user = await this.getUserWithRoles(userId)
    return user?.roles || []
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    // 实现角色分配逻辑
    // 这里应该调用数据库操作
    throw new Error('Not implemented')
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    // 实现角色移除逻辑
    // 这里应该调用数据库操作
    throw new Error('Not implemented')
  }

  async createRole(tenantId: string, roleData: Omit<Role, 'id' | 'tenantId'>): Promise<Role> {
    // 实现角色创建逻辑
    // 这里应该调用数据库操作
    throw new Error('Not implemented')
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    // 实现角色更新逻辑
    // 这里应该调用数据库操作
    throw new Error('Not implemented')
  }

  async deleteRole(roleId: string): Promise<void> {
    // 实现角色删除逻辑
    // 这里应该调用数据库操作
    throw new Error('Not implemented')
  }

  private async getUserWithRoles(userId: string): Promise<User | null> {
    // 这里应该从数据库获取用户及其角色信息
    // 暂时返回null，将在后续任务中实现
    return null
  }

  private matchesPermission(
    permission: Permission,
    resource: string,
    action: string,
    context?: any
  ): boolean {
    // 资源匹配
    if (permission.resource !== '*' && permission.resource !== resource) {
      return false
    }

    // 操作匹配
    if (permission.action !== '*' && permission.action !== action) {
      return false
    }

    // 条件匹配
    if (permission.conditions && context) {
      return this.evaluateConditions(permission.conditions, context)
    }

    return true
  }

  private evaluateConditions(conditions: Record<string, any>, context: any): boolean {
    // 条件评估逻辑
    // 这里可以实现复杂的条件匹配逻辑
    for (const [key, value] of Object.entries(conditions)) {
      if (context[key] !== value) {
        return false
      }
    }
    return true
  }

  private checkTenantLimits(tenant: any, resource: string, action: string): boolean {
    // 检查租户限制
    // 这里应该根据租户的计划和限制进行检查
    return true // 简化实现
  }

  private deduplicatePermissions(permissions: Permission[]): Permission[] {
    const seen = new Set<string>()
    return permissions.filter((permission: any) => {
      const key = `${permission.resource}:${permission.action}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }
}

// 权限装饰器
export function RequirePermission(resource: string, action: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      // 这里应该获取当前用户信息并检查权限
      // 暂时跳过权限检查，将在后续任务中实现
      return method.apply(this, args)
    }

    return descriptor
  }
}

// 预定义角色
export const PREDEFINED_ROLES = {
  ADMIN: {
    name: 'Admin',
    description: '管理员，拥有大部分管理权限',
    permissions: [
      { id: '2', resource: 'users', action: '*' },
      { id: '3', resource: 'siterank', action: '*' },
      { id: '4', resource: 'batchopen', action: '*' },
      { id: '5', resource: 'adscenter', action: '*' },
    ],
  },
  USER: {
    name: 'User',
    description: '普通用户，拥有基本使用权限',
    permissions: [
      { id: '6', resource: 'siterank', action: 'read' },
      { id: '7', resource: 'siterank', action: 'create' },
      { id: '8', resource: 'batchopen', action: 'read' },
      { id: '9', resource: 'batchopen', action: 'create' },
      { id: '10', resource: 'adscenter', action: 'read' },
    ],
  },
} as const
