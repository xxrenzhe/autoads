'use client'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface BehaviorData {
  totalSessions: number
  sessionGrowth: number
  avgSessionDuration: number
  durationGrowth: number
  featuresUsed: number
  totalFeatures: number
  engagementScore: number
  sessionHistory: Array<{
    date: string
    sessions: number
    duration: number
  }>
  deviceBreakdown: Array<{
    name: string
    sessions: number
    percentage: number
  }>
}

export interface ActivityPatterns {
  hourlyActivity: Array<{
    hour: number
    activity: number
  }>
  weeklyActivity: Array<{
    day: string
    activity: number
  }>
  peakTimes: Array<{
    timeRange: string
    intensity: number
    description: string
  }>
  seasonalTrends: Array<{
    period: string
    activity: number
    trend: 'up' | 'down' | 'stable'
  }>
}

export interface FeatureAdoption {
  features: Array<{
    name: string
    usage: number
    adoptionRate: number
    firstUsed: string
    lastUsed: string
  }>
  adoptionTimeline: Array<{
    date: string
    [featureName: string]: any
  }>
  discoveryMethods: Array<{
    method: string
    percentage: number
    count: number
  }>
  abandonedFeatures: Array<{
    name: string
    lastUsed: string
    reason?: string
  }>
}

export interface UserJourney {
  journeySteps: Array<{
    step: string
    completionRate: number
    avgTimeSpent: number
    dropOffRate: number
  }>
  dropOffPoints: Array<{
    step: string
    dropOffRate: number
    commonReasons: string[]
  }>
  successPaths: Array<{
    path: string
    successRate: number
    avgCompletionTime: number
  }>
  conversionFunnels: Array<{
    stage: string
    users: number
    conversionRate: number
  }>
}

export interface RetentionData {
  dayOneRetention: number
  daySevenRetention: number
  dayThirtyRetention: number
  cohortData: Array<{
    period: string
    retention: number
    users: number
  }>
  churnPrediction: {
    riskScore: number
    factors: string[]
    recommendations: string[]
  }
}

export interface SegmentData {
  userSegment: string
  segmentCharacteristics: string[]
  comparisonMetrics: {
    avgSessionDuration: number
    engagementScore: number
    featureAdoption: number
  }
  benchmarkComparison: {
    percentile: number
    category: 'low' | 'average' | 'high' | 'exceptional'
  }
}

