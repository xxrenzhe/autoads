import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withApiProtection } from '@/lib/api-utils'

const KEY = 'siterank:settings'

async function handleGET(): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!me || (me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const row = await prisma.systemConfig.findUnique({ where: { key: KEY } })
  let data: any = { mapping: {}, weights: { globalRank: 0.6, monthlyVisits: 0.4 } }
  if (row?.value) { try { data = JSON.parse(row.value) } catch {} }
  return NextResponse.json({ success: true, data })
}

async function handlePUT(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now()
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!me || (me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const value = JSON.stringify({ mapping: body.mapping || {}, weights: body.weights || { globalRank: 0.6, monthlyVisits: 0.4 } })
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY } })
  if (existing) {
    await prisma.systemConfig.update({ where: { key: KEY }, data: { value, updatedBy: session.user.id } })
  } else {
    await prisma.systemConfig.create({ data: { key: KEY, value, category: 'siterank', description: 'SiteRank mapping and weights', createdBy: session.user.id, updatedBy: session.user.id } })
  }
  const res = NextResponse.json({ success: true })
  try { res.headers.set('Server-Timing', `upstream;dur=${Date.now() - t0}`) } catch {}
  return res
}

export const GET = withApiProtection('api')(handleGET as any) as any
export const PUT = withApiProtection('api')(handlePUT as any) as any

