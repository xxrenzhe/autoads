import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { getCacheManager } from '@/lib/cache/cache-manager'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

const PerformanceQuerySchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  endpoint: z.string().optional()
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

  const { timeRange, endpoint } = validatedData.query
  const cache = getCacheManager()

  // Generate cache key
  const cacheKey = `api-performance:${JSON.stringify({ timeRange, endpoint })}`
  
  // Try to get from cache first (with 5 minute TTL for performance data)
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

  // Get performance metrics using optimized queries
  const [
    allResponseTimes,
    p50Data,
    p95Data,
    p99Data,
    errorStats,
    totalRequests,
    timeSpan
  ] = await Promise.all([
    // Get all response times for percentile calculations
    prisma.apiUsage.findMany({
      where: whereClause,
      select: { responseTime: true, statusCode: true }
    }),
    
    // P50 response time
    prisma.$queryRaw`
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY responseTime) as p50
      FROM api_usage
      WHERE timestamp >= ${startDate} AND timestamp <= ${endDate}
      ${endpoint && endpoint !== 'all' ? `AND endpoint = ${endpoint}` : ''}
    ` as unknown as Array<{ p50: number }>,
    
    // P95 response time
    prisma.$queryRaw`
      SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY responseTime) as p95
      FROM api_usage
      WHERE timestamp >= ${startDate} AND timestamp <= ${endDate}
      ${endpoint && endpoint !== 'all' ? `AND endpoint = ${endpoint}` : ''}
    ` as unknown as Array<{ p95: number }>,
    
    // P99 response time
    prisma.$queryRaw`
      SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY responseTime) as p99
      FROM api_usage
      WHERE timestamp >= ${startDate} AND timestamp <= ${endDate}
      ${endpoint && endpoint !== 'all' ? `AND endpoint = ${endpoint}` : ''}
    ` as unknown as Array<{ p99: number }>,
    
    // Error statistics
    prisma.apiUsage.aggregate({
      where: {
        ...whereClause,
        statusCode: { gte: 400 }
      },
      _count: { id: true }
    }),
    
    // Total requests
    prisma.apiUsage.count({ where: whereClause }),
    
    // Get time span for throughput calculation
    prisma.apiUsage.aggregate({
      where: whereClause,
      _min: { timestamp: true },
      _max: { timestamp: true }
    })
  ])

  // Calculate metrics
  const responseTimes = allResponseTimes.map((r: any) => r.responseTime || 0).filter((rt: any) => rt > 0)
  const errorCount = errorStats._count.id
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
  
  // Calculate availability (based on success rate)
  const availability = totalRequests > 0 ? ((totalRequests - errorCount) / totalRequests) * 100 : 100
  
  // Calculate throughput (requests per second)
  let throughput = 0
  if (timeSpan._min.timestamp && timeSpan._max.timestamp) {
    const timeDiffInSeconds = (timeSpan._max.timestamp.getTime() - timeSpan._min.timestamp.getTime()) / 1000
    throughput = timeDiffInSeconds > 0 ? totalRequests / timeDiffInSeconds : 0
  }

  const performanceMetrics = {
    p50ResponseTime: Math.round(p50Data[0]?.p50 || 0),
    p95ResponseTime: Math.round(p95Data[0]?.p95 || 0),
    p99ResponseTime: Math.round(p99Data[0]?.p99 || 0),
    errorRate: parseFloat(errorRate.toFixed(2)),
    throughput: parseFloat(throughput.toFixed(2)),
    availability: parseFloat(availability.toFixed(2))
  }

  // Cache the result for 5 minutes
  await cache.set(cacheKey, performanceMetrics, 300)

  return NextResponse.json({
    success: true,
    data: performanceMetrics,
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
        endpoint: searchParams.get('endpoint') || undefined
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
    console.error('Admin API performance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}