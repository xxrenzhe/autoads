// Console notifications settings client (user/system scope)
export type NotificationSettings = {
  enabled: boolean
  minConfidence: number
  throttlePerMinute: number
  groupWindowSec: number
  channels: { inApp: boolean; email: boolean; webhook: boolean }
}

const BASE = '/api/go/api/v1/console'

export async function getNotificationSettings(scope: 'user'|'system' = 'user', init?: RequestInit): Promise<NotificationSettings> {
  const res = await fetch(`${BASE}/notifications/settings?scope=${encodeURIComponent(scope)}`, { method: 'GET', ...(init||{}) })
  if (!res.ok) throw new Error(`getNotificationSettings failed: ${res.status}`)
  return res.json()
}

export async function updateNotificationSettings(body: NotificationSettings, scope: 'user'|'system' = 'user', init?: RequestInit): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/notifications/settings?scope=${encodeURIComponent(scope)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...(init||{}),
  })
  if (!res.ok) throw new Error(`updateNotificationSettings failed: ${res.status}`)
  return res.json()
}

