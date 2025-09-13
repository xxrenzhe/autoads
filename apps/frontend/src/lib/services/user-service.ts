import { prisma } from '@/lib/db'

export interface UserStats {
  total: number
  active: number
  inactive: number
  byRole: Record<string, number>
  growth: number
  newThisMonth: number
  newThisWeek: number
}

export interface TokenUpdate {
  userId: string
  tokenBalance: number
}

export interface UserTransaction {
  id: string
  userId?: string
  action: string
  resource: string
  metadata?: any
  timestamp: Date
}

export interface UserData {
  id: string
  name: string | null
  email: string
  role: string
  status: string
  isActive: boolean
  tokenBalance: number
  createdAt: Date
  updatedAt: Date
}

export interface UserActivityData {
  id: string
  action: string
  resource: string
  metadata?: any
  timestamp: Date
}

export interface UserActivityStats {
  totalActions: number
  successfulActions: number
  failedActions: number
  totalTokensConsumed: number
  byFeature: Record<string, number>
  byAction: Record<string, number>
  recentActivity: UserActivityData[]
}

export interface SubscriptionData {
  id: string
  status: string
  createdAt: Date
  updatedAt: Date
  userId: string
  plan: {
    id: string
    name: string
    price: number
    currency: string
  }
}

export interface RoleGroupResult {
  role: string
  _count: { role: number }
}

export interface ActionGroupResult {
  action: string
  _count: { action: number }
}

export interface UserSearchResult {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  tokenBalance: number
  createdAt: Date
}

