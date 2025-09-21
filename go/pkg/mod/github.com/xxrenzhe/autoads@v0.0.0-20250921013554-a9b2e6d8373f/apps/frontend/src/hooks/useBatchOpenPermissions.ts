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
  
  // 后端可能只返回 automated 或者返回 autoclick，两者择其一
  const key = (version === 'autoclick' ? ('autoclick' as const) : (version as 'basic' | 'silent'))
  return {
    hasAccess: (permissions?.versions as any)?.[key]?.available
      || (version === 'autoclick' ? (permissions?.versions as any)?.automated?.available : false)
      || false,
    versionInfo: (permissions?.versions as any)?.[key]
      || (version === 'autoclick' ? (permissions?.versions as any)?.automated : null)
      || null,
    isLoading: !permissions
  }
}
