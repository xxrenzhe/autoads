'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { http } from '@/shared/http/client'

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
  return http.get<BatchOpenPermissions>('/batchopen/version', { feature: 'batchopen' })
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
  
  const key = (version === 'autoclick' ? 'automated' : (version as 'basic' | 'silent' | 'automated'))
  return {
    hasAccess: permissions?.versions[key]?.available || false,
    versionInfo: permissions?.versions[key] || null,
    isLoading: !permissions
  }
}
