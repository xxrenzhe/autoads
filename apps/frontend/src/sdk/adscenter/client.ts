// Adscenter link rotation settings (frequency control)
export type LinkRotationSettings = {
  enabled: boolean
  minIntervalMinutes: number
  maxPerDayPerOffer: number
  maxPerHourPerAccount: number
  rollbackOnError: boolean
}

const BASE = '/api/go/api/v1/adscenter'

export async function getLinkRotationSettings(init?: RequestInit): Promise<LinkRotationSettings> {
  const res = await fetch(`${BASE}/settings/link-rotation`, { method: 'GET', ...(init||{}) })
  if (!res.ok) throw new Error(`getLinkRotationSettings failed: ${res.status}`)
  return res.json()
}

export async function updateLinkRotationSettings(body: LinkRotationSettings, init?: RequestInit): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/settings/link-rotation`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...(init||{}),
  })
  if (!res.ok) throw new Error(`updateLinkRotationSettings failed: ${res.status}`)
  return res.json()
}

