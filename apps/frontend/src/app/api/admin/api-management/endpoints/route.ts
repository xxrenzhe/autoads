import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/v5-config'
import { getCacheManager } from '@/lib/cache/cache-manager'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

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

function idFor(method: string, path: string) {
  return crypto.createHash('sha1').update(`${method}:${path}`).digest('hex')
}

async function getStoredEndpoints() {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
  if (!cfg) return null
  try {
    const parsed = JSON.parse(cfg.value)
    return Array.isArray(parsed) ? parsed as APIEndpoint[] : null
  } catch {
    return null
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

async function buildEndpointsFromUsage(): Promise<APIEndpoint[]> {
  // Aggregate endpoints from usage logs for a quick, schema-free baseline
  // Use raw SQL for efficiency across large datasets
  const rows = await prisma.$queryRawUnsafe<Array<{
    endpoint: string
    method: string
    totalrequests: number
    errorcount: number
    avgresponsetime: number | null
    lastaccessed: Date | null
  }>>(`
    SELECT 
      endpoint,
      method,
      COUNT(*) AS totalRequests,
      SUM(CASE WHEN statusCode >= 400 THEN 1 ELSE 0 END) AS errorCount,
      AVG(responseTime) AS avgResponseTime,
      MAX(timestamp) AS lastAccessed
    FROM api_usages
    GROUP BY endpoint, method
    ORDER BY COUNT(*) DESC
    LIMIT 200
  `)

  const nowISO = new Date().toISOString()
  return rows.map((r: any) => {
    const total = Number(r.totalrequests || r.totalRequests || 0)
    const errors = Number(r.errorcount || r.errorCount || 0)
    const avg = Number(r.avgresponsetime || r.avgResponseTime || 0)
    const method = (r.method || 'GET').toString().toUpperCase()
    const path = (r.endpoint || '/').toString()
    return {
      id: idFor(method, path),
      path,
      method,
      description: '',
      isActive: true,
      rateLimitPerMinute: 60,
      rateLimitPerHour: 1000,
      requiresAuth: true,
      requiredRole: 'USER',
      responseTime: Math.round(avg) || 0,
      successRate: total > 0 ? ((total - errors) / total) * 100 : 100,
      totalRequests: total,
      errorCount: errors,
      lastAccessed: r.lastaccessed ? new Date(r.lastaccessed).toISOString() : null,
      createdAt: nowISO,
      updatedAt: nowISO
    } as APIEndpoint
  })
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cache = getCacheManager()
    const cacheKey = 'api-management:endpoints:list'
    const cached = await cache.get<APIEndpoint[]>(cacheKey)
    if (cached) {
      return NextResponse.json({ success: true, data: cached, cached: true })
    }

    let endpoints = await getStoredEndpoints()
    if (!endpoints) {
      endpoints = await buildEndpointsFromUsage()
    }

    await cache.set(cacheKey, endpoints, 60) // cache 60s
    return NextResponse.json({ success: true, data: endpoints })
  } catch (err) {
    console.error('Endpoints GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const path = (body.path || '').toString()
    const method = (body.method || 'GET').toString().toUpperCase()
    if (!path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const endpoint: APIEndpoint = {
      id: idFor(method, path),
      path,
      method,
      description: body.description || '',
      isActive: body.isActive ?? true,
      rateLimitPerMinute: Number(body.rateLimitPerMinute ?? 60),
      rateLimitPerHour: Number(body.rateLimitPerHour ?? 1000),
      requiresAuth: body.requiresAuth ?? true,
      requiredRole: body.requiredRole || 'USER',
      responseTime: 0,
      successRate: 100,
      totalRequests: 0,
      errorCount: 0,
      lastAccessed: null,
      createdAt: now,
      updatedAt: now
    }

    const current = (await getStoredEndpoints()) || []
    const exists = current.find(e => e.id === endpoint.id)
    const list = exists ? current.map(e => (e.id === endpoint.id ? endpoint : e)) : [endpoint, ...current]
    await saveEndpoints(session.user.id, list)

    await getCacheManager().delete('api-management:endpoints:list')

    return NextResponse.json({ success: true, data: endpoint })
  } catch (err) {
    console.error('Endpoints POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

