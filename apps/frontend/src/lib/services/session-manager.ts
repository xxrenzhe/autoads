import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { getCacheManager } from '@/lib/cache/cache-manager'

const cache = getCacheManager()

interface SessionInfo {
  id: string
  sessionToken: string
  expires: Date
  ipAddress: string
  userAgent: string
  createdAt: Date
  lastAccessed: Date
  isActive: boolean
}

/**
 * 会话管理服务
 */
export class SessionManager {
  private static readonly MAX_CONCURRENT_SESSIONS = 3
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private static readonly SESSION_KEY_PREFIX = 'user_session:'

  /**
   * 检查用户会话并发限制
   */
  static async checkSessionLimit(userId: string, currentSessionId: string): Promise<{
    allowed: boolean
    reason?: string
    activeSessions?: SessionInfo[]
  }> {
    try {
      // 获取用户所有活跃会话
      const activeSessions = await this.getUserActiveSessions(userId)
      
      // 如果当前会话已在列表中，更新访问时间
      const currentSession = activeSessions.find(s => s.id === currentSessionId)
      if (currentSession) {
        await this.updateSessionAccess(currentSessionId)
        return { allowed: true, activeSessions }
      }

      // 检查会话数量限制
      if (activeSessions.length >= this.MAX_CONCURRENT_SESSIONS) {
        return {
          allowed: false,
          reason: `超过最大并发会话数限制 (${this.MAX_CONCURRENT_SESSIONS})`,
          activeSessions
        }
      }

      return { allowed: true, activeSessions }
    } catch (error) {
      console.error('Error checking session limit:', error)
      // 出错时允许访问，避免阻塞用户
      return { allowed: true }
    }
  }

  /**
   * 获取用户活跃会话列表
   */
  static async getUserActiveSessions(userId: string): Promise<SessionInfo[]> {
    try {
      // 从缓存获取会话信息
      const cacheKey = `${this.SESSION_KEY_PREFIX}${userId}`
      const cachedSessions = await cache.get<SessionInfo[]>(cacheKey)
      
      if (cachedSessions) {
        // 过滤掉过期会话
        const now = Date.now()
        const validSessions = cachedSessions.filter(
          session => new Date(session.expires).getTime() > now
        )
        
        // 如果有过期会话，更新缓存
        if (validSessions.length !== cachedSessions.length) {
          await cache.set(cacheKey, validSessions, this.SESSION_TIMEOUT)
        }
        
        return validSessions
      }

      // 从数据库获取会话信息
      const sessions = await prisma.session.findMany({
        where: {
          userId,
          expires: { gt: new Date() }
        },
        orderBy: { expires: 'desc' }
      })

      const sessionInfos: SessionInfo[] = sessions.map(session => ({
        id: session.id,
        sessionToken: session.sessionToken,
        expires: session.expires,
        ipAddress: '', // 需要从其他地方获取
        userAgent: '', // 需要从其他地方获取
        createdAt: session.expires,
        lastAccessed: session.expires,
        isActive: true
      }))

      // 缓存会话信息
      await cache.set(cacheKey, sessionInfos, this.SESSION_TIMEOUT)

      return sessionInfos
    } catch (error) {
      console.error('Error getting user sessions:', error)
      return []
    }
  }

  /**
   * 创建新会话
   */
  static async createSession(
    userId: string,
    sessionToken: string,
    expires: Date,
    request: NextRequest
  ): Promise<void> {
    try {
      // 检查并发限制
      const { allowed, reason } = await this.checkSessionLimit(userId, '')
      
      if (!allowed) {
        throw new Error(reason || 'Session limit exceeded')
      }

      // 创建数据库会话记录
      await prisma.session.create({
        data: {
          userId,
          sessionToken,
          expires
        }
      })

      // 更新缓存
      await this.updateSessionCache(userId)

      // 记录会话创建事件
      await this.logSessionEvent(userId, 'created', request)
    } catch (error) {
      console.error('Error creating session:', error)
      throw error
    }
  }

  /**
   * 终止会话
   */
  static async terminateSession(
    userId: string,
    sessionId: string,
    reason: string = 'manual'
  ): Promise<boolean> {
    try {
      // 删除数据库会话
      await prisma.session.deleteMany({
        where: {
          userId,
          id: sessionId
        }
      })

      // 更新缓存
      await this.updateSessionCache(userId)

      // 记录会话终止事件
      await this.logSessionEvent(userId, 'terminated', null, reason)

      return true
    } catch (error) {
      console.error('Error terminating session:', error)
      return false
    }
  }

