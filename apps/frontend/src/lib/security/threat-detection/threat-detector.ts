import { prisma } from '@/lib/prisma'
import redis from '@/lib/redis'
import { auditLogger } from '../audit/audit-logger'

export interface ThreatPattern {
  id: string
  name: string
  description: string
  type: 'brute_force' | 'suspicious_activity' | 'data_exfiltration' | 'privilege_escalation' | 'anomaly'
  severity: 'low' | 'medium' | 'high' | 'critical'
  conditions: ThreatCondition[]
  actions: ThreatAction[]
  isActive: boolean
}

export interface ThreatCondition {
  metric: string
  operator: 'greater_than' | 'less_than' | 'equals' | 'contains' | 'pattern_match'
  value: any
  timeWindow?: number // in seconds
}

export interface ThreatAction {
  type: 'block_ip' | 'suspend_user' | 'alert_admin' | 'log_event' | 'require_mfa'
  parameters?: any
}

export interface ThreatAlert {
  id: string
  patternId: string
  patternName: string
  severity: string
  userId?: string
  ipAddress?: string
  description: string
  evidence: any
  status: 'active' | 'investigating' | 'resolved' | 'false_positive'
  detectedAt: Date
  resolvedAt?: Date
  resolvedBy?: string
  actions: string[]
}

export interface ThreatMetrics {
  activeThreats: number
  resolvedThreats: number
  blockedIPs: number
  suspendedUsers: number
  threatsByType: Record<string, number>
  threatsBySeverity: Record<string, number>
}

export class ThreatDetector {
  private static readonly CACHE_PREFIX = 'threat:'
  private static readonly METRICS_PREFIX = 'metrics:'
  private static readonly BLOCKED_IP_PREFIX = 'blocked:'

  private patterns: ThreatPattern[] = []
  private isRunning = false

  constructor() {
    this.initializePatterns()
  }

  /**
   * Start threat detection
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    this.isRunning = true
    console.log('Threat detection system started')

    // Start monitoring loop
    this.startMonitoring()
  }

  /**
   * Stop threat detection
   */
  async stop(): Promise<void> {
    this.isRunning = false
    console.log('Threat detection system stopped')
  }

  /**
   * Analyze potential threat
   */
  async analyzeThreat(
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    action?: string,
    metadata?: any
  ): Promise<ThreatAlert[]> {
    const threats: ThreatAlert[] = []

    for (const pattern of this.patterns) {
      if (!pattern.isActive) continue

      const isMatch = await this.evaluatePattern(pattern, {
        userId,
        ipAddress,
        userAgent,
        action,
        metadata
      })

      if (isMatch.matches) {
        const threat = await this.createThreatAlert(pattern, {
          userId,
          ipAddress,
          userAgent,
          action,
          evidence: isMatch.evidence
        })

        threats.push(threat)
        await this.executeThreatActions(pattern, threat)
      }
    }

    return threats
  }

