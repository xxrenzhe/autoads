import { permissionManager, Permission, PolicyCondition, SecurityContext } from './permission-manager'
import { prisma } from '@/lib/prisma'

export interface PolicyRule {
  id: string
  name: string
  description: string
  resource: string
  action: string
  effect: 'allow' | 'deny'
  conditions: PolicyCondition[]
  priority: number
  status?: string
  isActive?: boolean
}

export interface PolicyEvaluationResult {
  allowed: boolean
  reason: string
  appliedRules: string[]
  securityLevel: 'low' | 'medium' | 'high' | 'critical'
}

export class PolicyEngine {
  /**
   * Evaluate access request against all applicable policies
   */
  async evaluate(
    userId: string,
    resource: string,
    action: string,
    context?: SecurityContext
  ): Promise<PolicyEvaluationResult> {
    try {
      // Get user information
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          status: true,
          lastLoginAt: true
        }
      })

      if (!user) {
        return {
          allowed: false,
          reason: 'User not found',
          appliedRules: [],
          securityLevel: 'critical'
        }
      }

      // Check if user is active
      if (user.status !== 'ACTIVE') {
        await this.logSecurityEvent(userId, 'access_denied_inactive_user', context)
        return {
          allowed: false,
          reason: 'User account is not active',
          appliedRules: ['user_status_check'],
          securityLevel: 'high'
        }
      }

      // Get applicable policies
      const policies = await this.getApplicablePolicies(user.role, resource, action)
      
      // Evaluate policies in priority order
      const appliedRules: string[] = []
      let finalDecision = false
      let reason = 'No applicable policies found'
      let securityLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

      // First check basic RBAC permissions
      const hasBasicPermission = await permissionManager.hasPermission(userId, resource, action, context)
      
      if (!hasBasicPermission) {
        return {
          allowed: false,
          reason: 'Insufficient role-based permissions',
          appliedRules: ['rbac_check'],
          securityLevel: 'medium'
        }
      }

      // Evaluate additional security policies
      for (const policy of policies) {
        const policyResult = await this.evaluatePolicy(policy, user, context)
        
        if (policyResult.applies) {
          appliedRules.push(policy.name)
          
          if (policy.effect === 'deny') {
            finalDecision = false
            reason = `Access denied by policy: ${policy.name}`
            securityLevel = 'high'
            break
          } else if (policy.effect === 'allow') {
            finalDecision = true
            reason = `Access granted by policy: ${policy.name}`
          }
        }
      }

      // Apply additional security checks
      const securityChecks = await this.performSecurityChecks(userId, context)
      
      if (!securityChecks.passed) {
        await this.logSecurityEvent(userId, 'security_check_failed', context, {
          failedChecks: securityChecks.failedChecks
        })
        
        return {
          allowed: false,
          reason: `Security check failed: ${securityChecks.reason}`,
          appliedRules: [...appliedRules, ...securityChecks.failedChecks],
          securityLevel: 'critical'
        }
      }

      // Log successful access
      if (finalDecision) {
        await this.logSecurityEvent(userId, 'access_granted', context, {
          resource,
          action,
          appliedRules
        })
      }

      return {
        allowed: finalDecision,
        reason,
        appliedRules,
        securityLevel
      }
    } catch (error) {
      console.error('Policy evaluation error:', error)
      
      await this.logSecurityEvent(userId, 'policy_evaluation_error', context, {
        error: error instanceof Error ? error.message : "Unknown error" as any
      })

      return {
        allowed: false,
        reason: 'Policy evaluation failed',
        appliedRules: ['error_handler'],
        securityLevel: 'critical'
      }
    }
  }

  /**
   * Get policies applicable to the request
   */
  private async getApplicablePolicies(
    userRole: string,
    resource: string,
    action: string
  ): Promise<PolicyRule[]> {
    // In a real implementation, these would be stored in the database
    // For now, we'll define them programmatically
    const policies: PolicyRule[] = [
      {
        id: 'admin_time_restriction',
        name: 'Admin Time Restriction',
        description: 'Restrict admin actions to business hours',
        resource: '*',
        action: '*',
        effect: 'deny',
        conditions: [
          { field: 'userRole', operator: 'equals', value: 'ADMIN' },
          { field: 'hour', operator: 'not_in', value: [9, 10, 11, 12, 13, 14, 15, 16, 17] }
        ],
        priority: 100,
        status: 'INACTIVE' // Disabled by default
      },
      {
        id: 'suspicious_ip_block',
        name: 'Suspicious IP Block',
        description: 'Block access from suspicious IP addresses',
        resource: '*',
        action: '*',
        effect: 'deny',
        conditions: [
          { field: 'ipAddress', operator: 'in', value: [] } // Would be populated with suspicious IPs
        ],
        priority: 200,
        status: 'ACTIVE'
      },
      {
        id: 'rate_limit_protection',
        name: 'Rate Limit Protection',
        description: 'Prevent excessive API calls',
        resource: 'api',
        action: '*',
        effect: 'deny',
        conditions: [
          { field: 'requestCount', operator: 'greater_than', value: 100 }
        ],
        priority: 150,
        status: 'ACTIVE'
      }
    ]

    return policies.filter((policy: any) => 
      (policy.isActive !== false) && 
      (policy.resource === '*' || policy.resource === resource) &&
      (policy.action === '*' || policy.action === action)
    ).sort((a, b) => b.priority - a.priority)
  }

  /**
   * Evaluate a single policy
   */
  private async evaluatePolicy(
    policy: PolicyRule,
    user: any,
    context?: SecurityContext
  ): Promise<{ applies: boolean; reason?: string }> {
    if (!policy.conditions || policy.conditions.length === 0) {
      return { applies: true }
    }

    const evaluationContext = {
      ...context,
      userId: user.id,
      userRole: user.role,
      userStatus: user.status,
      hour: new Date().getHours(),
      requestCount: await this.getRecentRequestCount(user.id)
    }

    const conditionResults = policy.conditions?.filter(Boolean)?.map((condition: any) => {
      const contextValue = evaluationContext[condition.field as keyof typeof evaluationContext]
      return this.evaluateCondition(condition, contextValue)
    })

    const applies = conditionResults.every(result => result)

    return {
      applies,
      reason: applies ? `Policy ${policy.name} conditions met` : `Policy ${policy.name} conditions not met`
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PolicyCondition, contextValue: any): boolean {
    const { operator, value } = condition

    switch (operator) {
      case 'equals':
        return contextValue === value
      case 'not_equals':
        return contextValue !== value
      case 'contains':
        return Array.isArray(contextValue) ? contextValue.includes(value) : 
               typeof contextValue === 'string' ? contextValue.includes(value) : false
      case 'not_contains':
        return Array.isArray(contextValue) ? !contextValue.includes(value) : 
               typeof contextValue === 'string' ? !contextValue.includes(value) : true
      case 'greater_than':
        return Number(contextValue) > Number(value)
      case 'less_than':
        return Number(contextValue) < Number(value)
      case 'in':
        return Array.isArray(value) ? value.includes(contextValue) : false
      case 'not_in':
        return Array.isArray(value) ? !value.includes(contextValue) : true
      default:
        return false
    }
  }

  /**
   * Perform additional security checks
   */
  private async performSecurityChecks(
    userId: string,
    context?: SecurityContext
  ): Promise<{ passed: boolean; reason?: string; failedChecks: string[] }> {
    const failedChecks: string[] = []

    // Check for suspicious activity patterns
    if (context?.ipAddress) {
      const suspiciousActivity = await this.checkSuspiciousActivity(userId, context.ipAddress)
      if (suspiciousActivity) {
        failedChecks.push('suspicious_activity_detected')
      }
    }

    // Check session validity
    if (context?.sessionId) {
      const validSession = await this.validateSession(userId, context.sessionId)
      if (!validSession) {
        failedChecks.push('invalid_session')
      }
    }

    // Check for concurrent sessions
    const concurrentSessions = await this.checkConcurrentSessions(userId)
    if (concurrentSessions > 5) { // Allow max 5 concurrent sessions
      failedChecks.push('too_many_concurrent_sessions')
    }

    return {
      passed: failedChecks.length === 0,
      reason: failedChecks.length > 0 ? `Failed checks: ${failedChecks.join(', ')}` : undefined,
      failedChecks
    }
  }

  /**
   * Check for suspicious activity
   */
  private async checkSuspiciousActivity(userId: string, ipAddress: string): Promise<boolean> {
    // Check for rapid requests from the same IP
    const recentRequests = await prisma.securityEvent.count({
      where: {
        userId,
        ipAddress,
        timestamp: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      }
    })

    return recentRequests > 50 // More than 50 requests in 5 minutes
  }

  /**
   * Validate session
   */
  private async validateSession(userId: string, sessionId: string): Promise<boolean> {
    const session = await prisma.session.findFirst({
      where: {
        userId,
        sessionToken: sessionId,
        expires: {
          gt: new Date()
        }
      }
    })

    return !!session
  }

  /**
   * Check concurrent sessions
   */
  private async checkConcurrentSessions(userId: string): Promise<number> {
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
   * Get recent request count
   */
  private async getRecentRequestCount(userId: string): Promise<number> {
    return await prisma.securityEvent.count({
      where: {
        userId,
        timestamp: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    })
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    userId: string,
    eventType: string,
    context?: SecurityContext,
    metadata?: any
  ): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          userId,
          eventType,
          severity: this.getEventSeverity(eventType),
          description: this.getEventDescription(eventType),
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          metadata: {
            ...metadata,
            sessionId: context?.sessionId,
            timestamp: context?.timestamp || new Date()
          }
        }
      })
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  /**
   * Get event severity
   */
  private getEventSeverity(eventType: string): string {
    const severityMap: Record<string, string> = {
      'access_granted': 'low',
      'access_denied_inactive_user': 'medium',
      'security_check_failed': 'high',
      'policy_evaluation_error': 'critical',
      'suspicious_activity_detected': 'high'
    }

    return severityMap[eventType] || 'medium'
  }

  /**
   * Get event description
   */
  private getEventDescription(eventType: string): string {
    const descriptionMap: Record<string, string> = {
      'access_granted': 'Access granted after policy evaluation',
      'access_denied_inactive_user': 'Access denied - user account inactive',
      'security_check_failed': 'Access denied - security check failed',
      'policy_evaluation_error': 'Policy evaluation encountered an error',
      'suspicious_activity_detected': 'Suspicious activity pattern detected'
    }

    return descriptionMap[eventType] || 'Security event occurred'
  }
}

export const policyEngine = new PolicyEngine()