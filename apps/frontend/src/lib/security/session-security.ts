import { prisma } from '@/lib/db'
import crypto from 'crypto'

/**
 * Session Security Management
 * 
 * This module provides enhanced session security features including
 * session validation, concurrent session management, and security monitoring.
 */

export interface SessionSecurityConfig {
  maxConcurrentSessions: number
  sessionTimeout: number // in minutes
  requireReauthForSensitive: boolean
  trackDeviceFingerprint: boolean
  enableGeoLocationCheck: boolean
}

export interface SecurityEvent {
  id?: string
  userId: string
  type: 'login' | 'logout' | 'session_expired' | 'suspicious_activity' | 'password_change' | 'role_change'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface DeviceFingerprint {
  userAgent: string
  acceptLanguage: string
  timezone: string
  screenResolution?: string
  colorDepth?: string
  platform?: string
}

export class SessionSecurityManager {
  private static readonly DEFAULT_CONFIG: SessionSecurityConfig = {
    maxConcurrentSessions: 5,
    sessionTimeout: 480, // 8 hours
    requireReauthForSensitive: true,
    trackDeviceFingerprint: true,
    enableGeoLocationCheck: false // Requires external service
  }

  /**
   * Validate session security
   */
  static async validateSession(
    sessionToken: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{
    isValid: boolean
    requiresReauth: boolean
    securityWarnings: string[]
  }> {
    const securityWarnings: string[] = []
    let requiresReauth = false

    try {
      // Get session from database
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true }
      })

      if (!session || session.userId !== userId) {
        return {
          isValid: false,
          requiresReauth: true,
          securityWarnings: ['Invalid session token']
        }
      }

      // Check session expiry
      if (session.expires < new Date()) {
        await this.logSecurityEvent({
          userId,
          type: 'session_expired',
          severity: 'low',
          description: 'Session expired',
          ipAddress,
          userAgent,
          createdAt: new Date()
        })

        return {
          isValid: false,
          requiresReauth: true,
          securityWarnings: ['Session expired']
        }
      }

      // Check for suspicious activity
      const suspiciousActivity = await this.detectSuspiciousActivity(
        userId,
        ipAddress,
        userAgent
      )

      if (suspiciousActivity.isSuspicious) {
        securityWarnings.push(...suspiciousActivity.reasons)
        
        if (suspiciousActivity.severity === 'high' || suspiciousActivity.severity === 'critical') {
          requiresReauth = true
          
          await this.logSecurityEvent({
            userId,
            type: 'suspicious_activity',
            severity: suspiciousActivity.severity,
            description: `Suspicious activity detected: ${suspiciousActivity.reasons.join(', ')}`,
            ipAddress,
            userAgent,
            createdAt: new Date()
          })
        }
      }

      // Check concurrent sessions
      const concurrentSessions = await this.getConcurrentSessionCount(userId)
      if (concurrentSessions > this.DEFAULT_CONFIG.maxConcurrentSessions) {
        securityWarnings.push(`Too many concurrent sessions (${concurrentSessions})`)
      }

      // Update session activity
      await this.updateSessionActivity(sessionToken, ipAddress, userAgent)

