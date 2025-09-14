'use client'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/shared/http/client'

export interface CurrentUsage {
  used: number
  limit: number
  resetDate: string
  daysUntilReset: number
  dailyAverage: number
}

export interface UsageHistoryPoint {
  date: string
  tokens: number
  requests: number
  cost?: number
}

export interface FeatureUsage {
  name: string
  description: string
  tokens: number
  requests: number
  percentage: number
}

export interface BatchOperation {
  id: string
  name: string
  tokensUsed: number
  itemsProcessed: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
}

export interface UsageForecast {
  projectedUsage: number
  confidence: number
  willExceedLimit: boolean
  data: Array<{
    date: string
    actual?: number
    predicted: number
  }>
  recommendations: string[]
}

export interface BudgetAlert {
  id: string
  threshold: number
  currentUsage: number
  severity: 'info' | 'warning' | 'critical'
  message: string
  triggered: boolean
}

export function useTokenUsage(userId: string) {
  const queryClient = useQueryClient()

  // Fetch current usage
  const {
    data: currentUsage,
    isLoading: isCurrentLoading,
    error: currentError,
    refetch: refetchCurrent
  } = useQuery({
    queryKey: ['token-usage-current', userId],
    queryFn: async (): Promise<CurrentUsage> => {
      return http.get<CurrentUsage>(`/user/${userId}/tokens/current`)
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  })

  // Fetch usage history
  const {
    data: usageHistory,
    isLoading: isHistoryLoading,
    error: historyError
  } = useQuery({
    queryKey: ['token-usage-history', userId],
    queryFn: async (): Promise<UsageHistoryPoint[]> => {
      return http.get<UsageHistoryPoint[]>(`/user/${userId}/tokens/history`, { days: 90 })
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch feature breakdown
  const {
    data: featureBreakdown,
    isLoading: isFeatureLoading,
    error: featureError
  } = useQuery({
    queryKey: ['token-usage-features', userId],
    queryFn: async (): Promise<FeatureUsage[]> => {
      return http.get<FeatureUsage[]>(`/user/${userId}/tokens/features`)
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  })

  // Fetch batch operations
  const {
    data: batchOperations,
    isLoading: isBatchLoading,
    error: batchError
  } = useQuery({
    queryKey: ['token-usage-batches', userId],
    queryFn: async (): Promise<BatchOperation[]> => {
      return http.get<BatchOperation[]>(`/user/${userId}/tokens/batches`)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch usage forecast
  const {
    data: forecast,
    isLoading: isForecastLoading,
    error: forecastError
  } = useQuery({
    queryKey: ['token-usage-forecast', userId],
    queryFn: async (): Promise<UsageForecast> => {
      return http.get<UsageForecast>(`/user/${userId}/tokens/forecast`)
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  })

  // Fetch budget alerts
  const {
    data: budgetAlerts,
    isLoading: isAlertsLoading,
    error: alertsError
  } = useQuery({
    queryKey: ['token-budget-alerts', userId],
    queryFn: async (): Promise<BudgetAlert[]> => {
      return http.get<BudgetAlert[]>(`/user/${userId}/tokens/alerts`)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Set budget alert mutation
  const setBudgetAlertMutation = useMutation({
    mutationFn: async ({ threshold, type }: { threshold: number; type: 'percentage' | 'absolute' }) => {
      return http.post(`/user/${userId}/tokens/alerts`, { threshold, type })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-budget-alerts', userId] })
    },
  })

  // Export usage data mutation
  const exportUsageDataMutation = useMutation({
    mutationFn: async (format: 'csv' | 'json' | 'xlsx') => {
      const blobResp = await fetch(`/api/user/${userId}/tokens/export?format=${format}`)
      if (!blobResp.ok) throw new Error('Failed to export usage data')
      const blob = await blobResp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `token-usage-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      return { success: true }
    },
  })

  // Delete budget alert mutation
  const deleteBudgetAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return http.delete(`/user/${userId}/tokens/alerts/${alertId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-budget-alerts', userId] })
    },
  })

  // Helper functions
  const getUsagePercentage = useCallback(() => {
    if (!currentUsage) return 0
    return (currentUsage.used / currentUsage.limit) * 100
  }, [currentUsage])

  const getUsageTrend = useCallback((days: number = 7) => {
    if (!usageHistory || usageHistory.length < days * 2) return 'stable'
    
    const recent = usageHistory.slice(-days)
    const older = usageHistory.slice(-days * 2, -days)
    
    const recentAvg = recent.reduce((sum, day: any) => sum + day.tokens, 0) / recent.length
    const olderAvg = older.reduce((sum, day: any) => sum + day.tokens, 0) / older.length
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100
    
    if (change > 10) return 'increasing'
    if (change < -10) return 'decreasing'
    return 'stable'
  }, [usageHistory])

  const getTopFeatures = useCallback((limit: number = 5) => {
    if (!featureBreakdown) return []
    return featureBreakdown
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, limit)
  }, [featureBreakdown])

  const getRecentBatches = useCallback((limit: number = 10) => {
    if (!batchOperations) return []
    return batchOperations
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  }, [batchOperations])

  const getTotalCost = useCallback(() => {
    if (!usageHistory) return 0
    return usageHistory.reduce((sum, day: any) => sum + (day.cost || 0), 0)
  }, [usageHistory])

  const getAverageDailyCost = useCallback(() => {
    if (!usageHistory || usageHistory.length === 0) return 0
    const totalCost = getTotalCost()
    return totalCost / usageHistory.length
  }, [usageHistory, getTotalCost])

  const getProjectedMonthlyCost = useCallback(() => {
    const dailyAvg = getAverageDailyCost()
    return dailyAvg * 30
  }, [getAverageDailyCost])

  const isNearLimit = useCallback((threshold: number = 80) => {
    const percentage = getUsagePercentage()
    return percentage >= threshold
  }, [getUsagePercentage])

  const getDaysUntilLimit = useCallback(() => {
    if (!currentUsage || !forecast) return null
    
    const dailyAverage = currentUsage.dailyAverage
    const remaining = currentUsage.limit - currentUsage.used
    
    if (dailyAverage <= 0) return null
    
    return Math.floor(remaining / dailyAverage)
  }, [currentUsage, forecast])

  const getEfficiencyScore = useCallback(() => {
    if (!featureBreakdown || featureBreakdown.length === 0) return 0
    
    // Calculate efficiency based on tokens per request ratio
    const totalTokens = featureBreakdown.reduce((sum, f: any) => sum + f.tokens, 0)
    const totalRequests = featureBreakdown.reduce((sum, f: any) => sum + f.requests, 0)
    
    if (totalRequests === 0) return 0
    
    const avgTokensPerRequest = totalTokens / totalRequests
    
    // Lower tokens per request = higher efficiency (scale 0-100)
    // This is a simplified calculation - adjust based on your specific metrics
    return Math.max(0, Math.min(100, 100 - (avgTokensPerRequest / 10)))
  }, [featureBreakdown])

  // Action functions
  const setBudgetAlert = useCallback(async (threshold: number, type: 'percentage' | 'absolute' = 'percentage') => {
    return setBudgetAlertMutation.mutateAsync({ threshold, type })
  }, [setBudgetAlertMutation])

  const exportUsageData = useCallback(async (format: 'csv' | 'json' | 'xlsx') => {
    return exportUsageDataMutation.mutateAsync(format)
  }, [exportUsageDataMutation])

  const deleteBudgetAlert = useCallback(async (alertId: string) => {
    return deleteBudgetAlertMutation.mutateAsync(alertId)
  }, [deleteBudgetAlertMutation])

  const refreshUsageData = useCallback(async () => {
    await Promise.all([
      refetchCurrent(),
      queryClient.invalidateQueries({ queryKey: ['token-usage-history', userId] }),
      queryClient.invalidateQueries({ queryKey: ['token-usage-features', userId] }),
      queryClient.invalidateQueries({ queryKey: ['token-usage-batches', userId] }),
      queryClient.invalidateQueries({ queryKey: ['token-usage-forecast', userId] }),
      queryClient.invalidateQueries({ queryKey: ['token-budget-alerts', userId] })
    ])
  }, [refetchCurrent, queryClient, userId])

  const isLoading = isCurrentLoading || isHistoryLoading || isFeatureLoading || 
                   isBatchLoading || isForecastLoading || isAlertsLoading
  const error = currentError || historyError || featureError || 
               batchError || forecastError || alertsError

  return {
    // Data
    currentUsage,
    usageHistory,
    featureBreakdown,
    batchOperations,
    forecast,
    budgetAlerts,
    
    // Loading states
    isLoading,
    isCurrentLoading,
    isHistoryLoading,
    isFeatureLoading,
    isBatchLoading,
    isForecastLoading,
    isAlertsLoading,
    isSettingAlert: setBudgetAlertMutation.isPending,
    isExporting: exportUsageDataMutation.isPending,
    isDeletingAlert: deleteBudgetAlertMutation.isPending,
    
    // Errors
    error: error?.message || null,
    currentError: currentError?.message || null,
    historyError: historyError?.message || null,
    featureError: featureError?.message || null,
    batchError: batchError?.message || null,
    forecastError: forecastError?.message || null,
    alertsError: alertsError?.message || null,
    setAlertError: setBudgetAlertMutation.error?.message || null,
    exportError: exportUsageDataMutation.error?.message || null,
    deleteAlertError: deleteBudgetAlertMutation.error?.message || null,
    
    // Actions
    setBudgetAlert,
    exportUsageData,
    deleteBudgetAlert,
    refreshUsageData,
    
    // Helpers
    getUsagePercentage,
    getUsageTrend,
    getTopFeatures,
    getRecentBatches,
    getTotalCost,
    getAverageDailyCost,
    getProjectedMonthlyCost,
    isNearLimit,
    getDaysUntilLimit,
    getEfficiencyScore,
  }
}

export default useTokenUsage
