import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'

export const dynamic = 'force-dynamic'

const CONFIG_KEY = 'api_management:endpoints'

type APIEndpoint = { id: string; path: string; method: string }

async function getEndpointById(id: string): Promise<APIEndpoint | null> {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
  if (!cfg) return null
  try {
    const list = JSON.parse(cfg.value) as any[]
    const found = Array.isArray(list) ? list.find((e: any) => e.id === id) : null
    return found ? { id: found.id, path: found.path, method: found.method } : null
  } catch {
    return null
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
  return { startDate, endDate: now }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = params.id
    const endpoint = await getEndpointById(id)
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const timeRange = (searchParams.get('timeRange') as '1h'|'24h'|'7d'|'30d') || '24h'
    const { startDate, endDate } = getTimeRangeDates(timeRange)

    const where = {
      endpoint: endpoint.path,
      method: endpoint.method,
      timestamp: { gte: startDate, lte: endDate }
    } as any

    const [count, errorCount, avgResp, p95, p99] = await Promise.all([
      prisma.apiUsage.count({ where }),
      prisma.apiUsage.count({ where: { ...where, statusCode: { gte: 400 } } }),
      prisma.apiUsage.aggregate({ where, _avg: { responseTime: true } }),
      prisma.$queryRawUnsafe<Array<{ p95: number }>>(`
        SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY responseTime) as p95
        FROM api_usages WHERE endpoint = $1 AND method = $2 AND timestamp BETWEEN $3 AND $4
      ` as any, endpoint.path, endpoint.method, startDate, endDate),
      prisma.$queryRawUnsafe<Array<{ p99: number }>>(`
        SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY responseTime) as p99
        FROM api_usages WHERE endpoint = $1 AND method = $2 AND timestamp BETWEEN $3 AND $4
      ` as any, endpoint.path, endpoint.method, startDate, endDate)
    ])

    const data = {
      totalRequests: count,
      errorCount,
      averageResponseTime: Math.round((avgResp as any)?._avg?.responseTime || 0),
      p95ResponseTime: Math.round((p95?.[0]?.p95 as any) || 0),
      p99ResponseTime: Math.round((p99?.[0]?.p99 as any) || 0),
      successRate: count > 0 ? ((count - errorCount) / count) * 100 : 100
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Endpoint metrics error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

