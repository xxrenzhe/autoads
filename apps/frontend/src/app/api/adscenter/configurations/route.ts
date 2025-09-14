import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'

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

async function handleGET(_req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 优先从规范化表读取，回退 SystemConfig
  try {
    const rows = await prisma.adsConfiguration.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    })
    if (rows && rows.length > 0) {
      const data = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        payload: r.payload,
        status: r.status || 'active',
        createdAt: r.createdAt.toISOString()
      }))
      return NextResponse.json({ success: true, data })
    }
  } catch (e) {
    // ignore and fallback
  }
  const configs = await getConfigurations(session.user.id)
  return NextResponse.json({ success: true, data: configs })
}

async function handlePOST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { name, description, payload, status } = body as any
  if (!name || !payload) return NextResponse.json({ error: 'name and payload are required' }, { status: 400 })
  // 先写入规范化表
  let newId = ''
  try {
    const created = await prisma.adsConfiguration.create({
      data: {
        userId: session.user.id,
        name,
        description,
        payload,
        status: status === 'paused' ? 'paused' : 'active'
      }
    })
    newId = created.id
  } catch (e) {
    // ignore and continue fallback path
  }

  // 维护 SystemConfig 以保持兼容
  const list = await getConfigurations(session.user.id)
  if (!newId) newId = `cfg_${Date.now()}`
  const now = new Date().toISOString()
  list.push({ id: newId, name, description, payload, status: status === 'paused' ? 'paused' : 'active', createdAt: now })
  await setConfigurations(session.user.id, list, session.user.id)
  return NextResponse.json({ success: true, data: { id: newId } })
}

export const GET = withFeatureGuard(handleGET as any, { featureId: 'adscenter_basic', requireToken: false })
export const POST = withFeatureGuard(handlePOST as any, { featureId: 'adscenter_basic', requireToken: false })
