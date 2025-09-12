import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { getCacheManager } from '@/lib/cache/cache-manager'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

const AnalyticsQuerySchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  endpoint: z.string().optional(),
  limit: z.string().transform(Number).default("100"),
  offset: z.string().transform(Number).default("0")
})

interface User {
  id: string
  role: string
  email?: string
  name?: string
}

interface ValidatedData {
  query: {
    timeRange: '1h' | '24h' | '7d' | '30d'
    endpoint?: string
    limit: number
    offset: number
  }
}

function getTimeRangeDates(timeRange: string) {
  const now = new Date()
  let startDate: Date
  
  switch (timeRange) {
    case '1h':
      startDate = new Date(now.getTime() - 60 * 60 * 1000)
      break
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    default:
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }
  
  return { startDate, endDate: now }
}

async function handleGET(request: NextRequest, { validatedData, user }: { validatedData: ValidatedData, user: User }) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  const { timeRange, endpoint, limit, offset } = validatedData.query
  const cache = getCacheManager()

  // Generate cache key
  const cacheKey = `api-analytics:${JSON.stringify({ timeRange, endpoint, limit, offset })}`
  
  // Try to get from cache first (with 5 minute TTL for analytics data)
  const cached = await cache.get(cacheKey)
  if (cached) {
    return NextResponse.json({
      success: true,
      data: cached,
      cached: true
    })
  }

  // Get date range
  const { startDate, endDate } = getTimeRangeDates(timeRange)

  // Build where clause
  const whereClause: any = {
    timestamp: {
      gte: startDate,
      lte: endDate
    }
  }
  
  if (endpoint && endpoint !== 'all') {
    whereClause.endpoint = endpoint
  }

  // Optimize query by selecting only needed fields
  const [usageRecords, totalCount, topEndpoints, errorBreakdown] = await Promise.all([
    // Get paginated usage records
    prisma.apiUsage.findMany({
      where: whereClause,
      select: {
        id: true,
        userId: true,
        endpoint: true,
        method: true,
        statusCode: true,
        responseTime: true,
        timestamp: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 500),
      skip: offset
    }),
    
    // Get total count
    prisma.apiUsage.count({ where: whereClause }),
    
    // Get top endpoints
    prisma.apiUsage.groupBy({
      by: ['endpoint'],
      where: whereClause,
      _sum: { tokenConsumed: true },
      _count: { id: true },
      _avg: { responseTime: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20
    }),
    
    // Get error breakdown
    prisma.apiUsage.groupBy({
      by: ['statusCode'],
      where: {
        ...whereClause,
        statusCode: { gte: 400 }
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    })
  ])

  // Calculate summary statistics
  const summary = {
    totalRequests: usageRecords.length,
    totalErrors: usageRecords.filter(r => r.statusCode >= 400).length,
    averageResponseTime: usageRecords.reduce((sum, r) => sum + (r.responseTime || 0), 0) / usageRecords.length || 0,
    successRate: ((usageRecords.filter(r => r.statusCode < 400).length / usageRecords.length) * 100) || 0,
    requestsPerSecond: usageRecords.length / ((endDate.getTime() - startDate.getTime()) / 1000),
    uniqueUsers: new Set(usageRecords.map(r => r.userId).filter(Boolean)).size
  }

  // Get hourly data for charts
  const hourlyData = await prisma.$queryRaw`
    SELECT 
      EXTRACT(HOUR FROM timestamp) as hour,
      COUNT(*) as requests,
      SUM(CASE WHEN statusCode >= 400 THEN 1 ELSE 0 END) as errors,
      AVG(responseTime) as responseTime
    FROM api_usage
    WHERE timestamp >= ${startDate} AND timestamp <= ${endDate}
    ${endpoint && endpoint !== 'all' ? `AND endpoint = ${endpoint}` : ''}
    GROUP BY EXTRACT(HOUR FROM timestamp)
    ORDER BY hour
  ` as unknown as Array<{ hour: string; requests: number; errors: number; responseTime: number }>

  // Format hourly data
  const requestsByHour = Array.from({ length: 24 }, (_, i) => {
    const hourData = hourlyData.find((h: any) => parseInt(h.hour) === i)
    return {
      hour: `${i}:00`,
      requests: hourData?.requests || 0,
      errors: hourData?.errors || 0,
      responseTime: Math.round(hourData?.responseTime || 0)
    }
  })

  // Get user agent distribution
  const userAgentData = await prisma.$queryRaw`
    SELECT 
      userAgent,
      COUNT(*) as requests,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
    FROM api_usage
    WHERE timestamp >= ${startDate} AND timestamp <= ${endDate}
      AND userAgent IS NOT NULL
      AND userAgent != ''
    ${endpoint && endpoint !== 'all' ? `AND endpoint = ${endpoint}` : ''}
    GROUP BY userAgent
    ORDER BY requests DESC
    LIMIT 10
  ` as unknown as Array<{ userAgent: string; requests: number; percentage: number }>

  // Process top endpoints with error rates
  const processedTopEndpoints = topEndpoints.map((ep: any) => {
    const endpointRecords = usageRecords.filter(r => r.endpoint === ep.endpoint)
    const errors = endpointRecords.filter(r => r.statusCode >= 400).length
    return {
      endpoint: ep.endpoint,
      requests: ep._count.id,
      errors,
      avgResponseTime: Math.round(ep._avg.responseTime || 0),
      successRate: ((ep._count.id - errors) / ep._count.id) * 100
    }
  })

  // Process error breakdown
  const errorsByType = errorBreakdown.reduce((acc: Record<string, number>, error: any) => {
    const statusCode = error.statusCode.toString()
    const statusCategory = statusCode.charAt(0) + 'xx'
    acc[statusCategory] = (acc[statusCategory] || 0) + error._count.id
    return acc
  }, {})

  const responseData = {
    totalRequests: summary.totalRequests,
    totalErrors: summary.totalErrors,
    averageResponseTime: Math.round(summary.averageResponseTime),
    successRate: summary.successRate,
    requestsPerSecond: summary.requestsPerSecond,
    uniqueUsers: summary.uniqueUsers,
    topEndpoints: processedTopEndpoints,
    errorsByType,
    requestsByHour,
    userAgents: userAgentData,
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount
    }
  }

  // Cache the result for 5 minutes
  await cache.set(cacheKey, responseData, 300)

  return NextResponse.json({
    success: true,
    data: responseData,
    cached: false
  })
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    
    if (!session?.user?.id || !(session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const validatedData = {
      query: {
        timeRange: (searchParams.get('timeRange') as '1h' | '24h' | '7d' | '30d') || '24h',
        endpoint: searchParams.get('endpoint') || undefined,
        limit: Math.min(Math.max(parseInt(searchParams.get('limit') || '100'), 1), 1000),
        offset: Math.max(parseInt(searchParams.get('offset') || '0'), 0)
      }
    }

    // Validate timeRange enum
    if (!['1h', '24h', '7d', '30d'].includes(validatedData.query.timeRange)) {
      return NextResponse.json({ error: 'Invalid timeRange parameter' }, { status: 400 })
    }

    // Call the handler with proper typing
    return await handleGET(request, { 
      validatedData, 
      user: {
        id: session.user.id,
        role: session.user.role,
        email: session.user.email,
        name: session.user.name
      }
    })
  } catch (error) {
    console.error('Admin API analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}