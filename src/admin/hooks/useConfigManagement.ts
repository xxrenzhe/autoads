'use client'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface ConfigItem {
  id: string
  key: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'json' | 'array'
  category: string
  description: string
  isSecret: boolean
  isRequired: boolean
  defaultValue?: any
  validation?: {
    min?: number
    max?: number
    pattern?: string
    enum?: string[]
  }
  environment: 'all' | 'development' | 'staging' | 'production'
  lastModified: string
  modifiedBy: string
  version: number
}

export interface ConfigHistory {
  id: string
  configId: string
  oldValue: any
  newValue: any
  changedBy: string
  changedAt: string
  reason?: string
  version: number
}

export function useConfigManagement() {
  const queryClient = useQueryClient()

  // Fetch all configurations
  const {
    data: configs = [],
    isLoading,
    error,
    refetch: refetchConfigs
  } = useQuery({
    queryKey: ['admin-configs'],
    queryFn: async (): Promise<ConfigItem[]> => {
      const response = await fetch('/api/admin/configs')
      if (!response.ok) {
        throw new Error('Failed to fetch configurations')
      }
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Fetch configuration categories
  const {
    data: categories = [],
    isLoading: isCategoriesLoading
  } = useQuery({
    queryKey: ['config-categories'],
    queryFn: async (): Promise<string[]> => {
      const response = await fetch('/api/admin/configs/categories')
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch configuration history
  const {
    data: configHistory = [],
    isLoading: isHistoryLoading
  } = useQuery({
    queryKey: ['config-history'],
    queryFn: async (): Promise<ConfigHistory[]> => {
      const response = await fetch('/api/admin/configs/history')
      if (!response.ok) {
        throw new Error('Failed to fetch configuration history')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Create configuration mutation
  const createConfigMutation = useMutation({
    mutationFn: async (configData: Partial<ConfigItem>) => {
      const response = await fetch('/api/admin/configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      })
      if (!response.ok) {
        throw new Error('Failed to create configuration')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-configs'] })
      queryClient.invalidateQueries({ queryKey: ['config-history'] })
    },
  })

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async ({ configId, configData }: { configId: string; configData: Partial<ConfigItem> }) => {
      const response = await fetch(`/api/admin/configs/${configId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      })
      if (!response.ok) {
        throw new Error('Failed to update configuration')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-configs'] })
      queryClient.invalidateQueries({ queryKey: ['config-history'] })
    },
  })

  // Delete configuration mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/admin/configs/${configId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete configuration')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-configs'] })
      queryClient.invalidateQueries({ queryKey: ['config-history'] })
    },
  })

  // Duplicate configuration mutation
  const duplicateConfigMutation = useMutation({
    mutationFn: async ({ configId, newKey }: { configId: string; newKey: string }) => {
      const response = await fetch(`/api/admin/configs/${configId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newKey }),
      })
      if (!response.ok) {
        throw new Error('Failed to duplicate configuration')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-configs'] })
    },
  })

  // Validate configuration mutation
  const validateConfigMutation = useMutation({
    mutationFn: async ({ configId, value }: { configId: string; value: any }) => {
      const response = await fetch(`/api/admin/configs/${configId}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      })
      if (!response.ok) {
        throw new Error('Failed to validate configuration')
      }
      return response.json()
    },
  })

  // Export configurations mutation
  const exportConfigsMutation = useMutation({
    mutationFn: async ({ format, configIds }: { format: 'json' | 'yaml' | 'env'; configIds?: string[] }) => {
      const params = new URLSearchParams({ format })
      if (configIds && configIds.length > 0) {
        params.append('ids', configIds.join(','))
      }
      
      const response = await fetch(`/api/admin/configs/export?${params}`)
      if (!response.ok) {
        throw new Error('Failed to export configurations')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `configs-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      return { success: true }
    },
  })

  // Import configurations mutation
  const importConfigsMutation = useMutation({
    mutationFn: async ({ file, merge }: { file: File; merge: boolean }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('merge', String(merge))
      
      const response = await fetch('/api/admin/configs/import', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        throw new Error('Failed to import configurations')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-configs'] })
      queryClient.invalidateQueries({ queryKey: ['config-history'] })
    },
  })

  // Helper functions
  const getConfigById = useCallback((configId: string): ConfigItem | undefined => {
    return configs.find(config => config.id === configId)
  }, [configs])

  const getConfigByKey = useCallback((key: string): ConfigItem | undefined => {
    return configs.find(config => config.key === key)
  }, [configs])

  const getConfigsByCategory = useCallback((category: string): ConfigItem[] => {
    return configs.filter(config => config.category === category)
  }, [configs])

  const getConfigsByEnvironment = useCallback((environment: string): ConfigItem[] => {
    return configs.filter(config => 
      config.environment === 'all' || config.environment === environment
    )
  }, [configs])

  const validateConfigValue = useCallback((config: ConfigItem, value: any): { isValid: boolean; error?: string } => {
    // Type validation
    switch (config.type) {
      case 'string':
        if (typeof value !== 'string') {
          return { isValid: false, error: 'Value must be a string' }
        }
        break
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { isValid: false, error: 'Value must be a number' }
        }
        break
      case 'boolean':
        if (typeof value !== 'boolean') {
          return { isValid: false, error: 'Value must be a boolean' }
        }
        break
      case 'json':
        try {
          if (typeof value === 'string') {
            JSON.parse(value)
          } else if (typeof value !== 'object') {
            return { isValid: false, error: 'Value must be valid JSON' }
          }
        } catch {
          return { isValid: false, error: 'Value must be valid JSON' }
        }
        break
      case 'array':
        if (!Array.isArray(value)) {
          return { isValid: false, error: 'Value must be an array' }
        }
        break
    }

    // Validation rules
    if (config.validation) {
      const { min, max, pattern, enum: enumValues } = config.validation

      if (min !== undefined && typeof value === 'number' && value < min) {
        return { isValid: false, error: `Value must be at least ${min}` }
      }

      if (max !== undefined && typeof value === 'number' && value > max) {
        return { isValid: false, error: `Value must be at most ${max}` }
      }

      if (pattern && typeof value === 'string' && !new RegExp(pattern).test(value)) {
        return { isValid: false, error: 'Value does not match required pattern' }
      }

      if (enumValues && !enumValues.includes(String(value))) {
        return { isValid: false, error: `Value must be one of: ${enumValues.join(', ')}` }
      }
    }

    return { isValid: true }
  }, [])

  const searchConfigs = useCallback((query: string): ConfigItem[] => {
    if (!query.trim()) return configs
    
    const lowercaseQuery = query.toLowerCase()
    return configs.filter(config =>
      config.key.toLowerCase().includes(lowercaseQuery) ||
      config.description.toLowerCase().includes(lowercaseQuery) ||
      config.category.toLowerCase().includes(lowercaseQuery) ||
      String(config.value).toLowerCase().includes(lowercaseQuery)
    )
  }, [configs])

  const getConfigHistory = useCallback((configId: string): ConfigHistory[] => {
    return configHistory.filter(history => history.configId === configId)
  }, [configHistory])

  // Action functions
  const createConfig = useCallback(async (configData: Partial<ConfigItem>) => {
    return createConfigMutation.mutateAsync(configData)
  }, [createConfigMutation])

  const updateConfig = useCallback(async (configId: string, configData: Partial<ConfigItem>) => {
    return updateConfigMutation.mutateAsync({ configId, configData })
  }, [updateConfigMutation])

  const deleteConfig = useCallback(async (configId: string) => {
    return deleteConfigMutation.mutateAsync(configId)
  }, [deleteConfigMutation])

  const duplicateConfig = useCallback(async (configId: string, newKey: string) => {
    return duplicateConfigMutation.mutateAsync({ configId, newKey })
  }, [duplicateConfigMutation])

  const validateConfig = useCallback(async (configId: string, value: any) => {
    return validateConfigMutation.mutateAsync({ configId, value })
  }, [validateConfigMutation])

  const exportConfigs = useCallback(async (format: 'json' | 'yaml' | 'env', configIds?: string[]) => {
    return exportConfigsMutation.mutateAsync({ format, configIds })
  }, [exportConfigsMutation])

  const importConfigs = useCallback(async (file: File, merge: boolean = false) => {
    return importConfigsMutation.mutateAsync({ file, merge })
  }, [importConfigsMutation])

  const refreshConfigs = useCallback(() => {
    refetchConfigs()
  }, [refetchConfigs])

  return {
    // Data
    configs,
    categories,
    configHistory,
    
    // Loading states
    isLoading,
    isCategoriesLoading,
    isHistoryLoading,
    isCreating: createConfigMutation.isPending,
    isUpdating: updateConfigMutation.isPending,
    isDeleting: deleteConfigMutation.isPending,
    isDuplicating: duplicateConfigMutation.isPending,
    isValidating: validateConfigMutation.isPending,
    isExporting: exportConfigsMutation.isPending,
    isImporting: importConfigsMutation.isPending,
    
    // Errors
    error: error?.message || null,
    createError: createConfigMutation.error?.message || null,
    updateError: updateConfigMutation.error?.message || null,
    deleteError: deleteConfigMutation.error?.message || null,
    duplicateError: duplicateConfigMutation.error?.message || null,
    validateError: validateConfigMutation.error?.message || null,
    exportError: exportConfigsMutation.error?.message || null,
    importError: importConfigsMutation.error?.message || null,
    
    // Actions
    createConfig,
    updateConfig,
    deleteConfig,
    duplicateConfig,
    validateConfig,
    exportConfigs,
    importConfigs,
    refreshConfigs,
    
    // Helpers
    getConfigById,
    getConfigByKey,
    getConfigsByCategory,
    getConfigsByEnvironment,
    validateConfigValue,
    searchConfigs,
    getConfigHistory,
  }
}

export default useConfigManagement