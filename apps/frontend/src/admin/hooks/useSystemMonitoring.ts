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
      const response = await fetch('/ops/api/v1/console/monitoring/health')
      if (!response.ok) {
        throw new Error('Failed to fetch system health')
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
      // 后端当前未提供历史接口，返回空数组占位
      return []
    },
    refetchInterval: false,
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
      const response = await fetch('/ops/api/v1/console/monitoring/alerts')
      if (!response.ok) {
        throw new Error('Failed to fetch system alerts')
      }
      const data = await response.json()
      return (data?.data ?? data) as any
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
      // 后端未实现服务详情，返回空
      return []
    },
    refetchInterval: false,
    staleTime: refreshInterval / 2,
  })

  // Create alert mutation
  const createAlertMutation = useMutation({
    mutationFn: async (alertData: Partial<SystemAlert>) => {
      const response = await fetch('/ops/api/v1/console/monitoring/alerts', {
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
    mutationFn: async (_alertId: string) => {
      // 未提供“resolve”接口，直接刷新列表
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] })
    },
  })

  // Restart service mutation
  const restartServiceMutation = useMutation({
    mutationFn: async (_serviceName: string) => {
      // 未提供服务重启接口；占位返回
      return { success: false, message: 'unsupported' }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-status'] })
    },
  })

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async (_cacheType?: string) => {
      // 未提供缓存清理接口；占位返回
      return { success: false, message: 'unsupported' }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-metrics'] })
    },
  })

  // Export metrics mutation
  const exportMetricsMutation = useMutation({
    mutationFn: async (_opts: { format: 'csv' | 'json'; timeRange: string }) => {
      // 未提供导出接口；占位返回
      return { success: false }
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
    return alerts?.filter((alert: any) => alert.severity === 'critical' && !alert.resolved) || []
  }, [alerts])

  const getWarningAlerts = useCallback(() => {
    return alerts?.filter((alert: any) => alert.severity === 'high' && !alert.resolved) || []
  }, [alerts])

  const getUnhealthyServices = useCallback(() => {
    return services?.filter((service: any) => service.status !== 'healthy') || []
  }, [services])

  const calculateAverageResponseTime = useCallback(() => {
    if (!metricsHistory || metricsHistory.length === 0) return 0
    const sum = metricsHistory.reduce((acc, metric: any) => acc + metric.responseTime, 0)
    return sum / metricsHistory.length
  }, [metricsHistory])

  const getResourceUsageTrend = useCallback((resource: 'cpu' | 'memory' | 'disk') => {
    if (!metricsHistory || metricsHistory.length < 2) return 'stable'
    
    const recent = metricsHistory.slice(-10)
    const older = metricsHistory.slice(-20, -10)
    
    const recentAvg = recent.reduce((acc, metric: any) => {
      switch (resource) {
        case 'cpu': return acc + metric.cpuUsage
        case 'memory': return acc + metric.memoryUsage
        case 'disk': return acc + metric.diskUsage
        default: return acc
      }
    }, 0) / recent.length
    
    const olderAvg = older.reduce((acc, metric: any) => {
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
