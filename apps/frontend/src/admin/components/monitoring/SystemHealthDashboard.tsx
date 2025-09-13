'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { 
  Activity,
  Server,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Settings,
  Eye,
  BarChart3,
  Cpu,
  HardDrive,
  Wifi,
  Shield
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export interface SystemHealth {
  overall: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    uptime: number
    lastCheck: string
    score: number
  }
  services: Array<{
    name: string
    status: 'healthy' | 'degraded' | 'unhealthy'
    responseTime: number
    uptime: number
    lastError?: string
  }>
  infrastructure: {
    cpu: { usage: number; status: string }
    memory: { usage: number; status: string }
    disk: { usage: number; status: string }
    network: { latency: number; status: string }
  }
  database: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    connections: number
    queryTime: number
    slowQueries: number
  }
  cache: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    hitRate: number
    memoryUsage: number
    operations: number
  }
}

export interface ErrorLog {
  id: string
  timestamp: string
  level: 'error' | 'warning' | 'info'
  service: string
  message: string
  stack?: string
  metadata?: Record<string, any>
  count: number
}

export interface SystemHealthDashboardProps {
  className?: string
}

export function SystemHealthDashboard({ className }: SystemHealthDashboardProps) {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30) // seconds
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'infrastructure' | 'errors'>('overview')

  // Fetch system health
  const {
    data: systemHealth,
    isLoading: isHealthLoading,
    refetch: refetchHealth
  } = useQuery({
    queryKey: ['system-health'],
    queryFn: async (): Promise<SystemHealth> => {
      const response = await fetch('/api/admin/monitoring/health')
      if (!response.ok) throw new Error('Failed to fetch system health')
      const result = await response.json()
      return result.data
    },
    staleTime: 30 * 1000,
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
  })

  // Fetch error logs
  const {
    data: errorLogs = [],
    isLoading: isErrorsLoading
  } = useQuery({
    queryKey: ['error-logs'],
    queryFn: async (): Promise<ErrorLog[]> => {
      const response = await fetch('/api/admin/monitoring/errors?limit=50')
      if (!response.ok) throw new Error('Failed to fetch error logs')
      const result = await response.json()
      return result.data || []
    },
    staleTime: 60 * 1000,
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
  })

  // Fetch performance metrics
  const {
    data: performanceMetrics,
    isLoading: isMetricsLoading
  } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/admin/performance/metrics?includeCache=true&includeDatabase=true')
      if (!response.ok) throw new Error('Failed to fetch performance metrics')
      const result = await response.json()
      return result.data
    },
    staleTime: 30 * 1000,
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'degraded': return <Clock className="h-4 w-4 text-yellow-600" />
      case 'unhealthy': return <AlertTriangle className="h-4 w-4 text-red-600" />
      default: return <AlertTriangle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'degraded': return 'bg-yellow-100 text-yellow-800'
      case 'unhealthy': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getUsageColor = (usage: number): string => {
    if (usage >= 90) return 'text-red-600'
    if (usage >= 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getUsageBarColor = (usage: number): string => {
    if (usage >= 90) return 'bg-red-500'
    if (usage >= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getLevelIcon = (level: ErrorLog['level']) => {
    switch (level) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'warning': return <Clock className="h-4 w-4 text-yellow-600" />
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-600" />
      default: return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

  const formatUptime = (uptime: number): string => {
    return `${uptime.toFixed(2)}%`
  }

  const formatResponseTime = (time: number): string => {
    if (time >= 1000) return `${(time / 1000).toFixed(1)}s`
    return `${time.toFixed(0)}ms`
  }

  const handleRefresh = () => {
    refetchHealth()
  }

  const exportHealthReport = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/export?type=health')
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `system-health-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            System Health Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time monitoring and observability
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Auto-refresh:</label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh((e.target as HTMLInputElement).checked)}
              className="rounded"
            />
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt((e.target as HTMLSelectElement).value))}
              disabled={!autoRefresh}
              className="px-2 py-1 text-sm border border-gray-300 rounded"
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
              <option value={300}>5m</option>
            </select>
          </div>
          
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button onClick={exportHealthReport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      {systemHealth && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {getStatusIcon(systemHealth.overall.status)}
                <div>
                  <h3 className="text-lg font-medium">
                    System Status: <span className="capitalize">{systemHealth.overall.status}</span>
                  </h3>
                  <p className="text-sm text-gray-600">
                    Health Score: {systemHealth.overall.score}/100 • Uptime: {formatUptime(systemHealth.overall.uptime)}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-gray-600">Last Check</div>
                <div className="font-medium">
                  {new Date(systemHealth.overall.lastCheck).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'services', label: 'Services', icon: Server },
            { id: 'infrastructure', label: 'Infrastructure', icon: Cpu },
            { id: 'errors', label: 'Error Logs', icon: AlertTriangle }
          ].map(({ id, label, icon: Icon }: { id: string; label: string; icon: any }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
              {id === 'errors' && errorLogs.filter((e: any) => e.level === 'error').length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {errorLogs.filter((e: any) => e.level === 'error').length}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && systemHealth && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Infrastructure Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(systemHealth.infrastructure).map(([key, value]: any) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center">
                      {key === 'cpu' && <Cpu className="h-4 w-4 mr-2" />}
                      {key === 'memory' && <HardDrive className="h-4 w-4 mr-2" />}
                      {key === 'disk' && <HardDrive className="h-4 w-4 mr-2" />}
                      {key === 'network' && <Wifi className="h-4 w-4 mr-2" />}
                      <span className="capitalize">{key}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`font-medium ${getUsageColor(
                        key === 'network' ? (value as any).latency || 0 : (value as any).usage || 0
                      )}`}>
                        {key === 'network' ? `${(value as any).latency || 0}ms` : `${((value as any).usage || 0).toFixed(1)}%`}
                      </span>
                      <Badge className={getStatusColor(value.status)}>
                        {value.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Database & Cache</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Database className="h-4 w-4 mr-2" />
                    <span>Database</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {systemHealth.database.connections} conn • {formatResponseTime(systemHealth.database.queryTime)}
                    </span>
                    <Badge className={getStatusColor(systemHealth.database.status)}>
                      {systemHealth.database.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Zap className="h-4 w-4 mr-2" />
                    <span>Cache</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {systemHealth.cache.hitRate.toFixed(1)}% hit • {systemHealth.cache.memoryUsage.toFixed(1)}% mem
                    </span>
                    <Badge className={getStatusColor(systemHealth.cache.status)}>
                      {systemHealth.cache.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'services' && systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {systemHealth.services.map((service, index: number) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Server className="h-5 w-5 mr-2" />
                    <span>{service.name}</span>
                  </div>
                  {getStatusIcon(service.status)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Response Time:</span>
                    <span className="font-medium">{formatResponseTime(service.responseTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Uptime:</span>
                    <span className="font-medium">{formatUptime(service.uptime)}</span>
                  </div>
                  {service.lastError && (
                    <div className="bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-xs text-red-800">{service.lastError}</p>
                    </div>
                  )}
                  <Badge className={getStatusColor(service.status)}>
                    {service.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'infrastructure' && systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(systemHealth.infrastructure).map(([key, value]: any) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {key === 'cpu' && <Cpu className="h-5 w-5 mr-2" />}
                  {key === 'memory' && <HardDrive className="h-5 w-5 mr-2" />}
                  {key === 'disk' && <HardDrive className="h-5 w-5 mr-2" />}
                  {key === 'network' && <Wifi className="h-5 w-5 mr-2" />}
                  <span className="capitalize">{key}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {key === 'network' ? 'Latency' : 'Usage'}:
                    </span>
                    <span className={`font-medium ${getUsageColor(
                        key === 'network' ? (value as any).latency || 0 : (value as any).usage || 0
                    )}`}>
                      {key === 'network' ? `${(value as any).latency || 0}ms` : `${((value as any).usage || 0).toFixed(1)}%`}
                    </span>
                  </div>
                  
                  {key !== 'network' && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${getUsageBarColor((value as any).usage || 0)}`}
                        style={{ width: `${Math.min((value as any).usage || 0, 100)}%` }}
                      />
                    </div>
                  )}
                  
                  <Badge className={getStatusColor(value.status)}>
                    {value.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="space-y-4">
          {errorLogs.length > 0 ? (
            errorLogs.map((error: any) => (
              <Card key={error.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getLevelIcon(error.level)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{error.service}</h4>
                          {error.count > 1 && (
                            <Badge variant="outline">
                              {error.count}x
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{error.message}</p>
                        {error.stack && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer">
                              Stack trace
                            </summary>
                            <pre className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded overflow-x-auto">
                              {error.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gray-500">
                        {new Date(error.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Recent Errors
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  System is running smoothly with no errors in the selected time period.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export default SystemHealthDashboard
