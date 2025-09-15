'use client'
import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QueryParamBuilder } from '../../lib/utils/url/QueryParamBuilder'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  status: 'active' | 'inactive' | 'suspended' | 'pending'
  role: string
  subscription?: {
    plan: string
    status: 'active' | 'cancelled' | 'expired'
    expiresAt?: string
  }
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, any>
}

export interface UserFilters {
  search?: string
  status?: string
  role?: string
  subscription?: string
  dateRange?: {
    start: string
    end: string
  }
}

export interface UserPagination {
  page: number
  limit: number
  total: number
}

export interface UserAnalytics {
  totalUsers: number
  activeUsers: number
  newUsersThisMonth: number
  userGrowthRate: number
  topRoles: Array<{ role: string; count: number }>
  usersByStatus: Array<{ status: string; count: number }>
  subscriptionDistribution: Array<{ plan: string; count: number }>
}

export function useUserManagement() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<UserFilters>({})
  const [pagination, setPagination] = useState<UserPagination>({
    page: 1,
    limit: 20,
    total: 0
  })

  // Fetch users with filters and pagination
  const {
    data: usersData,
    isLoading,
    error,
    refetch: refetchUsers
  } = useQuery<{ users: User[]; total: number }, Error>({
    queryKey: ['admin-users', filters, pagination.page, pagination.limit],
    queryFn: async () => {
      const params = QueryParamBuilder.build({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      })
      
      const response = await fetch(`/ops/api/v1/console/users?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      
      const data: { users: User[]; total: number } = await response.json()
      setPagination(prev => ({ ...prev, total: data.total }))
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch user analytics
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
    error: analyticsError
  } = useQuery<UserAnalytics, Error>({
    queryKey: ['user-analytics'],
    queryFn: async (): Promise<UserAnalytics> => {
      const response = await fetch('/ops/api/v1/console/dashboard/overview')
      if (!response.ok) {
        throw new Error('Failed to fetch user analytics')
      }
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Create user mutation
  const createUserMutation = useMutation<any, Error, Partial<User>>({
    mutationFn: async (userData: Partial<User>) => {
      const response = await fetch('/ops/api/v1/console/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })
      if (!response.ok) {
        throw new Error('Failed to create user')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-analytics'] })
    },
  })

  // Update user mutation
  const updateUserMutation = useMutation<any, Error, { userId: string; userData: Partial<User> }>({
    mutationFn: async ({ userId, userData }: { userId: string; userData: Partial<User> }) => {
      const response = await fetch(`/ops/api/v1/console/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })
      if (!response.ok) {
        throw new Error('Failed to update user')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-analytics'] })
    },
  })

  // Delete user mutation
  const deleteUserMutation = useMutation<any, Error, string>({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/ops/api/v1/console/users/${userId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete user')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-analytics'] })
    },
  })

  // Bulk actions mutation
  const bulkActionMutation = useMutation<any, Error, { action: string; userIds: string[] }>({
    mutationFn: async ({ action, userIds }: { action: string; userIds: string[] }) => {
      const response = await fetch('/ops/api/v1/console/users/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, userIds }),
      })
      if (!response.ok) {
        throw new Error(`Failed to perform bulk action: ${action}`)
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-analytics'] })
    },
  })

  // Export users mutation
  const exportUsersMutation = useMutation<{ success: boolean }, Error, 'csv' | 'json' | 'xlsx'>({
    mutationFn: async (format: 'csv' | 'json' | 'xlsx') => {
      const params = QueryParamBuilder.build({
        format,
        ...filters
      })
      
      const response = await fetch(`/ops/api/v1/console/users/export?${params}`)
      if (!response.ok) {
        throw new Error('Failed to export users')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      return { success: true }
    },
  })

  // Import users mutation
  const importUsersMutation = useMutation<any, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/ops/api/v1/console/users/import', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        throw new Error('Failed to import users')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-analytics'] })
    },
  })

  // Helper functions
  const updateFilters = useCallback((newFilters: Partial<UserFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page when filters change
  }, [])

  const updatePagination = useCallback((newPagination: Partial<UserPagination>) => {
    setPagination(prev => ({ ...prev, ...newPagination }))
  }, [])

  const refreshUsers = useCallback(() => {
    refetchUsers()
  }, [refetchUsers])

  const createUser = useCallback(async (userData: Partial<User>) => {
    return createUserMutation.mutateAsync(userData)
  }, [createUserMutation])

  const updateUser = useCallback(async (userId: string, userData: Partial<User>) => {
    return updateUserMutation.mutateAsync({ userId, userData })
  }, [updateUserMutation])

  const deleteUser = useCallback(async (userId: string) => {
    return deleteUserMutation.mutateAsync(userId)
  }, [deleteUserMutation])

  const performBulkAction = useCallback(async (action: string, userIds: string[]) => {
    return bulkActionMutation.mutateAsync({ action, userIds })
  }, [bulkActionMutation])

  const exportUsers = useCallback(async (format: 'csv' | 'json' | 'xlsx') => {
    return exportUsersMutation.mutateAsync(format)
  }, [exportUsersMutation])

  const importUsers = useCallback(async (file: File) => {
    return importUsersMutation.mutateAsync(file)
  }, [importUsersMutation])

  // Get user by ID
  const getUserById = useCallback((userId: string): User | undefined => {
    return usersData?.users?.find((user: User) => user.id === userId)
  }, [usersData])

  // Get users by role
  const getUsersByRole = useCallback((role: string): User[] => {
    return usersData?.users?.filter((user: User) => user.role === role) || []
  }, [usersData])

  // Get users by status
  const getUsersByStatus = useCallback((status: string): User[] => {
    return usersData?.users?.filter((user: User) => user.status === status) || []
  }, [usersData])

  return {
    // Data
    users: usersData?.users || [],
    totalUsers: pagination.total,
    analytics,
    filters,
    pagination,
    
    // Loading states
    isLoading,
    isAnalyticsLoading,
    isCreating: createUserMutation.isPending,
    isUpdating: updateUserMutation.isPending,
    isDeleting: deleteUserMutation.isPending,
    isBulkActioning: bulkActionMutation.isPending,
    isExporting: exportUsersMutation.isPending,
    isImporting: importUsersMutation.isPending,
    
    // Errors
    error: error?.message || null,
    analyticsError: analyticsError?.message || null,
    createError: createUserMutation.error?.message || null,
    updateError: updateUserMutation.error?.message || null,
    deleteError: deleteUserMutation.error?.message || null,
    bulkActionError: bulkActionMutation.error?.message || null,
    exportError: exportUsersMutation.error?.message || null,
    importError: importUsersMutation.error?.message || null,
    
    // Actions
    updateFilters,
    updatePagination,
    refreshUsers,
    createUser,
    updateUser,
    deleteUser,
    performBulkAction,
    exportUsers,
    importUsers,
    
    // Helpers
    getUserById,
    getUsersByRole,
    getUsersByStatus,
  }
}

export default useUserManagement