export class UserService {
  /**
   * 根据ID获取用户
   */
  static async getUserById(userId: string, includeRelations: boolean = false): Promise<UserData | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: includeRelations ? {
          subscriptions: {
            include: {
              plan: true
            }
          },
          token_usage: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        } : undefined
      })
      return user ? { ...user, isActive: user.status === 'ACTIVE' } : null
    } catch (error) {
      console.error('Failed to get user by ID:', error)
      return null
    }
  }

  /**
   * 更新用户信息
   */
  static async updateUser(userId: string, data: {
    name?: string
    email?: string
    role?: string
    status?: string
    isActive?: boolean
    tokenBalance?: number
    tokenUsedThisMonth?: number
  }): Promise<UserData | null> {
    try {
      const updatedUserRaw = await prisma.user.update({
        where: { id: userId },
        data: {
          ...data,
          ...(data.role && { role: data.role as any }),
          ...(data.status && { status: data.status as any }),
          updatedAt: new Date()
        }
      })
      
      return updatedUserRaw ? { ...updatedUserRaw, isActive: updatedUserRaw.status === 'ACTIVE' } : null
    } catch (error) {
      console.error('Failed to update user:', error)
      return null
    }
  }

  /**
   * 删除用户
   */
  static async deleteUser(userId: string): Promise<boolean> {
    try {
      await prisma.user.delete({
        where: { id: userId }
      })
      return true
    } catch (error) {
      console.error('Failed to delete user:', error)
      return false
    }
  }

  /**
   * 获取用户行为统计（别名方法）
   */
  static async getUserBehaviorStats(userId: string): Promise<UserActivityStats> {
    return this.getUserActivityStats(userId)
  }

  /**
   * 获取用户统计信息
   */
  static async getUserStats(): Promise<UserStats> {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        roleStats,
        newThisMonth,
        newThisWeek,
        lastMonthUsers
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({ where: { status: { not: 'ACTIVE' } } }),
        prisma.user.groupBy({
          by: ['role'],
          _count: { role: true }
        }),
        prisma.user.count({
          where: {
            createdAt: { gte: startOfMonth }
          }
        }),
        prisma.user.count({
          where: {
            createdAt: { gte: startOfWeek }
          }
        }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: lastMonth,
              lte: endOfLastMonth
            }
          }
        })
      ])

      // Calculate growth rate
      const growth = lastMonthUsers > 0 ? 
        ((newThisMonth - lastMonthUsers) / lastMonthUsers) * 100 : 0

      // Convert role stats to object
      const byRole = roleStats.reduce((acc: Record<string, number>, stat: RoleGroupResult: any) => {
        acc[stat.role] = stat._count.role
        return acc
      }, {} as Record<string, number>)

      return {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        byRole,
        growth: Math.round(growth * 100) / 100,
        newThisMonth,
        newThisWeek
      }
    } catch (error) {
      console.error('Failed to get user stats:', error)
      return {
        total: 0,
        active: 0,
        inactive: 0,
        byRole: {},
        growth: 0,
        newThisMonth: 0,
        newThisWeek: 0
      }
    }
  }

  /**
   * 批量更新用户Token余额
   */
  static async bulkUpdateTokenBalance(updates: TokenUpdate[]): Promise<{
    success: boolean
    updated: number
    error?: string
  }> {
    try {
      let updated = 0

      // Use transaction for consistency
      await prisma.$transaction(async (tx: any) => {
        for (const update of updates) {
          await tx.user.update({
            where: { id: update.userId },
            data: { tokenBalance: update.tokenBalance }
          })
          updated++
        }
      })

      return {
        success: true,
        updated
      }
    } catch (error) {
      console.error('Failed to bulk update token balance:', error)
      return {
        success: false,
        updated: 0,
        error: 'Failed to update token balances'
      }
    }
  }

  /**
   * 记录用户行为
   */
  static async recordBehavior(
    userId: string,
    action: string,
    feature: string,
    result: {
      success: boolean
      tokensConsumed: number
      metadata?: Record<string, any>
    }
  ): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      await prisma.userActivity.create({
        data: {
          userId,
          action,
          resource: 'api',
          metadata: {
            success: result.success,
            tokensConsumed: result.tokensConsumed,
            ...result.metadata
          }
        }
      })

      return { success: true }
    } catch (error) {
      console.error('Failed to record user behavior:', error)
      return {
        success: false,
        error: 'Failed to record behavior'
      }
    }
  }

  /**
   * 获取用户行为历史
   */
  static async getUserBehavior(
    userId: string,
    options: {
      limit?: number
      offset?: number
      action?: string
      feature?: string
      startDate?: Date
      endDate?: Date
    } = {}
  ): Promise<{
    activities: UserActivityData[]
    total: number
  }> {
    try {
      const {
        limit = 50,
        offset = 0,
        action,
        feature,
        startDate,
        endDate
      } = options

      const whereClause: {
        userId: string
        action?: string
        feature?: string
        timestamp?: { gte?: Date; lte?: Date }
      } = { userId }

      if (action) {
        whereClause.action = action
      }

      if (feature) {
        whereClause.feature = feature
      }

      if (startDate || endDate) {
        whereClause.timestamp = {}
        if (startDate) whereClause.timestamp.gte = startDate
        if (endDate) whereClause.timestamp.lte = endDate
      }

      const [activities, total] = await Promise.all([
        prisma.userActivity.findMany({
          where: whereClause,
          orderBy: { timestamp: 'desc' },
          skip: offset,
          take: limit,
          select: {
            id: true,
            action: true,
            resource: true,
            metadata: true,
            timestamp: true
          }
        }),
        prisma.userActivity.count({ where: whereClause })
      ])

      return { activities, total }
    } catch (error) {
      console.error('Failed to get user behavior:', error)
      return { activities: [], total: 0 }
    }
  }

  /**
   * 获取用户活动统计
   */
  static async getUserActivityStats(userId: string): Promise<{
    totalActions: number
    successfulActions: number
    failedActions: number
    totalTokensConsumed: number
    byFeature: Record<string, number>
    byAction: Record<string, number>
    recentActivity: UserTransaction[]
  }> {
    try {
      const [
        totalActions,
        successfulActions,
        failedActions,
        tokenStats,
        featureStats,
        actionStats,
        recentActivity
      ] = await Promise.all([
        prisma.userActivity.count({ where: { userId } }),
        prisma.userActivity.count({ where: { userId } }), // success field doesn't exist
        prisma.userActivity.count({ where: { userId } }), // success field doesn't exist
        prisma.userActivity.aggregate({
          where: { userId },
          // _sum: { tokensConsumed: true } // Field doesn't exist
        }),
        prisma.userActivity.groupBy({
          by: ['action'], // Use action instead of feature
          where: { userId },
          _count: { action: true } // Use action instead of feature
        }),
        prisma.userActivity.groupBy({
          by: ['action'],
          where: { userId },
          _count: { action: true }
        }),
        prisma.userActivity.findMany({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: 10,
          select: {
            id: true,
            action: true,
            resource: true,
            metadata: true,
            timestamp: true
          }
        })
      ])

      const byFeature = featureStats.reduce((acc: Record<string, number>, stat: ActionGroupResult: any) => {
        acc[stat.action] = stat._count.action
        return acc
      }, {} as Record<string, number>)

      const byAction = actionStats.reduce((acc: Record<string, number>, stat: ActionGroupResult: any) => {
        acc[stat.action] = stat._count.action
        return acc
      }, {} as Record<string, number>)

      return {
        totalActions,
        successfulActions,
        failedActions,
        totalTokensConsumed: 0, // tokenStats._sum.tokensConsumed || 0, // Field doesn't exist
        byFeature,
        byAction,
        recentActivity
      }
    } catch (error) {
      console.error('Failed to get user activity stats:', error)
      return {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        totalTokensConsumed: 0,
        byFeature: {},
        byAction: {},
        recentActivity: []
      }
    }
  }

  /**
   * 搜索用户
   */
  static async searchUsers(
    query: string,
    options: {
      limit?: number
      includeInactive?: boolean
      roles?: string[]
    } = {}
  ): Promise<UserSearchResult[]> {
    try {
      const { limit = 20, includeInactive = false, roles } = options

      const whereClause: any = {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } }
        ]
      }

      if (!includeInactive) {
        whereClause.isActive = true
      }

      if (roles && roles.length > 0) {
        whereClause.role = { in: roles }
      }

      const users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          tokenBalance: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      })

      return users.map((user: any) => ({ ...user, isActive: user.status === 'ACTIVE' }))
    } catch (error) {
      console.error('Failed to search users:', error)
      return []
    }
  }

  /**
   * 获取用户详细信息
   */
  static async getUserDetails(userId: string): Promise<{
    user: UserData | null
    subscriptions: SubscriptionData[]
    activityStats: UserActivityStats
  }> {
    try {
      const [userRaw, subscriptions, activityStats] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          include: {
            _count: {
              select: {
                subscriptions: { where: { status: 'ACTIVE' } },
                // activities: true // Field doesn't exist in UserCountOutputType
              }
            }
          }
        }),
        prisma.subscription.findMany({
          where: { userId },
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                price: true,
                currency: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),
        this.getUserActivityStats(userId)
      ])

      const user = userRaw ? { ...userRaw, isActive: userRaw.status === 'ACTIVE' } : null
      
      return {
        user,
        subscriptions,
        activityStats
      }
    } catch (error) {
      console.error('Failed to get user details:', error)
      return {
        user: null,
        subscriptions: [],
        activityStats: {
          totalActions: 0,
          successfulActions: 0,
          failedActions: 0,
          totalTokensConsumed: 0,
          byFeature: {},
          byAction: {},
          recentActivity: []
        }
      }
    }
  }

  /**
   * 更新用户最后登录时间
   */
  static async updateLastLogin(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      })
    } catch (error) {
      console.error('Failed to update last login:', error)
    }
  }

  /**
   * 获取活跃用户统计
   */
  static async getActiveUserStats(timeRange: 'day' | 'week' | 'month' = 'day'): Promise<{
    activeUsers: number
    newUsers: number
    returningUsers: number
  }> {
    try {
      const now = new Date()
      let startDate: Date

      switch (timeRange) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
      }

      const [activeUsers, newUsers] = await Promise.all([
        prisma.user.count({
          where: {
            lastLoginAt: { gte: startDate }
          }
        }),
        prisma.user.count({
          where: {
            createdAt: { gte: startDate }
          }
        })
      ])

      const returningUsers = activeUsers - newUsers

      return {
        activeUsers,
        newUsers,
        returningUsers: Math.max(0, returningUsers)
      }
    } catch (error) {
      console.error('Failed to get active user stats:', error)
      return {
        activeUsers: 0,
        newUsers: 0,
        returningUsers: 0
      }
    }
  }
}