import { prisma } from '@/lib/db'
import { $Enums, tokenusagefeature } from '@prisma/client'

type UserRole = $Enums.UserRole
type UserStatus = $Enums.UserStatus
import { PermissionService } from './permission-service'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  status: UserStatus
  isActive: boolean
  tokenBalance: number
  lastLoginAt: Date | null
  emailVerified: boolean
}

export interface RoleUpdateRequest {
  userId: string
  newRole: UserRole
  updatedBy: string
  reason?: string
}

export interface StatusUpdateRequest {
  userId: string
  newStatus: UserStatus
  isActive: boolean
  updatedBy: string
  reason?: string
}

export interface TokenUpdateRequest {
  userId: string
  amount: number
  operation: 'add' | 'subtract' | 'set'
  reason: string
  updatedBy: string
}

export class AuthService {
  /**
   * Get user by ID with authentication context
   */
  static async getUserById(userId: string): Promise<AuthUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          tokenBalance: true,
          lastLoginAt: true,
          emailVerified: true,
        }
      })

      if (!user) return null
      return { ...user, isActive: user.status === 'ACTIVE' }
    } catch (error) {
      console.error('Failed to get user by ID:', error)
      return null
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<AuthUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          tokenBalance: true,
          lastLoginAt: true,
          emailVerified: true,
        }
      })

      if (!user) return null
      return { ...user, isActive: user.status === 'ACTIVE' }
    } catch (error) {
      console.error('Failed to get user by email:', error)
      return null
    }
  }

  /**
   * Update user role (admin only)
   */
  static async updateUserRole(request: RoleUpdateRequest): Promise<{
    success: boolean
    user?: AuthUser
    error?: string
  }> {
    try {
      // Verify the updater has permission
      const hasPermission = await PermissionService.hasPermission(
        request.updatedBy,
        'users',
        'admin'
      )

      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to update user role'
        }
      }

      // Prevent users from elevating themselves to ADMIN
      const updater = await this.getUserById(request.updatedBy)
      if (request.newRole === 'ADMIN' && updater?.role !== 'ADMIN') {
        return {
          success: false,
          error: 'Only ADMIN can assign ADMIN role'
        }
      }

      // Update user role
      const updatedUser = await prisma.user.update({
        where: { id: request.userId },
        data: { role: request.newRole },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          tokenBalance: true,
          lastLoginAt: true,
          emailVerified: true,
        }
      })

      // Log the role change
      await prisma.userActivity.create({
        data: {
          userId: request.userId,
          action: 'role_updated',
          resource: 'user',
          metadata: {
            oldRole: updater?.role,
            newRole: request.newRole,
            updatedBy: request.updatedBy,
            reason: request.reason,
            timestamp: new Date().toISOString()
          }
        }
      })

      // Clear permission cache for this user
      PermissionService.clearPermissionCache(request.userId)

      return {
        success: true,
        user: { ...updatedUser, isActive: updatedUser.status === 'ACTIVE' }
      }
    } catch (error) {
      console.error('Failed to update user role:', error)
      return {
        success: false,
        error: 'Failed to update user role'
      }
    }
  }

  /**
   * Update user status and active state
   */
  static async updateUserStatus(request: StatusUpdateRequest): Promise<{
    success: boolean
    user?: AuthUser
    error?: string
  }> {
    try {
      // Verify the updater has permission
      const hasPermission = await PermissionService.hasPermission(
        request.updatedBy,
        'users',
        'write'
      )

      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to update user status'
        }
      }

      // Prevent users from deactivating themselves
      if (request.userId === request.updatedBy && !request.isActive) {
        return {
          success: false,
          error: 'Cannot deactivate your own account'
        }
      }

      // Update user status
      const updatedUser = await prisma.user.update({
        where: { id: request.userId },
        data: { 
          status: request.newStatus
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          tokenBalance: true,
          lastLoginAt: true,
          emailVerified: true,
        }
      })

      // Log the status change
      await prisma.userActivity.create({
        data: {
          userId: request.userId,
          action: 'status_updated',
          resource: 'user',
          metadata: {
            newStatus: request.newStatus,
            isActive: request.isActive,
            updatedBy: request.updatedBy,
            reason: request.reason,
            timestamp: new Date().toISOString()
          }
        }
      })

      return {
        success: true,
        user: { ...updatedUser, isActive: updatedUser.status === 'ACTIVE' }
      }
    } catch (error) {
      console.error('Failed to update user status:', error)
      return {
        success: false,
        error: 'Failed to update user status'
      }
    }
  }

  /**
   * Update user token balance
   */
  static async updateTokenBalance(request: TokenUpdateRequest): Promise<{
    success: boolean
    user?: AuthUser
    error?: string
  }> {
    try {
      // Verify the updater has permission
      const hasPermission = await PermissionService.hasPermission(
        request.updatedBy,
        'users',
        'write'
      )

      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to update token balance'
        }
      }

      // Get current user
      const currentUser = await this.getUserById(request.userId)
      if (!currentUser) {
        return {
          success: false,
          error: 'User not found'
        }
      }

      // Calculate new balance
      let newBalance: number
      switch (request.operation) {
        case 'add':
          newBalance = currentUser.tokenBalance + request.amount
          break
        case 'subtract':
          newBalance = Math.max(0, currentUser.tokenBalance - request.amount)
          break
        case 'set':
          newBalance = Math.max(0, request.amount)
          break
        default:
          return {
            success: false,
            error: 'Invalid operation'
          }
      }

      // Update token balance
      const updatedUser = await prisma.user.update({
        where: { id: request.userId },
        data: { tokenBalance: newBalance },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          tokenBalance: true,
          lastLoginAt: true,
          emailVerified: true,
        }
      })

      // Log token balance change
      await prisma.token_usage.create({
        data: {
          userId: request.userId,
          feature: tokenusagefeature.ADMIN,
          operation: 'admin_adjustment',
          tokensConsumed: request.operation === 'subtract' ? request.amount : 0,
          tokensRemaining: newBalance,
          planId: 'default',
          itemCount: 1,
          isBatch: false,
          metadata: {
            operation: request.operation,
            amount: request.amount,
            newBalance: newBalance
          }
        }
      })

      // Log the activity
      await prisma.userActivity.create({
        data: {
          userId: request.userId,
          action: 'token_balance_updated',
          resource: 'user',
          metadata: {
            operation: request.operation,
            amount: request.amount,
            oldBalance: currentUser.tokenBalance,
            newBalance,
            updatedBy: request.updatedBy,
            reason: request.reason,
            timestamp: new Date().toISOString()
          }
        }
      })

      return {
        success: true,
        user: { ...updatedUser, isActive: updatedUser.status === 'ACTIVE' }
      }
    } catch (error) {
      console.error('Failed to update token balance:', error)
      return {
        success: false,
        error: 'Failed to update token balance'
      }
    }
  }

  /**
   * Get all users with pagination and filtering
   */
  static async getUsers(options: {
    page?: number
    limit?: number
    role?: UserRole
    status?: UserStatus
    search?: string
    sortBy?: 'name' | 'email' | 'createdAt' | 'lastLoginAt'
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<{
    users: AuthUser[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options

      const skip = (page - 1) * limit

      // Build where clause
      const where: any = {}
      
      if (role) {
        where.role = role
      }
      
      if (status) {
        where.status = status
      }
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }

      // Get total count
      const total = await prisma.user.count({ where })

      // Get users
      const usersRaw = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          tokenBalance: true,
          lastLoginAt: true,
          emailVerified: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      })
      
      const users = usersRaw.map(user => ({ ...user, isActive: user.status === 'ACTIVE' }))

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    } catch (error) {
      console.error('Failed to get users:', error)
      return {
        users: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      }
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(): Promise<{
    total: number
    byRole: Record<UserRole, number>
    byStatus: Record<UserStatus, number>
    active: number
    inactive: number
    recentLogins: number
  }> {
    try {
      const [
        total,
        roleStats,
        statusStats,
        activeCount,
        recentLogins
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.groupBy({
          by: ['role'],
          _count: { role: true }
        }),
        prisma.user.groupBy({
          by: ['status'],
          _count: { status: true }
        }),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({
          where: {
            lastLoginAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        })
      ])

      // Convert arrays to objects
      const byRole = roleStats.reduce((acc: any, item: any) => {
        acc[item.role] = item._count.role
        return acc
      }, {} as Record<UserRole, number>)

      const byStatus = statusStats.reduce((acc: any, item: any) => {
        acc[item.status] = item._count.status
        return acc
      }, {} as Record<UserStatus, number>)

      return {
        total,
        byRole,
        byStatus,
        active: activeCount,
        inactive: total - activeCount,
        recentLogins
      }
    } catch (error) {
      console.error('Failed to get user stats:', error)
      return {
        total: 0,
        byRole: {} as Record<UserRole, number>,
        byStatus: {} as Record<UserStatus, number>,
        active: 0,
        inactive: 0,
        recentLogins: 0
      }
    }
  }

  /**
   * Validate role hierarchy for role changes
   */
  static validateRoleHierarchy(currentRole: UserRole, targetRole: UserRole, updaterRole: UserRole): {
    valid: boolean
    error?: string
  } {
    const roleHierarchy = {
      'USER': 0,
      'ADMIN': 1
    }

    const currentLevel = roleHierarchy[currentRole as keyof typeof roleHierarchy]
    const targetLevel = roleHierarchy[targetRole as keyof typeof roleHierarchy]
    const updaterLevel = roleHierarchy[updaterRole as keyof typeof roleHierarchy]

    // Only ADMIN can assign ADMIN role
    if (targetRole === 'ADMIN' && updaterRole !== 'ADMIN') {
      return {
        valid: false,
        error: 'Only ADMIN can assign ADMIN role'
      }
    }

    // Users can only assign roles equal to or lower than their own
    if (targetLevel > updaterLevel) {
      return {
        valid: false,
        error: 'Cannot assign a role higher than your own'
      }
    }

    // Users cannot modify roles equal to or higher than their own
    if (currentLevel >= updaterLevel) {
      return {
        valid: false,
        error: 'Cannot modify users with equal or higher roles'
      }
    }

    return { valid: true }
  }

  /**
   * Check if user can perform action on target user
   */
  static async canModifyUser(actorId: string, targetId: string): Promise<{
    canModify: boolean
    reason?: string
  }> {
    try {
      if (actorId === targetId) {
        return {
          canModify: false,
          reason: 'Cannot modify your own account through admin functions'
        }
      }

      const [actor, target] = await Promise.all([
        this.getUserById(actorId),
        this.getUserById(targetId)
      ])

      if (!actor || !target) {
        return {
          canModify: false,
          reason: 'User not found'
        }
      }

      const validation = this.validateRoleHierarchy(target.role, target.role, actor.role)
      if (!validation.valid) {
        return {
          canModify: false,
          reason: validation.error
        }
      }

      return { canModify: true }
    } catch (error) {
      console.error('Failed to check user modification permissions:', error)
      return {
        canModify: false,
        reason: 'Permission check failed'
      }
    }
  }
}