import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/enhanced-auth-middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/notification-templates - Get notification templates with filtering and pagination
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
    const isActive = searchParams.get('isActive') || ''

    const skip = (page - 1) * perPage

    // Build where clause
    const where: any = {}
    
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ]
    }
    
    if (type) {
      where.type = type
    }
    
    if (isActive !== '') {
      where.isActive = isActive === 'true'
    }

    const [data, total] = await Promise.all([
      prisma.notificationTemplate.findMany({
        where,
        orderBy: {
          [sortField]: sortOrder
        },
        skip,
        take: perPage,
      }),
      prisma.notificationTemplate.count({ where })
    ])

    return NextResponse.json({
      data,
      total,
      page,
      perPage,
    })
  } catch (error) {
    console.error('Failed to fetch notification templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification templates' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/notification-templates - Create a new notification template
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.success || !authResult.context) {
    return authResult.response!
  }

  try {
    const body = await request.json()
    const { name, type, subject, content, variables, isActive = true } = body

    // Validate required fields
    if (!name || !type || !content) {
      return NextResponse.json(
        { error: 'Name, type, and content are required' },
        { status: 400 }
      )
    }

    // Check if template name already exists
    const existingTemplate = await prisma.notificationTemplate.findUnique({
      where: { name }
    })

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'Template name already exists' },
        { status: 409 }
      )
    }

    const template = await prisma.notificationTemplate.create({
      data: {
        name,
        type,
        subject,
        content,
        variables: variables || {},
        isActive,
      }
    })

    return NextResponse.json({
      data: template,
      message: 'Template created successfully'
    })
  } catch (error) {
    console.error('Failed to create notification template:', error)
    return NextResponse.json(
      { error: 'Failed to create notification template' },
      { status: 500 }
    )
  }
}