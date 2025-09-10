import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/enhanced-auth-middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * GET /api/admin/notification-logs/[id] - Get a single notification log
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult.response!
  }

  try {
    const notification = await prisma.notification_logs.findUnique({
      where: { id: params.id },
      include: {
        notification_templates: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification log not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: notification })
  } catch (error) {
    console.error('Failed to fetch notification log:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification log' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/notification-logs/[id] - Delete a notification log
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult.response!
  }

  try {
    await prisma.notification_logs.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Notification log deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete notification log:', error)
    return NextResponse.json(
      { error: 'Failed to delete notification log' },
      { status: 500 }
    )
  }
}