export function useBehaviorAnalytics(userId: string, timeRange: string = '30d') {
  const queryClient = useQueryClient()

  // Fetch behavior data
  const {
    data: behaviorData,
    isLoading: isBehaviorLoading,
    error: behaviorError
  } = useQuery({
    queryKey: ['user-behavior', userId, timeRange],
    queryFn: async (): Promise<BehaviorData> => {
      const response = await fetch(`/api/user/${userId}/analytics/behavior?range=${timeRange}`)
      if (!response.ok) {
        throw new Error('Failed to fetch behavior data')
      }
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch activity patterns
  const {
    data: activityPatterns,
    isLoading: isPatternsLoading,
    error: patternsError
  } = useQuery({
    queryKey: ['activity-patterns', userId, timeRange],
    queryFn: async (): Promise<ActivityPatterns> => {
      const response = await fetch(`/api/user/${userId}/analytics/patterns?range=${timeRange}`)
      if (!response.ok) {
        throw new Error('Failed to fetch activity patterns')
      }
      return response.json()
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  })

  // Fetch feature adoption
  const {
    data: featureAdoption,
    isLoading: isAdoptionLoading,
    error: adoptionError
  } = useQuery({
    queryKey: ['feature-adoption', userId, timeRange],
    queryFn: async (): Promise<FeatureAdoption> => {
      const response = await fetch(`/api/user/${userId}/analytics/features?range=${timeRange}`)
      if (!response.ok) {
        throw new Error('Failed to fetch feature adoption')
      }
      return response.json()
    },
    staleTime: 20 * 60 * 1000, // 20 minutes
  })

  // Fetch user journey
  const {
    data: userJourney,
    isLoading: isJourneyLoading,
    error: journeyError
  } = useQuery({
    queryKey: ['user-journey', userId, timeRange],
    queryFn: async (): Promise<UserJourney> => {
      const response = await fetch(`/api/user/${userId}/analytics/journey?range=${timeRange}`)
      if (!response.ok) {
        throw new Error('Failed to fetch user journey')
      }
      return response.json()
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  })

  // Fetch retention data
  const {
    data: retentionData,
    isLoading: isRetentionLoading,
    error: retentionError
  } = useQuery({
    queryKey: ['retention-data', userId],
    queryFn: async (): Promise<RetentionData> => {
      const response = await fetch(`/api/user/${userId}/analytics/retention`)
      if (!response.ok) {
        throw new Error('Failed to fetch retention data')
      }
      return response.json()
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  })

  // Fetch segment data
  const {
    data: segmentData,
    isLoading: isSegmentLoading,
    error: segmentError
  } = useQuery({
    queryKey: ['segment-data', userId],
    queryFn: async (): Promise<SegmentData> => {
      const response = await fetch(`/api/user/${userId}/analytics/segment`)
      if (!response.ok) {
        throw new Error('Failed to fetch segment data')
      }
      return response.json()
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  })

  // Export analytics mutation
  const exportAnalyticsMutation = useMutation({
    mutationFn: async (format: 'csv' | 'json' | 'pdf') => {
      const response = await fetch(`/api/user/${userId}/analytics/export?format=${format}&range=${timeRange}`)
      if (!response.ok) {
        throw new Error('Failed to export analytics')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `behavior-analytics-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      return { success: true }
    },
  })

  // Track custom event mutation
  const trackEventMutation = useMutation({
    mutationFn: async ({ event, properties }: { event: string; properties?: Record<string, any> }) => {
      const response = await fetch(`/api/user/${userId}/analytics/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event, properties, timestamp: Date.now() }),
      })
      if (!response.ok) {
        throw new Error('Failed to track event')
      }
      return response.json()
    },
  })

  // Helper functions
  const getEngagementLevel = useCallback(() => {
    const score = behaviorData?.engagementScore || 0
    if (score >= 80) return 'high'
    if (score >= 60) return 'medium'
    if (score >= 40) return 'low'
    return 'very-low'
  }, [behaviorData])

  const getTopFeatures = useCallback((limit: number = 5) => {
    if (!featureAdoption?.features) return []
    return featureAdoption.features
      .sort((a, b) => b.usage - a.usage)
      .slice(0, limit)
  }, [featureAdoption])

  const getUnusedFeatures = useCallback(() => {
    if (!featureAdoption?.features) return []
    return featureAdoption.features.filter((f: any) => f.usage === 0)
  }, [featureAdoption])

  const getPeakActivityTime = useCallback(() => {
    if (!activityPatterns?.hourlyActivity) return null
    return activityPatterns.hourlyActivity.reduce((peak, current: any) => 
      current.activity > peak.activity ? current : peak
    )
  }, [activityPatterns])

  const getSessionTrend = useCallback(() => {
    if (!behaviorData?.sessionHistory || behaviorData.sessionHistory.length < 2) return 'stable'
    
    const recent = behaviorData.sessionHistory.slice(-7)
    const older = behaviorData.sessionHistory.slice(-14, -7)
    
    if (older.length === 0) return 'stable'
    
    const recentAvg = recent.reduce((sum, day: any) => sum + day.sessions, 0) / recent.length
    const olderAvg = older.reduce((sum, day: any) => sum + day.sessions, 0) / older.length
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100
    
    if (change > 10) return 'increasing'
    if (change < -10) return 'decreasing'
    return 'stable'
  }, [behaviorData])

  const getChurnRisk = useCallback(() => {
    if (!retentionData?.churnPrediction) return 'low'
    const score = retentionData.churnPrediction.riskScore
    if (score >= 80) return 'high'
    if (score >= 60) return 'medium'
    return 'low'
  }, [retentionData])

  const getFeatureAdoptionRate = useCallback(() => {
    if (!featureAdoption?.features || !behaviorData?.totalFeatures) return 0
    const adoptedFeatures = featureAdoption.features.filter((f: any) => f.usage > 0).length
    return (adoptedFeatures / behaviorData.totalFeatures) * 100
  }, [featureAdoption, behaviorData])

  const getAverageSessionsPerDay = useCallback(() => {
    if (!behaviorData?.sessionHistory) return 0
    const totalSessions = behaviorData.sessionHistory.reduce((sum, day: any) => sum + day.sessions, 0)
    return totalSessions / behaviorData.sessionHistory.length
  }, [behaviorData])

  const getMostActiveDay = useCallback(() => {
    if (!activityPatterns?.weeklyActivity) return null
    return activityPatterns.weeklyActivity.reduce((max, current: any) => 
      current.activity > max.activity ? current : max
    )
  }, [activityPatterns])

  const getJourneyCompletionRate = useCallback(() => {
    if (!userJourney?.journeySteps) return 0
    const totalSteps = userJourney.journeySteps.length
    const completedSteps = userJourney.journeySteps.filter((step: any) => step.completionRate > 50).length
    return (completedSteps / totalSteps) * 100
  }, [userJourney])

  // Action functions
  const exportAnalytics = useCallback(async (format: 'csv' | 'json' | 'pdf') => {
    return exportAnalyticsMutation.mutateAsync(format)
  }, [exportAnalyticsMutation])

  const trackEvent = useCallback(async (event: string, properties?: Record<string, any>) => {
    return trackEventMutation.mutateAsync({ event, properties })
  }, [trackEventMutation])

  const refreshAnalytics = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['user-behavior', userId, timeRange] }),
      queryClient.invalidateQueries({ queryKey: ['activity-patterns', userId, timeRange] }),
      queryClient.invalidateQueries({ queryKey: ['feature-adoption', userId, timeRange] }),
      queryClient.invalidateQueries({ queryKey: ['user-journey', userId, timeRange] }),
      queryClient.invalidateQueries({ queryKey: ['retention-data', userId] }),
      queryClient.invalidateQueries({ queryKey: ['segment-data', userId] })
    ])
  }, [queryClient, userId, timeRange])

  const isLoading = isBehaviorLoading || isPatternsLoading || isAdoptionLoading || 
                   isJourneyLoading || isRetentionLoading || isSegmentLoading
  const error = behaviorError || patternsError || adoptionError || 
               journeyError || retentionError || segmentError

  return {
    // Data
    behaviorData,
    activityPatterns,
    featureAdoption,
    userJourney,
    retentionData,
    segmentData,
    
    // Loading states
    isLoading,
    isBehaviorLoading,
    isPatternsLoading,
    isAdoptionLoading,
    isJourneyLoading,
    isRetentionLoading,
    isSegmentLoading,
    isExporting: exportAnalyticsMutation.isPending,
    isTracking: trackEventMutation.isPending,
    
    // Errors
    error: error?.message || null,
    behaviorError: behaviorError?.message || null,
    patternsError: patternsError?.message || null,
    adoptionError: adoptionError?.message || null,
    journeyError: journeyError?.message || null,
    retentionError: retentionError?.message || null,
    segmentError: segmentError?.message || null,
    exportError: exportAnalyticsMutation.error?.message || null,
    trackError: trackEventMutation.error?.message || null,
    
    // Actions
    exportAnalytics,
    trackEvent,
    refreshAnalytics,
    
    // Helpers
    getEngagementLevel,
    getTopFeatures,
    getUnusedFeatures,
    getPeakActivityTime,
    getSessionTrend,
    getChurnRisk,
    getFeatureAdoptionRate,
    getAverageSessionsPerDay,
    getMostActiveDay,
    getJourneyCompletionRate,
  }
}

export default useBehaviorAnalytics