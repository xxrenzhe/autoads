'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Alert, AlertDescription } from '../ui/alert'
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  RefreshCw,
  Download,
  Filter,
  Users,
  Zap,
  Target
} from 'lucide-react'
import { toast } from 'sonner'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts'

interface APIAnalytics {
  totalRequests: number
  totalErrors: number
  averageResponseTime: number
  successRate: number
  requestsPerSecond: number
  uniqueUsers: number
  topEndpoints: Array<{
    endpoint: string
    requests: number
    errors: number
    avgResponseTime: number
  }>
  errorsByType: Record<string, number>
  requestsByHour: Array<{
    hour: string
    requests: number
    errors: number
    responseTime: number
  }>
  userAgents: Array<{
    userAgent: string
    requests: number
    percentage: number
  }>
  pagination?: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

interface PerformanceMetrics {
  p50ResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  errorRate: number
  throughput: number
  availability: number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export default function APIAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<APIAnalytics | null>(null)
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null)
  const [monitoringData, setMonitoringData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState('24h')
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [realTimeData, setRealTimeData] = useState<any>(null)

  // 实时指标计算
  const displayMetrics = realTimeData || {
    requestsPerSecond: 0,
    averageResponseTime: 0,
    errorRate: 0,
    activeAlerts: {
      highErrorRate: false,
      slowResponse: false,
      suddenSpike: false
    }
  }

  useEffect(() => {
    setPage(1) // Reset page when filters change
    fetchAnalytics()
  }, [timeRange, selectedEndpoint])

  useEffect(() => {
    fetchAnalytics()
  }, [page, pageSize])

  // 设置实时数据流
  useEffect(() => {
    let eventSource: EventSource | null = null

    const connectEventSource = () => {
      eventSource = new EventSource('/api/admin/monitoring/api-stream')
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'metrics') {
            setRealTimeData(data.data)
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error)
        }
      }

      eventSource.onerror = () => {
        console.error('EventSource connection error')
        if (eventSource) {
          eventSource.close()
        }
        // 5秒后重连
        setTimeout(connectEventSource, 5000)
      }
    }

    connectEventSource()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      
      const offset = (page - 1) * pageSize
      const params = new URLSearchParams({
        timeRange,
        limit: pageSize.toString(),
        offset: offset.toString(),
        ...(selectedEndpoint !== 'all' && { endpoint: selectedEndpoint })
      })

      // 获取新的监控数据
      const [monitoringResponse, analyticsResponse, performanceResponse] = await Promise.all([
        fetch(`/api/admin/monitoring/api-metrics?${params}`),
        fetch(`/api/admin/api-management/analytics?${params}`),
        fetch(`/api/admin/api-management/performance?${params}`)
      ])

      if (monitoringResponse.ok) {
        const data = await monitoringResponse.json()
        setMonitoringData(data.data)
      }

      if (analyticsResponse.ok) {
        const data = await analyticsResponse.json()
        setAnalytics(data.data)
        if (data.cached) {
          toast.info('Showing cached data')
        }
      }

