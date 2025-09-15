import { backend } from '@/shared/http/backend'

type RemoteConfigSnapshot = {
  version: string
  config: any
}

type CacheEntry = {
  etag?: string
  snapshot?: RemoteConfigSnapshot
  fetchedAt: number
}

const CACHE_TTL_MS = 60_000 // 60s soft TTL
let cache: CacheEntry = { fetchedAt: 0 }

function now() { return Date.now() }

export async function getRemoteConfig(force = false): Promise<RemoteConfigSnapshot> {
  const freshEnough = !force && cache.snapshot && (now() - cache.fetchedAt) < CACHE_TTL_MS
  if (freshEnough) return cache.snapshot!

  // Use backend.get to leverage /go proxy + robust fetch + ETag store on backend util side
  // We still pass If-None-Match manually to be explicit when we hold a prior etag
  const headers: Record<string,string> = {}
  if (cache.etag) headers['If-None-Match'] = cache.etag

  // 新路由：通过 /ops → Go 的 /console/config/v1
  const res = await fetch('/ops/console/config/v1', { headers, credentials: 'include' })

  if (res.status === 304 && cache.snapshot) {
    cache.fetchedAt = now()
    return cache.snapshot
  }

  if (!res.ok) {
    // On failure, fallback to last snapshot if exists
    if (cache.snapshot) return cache.snapshot
    throw new Error(`Failed to fetch remote config: ${res.status}`)
  }

  const etag = res.headers.get('etag') || undefined
  const data = await res.json() as RemoteConfigSnapshot
  cache = { etag, snapshot: data, fetchedAt: now() }
  return data
}

export function getCachedRemoteConfig(): RemoteConfigSnapshot | null {
  return cache.snapshot || null
}

export function invalidateRemoteConfigCache(): void {
  cache = { fetchedAt: 0 }
}

export function getConfigValue<T = any>(path: string, snapshot?: RemoteConfigSnapshot): T | undefined {
  const snap = snapshot || cache.snapshot
  if (!snap || !snap.config) return undefined
  const parts = path.split('.')
  let cur: any = snap.config
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p]
    else return undefined
  }
  return cur as T
}
