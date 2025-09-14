import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'
import { getCacheManager } from '@/lib/cache/cache-manager'

const CONFIG_KEY = 'api_management:endpoints'

type APIEndpoint = {
  id: string
  path: string
  method: string
  description: string
  isActive: boolean
  rateLimitPerMinute: number
  rateLimitPerHour: number
  requiresAuth: boolean
  requiredRole: string
  responseTime: number
  successRate: number
  totalRequests: number
  errorCount: number
  lastAccessed: string | null
  createdAt: string
  updatedAt: string
}

async function getStoredEndpoints() {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
  if (!cfg) return [] as APIEndpoint[]
  try {
    const parsed = JSON.parse(cfg.value)
    return Array.isArray(parsed) ? parsed as APIEndpoint[] : []
  } catch {
    return []
  }
}

async function saveEndpoints(userId: string, endpoints: APIEndpoint[]) {
  const now = new Date()
  const value = JSON.stringify(endpoints)
  await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value, updatedBy: userId, updatedAt: now },
    create: {
      key: CONFIG_KEY,
      value,
      category: 'api-management',
      description: 'API Management: endpoint catalog',
      isSecret: false,
      createdBy: userId,
      updatedBy: userId
    }
  })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = params.id
    const body = await req.json()
    const list = await getStoredEndpoints()
    const idx = list.findIndex(e => e.id === id)
    if (idx === -1) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }
    const prev = list[idx]
    const updated: APIEndpoint = {
      ...prev,
      description: body.description ?? prev.description,
      isActive: body.isActive ?? prev.isActive,
      rateLimitPerMinute: body.rateLimitPerMinute ?? prev.rateLimitPerMinute,
      rateLimitPerHour: body.rateLimitPerHour ?? prev.rateLimitPerHour,
      requiresAuth: body.requiresAuth ?? prev.requiresAuth,
      requiredRole: body.requiredRole ?? prev.requiredRole,
      path: body.path ?? prev.path,
      method: (body.method ?? prev.method).toString().toUpperCase(),
      updatedAt: new Date().toISOString()
    }
    list[idx] = updated
    await saveEndpoints(session.user.id, list)
    await getCacheManager().delete('api-management:endpoints:list')
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Endpoint PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = params.id
    const list = await getStoredEndpoints()
    const next = list.filter(e => e.id !== id)
    if (next.length === list.length) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }
    await saveEndpoints(session.user.id, next)
    await getCacheManager().delete('api-management:endpoints:list')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Endpoint DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