  /**
   * 终止用户所有其他会话
   */
  static async terminateOtherSessions(
    userId: string,
    currentSessionId: string
  ): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          userId,
          id: { not: currentSessionId }
        }
      })

      // 更新缓存
      await this.updateSessionCache(userId)

      // 记录事件
      await this.logSessionEvent(userId, 'terminated_others', null, `Terminated ${result.count} sessions`)

      return result.count
    } catch (error) {
      console.error('Error terminating other sessions:', error)
      return 0
    }
  }

  /**
   * 更新会话访问时间
   */
  static async updateSessionAccess(sessionId: string): Promise<void> {
    try {
      const cacheKey = `session_access:${sessionId}`
      await cache.set(cacheKey, Date.now(), this.SESSION_TIMEOUT)
    } catch (error) {
      console.error('Error updating session access:', error)
    }
  }

  /**
   * 更新用户会话缓存
   */
  private static async updateSessionCache(userId: string): Promise<void> {
    try {
      const cacheKey = `${this.SESSION_KEY_PREFIX}${userId}`
      await cache.delete(cacheKey)
    } catch (error) {
      console.error('Error updating session cache:', error)
    }
  }

  /**
   * 记录会话事件
   */
  private static async logSessionEvent(
    userId: string,
    action: string,
    request: NextRequest | null,
    details?: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: `session_${action}`,
          resource: 'session',
          category: 'security',
          severity: 'info',
          outcome: 'success',
          ipAddress: request?.headers.get('x-forwarded-for') || '',
          userAgent: request?.headers.get('user-agent') || '',
          details: details ? JSON.stringify(details) : undefined
        }
      })
    } catch (error) {
      console.error('Error logging session event:', error)
    }
  }

  /**
   * 清理过期会话
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          expires: { lte: new Date() }
        }
      })

      // 清理相关缓存
      const sessions = await prisma.session.findMany({
        where: {
          userId: { in: result.count > 0 ? 
            (await prisma.session.findMany({ 
              select: { userId: true },
              distinct: ['userId']
            })).map(s => s.userId) : []
          }
        }
      })

      for (const session of sessions) {
        await this.updateSessionCache(session.userId)
      }

      return result.count
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error)
      return 0
    }
  }

  /**
   * 获取会话统计信息
   */
  static async getSessionStats(userId: string): Promise<{
    totalSessions: number
    activeSessions: number
    devices: Array<{ type: string; count: number }>
    locations: Array<{ location: string; count: number }>
  }> {
    try {
      const sessions = await this.getUserActiveSessions(userId)
      
      // 简单的设备类型检测
      const deviceTypes = sessions.reduce((acc, session) => {
        const userAgent = session.userAgent.toLowerCase()
        let type = 'unknown'
        
        if (userAgent.includes('mobile')) type = 'mobile'
        else if (userAgent.includes('tablet')) type = 'tablet'
        else if (userAgent.includes('windows') || userAgent.includes('mac') || userAgent.includes('linux')) type = 'desktop'
        
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.isActive).length,
        devices: Object.entries(deviceTypes).map(([type, count]) => ({ type, count })),
        locations: [] // 需要IP地理位置服务
      }
    } catch (error) {
      console.error('Error getting session stats:', error)
      return {
        totalSessions: 0,
        activeSessions: 0,
        devices: [],
        locations: []
      }
    }
  }
}

/**
 * 会话控制中间件
 */
export async function sessionControlMiddleware(
  request: NextRequest,
  userId: string,
  sessionId: string
): Promise<NextResponse | null> {
  try {
    const sessionCheck = await SessionManager.checkSessionLimit(userId, sessionId)
    
    if (!sessionCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Session limit exceeded',
          message: sessionCheck.reason,
          code: 'SESSION_LIMIT_EXCEEDED',
          activeSessions: sessionCheck.activeSessions?.length
        },
        { status: 429 }
      )
    }

    // 更新会话访问时间
    await SessionManager.updateSessionAccess(sessionId)

    return null // 允许继续
  } catch (error) {
    console.error('Session control middleware error:', error)
    return null // 出错时允许继续
  }
}