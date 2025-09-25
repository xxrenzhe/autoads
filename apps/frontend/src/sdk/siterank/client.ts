import type { components } from './types'

export type Analysis = components['schemas']['Analysis']

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

