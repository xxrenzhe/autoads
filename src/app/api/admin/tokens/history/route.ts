import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { createSecureHandler } from '@/lib/utils/api-security'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

const HistoryQuerySchema = z.object({
  limit: z.string().transform(Number).default("50"),
  offset: z.string().transform(Number).default("0"),
  category: z.enum(['token', 'all']).default('token')
})

async function handleGET(request: NextRequest, { validatedData, user }: any) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  const { limit, offset, category } = validatedData.query

  // Build where clause
  const whereClause: any = {}
  
  if (category === 'token') {
    whereClause.OR = [
      { action: 'UPDATE_TOKEN_CONFIG' },
      { category: 'token' }
    ]
  }

  // Get configuration change history
  const [historyRecords, totalCount] = await Promise.all([
    prisma.config_change_history.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.config_change_history.count({ where: whereClause })
  ])

  return NextResponse.json({
    success: true,
    data: {
      records: historyRecords,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    }
  })
}

export const GET = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-token-history:${session}`;
    }
  },
  validation: {
    query: [
      { field: 'limit', type: 'number', required: false, min: 1, max: 100, default: 50 },
      { field: 'offset', type: 'number', required: false, min: 0, default: 0 },
      { field: 'category', type: 'string', required: false, enum: ['token', 'all'], default: 'token' }
    ]
  },
  handler: handleGET
});