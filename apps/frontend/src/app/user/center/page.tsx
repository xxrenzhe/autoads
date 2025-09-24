import { auth } from '@/lib/auth/v5-config'
export const dynamic = 'force-dynamic'
import UserCenter from '@/components/user/UserCenter'

/**
 * Convert PlanFeature data to the legacy features format expected by components
 */
function convertPlanFeaturesToLegacyFormat(planFeatures: any[]) {
  const features: any = { siterank: { enabled: false }, batchopen: { enabled: false }, adscenter: { enabled: false } }
  ;(planFeatures || []).forEach((feature: any) => {
    const value = feature?.metadata?.value ?? feature?.limit
    switch (feature?.featureName) {
      case 'WEBSITE_RANKING':
        features.siterank = { enabled: !!feature?.enabled, maxQueriesPerBatch: value || 100 }
        break
      case 'WEBSITE_RANKING_BATCH_LIMIT':
        if (features.siterank.enabled) features.siterank.maxQueriesPerBatch = value || 100
        break
      case 'REAL_CLICK_BASIC':
      case 'REAL_CLICK_SILENT':
        if (!features.batchopen.enabled) features.batchopen = { enabled: !!feature?.enabled }
        break
      case 'REAL_CLICK_AUTOMATED':
        features.batchopen = { enabled: !!feature?.enabled, maxUrlsPerBatch: 500, proxyRotation: !!feature?.enabled }
        break
      case 'AUTOMATED_ADS':
        features.adscenter = { enabled: !!feature?.enabled, maxAccountsManaged: value || 5 }
        break
      case 'ADS_ACCOUNT_LIMIT':
        if (features.adscenter.enabled) features.adscenter.maxAccountsManaged = value || 5
        break
    }
  })
  return features
}

async function getUserData(): Promise<any | undefined> {
  try {
    const r = await fetch('/api/go/api/v1/user/center', { cache: 'no-store' })
    if (r.ok) return await r.json()
  } catch {}
  try {
    const [profileResp, subscriptionResp, balanceResp] = await Promise.all([
      fetch('/api/go/api/v1/user/me', { cache: 'no-store' }).catch(() => undefined),
      fetch('/api/go/api/v1/user/subscription/current', { cache: 'no-store' }).catch(() => undefined),
      fetch('/api/go/api/v1/tokens/balance', { cache: 'no-store' }).catch(() => undefined),
    ])
    const profile = profileResp && (profileResp as Response).ok ? await (profileResp as Response).json() : undefined
    const subscription = subscriptionResp && (subscriptionResp as Response).ok ? await (subscriptionResp as Response).json() : undefined
    const balance = balanceResp && (balanceResp as Response).ok ? await (balanceResp as Response).json() : undefined
    if (!profile) return undefined
    return { ...profile, subscription, totalTokenBalance: balance?.total }
  } catch {
    return undefined
  }
}


export default async function UserCenterPage() {
  const session = await auth()
  if (!session?.userId) return <UserCenter />
  const user = await getUserData()
  const transformedUser = user ? {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    status: user.status,
    createdAt: typeof user.createdAt === 'string' ? user.createdAt : undefined,
    lastLoginAt: typeof user.lastLoginAt === 'string' ? user.lastLoginAt : undefined,
    tokenBalance: user.tokenBalance,
    subscriptionTokenBalance: user.subscriptionTokenBalance,
    activityTokenBalance: user.activityTokenBalance,
    purchasedTokenBalance: user.purchasedTokenBalance,
    totalTokenBalance: user.totalTokenBalance ?? user.tokenBalance,
    subscription: user.subscription ? {
      id: user.subscription.id,
      status: user.subscription.status,
      currentPeriodStart: user.subscription.currentPeriodStart,
      currentPeriodEnd: user.subscription.currentPeriodEnd,
      provider: user.subscription.provider,
      plan: user.subscription.plan ? {
        id: user.subscription.plan.id,
        name: user.subscription.plan.name,
        description: user.subscription.plan.description || '',
        price: user.subscription.plan.price,
        tokenQuota: user.subscription.plan.tokenQuota,
        features: convertPlanFeaturesToLegacyFormat(user.subscription.plan.planFeatures || [])
      } : undefined
    } : null
  } : undefined
  return <UserCenter user={transformedUser as any} />
}
