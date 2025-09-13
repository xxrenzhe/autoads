import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { tokenConfigService } from '@/lib/services/token-config'
import { prisma } from '@/lib/db'
import { Prisma } from '@/lib/types/prisma-types'
import { z } from 'zod'
import { createSecureHandler } from '@/lib/utils/api-security'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

const UsageQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  feature: z.enum(['SITERANK', 'BATCHOPEN', 'CHANGELINK', 'API', 'WEBHOOK', 'NOTIFICATION', 'REPORT', 'EXPORT', 'OTHER', 'ADMIN']).optional(),
  limit: z.string().transform(Number).default("50"),
  offset: z.string().transform(Number).default("0"),
  groupBy: z.enum(['day', 'week', 'month']).default('day')
})

async function handleGET(request: NextRequest, { validatedQuery, user }: any) {
  // Transform query parameters to ensure correct types
  const query = validatedQuery || {}
  const limit = typeof query.limit === 'string' ? parseInt(query.limit, 10) : (query.limit || 50)
  const offset = typeof query.offset === 'string' ? parseInt(query.offset, 10) : (query.offset || 0)
  const startDate = query.startDate
  const endDate = query.endDate
  const feature = query.feature
  const groupBy = query.groupBy || 'day'

  // Build date range
  const dateRange = {
    start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: endDate ? new Date(endDate) : new Date()
  }

  // Get detailed usage records with optimized query
  const whereClause: any = {
    userId: user.id,
    createdAt: {
      gte: dateRange.start,
      lte: dateRange.end
    }
  }
  
  if (feature) {
    whereClause.feature = feature
  }

  // Use Promise.all for parallel queries
  const [usageRecords, totalCount, timeSeriesData] = await Promise.all([
    prisma.token_usage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.token_usage.count({ where: whereClause }),
    
    // Optimized time series aggregation using database
    prisma.token_usage.groupBy({
      by: ['feature'],
      where: whereClause,
      _sum: {
        tokensConsumed: true,
        itemCount: true
      },
      _count: {
        _all: true
      },
      orderBy: {
        feature: 'asc'
      }
    })
  ])

  // Get analytics for the period
  const analytics = await tokenConfigService.getTokenAnalytics(
    user.id,
    dateRange.start,
    dateRange.end
  )

  // Group usage by time period with optimized aggregation
  let timeSeriesGrouped: any[] = [];
  if (groupBy === 'day') {
    timeSeriesGrouped = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "createdAt")::date as date,
        SUM("tokensConsumed") as totalTokens,
        SUM("itemCount") as totalItems,
        COUNT(*) as operations
      FROM "token_usage"
      WHERE 
        "userId" = ${user.id}::text
        AND "createdAt" >= ${dateRange.start}
        AND "createdAt" <= ${dateRange.end}
        ${feature ? Prisma.sql`AND "feature" = ${feature.toUpperCase()}` : Prisma.sql``}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    ` as any[];
  } else if (groupBy === 'week') {
    timeSeriesGrouped = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('week', "createdAt")::date as date,
        SUM("tokensConsumed") as totalTokens,
        SUM("itemCount") as totalItems,
        COUNT(*) as operations
      FROM "token_usage"
      WHERE 
        "userId" = ${user.id}::text
        AND "createdAt" >= ${dateRange.start}
        AND "createdAt" <= ${dateRange.end}
        ${feature ? Prisma.sql`AND "feature" = ${feature.toUpperCase()}` : Prisma.sql``}
      GROUP BY DATE_TRUNC('week', "createdAt")
      ORDER BY date ASC
    ` as any[];
  } else if (groupBy === 'month') {
    timeSeriesGrouped = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "createdAt")::date as date,
        SUM("tokensConsumed") as totalTokens,
        SUM("itemCount") as totalItems,
        COUNT(*) as operations
      FROM "token_usage"
      WHERE 
        "userId" = ${user.id}::text
        AND "createdAt" >= ${dateRange.start}
        AND "createdAt" <= ${dateRange.end}
        ${feature ? Prisma.sql`AND "feature" = ${feature.toUpperCase()}` : Prisma.sql``}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY date ASC
    ` as any[];
  }

  // Get batch operation summaries
  const batchOperations = usageRecords
    .filter((record: any: any) => record.isBatch && record.batchId)
    .reduce((acc: Record<string, any>, record: any: any) => {
      const batchId = record.batchId!
      if (!acc[batchId]) {
        acc[batchId] = {
          batchId,
          feature: record.feature,
          operation: record.operation,
          totalTokens: 0,
          totalItems: 0,
          createdAt: record.createdAt,
          metadata: record.metadata
        }
      }
      acc[batchId].totalTokens += record.tokensConsumed
      acc[batchId].totalItems += record.itemCount
      return acc
    }, {} as Record<string, any>)

  const batchSummaries = Object.values(batchOperations)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Get forecast
  const forecast = await tokenConfigService.getTokenForecast(user.id)

  return NextResponse.json({
    success: true,
    data: {
      records: usageRecords,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      analytics: {
        ...analytics,
        period: {
          start: dateRange.start,
          end: dateRange.end,
          days: Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
        }
      },
      timeSeries: timeSeriesData,
      batchSummaries,
      forecast: {
        next30Days: forecast.projectedUsage,
        confidence: forecast.confidence,
        breakdown: forecast.breakdown
      }
    }
  })
}

// Apply rate limiting: 30 requests per minute per user for analytics data
export const GET = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
    keyGenerator: (req: NextRequest, user?: any) => {
      // Use user ID for rate limiting when authenticated
      return `token-usage:${user?.id || 'anonymous'}`;
    }
  },
  validation: {
    query: [
      { field: 'startDate', type: 'string', required: false },
      { field: 'endDate', type: 'string', required: false },
      { field: 'feature', type: 'string', required: false, enum: ['SITERANK', 'BATCHOPEN', 'CHANGELINK', 'API', 'WEBHOOK', 'NOTIFICATION', 'REPORT', 'EXPORT', 'OTHER', 'ADMIN'] },
      { field: 'limit', type: 'number', required: false, min: 1, max: 100, default: 50 },
      { field: 'offset', type: 'number', required: false, min: 0, default: 0 },
      { field: 'groupBy', type: 'string', required: false, enum: ['day', 'week', 'month'], default: 'day' }
    ]
  },
  handler: handleGET
});