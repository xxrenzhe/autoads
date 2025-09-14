import { getCachedRemoteConfig, getConfigValue, getRemoteConfig } from './remote-config'

// 获取 UI 展示用的默认 RPM（每分钟请求数），远端配置优先
export function getUiDefaultRpm(): number {
  const snap = getCachedRemoteConfig()
  if (snap) {
    const rpm = getConfigValue<number>('RateLimit.RequestsPerMinute', snap)
    if (typeof rpm === 'number' && isFinite(rpm) && rpm > 0) return rpm
  }
  const env = parseInt(process.env.RATE_LIMIT_API_REQUESTS || process.env.RATE_LIMIT_API_PER_MINUTE || '500')
  return Number.isFinite(env) && env > 0 ? env : 500
}

// 异步加载，适合在客户端初始化/刷新
export async function fetchUiDefaultRpm(): Promise<number> {
  try {
    const snap = await getRemoteConfig()
    const rpm = getConfigValue<number>('RateLimit.RequestsPerMinute', snap)
    if (typeof rpm === 'number' && isFinite(rpm) && rpm > 0) return rpm
  } catch {}
  return getUiDefaultRpm()
}

function getObject(path: string, snap: any): any {
  const parts = path.split('.');
  let cur: any = snap?.config;
  for (const p of parts) {
    if (cur && typeof cur === 'object') {
      // case-insensitive key lookup
      const keys = Object.keys(cur);
      const found = keys.find(k => k.toLowerCase() === p.toLowerCase());
      cur = typeof found !== 'undefined' ? cur[found] : undefined;
    } else {
      return undefined;
    }
  }
  return cur;
}

export function getPlanFeatureRpmSync(planId?: string, featureKey?: string): { planRpm?: number, featureRpm?: number } {
  const snap = getCachedRemoteConfig();
  if (!snap) return {};
  let planRpm: number | undefined;
  let featureRpm: number | undefined;
  // Plan-level
  if (planId) {
    const trees = [ 'RateLimit.Plans', 'rate_limit.plans' ];
    for (const base of trees) {
      const plans = getObject(base, snap);
      if (plans && typeof plans === 'object') {
        const keys = Object.keys(plans);
        const key = keys.find(k => k.toLowerCase() === String(planId).toLowerCase());
        const obj = key ? plans[key] : undefined;
        if (obj && typeof obj === 'object') {
          const rpm = obj.RPM ?? obj.rpm;
          const rps = obj.RPS ?? obj.rps;
          if (typeof rpm === 'number' && rpm > 0) { planRpm = rpm; break; }
          if (typeof rps === 'number' && rps > 0) { planRpm = Math.round(rps * 60); break; }
        }
      }
    }
  }
  // Feature-level
  if (featureKey) {
    const trees = [ 'RateLimit.Features', 'rate_limit.features' ];
    for (const base of trees) {
      const feats = getObject(base, snap);
      if (feats && typeof feats === 'object') {
        const keys = Object.keys(feats);
        const key = keys.find(k => k.toLowerCase() === String(featureKey).toLowerCase());
        const obj = key ? feats[key] : undefined;
        if (obj && typeof obj === 'object') {
          const rpm = obj.RPM ?? obj.rpm;
          const rps = obj.RPS ?? obj.rps;
          if (typeof rpm === 'number' && rpm > 0) { featureRpm = rpm; break; }
          if (typeof rps === 'number' && rps > 0) { featureRpm = Math.round(rps * 60); break; }
        }
      }
    }
  }
  return { planRpm, featureRpm };
}