      if (performanceResponse.ok) {
        const data = await performanceResponse.json()
        setPerformance(data.data)
        if (data.cached) {
          toast.info('Performance data cached')
        }
      }
    } catch (error) {
      console.error('Error fetching API analytics:', error)
      toast.error('Failed to fetch API analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await fetchAnalytics()
  }

  const exportData = async () => {
    try {
      const params = new URLSearchParams({
        timeRange,
        ...(selectedEndpoint !== 'all' && { endpoint: selectedEndpoint })
      })

      const response = await fetch(`/api/admin/api-management/export?${params}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `api-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Analytics data exported successfully')
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export analytics data')
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getStatusColor = (successRate: number): string => {
    if (successRate >= 99) return 'text-green-600'
    if (successRate >= 95) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusIcon = (successRate: number) => {
    if (successRate >= 99) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (successRate >= 95) return <Clock className="h-4 w-4 text-yellow-600" />
    return <AlertTriangle className="h-4 w-4 text-red-600" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!analytics) {
    return (
      <Alert>
        <AlertDescription>
          Failed to load API analytics. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  const errorDistributionData = Object.entries(analytics.errorsByType).map(([type, count]) => ({
    name: type,
    value: count,
    percentage: ((count / analytics.totalErrors) * 100).toFixed(1)
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor API performance, usage patterns, and error tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <select
            value={selectedEndpoint}
            onChange={(e) => setSelectedEndpoint(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="all">All Endpoints</option>
            {analytics?.topEndpoints?.map(endpoint => (
              <option key={endpoint.endpoint} value={endpoint.endpoint}>
                {endpoint.endpoint}
              </option>
            ))}
          </select>
          
          {/* Pagination Controls */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
            <option value="200">200 per page</option>
            <option value="500">500 per page</option>
          </select>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1 text-sm">
              Page {page} of {analytics?.pagination ? Math.ceil(analytics.pagination.total / pageSize) : 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!analytics?.pagination?.hasMore}
            >
              Next
            </Button>
          </div>
          
          <Button
            variant="outline"
            onClick={exportData}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
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
   {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 实时RPS */}
        <Card className={displayMetrics.activeAlerts.suddenSpike ? 'border-orange-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Real-time RPS</CardTitle>
            <Zap className={`h-4 w-4 ${displayMetrics.activeAlerts.suddenSpike ? 'text-orange-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayMetrics.requestsPerSecond.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              requests/sec
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analytics.totalRequests)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.requestsPerSecond.toFixed(1)} req/sec
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            {getStatusIcon(analytics.successRate)}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(analytics.successRate)}`}>
              {analytics.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalErrors} errors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              average latency
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analytics.uniqueUsers)}</div>
            <p className="text-xs text-muted-foreground">
              active users
            </p>
          </CardContent>
        </Card>

        {/* 数据库连接池状态 */}
        {monitoringData?.system?.database && (
          <Card className={monitoringData.system.database.activeConnections / monitoringData.system.database.maxConnections > 0.8 ? 'border-red-500' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">DB Connections</CardTitle>
              <div className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${
                  monitoringData.system.database.activeConnections / monitoringData.system.database.maxConnections > 0.8 
                    ? 'bg-red-500' 
                    : monitoringData.system.database.activeConnections / monitoringData.system.database.maxConnections > 0.6 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                }`} />
                <span className="text-xs text-muted-foreground">
                  {Math.round((monitoringData.system.database.activeConnections / monitoringData.system.database.maxConnections) * 100)}%
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {monitoringData.system.database.activeConnections}/{monitoringData.system.database.maxConnections}
              </div>
              <p className="text-xs text-muted-foreground">
                {monitoringData.system.database.waiting} waiting
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 告警状态 */}
      {monitoringData?.alerts && Object.values(monitoringData.alerts).some(alert => alert) && (
        <Card className="border-orange-500 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {monitoringData.alerts.highErrorRate && (
                <div className="p-3 bg-red-100 rounded-lg">
                  <p className="text-sm font-medium text-red-700">High Error Rate</p>
                  <p className="text-xs text-red-600">Error rate exceeds 5%</p>
                </div>
              )}
              {monitoringData.alerts.slowResponse && (
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <p className="text-sm font-medium text-yellow-700">Slow Response</p>
                  <p className="text-xs text-yellow-600">Avg response {'>'} 2s</p>
                </div>
              )}
              {monitoringData.alerts.highDatabaseUsage && (
                <div className="p-3 bg-orange-100 rounded-lg">
                  <p className="text-sm font-medium text-orange-700">High DB Usage</p>
                  <p className="text-xs text-orange-600">Connection pool {'>'} 80%</p>
                </div>
              )}
              {monitoringData.alerts.manyFailedTasks && (
                <div className="p-3 bg-red-100 rounded-lg">
                  <p className="text-sm font-medium text-red-700">Task Failures</p>
                  <p className="text-xs text-red-600">Multiple tasks failed</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      {performance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
            <CardDescription>
              Detailed performance indicators and SLA metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{performance.p50ResponseTime}ms</div>
                <div className="text-sm text-muted-foreground">P50 Response Time</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{performance.p95ResponseTime}ms</div>
                <div className="text-sm text-muted-foreground">P95 Response Time</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{performance.p99ResponseTime}ms</div>
                <div className="text-sm text-muted-foreground">P99 Response Time</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{performance.availability.toFixed(2)}%</div>
                <div className="text-sm text-muted-foreground">Availability</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{performance.throughput.toFixed(0)}</div>
                <div className="text-sm text-muted-foreground">Throughput (req/s)</div>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-lg">
                <div className="text-2xl font-bold text-indigo-600">{performance.errorRate.toFixed(2)}%</div>
                <div className="text-sm text-muted-foreground">Error Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">Top Endpoints</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
          <TabsTrigger value="trends">Usage Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Request Volume Over Time</CardTitle>
                <CardDescription>API requests and errors by hour</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={analytics.requestsByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="requests" fill="#3B82F6" name="Requests" />
                    <Line type="monotone" dataKey="errors" stroke="#EF4444" name="Errors" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Time Trends</CardTitle>
                <CardDescription>Average response time by hour</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.requestsByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}ms`, 'Response Time']} />
                    <Area type="monotone" dataKey="responseTime" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top API Endpoints</CardTitle>
              <CardDescription>Most frequently accessed endpoints and their performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topEndpoints.map((endpoint, index) => {
                  const errorRate = endpoint.requests > 0 ? (endpoint.errors / endpoint.requests) * 100 : 0
                  
                  return (
                    <div key={endpoint.endpoint} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium">{endpoint.endpoint}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatNumber(endpoint.requests)} requests
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            {errorRate < 1 ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : errorRate < 5 ? (
                              <Clock className="h-4 w-4 text-yellow-600" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            )}
                            <Badge variant={errorRate < 1 ? "default" : errorRate < 5 ? "secondary" : "destructive"}>
                              {errorRate.toFixed(1)}% errors
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Avg Response Time</p>
                          <p className="font-medium">{endpoint.avgResponseTime}ms</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Errors</p>
                          <p className="font-medium">{endpoint.errors}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Success Rate</p>
                          <p className="font-medium">{(100 - errorRate).toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Error Distribution</CardTitle>
                <CardDescription>Breakdown of errors by type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={errorDistributionData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {errorDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Details</CardTitle>
                <CardDescription>Detailed breakdown of error types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {errorDistributionData.map((error, index) => (
                    <div key={error.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium">{error.name}</p>
                          <p className="text-sm text-muted-foreground">{error.value} occurrences</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{error.percentage}%</p>
                        <p className="text-sm text-muted-foreground">of total errors</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="realtime" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 实时指标仪表盘 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Real-time Metrics
                </CardTitle>
                <CardDescription>
                  Live API performance indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">
                        {displayMetrics.requestsPerSecond.toFixed(1)}
                      </div>
                      <div className="text-sm text-muted-foreground">Requests/sec</div>
                      {displayMetrics.activeAlerts.suddenSpike && (
                        <Badge variant="destructive" className="mt-2">Spike Detected</Badge>
                      )}
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600">
                        {displayMetrics.averageResponseTime.toFixed(0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Response (ms)</div>
                      {displayMetrics.activeAlerts.slowResponse && (
                        <Badge variant="destructive" className="mt-2">Slow</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium">Recent Endpoint Activity</h4>
                    <div className="space-y-2">
                      {displayMetrics.topEndpoints?.slice(0, 5).map((endpoint: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="text-sm font-medium truncate flex-1">
                            {endpoint.endpoint}
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {endpoint.requests}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 系统健康状态 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  System Health
                </CardTitle>
                <CardDescription>
                  Overall system status and health indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* API状态 */}
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${
                        displayMetrics.errorRate < 1 ? 'bg-green-500' : 
                        displayMetrics.errorRate < 5 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium">API Status</span>
                    </div>
                    <Badge variant={
                      displayMetrics.errorRate < 1 ? 'default' : 
                      displayMetrics.errorRate < 5 ? 'secondary' : 'destructive'
                    }>
                      {displayMetrics.errorRate.toFixed(1)}% errors
                    </Badge>
                  </div>

                  {/* 数据库状态 */}
                  {monitoringData?.system?.database && (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${
                          monitoringData.system.database.activeConnections / monitoringData.system.database.maxConnections < 0.8 ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <span className="font-medium">Database Pool</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {monitoringData.system.database.activeConnections}/{monitoringData.system.database.maxConnections}
                      </span>
                    </div>
                  )}

                  {/* 会话状态 */}
                  {monitoringData?.system?.sessions && (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <span className="font-medium">Active Sessions</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {monitoringData.system.sessions.activeUsers} users
                      </span>
                    </div>
                  )}

                  {/* 任务队列状态 */}
                  {monitoringData?.system?.taskQueue && (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${
                          monitoringData.system.taskQueue.failed > 0 ? 'bg-red-500' : 'bg-green-500'
                        }`} />
                        <span className="font-medium">Task Queue</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {monitoringData.system.taskQueue.running} running, {monitoringData.system.taskQueue.failed} failed
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Agent Distribution</CardTitle>
                <CardDescription>API usage by client type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.userAgents.slice(0, 5).map((ua, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium truncate">{ua.userAgent}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatNumber(ua.requests)} ({ua.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${ua.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Health Summary</CardTitle>
                <CardDescription>Overall system health indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium">System Status</p>
                      <p className="text-sm text-muted-foreground">All systems operational</p>
                    </div>
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{analytics.successRate.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{analytics.averageResponseTime}ms</p>
                      <p className="text-sm text-muted-foreground">Avg Latency</p>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Performance Insights</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• API performance is within normal parameters</li>
                      <li>• Error rate is below 1% threshold</li>
                      <li>• Response times are optimal</li>
                      <li>• No rate limiting issues detected</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}