      return {
        isValid: true,
        requiresReauth,
        securityWarnings
      }
    } catch (error) {
      console.error('Session validation error:', error)
      return {
        isValid: false,
        requiresReauth: true,
        securityWarnings: ['Session validation failed']
      }
    }
  }

  /**
   * Detect suspicious activity
   */
  private static async detectSuspiciousActivity(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{
    isSuspicious: boolean
    severity: 'low' | 'medium' | 'high' | 'critical'
    reasons: string[]
  }> {
    const reasons: string[] = []
    let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low'

    try {
      // Get recent security events - DISABLED (securityEvent table not in schema)
      const recentEvents = [] as any[]

      // Check for multiple failed login attempts - DISABLED (securityEvent table not in schema)
      // const failedLogins = recentEvents.filter(
      //   (event: any) => event.type === 'login' && event.severity === 'medium'
      // )
      // 
      // if (failedLogins.length > 5) {
      //   reasons.push('Multiple failed login attempts')
      //   maxSeverity = 'high'
      // }

      // Check for IP address changes - DISABLED (securityEvent table not in schema)
      // if (ipAddress) {
      //   const recentIPs = recentEvents
      //     .filter((event: any: any) => event.ipAddress && event.ipAddress !== ipAddress)
      //     ?.filter(Boolean)?.map((event: any: any) => event.ipAddress)
      //     .filter((ip: any, index: number, arr: any[]: any) => arr.indexOf(ip) === index)

      //   if (recentIPs.length > 3) {
      //     reasons.push('Multiple IP addresses used recently')
      //     if (maxSeverity === 'low') maxSeverity = 'medium'
      //   }
      // }

      // Check for user agent changes - DISABLED (securityEvent table not in schema)
      // if (userAgent) {
      //   const recentUserAgents = recentEvents
      //     .filter((event: any: any) => event.userAgent && event.userAgent !== userAgent)
      //     ?.filter(Boolean)?.map((event: any: any) => event.userAgent)
      //     .filter((ua: any, index: number, arr: any[]: any) => arr.indexOf(ua) === index)

      //   if (recentUserAgents.length > 2) {
      //     reasons.push('Multiple devices/browsers used recently')
      //     if (maxSeverity === 'low') maxSeverity = 'medium'
      //   }
      // }

      // Check for rapid successive logins - DISABLED (securityEvent table not in schema)
      // const recentLogins = recentEvents.filter(
      //   (event: any) => event.type === 'login' && event.severity === 'low'
      // )

      // if (recentLogins.length > 10) {
      //   reasons.push('Unusually high login frequency')
      //   if (maxSeverity === 'low') maxSeverity = 'medium'
      // }

      // Check for privilege escalation attempts - DISABLED (securityEvent table not in schema)
      // const privilegeEvents = recentEvents.filter(
      //   (event: any) => event.type === 'role_change'
      // )

      // if (privilegeEvents.length > 0) {
      //   reasons.push('Recent privilege changes detected')
      //   if (maxSeverity === 'low' || maxSeverity === 'medium') maxSeverity = 'high'
      // }

      return {
        isSuspicious: reasons.length > 0,
        severity: maxSeverity,
        reasons
      }
    } catch (error) {
      console.error('Error detecting suspicious activity:', error)
      return {
        isSuspicious: false,
        severity: 'low',
        reasons: []
      }
    }
  }

  /**
   * Get concurrent session count
   */
  private static async getConcurrentSessionCount(userId: string): Promise<number> {
    try {
      const count = await prisma.session.count({
        where: {
          userId,
          expires: {
            gt: new Date()
          }
        }
      })
      return count
    } catch (error) {
      console.error('Error getting concurrent session count:', error)
      return 0
    }
  }

  /**
   * Update session activity
   */
  private static async updateSessionActivity(
    sessionToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await prisma.session.update({
        where: { sessionToken },
        data: {
          // Note: We would need to add these fields to the Session model
          // lastActivity: new Date(),
          // lastIpAddress: ipAddress,
          // lastUserAgent: userAgent
        }
      })
    } catch (error) {
      console.error('Error updating session activity:', error)
    }
  }

  /**
   * Log security event - DISABLED (securityEvent table not in schema)
   */
  static async logSecurityEvent(event: SecurityEvent): Promise<void> {
    console.log('Security event (logging disabled):', event)
    // Security event logging disabled - table not in schema
    // try {
    //   await prisma.securityEvent.create({
    //     data: {
    //       userId: event.userId,
    //       type: event.type,
    //       severity: event.severity,
    //       title: event.type.charAt(0).toUpperCase() + event.type.slice(1), // Generate title from type
    //       description: event.description,
    //       ipAddress: event.ipAddress,
    //       userAgent: event.userAgent,
    //       metadata: event.metadata || {},
    //       createdAt: event.createdAt
    //     }
    //   })
    // } catch (error) {
    //   console.error('Error logging security event:', error)
    // }
  }

  /**
   * Terminate all sessions for user
   */
  static async terminateAllSessions(userId: string, reason: string): Promise<void> {
    try {
      await prisma.session.deleteMany({
        where: { userId }
      })

      await this.logSecurityEvent({
        userId,
        type: 'logout',
        severity: 'medium',
        description: `All sessions terminated: ${reason}`,
        createdAt: new Date()
      })
    } catch (error) {
      console.error('Error terminating sessions:', error)
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          expires: {
            lt: new Date()
          }
        }
      })
      return result.count
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error)
      return 0
    }
  }

  /**
   * Generate device fingerprint
   */
  static generateDeviceFingerprint(
    userAgent: string,
    acceptLanguage: string,
    timezone: string,
    additionalData?: Partial<DeviceFingerprint>
  ): string {
    const fingerprint: DeviceFingerprint = {
      userAgent,
      acceptLanguage,
      timezone,
      ...additionalData
    }

    const fingerprintString = JSON.stringify(fingerprint)
    return crypto.createHash('sha256').update(fingerprintString).digest('hex')
  }

  /**
   * Get security events for user - DISABLED (securityEvent table not in schema)
   */
  static async getSecurityEvents(
    userId: string,
    limit: number = 50,
    type?: SecurityEvent['type']
  ): Promise<SecurityEvent[]> {
    console.log('Get security events (disabled):', userId, limit, type)
    return [] // Security events disabled - table not in schema
    // try {
    //   const events = await prisma.securityEvent.findMany({
    //     where: {
    //       userId,
    //       ...(type && { type })
    //     },
    //     orderBy: { createdAt: 'desc' },
    //     take: limit
    //   })

    //   return events?.filter(Boolean)?.map((event: any: any) => ({
    //     id: event.id,
    //     userId: event.userId,
    //     type: event.type as SecurityEvent['type'],
    //     severity: event.severity as SecurityEvent['severity'],
    //     description: event.description,
    //     ipAddress: event.ipAddress || undefined,
    //     userAgent: event.userAgent || undefined,
    //     metadata: event.metadata as Record<string, any> || {},
    //     createdAt: event.createdAt
    //   }))
    // } catch (error) {
    //   console.error('Error getting security events:', error)
    //   return []
    // }
  }

  /**
   * Check if user requires re-authentication
   */
  static async requiresReauthentication(
    userId: string,
    action: 'password_change' | 'role_change' | 'sensitive_data_access' | 'admin_action'
  ): Promise<boolean> {
    if (!this.DEFAULT_CONFIG.requireReauthForSensitive) {
      return false
    }

    try {
      // Check last authentication time - DISABLED (securityEvent table not in schema)
      // const recentAuth = await prisma.securityEvent.findFirst({
      //   where: {
      //     userId,
      //     type: 'login',
      //     createdAt: {
      //       gte: new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
      //     }
      //   },
      //   orderBy: { createdAt: 'desc' }
      // })

      // Require re-auth for sensitive actions if no recent authentication
      const sensitiveActions = ['password_change', 'role_change', 'admin_action']
      if (sensitiveActions.includes(action) /* && !recentAuth */) {
        return true
      }

      return false
    } catch (error) {
      console.error('Error checking re-authentication requirement:', error)
      return true // Fail secure
    }
  }

  /**
   * Get security dashboard data
   */
  static async getSecurityDashboard(userId?: string): Promise<{
    totalEvents: number
    criticalEvents: number
    suspiciousActivities: number
    activeSessions: number
    recentEvents: SecurityEvent[]
  }> {
    try {
      const whereClause = userId ? { userId } : {}
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const [totalEvents, criticalEvents, suspiciousActivities, activeSessions, recentEvents] = await Promise.all([
        // prisma.securityEvent.count({ // Disabled - table not in schema
        0,
        //   where: {
        //     ...whereClause,
        //     createdAt: { gte: last24Hours }
        //   }
        // }),
        // prisma.securityEvent.count({ // Disabled - table not in schema
        0,
        //   where: {
        //     ...whereClause,
        //     severity: 'critical',
        //     createdAt: { gte: last24Hours }
        //   }
        // }),
        // prisma.securityEvent.count({ // Disabled - table not in schema
        0,
        //   where: {
        //     ...whereClause,
        //     type: 'suspicious_activity',
        //     createdAt: { gte: last24Hours }
        //   }
        // }),
        prisma.session.count({
          where: {
            ...(userId && { userId }),
            expires: { gt: new Date() }
          }
        }),
        [] // prisma.securityEvent.findMany({ // Disabled - table not in schema
        //   where: {
        //     ...whereClause,
        //     createdAt: { gte: last24Hours }
        //   },
        //   orderBy: { createdAt: 'desc' },
        //   take: 10
        // })
      ])

      return {
        totalEvents,
        criticalEvents,
        suspiciousActivities,
        activeSessions,
        recentEvents: [] // recentEvents?.filter(Boolean)?.map((event: any: any) => ({ // Disabled - table not in schema
        //   id: event.id,
        //   userId: event.userId,
        //   type: event.type as SecurityEvent['type'],
        //   severity: event.severity as SecurityEvent['severity'],
        //   description: event.description,
        //   ipAddress: event.ipAddress || undefined,
        //   userAgent: event.userAgent || undefined,
        //   metadata: event.metadata as Record<string, any> || {},
        //   createdAt: event.createdAt
        // }))
      }
    } catch (error) {
      console.error('Error getting security dashboard:', error)
      return {
        totalEvents: 0,
        criticalEvents: 0,
        suspiciousActivities: 0,
        activeSessions: 0,
        recentEvents: []
      }
    }
  }
}