  /**
   * Get active threats
   */
  async getActiveThreats(limit: number = 50): Promise<ThreatAlert[]> {
    const threats = await prisma.securityThreat.findMany({
      where: { status: 'active' },
      orderBy: { detectedAt: 'desc' },
      take: limit
    })

    return threats.map(((threat: any) => ({
      id: threat.id,
      patternId: threat.type, // Using type as pattern ID for now
      patternName: threat.type,
      severity: threat.severity,
      userId: threat.userId || undefined,
      ipAddress: threat.ipAddress || undefined,
      description: threat.description,
      evidence: threat.metadata,
      status: threat.status as any,
      detectedAt: threat.detectedAt,
      resolvedAt: threat.resolvedAt || undefined,
      actions: [] // Would need to track actions separately
    }))
  }

  /**
   * Resolve threat
   */
  async resolveThreat(
    threatId: string,
    resolution: 'resolved' | 'false_positive',
    resolvedBy: string,
    notes?: string
  ): Promise<void> {
    await prisma.securityThreat.update({
      where: { id: threatId },
      data: {
        status: resolution === 'resolved' ? 'resolved' : 'resolved',
        resolvedAt: new Date(),
        metadata: {
          resolution,
          resolvedBy,
          notes
        }
      }
    })

    await auditLogger.logSecurity(
      'threat_resolved',
      'success',
      { threatId, resolution, notes },
      resolvedBy
    )
  }

  /**
   * Get threat metrics
   */
  async getThreatMetrics(): Promise<ThreatMetrics> {
    const [
      activeThreats,
      resolvedThreats,
      threatsByType,
      threatsBySeverity
    ] = await Promise.all([
      prisma.securityThreat.count({ where: { status: 'active' } }),
      prisma.securityThreat.count({ where: { status: 'resolved' } }),
      prisma.securityThreat.groupBy({
        by: ['type'],
        _count: true,
        where: {
          detectedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      prisma.securityThreat.groupBy({
        by: ['severity'],
        _count: true,
        where: {
          detectedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ])

    // Count blocked IPs and suspended users
    const blockedIPKeys = await redis.keys(`${ThreatDetector.BLOCKED_IP_PREFIX}*`)
    const suspendedUsers = await prisma.user.count({
      where: { status: 'SUSPENDED' }
    })

    return {
      activeThreats,
      resolvedThreats,
      blockedIPs: blockedIPKeys.length,
      suspendedUsers,
      threatsByType: Object.fromEntries(
        threatsByType.map(((item: any) => [item.type, item._count])
      ),
      threatsBySeverity: Object.fromEntries(
        threatsBySeverity.map(((item: any) => [item.severity, item._count])
      )
    }
  }

  /**
   * Block IP address
   */
  async blockIP(
    ipAddress: string,
    reason: string,
    duration: number = 24 * 60 * 60 // 24 hours
  ): Promise<void> {
    await redis.setex(
      `${ThreatDetector.BLOCKED_IP_PREFIX}${ipAddress}`,
      duration,
      JSON.stringify({
        reason,
        blockedAt: new Date().toISOString(),
        duration
      })
    )

    await auditLogger.logSecurity(
      'ip_blocked',
      'success',
      { ipAddress, reason, duration }
    )
  }

  /**
   * Check if IP is blocked
   */
  async isIPBlocked(ipAddress: string): Promise<boolean> {
    const blocked = await redis.get(`${ThreatDetector.BLOCKED_IP_PREFIX}${ipAddress}`)
    return !!blocked
  }

  /**
   * Suspend user
   */
  async suspendUser(userId: string, reason: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' }
    })

    await auditLogger.logSecurity(
      'user_suspended',
      'success',
      { userId, reason },
      'system'
    )
  }

  /**
   * Private methods
   */
  private initializePatterns(): void {
    this.patterns = [
      {
        id: 'brute_force_login',
        name: 'Brute Force Login Attempts',
        description: 'Detect multiple failed login attempts from same IP',
        type: 'brute_force',
        severity: 'high',
        conditions: [
          {
            metric: 'failed_logins',
            operator: 'greater_than',
            value: 5,
            timeWindow: 300 // 5 minutes
          }
        ],
        actions: [
          { type: 'block_ip', parameters: { duration: 3600 } },
          { type: 'alert_admin' },
          { type: 'log_event' }
        ],
        isActive: true
      },
      {
        id: 'suspicious_api_usage',
        name: 'Suspicious API Usage',
        description: 'Detect unusual API usage patterns',
        type: 'suspicious_activity',
        severity: 'medium',
        conditions: [
          {
            metric: 'api_requests',
            operator: 'greater_than',
            value: 100,
            timeWindow: 60 // 1 minute
          }
        ],
        actions: [
          { type: 'alert_admin' },
          { type: 'log_event' }
        ],
        isActive: true
      },
      {
        id: 'privilege_escalation',
        name: 'Privilege Escalation Attempt',
        description: 'Detect attempts to access admin resources without permission',
        type: 'privilege_escalation',
        severity: 'critical',
        conditions: [
          {
            metric: 'unauthorized_admin_access',
            operator: 'greater_than',
            value: 1,
            timeWindow: 300
          }
        ],
        actions: [
          { type: 'suspend_user' },
          { type: 'block_ip' },
          { type: 'alert_admin' },
          { type: 'log_event' }
        ],
        isActive: true
      },
      {
        id: 'data_exfiltration',
        name: 'Data Exfiltration Attempt',
        description: 'Detect unusual data access patterns',
        type: 'data_exfiltration',
        severity: 'critical',
        conditions: [
          {
            metric: 'data_access_volume',
            operator: 'greater_than',
            value: 1000,
            timeWindow: 3600 // 1 hour
          }
        ],
        actions: [
          { type: 'suspend_user' },
          { type: 'alert_admin' },
          { type: 'log_event' }
        ],
        isActive: true
      }
    ]
  }

  private async startMonitoring(): Promise<void> {
    // This would run continuously to monitor for threats
    // For now, we'll just set up the framework
    console.log('Threat monitoring started with', this.patterns.length, 'patterns')
  }

  private async evaluatePattern(
    pattern: ThreatPattern,
    context: any
  ): Promise<{ matches: boolean; evidence?: any }> {
    const evidence: any = {}
    let matches = true

    for (const condition of pattern.conditions) {
      const conditionResult = await this.evaluateCondition(condition, context)
      evidence[condition.metric] = conditionResult.value

      if (!conditionResult.matches) {
        matches = false
        break
      }
    }

    return { matches, evidence }
  }

  private async evaluateCondition(
    condition: ThreatCondition,
    context: any
  ): Promise<{ matches: boolean; value: any }> {
    let value: any

    switch (condition.metric) {
      case 'failed_logins':
        value = await this.getFailedLoginCount(context.ipAddress, condition.timeWindow)
        break
      case 'api_requests':
        value = await this.getAPIRequestCount(context.userId, condition.timeWindow)
        break
      case 'unauthorized_admin_access':
        value = await this.getUnauthorizedAccessCount(context.userId, condition.timeWindow)
        break
      case 'data_access_volume':
        value = await this.getDataAccessVolume(context.userId, condition.timeWindow)
        break
      default:
        value = 0
    }

    const matches = this.compareValues(value, condition.operator, condition.value)

    return { matches, value }
  }

  private async getFailedLoginCount(ipAddress?: string, timeWindow?: number): Promise<number> {
    if (!ipAddress || !timeWindow) return 0

    const since = new Date(Date.now() - timeWindow * 1000)
    
    return await prisma.securityEvent.count({
      where: {
        eventType: 'failed_login',
        ipAddress,
        timestamp: { gte: since }
      }
    })
  }

  private async getAPIRequestCount(userId?: string, timeWindow?: number): Promise<number> {
    if (!userId || !timeWindow) return 0

    const since = new Date(Date.now() - timeWindow * 1000)
    
    return await prisma.apiUsage.count({
      where: {
        userId,
        timestamp: { gte: since }
      }
    })
  }

  private async getUnauthorizedAccessCount(userId?: string, timeWindow?: number): Promise<number> {
    if (!userId || !timeWindow) return 0

    const since = new Date(Date.now() - timeWindow * 1000)
    
    return await prisma.securityEvent.count({
      where: {
        userId,
        eventType: 'unauthorized_access',
        timestamp: { gte: since }
      }
    })
  }

  private async getDataAccessVolume(userId?: string, timeWindow?: number): Promise<number> {
    if (!userId || !timeWindow) return 0

    const since = new Date(Date.now() - timeWindow * 1000)
    
    const result = await prisma.userActivity.count({
      where: {
        userId,
        action: { contains: 'data_access' },
        timestamp: { gte: since }
      }
    })

    return result
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'greater_than':
        return Number(actual) > Number(expected)
      case 'less_than':
        return Number(actual) < Number(expected)
      case 'equals':
        return actual === expected
      case 'contains':
        return String(actual).includes(String(expected))
      case 'pattern_match':
        return new RegExp(expected).test(String(actual))
      default:
        return false
    }
  }

  private async createThreatAlert(
    pattern: ThreatPattern,
    context: any
  ): Promise<ThreatAlert> {
    const threat = await prisma.securityThreat.create({
      data: {
        type: pattern.type,
        severity: pattern.severity,
        status: 'active',
        description: `${pattern.name}: ${pattern.description}`,
        ipAddress: context.ipAddress,
        userId: context.userId,
        metadata: {
          patternId: pattern.id,
          evidence: context.evidence,
          context
        }
      }
    })

    return {
      id: threat.id,
      patternId: pattern.id,
      patternName: pattern.name,
      severity: pattern.severity,
      userId: context.userId,
      ipAddress: context.ipAddress,
      description: threat.description,
      evidence: context.evidence,
      status: 'active',
      detectedAt: threat.detectedAt,
      actions: pattern.actions?.filter(Boolean)?.map((a: any) => a.type)
    }
  }

  private async executeThreatActions(
    pattern: ThreatPattern,
    threat: ThreatAlert
  ): Promise<void> {
    for (const action of pattern.actions) {
      try {
        await this.executeAction(action, threat)
      } catch (error) {
        console.error(`Failed to execute threat action ${action.type}:`, error)
      }
    }
  }

  private async executeAction(action: ThreatAction, threat: ThreatAlert): Promise<void> {
    switch (action.type) {
      case 'block_ip':
        if (threat.ipAddress) {
          const duration = action.parameters?.duration || 3600
          await this.blockIP(threat.ipAddress, `Threat detected: ${threat.patternName}`, duration)
        }
        break

      case 'suspend_user':
        if (threat.userId) {
          await this.suspendUser(threat.userId, `Threat detected: ${threat.patternName}`)
        }
        break

      case 'alert_admin':
        await this.alertAdmin(threat)
        break

      case 'log_event':
        await auditLogger.logSecurity(
          'threat_detected',
          'success',
          {
            threatId: threat.id,
            patternName: threat.patternName,
            severity: threat.severity,
            evidence: threat.evidence
          },
          threat.userId,
          threat.ipAddress
        )
        break

      case 'require_mfa':
        // Would implement MFA requirement logic
        break
    }
  }

  private async alertAdmin(threat: ThreatAlert): Promise<void> {
    // This would send alerts to administrators
    // For now, just log it
    console.warn(`THREAT ALERT: ${threat.patternName} - ${threat.description}`)
    
    await auditLogger.log({
      action: 'admin_alert_sent',
      category: 'security',
      severity: 'high',
      outcome: 'success',
      details: {
        threatId: threat.id,
        patternName: threat.patternName,
        severity: threat.severity
      }
    })
  }
}

export const threatDetector = new ThreatDetector()