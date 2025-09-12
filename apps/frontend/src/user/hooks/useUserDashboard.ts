'use client'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface UserStats {
  name: string
  email: string
  avatar?: string
  tokenUsage: {
    used: number
    limit: number
    resetDate: string
  }
  activityScore: number
  activityGrowth: number
  memberSince: string
  daysSinceMember: number
  achievements: Array<{
    title: string
    description: string
    earnedAt: string
    icon?: string
  }>
  bookmarks: Array<{
    title: string
    url: string
    createdAt: string
  }>
  usageBreakdown: Array<{
    feature: string
    usage: number
    limit: number
  }>
  performanceMetrics: {
    averageResponseTime: number
    successRate: number
    totalRequests: number
    errorRate: number
  }
}

export interface SubscriptionInfo {
  plan: string
  status: 'active' | 'cancelled' | 'expired' | 'trial'
  expiresAt?: string
  features: string[]
  billing: {
    amount: number
    currency: string
    interval: 'month' | 'year'
    nextBillingDate?: string
  }
}

export interface UsageDataPoint {
  date: string
  tokens: number
  requests: number
  features: Record<string, number>
}

export interface UserNotification {
  id: string
  type: 'info' | 'warning' | 'success' | 'error'
  title: string
  message: string
  read: boolean
  createdAt: string
  actionUrl?: string
}

export interface UserActivity {
  id: string
  type: 'login' | 'api_call' | 'subscription_change' | 'profile_update' | 'feature_usage'
  description: string
  timestamp: string
  metadata?: Record<string, any>
}

