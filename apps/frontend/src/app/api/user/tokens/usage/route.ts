import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/user/tokens/usage
 * Query params: startDate?, endDate?, feature?, limit?, offset?
 * Returns user's token usage records with analytics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate') || undefined
    const endDateStr = searchParams.get('endDate') || undefined
    const feature = searchParams.get('feature') || undefined
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100'), 1), 500)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    const start = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDateStr ? new Date(endDateStr) : new Date()

    const where: any = {
      userId: session.userId,
      createdAt: { gte: start, lte: end }
    }
    if (feature) where.feature = feature

    const [records, total] = await Promise.all([
      prisma.token_usage.findMany({
        where,
        select: {
          id: true,
          feature: true,
          operation: true,
          tokensConsumed: true,
          itemCount: true,
          isBatch: true,
          batchId: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.token_usage.count({ where })
    ])

    // Analytics
    const totalTokensUsed = records.reduce((sum, r: any) => sum + (r.tokensConsumed || 0), 0)
    const totalItems = records.reduce((sum, r: any) => sum + (r.itemCount || 0), 0)
    const efficiency = totalItems > 0 ? totalTokensUsed / totalItems : 0

    // Breakdown by feature (within records page)
    const byFeature: Record<string, number> = {}
    for (const r of records) {
      const k = r.feature as unknown as string
      byFeature[k] = (byFeature[k] || 0) + (r.tokensConsumed || 0)
    }

    // Time series (day-level) based on returned window
    const dayKey = (d: Date) => d.toISOString().slice(0, 10)
    const seriesAgg: Record<string, { date: string; totalTokens: number }> = {}
    for (const r of records) {
      const key = dayKey(new Date(r.createdAt))
      if (!seriesAgg[key]) seriesAgg[key] = { date: key, totalTokens: 0 }
      seriesAgg[key].totalTokens += r.tokensConsumed || 0
    }
    const timeSeries = Object.values(seriesAgg).sort((a, b) => a.date.localeCompare(b.date))

    // Batch summaries
    const batchMap = new Map<string, { feature: string; operation: string | null; totalTokens: number; totalItems: number; createdAt: Date }>()
    for (const r of records) {
      if (!r.isBatch) continue
      const key = r.batchId || `${r.feature}-${r.operation}-${dayKey(new Date(r.createdAt))}`
      const prev = batchMap.get(key)
      if (!prev) {
        batchMap.set(key, {
          feature: String(r.feature),
          operation: r.operation || null,
          totalTokens: r.tokensConsumed || 0,
          totalItems: r.itemCount || 0,
          createdAt: r.createdAt
        })
      } else {
        prev.totalTokens += r.tokensConsumed || 0
        prev.totalItems += r.itemCount || 0
      }
    }
    const batchSummaries = Array.from(batchMap.values())

    // Simple 30-day forecast per feature based on proportion in current window
    const windowDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
    const avgDaily = totalTokensUsed / windowDays
    const next30Days = avgDaily * 30
    const featureTotal = Object.values(byFeature).reduce((s, v) => s + v, 0) || 1
    const forecastBreakdown: Record<string, number> = {}
    for (const [k, v] of Object.entries(byFeature)) {
      forecastBreakdown[k] = (v / featureTotal) * next30Days
    }

    const response = {
      records,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      analytics: {
        totalTokensUsed,
        averageDaily: avgDaily,
        efficiency,
        byFeature
      },
      timeSeries,
      batchSummaries,
      forecast: {
        next30Days,
        confidence: 0.7,
        breakdown: forecastBreakdown
      }
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('Get user token usage error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

