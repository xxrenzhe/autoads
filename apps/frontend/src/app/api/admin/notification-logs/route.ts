import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/enhanced-auth-middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/notification-logs - Get notification logs with filtering and pagination
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult.response!
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '25')
    const sortField = searchParams.get('sortField') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'DESC'
    const q = searchParams.get('q') || ''
    const type = searchParams.get('type') || ''
    const status = searchParams.get('status') || ''

    const skip = (page - 1) * perPage

    // Build where clause
    const where: any = {}
    
    if (q) {
      where.OR = [
        { recipient: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { errorMessage: { contains: q, mode: 'insensitive' } },
      ]
    }
    
    if (type) {
      where.type = type
    }
    
    if (status) {
      where.status = status
    }

    const [data, total] = await Promise.all([
      prisma.notification_logs.findMany({
        where,
        include: {
          notification_templates: {
            select: {
              id: true,
              name: true,
              type: true,
            }
          },
          users: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: {
          [sortField]: sortOrder
        },
        skip,
        take: perPage,
      }),
      prisma.notification_logs.count({ where })
    ])

    return NextResponse.json({
      data,
      total,
      page,
      perPage,
    })
  } catch (error) {
    console.error('Failed to fetch notification logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification logs' },
      { status: 500 }
    )
  }
}