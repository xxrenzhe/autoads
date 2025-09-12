'use client'
import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface SystemMetrics {
  healthScore: number
  uptime: number
  activeConnections: number
  cpu: {
    usage: number
    loadAverage: number[]
    cores: number
  }
  memory: {
    used: number
    total: number
    percentage: number
    available: number
  }
  disk: {
    used: number
    total: number
    percentage: number
    available: number
  }
  network: {
    upload: number
    download: number
    totalUpload: number
    totalDownload: number
  }
  database: {
    connectionCount: number
    averageQueryTime: number
    slowQueries: number
    cacheHitRate: number
  }
  cache: {
    hitRate: number
    memoryUsage: number
    redisConnections: number
  }
  api: {
    requestsPerMinute: number
    averageResponseTime: number
    errorRate: number
  }
}

export interface MetricsHistory {
  timestamp: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkUpload: number
  networkDownload: number
  responseTime: number
}

export interface SystemAlert {
  id: string
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'database' | 'api' | 'custom'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  threshold: number
  currentValue: number
  timestamp: number
  resolved: boolean
  resolvedAt?: number
  resolvedBy?: string
  acknowledgedBy?: string
  acknowledgedAt?: number
}

export interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  responseTime: number
  lastCheck: number
  uptime: number
  version?: string
  description?: string
  dependencies?: string[]
  endpoint?: string
}

