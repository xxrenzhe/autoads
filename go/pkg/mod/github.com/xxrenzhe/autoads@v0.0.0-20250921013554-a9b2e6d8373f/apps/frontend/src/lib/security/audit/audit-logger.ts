import { prisma } from '@/lib/prisma'
import { getRedisClient } from '@/lib/cache/redis-client'

export interface AuditEvent {
  userId?: string
  userEmail?: string
  action: string
  resource?: string
  category: 'security' | 'data_access' | 'admin' | 'user' | 'system' | 'compliance'
  severity: 'low' | 'medium' | 'high' | 'critical'
  outcome: 'success' | 'failure' | 'error'
  ipAddress?: string
  userAgent?: string
  details?: any
  metadata?: any
}

export interface AuditQuery {
  userId?: string
  action?: string
  category?: string
  severity?: string
  outcome?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export interface AuditReport {
  totalEvents: number
  events: any[]
  summary: {
    byCategory: Record<string, number>
    bySeverity: Record<string, number>
    byOutcome: Record<string, number>
    byUser: Record<string, number>
  }
  trends: {
    daily: Record<string, number>
    hourly: Record<string, number>
  }
}

export class AuditLogger {
  private static readonly CACHE_PREFIX = 'audit:'
  private static readonly BATCH_SIZE = 100
  private static readonly FLUSH_INTERVAL = 5000 // 5 seconds

  private eventQueue: AuditEvent[] = []
  private flushTimer?: NodeJS.Timeout

  constructor() {
    // Start the flush timer
    this.startFlushTimer()
  }

