import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { getCacheManager } from '@/lib/cache/cache-manager'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

const AnalyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  feature: z.enum(['siterank', 'batchopen', 'adscenter']).optional(),
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
    startDate?: string
    endDate?: string
    feature?: 'siterank' | 'batchopen' | 'adscenter'
    limit: number
    offset: number
  }
}

async function handleGET(request: NextRequest, { validatedData, user }: { validatedData: ValidatedData, user: User }) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  const { startDate, endDate, feature, limit, offset } = validatedData.query
  const cache = getCacheManager()

  // Generate cache key
  const cacheKey = `token-analytics:${JSON.stringify({ startDate, endDate, feature, limit, offset })}`
  
  // Try to get from cache first (with 5 minute TTL for analytics data)
  const cached = await cache.get(cacheKey)
  if (cached) {
    return NextResponse.json({
      success: true,
      data: cached,
      cached: true
    })
  }

  // Build date range
  const dateRange = {
    start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: endDate ? new Date(endDate) : new Date()
  }

  // Build where clause
  const whereClause: any = {
    createdAt: {
      gte: dateRange.start,
      lte: dateRange.end
    }
  }
  
  if (feature) {
    whereClause.feature = feature
  }

  // Optimize query by selecting only needed fields
  const [usageRecords, totalCount] = await Promise.all([
    prisma.token_usage.findMany({
      where: whereClause,
      select: {
        id: true,
        userId: true,
        feature: true,
        operation: true,
        tokensConsumed: true,
        tokensRemaining: true,
        itemCount: true,
        isBatch: true,
        batchId: true,
        createdAt: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500), // Limit maximum records per request
      skip: offset
    }),
    prisma.token_usage.count({ where: whereClause })
  ])

  // Calculate summary statistics
  const summary = {
    totalTokens: usageRecords.reduce((sum: number, record: any) => sum + record.tokensConsumed, 0),
    totalItems: usageRecords.reduce((sum: number, record: any) => sum + (record.itemCount || 0), 0),
    totalOperations: usageRecords.length,
    averageTokensPerOperation: 0,
    efficiency: 0,
    batchOperations: usageRecords.filter((record: any) => record.isBatch).length,
    batchEfficiency: 0
  }

  if (summary.totalOperations > 0) {
    summary.averageTokensPerOperation = summary.totalTokens / summary.totalOperations
  }

  if (summary.totalItems > 0) {
    summary.efficiency = summary.totalTokens / summary.totalItems
  }

  // Calculate batch efficiency
  const batchRecords = usageRecords.filter((record: any) => record.isBatch)
  if (batchRecords.length > 0) {
    const batchTokens = batchRecords.reduce((sum: number, record: any) => sum + record.tokensConsumed, 0)
    const batchItems = batchRecords.reduce((sum: number, record: any) => sum + (record.itemCount || 0), 0)
    summary.batchEfficiency = batchItems > 0 ? batchTokens / batchItems : 0
  }

  // Get breakdown by feature
  const byFeature = await prisma.token_usage.groupBy({
    by: ['feature'],
    where: whereClause,
    _sum: {
      tokensConsumed: true,
      itemCount: true
    },
    _count: {
      _all: true
    }
  })

  const breakdown = {
    byFeature: byFeature.reduce((acc: any, item: any) => {
      acc[item.feature] = item._sum.tokensConsumed || 0
      return acc
    }, {} as Record<string, number>),
    topUsers: [] as any[]
  }

  // Get top users by token consumption
  const topUsers = await prisma.token_usage.groupBy({
    by: ['userId'],
    where: whereClause,
    _sum: {
      tokensConsumed: true,
      itemCount: true
    },
    _count: {
      _all: true
    },
    orderBy: {
      _sum: {
        tokensConsumed: 'desc'
      }
    },
    take: 20
  })

  // Enrich top users with user information
  const userIds = topUsers.map((user: any) => user.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true }
  })

  breakdown.topUsers = topUsers.map((userStats: any) => {
    const userInfo = users.find((u: any) => u.id === userStats.userId)
    return {
      userId: userStats.userId,
      userName: userInfo?.name,
      userEmail: userInfo?.email,
      totalTokens: userStats._sum.tokensConsumed || 0,
      totalItems: userStats._sum.itemCount || 0,
      operations: userStats._count._all
    }
  })

  const responseData = {
    records: usageRecords,
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount
    },
    summary,
    breakdown
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
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
        feature: searchParams.get('feature') as 'siterank' | 'batchopen' | 'adscenter' | undefined,
        limit: Math.min(Math.max(parseInt(searchParams.get('limit') || '100'), 1), 1000),
        offset: Math.max(parseInt(searchParams.get('offset') || '0'), 0)
      }
    }

    // Validate feature enum
    if (validatedData.query.feature && !['siterank', 'batchopen', 'adscenter'].includes(validatedData.query.feature)) {
      return NextResponse.json({ error: 'Invalid feature parameter' }, { status: 400 })
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
    console.error('Admin token analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
