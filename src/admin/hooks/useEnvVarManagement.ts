'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'

export interface EnvironmentVariable {
  id: string
  key: string
  value: string
  isSecret: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  creator?: {
    name: string
    email: string
  }
}

// API functions
const fetchEnvVars = async (): Promise<EnvironmentVariable[]> => {
  const response = await fetch('/api/admin/env-vars')
  if (!response.ok) {
    throw new Error('Failed to fetch environment variables')
  }
  return response.json()
}

const createEnvVar = async (data: Omit<EnvironmentVariable, 'id' | 'createdAt' | 'updatedAt' | 'creator'>): Promise<EnvironmentVariable> => {
  const response = await fetch('/api/admin/env-vars', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to create environment variable')
  }
  return response.json()
}

const updateEnvVar = async (id: string, data: Partial<Omit<EnvironmentVariable, 'id' | 'createdAt' | 'updatedAt' | 'creator'>>): Promise<EnvironmentVariable> => {
  const response = await fetch('/api/admin/env-vars', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, ...data }),
  })
  if (!response.ok) {
    throw new Error('Failed to update environment variable')
  }
  return response.json()
}

const deleteEnvVar = async (id: string): Promise<void> => {
  const response = await fetch(`/api/admin/env-vars/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete environment variable')
  }
}

// React Query hooks
export const useEnvVars = () => {
  return useQuery({
    queryKey: ['env-vars'],
    queryFn: fetchEnvVars,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export const useCreateEnvVar = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createEnvVar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['env-vars'] })
      toast.success('Environment variable created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to create environment variable: ${error.message}`)
    },
  })
}

export const useUpdateEnvVar = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateEnvVar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['env-vars'] })
      toast.success('Environment variable updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed to update environment variable: ${error.message}`)
    },
  })
}

export const useDeleteEnvVar = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteEnvVar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['env-vars'] })
      toast.success('Environment variable deleted successfully')
    },
    onError: (error) => {
      toast.error(`Failed to delete environment variable: ${error.message}`)
    },
  })
}

// Utility functions
export const getEnvVarCategory = (key: string): string => {
  const categoryMap: Record<string, string> = {
    'AUTH_': 'Authentication',
    'DATABASE_': 'Database',
    'REDIS_': 'Database',
    'STRIPE_': 'Payment',
    'PAYMENT_': 'Payment',
    'NODE_': 'Application',
    'NEXT_': 'Application',
    'HTTP_': 'Performance',
    'API_': 'Performance',
    'PROXY_': 'Performance',
    'SENTRY_': 'Monitoring',
    'GA_': 'Monitoring',
    'GOOGLE_': 'Google Services',
  }

  for (const [prefix, category] of Object.entries(categoryMap)) {
    if (key.startsWith(prefix)) {
      return category
    }
  }
  
  return 'Other'
}

export const getEnvVarIcon = (category: string) => {
  const iconMap: Record<string, string> = {
    'Authentication': '🔐',
    'Database': '🗄️',
    'Payment': '💳',
    'Application': '⚙️',
    'Performance': '⚡',
    'Monitoring': '📊',
    'Google Services': '🔍',
    'Other': '📝',
  }
  
  return iconMap[category] || '📝'
}

export const formatEnvVarValue = (value: string, isSecret: boolean, showSecret: boolean = false): string => {
  if (isSecret && !showSecret) {
    return '********'
  }
  
  // Truncate long values
  if (value.length > 50) {
    return `${value.substring(0, 50)}...`
  }
  
  return value
}