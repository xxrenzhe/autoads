import { prisma } from '@/lib/db'
import { getDataMaskingService } from './data-masking-service'
import { getEncryptionService } from './encryption-service'

interface AuditLogEntry {
  id?: string
  userId?: string
  userEmail?: string
  action: string
  resource?: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp?: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security'
  outcome: 'success' | 'failure' | 'error'
  metadata?: Record<string, any>
}

interface AuditQuery {
  userId?: string
  action?: string
  resource?: string
  category?: string
  severity?: string
  outcome?: string
  startDate?: Date
  endDate?: Date
  ipAddress?: string
  limit?: number
  offset?: number
}

interface AuditStatistics {
  totalEntries: number
  entriesByCategory: Record<string, number>
  entriesBySeverity: Record<string, number>
  entriesByOutcome: Record<string, number>
  topUsers: Array<{ userId: string; userEmail: string; count: number }>
  topActions: Array<{ action: string; count: number }>
  topResources: Array<{ resource: string; count: number }>
  recentActivity: AuditLogEntry[]
}

class AuditService {
  private dataMaskingService = getDataMaskingService()
  private encryptionService = getEncryptionService()
  private sensitiveActions = [
    'login', 'logout', 'password_change', 'password_reset',
    'user_create', 'user_delete', 'user_update',
    'role_assign', 'permission_grant', 'permission_revoke',
    'data_export', 'data_import', 'backup_create', 'backup_restore',
    'config_change', 'system_setting_change'
  ]

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<string> {
    try {
      // Enrich the entry with additional metadata
      const enrichedEntry = await this.enrichAuditEntry(entry)
      
      // Mask sensitive data in details
      if (enrichedEntry.details) {
        enrichedEntry.details = this.dataMaskingService.maskAuditData(enrichedEntry.details)
      }

      // Create the audit log entry
      const auditLog = await prisma.auditLog.create({
        data: {
          userId: enrichedEntry.userId,
          action: enrichedEntry.action,
          resource: enrichedEntry.resource || 'unknown',
          details: enrichedEntry.details,
          ipAddress: enrichedEntry.ipAddress,
          userAgent: enrichedEntry.userAgent,
          severity: enrichedEntry.severity,
          category: enrichedEntry.category,
          outcome: enrichedEntry.outcome,
          metadata: enrichedEntry.metadata ? JSON.stringify(enrichedEntry.metadata) : undefined,
          timestamp: enrichedEntry.timestamp || new Date()
        }
      })

      // Check if this is a security-sensitive action that needs immediate attention
      if (this.isSensitiveAction(entry.action) || entry.severity === 'critical') {
        await this.handleSensitiveAuditEvent(auditLog)
      }

      return auditLog.id
    } catch (error) {
      console.error('Failed to create audit log entry:', error)
      throw new Error(`Audit logging failed: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
  }

  /**
   * Log authentication events
   */
  async logAuthentication({
    userId,
    userEmail,
    action,
    outcome,
    ipAddress,
    userAgent,
    details
  }: {
    userId?: string
    userEmail?: string
    action: 'login' | 'logout' | 'login_failed' | 'password_change' | 'password_reset'
    outcome: 'success' | 'failure' | 'error'
    ipAddress?: string
    userAgent?: string
    details?: Record<string, any>
  }): Promise<string> {
    return this.log({
      userId,
      userEmail,
      action,
      resource: 'authentication',
      details,
      ipAddress,
      userAgent,
      severity: outcome === 'failure' ? 'high' : 'medium',
      category: 'authentication',
      outcome
    })
  }

  /**
   * Log data access events
   */
  async logDataAccess({
    userId,
    userEmail,
    action,
    resource,
    resourceId,
    details,
    ipAddress,
    userAgent
  }: {
    userId?: string
    userEmail?: string
    action: 'read' | 'search' | 'export' | 'view'
    resource: string
    resourceId?: string
    details?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }): Promise<string> {
    return this.log({
      userId,
      userEmail,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      severity: action === 'export' ? 'high' : 'low',
      category: 'data_access',
      outcome: 'success'
    })
  }

  /**
   * Log data modification events
   */
  async logDataModification({
    userId,
    userEmail,
    action,
    resource,
    resourceId,
    oldValues,
    newValues,
    ipAddress,
    userAgent
  }: {
    userId?: string
    userEmail?: string
    action: 'create' | 'update' | 'delete' | 'bulk_update' | 'bulk_delete'
    resource: string
    resourceId?: string
    oldValues?: Record<string, any>
    newValues?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }): Promise<string> {
    const details: Record<string, any> = {}
    if (oldValues) details.oldValues = oldValues
    if (newValues) details.newValues = newValues

    return this.log({
      userId,
      userEmail,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      severity: action.includes('delete') ? 'high' : 'medium',
      category: 'data_modification',
      outcome: 'success'
    })
  }

  /**
   * Log system events
   */
  async logSystemEvent({
    userId,
    userEmail,
    action,
    details,
    severity = 'medium',
    outcome = 'success'
  }: {
    userId?: string
    userEmail?: string
    action: string
    details?: Record<string, any>
    severity?: 'low' | 'medium' | 'high' | 'critical'
    outcome?: 'success' | 'failure' | 'error'
  }): Promise<string> {
    return this.log({
      userId,
      userEmail,
      action,
      resource: 'system',
      details,
      severity,
      category: 'system',
      outcome
    })
  }

  /**
   * Log security events
   */
  async logSecurityEvent({
    userId,
    userEmail,
    action,
    details,
    ipAddress,
    userAgent,
    severity = 'high'
  }: {
    userId?: string
    userEmail?: string
    action: string
    details?: Record<string, any>
    ipAddress?: string
    userAgent?: string
    severity?: 'low' | 'medium' | 'high' | 'critical'
  }): Promise<string> {
    return this.log({
      userId,
      userEmail,
      action,
      resource: 'security',
      details,
      ipAddress,
      userAgent,
      severity,
      category: 'security',
      outcome: 'success'
    })
  }

  /**
   * Query audit logs
   */
  async queryLogs(query: AuditQuery): Promise<{
    logs: AuditLogEntry[]
    total: number
    hasMore: boolean
  }> {
    try {
      const {
        userId,
        action,
        resource,
        category,
        severity,
        outcome,
        startDate,
        endDate,
        ipAddress,
        limit = 50,
        offset = 0
      } = query

      const where: any = {}

      if (userId) where.userId = userId
      if (action) where.action = { contains: action, mode: 'insensitive' }
      if (resource) where.resource = { contains: resource, mode: 'insensitive' }
      if (category) where.category = category
      if (severity) where.severity = severity
      if (outcome) where.outcome = outcome
      if (ipAddress) where.ipAddress = ipAddress
      if (startDate || endDate) {
        where.timestamp = {}
        if (startDate) where.timestamp.gte = startDate
        if (endDate) where.timestamp.lte = endDate
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.auditLog.count({ where })
      ])

      const mappedLogs: AuditLogEntry[] = logs?.filter(Boolean)?.map((log: any: any) => ({
        id: log.id,
        userId: log.userId || undefined,
        userEmail: log.userEmail || undefined,
        action: log.action,
        resource: log.resource || undefined,
        details: log.details ? JSON.parse(log.details as string) : undefined,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        timestamp: log.timestamp,
        severity: log.severity as any,
        category: log.category as any,
        outcome: log.outcome as any,
        metadata: log.metadata ? JSON.parse(log.metadata as string) : undefined
      }))

      return {
        logs: mappedLogs,
        total,
        hasMore: offset + limit < total
      }
    } catch (error) {
      console.error('Failed to query audit logs:', error)
      throw new Error(`Audit query failed: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
  }

  /**
   * Get audit statistics
   */
  async getStatistics(timeRange?: { start: Date; end: Date }): Promise<AuditStatistics> {
    try {
      const where: any = {}
      if (timeRange) {
        where.timestamp = {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }

      const [
        totalEntries,
        entriesByCategory,
        entriesBySeverity,
        entriesByOutcome,
        topUsersData,
        topActionsData,
        topResourcesData,
        recentActivityData
      ] = await Promise.all([
        // Total entries
        prisma.auditLog.count({ where }),
        
        // Entries by category
        prisma.auditLog.groupBy({
          by: ['category'],
          where,
          _count: { category: true }
        }),
        
        // Entries by severity
        prisma.auditLog.groupBy({
          by: ['severity'],
          where,
          _count: { severity: true }
        }),
        
        // Entries by outcome
        prisma.auditLog.groupBy({
          by: ['outcome'],
          where,
          _count: { outcome: true }
        }),
        
        // Top users
        prisma.auditLog.groupBy({
          by: ['userId'],
          where: { ...where, userId: { not: null } },
          _count: { userId: true },
          orderBy: { _count: { userId: 'desc' } },
          take: 10
        }),
        
        // Top actions
        prisma.auditLog.groupBy({
          by: ['action'],
          where,
          _count: { action: true },
          orderBy: { _count: { action: 'desc' } },
          take: 10
        }),
        
        // Top resources
        prisma.auditLog.groupBy({
          by: ['resource'],
          where,
          _count: { resource: true },
          orderBy: { _count: { resource: 'desc' } },
          take: 10
        }),
        
        // Recent activity
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: 20
        })
      ])

      return {
        totalEntries,
        entriesByCategory: entriesByCategory.reduce((acc: any, item: any: any) => {
          acc[item.category] = item._count.category
          return acc
        }, {} as Record<string, number>),
        entriesBySeverity: entriesBySeverity.reduce((acc: any, item: any: any) => {
          acc[item.severity] = item._count.severity
          return acc
        }, {} as Record<string, number>),
        entriesByOutcome: entriesByOutcome.reduce((acc: any, item: any: any) => {
          acc[item.outcome] = item._count.outcome
          return acc
        }, {} as Record<string, number>),
        topUsers: topUsersData?.filter(Boolean)?.map((item: any: any) => ({
          userId: item.userId!,
          userEmail: item.userEmail || 'Unknown',
          count: item._count.userId
        })),
        topActions: topActionsData?.filter(Boolean)?.map((item: any: any) => ({
          action: item.action,
          count: item._count.action
        })),
        topResources: topResourcesData?.filter(Boolean)?.map((item: any: any) => ({
          resource: item.resource || 'unknown',
          count: item._count.resource
        })),
        recentActivity: recentActivityData?.filter(Boolean)?.map((log: any: any) => ({
          id: log.id,
          userId: log.userId || undefined,
          userEmail: log.userEmail || undefined,
          action: log.action,
          resource: log.resource || 'unknown',
          details: log.details ? (typeof log.details === 'string' ? JSON.parse(log.details) : log.details) : undefined,
          ipAddress: log.ipAddress || undefined,
          userAgent: log.userAgent || undefined,
          timestamp: log.timestamp,
          severity: log.severity as any,
          category: log.category as any,
          outcome: log.outcome as any,
          metadata: log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : undefined
        }))
      }
    } catch (error) {
      console.error('Failed to get audit statistics:', error)
      throw new Error(`Statistics query failed: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs(query: AuditQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const { logs } = await this.queryLogs({ ...query, limit: 10000 })
      
      if (format === 'csv') {
        return this.convertToCSV(logs)
      }
      
      return JSON.stringify(logs, null, 2)
    } catch (error) {
      console.error('Failed to export audit logs:', error)
      throw new Error(`Export failed: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
  }

  /**
   * Delete old audit logs
   */
  async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const result = await prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          },
          severity: {
            not: 'critical' // Keep critical logs longer
          }
        }
      })

      return result.count
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error)
      throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId: string, timeRange?: { start: Date; end: Date }): Promise<{
    totalActions: number
    actionsByCategory: Record<string, number>
    recentActions: AuditLogEntry[]
    riskScore: number
  }> {
    try {
      const where: any = { userId }
      if (timeRange) {
        where.timestamp = {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }

      const [totalActions, actionsByCategory, recentActions] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.groupBy({
          by: ['category'],
          where,
          _count: { category: true }
        }),
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: 10
        })
      ])

      // Calculate risk score based on actions
      const riskScore = this.calculateUserRiskScore(recentActions?.filter(Boolean)?.map((log: any: any) => ({
        action: log.action,
        severity: log.severity as any,
        outcome: log.outcome as any
      })))

      return {
        totalActions,
        actionsByCategory: actionsByCategory.reduce((acc: any, item: any: any) => {
          acc[item.category] = item._count.category
          return acc
        }, {} as Record<string, number>),
        recentActions: recentActions?.filter(Boolean)?.map((log: any: any) => ({
          id: log.id,
          userId: log.userId || undefined,
          userEmail: log.userEmail || undefined,
          action: log.action,
          resource: log.resource || 'unknown',
          details: log.details ? (typeof log.details === 'string' ? JSON.parse(log.details) : log.details) : undefined,
          ipAddress: log.ipAddress || undefined,
          userAgent: log.userAgent || undefined,
          timestamp: log.timestamp,
          severity: log.severity as any,
          category: log.category as any,
          outcome: log.outcome as any,
          metadata: log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : undefined
        })),
        riskScore
      }
    } catch (error) {
      console.error('Failed to get user activity summary:', error)
      throw new Error(`User activity query failed: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
  }

  // Private helper methods
  private async enrichAuditEntry(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const enriched = { ...entry }
    
    // Add timestamp if not provided
    if (!enriched.timestamp) {
      enriched.timestamp = new Date()
    }

    // Add session metadata if available
    if (!enriched.metadata) {
      enriched.metadata = {}
    }

    // Add environment information
    enriched.metadata.environment = process.env.NODE_ENV || 'development'
    enriched.metadata.version = process.env.APP_VERSION || '1.0.0'

    return enriched
  }

  private isSensitiveAction(action: string): boolean {
    return this.sensitiveActions.includes(action.toLowerCase())
  }

  private async handleSensitiveAuditEvent(auditLog: any): Promise<void> {
    // In a real implementation, you might:
    // - Send alerts to security team
    // - Trigger additional monitoring
    // - Create security incidents
    // - Send notifications
    
    console.log(`Sensitive audit event detected: ${auditLog.action} by ${auditLog.userEmail || auditLog.userId}`)
    
    // Example: Create a security alert
    try {
      // Model doesn't exist, so we'll just log for now
      console.log('Would create security alert:', {
        type: 'security',
        severity: auditLog.severity,
        message: `Sensitive action detected: ${auditLog.action}`,
        details: JSON.stringify({
          auditLogId: auditLog.id,
          userId: auditLog.userId,
          action: auditLog.action,
          resource: auditLog.resource
        }),
        resolved: false
      })
    } catch (error) {
      console.error('Failed to create security alert:', error)
    }
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) return ''

    const headers = [
      'ID', 'Timestamp', 'User ID', 'User Email', 'Action', 'Resource', 
      'Resource ID', 'Category', 'Severity', 'Outcome', 'IP Address', 'User Agent'
    ]

    const rows = logs?.filter(Boolean)?.map((log: any) => [
      log.id || '',
      log.timestamp?.toISOString() || '',
      log.userId || '',
      log.userEmail || '',
      log.action,
      log.resource,
      log.resourceId || '',
      log.category,
      log.severity,
      log.outcome,
      log.ipAddress || '',
      log.userAgent || ''
    ])

    return [headers, ...rows]
      ?.filter(Boolean)?.map((row: any) => row?.filter(Boolean)?.map((cell: any) => `"${cell}"`).join(','))
      .join('\n')
  }

  private calculateUserRiskScore(actions: Array<{
    action: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    outcome: 'success' | 'failure' | 'error'
  }>): number {
    let score = 0
    
    for (const action of actions) {
      // Base score by severity
      switch (action.severity) {
        case 'low': score += 1; break
        case 'medium': score += 3; break
        case 'high': score += 7; break
        case 'critical': score += 15; break
      }

      // Additional score for failures
      if (action.outcome === 'failure' || action.outcome === 'error') {
        score += 5
      }

      // Additional score for sensitive actions
      if (this.isSensitiveAction(action.action)) {
        score += 10
      }
    }

    // Normalize to 0-100 scale
    return Math.min(100, Math.round((score / actions.length) * 2))
  }
}

// Singleton instance
let auditService: AuditService | null = null

export function getAuditService(): AuditService {
  if (!auditService) {
    auditService = new AuditService()
  }
  return auditService
}

export { AuditService }
export type { AuditLogEntry, AuditQuery, AuditStatistics }