import type { components } from './types'

export type Analysis = components['schemas']['Analysis']
export type SimilarityItem = components['schemas']['SimilarityItem']
export type KeywordSuggestion = components['schemas']['KeywordSuggestion']
export type TrendPoint = components['schemas']['TrendPoint']

const BASE = '/api/go/api/v1/siterank'

export async function analyze(offerId: string, init?: RequestInit): Promise<Analysis> {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify({ offerId }),
    ...init,
  })
  if (res.status !== 202) throw new Error(`analyze failed: ${res.status}`)
  return res.json()
}

export async function getLatestByOffer(offerId: string, init?: RequestInit): Promise<Analysis> {
  const res = await fetch(`${BASE}/${encodeURIComponent(offerId)}`, { method: 'GET', ...init })
  if (!res.ok) throw new Error(`getLatestByOffer failed: ${res.status}`)
  return res.json()
}

export async function computeSimilarOffers(seedDomain: string, candidates: string[], country?: string, init?: RequestInit): Promise<SimilarityItem[]> {
  const body: any = { seedDomain, candidates }
  if (country) body.country = country
  const res = await fetch(`${BASE}/similar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...init,
  })
  if (!res.ok) throw new Error(`computeSimilarOffers failed: ${res.status}`)
  const data = await res.json()
  return data?.items || []
}

export async function suggestKeywords(seedDomain: string, options?: { country?: string; topN?: number; minScore?: number }, init?: RequestInit): Promise<KeywordSuggestion[]> {
  const body: any = { seedDomain }
  if (options?.country) body.country = options.country
  if (options?.topN) body.topN = options.topN
  if (typeof options?.minScore === 'number') body.minScore = options.minScore
  const res = await fetch(`${BASE}/keywords/suggest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...init,
  })
  if (!res.ok) throw new Error(`suggestKeywords failed: ${res.status}`)
  const data = await res.json()
  return data?.items || []
}

export async function getTrend(offerId: string, days = 30, init?: RequestInit): Promise<TrendPoint[]> {
  const res = await fetch(`${BASE}/${encodeURIComponent(offerId)}/trend?days=${encodeURIComponent(String(days))}`, { method: 'GET', ...(init||{}) })
  if (!res.ok) throw new Error(`getTrend failed: ${res.status}`)
  const data = await res.json()
  return data?.points || []
}

export async function getHistory(offerId: string, days = 30, init?: RequestInit): Promise<any[]> {
  const res = await fetch(`${BASE}/${encodeURIComponent(offerId)}/history?days=${encodeURIComponent(String(days))}`, { method: 'GET', ...(init||{}) })
  if (!res.ok) throw new Error(`getHistory failed: ${res.status}`)
  const data = await res.json()
  return data?.items || []
}
