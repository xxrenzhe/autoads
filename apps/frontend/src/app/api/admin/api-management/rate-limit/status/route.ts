import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'

export const dynamic = 'force-dynamic'

function parseParams(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  return {
    userId: searchParams.get('userId') || undefined,
    apiKey: searchParams.get('apiKey') || undefined,
    timeRange: (searchParams.get('timeRange') as '1h'|'24h'|'7d'|'30d') || '24h'
  }
}

function getTimeRangeDates(timeRange: string) {
  const now = new Date()
  let startDate: Date
  switch (timeRange) {
    case '1h': startDate = new Date(now.getTime() - 60 * 60 * 1000); break
    case '24h': startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break
    case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
    case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
    default: startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }
  return { startDate, endDate: new Date() }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { userId, apiKey, timeRange } = parseParams(req)
    if (!userId && !apiKey) {
      return NextResponse.json({ error: 'userId or apiKey is required' }, { status: 400 })
    }
    const { startDate, endDate } = getTimeRangeDates(timeRange)

    const where: any = { timestamp: { gte: startDate, lte: endDate } }
    if (userId) where.userId = userId
    // Note: apiKey-based stats require linking api key to requests; not available yet

    const [total, blocked, avgResp] = await Promise.all([
      prisma.apiUsage.count({ where }),
      prisma.apiUsage.count({ where: { ...where, statusCode: { gte: 429 } } }),
      prisma.apiUsage.aggregate({ where, _avg: { responseTime: true } })
    ])

    const data = {
      totalRequests: total,
      blockedRequests: blocked,
      averageResponseTime: Math.round((avgResp as any)?._avg?.responseTime || 0),
      successRate: total > 0 ? ((total - blocked) / total) * 100 : 100
    }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Rate limit status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

