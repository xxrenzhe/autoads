import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'
import { getCacheManager } from '@/lib/cache/cache-manager'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cache = getCacheManager()
    const cacheKey = 'api-management:rate-limit:stats'
    const cached = await cache.get<any>(cacheKey)
    if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Rules are stored in SystemConfig by rate-limits route
    const cfg = await prisma.systemConfig.findUnique({ where: { key: 'api_management:rate_limit_rules' } })
    let rules: any[] = []
    try { rules = cfg?.value ? JSON.parse(cfg.value) : [] } catch {}

    const [totalBlocked, blockedToday, topBlockedEndpoints] = await Promise.all([
      prisma.apiUsage.count({ where: { timestamp: { gte: monthAgo, lte: now }, statusCode: { gte: 429 } } }),
      prisma.apiUsage.count({ where: { timestamp: { gte: dayAgo, lte: now }, statusCode: { gte: 429 } } }),
      prisma.apiUsage.groupBy({
        by: ['endpoint'],
        where: { timestamp: { gte: monthAgo, lte: now }, statusCode: { gte: 429 } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      })
    ])

    // Recent hits (approximate)
    const recent429 = await prisma.apiUsage.findMany({
      where: { timestamp: { gte: dayAgo, lte: now }, statusCode: { gte: 429 } },
      select: { endpoint: true, method: true, timestamp: true },
      orderBy: { timestamp: 'desc' },
      take: 50
    })

    const data = {
      totalRules: rules.length,
      activeRules: rules.filter((r: any) => r.isActive).length,
      totalBlocked,
      blockedToday,
      topBlockedEndpoints: topBlockedEndpoints.map((t: any) => ({ endpoint: t.endpoint, blocked: t._count.id })),
      rateLimitHits: recent429.map((r: any) => ({ endpoint: r.endpoint, userRole: 'unknown', hits: 1, timestamp: r.timestamp }))
    }

    await cache.set(cacheKey, data, 60)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Rate limit stats error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

