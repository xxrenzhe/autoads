'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Progress } from '../ui/progress'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Server,
  Database,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  RefreshCw,
  Bell,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { http } from '@/shared/http/client'

interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded'
  services: ServiceHealth[]
  summary: {
    healthy: number
    unhealthy: number
    degraded: number
    total: number
  }
  timestamp: string
}

interface ServiceHealth {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  checks: HealthCheck[]
  uptime: number
  lastCheck: string
}

interface HealthCheck {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown'
  responseTime: number
  message: string
  timestamp: string
  metadata?: any
}

interface Alert {
  id: string
  ruleId: string
  ruleName: string
  metric: string
  currentValue: number
  threshold: number
  severity: string
  status: string
  message: string
  triggeredAt: string
}

interface AlertMetrics {
  totalAlerts: number
  activeAlerts: number
  resolvedAlerts: number
  acknowledgedAlerts: number
  alertsBySeverity: Record<string, number>
  alertsByRule: Record<string, number>
  averageResolutionTime: number
}

export default function MonitoringDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [alertMetrics, setAlertMetrics] = useState<AlertMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchMonitoringData()
    
    // Set up auto-refresh
    const interval = setInterval(fetchMonitoringData, 30000) // 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchMonitoringData = async () => {
    try {
      setLoading(true)
      
      const [healthData, alertsData, metricsData] = await Promise.all([
        http.get('/admin/monitoring/health'),
        http.get('/admin/monitoring/alerts'),
        http.get('/admin/monitoring/alerts', { type: 'metrics' })
      ])

      if (healthData.success) {
        setSystemHealth(healthData.data)
      }

      if (alertsData.success) {
        setAlerts(alertsData.data.alerts)
      }

      if (metricsData.success) {
        setAlertMetrics(metricsData.data.metrics)
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error)
      toast.error('Failed to fetch monitoring data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await fetchMonitoringData()
  }

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const data: any = await http.post('/admin/monitoring/alerts', {
        type: 'action',
        action: 'acknowledge',
        alertId
      })
      
      if (data.success) {
        toast.success('Alert acknowledged')
        await fetchMonitoringData()
      } else {
        toast.error(data.error || 'Failed to acknowledge alert')
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      toast.error('Failed to acknowledge alert')
    }
  }

  const resolveAlert = async (alertId: string) => {
    try {
      const data: any = await http.post('/admin/monitoring/alerts', {
        type: 'action',
        action: 'resolve',
        alertId
      })
      
      if (data.success) {
        toast.success('Alert resolved')
        await fetchMonitoringData()
      } else {
        toast.error(data.error || 'Failed to resolve alert')
      }
    } catch (error) {
      console.error('Error resolving alert:', error)
      toast.error('Failed to resolve alert')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-500" />
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50'
      case 'unhealthy': return 'text-red-600 bg-red-50'
      case 'degraded': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 bg-gray-50'
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

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'database': return <Database className="h-5 w-5" />
      case 'redis': return <Server className="h-5 w-5" />
      case 'cpu': return <Cpu className="h-5 w-5" />
      case 'memory': return <MemoryStick className="h-5 w-5" />
      case 'filesystem': return <HardDrive className="h-5 w-5" />
      case 'external_apis': return <Wifi className="h-5 w-5" />
      default: return <Activity className="h-5 w-5" />
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
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor system health, performance, and alerts
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

      {/* System Status Overview */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
              {getStatusIcon(systemHealth.overall)}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold capitalize ${getStatusColor(systemHealth.overall)}`}>
                {systemHealth.overall}
              </div>
              <p className="text-xs text-muted-foreground">
                Last check: {new Date(systemHealth.timestamp).toLocaleTimeString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Healthy Services</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {systemHealth.summary.healthy}
              </div>
              <p className="text-xs text-muted-foreground">
                of {systemHealth.summary.total} services
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <Bell className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {alertMetrics?.activeAlerts || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {alertMetrics?.resolvedAlerts || 0} resolved today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {alertMetrics?.averageResolutionTime 
                  ? `${Math.round(alertMetrics.averageResolutionTime / 60)}m`
                  : 'N/A'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                average resolution time
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Critical Alerts */}
      {alerts.some(a => a.severity === 'critical') && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Critical System Alert:</strong> {alerts.filter((a: any) => a.severity === 'critical').length} critical alerts require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">
            <Activity className="h-4 w-4 mr-2" />
            System Health
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="h-4 w-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Server className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          {systemHealth && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {systemHealth.services.map((service: any) => (
                <Card key={service.service}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getServiceIcon(service.service)}
                      <span className="capitalize">{service.service.replace('_', ' ')}</span>
                      <Badge variant={service.status === 'healthy' ? 'default' : 'destructive'}>
                        {service.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Uptime: {service.uptime.toFixed(2)}% • Last check: {new Date(service.lastCheck).toLocaleTimeString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {service.checks.map((check, index: any) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(check.status)}
                            <span className="text-sm font-medium">{check.name.replace('_', ' ')}</span>
                          </div>
                          <div className="text-right">
                            {check.responseTime > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {check.responseTime}ms
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>
                System alerts requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-green-600">No Active Alerts</p>
                  <p className="text-muted-foreground">All systems are operating normally</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert: any) => (
                    <div key={alert.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getSeverityColor(alert.severity) as any}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <span className="font-medium">{alert.ruleName}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Metric: {alert.metric}</span>
                            <span>Current: {alert.currentValue}</span>
                            <span>Threshold: {alert.threshold}</span>
                            <span>
                              Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeAlert(alert.id)}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => resolveAlert(alert.id)}
                          >
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

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
                <CardDescription>Current system resource utilization</CardDescription>
              </CardHeader>
              <CardContent>
                {systemHealth && (
                  <div className="space-y-4">
                    {systemHealth.services.map((service: any) => {
                      if (['cpu', 'memory', 'filesystem'].includes(service.service)) {
                        const check = service.checks.find((c: any) => c.name.includes('usage'))
                        if (check && check.metadata) {
                          let percentage = 0
                          if (service.service === 'cpu' && check.metadata.loadAverage) {
                            percentage = (check.metadata.loadAverage[0] / check.metadata.cpuCount) * 100
                          } else if (service.service === 'memory' && check.metadata.heapUsed) {
                            percentage = (check.metadata.heapUsed / check.metadata.heapTotal) * 100
                          }

                          return (
                            <div key={service.service} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="capitalize">{service.service}</span>
                                <span className="text-sm text-muted-foreground">
                                  {percentage.toFixed(1)}%
                                </span>
                              </div>
                              <Progress value={percentage} className="h-2" />
                            </div>
                          )
                        }
                      }
                      return null
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alert Summary</CardTitle>
                <CardDescription>Alert distribution by severity</CardDescription>
              </CardHeader>
              <CardContent>
                {alertMetrics && (
                  <div className="space-y-3">
                    {Object.entries(alertMetrics.alertsBySeverity).map(([severity, count]: any) => (
                      <div key={severity} className="flex items-center justify-between">
                        <span className="capitalize">{severity}</span>
                        <Badge variant={getSeverityColor(severity) as any}>{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