  /**
   * Log an audit event
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      // Add timestamp
      const auditEvent = {
        ...event,
        timestamp: new Date()
      }

      // Add to queue for batch processing
      this.eventQueue.push(auditEvent)

      // If queue is full, flush immediately
      if (this.eventQueue.length >= AuditLogger.BATCH_SIZE) {
        await this.flushQueue()
      }

      // For critical events, also log immediately
      if (event.severity === 'critical') {
        await this.logImmediate(auditEvent)
      }
    } catch (error) {
      console.error('Failed to log audit event:', error)
    }
  }

  /**
   * Log security event
   */
  async logSecurity(
    action: string,
    outcome: 'success' | 'failure' | 'error',
    details?: any,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action,
      category: 'security',
      severity: outcome === 'failure' ? 'high' : 'medium',
      outcome,
      ipAddress,
      userAgent,
      details
    })
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    action: string,
    resource: string,
    userId: string,
    outcome: 'success' | 'failure' | 'error',
    details?: any
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      category: 'data_access',
      severity: 'low',
      outcome,
      details
    })
  }

  /**
   * Log admin action
   */
  async logAdmin(
    action: string,
    resource: string,
    userId: string,
    outcome: 'success' | 'failure' | 'error',
    details?: any,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      category: 'admin',
      severity: 'medium',
      outcome,
      ipAddress,
      details
    })
  }

  /**
   * Log compliance event
   */
  async logCompliance(
    action: string,
    resource: string,
    userId: string,
    details?: any
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      category: 'compliance',
      severity: 'high',
      outcome: 'success',
      details
    })
  }

  /**
   * Query audit logs
   */
  async query(query: AuditQuery): Promise<AuditReport> {
    try {
      const whereClause: any = {}

      if (query.userId) whereClause.userId = query.userId
      if (query.action) whereClause.action = { contains: query.action, mode: 'insensitive' }
      if (query.category) whereClause.category = query.category
      if (query.severity) whereClause.severity = query.severity
      if (query.outcome) whereClause.outcome = query.outcome

      if (query.startDate || query.endDate) {
        whereClause.timestamp = {}
        if (query.startDate) whereClause.timestamp.gte = query.startDate
        if (query.endDate) whereClause.timestamp.lte = query.endDate
      }

      const [events, totalEvents] = await Promise.all([
        prisma.auditLog.findMany({
          where: whereClause,
          orderBy: { timestamp: 'desc' },
          take: query.limit || 100,
          skip: query.offset || 0
        }),
        prisma.auditLog.count({ where: whereClause })
      ])

      // Generate summary statistics
      const summary = await this.generateSummary(whereClause)
      const trends = await this.generateTrends(whereClause)

      return {
        totalEvents,
        events,
        summary,
        trends
      }
    } catch (error) {
      console.error('Failed to query audit logs:', error)
      throw error
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    period: { start: Date; end: Date }
    totalEvents: number
    securityEvents: number
    dataAccessEvents: number
    adminActions: number
    failedActions: number
    criticalEvents: number
    topUsers: Array<{ userId: string; userEmail: string; eventCount: number }>
    topActions: Array<{ action: string; count: number }>
    securityIncidents: any[]
  }> {
    const whereClause = {
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    }

    const [
      totalEvents,
      securityEvents,
      dataAccessEvents,
      adminActions,
      failedActions,
      criticalEvents,
      topUsersData,
      topActionsData,
      securityIncidents
    ] = await Promise.all([
      prisma.auditLog.count({ where: whereClause }),
      prisma.auditLog.count({ where: { ...whereClause, category: 'security' } }),
      prisma.auditLog.count({ where: { ...whereClause, category: 'data_access' } }),
      prisma.auditLog.count({ where: { ...whereClause, category: 'admin' } }),
      prisma.auditLog.count({ where: { ...whereClause, outcome: 'failure' } }),
      prisma.auditLog.count({ where: { ...whereClause, severity: 'critical' } }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: whereClause,
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 10
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where: whereClause,
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 10
      }),
      prisma.auditLog.findMany({
        where: {
          ...whereClause,
          severity: { in: ['high', 'critical'] },
          category: 'security'
        },
        orderBy: { timestamp: 'desc' },
        take: 50
      })
    ])

    const topUsers = topUsersData.map((item: any) => ({
      userId: item.userId || 'unknown',
      userEmail: item.userEmail || 'unknown',
      eventCount: item._count
    }))

    const topActions = topActionsData.map((item: any) => ({
      action: item.action,
      count: item._count
    }))

    return {
      period: { start: startDate, end: endDate },
      totalEvents,
      securityEvents,
      dataAccessEvents,
      adminActions,
      failedActions,
      criticalEvents,
      topUsers,
      topActions,
      securityIncidents
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs(
    query: AuditQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const report = await this.query({ ...query, limit: 10000 })

    if (format === 'csv') {
      return this.convertToCSV(report.events)
    }

    return JSON.stringify(report, null, 2)
  }

  /**
   * Clean up old audit logs
   */
  async cleanup(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    })

    await this.log({
      action: 'audit_logs_cleanup',
      category: 'system',
      severity: 'low',
      outcome: 'success',
      details: {
        deletedCount: result.count,
        cutoffDate: cutoffDate.toISOString()
      }
    })

    return result.count
  }

  /**
   * Private methods
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.eventQueue.length > 0) {
        await this.flushQueue()
      }
    }, AuditLogger.FLUSH_INTERVAL)
  }

  private async flushQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return

    const events = [...this.eventQueue]
    this.eventQueue = []

    try {
      await prisma.auditLog.createMany({
        data: events?.filter(Boolean)?.map((event: any) => ({
          userId: String(event.userId || ''),
          action: String(event.action || ''),
          resource: String(event.resource || ''),
          category: String(event.category || ''),
          severity: String(event.severity || ''),
          outcome: String(event.outcome || ''),
          ipAddress: String(event.ipAddress || ''),
          userAgent: String(event.userAgent || ''),
          details: typeof event.details === 'string' ? event.details : JSON.stringify(event.details ?? ''),
          metadata: event.metadata,
          timestamp: (event as any).timestamp as Date
        }))
      })
    } catch (error) {
      console.error('Failed to flush audit queue:', error)
      // Re-add events to queue for retry
      this.eventQueue.unshift(...events)
    }
  }

  private async logImmediate(event: AuditEvent & { timestamp: Date }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: String(event.userId || ''),
          action: String(event.action || ''),
          resource: String(event.resource || ''),
          category: String(event.category || ''),
          severity: String(event.severity || ''),
          outcome: String(event.outcome || ''),
          ipAddress: String(event.ipAddress || ''),
          userAgent: String(event.userAgent || ''),
          details: typeof event.details === 'string' ? event.details : JSON.stringify(event.details ?? ''),
          metadata: event.metadata,
          timestamp: event.timestamp as Date
        }
      })
    } catch (error) {
      console.error('Failed to log immediate audit event:', error)
    }
  }

  private async generateSummary(whereClause: any) {
    const [byCategory, bySeverity, byOutcome, byUser] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['category'],
        where: whereClause,
        _count: true
      }),
      prisma.auditLog.groupBy({
        by: ['severity'],
        where: whereClause,
        _count: true
      }),
      prisma.auditLog.groupBy({
        by: ['outcome'],
        where: whereClause,
        _count: true
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: whereClause,
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 10
      })
    ])

    return {
      byCategory: Object.fromEntries(byCategory.map((item: any) => [item.category, item._count])),
      bySeverity: Object.fromEntries(bySeverity.map((item: any) => [item.severity, item._count])),
      byOutcome: Object.fromEntries(byOutcome.map((item: any) => [item.outcome, item._count])),
      byUser: Object.fromEntries(byUser.map((item: any) => [item.userId || 'unknown', item._count]))
    }
  }

  private async generateTrends(whereClause: any) {
    // This would require more complex SQL queries to group by date/hour
    // For now, return empty trends
    return {
      daily: {},
      hourly: {}
    }
  }

  private convertToCSV(events: any[]): string {
    if (events.length === 0) return ''

    const headers = Object.keys(events[0])
    const csvRows = [
      headers.join(','),
      ...events?.filter(Boolean)?.map((event: any) =>
        headers?.filter(Boolean)?.map((header: any) => {
          const value = event[header]
          return typeof value === 'object' ? JSON.stringify(value) : String(value)
        }).join(',')
      )
    ]

    return csvRows.join('\n')
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    
    // Flush remaining events
    await this.flushQueue()
  }
}

export const auditLogger = new AuditLogger()

// Graceful shutdown
process.on('SIGTERM', () => auditLogger.shutdown())
process.on('SIGINT', () => auditLogger.shutdown())
