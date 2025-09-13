'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface TokenConfig {
  id: string
  feature: string
  costPerToken: number
  minimumTokens: number
  maximumTokens: number
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TokenUsage {
  id: string
  userId: string
  feature: string
  tokensUsed: number
  cost: number
  timestamp: string
  metadata?: Record<string, any>
}

export interface TokenBalance {
  userId: string
  totalTokens: number
  usedTokens: number
  remainingTokens: number
  lastUpdated: string
}

export interface TokenAnalytics {
  totalUsage: number
  totalCost: number
  averageCostPerToken: number
  mostUsedFeature: string
  usageByFeature: Record<string, number>
  costByFeature: Record<string, number>
  dailyUsage: Array<{
    date: string
    tokens: number
    cost: number
  }>
}

export function useTokenManagement() {
  const queryClient = useQueryClient()

  // Fetch token configurations
  const {
    data: tokenConfigs = [],
    isLoading: isConfigsLoading,
    error: configsError
  } = useQuery({
    queryKey: ['token-configs'],
    queryFn: async (): Promise<TokenConfig[]> => {
      const response = await fetch('/api/admin/token-config')
      if (!response.ok) {
        throw new Error('Failed to fetch token configurations')
      }
      const result = await response.json()
      return result.data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch token usage analytics
  const {
    data: tokenAnalytics,
    isLoading: isAnalyticsLoading,
    error: analyticsError
  } = useQuery({
    queryKey: ['token-analytics'],
    queryFn: async (): Promise<TokenAnalytics> => {
      const response = await fetch('/api/admin/token-analytics')
      if (!response.ok) {
        throw new Error('Failed to fetch token analytics')
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 2 * 60 * 1000,
  })

  // Create token configuration
  const createConfigMutation = useMutation({
    mutationFn: async (configData: Partial<TokenConfig>) => {
      const response = await fetch('/api/admin/token-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      })
      if (!response.ok) {
        throw new Error('Failed to create token configuration')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-configs'] })
      queryClient.invalidateQueries({ queryKey: ['token-analytics'] })
    },
  })

  // Update token configuration
  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, ...configData }: Partial<TokenConfig> & { id: string }) => {
      const response = await fetch(`/api/admin/token-config/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      })
      if (!response.ok) {
        throw new Error('Failed to update token configuration')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-configs'] })
      queryClient.invalidateQueries({ queryKey: ['token-analytics'] })
    },
  })

  // Delete token configuration
  const deleteConfigMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/admin/token-config/${configId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete token configuration')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-configs'] })
      queryClient.invalidateQueries({ queryKey: ['token-analytics'] })
    },
  })

  // Toggle token configuration status
  const toggleConfigMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/admin/token-config/${configId}/toggle`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to toggle token configuration')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-configs'] })
    },
  })

  // Calculate token cost
  const calculateTokenCost = (feature: string, tokens: number): number => {
    const config = tokenConfigs.find((c: any) => c.feature === feature || c.id === feature)
    if (!config) return 0
    return tokens * config.costPerToken
  }

  // Get token configuration by feature
  const getConfigByFeature = (feature: string): TokenConfig | undefined => {
    return tokenConfigs.find((c: any) => c.feature === feature || c.id === feature)
  }

  // Validate token usage
  const validateTokenUsage = (feature: string, tokens: number): {
    valid: boolean
    error?: string
    config?: TokenConfig
  } => {
    const config = getConfigByFeature(feature)
    
    if (!config) {
      return { valid: false, error: 'Feature configuration not found' }
    }

    if (!config.isActive) {
      return { valid: false, error: 'Feature is currently disabled', config }
    }

    if (tokens < config.minimumTokens) {
      return { 
        valid: false, 
        error: `Minimum ${config.minimumTokens} tokens required`, 
        config 
      }
    }

    if (tokens > config.maximumTokens) {
      return { 
        valid: false, 
        error: `Maximum ${config.maximumTokens} tokens allowed`, 
        config 
      }
    }

    return { valid: true, config }
  }

  // Get active configurations
  const getActiveConfigs = (): TokenConfig[] => {
    return tokenConfigs.filter((config: any) => config.isActive)
  }

  // Get configuration statistics
  const getConfigStats = () => {
    const total = tokenConfigs.length
    const active = tokenConfigs.filter((c: any) => c.isActive).length
    const inactive = total - active
    const averageCost = tokenConfigs.length > 0 
      ? tokenConfigs.reduce((sum, c: any) => sum + c.costPerToken, 0) / tokenConfigs.length 
      : 0

    return {
      total,
      active,
      inactive,
      averageCost
    }
  }

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount)
  }

  // Format token amount
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`
    }
    return tokens.toString()
  }

  return {
    // Data
    tokenConfigs,
    tokenAnalytics,
    
    // Loading states
    isConfigsLoading,
    isAnalyticsLoading,
    isCreating: createConfigMutation.isPending,
    isUpdating: updateConfigMutation.isPending,
    isDeleting: deleteConfigMutation.isPending,
    isToggling: toggleConfigMutation.isPending,
    
    // Errors
    configsError: configsError?.message || null,
    analyticsError: analyticsError?.message || null,
    createError: createConfigMutation.error?.message || null,
    updateError: updateConfigMutation.error?.message || null,
    deleteError: deleteConfigMutation.error?.message || null,
    toggleError: toggleConfigMutation.error?.message || null,
    
    // Actions
    createConfig: createConfigMutation.mutateAsync,
    updateConfig: updateConfigMutation.mutateAsync,
    deleteConfig: deleteConfigMutation.mutateAsync,
    toggleConfig: toggleConfigMutation.mutateAsync,
    
    // Utilities
    calculateTokenCost,
    getConfigByFeature,
    validateTokenUsage,
    getActiveConfigs,
    getConfigStats,
    formatCurrency,
    formatTokens,
  }
}

export default useTokenManagement