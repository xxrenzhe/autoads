import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { createSecureHandler } from '@/lib/utils/api-security'
import crypto from 'crypto'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

const CONFIG_KEY = 'api_management:rate_limit_rules'

const RateLimitRuleSchema = z.object({
  name: z.string().min(1).max(255),
  endpoint: z.string().min(1),
  method: z.string().default('ALL'),
  userRole: z.string().default('all'),
  requestsPerMinute: z.number().min(1),
  requestsPerHour: z.number().min(1),
  requestsPerDay: z.number().min(1),
  isActive: z.boolean().default(true),
  priority: z.number().default(1),
  description: z.string().optional()
})

async function handleGET(request: NextRequest, { user }: any) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  try {
    const cfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
    let rules: any[] = []
    try { rules = cfg?.value ? JSON.parse(cfg.value) : [] } catch {}
    return NextResponse.json({ success: true, data: rules })
  } catch (error) {
    console.error('Error fetching rate limit rules:', error)
    return NextResponse.json({ error: 'Failed to fetch rate limit rules' }, { status: 500 })
  }
}

async function handlePOST(request: NextRequest, { validatedData, user }: any) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  const { name, endpoint, method, userRole, requestsPerMinute, requestsPerHour, requestsPerDay, isActive, priority, description } = validatedData.body

  try {
    const nowISO = new Date().toISOString()
    const newRule = {
      id: crypto.randomUUID(),
      name,
      endpoint,
      method: (method || 'ALL').toUpperCase(),
      userRole: userRole || 'all',
      requestsPerMinute,
      requestsPerHour,
      requestsPerDay,
      isActive: isActive ?? true,
      priority: priority ?? 1,
      description: description || '',
      createdAt: nowISO,
      updatedAt: nowISO
    }

    const cfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } })
    let rules: any[] = []
    try { rules = cfg?.value ? JSON.parse(cfg.value) : [] } catch {}
    rules.unshift(newRule)
    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: JSON.stringify(rules), updatedBy: user.id, updatedAt: new Date() },
      create: { key: CONFIG_KEY, value: JSON.stringify(rules), category: 'api-management', description: 'API Management: rate limit rules', isSecret: false, createdBy: user.id, updatedBy: user.id }
    })

    return NextResponse.json({ success: true, data: newRule })
  } catch (error) {
    console.error('Error creating rate limit rule:', error)
    return NextResponse.json({ error: 'Failed to create rate limit rule' }, { status: 500 })
  }
}

export const GET = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-rate-limits:${session}`;
    }
  },
  handler: handleGET
});

export const POST = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-rate-limits-create:${session}`;
    }
  },
  validation: {
    body: [
      { field: 'name', type: 'string', required: true, min: 1, max: 255 },
      { field: 'endpoint', type: 'string', required: true, min: 1 },
      { field: 'method', type: 'string', required: false, default: 'ALL' },
      { field: 'userRole', type: 'string', required: false, default: 'all' },
      { field: 'requestsPerMinute', type: 'number', required: true, min: 1 },
      { field: 'requestsPerHour', type: 'number', required: true, min: 1 },
      { field: 'requestsPerDay', type: 'number', required: true, min: 1 },
      { field: 'isActive', type: 'boolean', required: false, default: true },
      { field: 'priority', type: 'number', required: false, default: 1 },
      { field: 'description', type: 'string', required: false }
    ]
  },
  handler: handlePOST
});
