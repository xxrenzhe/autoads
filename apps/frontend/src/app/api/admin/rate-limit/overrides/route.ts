import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withApiProtection } from '@/lib/api-utils'

const KEY = 'rate_limit:overrides'

async function handleGET(): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!me || (me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const row = await prisma.systemConfig.findUnique({ where: { key: KEY } })
  let data: any = {}
  if (row?.value) { try { data = JSON.parse(row.value) } catch {} }
  return NextResponse.json({ success: true, data, env: {
    RATE_LIMIT_API_PER_MINUTE: process.env.RATE_LIMIT_API_PER_MINUTE,
    RATE_LIMIT_SITERANK_PER_MINUTE: process.env.RATE_LIMIT_SITERANK_PER_MINUTE,
    RATE_LIMIT_ADSCENTER_PER_MINUTE: process.env.RATE_LIMIT_ADSCENTER_PER_MINUTE,
    RATE_LIMIT_BATCHOPEN_PER_MINUTE: process.env.RATE_LIMIT_BATCHOPEN_PER_MINUTE,
    RATE_LIMIT_AUTH_PER_MINUTE: process.env.RATE_LIMIT_AUTH_PER_MINUTE,
  } })
}

async function handlePUT(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!me || (me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const value = JSON.stringify(body || {})
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY } })
  if (existing) {
    await prisma.systemConfig.update({ where: { key: KEY }, data: { value, updatedBy: session.user.id } })
  } else {
    await prisma.systemConfig.create({ data: { key: KEY, value, category: 'limits', description: 'Rate limit overrides (pending rollout)', createdBy: session.user.id, updatedBy: session.user.id } })
  }
  return NextResponse.json({ success: true, note: 'Overrides saved. Apply by updating runtime ENV or backend config.' })
}

export const GET = withApiProtection('api')(handleGET as any) as any
export const PUT = withApiProtection('api')(handlePUT as any) as any

