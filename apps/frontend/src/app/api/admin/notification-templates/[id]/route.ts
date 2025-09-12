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
 * GET /api/admin/notification-templates/[id] - Get a single notification template
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult.response!
  }

  try {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: params.id }
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Notification template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: template })
  } catch (error) {
    console.error('Failed to fetch notification template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification template' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/notification-templates/[id] - Update a notification template
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult.response!
  }

  try {
    const body = await request.json()
    const { name, type, subject, content, variables, isActive } = body

    // Check if template exists
    const existingTemplate = await prisma.notificationTemplate.findUnique({
      where: { id: params.id }
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Notification template not found' },
        { status: 404 }
      )
    }

    // Check if name is being changed and already exists
    if (name && name !== existingTemplate.name) {
      const nameExists = await prisma.notificationTemplate.findUnique({
        where: { name }
      })

      if (nameExists) {
        return NextResponse.json(
          { error: 'Template name already exists' },
          { status: 409 }
        )
      }
    }

    const template = await prisma.notificationTemplate.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(subject !== undefined && { subject }),
        ...(content !== undefined && { content }),
        ...(variables !== undefined && { variables }),
        ...(isActive !== undefined && { isActive }),
      }
    })

    return NextResponse.json({
      data: template,
      message: 'Template updated successfully'
    })
  } catch (error) {
    console.error('Failed to update notification template:', error)
    return NextResponse.json(
      { error: 'Failed to update notification template' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/notification-templates/[id] - Delete a notification template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult.response!
  }

  try {
    // Check if template exists
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: params.id }
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Notification template not found' },
        { status: 404 }
      )
    }

    await prisma.notificationTemplate.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete notification template:', error)
    return NextResponse.json(
      { error: 'Failed to delete notification template' },
      { status: 500 }
    )
  }
}