export function useUserDashboard(userId: string) {
  const queryClient = useQueryClient()

  // Fetch user statistics
  const {
    data: userStats,
    isLoading: isStatsLoading,
    error: statsError,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['user-stats', userId],
    queryFn: async (): Promise<UserStats> => {
      const response = await fetch(`/api/user/${userId}/stats`)
      if (!response.ok) {
        throw new Error('Failed to fetch user statistics')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch subscription information
  const {
    data: subscriptionInfo,
    isLoading: isSubscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription
  } = useQuery({
    queryKey: ['user-subscription', userId],
    queryFn: async (): Promise<SubscriptionInfo | null> => {
      const response = await fetch(`/api/user/${userId}/subscription`)
      if (!response.ok) {
        if (response.status === 404) return null // No subscription
        throw new Error('Failed to fetch subscription information')
      }
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch usage data
  const {
    data: usageData,
    isLoading: isUsageLoading,
    error: usageError,
    refetch: refetchUsage
  } = useQuery({
    queryKey: ['user-usage', userId],
    queryFn: async (): Promise<UsageDataPoint[]> => {
      const response = await fetch(`/api/user/${userId}/usage?days=30`)
      if (!response.ok) {
        throw new Error('Failed to fetch usage data')
      }
      return response.json()
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  })

  // Fetch notifications
  const {
    data: notifications,
    isLoading: isNotificationsLoading,
    error: notificationsError,
    refetch: refetchNotifications
  } = useQuery({
    queryKey: ['user-notifications', userId],
    queryFn: async (): Promise<UserNotification[]> => {
      const response = await fetch(`/api/user/${userId}/notifications?limit=20`)
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Fetch recent activities
  const {
    data: recentActivities,
    isLoading: isActivitiesLoading,
    error: activitiesError,
    refetch: refetchActivities
  } = useQuery({
    queryKey: ['user-activities', userId],
    queryFn: async (): Promise<UserActivity[]> => {
      const response = await fetch(`/api/user/${userId}/activities?limit=10`)
      if (!response.ok) {
        throw new Error('Failed to fetch recent activities')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: Partial<UserStats>) => {
      const response = await fetch(`/api/user/${userId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      })
      if (!response.ok) {
        throw new Error('Failed to update profile')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-stats', userId] })
    },
  })

  // Mark notification as read mutation
  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/user/${userId}/notifications/${notificationId}/read`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to mark notification as read')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', userId] })
    },
  })

  // Add bookmark mutation
  const addBookmarkMutation = useMutation({
    mutationFn: async (bookmark: { title: string; url: string }) => {
      const response = await fetch(`/api/user/${userId}/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookmark),
      })
      if (!response.ok) {
        throw new Error('Failed to add bookmark')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-stats', userId] })
    },
  })

  // Remove bookmark mutation
  const removeBookmarkMutation = useMutation({
    mutationFn: async (bookmarkId: string) => {
      const response = await fetch(`/api/user/${userId}/bookmarks/${bookmarkId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to remove bookmark')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-stats', userId] })
    },
  })

  // Export data mutation
  const exportDataMutation = useMutation({
    mutationFn: async (format: 'json' | 'csv') => {
      const response = await fetch(`/api/user/${userId}/export?format=${format}`)
      if (!response.ok) {
        throw new Error('Failed to export data')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `user-data-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      return { success: true }
    },
  })

  // Helper functions
  const getTokenUsagePercentage = useCallback(() => {
    if (!userStats?.tokenUsage) return 0
    return (userStats.tokenUsage.used / userStats.tokenUsage.limit) * 100
  }, [userStats])

  const getUnreadNotificationCount = useCallback(() => {
    return notifications?.filter(n => !n.read).length || 0
  }, [notifications])

  const getUsageTrend = useCallback((days: number = 7) => {
    if (!usageData || usageData.length < days) return 'stable'
    
    const recent = usageData.slice(-days)
    const older = usageData.slice(-days * 2, -days)
    
    if (older.length === 0) return 'stable'
    
    const recentAvg = recent.reduce((sum, day) => sum + day.tokens, 0) / recent.length
    const olderAvg = older.reduce((sum, day) => sum + day.tokens, 0) / older.length
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100
    
    if (change > 10) return 'increasing'
    if (change < -10) return 'decreasing'
    return 'stable'
  }, [usageData])

  const getDaysUntilReset = useCallback(() => {
    if (!userStats?.tokenUsage?.resetDate) return 0
    const resetDate = new Date(userStats.tokenUsage.resetDate)
    const now = new Date()
    const diffTime = resetDate.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }, [userStats])

  const getSubscriptionStatus = useCallback(() => {
    if (!subscriptionInfo) return 'free'
    return subscriptionInfo.status
  }, [subscriptionInfo])

  // Action functions
  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      refetchStats(),
      refetchSubscription(),
      refetchUsage(),
      refetchNotifications(),
      refetchActivities()
    ])
  }, [refetchStats, refetchSubscription, refetchUsage, refetchNotifications, refetchActivities])

  const updateProfile = useCallback(async (profileData: Partial<UserStats>) => {
    return updateProfileMutation.mutateAsync(profileData)
  }, [updateProfileMutation])

  const markNotificationRead = useCallback(async (notificationId: string) => {
    return markNotificationReadMutation.mutateAsync(notificationId)
  }, [markNotificationReadMutation])

  const addBookmark = useCallback(async (bookmark: { title: string; url: string }) => {
    return addBookmarkMutation.mutateAsync(bookmark)
  }, [addBookmarkMutation])

  const removeBookmark = useCallback(async (bookmarkId: string) => {
    return removeBookmarkMutation.mutateAsync(bookmarkId)
  }, [removeBookmarkMutation])

  const exportData = useCallback(async (format: 'json' | 'csv') => {
    return exportDataMutation.mutateAsync(format)
  }, [exportDataMutation])

  const isLoading = isStatsLoading || isSubscriptionLoading || isUsageLoading || 
                   isNotificationsLoading || isActivitiesLoading
  const error = statsError || subscriptionError || usageError || 
               notificationsError || activitiesError

  return {
    // Data
    userStats,
    subscriptionInfo,
    usageData,
    notifications,
    recentActivities,
    
    // Loading states
    isLoading,
    isStatsLoading,
    isSubscriptionLoading,
    isUsageLoading,
    isNotificationsLoading,
    isActivitiesLoading,
    isUpdatingProfile: updateProfileMutation.isPending,
    isMarkingRead: markNotificationReadMutation.isPending,
    isAddingBookmark: addBookmarkMutation.isPending,
    isRemovingBookmark: removeBookmarkMutation.isPending,
    isExporting: exportDataMutation.isPending,
    
    // Errors
    error: error?.message || null,
    statsError: statsError?.message || null,
    subscriptionError: subscriptionError?.message || null,
    usageError: usageError?.message || null,
    notificationsError: notificationsError?.message || null,
    activitiesError: activitiesError?.message || null,
    updateProfileError: updateProfileMutation.error?.message || null,
    markReadError: markNotificationReadMutation.error?.message || null,
    addBookmarkError: addBookmarkMutation.error?.message || null,
    removeBookmarkError: removeBookmarkMutation.error?.message || null,
    exportError: exportDataMutation.error?.message || null,
    
    // Actions
    refreshDashboard,
    updateProfile,
    markNotificationRead,
    addBookmark,
    removeBookmark,
    exportData,
    
    // Helpers
    getTokenUsagePercentage,
    getUnreadNotificationCount,
    getUsageTrend,
    getDaysUntilReset,
    getSubscriptionStatus,
  }
}

export default useUserDashboard