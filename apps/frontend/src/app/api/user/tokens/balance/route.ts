import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { TokenExpirationService } from '@/lib/services/token-expiration-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/user/tokens/balance
 * Returns a normalized balance summary for analytics widgets
 */
// 简单的服务端内存缓存（同进程有效，Serverless 冷启动会失效）
type CacheEntry = { expiresAt: number; payload: any }
const serverCache = new Map<string, CacheEntry>()

function makeCacheKey(userId: string, params: URLSearchParams) {
  const days = params.get('days') || '30'
  const feature = params.get('feature') || ''
  const includeOps = params.get('includeOpsCount') || 'false'
  return `${userId}|days=${days}|feature=${feature}|ops=${includeOps}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // 读取筛选参数
    const daysParam = parseInt(searchParams.get('days') || '30', 10)
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 30
    const featureFilter = searchParams.get('feature') || undefined
    const includeOpsCount = (searchParams.get('includeOpsCount') || 'false') === 'true'

    // 简单服务端缓存（默认 5s，可通过 ?cacheTtlMs= 覆盖，最大 60s）
    const cacheTtlParam = parseInt(searchParams.get('cacheTtlMs') || '5000', 10)
    const cacheTtlMs = Number.isFinite(cacheTtlParam)
      ? Math.min(Math.max(cacheTtlParam, 0), 60_000)
      : 5000

    const cacheKey = makeCacheKey(session.userId, searchParams)
    const now = Date.now()
    const cached = serverCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return new NextResponse(JSON.stringify(cached.payload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // 避免中间层共享缓存，允许浏览器短期私有缓存
          'Cache-Control': 'private, max-age=5'
        }
      })
    }

    // Current user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, tokenBalance: true }
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Current subscription and plan quota
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.userId,
        status: 'ACTIVE',
        currentPeriodEnd: { gt: new Date() }
      },
      include: { plan: true }
    })
    const planQuota = subscription?.plan?.tokenQuota ?? 100

    // Usage window（默认最近 30 天，可由 days 指定上限 365 天）
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const monthlyUsageAgg = await prisma.token_usage.aggregate({
      where: {
        userId: session.userId,
        createdAt: { gte: since }
      },
      _sum: { tokensConsumed: true },
      _count: { _all: true }
    })

    const monthlyUsage = monthlyUsageAgg._sum.tokensConsumed || 0
    const operationsCount = includeOpsCount ? (monthlyUsageAgg._count._all || 0) : undefined

    // Feature breakdown for analytics（使用简化方式，避免 groupBy 类型差异）
    const recentForBreakdown = await prisma.token_usage.findMany({
      where: { userId: session.userId, createdAt: { gte: since } },
      select: { feature: true, tokensConsumed: true }
    })
    const analyticsByFeature = recentForBreakdown.reduce((acc: Record<string, number>, row: any) => {
      const key = String(row.feature)
      // 可选 feature 过滤
      if (featureFilter && key !== featureFilter) return acc
      acc[key] = (acc[key] || 0) + (row.tokensConsumed || 0)
      return acc
    }, {} as Record<string, number>)

    // Efficiency = tokens per item (approx), derive from last 30 days
    const itemAgg = await prisma.token_usage.aggregate({
      where: { userId: session.userId, createdAt: { gte: since } },
      _sum: { itemCount: true }
    })
    const totalItems = itemAgg._sum.itemCount || 0
    const efficiency = totalItems > 0 ? monthlyUsage / totalItems : 0

    // Average daily
    const averageDaily = monthlyUsage / Math.max(1, days)

    // Forecasts (simple projection)
    const projectedUsage = averageDaily * Math.max(1, days)
    const confidence = 0.7
    const willExceedQuota = projectedUsage > planQuota

    // Days until depletion at current usage
    const daysUntilDepletion = averageDaily > 0 ? Math.max(1, Math.floor(user.tokenBalance / averageDaily)) : null

    const result: any = {
      currentBalance: user.tokenBalance || 0,
      monthlyUsage,
      planQuota,
      usagePercentage: planQuota > 0 ? Math.min(100, Math.round((monthlyUsage / planQuota) * 100)) : 0,
      remainingQuota: Math.max(0, planQuota - monthlyUsage),
      forecast: {
        projectedUsage,
        confidence,
        willExceedQuota,
        daysUntilDepletion
      },
      analytics: {
        averageDaily,
        byFeature: analyticsByFeature,
        efficiency
      }
    }

    if (includeOpsCount) {
      result.operationsCount = operationsCount
    }
    const payload = { success: true, data: result }

    // 写入服务端缓存
    if (cacheTtlMs > 0) {
      serverCache.set(cacheKey, { expiresAt: now + cacheTtlMs, payload })
    }

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=5'
      }
    })
  } catch (error) {
    console.error('Get user token balance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
