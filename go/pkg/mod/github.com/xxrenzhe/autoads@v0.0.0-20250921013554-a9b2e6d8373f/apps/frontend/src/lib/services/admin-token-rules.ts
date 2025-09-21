// Admin Token Rules service (Next-side thin wrappers to Go console endpoints)
// All requests go through the ops proxy: /ops/console/*

export type TokenRule = {
  id?: string
  service: string
  action: string
  token_cost: number
  description?: string
  is_active?: boolean
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    credentials: 'include'
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

// List active rules (Go console returns raw rows; adapt if needed)
export async function listTokenRules(): Promise<any> {
  return requestJson<any>('/ops/console/token/rules')
}

// Upsert a rule (creates or updates via upsert on (service, action))
export async function upsertTokenRule(rule: { service: string; action: string; tokenCost: number }): Promise<any> {
  return requestJson<any>('/ops/console/token/rules', { method: 'POST', body: JSON.stringify({
    service: rule.service,
    action: rule.action,
    tokenCost: rule.tokenCost
  }) })
}

// Update by id (token_cost / is_active)
export async function updateTokenRule(id: string, patch: { tokenCost?: number; isActive?: boolean }): Promise<any> {
  return requestJson<any>(`/ops/console/token/rules/${id}`, { method: 'PUT', body: JSON.stringify({
    tokenCost: patch.tokenCost,
    isActive: patch.isActive
  }) })
}

// Disable/delete rule by id (sets is_active=false)
export async function deleteTokenRule(id: string): Promise<any> {
  return requestJson<any>(`/ops/console/token/rules/${id}`, { method: 'DELETE' })
}

