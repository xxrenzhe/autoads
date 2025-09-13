'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Badge } from '../ui/badge'
import { Progress } from '@/shared/components/ui/ProgressBar'
import { 
  Activity, 
  Cpu, 
  MemoryStick, 
  HardDrive,
  Database,
  Wifi,
  Server,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { useSystemMonitoring } from '../../hooks/useSystemMonitoring'

export interface SystemMetricsProps {
  refreshInterval?: number
  showCharts?: boolean
  compactView?: boolean
}

export function SystemMetrics({ 
  refreshInterval = 30000, 
  showCharts = true,
  compactView = false 
}: SystemMetricsProps) {
  const {
    systemMetrics,
    metricsHistory,
    isLoading,
    error,
    refreshMetrics
  } = useSystemMonitoring(refreshInterval)

  const [selectedMetric, setSelectedMetric] = useState<string>('cpu')

  const getHealthStatus = (score: number) => {
    if (score >= 90) return { status: 'Excellent', color: 'green', icon: CheckCircle }
    if (score >= 70) return { status: 'Good', color: 'blue', icon: CheckCircle }
    if (score >= 50) return { status: 'Warning', color: 'yellow', icon: AlertTriangle }
    return { status: 'Critical', color: 'red', icon: AlertTriangle }
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {new Date(label).toLocaleTimeString()}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {entry.name}: {entry.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading system metrics: {error}</p>
            <button 
              onClick={refreshMetrics}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!systemMetrics) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading system metrics...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const healthStatus = getHealthStatus(systemMetrics.healthScore)
  const HealthIcon = healthStatus.icon

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {systemMetrics.healthScore}%
                </p>
              </div>
              <div className={`p-2 rounded-full bg-${healthStatus.color}-100`}>
                <HealthIcon className={`h-6 w-6 text-${healthStatus.color}-600`} />
              </div>
            </div>
            <Badge variant={healthStatus.color as any} className="mt-2">
              {healthStatus.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Uptime</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatUptime(systemMetrics.uptime)}
                </p>
              </div>
              <div className="p-2 rounded-full bg-blue-100">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Connections</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {systemMetrics.activeConnections}
                </p>
              </div>
              <div className="p-2 rounded-full bg-green-100">
                <Wifi className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Load Average</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {systemMetrics.cpu.loadAverage[0].toFixed(2)}
                </p>
              </div>
              <div className="p-2 rounded-full bg-purple-100">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Cpu className="h-5 w-5 mr-2 text-blue-500" />
              CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Usage</span>
                <span className="text-sm font-mono">{systemMetrics.cpu.usage.toFixed(1)}%</span>
              </div>
              <Progress 
                value={systemMetrics.cpu.usage} 
                className={`h-3 ${getUsageColor(systemMetrics.cpu.usage)}`}
              />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">1m avg:</span>
                  <span className="font-mono ml-1">{systemMetrics.cpu.loadAverage[0].toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">5m avg:</span>
                  <span className="font-mono ml-1">{systemMetrics.cpu.loadAverage[1].toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">15m avg:</span>
                  <span className="font-mono ml-1">{systemMetrics.cpu.loadAverage[2].toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MemoryStick className="h-5 w-5 mr-2 text-purple-500" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Used Memory</span>
                <span className="text-sm font-mono">{systemMetrics.memory.percentage.toFixed(1)}%</span>
              </div>
              <Progress 
                value={systemMetrics.memory.percentage} 
                className={`h-3 ${getUsageColor(systemMetrics.memory.percentage)}`}
              />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Used:</span>
                  <span className="font-mono ml-1">{formatBytes(systemMetrics.memory.used)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total:</span>
                  <span className="font-mono ml-1">{formatBytes(systemMetrics.memory.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disk Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <HardDrive className="h-5 w-5 mr-2 text-orange-500" />
              Disk Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Used Space</span>
                <span className="text-sm font-mono">{systemMetrics.disk.percentage.toFixed(1)}%</span>
              </div>
              <Progress 
                value={systemMetrics.disk.percentage} 
                className={`h-3 ${getUsageColor(systemMetrics.disk.percentage)}`}
              />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Used:</span>
                  <span className="font-mono ml-1">{formatBytes(systemMetrics.disk.used)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total:</span>
                  <span className="font-mono ml-1">{formatBytes(systemMetrics.disk.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Network Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Wifi className="h-5 w-5 mr-2 text-green-500" />
              Network Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Upload</span>
                  </div>
                  <p className="text-lg font-mono">{formatBytes(systemMetrics.network.upload)}/s</p>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Download</span>
                  </div>
                  <p className="text-lg font-mono">{formatBytes(systemMetrics.network.download)}/s</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                <div>Total Upload: {formatBytes(systemMetrics.network.totalUpload)}</div>
                <div>Total Download: {formatBytes(systemMetrics.network.totalDownload)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      {showCharts && metricsHistory && metricsHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Performance Trends
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedMetric('cpu')}
                  className={`px-3 py-1 text-sm rounded ${
                    selectedMetric === 'cpu' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  CPU
                </button>
                <button
                  onClick={() => setSelectedMetric('memory')}
                  className={`px-3 py-1 text-sm rounded ${
                    selectedMetric === 'memory' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Memory
                </button>
                <button
                  onClick={() => setSelectedMetric('disk')}
                  className={`px-3 py-1 text-sm rounded ${
                    selectedMetric === 'disk' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Disk
                </button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricsHistory}>
                  <defs>
                    <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    className="text-xs"
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    className="text-xs"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={selectedMetric === 'cpu' ? 'cpuUsage' : 
                             selectedMetric === 'memory' ? 'memoryUsage' : 'diskUsage'}
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#metricGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Database Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2 text-indigo-500" />
            Database Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Query Response Time</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {systemMetrics.database.averageQueryTime}ms
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Active Connections</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {systemMetrics.database.connectionCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Slow Queries</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {systemMetrics.database.slowQueries}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SystemMetrics
