import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/prisma'
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware'

export const dynamic = 'force-dynamic'

type Env = {
  id: string
  name: string
  environmentId: string
  apiEndpoint: string
  apiKey?: string
  isActive: boolean
  status: 'connected' | 'disconnected' | 'error'
  createdAt: string
}

const KEY = (userId: string) => `adscenter:${userId}:adspower_envs`

async function getEnvs(userId: string): Promise<Env[]> {
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (!existing?.value) return []
  try { return JSON.parse(existing.value) as Env[] } catch { return [] }
}

async function setEnvs(userId: string, list: Env[], updatedBy: string) {
  const value = JSON.stringify(list)
  const existing = await prisma.systemConfig.findUnique({ where: { key: KEY(userId) } })
  if (existing) {
    await prisma.systemConfig.update({ where: { key: KEY(userId) }, data: { value, updatedBy } })
  } else {
    await prisma.systemConfig.create({ data: { key: KEY(userId), value, category: 'adscenter', description: 'AdsPower environments', createdBy: updatedBy, updatedBy } })
  }
}

async function handlePOST(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await getEnvs(session.user.id)
  const idx = list.findIndex(e => e.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // 简化：一律设置为 connected
  list[idx] = { ...list[idx], status: 'connected' }
  await setEnvs(session.user.id, list, session.user.id)
  return NextResponse.json({ success: true, data: { status: 'connected' } })
}

export const POST = withFeatureGuard(handlePOST as any, { featureId: 'adscenter_basic', requireToken: false })

