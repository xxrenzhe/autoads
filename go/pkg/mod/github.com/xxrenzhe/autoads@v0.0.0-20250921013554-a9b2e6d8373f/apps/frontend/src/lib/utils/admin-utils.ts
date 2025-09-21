import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'

/**
 * 管理员工具函数
 */
export class AdminUtils {
  /**
   * 检查用户是否为管理员
   */
  static async isAdmin(userId?: string): Promise<boolean> {
    if (!userId) {
      const session = await auth()
      userId = session?.userId
    }

    if (!userId) return false

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true }
      })

      return user?.status === 'ACTIVE' && ['ADMIN'].includes(user.role || '')
    } catch (error) {
      console.error('Error checking admin status:', error)
      return false
    }
  }

  /**
   * 检查用户是否为超级管理员
   */
  static async isSuperAdmin(userId?: string): Promise<boolean> {
    if (!userId) {
      const session = await auth()
      userId = session?.userId
    }

    if (!userId) return false

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true }
      })

      return user?.status === 'ACTIVE' && user.role === 'ADMIN'
    } catch (error) {
      console.error('Error checking super admin status:', error)
      return false
    }
  }

  /**
   * 获取管理员用户信息
   */
  static async getAdminUser(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true
        }
      })

      if (!user || user.status !== 'ACTIVE' || !['ADMIN'].includes(user.role)) {
        return null
      }

      return user
    } catch (error) {
      console.error('Error getting admin user:', error)
      return null
    }
  }

  /**
   * 记录管理员操作日志
   */
  static async logAdminAction(
    userId: string,
    action: string,
    resource: string,
    details?: any
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          category: 'admin',
          severity: 'info',
          outcome: 'success',
          details: details ? JSON.stringify(details) as any : null
        }
      })
    } catch (error) {
      console.error('Error logging admin action:', error)
    }
  }

  /**
   * 验证管理员权限并记录操作
   */
  static async validateAdminAction(
    userId: string,
    action: string,
    resource: string,
    requiredRole: 'ADMIN' = 'ADMIN'
  ): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true }
      })

      if (!user || user.status !== 'ACTIVE') {
        await this.logAdminAction(userId, `${action}_denied`, resource, {
          reason: 'User not found or inactive'
        })
        return false
      }

      const hasPermission = user.role === 'ADMIN'

      if (!hasPermission) {
        await this.logAdminAction(userId, `${action}_denied`, resource, {
          reason: 'Insufficient permissions',
          userRole: user.role,
          requiredRole
        })
        return false
      }

      // 记录成功的操作
      await this.logAdminAction(userId, action, resource)
      return true

    } catch (error) {
      console.error('Error validating admin action:', error)
      return false
    }
  }

  /**
   * 创建管理员用户（仅超级管理员可用）
   */
  static async createAdminUser(
    creatorId: string,
    userData: {
      email: string
      name: string
      password: string
      role: 'ADMIN'
    }
  ) {
    // 验证创建者权限
    const canCreate = await this.validateAdminAction(
      creatorId,
      'create_admin_user',
      'user',
      'ADMIN'
    )

    if (!canCreate) {
      throw new Error('Insufficient permissions to create admin user')
    }

    try {
      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.hash(userData.password, 12)

      const newUser = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          password: hashedPassword,
          role: userData.role,
          emailVerified: true,
          status: 'ACTIVE'
        }
      })

      await this.logAdminAction(creatorId, 'admin_user_created', 'user', {
        newUserId: newUser.id,
        newUserEmail: newUser.email,
        newUserRole: newUser.role
      })

      return newUser

    } catch (error) {
      await this.logAdminAction(creatorId, 'admin_user_creation_failed', 'user', {
        error: error instanceof Error ? error.message : "Unknown error" as any,
        userData: { email: userData.email, role: userData.role }
      })
      throw error
    }
  }

  /**
   * 获取管理员统计信息
   */
  static async getAdminStats() {
    try {
      const [
        totalAdmins,
        superAdmins,
        activeAdmins,
        recentActions
      ] = await Promise.all([
        prisma.user.count({
          where: {
            role: { in: ['ADMIN'] },
            status: 'ACTIVE'
          }
        }),
        prisma.user.count({
          where: {
            role: 'ADMIN',
            status: 'ACTIVE'
          }
        }),
        prisma.user.count({
          where: {
            role: { in: ['ADMIN'] },
            status: 'ACTIVE',
            lastLoginAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        }),
        prisma.auditLog.count({
          where: {
            category: 'admin',
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })
      ])

      return {
        totalAdmins,
        superAdmins,
        regularAdmins: totalAdmins - superAdmins,
        activeAdmins,
        recentActions
      }

    } catch (error) {
      console.error('Error getting admin stats:', error)
      return {
        totalAdmins: 0,
        superAdmins: 0,
        regularAdmins: 0,
        activeAdmins: 0,
        recentActions: 0
      }
    }
  }
}