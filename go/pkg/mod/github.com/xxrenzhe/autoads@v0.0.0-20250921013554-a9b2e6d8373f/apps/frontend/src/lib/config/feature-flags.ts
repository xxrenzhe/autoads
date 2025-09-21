import { getCachedRemoteConfig, getConfigValue } from './remote-config'

// 通用特性开关读取（远端只读配置优先，ENV 兜底）
export function flagEnabled(name: string, envVar?: string, defaultValue = false): boolean {
  const snap = getCachedRemoteConfig()
  let v: any
  if (snap) {
    // 支持多种命名：feature_flags.<name> / FeatureFlags.<Name> / features.<name>
    const candidates = [
      `feature_flags.${name}`,
      `FeatureFlags.${name}`,
      `features.${name}`,
      `Features.${name}`,
    ]
    for (const p of candidates) {
      const got = getConfigValue<any>(p, snap)
      if (typeof got === 'boolean') { v = got; break }
      if (typeof got === 'string') { v = got.toLowerCase() === 'true'; break }
      if (typeof got === 'number') { v = got !== 0; break }
    }
  }
  if (typeof v === 'boolean') return v
  if (envVar) return (process.env[envVar] || '').toLowerCase() === 'true'
  return defaultValue
}

// 具体快捷函数
export const paymentsEnabled = () => flagEnabled('payments_enabled', 'NEXT_PUBLIC_PAYMENTS_ENABLED', false)
export const debugModeEnabled = () => flagEnabled('debug_mode', 'NEXT_PUBLIC_DEBUG_MODE', false)
export const analyticsEnabled = () => flagEnabled('enable_analytics', 'NEXT_PUBLIC_ENABLE_ANALYTICS', true)
export const maintenanceModeEnabled = () => flagEnabled('maintenance_mode', 'NEXT_PUBLIC_MAINTENANCE_MODE', false)

