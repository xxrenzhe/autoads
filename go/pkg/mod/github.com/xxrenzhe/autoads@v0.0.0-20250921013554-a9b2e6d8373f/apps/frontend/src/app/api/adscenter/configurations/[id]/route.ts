import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'
import { withApiProtection } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Configuration = {
  id: string
  name: string
  description?: string
  payload: any
  status: 'active' | 'paused'
  createdAt: string
}

const KEY = (userId: string) => `adscenter:${userId}:configurations`

async function getConfigurations(userId: string): Promise<Configuration[]> {
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (!existing?.value) return []
  try { return JSON.parse(existing.value) as Configuration[] } catch { return [] }
}

async function setConfigurations(userId: string, configs: Configuration[], updatedBy: string) {
  const value = JSON.stringify(configs)
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (existing) {
    await prisma.systemConfig.update({ where: { key: KEY(userId) }, data: { value, updatedBy } })
  } else {
    await prisma.systemConfig.create({ data: { key: KEY(userId), value, category: 'adscenter', description: 'AdsCenter configurations', createdBy: updatedBy, updatedBy } })
  }
}

async function handleGET(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await getConfigurations(session.user.id)
  const item = list.find(c => c.id === params.id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: item })
}

async function handlePUT(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { name, description, payload, status } = body as Partial<Configuration>
  const list = await getConfigurations(session.user.id)
  const idx = list.findIndex(c => c.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const curr = list[idx]
  list[idx] = {
    ...curr,
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(payload !== undefined ? { payload } : {}),
    ...(status !== undefined ? { status: (status === 'paused' ? 'paused' : 'active') } : {}),
  }
  await setConfigurations(session.user.id, list, session.user.id)
  return NextResponse.json({ success: true, data: list[idx] })
}

async function handleDELETE(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await getConfigurations(session.user.id)
  const idx = list.findIndex(c => c.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  list.splice(idx, 1)
  await setConfigurations(session.user.id, list, session.user.id)
  return NextResponse.json({ success: true })
}

export const GET = withFeatureGuard(withApiProtection('adsCenter')(handleGET as any) as any, { featureId: 'adscenter_basic' })
export const PUT = withFeatureGuard(withApiProtection('adsCenter')(handlePUT as any) as any, { featureId: 'adscenter_basic' })
export const DELETE = withFeatureGuard(withApiProtection('adsCenter')(handleDELETE as any) as any, { featureId: 'adscenter_basic' })
