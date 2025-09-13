import { prisma } from '@/lib/prisma'
import redis from '@/lib/redis'
import { randomBytes, createHash } from 'crypto'

export interface SessionConfig {
  maxAge: number
  rolling: boolean
  secure: boolean
  sameSite: 'strict' | 'lax' | 'none'
  maxConcurrentSessions: number
}

export interface SessionData {
  id: string
  userId: string
  sessionToken: string
  expires: Date
  ipAddress?: string
  userAgent?: string
  lastActivity: Date
  isActive: boolean
  metadata?: any
}

export interface SecurityMetrics {
  activeSessions: number
  suspiciousActivity: number
  failedLogins: number
  blockedIPs: number
}

export class SessionManager {
  private config: SessionConfig = {
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    rolling: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxConcurrentSessions: 5
  }

  private static readonly CACHE_PREFIX = 'session:'
  private static readonly SECURITY_PREFIX = 'security:'
  private static readonly BLOCKED_IP_PREFIX = 'blocked_ip:'

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: any
  ): Promise<SessionData> {
    try {
      // Check if user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, role: true }
      })

      if (!user || user.status !== 'ACTIVE') {
        throw new Error('User not found or inactive')
      }

      // Check for too many concurrent sessions
      await this.cleanupExpiredSessions(userId)
      const activeSessions = await this.getActiveSessionCount(userId)
      
      if (activeSessions >= this.config.maxConcurrentSessions) {
        // Remove oldest session
        await this.removeOldestSession(userId)
      }

      // Generate secure session token
      const sessionToken = this.generateSecureToken()
      const expires = new Date(Date.now() + this.config.maxAge)

      // Create session in database
      const session = await prisma.session.create({
        data: {
          sessionToken,
          userId,
          expires
        }
      })

      const sessionData: SessionData = {
        id: session.id,
        userId,
        sessionToken,
        expires,
        ipAddress,
        userAgent,
        lastActivity: new Date(),
        isActive: true,
        metadata
      }

      // Cache session data
      await this.cacheSession(sessionData)

      // Log session creation
      await this.logSecurityEvent(userId, 'session_created', {
        sessionId: session.id,
        ipAddress,
        userAgent
      })

      // Update last login
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      })

      return sessionData
    } catch (error) {
      console.error('Error creating session:', error)
      throw error
    }
  }

  /**
   * Validate and refresh session
   */
  async validateSession(sessionToken: string): Promise<SessionData | null> {
    try {
      // Try cache first
      const cached = await redis.get(`${SessionManager.CACHE_PREFIX}${sessionToken}`)
      if (cached) {
        const sessionData: SessionData = JSON.parse(cached)
        
        // Check if session is still valid
        if (sessionData.expires > new Date() && sessionData.isActive) {
          // Update last activity if rolling sessions
          if (this.config.rolling) {
            sessionData.lastActivity = new Date()
            sessionData.expires = new Date(Date.now() + this.config.maxAge)
            await this.cacheSession(sessionData)
          }
          
          return sessionData
        }
      }

      // Check database
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: {
          user: {
            select: { id: true, status: true, role: true }
          }
        }
      })

      if (!session || session.expires <= new Date() || session.user.status !== 'ACTIVE') {
        if (session) {
          await this.destroySession(sessionToken)
        }
        return null
      }

      const sessionData: SessionData = {
        id: session.id,
        userId: session.userId,
        sessionToken: session.sessionToken,
        expires: session.expires,
        lastActivity: new Date(),
        isActive: true
      }

      // Update session if rolling
      if (this.config.rolling) {
        const newExpires = new Date(Date.now() + this.config.maxAge)
        
        await prisma.session.update({
          where: { id: session.id },
          data: { expires: newExpires }
        })
        
        sessionData.expires = newExpires
      }

      // Cache updated session
      await this.cacheSession(sessionData)

      return sessionData
    } catch (error) {
      console.error('Error validating session:', error)
      return null
    }
  }

  /**
   * Destroy a session
   */
  async destroySession(sessionToken: string): Promise<void> {
    try {
      // Remove from database
      const session = await prisma.session.findUnique({
        where: { sessionToken }
      })

      if (session) {
        await prisma.session.delete({
          where: { sessionToken }
        })

        // Log session destruction
        await this.logSecurityEvent(session.userId, 'session_destroyed', {
          sessionId: session.id
        })
      }

      // Remove from cache
      await redis.del(`${SessionManager.CACHE_PREFIX}${sessionToken}`)
    } catch (error) {
      console.error('Error destroying session:', error)
    }
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    try {
      // Get all user sessions
      const sessions = await prisma.session.findMany({
        where: { userId }
      })

      // Remove from database
      await prisma.session.deleteMany({
        where: { userId }
      })

      // Remove from cache
      const cacheKeys = sessions.map((s: any: any) => `${SessionManager.CACHE_PREFIX}${s.sessionToken}`)
      if (cacheKeys.length > 0) {
        for (const key of cacheKeys) {
          await redis.del(key)
        }
      }

      // Log event
      await this.logSecurityEvent(userId, 'all_sessions_destroyed', {
        sessionCount: sessions.length
      })
    } catch (error) {
      console.error('Error destroying all user sessions:', error)
    }
  }

  /**
   * Get active session count for user
   */
  async getActiveSessionCount(userId: string): Promise<number> {
    return await prisma.session.count({
      where: {
        userId,
        expires: {
          gt: new Date()
        }
      }
    })
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expires: {
          gt: new Date()
        }
      },
      orderBy: { expires: 'desc' }
    })

    return sessions.map((session: any: any) => ({
      id: session.id,
      userId: session.userId,
      sessionToken: session.sessionToken,
      expires: session.expires,
      lastActivity: new Date(), // Would need to track this separately
      status: 'ACTIVE'
    }))
  }

  /**
   * Monitor suspicious activity
   */
  async monitorSuspiciousActivity(
    userId: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<{ isSuspicious: boolean; reason?: string }> {
    try {
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000
      const oneHourAgo = now - 60 * 60 * 1000

      // Check for rapid login attempts
      const recentLogins = await redis.get(`${SessionManager.SECURITY_PREFIX}logins:${userId}:${ipAddress}`)
      const loginCount = recentLogins ? parseInt(recentLogins) : 0

      if (loginCount > 10) {
        await this.blockIP(ipAddress, 'Too many login attempts')
        return { isSuspicious: true, reason: 'Too many login attempts' }
      }

      // Check for multiple IPs
      const userSessions = await this.getUserSessions(userId)
      const uniqueIPs = new Set(userSessions?.filter(Boolean)?.map((s: any) => s.ipAddress).filter(Boolean))
      
      if (uniqueIPs.size > 3) {
        return { isSuspicious: true, reason: 'Multiple IP addresses' }
      }

      // Check for unusual user agent
      if (userAgent && this.isUnusualUserAgent(userAgent)) {
        return { isSuspicious: true, reason: 'Unusual user agent' }
      }

      // Check if IP is blocked
      const isBlocked = await redis.get(`${SessionManager.BLOCKED_IP_PREFIX}${ipAddress}`)
      if (isBlocked) {
        return { isSuspicious: true, reason: 'IP address is blocked' }
      }

      return { isSuspicious: false }
    } catch (error) {
      console.error('Error monitoring suspicious activity:', error)
      return { isSuspicious: false }
    }
  }

  /**
   * Block IP address
   */
  async blockIP(ipAddress: string, reason: string, duration: number = 24 * 60 * 60): Promise<void> {
    await redis.setex(`${SessionManager.BLOCKED_IP_PREFIX}${ipAddress}`, duration, reason)
    
    // Log the block
    await prisma.securityEvent.create({
      data: {
        userId: 'system',
        eventType: 'ip_blocked',
        severity: 'high',
        description: `IP address blocked: ${reason}`,
        ipAddress,
        metadata: { reason, duration }
      }
    })
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    const [activeSessions, suspiciousActivity, failedLogins] = await Promise.all([
      prisma.session.count({
        where: {
          expires: { gt: new Date() }
        }
      }),
      prisma.securityEvent.count({
        where: {
          eventType: { in: ['suspicious_activity', 'failed_login'] },
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.securityEvent.count({
        where: {
          eventType: 'failed_login',
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
    ])

    // Count blocked IPs
    const blockedIPKeys = await redis.keys(`${SessionManager.BLOCKED_IP_PREFIX}*`)
    const blockedIPs = blockedIPKeys.length

    return {
      activeSessions,
      suspiciousActivity,
      failedLogins,
      blockedIPs
    }
  }

  /**
   * Private helper methods
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString('hex')
  }

  private async cacheSession(sessionData: SessionData): Promise<void> {
    const ttl = Math.floor((sessionData.expires.getTime() - Date.now()) / 1000)
    if (ttl > 0) {
      await redis.setex(
        `${SessionManager.CACHE_PREFIX}${sessionData.sessionToken}`,
        ttl,
        JSON.stringify(sessionData)
      )
    }
  }

  private async cleanupExpiredSessions(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: {
        userId,
        expires: { lte: new Date() }
      }
    })
  }

  private async removeOldestSession(userId: string): Promise<void> {
    const oldestSession = await prisma.session.findFirst({
      where: { userId },
      orderBy: { expires: 'asc' }
    })

    if (oldestSession) {
      await this.destroySession(oldestSession.sessionToken)
    }
  }

  private isUnusualUserAgent(userAgent: string): boolean {
    // Simple check for common bot patterns
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /java/i
    ]

    return botPatterns.some(pattern => pattern.test(userAgent))
  }

  private async logSecurityEvent(
    userId: string,
    eventType: string,
    metadata?: any
  ): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          userId,
          eventType,
          severity: this.getEventSeverity(eventType),
          description: this.getEventDescription(eventType),
          metadata
        }
      })
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  private getEventSeverity(eventType: string): string {
    const severityMap: Record<string, string> = {
      'session_created': 'low',
      'session_destroyed': 'low',
      'all_sessions_destroyed': 'medium',
      'suspicious_activity': 'high',
      'failed_login': 'medium',
      'ip_blocked': 'high'
    }

    return severityMap[eventType] || 'medium'
  }

  private getEventDescription(eventType: string): string {
    const descriptionMap: Record<string, string> = {
      'session_created': 'New session created',
      'session_destroyed': 'Session destroyed',
      'all_sessions_destroyed': 'All user sessions destroyed',
      'suspicious_activity': 'Suspicious activity detected',
      'failed_login': 'Failed login attempt',
      'ip_blocked': 'IP address blocked'
    }

    return descriptionMap[eventType] || 'Security event occurred'
  }
}

export const sessionManager = new SessionManager()