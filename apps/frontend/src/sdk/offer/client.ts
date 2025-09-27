// Lightweight client wrappers using generated OpenAPI types (types.d.ts)
// Runtime uses the existing BFF proxy: /api/go/* -> API Gateway/backend

import type { components } from './types'

export type Offer = components['schemas']['Offer']
export type OfferCreateRequest = components['schemas']['OfferCreateRequest']
export type OfferCreatedEvent = components['schemas']['OfferCreatedEvent']

const BASE = '/api/go/api/v1'

export async function listOffers(init?: RequestInit): Promise<Offer[]> {
  const res = await fetch(`${BASE}/offers`, { method: 'GET', ...init })
  if (!res.ok) throw new Error(`listOffers failed: ${res.status}`)
  return res.json()
}

export async function createOffer(body: OfferCreateRequest, init?: RequestInit): Promise<OfferCreatedEvent> {
  const res = await fetch(`${BASE}/offers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...init,
  })
  if (res.status !== 202) throw new Error(`createOffer failed: ${res.status}`)
  return res.json()
}

export async function updateOfferStatus(id: string, status: string, init?: RequestInit): Promise<{ status: string; offerId: string; from: string; to: string }> {
  const res = await fetch(`${BASE}/offers/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify({ status }),
    ...init,
  })
  if (!res.ok) throw new Error(`updateOfferStatus failed: ${res.status}`)
  return res.json()
}

export async function getOfferKPI(id: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}/offers/${encodeURIComponent(id)}/kpi`, { method: 'GET', ...(init||{}) })
  if (!res.ok) throw new Error(`getOfferKPI failed: ${res.status}`)
  return res.json()
}

export async function aggregateOfferKPI(id: string, date?: string, init?: RequestInit): Promise<any> {
  const q = date ? `?date=${encodeURIComponent(date)}` : ''
  const res = await fetch(`${BASE}/offers/${encodeURIComponent(id)}/kpi/aggregate${q}`, { method: 'POST', ...(init||{}) })
  if (!res.ok) throw new Error(`aggregateOfferKPI failed: ${res.status}`)
  return res.json()
}

export async function listOfferAccounts(id: string, init?: RequestInit): Promise<{ items: { accountId: string }[] }> {
  const res = await fetch(`${BASE}/offers/${encodeURIComponent(id)}/accounts`, { method: 'GET', ...(init||{}) })
  if (!res.ok) throw new Error(`listOfferAccounts failed: ${res.status}`)
  return res.json()
}

export async function linkOfferAccount(id: string, accountId: string, init?: RequestInit): Promise<{ status: string; offerId: string; accountId: string }> {
  const res = await fetch(`${BASE}/offers/${encodeURIComponent(id)}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify({ accountId }),
    ...(init||{}),
  })
  if (!res.ok) throw new Error(`linkOfferAccount failed: ${res.status}`)
  return res.json()
}

export async function unlinkOfferAccount(id: string, accountId: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${BASE}/offers/${encodeURIComponent(id)}/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE', ...(init||{}) })
  if (res.status !== 204) throw new Error(`unlinkOfferAccount failed: ${res.status}`)
}
