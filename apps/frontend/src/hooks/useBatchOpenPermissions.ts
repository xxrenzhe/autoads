'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'

export interface BatchOpenVersionInfo {
  available: boolean
  name: string
  description: string
  maxUrls: number
  maxConcurrent: number
  features: string[]
}

export interface BatchOpenPermissions {
  versions: {
    basic: BatchOpenVersionInfo
    silent: BatchOpenVersionInfo
    automated: BatchOpenVersionInfo
  }
  availableVersions: string[]
  highestVersion: string | null
  hasAnyAccess: boolean
  subscriptionBased: boolean
}

async function fetchBatchOpenPermissions(): Promise<BatchOpenPermissions> {
  const response = await fetch('/api/batchopen/version?feature=batchopen')
  if (!response.ok) {
    throw new Error('Failed to fetch batchopen permissions')
  }
  return response.json()
}

export function useBatchOpenPermissions() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['batchopen', 'permissions', session?.user?.id],
    queryFn: fetchBatchOpenPermissions,
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useBatchOpenVersion(version: string) {
  const { data: permissions } = useBatchOpenPermissions()
  
  return {
    hasAccess: permissions?.versions[version as 'basic' | 'silent' | 'automated']?.available || false,
    versionInfo: permissions?.versions[version as 'basic' | 'silent' | 'automated'] || null,
    isLoading: !permissions
  }
}