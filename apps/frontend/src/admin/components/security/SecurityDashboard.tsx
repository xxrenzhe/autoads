'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { 
  Shield, 
  AlertTriangle, 
  Users, 
  Activity,
  Lock,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download
} from 'lucide-react'
import { toast } from 'sonner'

interface ThreatAlert {
  id: string
  patternId: string
  patternName: string
  severity: string
  userId?: string
  ipAddress?: string
  description: string
  evidence: any
  status: string
  detectedAt: string
  actions: string[]
}

interface ThreatMetrics {
  activeThreats: number
  resolvedThreats: number
  blockedIPs: number
  suspendedUsers: number
  threatsByType: Record<string, number>
  threatsBySeverity: Record<string, number>
}

interface SecurityMetrics {
  activeSessions: number
  suspiciousActivity: number
  failedLogins: number
  blockedIPs: number
}

interface AuditEvent {
  id: string
  userId?: string
  userEmail?: string
  action: string
  resource?: string
  category: string
  severity: string
  outcome: string
  ipAddress?: string
  timestamp: string
  details?: any
}

export default function SecurityDashboard() {
  const [threats, setThreats] = useState<ThreatAlert[]>([])
  const [threatMetrics, setThreatMetrics] = useState<ThreatMetrics | null>(null)
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchSecurityData()
  }, [])

  const fetchSecurityData = async () => {
    try {
      setLoading(true)
      
      const [threatsRes, sessionsRes, auditRes] = await Promise.all([
        fetch('/ops/api/v1/console/security/threats'),
        fetch('/ops/api/v1/console/security/sessions'),
        fetch('/ops/api/v1/console/security/audit?limit=50')
      ])

      const [threatsData, sessionsData, auditData] = await Promise.all([
        threatsRes.json(),
        sessionsRes.json(),
        auditRes.json()
      ])

      if (threatsData.success) {
        setThreats(threatsData.data.threats)
        setThreatMetrics(threatsData.data.metrics)
      }

      if (sessionsData.success) {
        setSecurityMetrics(sessionsData.data.metrics)
      }

      if (auditData.success) {
        setAuditEvents(auditData.data.events)
      }
    } catch (error) {
      console.error('Error fetching security data:', error)
      toast.error('Failed to fetch security data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await fetchSecurityData()
  }

  const resolveThreat = async (threatId: string, resolution: 'resolved' | 'false_positive') => {
    try {
      const response = await fetch('/ops/api/v1/console/security/threats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve_threat',
          threatId,
          resolution
        })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success('Threat resolved successfully')
        await fetchSecurityData()
      } else {
        toast.error(data.error || 'Failed to resolve threat')
      }
    } catch (error) {
      console.error('Error resolving threat:', error)
      toast.error('Failed to resolve threat')
    }
  }

  const blockIP = async (ipAddress: string, reason: string) => {
    try {
      const response = await fetch('/ops/api/v1/console/security/threats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'block_ip',
          ipAddress,
          reason
        })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success('IP address blocked successfully')
        await fetchSecurityData()
      } else {
        toast.error(data.error || 'Failed to block IP address')
      }
    } catch (error) {
      console.error('Error blocking IP:', error)
      toast.error('Failed to block IP address')
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'outline'
    }
  }

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failure': return <XCircle className="h-4 w-4 text-red-500" />
      case 'error': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default: return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor security threats, audit logs, and system security
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {threatMetrics?.activeThreats || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {threatMetrics?.resolvedThreats || 0} resolved today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
            <Ban className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityMetrics?.blockedIPs || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              IP addresses blocked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityMetrics?.activeSessions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Current user sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <Lock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityMetrics?.failedLogins || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              In the last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {threats.some(t => t.severity === 'critical') && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Critical Security Alert:</strong> {threats.filter((t: any) => t.severity === 'critical').length} critical threats detected. Immediate attention required.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="threats" className="space-y-4">
        <TabsList>
          <TabsTrigger value="threats">
            <Shield className="h-4 w-4 mr-2" />
            Threats
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Eye className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <Activity className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Security Threats</CardTitle>
              <CardDescription>
                Security threats detected by the system requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {threats.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-green-600">No Active Threats</p>
                  <p className="text-muted-foreground">Your system is secure</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {threats.map((threat: any) => (
                    <div key={threat.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getSeverityColor(threat.severity) as any}>
                              {threat.severity.toUpperCase()}
                            </Badge>
                            <span className="font-medium">{threat.patternName}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {threat.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {threat.ipAddress && (
                              <span>IP: {threat.ipAddress}</span>
                            )}
                            {threat.userId && (
                              <span>User: {threat.userId}</span>
                            )}
                            <span>
                              Detected: {new Date(threat.detectedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {threat.ipAddress && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => blockIP(threat.ipAddress!, `Threat: ${threat.patternName}`)}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Block IP
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveThreat(threat.id, 'false_positive')}
                          >
                            False Positive
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => resolveThreat(threat.id, 'resolved')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>
                Audit log of security-related events and user activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditEvents.map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getOutcomeIcon(event.outcome)}
                      <div>
                        <p className="font-medium">{event.action}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {event.category}
                          </Badge>
                          <Badge variant={getSeverityColor(event.severity) as any} className="text-xs">
                            {event.severity}
                          </Badge>
                          {event.userEmail && <span>User: {event.userEmail}</span>}
                          {event.ipAddress && <span>IP: {event.ipAddress}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium capitalize">{event.outcome}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Threats by Type</CardTitle>
                <CardDescription>Distribution of threat types detected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {threatMetrics && Object.entries(threatMetrics.threatsByType).map(([type, count]: any) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Threats by Severity</CardTitle>
                <CardDescription>Severity distribution of detected threats</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {threatMetrics && Object.entries(threatMetrics.threatsBySeverity).map(([severity, count]: any) => (
                    <div key={severity} className="flex items-center justify-between">
                      <span className="capitalize">{severity}</span>
                      <Badge variant={getSeverityColor(severity) as any}>{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
