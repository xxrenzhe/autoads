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

