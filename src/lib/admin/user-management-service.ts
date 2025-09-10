import { prisma } from '@/lib/prisma'

export interface UserQueryParams {
  page?: number
  limit?: number
  role?: string
  status?: string
  search?: string
}

export interface UserStats {
  totalUsers: number
  activeUsers: number
  suspendedUsers: number
  bannedUsers: number
  newUsersThisMonth: number
  premiumUsers: number
}

export class UserManagementService {
  /**
   * Get users with pagination and filtering
   */
  static async getUsers(params: UserQueryParams) {
    const { page = 1, limit = 10, role, status, search } = params
    const skip = (page - 1) * limit

    const where: any = {}
    
    if (role) where.role = role
    if (status) where.status = status
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } }
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          subscriptions: {
            select: {
              planId: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ])

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: true,
        accounts: true,
        sessions: true
      }
    })
  }

  /**
   * Create new user
   */
  static async createUser(userData: any) {
    return await prisma.user.create({
      data: {
        ...userData,
        status: 'ACTIVE',
        emailVerified: true
      }
    })
  }

  /**
   * Update user
   */
  static async updateUser(userId: string, updateData: any) {
    // Get user before update
    const userBefore = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
    
    // Create audit log for role changes
    if (userBefore && updateData.role && userBefore.role !== updateData.role) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_USER',
          resource: 'user',
          severity: 'INFO',
          category: 'USER_MANAGEMENT',
          outcome: 'SUCCESS',
          metadata: {
            previousRole: userBefore.role,
            newRole: updateData.role,
            reason: updateData.reason || 'Role updated by admin'
          }
        }
      });
    }
    
    return updatedUser;
  }

  /**
   * Delete user
   */
  static async deleteUser(userId: string) {
    // Delete related data first
    await prisma.session.deleteMany({ where: { userId } })
    await prisma.account.deleteMany({ where: { userId } })
    
    return await prisma.user.delete({
      where: { id: userId }
    })
  }

  /**
   * Suspend user
   */
  static async suspendUser(userId: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'SUSPENDED'
      }
    })
  }

  /**
   * Activate user
   */
  static async activateUser(userId: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE'
      }
    })
  }

  /**
   * Get user statistics
   */
  static async getUserStats(): Promise<UserStats> {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      newUsersThisMonth,
      premiumUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { status: 'BANNED' } }),
      prisma.user.count({
        where: {
          createdAt: { gte: startOfMonth }
        }
      }),
      prisma.user.count({
        where: {
          subscriptions: {
            some: {
              planId: { not: 'free' },
              status: 'ACTIVE'
            }
          }
        }
      })
    ])

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      newUsersThisMonth,
      premiumUsers
    }
  }
}

// Export functions
export const getUsers = UserManagementService.getUsers.bind(UserManagementService)
export const getUserById = UserManagementService.getUserById.bind(UserManagementService)
export const createUser = UserManagementService.createUser.bind(UserManagementService)
export const updateUser = UserManagementService.updateUser.bind(UserManagementService)
export const deleteUser = UserManagementService.deleteUser.bind(UserManagementService)
export const suspendUser = UserManagementService.suspendUser.bind(UserManagementService)
export const activateUser = UserManagementService.activateUser.bind(UserManagementService)
export const getUserStats = UserManagementService.getUserStats.bind(UserManagementService)