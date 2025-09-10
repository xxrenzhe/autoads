'use client'
import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface UserNotification {
  id: string
  type: 'info' | 'warning' | 'success' | 'error' | 'system' | 'billing' | 'feature'
  title: string
  message: string
  read: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  createdAt: string
  readAt?: string
  actionUrl?: string
  actionText?: string
  category: string
  metadata?: Record<string, any>
}

export interface NotificationPreferences {
  email: {
    enabled: boolean
    types: string[]
    frequency: 'immediate' | 'daily' | 'weekly'
  }
  push: {
    enabled: boolean
    types: string[]
  }
  inApp: {
    enabled: boolean
    types: string[]
  }
}

export interface NotificationTemplate {
  id: string
  type: string
  title: string
  message: string
  category: string
  priority: string
  enabled: boolean
}

export function useNotifications(userId: string) {
  const queryClient = useQueryClient()
  const [realTimeEnabled, setRealTimeEnabled] = useState(true)

  // Fetch notifications
  const {
    data: notifications = [],
    isLoading,
    error,
    refetch: refetchNotifications
  } = useQuery({
    queryKey: ['user-notifications', userId],
    queryFn: async (): Promise<UserNotification[]> => {
      const response = await fetch(`/api/user/${userId}/notifications`)
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: realTimeEnabled ? 30 * 1000 : false, // Auto-refresh every 30 seconds
  })

  // Fetch notification preferences
  const {
    data: preferences,
    isLoading: isPreferencesLoading,
    error: preferencesError
  } = useQuery({
    queryKey: ['notification-preferences', userId],
    queryFn: async (): Promise<NotificationPreferences> => {
      const response = await fetch(`/api/user/${userId}/notifications/preferences`)
      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences')
      }
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch notification templates
  const {
    data: templates = [],
    isLoading: isTemplatesLoading,
    error: templatesError
  } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async (): Promise<NotificationTemplate[]> => {
      const response = await fetch('/api/notifications/templates')
      if (!response.ok) {
        throw new Error('Failed to fetch notification templates')
      }
      return response.json()
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  })

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
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

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/user/${userId}/notifications/read-all`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', userId] })
    },
  })

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/user/${userId}/notifications/${notificationId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete notification')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', userId] })
    },
  })

  // Delete all read notifications mutation
  const deleteAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/user/${userId}/notifications/delete-read`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete read notifications')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', userId] })
    },
  })

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<NotificationPreferences>) => {
      const response = await fetch(`/api/user/${userId}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPreferences),
      })
      if (!response.ok) {
        throw new Error('Failed to update notification preferences')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', userId] })
    },
  })

  // Create custom notification mutation
  const createNotificationMutation = useMutation({
    mutationFn: async (notificationData: Partial<UserNotification>) => {
      const response = await fetch(`/api/user/${userId}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationData),
      })
      if (!response.ok) {
        throw new Error('Failed to create notification')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', userId] })
    },
  })

  // Test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: async ({ type, channel }: { type: string; channel: 'email' | 'push' }) => {
      const response = await fetch(`/api/user/${userId}/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, channel }),
      })
      if (!response.ok) {
        throw new Error('Failed to send test notification')
      }
      return response.json()
    },
  })

  // Helper functions
  const getUnreadCount = useCallback(() => {
    return notifications.filter(n => !n.read).length
  }, [notifications])

  const getNotificationsByType = useCallback((type: string) => {
    return notifications.filter(n => n.type === type)
  }, [notifications])

  const getNotificationsByCategory = useCallback((category: string) => {
    return notifications.filter(n => n.category === category)
  }, [notifications])

  const getUrgentNotifications = useCallback(() => {
    return notifications.filter(n => n.priority === 'urgent' && !n.read)
  }, [notifications])

  const getRecentNotifications = useCallback((hours: number = 24) => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return notifications.filter(n => new Date(n.createdAt) > cutoff)
  }, [notifications])

  const hasUnreadNotifications = useCallback(() => {
    return notifications.some(n => !n.read)
  }, [notifications])

  const getNotificationStats = useCallback(() => {
    const total = notifications.length
    const unread = getUnreadCount()
    const byType = notifications.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const byPriority = notifications.reduce((acc, n) => {
      acc[n.priority] = (acc[n.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total,
      unread,
      read: total - unread,
      byType,
      byPriority
    }
  }, [notifications, getUnreadCount])

  const isNotificationEnabled = useCallback((type: string, channel: 'email' | 'push' | 'inApp') => {
    if (!preferences) return true
    return preferences[channel]?.enabled && preferences[channel]?.types.includes(type)
  }, [preferences])

  const getNextNotificationTime = useCallback(() => {
    if (!preferences?.email.enabled) return null
    
    const frequency = preferences.email.frequency
    const now = new Date()
    
    switch (frequency) {
      case 'immediate':
        return null // Immediate notifications don't have a "next" time
      case 'daily':
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(9, 0, 0, 0) // 9 AM next day
        return tomorrow
      case 'weekly':
        const nextWeek = new Date(now)
        nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay())) // Next Sunday
        nextWeek.setHours(9, 0, 0, 0)
        return nextWeek
      default:
        return null
    }
  }, [preferences])

  // Action functions
  const markAsRead = useCallback(async (notificationId: string) => {
    return markAsReadMutation.mutateAsync(notificationId)
  }, [markAsReadMutation])

  const markAllAsRead = useCallback(async () => {
    return markAllAsReadMutation.mutateAsync()
  }, [markAllAsReadMutation])

  const deleteNotification = useCallback(async (notificationId: string) => {
    return deleteNotificationMutation.mutateAsync(notificationId)
  }, [deleteNotificationMutation])

  const deleteAllRead = useCallback(async () => {
    return deleteAllReadMutation.mutateAsync()
  }, [deleteAllReadMutation])

  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    return updatePreferencesMutation.mutateAsync(newPreferences)
  }, [updatePreferencesMutation])

  const createNotification = useCallback(async (notificationData: Partial<UserNotification>) => {
    return createNotificationMutation.mutateAsync(notificationData)
  }, [createNotificationMutation])

  const testNotification = useCallback(async (type: string, channel: 'email' | 'push') => {
    return testNotificationMutation.mutateAsync({ type, channel })
  }, [testNotificationMutation])

  const refreshNotifications = useCallback(() => {
    refetchNotifications()
  }, [refetchNotifications])

  const toggleRealTime = useCallback(() => {
    setRealTimeEnabled(prev => !prev)
  }, [])

  // Browser notification support
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications')
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }

    return false
  }, [])

  const showBrowserNotification = useCallback(async (notification: UserNotification) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false
    }

    const browserNotification = new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      tag: notification.id,
      requireInteraction: notification.priority === 'urgent',
    })

    browserNotification.onclick = () => {
      window.focus()
      if (notification.actionUrl) {
        window.open(notification.actionUrl, '_blank')
      }
      markAsRead(notification.id)
      browserNotification.close()
    }

    return true
  }, [markAsRead])

  // Auto-show browser notifications for urgent unread notifications
  useEffect(() => {
    if (realTimeEnabled && notifications.length > 0) {
      const urgentUnread = getUrgentNotifications()
      urgentUnread.forEach(notification => {
        showBrowserNotification(notification)
      })
    }
  }, [notifications, realTimeEnabled, getUrgentNotifications, showBrowserNotification])

  const unreadCount = getUnreadCount()

  return {
    // Data
    notifications,
    preferences,
    templates,
    unreadCount,
    
    // Loading states
    isLoading,
    isPreferencesLoading,
    isTemplatesLoading,
    isMarkingRead: markAsReadMutation.isPending,
    isMarkingAllRead: markAllAsReadMutation.isPending,
    isDeleting: deleteNotificationMutation.isPending,
    isDeletingAllRead: deleteAllReadMutation.isPending,
    isUpdatingPreferences: updatePreferencesMutation.isPending,
    isCreating: createNotificationMutation.isPending,
    isTesting: testNotificationMutation.isPending,
    
    // Errors
    error: error?.message || null,
    preferencesError: preferencesError?.message || null,
    templatesError: templatesError?.message || null,
    markReadError: markAsReadMutation.error?.message || null,
    markAllReadError: markAllAsReadMutation.error?.message || null,
    deleteError: deleteNotificationMutation.error?.message || null,
    deleteAllReadError: deleteAllReadMutation.error?.message || null,
    updatePreferencesError: updatePreferencesMutation.error?.message || null,
    createError: createNotificationMutation.error?.message || null,
    testError: testNotificationMutation.error?.message || null,
    
    // Settings
    realTimeEnabled,
    
    // Actions
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    updatePreferences,
    createNotification,
    testNotification,
    refreshNotifications,
    toggleRealTime,
    requestNotificationPermission,
    showBrowserNotification,
    
    // Helpers
    getNotificationsByType,
    getNotificationsByCategory,
    getUrgentNotifications,
    getRecentNotifications,
    hasUnreadNotifications,
    getNotificationStats,
    isNotificationEnabled,
    getNextNotificationTime,
  }
}

export default useNotifications