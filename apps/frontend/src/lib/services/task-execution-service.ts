/**
 * 执行器最小兼容层（前端）
 * - 仅保留 UI 可能用到的轻量工具函数（UA/Referer/间隔）
 * - 具体批量访问/自动化执行已迁至 Go 后端，通过 BFF 转发调用
 */

// 极简 UA 池（稳定且足够）
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
]

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

const SOCIAL_MEDIA_REFERERS = [
  'https://www.facebook.com/',
  'https://www.youtube.com/',
  'https://x.com/'
]
let socialRefererIndex = 0

export function getReferer(
  refererOption: 'social' | 'custom',
  customReferer?: string,
  selectedSocialMedia?: string
): string | undefined {
  if (refererOption === 'custom') return customReferer || undefined
  if (selectedSocialMedia) return selectedSocialMedia
  const ref = SOCIAL_MEDIA_REFERERS[socialRefererIndex]
  socialRefererIndex = (socialRefererIndex + 1) % SOCIAL_MEDIA_REFERERS.length
  return ref
}

export function calculateInterval(baseInterval: number): number {
  if (baseInterval <= 0) return 100 // 最小间隔100ms
  return baseInterval * 1000
}

// 标记：此前前端本地执行逻辑已废弃
export const __DEPRECATED__ = true