export function useSystemMonitoring(refreshInterval: number = 30000) {
  const queryClient = useQueryClient()
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)

  // Fetch current system metrics
  const {
    data: systemMetrics,
    isLoading,
    error,
    refetch: refetchMetrics
  } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: async (): Promise<SystemMetrics> => {
      const response = await fetch('/api/admin/system/metrics')
      if (!response.ok) {
        throw new Error('Failed to fetch system metrics')
      }
      return response.json()
    },
    refetchInterval: isRealTimeEnabled ? refreshInterval : false,
    staleTime: refreshInterval / 2,
  })

  // Fetch metrics history
  const {
    data: metricsHistory,
    isLoading: isHistoryLoading,
    error: historyError
  } = useQuery({
    queryKey: ['metrics-history'],
    queryFn: async (): Promise<MetricsHistory[]> => {
      const response = await fetch('/api/admin/system/metrics/history?hours=24')
      if (!response.ok) {
        throw new Error('Failed to fetch metrics history')
      }
      return response.json()
    },
    refetchInterval: isRealTimeEnabled ? refreshInterval * 2 : false,
    staleTime: refreshInterval,
  })

  // Fetch system alerts
  const {
    data: alerts,
    isLoading: isAlertsLoading,
    error: alertsError
  } = useQuery({
    queryKey: ['system-alerts'],
    queryFn: async (): Promise<SystemAlert[]> => {
      const response = await fetch('/api/admin/system/alerts')
      if (!response.ok) {
        throw new Error('Failed to fetch system alerts')
      }
      return response.json()
    },
    refetchInterval: isRealTimeEnabled ? refreshInterval / 2 : false,
    staleTime: refreshInterval / 4,
  })

  // Fetch service status
  const {
    data: services,
    isLoading: isServicesLoading,
    error: servicesError
  } = useQuery({
    queryKey: ['service-status'],
    queryFn: async (): Promise<ServiceStatus[]> => {
      const response = await fetch('/api/admin/system/services')
      if (!response.ok) {
        throw new Error('Failed to fetch service status')
      }
      return response.json()
    },
    refetchInterval: isRealTimeEnabled ? refreshInterval : false,
    staleTime: refreshInterval / 2,
  })

  // Create alert mutation
  const createAlertMutation = useMutation({
    mutationFn: async (alertData: Partial<SystemAlert>) => {
      const response = await fetch('/api/admin/system/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      })
      if (!response.ok) {
        throw new Error('Failed to create alert')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] })
    },
  })

  // Resolve alert mutation
  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/admin/system/alerts/${alertId}/resolve`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to resolve alert')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] })
    },
  })

  // Restart service mutation
  const restartServiceMutation = useMutation({
    mutationFn: async (serviceName: string) => {
      const response = await fetch(`/api/admin/system/services/${serviceName}/restart`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to restart service')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-status'] })
    },
  })

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async (cacheType?: string) => {
      const response = await fetch('/api/admin/system/cache/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: cacheType }),
      })
      if (!response.ok) {
        throw new Error('Failed to clear cache')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-metrics'] })
    },
  })

  // Export metrics mutation
  const exportMetricsMutation = useMutation({
    mutationFn: async ({ format, timeRange }: { format: 'csv' | 'json'; timeRange: string }) => {
      const response = await fetch(`/api/admin/system/metrics/export?format=${format}&range=${timeRange}`)
      if (!response.ok) {
        throw new Error('Failed to export metrics')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `system-metrics-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      return { success: true }
    },
  })

  // Helper functions
  const getHealthStatus = useCallback((score: number) => {
    if (score >= 90) return { status: 'excellent', color: 'green' }
    if (score >= 70) return { status: 'good', color: 'blue' }
    if (score >= 50) return { status: 'warning', color: 'yellow' }
    return { status: 'critical', color: 'red' }
  }, [])

  const getCriticalAlerts = useCallback(() => {
    return alerts?.filter(alert => alert.severity === 'critical' && !alert.resolved) || []
  }, [alerts])

  const getWarningAlerts = useCallback(() => {
    return alerts?.filter(alert => alert.severity === 'high' && !alert.resolved) || []
  }, [alerts])

  const getUnhealthyServices = useCallback(() => {
    return services?.filter(service => service.status !== 'healthy') || []
  }, [services])

  const calculateAverageResponseTime = useCallback(() => {
    if (!metricsHistory || metricsHistory.length === 0) return 0
    const sum = metricsHistory.reduce((acc, metric) => acc + metric.responseTime, 0)
    return sum / metricsHistory.length
  }, [metricsHistory])

  const getResourceUsageTrend = useCallback((resource: 'cpu' | 'memory' | 'disk') => {
    if (!metricsHistory || metricsHistory.length < 2) return 'stable'
    
    const recent = metricsHistory.slice(-10)
    const older = metricsHistory.slice(-20, -10)
    
    const recentAvg = recent.reduce((acc, metric) => {
      switch (resource) {
        case 'cpu': return acc + metric.cpuUsage
        case 'memory': return acc + metric.memoryUsage
        case 'disk': return acc + metric.diskUsage
        default: return acc
      }
    }, 0) / recent.length
    
    const olderAvg = older.reduce((acc, metric) => {
      switch (resource) {
        case 'cpu': return acc + metric.cpuUsage
        case 'memory': return acc + metric.memoryUsage
        case 'disk': return acc + metric.diskUsage
        default: return acc
      }
    }, 0) / older.length
    
    const difference = recentAvg - olderAvg
    if (difference > 5) return 'increasing'
    if (difference < -5) return 'decreasing'
    return 'stable'
  }, [metricsHistory])

  const formatUptime = useCallback((seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }, [])

  const formatBytes = useCallback((bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }, [])

  // Action functions
  const refreshMetrics = useCallback(() => {
    refetchMetrics()
  }, [refetchMetrics])

  const createAlert = useCallback(async (alertData: Partial<SystemAlert>) => {
    return createAlertMutation.mutateAsync(alertData)
  }, [createAlertMutation])

  const resolveAlert = useCallback(async (alertId: string) => {
    return resolveAlertMutation.mutateAsync(alertId)
  }, [resolveAlertMutation])

  const restartService = useCallback(async (serviceName: string) => {
    return restartServiceMutation.mutateAsync(serviceName)
  }, [restartServiceMutation])

  const clearCache = useCallback(async (cacheType?: string) => {
    return clearCacheMutation.mutateAsync(cacheType)
  }, [clearCacheMutation])

  const exportMetrics = useCallback(async (format: 'csv' | 'json', timeRange: string) => {
    return exportMetricsMutation.mutateAsync({ format, timeRange })
  }, [exportMetricsMutation])

  const toggleRealTime = useCallback(() => {
    setIsRealTimeEnabled(prev => !prev)
  }, [])

  return {
    // Data
    systemMetrics,
    metricsHistory,
    alerts: alerts || [],
    services: services || [],
    
    // Loading states
    isLoading,
    isHistoryLoading,
    isAlertsLoading,
    isServicesLoading,
    isCreatingAlert: createAlertMutation.isPending,
    isResolvingAlert: resolveAlertMutation.isPending,
    isRestartingService: restartServiceMutation.isPending,
    isClearingCache: clearCacheMutation.isPending,
    isExportingMetrics: exportMetricsMutation.isPending,
    
    // Errors
    error: error?.message || null,
    historyError: historyError?.message || null,
    alertsError: alertsError?.message || null,
    servicesError: servicesError?.message || null,
    createAlertError: createAlertMutation.error?.message || null,
    resolveAlertError: resolveAlertMutation.error?.message || null,
    restartServiceError: restartServiceMutation.error?.message || null,
    clearCacheError: clearCacheMutation.error?.message || null,
    exportMetricsError: exportMetricsMutation.error?.message || null,
    
    // Settings
    isRealTimeEnabled,
    refreshInterval,
    
    // Actions
    refreshMetrics,
    createAlert,
    resolveAlert,
    restartService,
    clearCache,
    exportMetrics,
    toggleRealTime,
    
    // Helpers
    getHealthStatus,
    getCriticalAlerts,
    getWarningAlerts,
    getUnhealthyServices,
    calculateAverageResponseTime,
    getResourceUsageTrend,
    formatUptime,
    formatBytes,
  }
}

export default useSystemMonitoring