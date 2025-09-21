"use client";

import { signIn, useSession } from 'next-auth/react'
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits'

export type GuardResult = { ok: boolean }

export function useFeatureGuard() {
  const { data: session } = useSession()
  const { data: subscription } = useSubscriptionLimits()

  const redirectTo = (path: string) => {
    if (typeof window !== 'undefined') { window.location.href = path }
  }

  // 通用：未登录先强制登录（回跳当前页）
  const ensureLogin = (): boolean => {
    if (!session) {
      const callback = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname + window.location.search) : ''
      redirectTo(`/auth/signin?callbackUrl=${callback}`)
      return false
    }
    return true
  }

  // AdsCenter 权限：存在 adscenter 限额配置即可视为可用
  const guardAdsCenter = (): GuardResult => {
    if (!ensureLogin()) return { ok: false }
    const allowed = !!subscription?.limits?.adscenter
    if (!allowed) { redirectTo('/pricing'); return { ok: false } }
    return { ok: true }
  }

  // AutoClick 权限：batchopen.versions 包含 'autoclick'
  const guardAutoClick = (): GuardResult => {
    if (!ensureLogin()) return { ok: false }
    const versions = subscription?.limits?.batchopen?.versions || []
    const allowed = versions.includes('autoclick') || versions.includes('automated')
    if (!allowed) { redirectTo('/pricing'); return { ok: false } }
    return { ok: true }
  }

  return { guardAdsCenter, guardAutoClick }
}

